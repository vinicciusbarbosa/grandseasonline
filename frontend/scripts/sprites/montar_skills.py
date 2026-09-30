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
    linhas = M.quadros_linhas(F + 'hiken-distancia.webp', [15, 8, 6, 10, 12], {4: [159, 326, 478, 658, 819, 993, 1165, 1341, 1505, 1669, 1827]})
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


def _chao(q):
    """linha do pé do desenho (última linha com desenho de verdade)"""
    p = (q[..., 3] > 40).sum(1)
    return int(np.nonzero(p > 6)[0][-1])


def entei():
    """Entei (folhas 99–102), em três partes:
    carga    — círculos de fogo no chão, o fogo sobe, a bola cresce e gira (99, linhas 1–3);
    bola     — só a esfera (99, linha 3), girando enquanto voa;
    explosao — a esfera racha e explode (99) + explosão e fumaça (101) + brasas (100)."""
    PX = 150
    rgba = M._rgba(F + 'entei/folha99.webp')
    ys = [0, 232, 486, 754, 1024]
    cortes = [[0, 256, 512, 768, 1024, 1280, 1536]] * 2 + [[0, 274, 538, 801, 1048, 1273, 1536], [0, 294, 554, 811, 1051, 1302, 1536]]
    cel = [[(rgba[ys[r]:ys[r + 1], cortes[r][c]:cortes[r][c + 1]], 128 + 256 * c - cortes[r][c]) for c in range(6)] for r in range(4)]
    giro = cel[2][0:4]
    carga = cel[0] + cel[1] + giro * 4
    M.gravar_ponto('entei-carga', [(q, ax, _chao(q)) for q, ax in carga], 12, PX)

    # a esfera, sem a haste e os círculos do chão (máscara redonda)
    bolas = []
    for q, ax in giro:
        a = q[..., 3].astype(np.float32)
        yy, xx = np.mgrid[:q.shape[0], :q.shape[1]]
        topo = a[:190]
        cy = float((topo * yy[:190]).sum() / topo.sum())
        R = 132
        d = np.hypot(xx - ax, yy - cy)
        m = np.clip((R - d) / 10, 0, 1)
        b = q.copy()
        b[..., 3] = (b[..., 3] * m).astype(np.uint8)
        bolas.append((b, ax, _chao(q)))
    q0 = giro[0][0]
    a0 = q0[..., 3].astype(np.float32)[:190]
    cy0 = float((a0 * np.mgrid[:190, :q0.shape[1]][0]).sum() / a0.sum())
    # pivô no chão, como a carga: voando de pé a pé, a bola fica na mesma altura
    M.gravar_ponto('entei-bola', bolas * 2, 12, PX)
    H = _chao(q0) - cy0

    g101 = M.quadros_grade(F + 'entei/folha101.webp', 3, 4)
    l100 = M.quadros_linhas(F + 'entei/folha100.webp', [6, 6])
    k = 0.75
    racha, estoura = cel[2][4], cel[3 - 1][5]

    def meio(q, ax):
        a = q[..., 3].astype(np.float32)[:200]
        return float((a * np.mgrid[:200, :q.shape[1]][0]).sum() / a.sum())
    exp = [(q, ax, _chao(q)) for q, ax in (racha, estoura)]

    def centro(q):
        q = M.escalar(M.aparar(q), k)
        return (q, q.shape[1] / 2, q.shape[0] * 0.5 + H)
    exp += [centro(q) for q in [g101[0][3]] + g101[1] + g101[2]]
    exp += [centro(q) for q in l100[1][4:6]]
    return M.gravar_ponto('entei-explosao', exp, 14, PX)


if __name__ == '__main__':
    for n in sys.argv[1:] or ['hiken', 'entei']:
        globals()[n]()
