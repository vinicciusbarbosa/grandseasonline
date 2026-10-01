"""
Esculpe um personagem 3D a partir da folha de personagem (frente, lado e
costas na mesma escala) e grava o que o visualizador precisa para pintar o
volume projetando as próprias vistas (não há textura inventada).

1. silhueta de cada vista: o fundo branco ligado à borda (as linhas de
   contorno do desenho seguram o preenchimento);
2. volume = onde a frente, as costas (espelhadas) e o lado dizem que há corpo;
3. superfície por marching cubes, suavizada;
4. grava a malha (posições, normais, índices) e os recortes das vistas.

    python3 esculpir.py <folha.png> <saida/> [escala]
"""
import base64, io, json, sys
import cv2, numpy as np
from scipy import ndimage
from skimage.measure import marching_cubes

folha, saida = sys.argv[1], sys.argv[2]
ESC = float(sys.argv[3]) if len(sys.argv) > 3 else 1 / 3
im = cv2.imread(folha)
Y0, Y1 = 80, 860
VISTAS = {'frente': (0, 594), 'lado': (592, 790), 'costas': (752, 1216)}


def silhueta(c, nome):
    branco = (c.min(axis=2) > 225)
    lab, _ = ndimage.label(branco)
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sil = ndimage.binary_fill_holes(~np.isin(lab, list(borda)))
    sil = ndimage.binary_opening(sil, iterations=1)
    if nome == 'lado':
        sil[:200, 160:] = False  # mão da vista de costas
    if nome == 'costas':
        sil[180:, :40] = False  # aba do casaco da vista de lado
    lab2, n2 = ndimage.label(sil)
    tam = ndimage.sum(sil, lab2, range(1, n2 + 1))
    return lab2 == (np.argmax(tam) + 1)


rec, sil = {}, {}
for nome, (x0, x1) in VISTAS.items():
    rec[nome] = im[Y0:Y1, x0:x1].copy()
    sil[nome] = silhueta(rec[nome], nome)

H = Y1 - Y0
pe = max(np.nonzero(s)[0].max() for s in sil.values())


def centro_cabeca(s):
    ys, xs = np.nonzero(s[:110])
    return float(xs.mean())


cf, cb = centro_cabeca(sil['frente']), centro_cabeca(sil['costas'])
# lado: o centro do tronco (média da silhueta entre o peito e a cintura)
ys, xs = np.nonzero(sil['lado'][150:420])
cs = float(np.median(xs))
print('centros', cf, cb, cs)

# grade do volume (em px da folha, reduzida por ESC)
meia_l = max(cf, sil['frente'].shape[1] - cf) + 4
meia_p = 110
nx, ny, nz = int(2 * meia_l * ESC), int(H * ESC), int(2 * meia_p * ESC)
X = (np.arange(nx) / ESC - meia_l)
Yp = (np.arange(ny) / ESC)  # linha da imagem
Z = (np.arange(nz) / ESC - meia_p)


def amostra(s, cols, linhas):
    c = np.clip(np.round(cols).astype(int), 0, s.shape[1] - 1)
    l = np.clip(np.round(linhas).astype(int), 0, s.shape[0] - 1)
    ok = (cols >= 0) & (cols < s.shape[1])
    return s[l, c] & ok


Xg, Yg, Zg = np.meshgrid(X, Yp, Z, indexing='ij')
# frente: x da imagem = cf + X; costas: espelhado; lado: o personagem olha
# para a esquerda da imagem (frente = −x na vista de lado), então z = cs − x
vol = amostra(sil['frente'], cf + Xg, Yg) & amostra(sil['costas'], cb - Xg, Yg) & amostra(sil['lado'], cs - Zg, Yg)
print('volume', vol.shape, vol.sum())
campo = ndimage.gaussian_filter(vol.astype(np.float32), (1.2, 0.8, 1.2))
v, f, n, _ = marching_cubes(campo, 0.5)
# índices da grade → px da folha: x (direita do personagem na frente = −x
# da imagem? não: x da imagem da frente), y para cima a partir do pé, z para a frente
px = v[:, 0] / ESC - meia_l
py = pe - v[:, 1] / ESC
pz = v[:, 2] / ESC - meia_p
pos = np.stack([px, py, pz], 1).astype(np.float32)
nor = np.stack([n[:, 0], -n[:, 1], n[:, 2]], 1)
nor = -nor  # marching cubes devolve normais para dentro do campo
nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
print('vértices', len(pos), 'triângulos', len(f))


def webp(img):
    ok, b = cv2.imencode('.webp', img, [cv2.IMWRITE_WEBP_QUALITY, 92])
    return base64.b64encode(b.tobytes()).decode()


import os
os.makedirs(saida, exist_ok=True)
dados = {
    'pe': float(pe),
    'altura': float(H),
    'centros': {'frente': cf, 'costas': cb, 'lado': cs},
    'tamanhos': {k: [int(r.shape[1]), int(r.shape[0])] for k, r in rec.items()},
    'vistas': {k: webp(r) for k, r in rec.items()},
    'pos': base64.b64encode(pos.tobytes()).decode(),
    'nor': base64.b64encode(nor.astype(np.float32).tobytes()).decode(),
    'idx': base64.b64encode(f.astype(np.uint32).tobytes()).decode(),
}
with open(os.path.join(saida, 'boneco.json'), 'w') as fp:
    json.dump(dados, fp)
print('gravado', os.path.getsize(os.path.join(saida, 'boneco.json')) // 1024, 'KB')
