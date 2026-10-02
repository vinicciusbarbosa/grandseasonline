"""
TESTE (não distribuir): monta um personagem no esquema do Ragnarok — corpo
sem cabeça + cabeça (penteado) por cima, encaixada no pescoço de cada quadro —
a partir das folhas em scripts/modelos/teste-ro/ e grava folhas do jogo em
public/sprites/teste-ro/ (parado e andar, 5 direções desenhadas).

As folhas de teste são do Ragnarok Online (Gravity): só para ver o sistema
de camadas funcionando; não podem ir para o jogo publicado.

    python3 teste_ro.py [linha-do-cabelo]
"""
import json, os, sys
import cv2, numpy as np
from scipy import ndimage

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORIG = os.path.join(RAIZ, 'scripts', 'modelos', 'teste-ro')
DEST = os.path.join(RAIZ, 'public', 'sprites', 'teste-ro')
LINHA_CABELO = int(sys.argv[1]) if len(sys.argv) > 1 else 0

corpo = cv2.imread(os.path.join(ORIG, 'corpo.png'), cv2.IMREAD_UNCHANGED)
cabelos = cv2.imread(os.path.join(ORIG, 'cabelos.png'), cv2.IMREAD_UNCHANGED)


def pecas(img, y0, y1):
    """recortes (x0, rgba) numa faixa horizontal, da esquerda para a direita"""
    al = img[y0:y1, :, 3] > 0
    lab, _ = ndimage.label(ndimage.binary_dilation(al, iterations=2))
    out = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        if s[0].stop - s[0].start < 15 or s[1].stop - s[1].start > 150:
            continue
        m = lab[s] == i + 1
        rec = img[y0 + s[0].start:y0 + s[0].stop, s[1]].copy()
        rec[..., 3] = np.where(m & (rec[..., 3] > 0), rec[..., 3], 0)
        out.append((s[1].start, rec))
    return [r for _, r in sorted(out, key=lambda t: t[0])]


# corpo: parado (5 direções), andar (5 linhas × 8)
PARADO = pecas(corpo, 5, 90)[:5]
ANDAR = [pecas(corpo, y0, y1)[:8] for y0, y1 in [(100, 188), (200, 290), (300, 388), (400, 488), (500, 590)]]
# cabeça: 5 direções (S, SW, W, NW, N) na linha escolhida
passo = 50
yc = 4 + LINHA_CABELO * 50
CABECAS = pecas(cabelos, yc, yc + 40)[:5]

L, A = 96, 112
PE = (48, 106)
SOBRE = 4  # quanto a cabeça desce sobre o pescoço


def caixa(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def montar(cp, cb):
    q = np.zeros((A, L, 4), np.uint8)
    x0, y0, x1, y1 = caixa(cp)
    cp = cp[y0:y1, x0:x1]
    # centro do tronco: meio das colunas ocupadas nas 12 primeiras linhas
    topo = cp[:12, :, 3] > 0
    cx = float(np.nonzero(topo.any(0))[0].mean())
    ox = int(round(PE[0] - cx))
    oy = PE[1] - cp.shape[0]
    def pintar(img, x, y):
        h, w = img.shape[:2]
        a = img[..., 3:] / 255.0
        reg = q[y:y + h, x:x + w]
        reg[..., :3] = (img[..., :3] * a + reg[..., :3] * (1 - a)).astype(np.uint8)
        reg[..., 3] = np.maximum(reg[..., 3], img[..., 3])
    pintar(cp, ox, oy)
    hx0, hy0, hx1, hy1 = caixa(cb)
    cb = cb[hy0:hy1, hx0:hx1]
    pintar(cb, int(round(PE[0] - cb.shape[1] / 2)), oy - cb.shape[0] + SOBRE)
    return q


# RO desenha S, SW, W, NW, N (olhando para a esquerda); o jogo quer S, SE, E, NE, N
# e espelha o resto: os três do meio vão espelhados
DIRS = ['S', 'SE', 'E', 'NE', 'N']
os.makedirs(DEST, exist_ok=True)
anims = {'parado': {}, 'andar': {}, 'correr': {}}
for i, d in enumerate(DIRS):
    esp = (lambda im: im[:, ::-1]) if d in ('SE', 'E', 'NE') else (lambda im: im)
    par = esp(montar(PARADO[i], CABECAS[i]))
    cv2.imwrite(os.path.join(DEST, f'parado_{d}.png'), par)
    anims['parado'][d] = {'arquivo': f'parado_{d}.png', 'quadros': 1}
    tira = np.hstack([esp(montar(c, CABECAS[i])) for c in ANDAR[i]])
    cv2.imwrite(os.path.join(DEST, f'andar_{d}.png'), tira)
    anims['andar'][d] = {'arquivo': f'andar_{d}.png', 'quadros': len(ANDAR[i])}
    anims['correr'][d] = {'arquivo': f'andar_{d}.png', 'quadros': len(ANDAR[i])}
json.dump({'quadro': [L, A], 'pe': list(PE), 'altura': 90, 'densidade': 0.78,
           'fonte': 'TESTE — sprites do Ragnarok Online (Gravity), não distribuir', 'anims': anims},
          open(os.path.join(DEST, 'manifesto.json'), 'w'), indent=1)
print('ok', [len(r) for r in ANDAR], len(CABECAS))
