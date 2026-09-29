"""
Monta a CORRIDA juntando duas animações (sem IA): tronco, braços e casaco
esvoaçando vêm da corrida desenhada pela IA; as pernas vêm do ANDAR (que
alterna as pernas direito). Por cima, sobe-e-desce de corrida: o corpo
"voa" nos quadros de pés juntos (a sombra fica no chão).

    python3 frontend/scripts/sprites/correr_por_montagem.py almirante S

Usa public/sprites/<p>/andar_<D>.png e fonte/<p>/correr_<D>_ia_tira.png (a
tira da corrida da IA já importada).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# subida (px da arte) por quadro do andar: 1 juntos, 2 sobe, 3 contato, 4 apoio, ...
SUBIDA = [-12, -7, 0, 1, -12, -7, 0, 1]


def pernas(q, centro, y0=268, meia=58):
    """Calça e sapatos na faixa central abaixo da cintura (sem casaco/sabre)."""
    al = q[..., 3] > 0
    r, g, b = (q[..., i].astype(int) for i in range(3))
    calca = al & (b > r + 25) & (b > g + 10)
    escuro = al & (np.maximum(np.maximum(r, g), b) < 70)
    faixa = np.zeros_like(al)
    faixa[y0:, centro - meia:centro + meia] = True
    m = faixa & (calca | escuro)
    k = np.ones((3, 3), np.uint8)
    for _ in range(2):  # contorno escuro colado
        m |= (cv2.dilate(m.astype(np.uint8), k) > 0) & escuro & faixa
    return m


def limpar(q, minimo=40):
    al = (q[..., 3] > 0).astype(np.uint8)
    n, rot, st, _ = cv2.connectedComponentsWithStats(al, connectivity=8)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] < minimo:
            q[rot == k] = 0
    return q


def gerar(personagem, direcao):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    fonte = os.path.join(RAIZ, 'scripts', 'sprites', 'fonte', personagem)
    man = json.load(open(os.path.join(pasta, 'manifesto.json')))
    Q = man['quadro'][0]
    cx = man['pe'][0]
    W = np.asarray(Image.open(os.path.join(pasta, f'andar_{direcao}.png')).convert('RGBA'))
    R = np.asarray(Image.open(os.path.join(fonte, f'correr_{direcao}_ia_tira.png')).convert('RGBA'))
    nw, nr = W.shape[1] // Q, R.shape[1] // Q
    quadros = []
    for i in range(nw):
        w = W[:, i * Q:(i + 1) * Q]
        j = i * nr // nw
        q = R[:, j * Q:(j + 1) * Q].copy()
        q[pernas(q, cx)] = 0
        mw = pernas(w, cx)
        q[mw] = w[mw]
        q = limpar(q)
        quadros.append(np.roll(q, SUBIDA[i % 8], axis=0))
    nome = f'correr_{direcao}.png'
    Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
    man['anims'].setdefault('correr', {})[direcao] = {'arquivo': nome, 'quadros': len(quadros)}
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} correr {direcao}: {len(quadros)} quadros (tronco da corrida + pernas do andar)')


if __name__ == '__main__':
    gerar(sys.argv[1], sys.argv[2])
