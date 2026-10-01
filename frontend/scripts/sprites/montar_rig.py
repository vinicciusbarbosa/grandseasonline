"""
Monta o boneco recortado (estilo Wakfu) a partir de UMA pose desenhada da
folha (fundo magenta) e grava o projeto do editor de animação:

    python3 montar_rig.py base

1. corta a pose em peças pelo osso mais perto (cápsulas entre as juntas
   marcadas em RIGS) e, no braço/arma, pela cor (pele = braço, o resto =
   machado);
2. nas juntas, um disco em volta da junta entra nas duas peças (não abre
   buraco ao dobrar);
3. guarda as peças num atlas (folhas/rig-<vista>.webp, fundo magenta) e o
   projeto em public/sprites/<id>/animacao.json, com as animações de
   ANIMACOES (ângulos por quadro-chave, em cima da pose desenhada).

Depois tudo pode ser ajustado à mão no /editor-animacao.
"""
import json, os, sys
import cv2, numpy as np
from scipy import ndimage

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
nome = sys.argv[1] if len(sys.argv) > 1 else 'base'
PASTA = os.path.join(RAIZ, 'public', 'sprites', nome)

# Juntas em px dentro da `caixa` da folha. "longe"/"perto": lado da imagem
# (longe = esquerda da imagem na frente; o que fica atrás na ordem de desenho).
RIGS = {
    'frente': {
        'folha': 'machados.webp', 'caixa': (1100, 555, 1440, 825), 'olha': -1,
        'chao': (155, 255), 'queixo': 82, 'cabeca_x': (92, 215),
        'juntas': {
            'pescoco': (150, 80), 'cintura': (150, 146), 'quadril': (150, 166),
            'ombro_longe': (112, 89), 'cotovelo_longe': (82, 113), 'mao_longe': (62, 130),
            'ombro_perto': (187, 88), 'cotovelo_perto': (217, 115), 'mao_perto': (247, 133),
            'anca_longe': (104, 168), 'joelho_longe': (62, 200), 'pe_longe': (30, 243),
            'anca_perto': (184, 172), 'joelho_perto': (226, 206), 'pe_perto': (282, 252),
        },
    },
    'costas': {
        'folha': 'machados.webp', 'caixa': (795, 540, 1105, 825), 'olha': 1,
        'chao': (135, 272), 'queixo': 86, 'cabeca_x': (110, 205),
        'juntas': {
            'pescoco': (148, 84), 'cintura': (126, 150), 'quadril': (126, 168),
            'ombro_longe': (102, 98), 'cotovelo_longe': (64, 118), 'mao_longe': (58, 147),
            'ombro_perto': (158, 100), 'cotovelo_perto': (184, 122), 'mao_perto': (218, 148),
            'anca_longe': (106, 176), 'joelho_longe': (76, 218), 'pe_longe': (45, 262),
            'anca_perto': (146, 182), 'joelho_perto': (180, 212), 'pe_perto': (215, 266),
        },
    },
}

# peça: (de, até, espessura, encaixe pai, junta do pivô)
OSSOS = {
    'tronco': ('pescoco', 'cintura', 27, 'quadril', 'cintura'),
    'quadril': ('anca_longe', 'anca_perto', 22, None, 'quadril'),
    'braco_longe': ('ombro_longe', 'cotovelo_longe', 15, 'tronco', 'ombro_longe'),
    'antebraco_longe': ('cotovelo_longe', 'mao_longe', 14, 'braco_longe', 'cotovelo_longe'),
    'braco_perto': ('ombro_perto', 'cotovelo_perto', 15, 'tronco', 'ombro_perto'),
    'antebraco_perto': ('cotovelo_perto', 'mao_perto', 14, 'braco_perto', 'cotovelo_perto'),
    'coxa_longe': ('anca_longe', 'joelho_longe', 20, 'quadril', 'anca_longe'),
    'canela_longe': ('joelho_longe', 'pe_longe', 15, 'coxa_longe', 'joelho_longe'),
    'coxa_perto': ('anca_perto', 'joelho_perto', 20, 'quadril', 'anca_perto'),
    'canela_perto': ('joelho_perto', 'pe_perto', 15, 'coxa_perto', 'joelho_perto'),
}
JUNTAS = [('braco_longe', 'antebraco_longe', 'cotovelo_longe', 9), ('braco_perto', 'antebraco_perto', 'cotovelo_perto', 9),
          ('coxa_longe', 'canela_longe', 'joelho_longe', 11), ('coxa_perto', 'canela_perto', 'joelho_perto', 11),
          ('quadril', 'coxa_longe', 'anca_longe', 13), ('quadril', 'coxa_perto', 'anca_perto', 13),
          ('tronco', 'quadril', 'cintura', 12), ('tronco', 'cabeca', 'pescoco', 10)]
