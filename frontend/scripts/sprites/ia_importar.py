"""
Corpos gerados por IA no padrão do Ragnarok (corpo sem cabeça, fundo magenta,
grade de células quadradas; uma linha por direção: frente, costas, direita,
esquerda) -> folhas do jogo, com a cabeça encaixada no pescoço de cada quadro.

    python3 ia_importar.py

Folhas em scripts/modelos/ia/<corpo>-<animação>.png. Cada linha tem os
quadros da animação; o 1º quadro do andar é o parado.
Só 4 direções: as diagonais usam a de lado (apelidos no manifesto).
"""
import json, os
import cv2, numpy as np
from scipy import ndimage

import ro_importar as ro

ORIG = os.path.join(ro.RAIZ, 'scripts', 'modelos', 'ia')
DIRS = ['S', 'N', 'E', 'W']  # ordem das linhas na folha
ALTURA_CORPO = 66  # px do corpo sem cabeça (pose parada), como os corpos do RO


def celulas(arq, colunas):
    """quadros (RGBA) da folha: 4 linhas x `colunas` células quadradas"""
    img = cv2.imread(os.path.join(ORIG, arq))
    b, g, r = (img[..., k].astype(int) for k in range(3))
    s = ~((r - g > 80) & (b - g > 80))
    rosa = (r - g > 25) & (b - g > 25)
    borda = s & ~ndimage.binary_erosion(s)
    s &= ~(borda & rosa)
    # tira o magenta que vazou na borda (lâmina da espada ficava rosa)
    perto = s & ~ndimage.binary_erosion(s, iterations=3)
    m = np.minimum(r, b)
    exc = np.where(perto & (m > g), m - g, 0)
    img = np.dstack([b - exc, g, r - exc]).clip(0, 255).astype(np.uint8)
    rgba = np.dstack([img, np.where(s, 255, 0).astype(np.uint8)])
    H, W = s.shape
    ch, cw = H / 4, W / colunas
    linhas = []
    for i in range(4):
        qs = []
        for j in range(colunas):
            c = rgba[int(i * ch):int((i + 1) * ch), int(j * cw):int((j + 1) * cw)].copy()
            # só o pedaço maior (e o que encosta nele): sobra da célula vizinha sai
            a = c[..., 3] > 0
            lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=3))
            if n > 1:
                maior = 1 + int(np.argmax(ndimage.sum(a, lab, range(1, n + 1))))
                c[..., 3] = np.where(lab == maior, c[..., 3], 0)
            qs.append(c)
        linhas.append(qs)
    return linhas


def reduzir(q, s):
    q = ro.aparar(q)
    h, w = q.shape[:2]
    p = cv2.resize(q, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)
    p[..., 3] = np.where(p[..., 3] > 110, 255, 0)  # borda dura, como pixel art
    return p


def cabecas_4(folha, linha):
    """cabeça do RO (S, SO, O, NO, N) -> frente, costas, direita (espelho), esquerda"""
    c = ro.cabecas(folha, linha)
    return {'S': c[0], 'N': c[4], 'W': c[2], 'E': ro.espelho(c[2])}


def personagem(pid, corpo, cab, densidade=0.82):
    andar = celulas(f'{corpo}-andar.png', 8)
    # escala: corpo parado (frente) com ALTURA_CORPO px
    s = ALTURA_CORPO / ro.aparar(andar[0][0]).shape[0]
    cabs = cabecas_4(*cab)
    anims = {'parado': {}, 'andar': {}, 'correr': {}}
    for i, d in enumerate(DIRS):
        qs = [reduzir(q, s) for q in andar[i]]
        ref = ro.pescoco_parado(qs[0])
        anims['parado'][d] = [ro.montar(qs[0], cabs[d], ref)]
        anims['andar'][d] = [ro.montar(q, cabs[d], ref) for q in qs]
        anims['correr'][d] = anims['andar'][d]
    tempos = {'andar': {'fps': 10}, 'correr': {'fps': 12}}
    ro.gravar(pid, anims, tempos, densidade, 'Corpo gerado por IA; cabeça provisória do Ragnarok (teste)')
    arq = os.path.join(ro.SPR, pid, 'manifesto.json')
    man = json.load(open(arq))
    man['apelidos'] = {'SE': 'E', 'NE': 'E', 'SW': 'W', 'NW': 'W'}
    json.dump(man, open(arq, 'w'), indent=1)
    print(pid, {n: len(v['S']) for n, v in anims.items()})


if __name__ == '__main__':
    personagem('pirata-espadachim', 'espadachim', ('cabecas-4.png', 1))
