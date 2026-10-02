"""
Boneco base do DragonBones a partir das folhas geradas (fundo magenta):
scripts/modelos/base/dragonbones/fonte/{frente,costas}.png.

    python3 scripts/sprites/boneco_db.py

Recorta as peças, acha as juntas (bola de cima = encaixe no pai; buraco de
baixo = onde o filho encaixa), monta o esqueleto em pé e grava
base_ske.json + base_tex.json + base_tex.png (DragonBones 5.5) e pecas/.
Além das peças do corpo, cria slots vazios para roupa, cabelo, rosto e arma:
é só pôr a imagem neles que ela segue o osso.
"""
import json, os
import cv2, numpy as np
from scipy import ndimage

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PASTA = os.path.join(RAIZ, 'scripts', 'modelos', 'base', 'dragonbones')

# peça -> centro aproximado (x, y) na folha
PECAS = {
    'frente': {
        'cabeca': (232, 720), 'pescoco': (423, 738), 'tronco': (609, 728), 'quadril': (824, 734),
        'braco_perto': (216, 891), 'antebraco_perto': (411, 894), 'mao_perto': (621, 903),
        'braco_longe': (223, 1040), 'antebraco_longe': (420, 1042), 'mao_longe': (616, 1050),
        'coxa_perto': (231, 1203), 'canela_perto': (428, 1204), 'pe_perto': (633, 1225),
        'coxa_longe': (226, 1376), 'canela_longe': (426, 1377), 'pe_longe': (636, 1393),
    },
    'costas': {
        'cabeca': (236, 710), 'pescoco': (417, 725), 'tronco': (596, 726), 'quadril': (808, 724),
        'braco_perto': (228, 870), 'braco_longe': (412, 870), 'mao_perto': (598, 892),
        'antebraco_perto': (241, 1011), 'antebraco_longe': (425, 1008), 'mao_longe': (608, 1038),
        'coxa_perto': (231, 1175), 'coxa_longe': (421, 1175), 'pe_perto': (616, 1204),
        'canela_perto': (216, 1386), 'canela_longe': (424, 1386), 'pe_longe': (629, 1403),
    },
}


def alfa(img):
    b, g, r = (img[..., k].astype(int) for k in range(3))
    s = ~((r - g > 90) & (b - g > 90))
    rosa = (r - g > 30) & (b - g > 30)
    borda = s & ~ndimage.binary_erosion(s)
    s &= ~(borda & rosa)
    return s


def recortar(vista):
    img = cv2.imread(os.path.join(PASTA, 'fonte', f'{vista}.png'))
    s = alfa(img)
    lab, _ = ndimage.label(ndimage.binary_opening(s))
    out = {}
    for nome, (x, y) in PECAS[vista].items():
        k = lab[y, x]
        if k == 0:  # centro caiu num buraco: pega o rótulo mais comum em volta
            v = lab[y - 15:y + 15, x - 15:x + 15].ravel()
            k = np.bincount(v[v > 0]).argmax()
        m = ndimage.binary_fill_holes(lab == k) & s | (lab == k)
        ys, xs = np.nonzero(m)
        f = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
        rgba = np.dstack([img[f], np.where(m[f], 255, 0).astype(np.uint8)])
        if nome.startswith('canela') and vista == 'costas':
            # nas costas a canela veio grudada no pé: corta no tornozelo (linha mais fina)
            a = rgba[..., 3] > 0
            larg = a.sum(1)
            h = len(larg)
            corte = int(h * 0.55) + int(np.argmin(larg[int(h * 0.55):int(h * 0.85)]))
            rgba = rgba[:corte + 4]
        out[nome] = rgba
    return out



def cinza(r):
    return r[..., :3].mean(2)


def buracos(r, lim=125):
    """buracos (encaixes escuros) da peça: [(área, (x, y))]"""
    d = (r[..., 3] > 0) & (cinza(r) < lim)
    d = ndimage.binary_opening(d, iterations=2)
    lab, k = ndimage.label(d)
    out = []
    for i in range(1, k + 1):
        cy, cx = ndimage.center_of_mass(lab == i)
        out.append((int((lab == i).sum()), (cx, cy)))
    return sorted(out, reverse=True)


