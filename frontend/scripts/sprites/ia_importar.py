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


def celulas(arq, colunas, linhas=4):
    """quadros (RGBA) da folha: `linhas` x `colunas`. Cada pedaço desenhado vai
    para a célula onde está o seu centro (a espada do golpe pode passar da
    célula e não é cortada)"""
    img = cv2.imread(os.path.join(ORIG, arq))
    b, g, r = (img[..., k].astype(int) for k in range(3))
    s = ~((r - g > 80) & (b - g > 80))
    rosa = (r - g > 25) & (b - g > 25)
    borda = s & ~ndimage.binary_erosion(s)
    s &= ~(borda & rosa)
    s = ndimage.binary_opening(s)
    # tira o magenta que vazou na borda (lâmina da espada ficava rosa)
    perto = s & ~ndimage.binary_erosion(s, iterations=3)
    m = np.minimum(r, b)
    exc = np.where(perto & (m > g), m - g, 0)
    img = np.dstack([b - exc, g, r - exc]).clip(0, 255).astype(np.uint8)
    rgba = np.dstack([img, np.where(s, 255, 0).astype(np.uint8)])
    H, W = s.shape
    ch, cw = H / linhas, W / colunas
    lab, n = ndimage.label(ndimage.binary_dilation(s, iterations=3))
    lab = np.where(s, lab, 0)
    dono = {}
    for k, (cy, cx) in enumerate(ndimage.center_of_mass(s, lab, range(1, n + 1)), 1):
        tam = (lab == k).sum() if n < 400 else 1
        if tam < 40:
            continue
        dono.setdefault((min(linhas - 1, int(cy / ch)), min(colunas - 1, int(cx / cw))), []).append(k)
    out = []
    for i in range(linhas):
        qs = []
        for j in range(colunas):
            ks = dono.get((i, j), [])
            # o maior pedaço da célula e o que está perto dele
            m = np.isin(lab, ks)
            q = rgba.copy()
            q[..., 3] = np.where(m, q[..., 3], 0)
            qs.append(ro.aparar(q))
        out.append(qs)
    return out


def reduzir(q, s):
    q = ro.aparar(q)
    h, w = q.shape[:2]
    # reduz pré-multiplicado (o fundo magenta não mancha a borda)
    a = q[..., 3:].astype(np.float32) / 255
    pm = np.dstack([q[..., :3] * a, a * 255]).astype(np.float32)
    p = cv2.resize(pm, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)
    al = p[..., 3:] / 255
    rgb = np.where(al > 0, p[..., :3] / np.maximum(al, 1e-6), 0)
    p = np.dstack([rgb, np.where(p[..., 3:] > 110, 255, 0)]).clip(0, 255).astype(np.uint8)  # borda dura
    return p


def cabecas_ro(folha, linha):
    """cabeça do RO (S, SO, O, NO, N) -> frente, costas, direita (espelho), esquerda"""
    c = ro.cabecas(folha, linha)
    return {'S': c[0], 'N': c[4], 'W': c[2], 'E': ro.espelho(c[2])}


def cabecas_ia(arq, altura):
    """folha de cabeça da IA (frente, costas, direita, esquerda) com `altura` px.
    Cada cabeça ganha margem para o queixo ficar no meio (o montar centraliza)"""
    out = {}
    for d, q in zip(DIRS, celulas(arq, 4, 1)[0]):
        q = reduzir(q, altura / q.shape[0])
        a = q[..., 3] > 0
        h = a.shape[0]
        ys, xs = np.nonzero(a[int(h * 0.82):])
        queixo = float(xs.mean())
        falta = int(round(2 * queixo - q.shape[1]))
        if falta > 0:
            q = np.pad(q, ((0, 0), (0, falta), (0, 0)))
        elif falta < 0:
            q = np.pad(q, ((0, 0), (-falta, 0), (0, 0)))
        out[d] = q
    return out


def personagem(pid, corpo, cabeca, densidade=0.82):
    """cabeca: ('cabecas-N.png', linha) do RO ou 'arquivo.png' gerado por IA"""
    andar = celulas(f'{corpo}-andar.png', 8)
    # escala: corpo parado (frente) com ALTURA_CORPO px
    s = ALTURA_CORPO / andar[0][0].shape[0]
    cabs = cabecas_ia(cabeca, round(ALTURA_CORPO * 0.5)) if isinstance(cabeca, str) else cabecas_ro(*cabeca)
    anims = {'parado': {}, 'andar': {}, 'correr': {}}
    refs = {}
    for i, d in enumerate(DIRS):
        qs = [reduzir(q, s) for q in andar[i]]
        ref = refs[d] = ro.pescoco_parado(qs[0])
        # corpo da IA se inclina mais no golpe: procura o pescoço numa faixa larga
        ref.update(banda=11, perc=30)
        anims['parado'][d] = [ro.montar(qs[0], cabs[d], ref)]
        anims['andar'][d] = [ro.montar(q, cabs[d], ref) for q in qs]
        anims['correr'][d] = anims['andar'][d]
    tempos = {'andar': {'fps': 10}, 'correr': {'fps': 12}}
    if os.path.exists(os.path.join(ORIG, f'{corpo}-atacar.png')):
        atacar = celulas(f'{corpo}-atacar.png', 6)
        anims['atacar'] = {d: [ro.montar(reduzir(q, s), cabs[d], refs[d], 'pe') for q in atacar[i]] for i, d in enumerate(DIRS)}
        tempos['atacar'] = {'fps': 10, 'impacto': 3}
    ro.gravar(pid, anims, tempos, densidade, 'Gerado por IA no padrão do Ragnarok (teste)')
    arq = os.path.join(ro.SPR, pid, 'manifesto.json')
    man = json.load(open(arq))
    man['apelidos'] = {'SE': 'E', 'NE': 'E', 'SW': 'W', 'NW': 'W'}
    json.dump(man, open(arq, 'w'), indent=1)
    print(pid, {n: len(v['S']) for n, v in anims.items()})


if __name__ == '__main__':
    # teste: o corpo novo fica no Capitão (o Espadachim volta ao do RO)
    personagem('pirata-capitao', 'espadachim', 'cabeca-espetado.png')
