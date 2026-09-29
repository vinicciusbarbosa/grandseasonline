"""
Monta uma animação escolhendo quadros de uma tira já importada (sem IA):
reordena, espelha SÓ as pernas (sabre e casaco ficam no lugar), iguala o
tamanho de cada quadro pelo quepe do parado e aplica sobe-e-desce (voo).

    python3 frontend/scripts/sprites/montar_corrida.py almirante S <tira.png> \
        "3,9,12^12,6^5,7,9m,12m^12,6m^5"

Cada item: número do quadro na tira (1..N), `m` = pernas espelhadas,
`^k` = sobe k px da arte (voo), `vk` = desce k px.
"""
import json
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def cores(q):
    al = q[..., 3] > 0
    r, g, b = (q[..., i].astype(int) for i in range(3))
    return al, r, g, b


def largura_quepe(q):
    al = q[..., 3] > 0
    ys = np.nonzero(al.any(axis=1))[0]
    xs = np.nonzero(al[ys.min() + 30])[0]
    return float(xs.max() - xs.min())


def reescalar(q, fator, pe):
    """Escala a figura em torno do ponto dos pés."""
    if abs(fator - 1) < 0.01:
        return q
    H, W = q.shape[:2]
    M = np.array([[fator, 0, pe[0] * (1 - fator)], [0, fator, pe[1] * (1 - fator)]], np.float32)
    return cv2.warpAffine(q, M, (W, H), flags=cv2.INTER_NEAREST, borderValue=(0, 0, 0, 0))


def mascara_sabre(q):
    """Bainha do sabre: reta pelos dourados (argolas/ponteira) abaixo da mão."""
    al, r, g, b = cores(q)
    H, W = al.shape
    dour = al & (r > 170) & (g > 120) & (b < 110)
    ys, xs = np.nonzero(dour[H // 2:, :W // 2])
    m = np.zeros_like(al)
    if len(ys) < 20:
        return m
    ys = ys + H // 2
    a, c = np.polyfit(ys, xs, 1)
    yy, xx = np.mgrid[0:H, 0:W]
    linha = np.abs(xx - (a * yy + c)) <= 9
    return linha & al & (yy >= ys.min() - 60) & (yy <= ys.max() + 4)


def pernas(q, cx, y0=284, esq=44, dir_=56):
    """Calça e sapatos abaixo da cintura. Do lado do sabre (esquerda da
    imagem) a faixa é mais estreita: a bainha tem a cor da calça."""
    al, r, g, b = cores(q)
    calca = al & (b > r + 25) & (b > g + 10)
    escuro = al & (np.maximum(np.maximum(r, g), b) < 70)
    faixa = np.zeros_like(al)
    faixa[y0:, cx - esq:cx + dir_] = True
    # perto do chão o sabre já acabou: a faixa alarga para pegar o sapato inteiro
    faixa[y0 + 70:, cx - 72:cx + dir_] = True
    # reflexo claro do sapato (cinza, sem cor) perto do chão
    cinza = al & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 40) & (r < 235)
    chao = np.zeros_like(al)
    chao[y0 + 70:] = True
    m = faixa & (calca | escuro | (cinza & chao))
    k = np.ones((3, 3), np.uint8)
    for _ in range(2):
        m |= (cv2.dilate(m.astype(np.uint8), k) > 0) & escuro & faixa
    return m & ~mascara_sabre(q)


def espelhar_pernas(q, cx):
    al, r, g, b = cores(q)
    mp = pernas(q, cx)
    sabre = mascara_sabre(q)
    casaco = al & (((r > 170) & (g > 170) & (b > 170)) | ((r > 150) & (g > 110) & (b < 110)))
    frente = (sabre | casaco) & ~mp
    base = q.copy()
    base[mp] = 0
    so = np.zeros_like(q)
    so[mp] = q[mp]
    W = q.shape[1]
    esp = np.roll(so[:, ::-1], 2 * cx - W + 1, axis=1)  # espelha em torno de cx
    m = esp[..., 3] > 0
    base[m] = esp[m]
    base[frente] = q[frente]  # sabre e casaco na frente das pernas
    return base


def limpar(q, minimo=90):
    al = (q[..., 3] > 0).astype(np.uint8)
    n, rot, st, _ = cv2.connectedComponentsWithStats(al, connectivity=8)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] < minimo:
            q[rot == k] = 0
    return q


def gerar(personagem, direcao, tira, receita, anim='correr'):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    man = json.load(open(os.path.join(pasta, 'manifesto.json')))
    Q = man['quadro'][0]
    pe = man['pe']
    parado = np.asarray(Image.open(os.path.join(pasta, f'parado_{direcao}.png')).convert('RGBA'))[:, :Q]
    alvo = largura_quepe(parado)
    T = np.asarray(Image.open(tira).convert('RGBA'))
    quadros = []
    for item in receita.split(','):
        mt = re.fullmatch(r'(\d+)(m?)(?:([\^v])(\d+))?', item.strip())
        i, esp, sinal, k = int(mt[1]) - 1, mt[2], mt[3], int(mt[4] or 0)
        q = T[:, i * Q:(i + 1) * Q].copy()
        q = reescalar(q, alvo / largura_quepe(q), pe)
        if esp:
            q = espelhar_pernas(q, pe[0])
        q = limpar(q)
        dy = -k if sinal == '^' else k
        quadros.append(np.roll(q, dy, axis=0))
    nome = f'{anim}_{direcao}.png'
    Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
    man['anims'].setdefault(anim, {})[direcao] = {'arquivo': nome, 'quadros': len(quadros)}
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} {anim} {direcao}: {len(quadros)} quadros montados ({receita})')


if __name__ == '__main__':
    gerar(*sys.argv[1:])