def centro_faixa(r, de, ate):
    """centro (x, y) dos pixels da peça entre as frações de altura de..ate"""
    a = r[..., 3] > 0
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * de):max(int(h * ate), int(h * de) + 1)])
    return float(xs.mean()), float(ys.mean() + int(h * de))


def endireitar(r):
    """gira o membro para ficar em pé (eixo principal na vertical)"""
    ys, xs = np.nonzero(r[..., 3] > 0)
    c = np.cov(np.vstack([xs, ys]))
    w, v = np.linalg.eigh(c)
    ex, ey = v[:, 1]
    if ey < 0: ex, ey = -ex, -ey
    ang = np.degrees(np.arctan2(ex, ey))  # inclinação em relação à vertical
    h, l = r.shape[:2]
    d = int(np.hypot(h, l)) + 4
    M = cv2.getRotationMatrix2D((l / 2, h / 2), -ang, 1)
    M[0, 2] += (d - l) / 2; M[1, 2] += (d - h) / 2
    g = cv2.warpAffine(r, M, (d, d), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(g[..., 3] > 20)
    return g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def juntas(nome, r):
    """pontos (x, y) na imagem: 'em' = onde a peça encaixa no pai; os outros = onde os filhos encaixam"""
    a = r[..., 3] > 0
    h, l = a.shape
    if nome == 'quadril':
        bs = buracos(r)
        esq = [p for _, p in bs if p[0] < l * 0.4]
        dir_ = [p for _, p in bs if p[0] > l * 0.6]
        return {'em': (l / 2, h / 2), 'cintura': centro_faixa(r, 0, 0.18),
                'quadril_perto': esq[0] if esq else (l * 0.18, h * 0.5),
                'quadril_longe': dir_[0] if dir_ else (l * 0.82, h * 0.5)}
    if nome == 'tronco':
        bs = buracos(r)
        esq = [p for _, p in bs if p[0] < l * 0.4 and p[1] < h * 0.5]
        dir_ = [p for _, p in bs if p[0] > l * 0.6 and p[1] < h * 0.5]
        return {'em': centro_faixa(r, 0.92, 1.0), 'pescoco': centro_faixa(r, 0, 0.06),
                'ombro_perto': esq[0] if esq else (l * 0.12, h * 0.3),
                'ombro_longe': dir_[0] if dir_ else (l * 0.88, h * 0.3)}
    if nome == 'pescoco':
        # o pescoço entra no toco do tronco e a cabeça desce até o meio dele
        x, _ = centro_faixa(r, 0, 1)
        return {'em': (x, h * 0.15), 'cabeca': (x, h * 0.4)}
    if nome == 'cabeca':
        x, _ = centro_faixa(r, 0.9, 1.0)
        return {'em': (x, h * 0.97)}
    if nome.startswith('mao'):
        return {'em': centro_faixa(r, 0, 0.12)}
    if nome.startswith('pe'):
        return {'em': centro_faixa(r, 0.08, 0.22)}
    # membro em pé: bola em cima, buraco embaixo
    em = centro_faixa(r, 0, 0.02)
    em = (em[0], l * 0.42)
    bs = [p for _, p in buracos(r) if p[1] > h * 0.6]
    fim = bs[0] if bs else centro_faixa(r, 0.97, 1.0)
    return {'em': em, 'fim': fim}


# osso -> (pai, junta do pai onde encaixa)
ARVORE = {
    'quadril': (None, None),
    'tronco': ('quadril', 'cintura'),
    'pescoco': ('tronco', 'pescoco'),
    'cabeca': ('pescoco', 'cabeca'),
    'braco_perto': ('tronco', 'ombro_perto'), 'antebraco_perto': ('braco_perto', 'fim'), 'mao_perto': ('antebraco_perto', 'fim'),
    'braco_longe': ('tronco', 'ombro_longe'), 'antebraco_longe': ('braco_longe', 'fim'), 'mao_longe': ('antebraco_longe', 'fim'),
    'coxa_perto': ('quadril', 'quadril_perto'), 'canela_perto': ('coxa_perto', 'fim'), 'pe_perto': ('canela_perto', 'fim'),
    'coxa_longe': ('quadril', 'quadril_longe'), 'canela_longe': ('coxa_longe', 'fim'), 'pe_longe': ('canela_longe', 'fim'),
}
MEMBROS = ('braco', 'antebraco', 'coxa', 'canela')

# ordem de desenho (de trás para a frente); roupa logo depois da parte do corpo
ROUPA = {
    'cabeca': ['olhos', 'boca', 'cabelo_frente', 'chapeu'],
    'tronco': ['roupa_tronco', 'casaco'],
    'quadril': ['roupa_quadril', 'cinto'],
}
for lado in ('perto', 'longe'):
    ROUPA.update({f'braco_{lado}': [f'manga_{lado}'], f'antebraco_{lado}': [f'manga_baixo_{lado}'],
                  f'mao_{lado}': [f'luva_{lado}'], f'coxa_{lado}': [f'calca_{lado}'],
                  f'canela_{lado}': [f'calca_baixo_{lado}'], f'pe_{lado}': [f'bota_{lado}']})
ORDEM = ['capa_tras', 'cabelo_tras',
         'braco_longe', 'antebraco_longe', 'arma_longe', 'mao_longe',
         'coxa_longe', 'canela_longe', 'pe_longe', 'quadril',
         'coxa_perto', 'canela_perto', 'pe_perto',
         'tronco', 'pescoco', 'cabeca',
         'braco_perto', 'antebraco_perto', 'arma_perto', 'mao_perto']
# slot vazio -> osso (os que não são roupa de uma peça)
SOLTOS = {'capa_tras': 'capa', 'cabelo_tras': 'cabelo', 'arma_longe': 'mao_longe', 'arma_perto': 'mao_perto'}


# pose de montagem (graus, horário): braços um pouco abertos, joelho/cotovelo quase retos
POSE = {'braco_perto': 24, 'antebraco_perto': -10, 'braco_longe': -20, 'antebraco_longe': 8,
        'coxa_perto': 4, 'canela_perto': -3, 'coxa_longe': -4, 'canela_longe': 3}
# direção do osso no quadro da peça: membros apontam para baixo, coluna para cima
def base_osso(n):
    return -90 if n in ('quadril', 'tronco', 'pescoco', 'cabeca') else 90


def T(x, y):
    return np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float)


