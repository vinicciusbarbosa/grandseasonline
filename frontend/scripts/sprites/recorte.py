"""
Boneco recortado em partes (como no Wakfu): de cada vista desenhada (3/4 de
frente e 3/4 de costas) saem as peças — cabeça, tronco, quadril, braço,
antebraço (com a mão), coxa e canela (com o pé) dos dois lados — cada uma com
o seu pivô (a junta onde gira). O jogo monta e anima as peças por código.

    python3 recorte.py <personagem>

Lê scripts/modelos/<personagem>/folha-*.png (fundo magenta) e as juntas marcadas em ESQUELETOS
(px da folha); grava public/sprites/<personagem>/recorte/ (PNG por peça e o
esqueleto.json).

Como sai cada peça:
1. silhueta da vista (fundo magenta = chave de cor; a borda rosada é limpa);
2. cada pixel vai para a peça cujo osso está mais perto (cápsula: distância
   ao segmento menos a espessura do membro); a cabeça é o que fica acima do
   queixo;
3. nas juntas as peças se sobrepõem (um disco em volta da junta entra nas
   duas), para não abrir buraco quando dobram;
4. pela cor (pele, roupa, short): o pixel de um material que a peça não tem
   vai para a vizinha que tem; o contorno preto fica com a peça mais perto.
"""
import json, os, sys
import cv2, numpy as np
from scipy import ndimage

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
nome = sys.argv[1] if len(sys.argv) > 1 else 'base'

# Juntas de cada vista, em px dentro do recorte `caixa` (x0, y0, x1, y1) da
# folha. "perto"/"longe": o lado mais perto/longe da câmera. `olha`: para que
# lado da imagem o personagem está virado (-1 esquerda, 1 direita).
ESQUELETOS = {
    'base': {
        'frente': {
            'folha': 'folha-magenta.png', 'caixa': (180, 0, 350, 490), 'olha': -1, 'queixo': 106,
            'juntas': {
                'pescoco': (85, 116), 'cintura': (88, 230), 'quadril': (88, 248),
                'ombro_longe': (58, 132), 'cotovelo_longe': (42, 200), 'pulso_longe': (30, 262), 'mao_longe': (26, 280),
                'ombro_perto': (122, 134), 'cotovelo_perto': (142, 200), 'pulso_perto': (145, 262), 'mao_perto': (147, 284),
                'anca_longe': (68, 262), 'joelho_longe': (65, 348), 'tornozelo_longe': (68, 430), 'pe_longe': (46, 452),
                'anca_perto': (108, 262), 'joelho_perto': (112, 345), 'tornozelo_perto': (128, 452), 'pe_perto': (134, 474),
            },
        },
        'costas': {
            'folha': 'folha-magenta.png', 'caixa': (505, 0, 665, 490), 'olha': 1, 'queixo': 108,
            'juntas': {
                'pescoco': (90, 116), 'cintura': (80, 230), 'quadril': (80, 248),
                'ombro_perto': (45, 140), 'cotovelo_perto': (28, 205), 'pulso_perto': (22, 262), 'mao_perto': (25, 282),
                'ombro_longe': (115, 140), 'cotovelo_longe': (122, 205), 'pulso_longe': (128, 268), 'mao_longe': (130, 284),
                'anca_longe': (58, 262), 'joelho_longe': (52, 345), 'tornozelo_longe': (42, 430), 'pe_longe': (40, 454),
                'anca_perto': (100, 262), 'joelho_perto': (92, 345), 'tornozelo_perto': (88, 450), 'pe_perto': (100, 474),
            },
        },
    },
}

# peça: (osso de, osso até, espessura px, pai, pivô)
PECAS = {
    'tronco': ('pescoco', 'cintura', 27, 'quadril', 'cintura'),
    'quadril': ('anca_longe', 'anca_perto', 20, None, 'quadril'),
    'braco_longe': ('ombro_longe', 'cotovelo_longe', 14, 'tronco', 'ombro_longe'),
    'antebraco_longe': ('cotovelo_longe', 'mao_longe', 13, 'braco_longe', 'cotovelo_longe'),
    'braco_perto': ('ombro_perto', 'cotovelo_perto', 14, 'tronco', 'ombro_perto'),
    'antebraco_perto': ('cotovelo_perto', 'mao_perto', 13, 'braco_perto', 'cotovelo_perto'),
    'coxa_longe': ('anca_longe', 'joelho_longe', 17, 'quadril', 'anca_longe'),
    'canela_longe': ('joelho_longe', 'pe_longe', 12, 'coxa_longe', 'joelho_longe'),
    'coxa_perto': ('anca_perto', 'joelho_perto', 17, 'quadril', 'anca_perto'),
    'canela_perto': ('joelho_perto', 'pe_perto', 12, 'coxa_perto', 'joelho_perto'),
}
# a cabeça é tudo acima do queixo; gira no pescoço
# ordem de desenho (de trás para a frente)
ORDEM = ['braco_longe', 'antebraco_longe', 'coxa_longe', 'canela_longe', 'quadril', 'coxa_perto', 'canela_perto',
         'tronco', 'cabeca', 'braco_perto', 'antebraco_perto']
