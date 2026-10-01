"""
Cenário estilo Wakfu: recorta as folhas geradas (fundo magenta) em objetos
soltos e prepara texturas, para public/cenario/.

    python3 cenario.py

- scripts/modelos/cenario/obj-*.png: cada pedaço separado vira um objeto
  (nome da folha + índice, ordem de leitura), com o "pé" (base, centro de
  baixo) no manifesto;
- amurada.png: faixa horizontal com alfa (o magenta entre os balaústres some);
- fundo.png: céu e mar, só reduz;
- chao-*.png (se existirem): texturas quadradas, só reduz.
Grava public/cenario/manifesto.json.
"""
import glob, json, os
import cv2, numpy as np
from scipy import ndimage

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORIGEM = os.path.join(RAIZ, 'scripts', 'modelos', 'cenario')
DESTINO = os.path.join(RAIZ, 'public', 'cenario')
os.makedirs(DESTINO, exist_ok=True)


def alfa_magenta(img):
    b, g, r = (img[..., k].astype(int) for k in range(3))
    fundo = (r - g > 90) & (b - g > 90)
    s = ~fundo
    # borda rosada: some (mistura com o fundo)
    rosa = (r - g > 30) & (b - g > 30)
    borda = s & ~ndimage.binary_erosion(s)
    s &= ~(borda & rosa)
    a = cv2.GaussianBlur(s.astype(np.float32), (3, 3), 0.6)
    return s, np.dstack([img, (a * 255).astype(np.uint8)])


def webp(caminho, img, q=92):
    cv2.imwrite(caminho, img, [cv2.IMWRITE_WEBP_QUALITY, q])


# nome de cada objeto (folha, ordem de leitura)
NOMES = {
    'guerra': ['canhao-esq', 'canhao-dir', 'balas', 'barril-polvora'],
    'navio': ['mastro', 'escada', 'ancora', 'timao', 'lanterna'],
    'tesouro': ['bau', 'bau-aberto', 'moedas', 'mapa'],
    'conves': ['piso-1', 'piso-2', 'piso-3', 'piso-4', 'piso-5', 'piso-6', 'piso-7', 'piso-8',
               'piso-quebrado-1', 'piso-quebrado-2', 'piso-grade', 'piso-alcapao', 'cabeco-corda', 'rolo-corda',
               'amurada-pedacos', 'amurada-canto', 'amurada-u', 'amurada-escotilha-1', 'amurada-escotilha-2',
               'escada-1', 'escada-2', 'plataforma-1', 'plataforma-2', 'barril', 'barril-azul', 'caixote',
               'caixote-argola', 'canhao-1', 'canhao-azul', 'base-mastro-corda', 'base-mastro-ferro',
               'cabeco-corrente', 'argola-corrente'],
}
FECHA = {'conves': 1}
man = {'objetos': {}, 'texturas': {}}

for arq in sorted(glob.glob(os.path.join(ORIGEM, 'obj-*.png'))):
    folha = os.path.splitext(os.path.basename(arq))[0][4:]
    img = cv2.imread(arq)
    s, rgba = alfa_magenta(img)
    # folhas apertadas (peças quase encostadas): fecha menos
    lab, n = ndimage.label(ndimage.binary_closing(s, iterations=FECHA.get(folha, 4)))
    objs = []
    for i, fatia in enumerate(ndimage.find_objects(lab)):
        h = fatia[0].stop - fatia[0].start
        w = fatia[1].stop - fatia[1].start
        if h * w < 3000:
            continue
        m = lab[fatia] == i + 1
        # peças que encostam por um canto: erode, vê se viram vários pedaços
        # grandes e devolve cada pixel ao pedaço mais perto
        melhor = (0, None, [])
        for it in (2, 3, 4, 6):
            er = ndimage.binary_erosion(m, iterations=it)
            le, ne = ndimage.label(er)
            tam = ndimage.sum(er, le, range(1, ne + 1))
            gs = [k + 1 for k in range(ne) if tam[k] > 1500]
            if len(gs) > melhor[0]:
                melhor = (len(gs), le, gs)
        _, le, grandes = melhor
        if len(grandes) <= 1:
            objs.append((fatia, m))
            continue
        semente = np.where(np.isin(le, grandes), le, 0)
        _, (iy, ix) = ndimage.distance_transform_edt(semente == 0, return_indices=True)
        dono = semente[iy, ix]
        for g in grandes:
            parte = m & (dono == g)
            ys, xs = np.nonzero(parte)
            f2 = (slice(fatia[0].start + ys.min(), fatia[0].start + ys.max() + 1), slice(fatia[1].start + xs.min(), fatia[1].start + xs.max() + 1))
            objs.append((f2, parte[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    # ordem de leitura: linhas (por centro y, tolerância) e depois x
    objs.sort(key=lambda o: (round((o[0][0].start + o[0][0].stop) / 2 / 250), o[0][1].start))
    for k, (fatia, m) in enumerate(objs):
        rec = rgba[fatia].copy()
        rec[..., 3] = np.where(m, rec[..., 3], 0)
        nomes = NOMES.get(folha, [])
        nome = nomes[k] if k < len(nomes) else f'{folha}-{k + 1}'
        webp(os.path.join(DESTINO, f'{nome}.webp'), rec)
        ys, xs = np.nonzero(rec[..., 3] > 40)
        man['objetos'][nome] = {'l': int(rec.shape[1]), 'a': int(rec.shape[0]), 'pe': [round(float(xs.mean())), int(ys.max())]}
        if nome.startswith('piso'):
            # cantos da face de cima (topo, esquerda, direita): o jogo deforma o
            # piso para o losango exato da casa (a IA não acerta o 2:1)
            a = rec[..., 3] > 100
            ys2, xs2 = np.nonzero(a)
            topo = int(ys2.min())
            man['objetos'][nome]['cantos'] = [
                [round(float(xs2[ys2 <= topo + 1].mean())), topo],
                [int(xs2.min()), int(ys2[xs2 <= xs2.min() + 1].min())],
                [int(xs2.max()), int(ys2[xs2 >= xs2.max() - 1].min())],
            ]
        print(nome, rec.shape[:2])

am = os.path.join(ORIGEM, 'amurada.png')
if os.path.exists(am):
    img = cv2.imread(am)
    s, rgba = alfa_magenta(img)
    ys = np.nonzero(s.any(1))[0]
    rgba = rgba[ys.min():ys.max() + 1]
    rgba = cv2.resize(rgba, (rgba.shape[1] // 2, rgba.shape[0] // 2), interpolation=cv2.INTER_AREA)
    webp(os.path.join(DESTINO, 'amurada.webp'), rgba)
    man['texturas']['amurada'] = {'l': rgba.shape[1], 'a': rgba.shape[0]}

fd = os.path.join(ORIGEM, 'fundo.png')
if os.path.exists(fd):
    img = cv2.imread(fd)
    webp(os.path.join(DESTINO, 'fundo.webp'), img, 88)
    man['texturas']['fundo'] = {'l': img.shape[1], 'a': img.shape[0]}

for arq in sorted(glob.glob(os.path.join(ORIGEM, 'chao-*.png'))):
    nome = os.path.splitext(os.path.basename(arq))[0]
    img = cv2.resize(cv2.imread(arq), (512, 512), interpolation=cv2.INTER_AREA)
    webp(os.path.join(DESTINO, f'{nome}.webp'), img)
    man['texturas'][nome] = {'l': 512, 'a': 512}

with open(os.path.join(DESTINO, 'manifesto.json'), 'w') as f:
    json.dump(man, f, indent=1)
print('ok', len(man['objetos']), 'objetos', list(man['texturas']))