def R(g):
    c, s = np.cos(np.radians(g)), np.sin(np.radians(g))
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)


def decompor(M):
    return float(M[0, 2]), float(M[1, 2]), float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))


# juntas do boneco montado no topo da folha (coordenadas da folha): cada peça
# é escalada e girada para cair nelas — as peças soltas saíram mais grossas
# que o boneco de referência, então só encaixar pelos buracos dá errado
REF = {
    'frente': {
        'cabeca_base': (536, 152), 'pescoco_base': (527, 170), 'cintura': (536, 292), 'quadril_c': (542, 306),
        'ombro_perto': (487, 195), 'cotovelo_perto': (446, 262), 'pulso_perto': (412, 325),
        'ombro_longe': (566, 196), 'cotovelo_longe': (599, 259), 'pulso_longe': (635, 324),
        'anca_perto': (516, 303), 'joelho_perto': (480, 431), 'tornozelo_perto': (440, 544),
        'anca_longe': (574, 314), 'joelho_longe': (578, 426), 'tornozelo_longe': (585, 537),
        'cabeca_l': 128, 'pescoco_l': 26, 'quadril_l': 92, 'pe': 0.74,
    },
    'costas': {
        'cabeca_base': (507, 148), 'pescoco_base': (513, 163), 'cintura': (508, 282), 'quadril_c': (520, 300),
        'ombro_perto': (473, 188), 'cotovelo_perto': (442, 262), 'pulso_perto': (398, 322),
        'ombro_longe': (557, 188), 'cotovelo_longe': (586, 259), 'pulso_longe': (618, 320),
        'anca_perto': (487, 322), 'joelho_perto': (476, 425), 'tornozelo_perto': (470, 556),
        'anca_longe': (543, 324), 'joelho_longe': (576, 416), 'tornozelo_longe': (606, 538),
        'cabeca_l': 125, 'pescoco_l': 28, 'quadril_l': 94, 'pe': 0.74,
    },
}
# membro -> (junta de cima, junta de baixo) na referência
SEGMENTO = {'braco': ('ombro', 'cotovelo'), 'antebraco': ('cotovelo', 'pulso'),
            'coxa': ('anca', 'joelho'), 'canela': ('joelho', 'tornozelo')}
