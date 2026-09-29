"""
Gera uma animação no ComfyUI que está aberto no PC, sem copiar arquivos
nem abrir fluxo: envia as imagens (esqueletos + referência) pela API do
ComfyUI, dispara a geração e baixa os quadros para docs/comfyui/saida/.

Uso (no Windows, com o ComfyUI aberto):  duplo clique em gerar_comfy.bat
    ou:  gerar_comfy.bat correr S        (animação, direção)
         gerar_comfy.bat correr S 1      (só o 1º quadro, para testar)

Só usa a biblioteca padrão do Python (roda com o Python do próprio ComfyUI).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ENTRADA = os.path.join(RAIZ, 'docs', 'comfyui', 'entrada')
SAIDA = os.path.join(RAIZ, 'docs', 'comfyui', 'saida')
PORTAS = [int(os.environ['COMFY_PORTA'])] if os.environ.get('COMFY_PORTA') else [8188, 8000]
L, A = 832, 1216

MODELOS = {
    'checkpoints': 'animagine-xl-4.0.safetensors',
    'controlnet': 'controlnet-openpose-sdxl.safetensors',
    'loras': 'pixel-art-xl.safetensors',
    'ipadapter': 'ip-adapter-plus_sdxl_vit-h.safetensors',
    'clip_vision': 'CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors',
}
VISTA = {'S': 'front view', 'N': 'back view', 'E': 'side view', 'W': 'side view'}
POSITIVO = ('1boy, solo, full body, young navy admiral, white peaked cap, spiky black hair, navy blue double-breasted '
            'suit, gold buttons, white admiral coat draped over shoulders like a cape, holding sheathed saber at the '
            'waist, {acao}, {vista}, pixel art, simple magenta background, masterpiece, high score, great score, absurdres')
NEGATIVO = 'lowres, bad anatomy, extra legs, extra arms, text, watermark, multiple views, shadow on ground, blurry, cropped'
ACAO = {'correr': 'running', 'andar': 'walking', 'parado': 'standing'}

URL = None


def api(caminho, dados=None, cab=None):
    req = urllib.request.Request(URL + caminho, data=dados, headers=cab or {})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def achar_comfy():
    global URL
    for p in PORTAS:
        URL = f'http://127.0.0.1:{p}'
        try:
            api('/system_stats')
            return
        except Exception:
            pass
    sys.exit('Não achei o ComfyUI aberto (portas %s). Abra o ComfyUI e rode de novo.' % PORTAS)


def conferir_modelos():
    faltando = []
    for pasta, nome in MODELOS.items():
        try:
            lista = json.loads(api(f'/models/{pasta}'))
        except Exception:
            continue  # versão sem essa rota: o erro aparece na geração
        if nome not in lista:
            faltando.append(f'  {pasta}\\{nome}   (tem: {", ".join(lista) or "nada"})')
    if faltando:
        sys.exit('Faltam modelos (ou estão com outro nome):\n' + '\n'.join(faltando))


def enviar(arquivo):
    """Envia uma imagem para a pasta input do ComfyUI (a que ele usa de verdade)."""
    limite = uuid.uuid4().hex
    nome = os.path.basename(arquivo)
    corpo = (f'--{limite}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
             f'--{limite}\r\nContent-Disposition: form-data; name="image"; filename="{nome}"\r\n'
             'Content-Type: image/png\r\n\r\n').encode() + open(arquivo, 'rb').read() + f'\r\n--{limite}--\r\n'.encode()
    api('/upload/image', corpo, {'Content-Type': f'multipart/form-data; boundary={limite}'})
    return nome


def montar(anim, d, poses, ref, seed):
    """Fluxo no formato da API (id -> {class_type, inputs})."""
    p = {}

    def no(i, tipo, **ent):
        p[str(i)] = {'class_type': tipo, 'inputs': ent}
        return [str(i), 0]

    ck = no(1, 'CheckpointLoaderSimple', ckpt_name=MODELOS['checkpoints'])
    lo = no(2, 'LoraLoader', model=ck, clip=['1', 1], lora_name=MODELOS['loras'], strength_model=0.8, strength_clip=0.8)
    rf = no(3, 'LoadImage', image=ref)
    ul = no(4, 'IPAdapterUnifiedLoader', model=lo, preset='PLUS (high strength)')
    ip = no(5, 'IPAdapterAdvanced', model=ul, ipadapter=['4', 1], image=rf, weight=0.8, weight_type='linear',
            combine_embeds='concat', start_at=0.0, end_at=1.0, embeds_scaling='V only')
    vista = VISTA.get(d, 'three-quarter view')
    pos = no(6, 'CLIPTextEncode', clip=['2', 1], text=POSITIVO.format(acao=ACAO.get(anim, anim), vista=vista))
    neg = no(7, 'CLIPTextEncode', clip=['2', 1], text=NEGATIVO)
    cn = no(8, 'ControlNetLoader', control_net_name=MODELOS['controlnet'])
    lat = no(9, 'EmptyLatentImage', width=L, height=A, batch_size=1)
    saidas = []
    for k, pose in enumerate(poses):
        b = 100 + k * 10
        im = no(b, 'LoadImage', image=pose)
        ap = no(b + 1, 'ControlNetApplyAdvanced', positive=pos, negative=neg, control_net=cn, image=im,
                strength=0.9, start_percent=0.0, end_percent=1.0)
        ks = no(b + 2, 'KSampler', model=ip, positive=ap, negative=[str(b + 1), 1], latent_image=lat, seed=seed,
                steps=28, cfg=5.0, sampler_name='euler_ancestral', scheduler='normal', denoise=1.0)
        vd = no(b + 3, 'VAEDecode', samples=ks, vae=['1', 2])
        no(b + 4, 'SaveImage', images=vd, filename_prefix=f'{anim}_{d}/{k + 1:02d}')
        saidas.append(str(b + 4))
    return p, saidas


def main():
    anim = sys.argv[1] if len(sys.argv) > 1 else 'correr'
    d = sys.argv[2] if len(sys.argv) > 2 else 'S'
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 123456
    achar_comfy()
    print('ComfyUI em', URL)
    conferir_modelos()
    poses = [os.path.join(ENTRADA, f'pose_{anim}_{d}_{k + 1:02d}.png') for k in range(n)]
    ref = os.path.join(ENTRADA, f'almirante_{d}.png')
    for f in poses + [ref]:
        if not os.path.exists(f):
            sys.exit(f'Não achei {f} — deu git pull?')
    print('Enviando imagens...')
    poses = [enviar(f) for f in poses]
    ref = enviar(ref)
    prompt, saidas = montar(anim, d, poses, ref, seed)
    try:
        r = json.loads(api('/prompt', json.dumps({'prompt': prompt, 'client_id': uuid.uuid4().hex}).encode(),
                           {'Content-Type': 'application/json'}))
    except urllib.error.HTTPError as e:
        sys.exit('O ComfyUI recusou o fluxo:\n' + e.read().decode(errors='replace')[:3000])
    pid = r['prompt_id']
    print(f'Gerando {n} quadro(s) de {anim} {d}... (acompanhe no ComfyUI)')
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.loads(api(f'/history/{pid}'))
        if pid in h:
            h = h[pid]
            break
        print(f'  {int(time.time() - t0)} s', end='\r')
    st = h.get('status', {})
    if st.get('status_str') == 'error':
        msgs = [m for m in st.get('messages', []) if m[0] == 'execution_error']
        sys.exit('Erro na geração:\n' + json.dumps(msgs, indent=1, ensure_ascii=False)[:3000])
    pasta = os.path.join(SAIDA, f'{anim}_{d}')
    os.makedirs(pasta, exist_ok=True)
    for k, sid in enumerate(saidas):
        for img in h['outputs'].get(sid, {}).get('images', []):
            q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
            with open(os.path.join(pasta, f'{k + 1:02d}.png'), 'wb') as f:
                f.write(api('/view?' + q))
    print(f'\nPronto em {int(time.time() - t0)} s. Quadros em: {pasta}')
    print('Agora: git add docs/comfyui/saida && git commit -m "quadros" && git push  (ou me mande a pasta)')


if __name__ == '__main__':
    main()