ORDEM = ['arma_longe', 'braco_longe', 'antebraco_longe', 'mao_longe', 'coxa_longe', 'canela_longe', 'pe_longe',
         'quadril', 'coxa_perto', 'canela_perto', 'pe_perto', 'tronco', 'braco_perto', 'antebraco_perto', 'mao_perto',
         'arma_perto', 'cabeca']
PAIS = {'tronco': 'quadril', 'cabeca': 'tronco', 'braco_longe': 'tronco', 'antebraco_longe': 'braco_longe', 'mao_longe': 'antebraco_longe',
        'arma_longe': 'mao_longe', 'braco_perto': 'tronco', 'antebraco_perto': 'braco_perto', 'mao_perto': 'antebraco_perto',
        'arma_perto': 'mao_perto', 'coxa_longe': 'quadril', 'canela_longe': 'coxa_longe', 'pe_longe': 'canela_longe',
        'coxa_perto': 'quadril', 'canela_perto': 'coxa_perto', 'pe_perto': 'canela_perto', 'quadril': None}
# junta onde cada encaixe fica (sem peça própria: mão e pé)
PIVO = {'tronco': 'cintura', 'cabeca': 'pescoco', 'quadril': 'quadril', 'mao_longe': 'mao_longe', 'mao_perto': 'mao_perto',
        'arma_longe': 'mao_longe', 'arma_perto': 'mao_perto', 'pe_longe': 'pe_longe', 'pe_perto': 'pe_perto'}
for n, o in OSSOS.items():
    PIVO[n] = o[4]


def dist_seg(X, Y, a, b):
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    t = np.clip(((X - a[0]) * d[0] + (Y - a[1]) * d[1]) / max(1e-6, d @ d), 0, 1)
    return np.hypot(X - (a[0] + t * d[0]), Y - (a[1] + t * d[1]))


def cortar(cfg):
    x0, y0, x1, y1 = cfg['caixa']
    folha = cv2.imread(os.path.join(PASTA, 'folhas', cfg['folha']))
    img = folha[y0:y1, x0:x1].copy()
    b, g, r = (img[..., k].astype(int) for k in range(3))
    s = ~((r - g > 90) & (b - g > 90))
    lab, n = ndimage.label(s)
    tam = ndimage.sum(s, lab, range(1, n + 1))
    s = lab == (np.argmax(tam) + 1)
    A, L = s.shape
    Y, X = np.mgrid[0:A, 0:L].astype(float)
    J = cfg['juntas']
    nomes = list(OSSOS)
    custo = np.stack([dist_seg(X, Y, J[a], J[b_]) - e for a, b_, e, _, _ in OSSOS.values()])
    dono = np.argmin(custo, 0)
    cab = s & (Y < cfg['queixo']) & (X > cfg['cabeca_x'][0]) & (X < cfg['cabeca_x'][1])
    rot = {n_: s & (dono == i) & ~cab for i, n_ in enumerate(nomes)}
    rot['cabeca'] = cab
    # arma: no lado de cada braço, o que não é pele (machado: cinza/marrom)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(int)
    pele = (hsv[..., 0] >= 5) & (hsv[..., 0] <= 25) & (hsv[..., 1] > 50) & (hsv[..., 2] > 150)
    escuro = hsv[..., 2] < 55
    for lado in ('longe', 'perto'):
        braco = rot[f'antebraco_{lado}'] | rot[f'braco_{lado}']
        # tudo que não é pele e está longe do tronco, perto da mão
        mao = J[f'mao_{lado}']
        perto_mao = np.hypot(X - mao[0], Y - mao[1]) < 120
        cand = s & ~pele & ~cab & perto_mao & (dist_seg(X, Y, J['pescoco'], J['cintura']) > 42)
        cand &= ~(dist_seg(X, Y, J[f'anca_{lado}'], J[f'joelho_{lado}']) < 22) & ~(dist_seg(X, Y, J[f'joelho_{lado}'], J[f'pe_{lado}']) < 17)
        # contorno preto do braço fica no braço
        cand &= ~(escuro & (dist_seg(X, Y, J[f'cotovelo_{lado}'], mao) < 16) & ~(np.hypot(X - mao[0], Y - mao[1]) < 9))
        cand &= ~(escuro & (dist_seg(X, Y, J[f'ombro_{lado}'], J[f'cotovelo_{lado}']) < 17))
        # maior pedaço ligado = o machado (com o cabo que passa pela mão)
        # abre: as linhas finas de contorno (do braço, da perna) se soltam do machado
        aberto = ndimage.binary_opening(cand, iterations=2)
        l2, k2 = ndimage.label(aberto)
        if k2:
            t2 = ndimage.sum(aberto, l2, range(1, k2 + 1))
            arma = ndimage.binary_dilation(l2 == (np.argmax(t2) + 1), iterations=3) & cand
        else:
            arma = np.zeros_like(s)
        for n_ in rot:
            rot[n_] &= ~arma
        rot[f'arma_{lado}'] = arma
        _ = braco
    # regata (branco) que caiu no braço volta para o tronco
    branco = (hsv[..., 1] < 40) & (hsv[..., 2] > 170)
    for n_ in ('braco_longe', 'braco_perto'):
        volta = rot[n_] & branco
        rot[n_] &= ~volta
        rot['tronco'] |= volta
    # pedaços soltos vão para a peça vizinha que mais encosta
    for n_ in list(rot):
        l3, k3 = ndimage.label(rot[n_])
        if k3 <= 1:
            continue
        t3 = ndimage.sum(rot[n_], l3, range(1, k3 + 1))
        fica = l3 == (np.argmax(t3) + 1)
        for comp in range(1, k3 + 1):
            m = (l3 == comp) & ~fica
            if not m.any():
                continue
            anel = ndimage.binary_dilation(m, iterations=2) & ~m
            melhor = max((o for o in rot if o != n_), key=lambda o: (rot[o] & anel).sum())
            rot[melhor] |= m
            rot[n_] &= ~m
    pecas = {n_: m.copy() for n_, m in rot.items()}
    for p, f, j, r_ in JUNTAS:
        disco = np.hypot(X - J[j][0], Y - J[j][1]) < r_
        ambos = disco & (rot[p] | rot[f])
        pecas[p] |= ambos
        pecas[f] |= ambos
    return img, pecas