# juntas com sobreposição (disco de raio r entra nas duas peças)
JUNTAS = [('braco_longe', 'antebraco_longe', 'cotovelo_longe', 11), ('braco_perto', 'antebraco_perto', 'cotovelo_perto', 12),
          ('coxa_longe', 'canela_longe', 'joelho_longe', 13), ('coxa_perto', 'canela_perto', 'joelho_perto', 13),
          ('quadril', 'coxa_longe', 'anca_longe', 16), ('quadril', 'coxa_perto', 'anca_perto', 16),
          ('tronco', 'quadril', 'cintura', 14), ('tronco', 'cabeca', 'pescoco', 12)]


def silhueta(img):
    """Fundo magenta (chave de cor): tudo que é magenta é fundo, inclusive os
    vãos entre braço e corpo."""
    b, g, r = (img[..., k].astype(int) for k in range(3))
    magenta = (r - g > 90) & (b - g > 90)
    corpo = ~magenta
    lab2, n2 = ndimage.label(corpo)
    tam = ndimage.sum(corpo, lab2, range(1, n2 + 1))
    return lab2 == (np.argmax(tam) + 1)


def sem_rosa(img, s):
    """Tira o rosado da borda (mistura com o magenta do fundo): a cor da borda
    vira a do pixel de dentro mais perto."""
    dentro = ndimage.binary_erosion(s, iterations=2)
    _, (iy, ix) = ndimage.distance_transform_edt(~dentro, return_indices=True)
    b, g, r = (img[..., k].astype(int) for k in range(3))
    rosado = s & ~dentro & ((r - g > 25) & (b - g > 25))
    out = img.copy()
    out[rosado] = img[iy[rosado], ix[rosado]]
    return out


def dist_segmento(X, Y, a, b):
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    t = np.clip(((X - a[0]) * d[0] + (Y - a[1]) * d[1]) / max(1e-6, d @ d), 0, 1)
    return np.hypot(X - (a[0] + t * d[0]), Y - (a[1] + t * d[1]))


