"""
Gera esqueletos OpenPose (ControlNet) de uma animação nas 8 direções e os
fluxos prontos do ComfyUI que desenham o personagem em cima deles.

    python3 frontend/scripts/sprites/comfy_poses.py correr

Saída (em docs/comfyui/):
  entrada/                         tudo que o fluxo carrega (copiar para ComfyUI\\input):
                                     pose_<anim>_<DIR>_NN.png e almirante_<DIR>.png
  poses/previa_<anim>.png          todos os esqueletos lado a lado
  fluxos/<anim>_<DIR>.json         fluxo: abre no ComfyUI e clica em Run

O esqueleto é um boneco 3D simples (proporção de chibi, cabeça grande como a
do almirante) animado por ângulos de quadril/joelho/ombro/cotovelo e
projetado com a mesma inclinação da câmera do jogo — por isso as pernas
alternam certinho em qualquer direção.
"""
import json
import math
import os
import sys

import cv2
import numpy as np

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SAIDA = os.path.join(RAIZ, 'docs', 'comfyui')
L, A = 832, 1216  # tamanho da imagem gerada (SDXL retrato)
INCLINACAO = math.radians(35)  # câmera olhando de cima

# direção -> vetor "para frente" no chão (x = direita da tela, d = para o fundo)
DIRECOES = {'S': (0, -1), 'SE': (1, -1), 'E': (1, 0), 'NE': (1, 1),
            'N': (0, 1), 'NW': (-1, 1), 'W': (-1, 0), 'SW': (-1, -1)}

# proporções (altura total = 1): cabeça grande
Y_PESCOCO, Y_OMBRO, Y_QUADRIL = 0.70, 0.68, 0.47
OMBRO, QUADRIL = 0.13, 0.075
BRACO, ANTEBRACO, COXA, CANELA = 0.15, 0.13, 0.22, 0.23

# OpenPose COCO-18 (índices 0..17)
NOSE, NECK, RSHO, RELB, RWRI, LSHO, LELB, LWRI, RHIP, RKNE, RANK, LHIP, LKNE, LANK, REYE, LEYE, REAR, LEAR = range(18)
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
         (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
CORES = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0],
         [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255],
         [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85]]


# ciclo de corrida (fase 0 = pé toca o chão à frente): (fase, coxa°, joelho°)
# coxa + = para a frente; joelho = quanto dobra. Apoio 0–0.4, voo 0.4–0.5.
CICLO = [(0.0, 30, 15), (0.1, 20, 38), (0.25, 0, 30), (0.4, -25, 18), (0.55, -18, 80),
         (0.7, 12, 95), (0.85, 34, 65), (1.0, 30, 15)]


def angulos(fase):
    for (f0, c0, j0), (f1, c1, j1) in zip(CICLO, CICLO[1:]):
        if f0 <= fase <= f1:
            u = (fase - f0) / (f1 - f0)
            u = 0.5 - 0.5 * math.cos(math.pi * u)
            return c0 + (c1 - c0) * u, j0 + (j1 - j0) * u
    return CICLO[0][1], CICLO[0][2]


def perna(quadril, frente, fase):
    """Joelho e tornozelo da perna na fase do ciclo."""
    c, j = angulos(fase % 1)
    coxa, canela = math.radians(c), math.radians(c - j)
    k = quadril + COXA * math.sin(coxa) * frente + np.array([0, -COXA * math.cos(coxa), 0])
    t = k + CANELA * math.sin(canela) * frente + np.array([0, -CANELA * math.cos(canela), 0])
    return k, t


def braco(ombro, frente, lado, balanco, fixo):
    if fixo:  # mão do sabre: parada junto à cintura
        cot = ombro + np.array([0, -BRACO * 0.95, 0]) + frente * 0.03 + lado * 0.02
        pun = cot + frente * 0.07 + np.array([0, -0.06, 0]) - lado * 0.03
        return cot, pun
    a = math.radians(balanco)
    cot = ombro + BRACO * math.sin(a) * frente + np.array([0, -BRACO * math.cos(a), 0])
    b = a + math.radians(85)  # cotovelo dobrado, punho para a frente/cima
    pun = cot + ANTEBRACO * math.sin(b) * frente + np.array([0, -ANTEBRACO * math.cos(b), 0])
    return cot, pun


