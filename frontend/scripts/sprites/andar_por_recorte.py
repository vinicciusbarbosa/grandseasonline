"""
Monta o ANDAR a partir do quadro parado, por recorte (sem IA): separa as
duas pernas (abaixo da barra do casaco) do resto do corpo e anima as partes —
passo alternado de verdade, sobe-e-desce do corpo e barra do casaco
balançando. Serve bem às direções de costas, onde o casaco cobre quase tudo
e só aparecem canelas e sapatos.

    python3 frontend/scripts/sprites/andar_por_recorte.py almirante NE
"""
import json
import os
import sys

import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
QUADROS = 8
# direção na tela para onde o pé avança (x, y; y para baixo)
FRENTE = {'NE': (1, -0.8), 'NW': (-1, -0.8), 'N': (0.25, -1), 'E': (1, 0), 'W': (-1, 0),
          'S': (0, 1), 'SE': (1, 0.8), 'SW': (-1, 0.8)}


def camadas(q):
    """(corpo, perna_longe, perna_perto) em RGBA do tamanho do quadro."""
    al = q[..., 3] > 0
    r, g, b = (q[..., i].astype(int) for i in range(3))
    # casaco: branco ou dourado/laranja (inclui o dourado mais escuro da barra)
    casaco = al & (((r > 170) & (g > 170) & (b > 170)) | ((r > 110) & (r > b + 40)))
    # calça (azul) ou sapato (preto)
    calca = al & (b > r + 25)
    escuro = al & (np.maximum(np.maximum(r, g), b) < 70)
    ys = np.nonzero(al.any(axis=1))[0]
    chao = ys.max()
    altura = chao - ys.min()
    faixa = int(chao - altura * 0.2)  # procura a barra só perto dos pés
    H, W = al.shape
    perna = np.zeros_like(al)
    for x in range(W):
        # (o brilho branco dos sapatos não é casaco: para antes deles)
        col = np.nonzero(casaco[faixa:chao - 22, x])[0]
        topo = faixa + col.max() + 1 if len(col) else faixa + 6
        # a perna começa no primeiro azul/preto (o contorno da barra fica no corpo)
        # (preto só vale na altura dos sapatos: o contorno da barra também é escuro)
        cp = np.nonzero(calca[topo:chao + 1, x])[0]
        sp = np.nonzero(escuro[max(topo, chao - 22):chao + 1, x])[0]
        if len(cp):
            y0 = max(topo, topo + cp.min() - 1)
        elif len(sp):
            y0 = max(topo, chao - 22) + sp.min()
        else:
            continue
        perna[y0:, x] = al[y0:, x]
    # o sabre (dourado/azul) pendurado abaixo da barra é do corpo
    dourado = al & (r > 170) & (g > 120) & (b < 110)
    xs_s = np.nonzero(dourado[faixa + 4:chao - 18].any(axis=0))[0]
    if len(xs_s):
        # colunas do sabre = grupo de dourado mais estreito à direita/esquerda
        grupos = np.split(xs_s, np.nonzero(np.diff(xs_s) > 3)[0] + 1)
        for gr in grupos:
            if gr.max() - gr.min() < 30:
                x0, x1 = gr.min() - 3, gr.max() + 4
                lim = faixa + 4 + np.nonzero(dourado[faixa + 4:chao - 18, gr.min():gr.max() + 1].any(axis=1))[0].max() + 2
                # não pega o sapato que fica logo abaixo da ponta do sabre
                preto = al[:, x0:x1] & (np.maximum(np.maximum(r, g), b)[:, x0:x1] < 70)
                ys_p = np.nonzero(preto[chao - 22:chao + 1].any(axis=1))[0]
                if len(ys_p):
                    lim = min(lim, chao - 22 + ys_p.min())
                perna[:lim, x0:x1] = False
    import cv2
    # contorno escuro colado na perna (lados da calça) vai junto com ela
    kern = np.ones((3, 3), np.uint8)
    for _ in range(2):
        perna |= (cv2.dilate(perna.astype(np.uint8), kern) > 0) & escuro & ~casaco
    # pedaços soltos (contorno do sabre etc.) voltam para o corpo
    n, rot, st, _ = cv2.connectedComponentsWithStats(perna.astype(np.uint8), connectivity=8)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] < 60:
            perna[rot == k] = False
    # separa as duas pernas na coluna mais vazia entre elas
    ocup = perna.sum(axis=0)
    xs = np.nonzero(ocup)[0]
    meio = xs.min() + (xs.max() - xs.min()) // 4
    fim = xs.max() - (xs.max() - xs.min()) // 4
    corte = meio + int(np.argmin(ocup[meio:fim]))
    esq = perna.copy(); esq[:, corte:] = False
    dir_ = perna.copy(); dir_[:, :corte] = False
    fundo_esq = np.nonzero(esq.any(axis=1))[0].max()
    fundo_dir = np.nonzero(dir_.any(axis=1))[0].max()
    perto, longe = (dir_, esq) if fundo_dir >= fundo_esq else (esq, dir_)
    corpo = q.copy(); corpo[perna] = 0
    def so(m):
        c = np.zeros_like(q); c[m] = q[m]; return c
    return corpo, so(longe), so(perto)