def vista(cfg, saida):
    x0, y0, x1, y1 = cfg['caixa']
    img = cv2.imread(os.path.join(RAIZ, 'scripts', 'modelos', nome, cfg['folha']))[y0:y1, x0:x1]
    s = silhueta(img)
    img = sem_rosa(img, s)
    J = cfg['juntas']
    A, L = s.shape
    Y, X = np.mgrid[0:A, 0:L].astype(float)
    nomes = list(PECAS)
    custo = np.stack([dist_segmento(X, Y, J[a], J[b]) - e for a, b, e, _, _ in PECAS.values()])
    dono = np.argmin(custo, 0)
    rotulo = {}
    cabeca = s & (Y < cfg['queixo'])
    for i, n in enumerate(nomes):
        rotulo[n] = s & (dono == i) & ~cabeca
    rotulo['cabeca'] = cabeca
    # pela cor: cada pixel é de um "material" (pele, roupa, short...; k-means
    # nas cores) e cada peça tem os materiais do seu miolo. Pixel de um
    # material que a peça não tem vai para a peça vizinha que tem (a regata
    # que caiu no braço volta para o tronco, o short no antebraço vai para a coxa)
    lab_img = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    colorido = s & (lab_img[..., 0] > 50)
    amostra = lab_img[colorido]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, rot_k, centros = cv2.kmeans(amostra, 6, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    material = np.full(s.shape, -1)
    material[colorido] = rot_k.ravel()
    todas = list(PECAS)
    tem = {}
    dists = {}
    for n, (a, b, e, _, _) in PECAS.items():
        d = dist_segmento(X, Y, J[a], J[b])
        dists[n] = (d, e)
        # miolo longe da junta de cima (no ombro o braço encosta na roupa)
        a2 = np.array(J[a], float) + 0.5 * (np.array(J[b], float) - np.array(J[a], float))
        miolo = rotulo[n] & colorido & (dist_segmento(X, Y, a2, J[b]) < e * 0.45)
        if miolo.sum() < 10:
            miolo = rotulo[n] & colorido
        cont = np.bincount(material[miolo], minlength=6) / max(1, miolo.sum())
        tem[n] = set(np.nonzero(cont >= 0.12)[0].tolist())
    for n in todas:
        fora = rotulo[n] & colorido & ~np.isin(material, list(tem[n]))
        # a mão (sombra, dedos) é do antebraço, seja qual for a cor
        fim = PECAS[n][1]
        if fim.startswith('mao'):
            fora &= np.hypot(X - J[fim][0], Y - J[fim][1]) > 16
        ys, xs = np.nonzero(fora)
        if not len(xs):
            continue
        melhor = np.full(len(xs), np.inf)
        destino = np.full(len(xs), -1)
        for j, o in enumerate(todas):
            if o == n:
                continue
            do, eo = dists[o]
            ok = np.isin(material[ys, xs], list(tem[o])) & (do[ys, xs] < eo * 1.6 + 12)
            dd = np.where(ok, do[ys, xs] - eo, np.inf)
            ganha = dd < melhor
            melhor = np.where(ganha, dd, melhor)
            destino = np.where(ganha, j, destino)
        for j in set(destino.tolist()) - {-1}:
            sel = destino == j
            rotulo[n][ys[sel], xs[sel]] = False
            rotulo[todas[j]][ys[sel], xs[sel]] = True
    # contorno preto: fica com a peça do pixel colorido mais perto
    contorno = s & ~cabeca & (lab_img[..., 0] <= 50)
    mapa = np.full(s.shape, -1)
    for j, n in enumerate(todas):
        mapa[rotulo[n] & ~contorno] = j
    _, (iy, ix) = ndimage.distance_transform_edt(mapa < 0, return_indices=True)
    perto_cor = mapa[iy, ix]
    for j, n in enumerate(todas):
        rotulo[n] = (rotulo[n] & ~contorno) | (contorno & (perto_cor == j))
    # pedaços soltos: vão para a peça vizinha que mais encosta
    for n in list(rotulo):
        lab, k = ndimage.label(rotulo[n])
        if k > 1:
            tam = ndimage.sum(rotulo[n], lab, range(1, k + 1))
            fica = lab == (np.argmax(tam) + 1)
            solto = rotulo[n] & ~fica
            rotulo[n] = fica
            for comp in range(1, k + 1):
                m = solto & (lab == comp)
                if not m.any():
                    continue
                anel = ndimage.binary_dilation(m, iterations=2) & ~m
                melhor = max((o for o in rotulo if o != n), key=lambda o: (rotulo[o] & anel).sum())
                rotulo[melhor] |= m
    # sobreposição nas juntas (só dentro das duas peças)
    pecas = {n: rotulo[n].copy() for n in rotulo}
    for p, f, j, r in JUNTAS:
        disco = np.hypot(X - J[j][0], Y - J[j][1]) < r
        ambos = disco & (rotulo[p] | rotulo[f])
        pecas[p] |= ambos
        pecas[f] |= ambos
    # contorno suave, 1 px para dentro (a borda clara misturada com o fundo sai)
    alfa_s = cv2.GaussianBlur(ndimage.binary_erosion(s).astype(np.float32), (3, 3), 0.7)
    os.makedirs(saida, exist_ok=True)
    info = {}
    for n, m in pecas.items():
        ys, xs = np.nonzero(m)
        if not len(xs):
            continue
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        a_ = np.where(m, alfa_s, 0)
        rgba = np.dstack([img, (a_ * 255).astype(np.uint8)])[by0:by1, bx0:bx1]
        cv2.imwrite(os.path.join(saida, f'{n}.png'), rgba)
        pai = PECAS[n][3] if n in PECAS else 'tronco'
        piv = J[PECAS[n][4]] if n in PECAS else J['pescoco']
        info[n] = {'x': int(bx0), 'y': int(by0), 'l': int(bx1 - bx0), 'a': int(by1 - by0), 'pai': pai, 'pivo': [int(piv[0]), int(piv[1])]}
    ys, xs = np.nonzero(s)
    pe = [float(np.mean([J['pe_longe'][0], J['pe_perto'][0]])), float(ys.max())]
    return {'olha': cfg['olha'], 'altura': int(ys.max() - ys.min()), 'pe': pe, 'tamanho': [L, A], 'ordem': ORDEM, 'pecas': info, 'juntas': {k: list(v) for k, v in J.items()}}


if __name__ == '__main__':
    destino = os.path.join(RAIZ, 'public', 'sprites', nome, 'recorte')
    esq = {v: vista(cfg, os.path.join(destino, v)) for v, cfg in ESQUELETOS[nome].items()}
    with open(os.path.join(destino, 'esqueleto.json'), 'w') as f:
        json.dump(esq, f)
    print('ok', {v: len(e['pecas']) for v, e in esq.items()})