def pose(direcao, t, sabre_na_direita=True):
    fx, fd = DIRECOES[direcao]
    n = math.hypot(fx, fd)
    frente = np.array([fx / n, 0, fd / n])        # (x, y, d)
    direita = np.array([fd / n, 0, -fx / n])      # lado direito do personagem
    cima = np.array([0, 1.0, 0])
    inclina = math.radians(10)                    # tronco inclinado para a frente
    fr, fl = t % 1, (t + 0.5) % 1                 # fases das pernas (direita pisa no quadro 1)
    p = [None] * 18
    base = np.zeros(3)
    quad = base + cima * Y_QUADRIL
    p[RHIP], p[LHIP] = quad + direita * QUADRIL, quad - direita * QUADRIL
    p[RKNE], p[RANK] = perna(p[RHIP], frente, fr)
    p[LKNE], p[LANK] = perna(p[LHIP], frente, fl)
    tronco = (Y_PESCOCO - Y_QUADRIL)
    p[NECK] = quad + cima * tronco * math.cos(inclina) + frente * tronco * math.sin(inclina)
    oy = p[NECK] - cima * (Y_PESCOCO - Y_OMBRO)
    p[RSHO], p[LSHO] = oy + direita * OMBRO, oy - direita * OMBRO
    bal = 35 * math.cos(2 * math.pi * fr)  # braço oposto à perna do mesmo lado (direita à frente → braço direito atrás)
    p[RELB], p[RWRI] = braco(p[RSHO], frente, direita, -bal, sabre_na_direita)
    p[LELB], p[LWRI] = braco(p[LSHO], frente, -direita, bal, not sabre_na_direita)
    cab = p[NECK] + cima * 0.14 + frente * 0.02
    p[NOSE] = cab + frente * 0.07 - cima * 0.01
    p[REYE], p[LEYE] = cab + frente * 0.06 + direita * 0.04 + cima * 0.02, cab + frente * 0.06 - direita * 0.04 + cima * 0.02
    p[REAR], p[LEAR] = cab + direita * 0.08, cab - direita * 0.08
    # pé de apoio no chão; no voo (nenhum pé apoiado) o corpo sobe
    apoio = [pe for pe, f in ((p[RANK], fr), (p[LANK], fl)) if f < 0.42]
    chao = min(pe[1] for pe in apoio) if apoio else min(p[RANK][1], p[LANK][1]) - 0.03
    for i in range(18):
        p[i] = p[i] - np.array([0, chao - 0.02, 0])
    # visibilidade: rosto só de frente; olho/orelha do lado de trás some
    para_camera = np.array([0, 0, -1.0])
    vis = [True] * 18
    if frente @ para_camera < -0.3:
        vis[NOSE] = vis[REYE] = vis[LEYE] = False
    for olho, orelha, s in ((REYE, REAR, 1), (LEYE, LEAR, -1)):
        if (direita * s) @ para_camera < -0.5:
            vis[olho] = vis[orelha] = False
    return p, vis


def projetar(p3):
    x, y, d = p3
    sy = y * math.cos(INCLINACAO) + d * math.sin(INCLINACAO)
    esc = A * 1.02
    return np.array([L / 2 + x * esc, A * 0.84 - sy * esc])


def desenhar(p, vis):
    img = np.zeros((A, L, 3), np.uint8)
    pts = [projetar(q) for q in p]
    grossura = 9
    for i, (a, b) in enumerate(LIMBS):
        if not (vis[a] and vis[b]):
            continue
        camada = img.copy()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        comp = math.hypot(x2 - x1, y2 - y1) / 2
        ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
        poly = cv2.ellipse2Poly((int(mx), int(my)), (int(comp), grossura), int(ang), 0, 360, 1)
        cv2.fillConvexPoly(camada, poly, CORES[i][::-1])
        img = cv2.addWeighted(img, 0.4, camada, 0.6, 0)
    for i, (x, y) in enumerate(pts):
        if vis[i]:
            cv2.circle(img, (int(x), int(y)), 7, CORES[i][::-1], -1)
    return img