def atlas(vistas):
    """Empilha as peças num atlas de fundo magenta; devolve retângulos."""
    itens = []
    for v, (img, pecas) in vistas.items():
        for n_, m in pecas.items():
            ys, xs = np.nonzero(m)
            if not len(xs):
                continue
            bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            rgba = img[by0:by1, bx0:bx1].copy()
            rgba[~m[by0:by1, bx0:bx1]] = (255, 0, 255)
            itens.append((v, n_, int(bx0), int(by0), rgba))
    LARG = 1024
    x = y = alt = 0
    pos = {}
    for v, n_, bx0, by0, im in sorted(itens, key=lambda t: -t[4].shape[0]):
        h, w = im.shape[:2]
        if x + w + 4 > LARG:
            x, y, alt = 0, y + alt + 6, 0
        pos[(v, n_)] = (x + 2, y + 2, w, h, bx0, by0)
        x += w + 6
        alt = max(alt, h)
    folha = np.zeros((y + alt + 8, LARG, 3), np.uint8)
    folha[:] = (255, 0, 255)
    for v, n_, bx0, by0, im in itens:
        px, py, w, h, _, _ = pos[(v, n_)]
        folha[py:py + h, px:px + w] = im
    return folha, pos


# ------------------------------------------------------------------ animações
# Ângulos em graus por encaixe, positivo = para a frente (o lado para onde a
# vista olha), somados à pose desenhada. 'dx'/'dy' movem o corpo todo (px da
# folha; dy positivo = para baixo). Cada chave: (t, {encaixe: ângulo, ...}).
NEUTRO = {}
ANIMACOES = {
    # guarda: respira, machados balançam de leve
    'parado': (1.4, True, None, [
        (0, {}),
        (0.5, {'tronco': 2, 'cabeca': -2, 'braco_longe': -4, 'antebraco_longe': 5, 'mao_longe': -6,
               'braco_perto': 4, 'antebraco_perto': -5, 'mao_perto': 6, 'dy': 2.5}),
    ]),
    # passo em guarda (avança agachado): pernas alternam, corpo sobe e desce
    'andar': (0.8, True, None, [
        (0, {'coxa_perto': 14, 'canela_perto': -6, 'coxa_longe': -10, 'canela_longe': -18, 'tronco': 4, 'dy': 3,
             'braco_perto': 6, 'braco_longe': -6}),
        (0.25, {'coxa_perto': 2, 'canela_perto': -22, 'coxa_longe': 4, 'canela_longe': -4, 'tronco': 5, 'dy': -4,
                'braco_perto': 0, 'braco_longe': 0}),
        (0.5, {'coxa_perto': -10, 'canela_perto': -18, 'coxa_longe': 14, 'canela_longe': -6, 'tronco': 4, 'dy': 3,
               'braco_perto': -6, 'braco_longe': 6}),
        (0.75, {'coxa_perto': 4, 'canela_perto': -4, 'coxa_longe': 2, 'canela_longe': -22, 'tronco': 5, 'dy': -4,
                'braco_perto': 0, 'braco_longe': 0}),
    ]),
    # corrida: inclinado, machados para trás
    'correr': (0.56, True, None, [
        (0, {'coxa_perto': 26, 'canela_perto': -10, 'coxa_longe': -22, 'canela_longe': -40, 'tronco': 12, 'cabeca': -8,
             'braco_perto': -30, 'antebraco_perto': 20, 'braco_longe': -35, 'antebraco_longe': 15, 'dy': 2}),
        (0.25, {'coxa_perto': 4, 'canela_perto': -45, 'coxa_longe': 10, 'canela_longe': -8, 'tronco': 12, 'cabeca': -8,
                'braco_perto': -38, 'antebraco_perto': 25, 'braco_longe': -28, 'antebraco_longe': 18, 'dy': -8}),
        (0.5, {'coxa_perto': -22, 'canela_perto': -40, 'coxa_longe': 26, 'canela_longe': -10, 'tronco': 12, 'cabeca': -8,
               'braco_perto': -30, 'antebraco_perto': 20, 'braco_longe': -35, 'antebraco_longe': 15, 'dy': 2}),
        (0.75, {'coxa_perto': 10, 'canela_perto': -8, 'coxa_longe': 4, 'canela_longe': -45, 'tronco': 12, 'cabeca': -8,
                'braco_perto': -28, 'antebraco_perto': 18, 'braco_longe': -38, 'antebraco_longe': 25, 'dy': -8}),
    ]),
    'frear': (0.7, False, None, [
        (0, {'tronco': 12, 'coxa_perto': 26, 'coxa_longe': -22, 'canela_longe': -40, 'braco_perto': -30, 'braco_longe': -35}),
        (0.25, {'tronco': -8, 'cabeca': 4, 'coxa_perto': 18, 'canela_perto': 4, 'coxa_longe': -14, 'canela_longe': -14,
                'braco_perto': 20, 'braco_longe': 15, 'dy': 4}),
        (1, {}),
    ]),
    'parar': (0.45, False, None, [
        (0, {'tronco': 5, 'dy': -2}),
        (0.4, {'tronco': 8, 'cabeca': 3, 'braco_perto': 12, 'braco_longe': 10, 'dy': 3}),
        (1, {}),
    ]),
    # golpe duplo de cima para baixo: ergue os dois machados por trás da cabeça
    # (antecipação), desce com o corpo todo (impacto em 0,5) e segura
    'atacar': (0.85, False, 0.5, [
        (0, {}),
        (0.14, {'tronco': -4, 'braco_longe': 40, 'antebraco_longe': 20, 'braco_perto': -40, 'antebraco_perto': -20, 'dy': 2}),
        (0.36, {'tronco': -14, 'cabeca': 8, 'braco_longe': 115, 'antebraco_longe': 40, 'mao_longe': 25,
                'braco_perto': -118, 'antebraco_perto': -40, 'mao_perto': -25, 'coxa_perto': -6, 'coxa_longe': 6, 'dx': -6, 'dy': -4}),
        (0.44, {'tronco': -16, 'cabeca': 9, 'braco_longe': 126, 'antebraco_longe': 45, 'mao_longe': 30,
                'braco_perto': -128, 'antebraco_perto': -45, 'mao_perto': -30, 'coxa_perto': -6, 'coxa_longe': 6, 'dx': -7, 'dy': -5}),
        (0.5, {'tronco': 22, 'cabeca': -8, 'braco_longe': -30, 'antebraco_longe': -10, 'mao_longe': -20,
               'braco_perto': -205, 'antebraco_perto': -10, 'mao_perto': -20, 'coxa_perto': 10, 'canela_perto': -8,
               'coxa_longe': -8, 'canela_longe': -6, 'dx': 14, 'dy': 10}),
        (0.7, {'tronco': 20, 'cabeca': -7, 'braco_longe': -26, 'antebraco_longe': -8, 'mao_longe': -18,
               'braco_perto': -200, 'antebraco_perto': -8, 'mao_perto': -18, 'coxa_perto': 9, 'canela_perto': -8,
               'coxa_longe': -7, 'canela_longe': -6, 'dx': 13, 'dy': 9}),
        (1, {}),
    ]),
    # tranco para trás
    'dano': (0.6, False, None, [
        (0, {}),
        (0.12, {'tronco': -18, 'cabeca': -16, 'braco_perto': 25, 'antebraco_perto': 20, 'braco_longe': 30, 'antebraco_longe': 20,
                'mao_perto': 20, 'mao_longe': 20, 'dx': -12, 'dy': 3}),
        (0.45, {'tronco': -7, 'cabeca': -5, 'braco_perto': 8, 'braco_longe': 10, 'dx': -6}),
        (1, {}),
    ]),
}


