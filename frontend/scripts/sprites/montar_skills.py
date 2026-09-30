"""
Monta as animações das skills a partir das folhas em fonte/efeitos/
(usa montar.py). Rodar: python3 montar_skills.py [hiken|entei]
"""
import sys

import numpy as np

import montar as M

F = 'fonte/efeitos/'


def hiken():
    """Punho de fogo (folha 98): 5 linhas, 51 quadros — nasce como uma bola,
    vira o punho com a cauda de fogo e some. Desenhado apontando para →;
    o pivô é o punho (gira e voa em torno dele)."""
    linhas = M.quadros_linhas(F + 'hiken-distancia.webp', [15, 8, 6, 10, 12])
    quadros = []
    for q in (q for l in linhas for q in l):
        q = M.aparar(q)
        a = q[..., 3].astype(np.float32)
        w = q.shape[1]
        faixa = a[:, max(0, w - 30):]
        ys = np.arange(q.shape[0])[:, None]
        ay = float((faixa * ys).sum() / max(1, faixa.sum()))
        quadros.append((q, w - 22 if w > 60 else w / 2, ay))
    return M.gravar_ponto('hiken-distancia', quadros, 24, 170, {'modo': 'girar', 'voo': [6, 30]})


def entei():
    """Entei (folhas 99–102), em três partes:
    carga   — círculos de fogo no chão, o fogo sobe, a bola cresce e gira (99);
    bola    — só a esfera (99, linha 3), girando enquanto voa;
    explosao — a esfera racha e explode (99) + explosão e fumaça (101) + brasas (100)."""
    PX = 150
    g99 = M.quadros_grade(F + 'entei/folha99.webp', 4, 6)
    CH = 256
    CHAO = 240  # pé dos círculos de fogo dentro da célula
    giro = g99[2][0:4]
    carga = g99[0] + g99[1] + giro * 4
    M.gravar_ponto('entei-carga', [(q, 128, CHAO) for q in carga], 12, PX)

    # a esfera sem a haste e os círculos do chão
    bolas = []
    for q in giro:
        b = q[:188].copy()
        bolas.append((b, 128, 88))
    M.gravar_ponto('entei-bola', bolas, 12, PX, {'bola_altura': round((CHAO - 88) / PX, 3)})

    g101 = M.quadros_grade(F + 'entei/folha101.webp', 3, 4)
    l100 = M.quadros_linhas(F + 'entei/folha100.webp', [6, 6])
    k = 0.75
    exp = [(g99[2][4][:230], 128, 88), (g99[2][5][:236], 128, 88)]

    def centro(q):
        q = M.escalar(M.aparar(q), k)
        return (q, q.shape[1] / 2, q.shape[0] * 0.55)
    exp += [centro(q) for q in [g101[0][3]] + g101[1] + g101[2]]
    exp += [centro(q) for q in l100[1][4:6]]
    return M.gravar_ponto('entei-explosao', exp, 14, PX)


if __name__ == '__main__':
    for n in sys.argv[1:] or ['hiken', 'entei']:
        globals()[n]()
