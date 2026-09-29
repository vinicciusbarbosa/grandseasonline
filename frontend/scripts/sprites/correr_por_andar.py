"""
Monta a CORRIDA a partir do ANDAR (sem IA): mesmo ciclo de pernas, mas com
fase de voo (o corpo inteiro sobe nos quadros de pés juntos — a sombra fica
no chão), contato mais baixo e achatado, e a parte de baixo do casaco
abrindo e balançando com o impulso.

    python3 frontend/scripts/sprites/correr_por_andar.py almirante S
"""
import json
import os
import sys

import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# por quadro do andar (1 juntos, 2 sobe, 3 contato, 4 apoio, 5 juntos, ...):
# (subida em px da arte, escala vertical, abertura do casaco, balanço lateral)
PERFIL = [(-14, 1.03, 0.10, 0), (-9, 1.015, 0.08, 2), (0, 0.965, 0.04, 3), (0, 0.98, 0.06, 1),
          (-14, 1.03, 0.10, 0), (-9, 1.015, 0.08, -2), (0, 0.965, 0.04, -3), (0, 0.98, 0.06, -1)]


def quadro(q, pe, sobe, esc_y, abre, balanco):
    H, W = q.shape[:2]
    al = q[..., 3] > 0
    ys = np.nonzero(al.any(axis=1))[0]
    topo, chao = ys.min(), ys.max()
    quadril = int(topo + (chao - topo) * 0.55)
    img = Image.fromarray(q)
    # casaco/pernas abaixo do quadril: abrem para os lados a partir do centro
    cima = img.crop((0, 0, W, quadril))
    baixo = img.crop((0, quadril, W, H))
    nl = int(round(W * (1 + abre)))
    baixo = baixo.resize((nl, H - quadril), Image.NEAREST)
    x0 = int(round(pe[0] * (1 + abre) - pe[0])) - balanco
    base = Image.new('RGBA', (W, H))
    base.alpha_composite(baixo.crop((x0, 0, x0 + W, H - quadril)), (0, quadril))
    base.alpha_composite(cima, (0, 0))
    # achata/estica pela base dos pés e sobe (voo)
    nh = int(round(H * esc_y))
    est = base.resize((W, nh), Image.NEAREST)
    dy = int(round(pe[1] - pe[1] * esc_y)) + sobe
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(est, (0, 0) if dy >= 0 else (0, 0), (0, max(0, -dy)))
    if dy > 0:
        out = Image.new('RGBA', (W, H)); out.alpha_composite(est.crop((0, 0, W, H - dy)), (0, dy))
    return np.asarray(out)


def gerar(personagem, direcao):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    man = json.load(open(os.path.join(pasta, 'manifesto.json')))
    Q = man['quadro'][0]
    pe = man['pe']
    a = np.asarray(Image.open(os.path.join(pasta, f'andar_{direcao}.png')).convert('RGBA'))
    n = a.shape[1] // Q
    quadros = [quadro(a[:, i * Q:(i + 1) * Q].copy(), pe, *PERFIL[i % 8]) for i in range(n)]
    nome = f'correr_{direcao}.png'
    Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
    man['anims'].setdefault('correr', {})[direcao] = {'arquivo': nome, 'quadros': n}
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} correr {direcao}: {n} quadros (a partir do andar)')


if __name__ == '__main__':
    gerar(sys.argv[1], sys.argv[2])