def estender(c, n=10):
    """Repete a linha de cima de cada coluna da perna para cima (sem buraco
    entre a barra do casaco e a perna quando ela desce)."""
    c = c.copy()
    al = c[..., 3] > 0
    topo = np.nonzero(al.any(axis=1))[0].min()
    for x in np.nonzero(al.any(axis=0))[0]:
        col = np.nonzero(al[:, x])[0]
        y = col.min()
        if y > topo + 4:  # coluna que começa no sapato: não estica
            continue
        # cor de dentro da calça (a linha de cima é contorno)
        fonte = c[min(col.max(), y + 4), x]
        c[max(0, y - n):y + 2, x] = fonte
    return c


def mover(c, dx, dy):
    return np.roll(np.roll(c, int(round(dy)), axis=0), int(round(dx)), axis=1)


def sobre(base, c):
    m = c[..., 3] > 0
    base[m] = c[m]
    return base


def balancar(corpo, s, y0):
    """Barra do casaco: linhas abaixo de y0 deslocam proporcional à distância."""
    out = np.zeros_like(corpo)
    H = corpo.shape[0]
    for y in range(H):
        d = int(round(s * max(0, y - y0) / 50))
        out[y] = np.roll(corpo[y], d, axis=0)
    return out


def pe(fi, fx, fy, passo, erguer):
    """Posição do pé na fase fi (0 = apoia à frente)."""
    F, T = np.array([fx, fy]) * passo, -np.array([fx, fy]) * passo * 0.8
    if fi < 0.5:  # apoio: da frente para trás, no chão
        p = F + (T - F) * (fi / 0.5)
        return p[0], p[1]
    u = (fi - 0.5) / 0.5  # balanço: de trás para a frente, erguido
    p = T + (F - T) * (0.5 - 0.5 * np.cos(np.pi * u))
    return p[0], p[1] - erguer * np.sin(np.pi * u)


def gerar(personagem, direcao):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    man = json.load(open(os.path.join(pasta, 'manifesto.json')))
    Q = man['quadro'][0]
    q = np.asarray(Image.open(os.path.join(pasta, f'parado_{direcao}.png')).convert('RGBA'))[:, :Q].copy()
    corpo, longe, perto = camadas(q)
    longe, perto = estender(longe), estender(perto)
    al = q[..., 3] > 0
    ys = np.nonzero(al.any(axis=1))[0]
    y_barra = int(ys.max() - (ys.max() - ys.min()) * 0.35)
    fx, fy = FRENTE[direcao]
    n = np.hypot(fx, fy); fx, fy = fx / n, fy / n
    quadros = []
    for k in range(QUADROS):
        t = k / QUADROS
        # t=0: perna de perto passando por baixo do corpo (pés juntos)
        fp = (t + 0.75) % 1
        fl = (t + 0.25) % 1
        pdx, pdy = pe(fp, fx, fy, 9, 5)
        ldx, ldy = pe(fl, fx, fy, 9, 5)
        # corpo mais baixo quando os dois pés estão no chão (contato)
        bob = 1.5 * np.cos(4 * np.pi * (t + 0.25)) + 0.5
        s = -2.5 * np.sin(2 * np.pi * t) * (1 if fx >= 0 else -1)
        img = np.zeros_like(q)
        sobre(img, mover(longe, ldx, ldy))
        sobre(img, mover(perto, pdx, pdy))
        sobre(img, mover(balancar(corpo, s, y_barra), 0, bob))
        quadros.append(img)
    nome = f'andar_{direcao}.png'
    Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
    man['anims'].setdefault('andar', {})[direcao] = {'arquivo': nome, 'quadros': QUADROS}
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} andar {direcao}: {QUADROS} quadros (recorte do parado)')
    return quadros


if __name__ == '__main__':
    gerar(sys.argv[1], sys.argv[2])
