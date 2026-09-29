"""
Ajusta uma tira já importada: quadros mais altos que o parado da direção
são reduzidos (pelos pés) até a altura dele — a IA às vezes desenha alguns
quadros maiores — e, opcionalmente, reordena/repete quadros.

    python3 frontend/scripts/sprites/limitar_altura.py almirante parar S \
        <tira_fonte.png> "1,2,3,4,5,6,7,8,8,10,11,12"
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def altura(q):
    ys = np.nonzero((q[..., 3] > 0).any(axis=1))[0]
    return ys.max() - ys.min() + 1


def gerar(personagem, anim, direcao, tira, ordem=None):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    man = json.load(open(os.path.join(pasta, 'manifesto.json')))
    Q = man['quadro'][0]
    pe = man['pe']
    parado = np.asarray(Image.open(os.path.join(pasta, f'parado_{direcao}.png')).convert('RGBA'))[:, :Q]
    alvo = altura(parado)
    T = np.asarray(Image.open(tira).convert('RGBA'))
    n = T.shape[1] // Q
    idx = [int(i) - 1 for i in ordem.split(',')] if ordem else list(range(n))
    quadros = []
    for i in idx:
        q = T[:, i * Q:(i + 1) * Q].copy()
        h = altura(q)
        if h > alvo:
            f = alvo / h
            M = np.array([[f, 0, pe[0] * (1 - f)], [0, f, pe[1] * (1 - f)]], np.float32)
            q = cv2.warpAffine(q, M, (Q, Q), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0))
            q[..., 3] = np.where(q[..., 3] > 127, 255, 0)
        quadros.append(q)
    nome = f'{anim}_{direcao}.png'
    Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
    man['anims'].setdefault(anim, {})[direcao] = {'arquivo': nome, 'quadros': len(quadros)}
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} {anim} {direcao}: {len(quadros)} quadros, altura máx. {alvo}px')


if __name__ == '__main__':
    gerar(*sys.argv[1:])