# nas costas o boneco olha para cima-esquerda: os pés apontam para a esquerda
ESPELHAR = {'costas': ('pe_perto', 'pe_longe')}


def mascara_ref(vista):
    img = cv2.imread(os.path.join(PASTA, 'fonte', f'{vista}.png'))
    s = alfa(img)
    s[630:] = False
    return s


def largura_ref(m, a, b):
    """largura do membro na referência, no meio do segmento a-b"""
    a, b = np.array(a, float), np.array(b, float)
    d = (b - a) / np.linalg.norm(b - a)
    n = np.array([-d[1], d[0]])
    c = (a + b) / 2
    lados = []
    for sinal in (1, -1):
        k = 0
        while k < 80:
            x, y = (c + sinal * n * (k + 1)).round().astype(int)
            if not m[y, x]:
                break
            k += 1
        lados.append(k)
    return sum(lados)


def escalar(r, sx, sy):
    h, l = r.shape[:2]
    return cv2.resize(r, (max(1, round(l * sx)), max(1, round(h * sy))), interpolation=cv2.INTER_AREA)


def afim(src, dst):
    """afim (3x3) por mínimos quadrados levando os pontos src em dst"""
    A = np.hstack([np.array(src, float), np.ones((len(src), 1))])
    X, *_ = np.linalg.lstsq(A, np.array(dst, float), rcond=None)
    M = np.eye(3)
    M[:2] = X.T
    return M


def montar(vista):
    pecas = recortar(vista)
    for n in pecas:
        if n.split('_')[0] in MEMBROS:
            pecas[n] = endireitar(pecas[n])
    for n in ESPELHAR.get(vista, ()):
        pecas[n] = pecas[n][:, ::-1].copy()
    ref = REF[vista]
    m = mascara_ref(vista)
    W = {}
    js = {}
    escala = {}
    for n in ARVORE:
        r = pecas[n]
        tipo, *lado = n.split('_')
        lado = lado[0] if lado else ''
        j = juntas(n, r)
        if tipo in MEMBROS:
            a, b = (ref[f'{k}_{lado}'] for k in SEGMENTO[tipo])
            comp_ref = np.hypot(b[0] - a[0], b[1] - a[1])
            comp = np.hypot(j['fim'][0] - j['em'][0], j['fim'][1] - j['em'][1])
            sy = comp_ref / comp
            larg = largura_ref(m, a, b) / (r.shape[1] * 0.8)
            sx = float(np.clip(larg, 0.55 * sy, 1.0 * sy))
            escala[n] = (sx, sy)
            r = escalar(r, sx, sy)
            j = juntas(n, r)
            ang = np.degrees(np.arctan2(b[1] - a[1], b[0] - a[0]) - np.arctan2(j['fim'][1] - j['em'][1], j['fim'][0] - j['em'][0]))
            W[n] = T(*a) @ R(ang) @ T(-j['em'][0], -j['em'][1])
        elif tipo in ('mao', 'pe'):
            if tipo == 'mao':
                ant = W[f'antebraco_{lado}']
                ang = np.degrees(np.arctan2(ant[1, 0], ant[0, 0]))
                s_ = sum(escala[f'antebraco_{lado}']) / 2
                ponto = ref[f'pulso_{lado}']
            else:
                ang, s_, ponto = 0, ref['pe'], ref[f'tornozelo_{lado}']
            r = escalar(r, s_, s_)
            j = juntas(n, r)
            if tipo == 'mao':
                # a mão veio desenhada torta: gira para os dedos seguirem o antebraço
                ys, xs = np.nonzero(r[..., 3] > 0)
                eixo = np.degrees(np.arctan2(ys.mean() - j['em'][1], xs.mean() - j['em'][0]))
                ang += 90 - eixo
            W[n] = T(*ponto) @ R(ang) @ T(-j['em'][0], -j['em'][1])
        elif n == 'cabeca':
            # tira o toco de baixo (fica só o pescoço separado)
            larg = (r[..., 3] > 0).sum(1)
            fim = len(larg) - 1
            while larg[fim] < larg.max() * 0.45:
                fim -= 1
            r = r[:fim + 2]
            s_ = ref['cabeca_l'] / r.shape[1]
            r = escalar(r, s_, s_)
            j = juntas(n, r)
            W[n] = T(*ref['cabeca_base']) @ T(-j['em'][0], -j['em'][1])
        elif n == 'pescoco':
            s_ = ref['pescoco_l'] / r.shape[1]
            r = escalar(r, s_, s_)
            a, b = np.array(ref['cabeca_base']), np.array(ref['pescoco_base'])
            c = (a + b) / 2
            W[n] = T(*c) @ T(-r.shape[1] / 2, -r.shape[0] / 2)
            j = {'em': (r.shape[1] / 2, r.shape[0] * 0.8), 'cabeca': (r.shape[1] / 2, r.shape[0] * 0.2)}
        elif n == 'quadril':
            s_ = ref['quadril_l'] / r.shape[1]
            r = escalar(r, s_, s_)
            j = juntas(n, r)
            W[n] = T(*ref['cintura']) @ T(-j['cintura'][0], -j['cintura'][1])
        elif n == 'tronco':
            src = [j['pescoco'], j['ombro_perto'], j['ombro_longe'], j['em']]
            dst = [ref['pescoco_base'], ref['ombro_perto'], ref['ombro_longe'], ref['cintura']]
            M = afim(src, dst)
            # assa a parte linear na imagem (sem girar o osso)
            L = M.copy(); L[:2, 2] = 0
            h, l = r.shape[:2]
            cantos = np.array([L @ [x, y, 1] for x in (0, l) for y in (0, h)])[:, :2]
            lo, hi = cantos.min(0), cantos.max(0)
            Lt = T(-lo[0], -lo[1]) @ L
            r = cv2.warpAffine(r, Lt[:2], (int(np.ceil(hi[0] - lo[0])), int(np.ceil(hi[1] - lo[1]))), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0))
            j = {k: tuple((Lt @ [x, y, 1])[:2]) for k, (x, y) in j.items()}
            W[n] = M @ np.linalg.inv(Lt)
        pecas[n] = r
        js[n] = j
    # chão em y = 0, quadril em x = 0
    fundo = max((W[n] @ [x, y, 1])[1] for n, r in pecas.items() for x, y in ((0, r.shape[0]), (r.shape[1], r.shape[0])))
    meio = (W['quadril'] @ [*js['quadril']['em'], 1])[0]
    for n in W:
        W[n] = T(-meio, -fundo) @ W[n]
    return pecas, js, W