# ------------------------------------------------------------------ fluxo
def fluxo(anim, direcao, quadros, ref):
    """Fluxo do ComfyUI (formato da interface): modelo + LoRA + IP-Adapter
    compartilhados, e um ramo ControlNet → KSampler → Salvar por quadro."""
    nos, links = [], []
    prox = [1, 1]

    def no(tipo, widgets, entradas=(), saidas=(), pos=(0, 0), titulo=None):
        i = prox[0]
        prox[0] += 1
        n = {'id': i, 'type': tipo, 'pos': list(pos), 'size': [300, 100], 'flags': {}, 'order': i, 'mode': 0,
             'inputs': [{'name': nm, 'type': tp, 'link': None} for nm, tp in entradas],
             'outputs': [{'name': nm, 'type': tp, 'links': [], 'slot_index': k} for k, (nm, tp) in enumerate(saidas)],
             'properties': {'Node name for S&R': tipo}, 'widgets_values': widgets}
        if titulo:
            n['title'] = titulo
        nos.append(n)
        return n

    def liga(a, sa, b, eb):
        lid = prox[1]
        prox[1] += 1
        tipo = a['outputs'][sa]['type']
        links.append([lid, a['id'], sa, b['id'], eb, tipo])
        a['outputs'][sa]['links'].append(lid)
        b['inputs'][eb]['link'] = lid

    ck = no('CheckpointLoaderSimple', ['animagine-xl-4.0.safetensors'], (), [('MODEL', 'MODEL'), ('CLIP', 'CLIP'), ('VAE', 'VAE')], (0, 0))
    lo = no('LoraLoader', ['pixel-art-xl.safetensors', 0.8, 0.8], [('model', 'MODEL'), ('clip', 'CLIP')], [('MODEL', 'MODEL'), ('CLIP', 'CLIP')], (0, 160))
    liga(ck, 0, lo, 0)
    liga(ck, 1, lo, 1)
    ref_img = no('LoadImage', [ref, 'image'], (), [('IMAGE', 'IMAGE'), ('MASK', 'MASK')], (0, 320), 'Personagem (referência)')
    ipl = no('IPAdapterUnifiedLoader', ['PLUS (high strength)'], [('model', 'MODEL'), ('ipadapter', 'IPADAPTER')], [('model', 'MODEL'), ('ipadapter', 'IPADAPTER')], (350, 0))
    liga(lo, 0, ipl, 0)
    ipa = no('IPAdapterAdvanced', [0.8, 'linear', 'concat', 0.0, 1.0, 'V only'],
             [('model', 'MODEL'), ('ipadapter', 'IPADAPTER'), ('image', 'IMAGE'), ('image_negative', 'IMAGE'), ('attn_mask', 'MASK'), ('clip_vision', 'CLIP_VISION')],
             [('MODEL', 'MODEL')], (350, 160), 'IP-Adapter (aparência)')
    liga(ipl, 0, ipa, 0)
    liga(ipl, 1, ipa, 1)
    liga(ref_img, 0, ipa, 2)
    positivo = ('1boy, solo, full body, young navy admiral, white peaked cap, spiky black hair, navy blue double-breasted suit, '
                'gold buttons, white admiral coat draped over shoulders like a cape, holding sheathed saber at the waist, '
                f'running, {"front view" if direcao == "S" else "back view" if direcao == "N" else "side view" if direcao in "EW" else "three-quarter view"}, '
                'pixel art, simple magenta background, masterpiece, high score, great score, absurdres')
    negativo = 'lowres, bad anatomy, extra legs, extra arms, text, watermark, multiple views, shadow on ground, blurry, cropped'
    pos = no('CLIPTextEncode', [positivo], [('clip', 'CLIP')], [('CONDITIONING', 'CONDITIONING')], (350, 320), 'Texto (positivo)')
    neg = no('CLIPTextEncode', [negativo], [('clip', 'CLIP')], [('CONDITIONING', 'CONDITIONING')], (350, 480), 'Texto (negativo)')
    liga(lo, 1, pos, 0)
    liga(lo, 1, neg, 0)
    cn = no('ControlNetLoader', ['controlnet-openpose-sdxl.safetensors'], (), [('CONTROL_NET', 'CONTROL_NET')], (0, 480))
    lat = no('EmptyLatentImage', [L, A, 1], (), [('LATENT', 'LATENT')], (0, 600))
    for k in range(quadros):
        x = 700 + k * 330
        pimg = no('LoadImage', [f'pose_{anim}_{direcao}_{k + 1:02d}.png', 'image'], (), [('IMAGE', 'IMAGE'), ('MASK', 'MASK')], (x, 0), f'Esqueleto {k + 1}')
        ap = no('ControlNetApplyAdvanced', [0.9, 0.0, 1.0],
                [('positive', 'CONDITIONING'), ('negative', 'CONDITIONING'), ('control_net', 'CONTROL_NET'), ('image', 'IMAGE'), ('vae', 'VAE')],
                [('positive', 'CONDITIONING'), ('negative', 'CONDITIONING')], (x, 360), f'Pose {k + 1}')
        liga(pos, 0, ap, 0)
        liga(neg, 0, ap, 1)
        liga(cn, 0, ap, 2)
        liga(pimg, 0, ap, 3)
        ks = no('KSampler', [123456, 'fixed', 28, 5.0, 'euler_ancestral', 'normal', 1.0],
                [('model', 'MODEL'), ('positive', 'CONDITIONING'), ('negative', 'CONDITIONING'), ('latent_image', 'LATENT')],
                [('LATENT', 'LATENT')], (x, 560), f'Gerar {k + 1}')
        liga(ipa, 0, ks, 0)
        liga(ap, 0, ks, 1)
        liga(ap, 1, ks, 2)
        liga(lat, 0, ks, 3)
        vd = no('VAEDecode', [], [('samples', 'LATENT'), ('vae', 'VAE')], [('IMAGE', 'IMAGE')], (x, 860))
        liga(ks, 0, vd, 0)
        liga(ck, 2, vd, 1)
        sv = no('SaveImage', [f'{anim}_{direcao}/{k + 1:02d}'], [('images', 'IMAGE')], (), (x, 960))
        liga(vd, 0, sv, 0)
    return {'last_node_id': prox[0] - 1, 'last_link_id': prox[1] - 1, 'nodes': nos, 'links': links,
            'groups': [], 'config': {}, 'extra': {}, 'version': 0.4}


