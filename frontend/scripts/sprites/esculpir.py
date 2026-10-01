"""
Esculpe um personagem 3D a partir de vistas desenhadas (folha de personagem:
frente, costas e os dois lados, na pose em T) e grava o que o visualizador
precisa para pintar o volume projetando as próprias vistas — não há textura
inventada.

1. silhueta de cada vista: o fundo branco ligado à borda (as linhas de
   contorno do desenho seguram o preenchimento);
2. todas as vistas na mesma escala: do topo da cabeça ao pé = ALTURA px;
3. volume = onde todas as vistas dizem que há corpo (cada uma espelhada e
   girada para o seu lado);
4. superfície por marching cubes;
5. o fundo de cada vista é preenchido com a cor do desenho mais próxima
   (assim a projeção não puxa branco nas bordas).

    python3 esculpir.py <saida/> [escala]
As vistas ficam em VISTAS (arquivo, recorte, lado).
"""
import base64, json, os, sys
import cv2, numpy as np
from scipy import ndimage
from skimage.measure import marching_cubes

PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'modelos', 'almirante')
# lado: frente (olha para a câmera), costas, esquerda (de perfil olhando para a
# esquerda da imagem = vista do lado +X), direita (olhando para a direita = −X)
VISTAS = {
    'frente': ('folha-sem-casaco.png', (0, 0, 690, 770)),
    'esquerda': ('folha-sem-casaco.png', (690, 0, 860, 770)),
    'costas': ('folha-sem-casaco.png', (860, 0, 1448, 770)),
    'direita': ('folha-8vistas.png', (815, 545, 995, 1086)),
}
ALTURA = 720
saida = sys.argv[1]
ESC = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5


def silhueta(c):
    branco = c.min(axis=2) > 222
    lab, _ = ndimage.label(branco)
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sil = ndimage.binary_fill_holes(~np.isin(lab, list(borda)))
    sil = ndimage.binary_opening(sil, iterations=1)
    lab2, n2 = ndimage.label(sil)
    tam = ndimage.sum(sil, lab2, range(1, n2 + 1))
    return lab2 == (np.argmax(tam) + 1)


vistas = {}
for nome, (arq, (x0, y0, x1, y1)) in VISTAS.items():
    img = cv2.imread(os.path.join(PASTA, arq))[y0:y1, x0:x1]
    s = silhueta(img)
    ys, xs = np.nonzero(s)
    topo, pe = ys.min(), ys.max()
    k = ALTURA / (pe - topo)
    img = img[topo:pe + 1]
    s = s[topo:pe + 1]
    img = cv2.resize(img, (round(img.shape[1] * k), ALTURA + 1), interpolation=cv2.INTER_AREA)
    s = cv2.resize(s.astype(np.uint8), (img.shape[1], ALTURA + 1), interpolation=cv2.INTER_NEAREST).astype(bool)
    # fundo com a cor do desenho mais próxima
    _, (iy, ix) = ndimage.distance_transform_edt(~s, return_indices=True)
    cheio = img[iy, ix]
    # centro: cabeça (frente/costas) ou tronco (lados)
    if nome in ('frente', 'costas'):
        yy, xx = np.nonzero(s[:110])
    else:
        yy, xx = np.nonzero(s[150:420])
    c = float(np.median(xx))
    vistas[nome] = {'img': cheio, 'sil': s, 'c': c}
    print(nome, img.shape, 'centro', round(c, 1))


def dentro(nome, cols, linhas):
    s = vistas[nome]['sil']
    c = np.round(cols).astype(int)
    l = np.clip(np.round(linhas).astype(int), 0, s.shape[0] - 1)
    ok = (c >= 0) & (c < s.shape[1])
    return s[l, np.clip(c, 0, s.shape[1] - 1)] & ok


meia_l = max(max(v['c'], v['sil'].shape[1] - v['c']) for k, v in vistas.items() if k in ('frente', 'costas')) + 6
meia_p = max(max(v['c'], v['sil'].shape[1] - v['c']) for k, v in vistas.items() if k in ('esquerda', 'direita')) + 6
nx, ny, nz = int(2 * meia_l * ESC), int((ALTURA + 1) * ESC), int(2 * meia_p * ESC)
X = np.arange(nx) / ESC - meia_l
L = np.arange(ny) / ESC  # linha (0 = topo da cabeça)
Z = np.arange(nz) / ESC - meia_p
Xg, Lg, Zg = np.meshgrid(X, L, Z, indexing='ij')
# frente: col = cF + X; costas: col = cB − X; esquerda (vista do lado +X,
# o personagem olha para a esquerda da imagem): col = cE − Z; direita
# (vista do lado −X, olha para a direita): col = cD + Z
vol = dentro('frente', vistas['frente']['c'] + Xg, Lg)
vol &= dentro('costas', vistas['costas']['c'] - Xg, Lg)
vol &= dentro('esquerda', vistas['esquerda']['c'] - Zg, Lg)
vol &= dentro('direita', vistas['direita']['c'] + Zg, Lg)
print('volume', vol.shape, int(vol.sum()))
campo = ndimage.gaussian_filter(vol.astype(np.float32), (1.2, 2.2, 1.2))
campo = np.pad(campo, 1)
v, f, n, _ = marching_cubes(campo, 0.5)
v -= 1
pos = np.stack([v[:, 0] / ESC - meia_l, ALTURA - v[:, 1] / ESC, v[:, 2] / ESC - meia_p], 1).astype(np.float32)
nor = np.stack([n[:, 0], -n[:, 1], n[:, 2]], 1)
nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
# normais para fora (o sentido do marching cubes depende do campo)
if (nor * (pos - pos.mean(0))).sum(1).mean() < 0:
    nor = -nor
    f = f[:, ::-1].copy()
print('vértices', len(pos), 'triângulos', len(f))


def webp(img):
    ok, b = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, 92])
    return base64.b64encode(b.tobytes()).decode()


os.makedirs(saida, exist_ok=True)
dados = {
    'altura': ALTURA,
    'vistas': {k: {'img': webp(v['img']), 'c': v['c'], 'l': int(v['img'].shape[1])} for k, v in vistas.items()},
    'pos': base64.b64encode(pos.tobytes()).decode(),
    'nor': base64.b64encode(nor.astype(np.float32).tobytes()).decode(),
    'idx': base64.b64encode(f.astype(np.uint32).tobytes()).decode(),
}
with open(os.path.join(saida, 'boneco.json'), 'w') as fp:
    json.dump(dados, fp)
print('gravado', os.path.getsize(os.path.join(saida, 'boneco.json')) // 1024, 'KB')