def previa(vista, caminho):
    pecas, js, W = montar(vista)
    x0, y0, L, A = -260, -720, 520, 740
    tela = np.zeros((A, L, 4), np.float32)
    for n in [o for o in ORDEM if o in pecas]:
        r = pecas[n]
        M = (T(-x0, -y0) @ W[n])[:2]
        g = cv2.warpAffine(r, M, (L, A), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)).astype(np.float32)
        a = g[..., 3:] / 255
        tela[..., :3] = g[..., :3] * a + tela[..., :3] * (1 - a)
        tela[..., 3:] = np.maximum(tela[..., 3:], g[..., 3:])
    a = tela[..., 3:] / 255
    out = (tela[..., :3] * a + 255 * (1 - a)).astype(np.uint8)
    cv2.line(out, (0, -y0), (L, -y0), (0, 0, 255), 1)
    cv2.imwrite(caminho, out)


def projeto():
    """grava base_ske.json, base_tex.json, base_tex.png e pecas/"""
    import shutil
    shutil.rmtree(os.path.join(PASTA, 'pecas'), ignore_errors=True)
    texturas = {}
    arms = []
    for vista in ('frente', 'costas'):
        pecas, js, W = montar(vista)
        os.makedirs(os.path.join(PASTA, 'pecas', vista), exist_ok=True)
        for n, r in pecas.items():
            cv2.imwrite(os.path.join(PASTA, 'pecas', vista, f'{n}.png'), r)
            texturas[f'{vista}/{n}'] = r
        # ossos (quadro do osso = quadro da peça girado para apontar ao longo dela)
        B = {n: W[n] @ T(*js[n]['em']) @ R(base_osso(n)) for n in W}
        def comp(n):
            r = pecas[n]
            if 'fim' in js[n]:
                return int(np.hypot(js[n]['fim'][0] - js[n]['em'][0], js[n]['fim'][1] - js[n]['em'][1]))
            return int(r.shape[0] * 0.6)
        ossos = [{'name': 'root'}]
        for n, (pai, _) in ARVORE.items():
            pm = B[pai] if pai else np.eye(3)
            x, y, g = decompor(np.linalg.inv(pm) @ B[n])
            ossos.append({'name': n, 'parent': pai or 'root', 'length': comp(n),
                          'transform': {'x': round(x, 2), 'y': round(y, 2), 'skX': round(g, 2), 'skY': round(g, 2)}})
        # ossos extras para o que balança (vazios no boneco careca)
        h = pecas['cabeca'].shape[0]
        ossos.append({'name': 'cabelo', 'parent': 'cabeca', 'length': 60, 'transform': {'x': round(h * 0.55, 2), 'y': 0, 'skX': 180, 'skY': 180}})
        ossos.append({'name': 'capa', 'parent': 'tronco', 'length': 120, 'transform': {'x': comp('tronco') * 1.4, 'y': 0, 'skX': 180, 'skY': 180}})
        slots, pele = [], []
        for n in ORDEM:
            if n in SOLTOS:
                slots.append({'name': n, 'parent': SOLTOS[n], 'displayIndex': -1})
                continue
            slots.append({'name': n, 'parent': n})
            r = pecas[n]
            x, y, g = decompor(np.linalg.inv(B[n]) @ W[n] @ T(r.shape[1] / 2, r.shape[0] / 2))
            pele.append({'name': n, 'display': [{'name': f'{vista}/{n}', 'transform': {'x': round(x, 2), 'y': round(y, 2), 'skX': round(g, 2), 'skY': round(g, 2)}}]})
            for roupa in ROUPA.get(n, []):
                slots.append({'name': roupa, 'parent': n, 'displayIndex': -1})
        pts = np.array([(W[n] @ [x, y, 1])[:2] for n, r in pecas.items() for x in (0, r.shape[1]) for y in (0, r.shape[0])])
        (x0, y0), (x1, y1) = pts.min(0), pts.max(0)
        anims = [{'duration': 0, 'playTimes': 0, 'name': a} for a in ('parado', 'andar', 'correr', 'atacar', 'dano', 'morrer')]
        arms.append({'type': 'Armature', 'frameRate': 24, 'name': f'base_{vista}',
                     'aabb': {'x': round(x0), 'y': round(y0), 'width': round(x1 - x0), 'height': round(y1 - y0)},
                     'bone': ossos, 'slot': slots, 'skin': [{'slot': pele}], 'animation': anims,
                     'defaultActions': [{'gotoAndPlay': 'parado'}]})
    # atlas (prateleiras)
    L = 1024
    ordem = sorted(texturas, key=lambda k: -texturas[k].shape[0])
    x = y = h = 0
    sub = []
    for k in ordem:
        r = texturas[k]
        if x + r.shape[1] > L:
            x, y, h = 0, y + h + 2, 0
        sub.append({'name': k, 'x': x, 'y': y, 'width': r.shape[1], 'height': r.shape[0]})
        x += r.shape[1] + 2
        h = max(h, r.shape[0])
    A = 1 << int(np.ceil(np.log2(y + h)))
    atlas = np.zeros((A, L, 4), np.uint8)
    for s_ in sub:
        r = texturas[s_['name']]
        atlas[s_['y']:s_['y'] + r.shape[0], s_['x']:s_['x'] + r.shape[1]] = r
    cv2.imwrite(os.path.join(PASTA, 'base_tex.png'), atlas)
    json.dump({'name': 'base', 'imagePath': 'base_tex.png', 'width': L, 'height': A, 'SubTexture': sub},
              open(os.path.join(PASTA, 'base_tex.json'), 'w'), indent=1)
    json.dump({'frameRate': 24, 'name': 'base', 'version': '5.5', 'compatibleVersion': '5.5', 'armature': arms},
              open(os.path.join(PASTA, 'base_ske.json'), 'w'), indent=1)
    print('ok', len(sub), 'peças, atlas', L, 'x', A)


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == 'previa':
        for v in ('frente', 'costas'):
            previa(v, os.path.join(sys.argv[2], f'previa-{v}.png'))
    else:
        projeto()