def gerar(anim='correr', quadros=12):
    import shutil
    os.makedirs(os.path.join(SAIDA, 'poses'), exist_ok=True)
    os.makedirs(os.path.join(SAIDA, 'entrada'), exist_ok=True)
    for d in DIRECOES:  # referência de aparência = primeiro quadro do parado
        ref = os.path.join(RAIZ, 'docs', 'sprites', 'almirante', 'idle', f'parado_{d}.png')
        if os.path.exists(ref):
            shutil.copy(ref, os.path.join(SAIDA, 'entrada', f'almirante_{d}.png'))
    os.makedirs(os.path.join(SAIDA, 'fluxos'), exist_ok=True)
    previa = []
    for d in DIRECOES:
        linha = []
        for k in range(quadros):
            img = desenhar(*pose(d, k / quadros))
            cv2.imwrite(os.path.join(SAIDA, 'entrada', f'pose_{anim}_{d}_{k + 1:02d}.png'), img)
            linha.append(cv2.resize(img, (L // 6, A // 6), interpolation=cv2.INTER_AREA))
        previa.append(np.concatenate(linha, axis=1))
        with open(os.path.join(SAIDA, 'fluxos', f'{anim}_{d}.json'), 'w') as f:
            json.dump(fluxo(anim, d, quadros, f'almirante_{d}.png'), f, indent=1)
    cv2.imwrite(os.path.join(SAIDA, 'poses', f'previa_{anim}.png'), np.concatenate(previa, axis=0))
    print('ok:', os.path.join(SAIDA, 'poses'))


if __name__ == '__main__':
    gerar(*(sys.argv[1:2] or ['correr']))