def projeto():
    cortes = {v: cortar(cfg) for v, cfg in RIGS.items()}
    folha, pos = atlas(cortes)
    os.makedirs(os.path.join(PASTA, 'folhas'), exist_ok=True)
    cv2.imwrite(os.path.join(PASTA, 'folhas', 'rig.webp'), folha, [cv2.IMWRITE_WEBP_QUALITY, 101])
    pecas = {}
    animacoes = {}
    for v, cfg in RIGS.items():
        J = cfg['juntas']
        jt = {n_: J[PIVO[n_]] for n_ in PAIS}
        for n_ in PAIS:
            if (v, n_) not in pos:
                continue
            px, py, w, h, bx0, by0 = pos[(v, n_)]
            pv = jt[n_]
            pecas[f'{v}_{n_}'] = {'folha': 'rig.webp', 'x': px, 'y': py, 'l': w, 'a': h, 'maior': False, 'pivo': [pv[0] - bx0, pv[1] - by0]}
        # pose desenhada: cada encaixe na sua junta, relativo à junta do pai
        chao = cfg['chao']
        sinal = cfg['olha']  # ângulo "para a frente" = giro no sentido da vista

        def pose(ang):
            p = {}
            for n_, pai in PAIS.items():
                ref = J[PIVO[pai]] if pai else chao
                x, y = jt[n_][0] - ref[0], jt[n_][1] - ref[1]
                if pai is None:
                    x += ang.get('dx', 0) * sinal
                    y += ang.get('dy', 0)
                p[n_] = {'peca': f'{v}_{n_}' if (v, n_) in pos else None, 'x': x, 'y': y, 'rot': -ang.get(n_, 0) * sinal, 'sx': 1, 'sy': 1}
            return p

        animacoes[v] = {}
        for an, (dur, laco, imp, chaves) in ANIMACOES.items():
            a = {'duracao': dur, 'laco': laco, 'chaves': [{'t': t, 'pose': pose(ang)} for t, ang in chaves]}
            if imp is not None:
                a['impacto'] = imp
            animacoes[v][an] = a
    alt = {v: cfg['chao'][1] - 20 for v, cfg in RIGS.items()}
    proj = {
        'versao': 1,
        # altura de referência (px da folha) = altura de um personagem de pé
        # (a guarda é agachada: ~0,8 da altura em pé)
        'altura': round(max(alt.values()) / 0.8),
        'olha': {v: cfg['olha'] for v, cfg in RIGS.items()},
        'folhas': ['rig.webp', 'machados.webp', 'partes.webp', 'corpo.webp'],
        'pecas': pecas,
        'encaixes': [{'id': n_, 'pai': PAIS[n_]} for n_ in ORDEM],
        'animacoes': animacoes,
        'referencia': {v: {'folha': cfg['folha'], 'x': cfg['caixa'][0], 'y': cfg['caixa'][1], 'l': cfg['caixa'][2] - cfg['caixa'][0],
                           'a': cfg['caixa'][3] - cfg['caixa'][1],
                           'dx': (cfg['caixa'][2] - cfg['caixa'][0]) / 2 - cfg['chao'][0],
                           'dy': (cfg['caixa'][3] - cfg['caixa'][1]) - cfg['chao'][1], 'opacidade': 0.3} for v, cfg in RIGS.items()},
    }
    with open(os.path.join(PASTA, 'animacao.json'), 'w') as f:
        json.dump(proj, f, indent=1)
    print('ok', len(pecas), 'peças; atlas', folha.shape)


if __name__ == '__main__':
    projeto()
