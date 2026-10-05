"""
TESTE (arte do Ragnarok Online, Gravity — não vai para a versão final):
monta as tripulações no esquema do Ragnarok — corpo sem cabeça + cabeça
(penteado) encaixada no pescoço de cada quadro — e importa monstros
(transformações) e efeitos das folhas em scripts/modelos/ro/.

    python3 ro_importar.py

Grava folhas do jogo em public/sprites/<id>/ (manifesto + tiras por
direção) e efeitos em public/sprites/efeitos/<nome>/.

Os quadros de cada folha são achados pelos pedaços desenhados (componentes)
e escolhidos por janela: (y do centro, x mínimo, x máximo), em px da folha.
O Ragnarok desenha 5 direções olhando para a esquerda (S, SO, O, NO, N); o
jogo quer S, SE, E, NE, N: as três do meio saem espelhadas.
"""
import json, os
import cv2, numpy as np
from scipy import ndimage

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORIG = os.path.join(RAIZ, 'scripts', 'modelos', 'ro')
SPR = os.path.join(RAIZ, 'public', 'sprites')


# ------------------------------------------------------------------ folhas

def carregar(nome):
    a = cv2.imread(os.path.join(ORIG, nome), cv2.IMREAD_UNCHANGED)
    if a.shape[2] == 3:
        a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    a = a.copy()
    a[..., 3] = np.where(a[..., 3] > 0, 255, 0)
    return a


def carregar_preto(nome):
    """folha de fundo preto (efeito de luz): alfa = brilho, cor sem o preto"""
    a = cv2.imread(os.path.join(ORIG, nome), cv2.IMREAD_UNCHANGED)[..., :3].astype(np.float32)
    al = a.max(axis=2) / 255.0
    al = np.clip((al - 0.05) / 0.95, 0, 1)
    cor = np.clip(a / np.maximum(al[..., None], 1e-3), 0, 255)
    return np.dstack([cor, al * 255]).astype(np.uint8)


_cache = {}


def pecas(a, chave, dil=3, minarea=150):
    if chave in _cache:
        return _cache[chave]
    al = a[..., 3] > 20
    lab, _ = ndimage.label(ndimage.binary_dilation(al, iterations=dil))
    out = []
    for i, s in enumerate(ndimage.find_objects(lab)):
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        m = (lab[s] == i + 1) & al[s]
        if m.sum() < minarea or w > 240 or h > 300:
            continue
        out.append(dict(cx=(s[1].start + s[1].stop) / 2, cy=(s[0].start + s[0].stop) / 2, s=s, m=m))
    _cache[chave] = out
    return out


def janela(a, chave, y, x0=0, x1=99999, tol=22, **kw):
    """quadros com o centro perto de y e x entre x0 e x1, da esquerda para a direita"""
    qs = [q for q in pecas(a, chave, **kw) if abs(q['cy'] - y) <= tol and x0 <= q['cx'] <= x1]
    qs.sort(key=lambda q: q['cx'])
    out = []
    for q in qs:
        r = a[q['s']].copy()
        r[..., 3] = np.where(q['m'], r[..., 3], 0)
        out.append(r)
    return out


def caixa(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 20)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def aparar(rgba):
    x0, y0, x1, y1 = caixa(rgba)
    return rgba[y0:y1, x0:x1]


def pintar(q, img, x, y):
    h, w = img.shape[:2]
    X0, Y0 = max(0, x), max(0, y)
    X1, Y1 = min(q.shape[1], x + w), min(q.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = img[Y0 - y:Y1 - y, X0 - x:X1 - x]
    a = sub[..., 3:] / 255.0
    reg = q[Y0:Y1, X0:X1]
    reg[..., :3] = (sub[..., :3] * a + reg[..., :3] * (1 - a)).astype(np.uint8)
    reg[..., 3] = np.maximum(reg[..., 3], sub[..., 3])


def espelho(im):
    return im[:, ::-1].copy()


# ------------------------------------------------------------------ cabeças

def cabecas(folha, linha):
    """5 direções (S, SO, O, NO, N) de um penteado (linha da folha de cabeças)"""
    a = carregar(folha)
    qs = pecas(a, folha + '-cab', dil=1, minarea=60)
    linhas = []
    for q in sorted(qs, key=lambda q: q['cy']):
        for l in linhas:
            if abs(l[0] - q['cy']) < 18:
                l[1].append(q)
                break
        else:
            linhas.append([q['cy'], [q]])
    l = sorted(linhas[linha][1], key=lambda q: q['cx'])[:5]
    out = []
    for q in l:
        r = a[q['s']].copy()
        r[..., 3] = np.where(q['m'], r[..., 3], 0)
        out.append(aparar(r))
    return out


# ------------------------------------------------------------------ montagem

L, A = 150, 132
PE = (75, 124)
DIRS = ['S', 'SE', 'E', 'NE', 'N']


def pescoco_parado(corpo):
    """pescoço (x, y no corpo aparado) da pose parada e o molde em volta dele"""
    cp = aparar(corpo)
    ys = np.nonzero(cp[..., 3].max(1) > 20)[0]
    y = int(ys.min())
    cols = np.nonzero((cp[y:y + 12, :, 3] > 20).any(0))[0]
    x = float(cols.mean())
    molde = cp[y:y + 18, max(0, int(x) - 10):int(x) + 11]
    return {'x': x, 'y': y, 'molde': molde, 'dx': x - max(0, int(x) - 10), 'pe': pe_x(cp), 'h': cp.shape[0],
            'dxc': x - cintura_x(cp)}


def cintura_x(cp):
    """x do meio do corpo na altura da cintura (o quadril quase não sai do lugar)"""
    a = cp[..., 3] > 20
    h = a.shape[0]
    cols = np.nonzero(a[int(h * 0.5):int(h * 0.62)].any(0))[0]
    return float(cols.mean())


def topo_tronco(cp, dx_cintura=None, raio=4, banda=6, perc=50):
    """pescoço = topo do tronco numa faixa acima da cintura, depois de apagar o
    que é fino (braço e punho erguidos não contam). dx_cintura: distância
    pescoço-cintura da pose parada (None = a própria pose parada)"""
    a = cp[..., 3] > 20
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * raio + 1, 2 * raio + 1))
    t = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_OPEN, k) > 0
    if dx_cintura is None:
        ys = np.nonzero(t.any(1))[0]
        y = int(ys.min())
        cols = np.nonzero(t[y:y + 6].any(0))[0]
        return float(cols.mean()), y
    xc = cintura_x(cp) + dx_cintura
    x0, x1 = int(round(xc - banda)), int(round(xc + banda)) + 1
    faixa = t[:, max(0, x0):x1]
    # topo de cada coluna da faixa; o pescoço é o mais baixo dos topos do
    # meio (punho/ombro erguido fica mais alto e é ignorado pela mediana)
    topos = [int(np.argmax(faixa[:, c])) for c in range(faixa.shape[1]) if faixa[:, c].any()]
    if not topos:
        return xc, 0
    y = int(np.percentile(topos, perc))
    # corpo inclinado: o pescoço vai junto com o topo do tronco (até 8 px)
    x0, x1 = int(round(xc - 8)), int(round(xc + 8)) + 1
    cols = np.nonzero(t[y:y + 5, max(0, x0):x1].any(0))[0]
    if len(cols):
        xc = float(cols.mean() + max(0, x0))
    return xc, y


def pe_x(cp):
    """x do meio dos pés (linhas de baixo do corpo)"""
    cols = np.nonzero((cp[-8:, :, 3] > 20).any(0))[0]
    return float(cols.mean())


def sobre_preto(im):
    a = im[..., 3:].astype(np.float32) / 255
    return np.dstack([im[..., :3] * a, im[..., 3:]]).astype(np.float32)


def achar_pescoco(cp, ref):
    """acha no quadro o mesmo pedaço de pescoço/ombros da pose parada (o braço
    erguido ou o corpo inclinado não enganam, como enganava pegar o topo)"""
    h = cp.shape[0]
    # perto de onde o pescoço estaria pela altura (pés no chão)
    y_esp = ref['y'] + (h - ref['h'])
    alvo = sobre_preto(cp)
    m = sobre_preto(ref['molde'])
    if alvo.shape[0] < m.shape[0] or alvo.shape[1] < m.shape[1]:
        return ref['x'], y_esp
    r = cv2.matchTemplate(alvo, m, cv2.TM_SQDIFF)
    # penaliza ficar longe do esperado (evita achar o pescoço no meio da perna)
    yy, xx = np.mgrid[0:r.shape[0], 0:r.shape[1]]
    x_esp = pe_x(cp) + (ref['x'] - ref['pe']) - ref['dx']
    r = r / (r.max() + 1e-6) + 0.004 * ((yy - y_esp) ** 2 + 0.5 * (xx - x_esp) ** 2)
    y, x = np.unravel_index(np.argmin(r), r.shape)
    return x + ref['dx'], y


def montar(corpo, cabeca, ref, ancora='pescoco', braco_por_cima=False, achar=None):
    """corpo + cabeça no pescoço achado neste quadro. ref: pescoco_parado() da
    mesma direção. ancora: 'pescoco' (parado/andar: o tronco fica no lugar e
    as pernas balançam) ou 'pe' (ataque/dano: os pés ficam no lugar).
    braco_por_cima: o que o corpo tem acima do pescoço (braço erguido) fica
    na frente da cabeça. achar(cp, ref) -> (x, y): outro jeito de achar o pescoço"""
    q = np.zeros((A, L, 4), np.uint8)
    cp = aparar(corpo)
    h = cp.shape[0]
    nx, ny = achar(cp, ref) if achar else topo_tronco(cp, ref['dxc'], banda=ref.get('banda', 6), perc=ref.get('perc', 50))
    if ancora == 'pe':
        ox = int(round(PE[0] - pe_x(cp)))
    else:
        ox = int(round(PE[0] - (ref['pe'] - ref['x']) - nx))
    oy = PE[1] - h
    pintar(q, cp, ox, oy)
    if cabeca is not None:
        cb = cabeca
        pintar(q, cb, int(round(ox + nx - cb.shape[1] / 2)), oy + int(ny) - cb.shape[0] + ref.get('sobre', 5))
        if braco_por_cima and ny > 2:
            pintar(q, cp[:int(ny) - 1], ox, oy)
    return q


def tingir(rgba, de_h=(0, 25), para_h=108, max_v=165, sat_min=40):
    """troca a cor da roupa escura (marrom/vinho → azul da Marinha); a pele (clara) fica"""
    hsv = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    m = ((h <= de_h[1]) | (h >= 170)) & (s >= sat_min) & (v <= max_v) & (rgba[..., 3] > 0)
    hsv[..., 0] = np.where(m, para_h, hsv[..., 0])
    hsv[..., 1] = np.where(m, np.minimum(255, (s * 0.8).astype(int)), hsv[..., 1]).astype(np.uint8)
    out = rgba.copy()
    out[..., :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    return out


def gravar(pid, anims, tempos, densidade, fonte, altura=96):
    D = os.path.join(SPR, pid)
    os.makedirs(D, exist_ok=True)
    for f in os.listdir(D):
        if f.endswith('.png') or f == 'manifesto.json':
            os.remove(os.path.join(D, f))
    man = {}
    for nome, por_dir in anims.items():
        man[nome] = {}
        for d, quadros in por_dir.items():
            arq = f'{nome}_{d}.png'
            cv2.imwrite(os.path.join(D, arq), np.hstack(quadros))
            man[nome][d] = {'arquivo': arq, 'quadros': len(quadros)}
    json.dump({'quadro': [L, A], 'pe': list(PE), 'altura': altura, 'densidade': densidade, 'tempos': tempos,
               'fonte': fonte, 'anims': man}, open(os.path.join(D, 'manifesto.json'), 'w'), indent=1)


FONTE = 'TESTE — arte do Ragnarok Online (Gravity); não vai para a versão final'

# Cada corpo: janelas dos quadros. parado: (y, x1); andar: [y das 5 linhas] e x1;
# frente/costas: (y, x0, x1) — o Ragnarok só desenha 2 direções no ataque e no dano.
CORPOS = {
    'bandana': dict(folha='corpo-bandana.png', parado=(46, 230), andar=([146, 247, 346, 446, 546], 380),
                    dano=((151, 420, 500), (251, 420, 520)), atacar=((446, 400, 900), (546, 480, 900))),
    'pistoleiro': dict(folha='corpo-pistoleiro.png', parado=(59, 320), andar=([184, 279, 374, 469, 564], 500),
                       dano=((170, 560, 700), (278, 560, 700)), atacar=((409, 560, 1100), (509, 560, 1100)),
                       tiro=((636, 600, 1100), (726, 600, 1100))),
    'samurai': dict(folha='corpo-samurai.png', parado=(57, 500), andar=([194, 315, 435, 554, 675], 800),
                    dano=((809, 0, 200), (809, 220, 400)), atacar=((1171, 0, 500), (1171, 550, 1100))),
    'monge': dict(folha='corpo-monge.png', parado=(49, 250), andar=([150, 251, 352, 452, 554], 400),
                  dano=((56, 660, 760), (59, 790, 900)), atacar=((554, 440, 900), (654, 540, 900))),
    'verao': dict(folha='corpo-verao.png', parado=(41, 220), andar=([131, 219, 311, 406, 503], 400),
                  dano=((117, 480, 510), (117, 520, 560)), atacar=((211, 520, 560), (298, 520, 570))),
    'aprendiz': dict(folha='corpo-aprendiz.png', parado=(46, 260), andar=([143, 244, 344, 443, 543], 480),
                     dano=((649, 0, 160), (649, 170, 320))),
    'hanbok': dict(folha='corpo-hanbok.png', parado=(44, 340), andar=([141, 242, 342, 442, 541], 560),
                   dano=((648, 0, 160), (648, 170, 340))),
}

# personagem: corpo, cabeça (folha, linha), Marinha tingida de azul, ataque
TRIPULACAO = {
    # pirata-capitao: corpo gerado por IA (ia_importar.py)
    'pirata-espadachim': ('samurai', ('cabecas-4.png', 1), False, 'atacar'),
    'pirata-lutador': ('monge', ('cabecas-1.png', 8), False, 'atacar'),
    'pirata-atiradora': ('pistoleiro', ('cabecas-6.png', 7), False, 'tiro'),
    'pirata-medico': ('verao', ('cabecas-3.png', 4), False, 'atacar'),
    'marinha-almirante': ('pistoleiro', ('cabecas-7.png', 4), True, 'atacar'),
    'marinha-oficial': ('samurai', ('cabecas-2.png', 4), True, 'atacar'),
    'marinha-soldado': ('aprendiz', ('cabecas-1.png', 0), False, None),
    'marinha-atirador': ('bandana', ('cabecas-5.png', 4), True, 'atacar'),
    'marinha-enfermeira': ('hanbok', ('cabecas-5.png', 1), False, None),
}


def personagem(pid, corpo, cab, marinha, ataque):
    c = CORPOS[corpo]
    a = carregar(c['folha'])
    if marinha:
        a = tingir(a)
    k = c['folha'] + ('-m' if marinha else '')
    cabs = cabecas(*cab)
    y, x1 = c['parado']
    parado = janela(a, k, y, 0, x1)[:5]
    # pescoço da pose parada em cada direção (molde para achar nos outros quadros)
    ref = [pescoco_parado(p) for p in parado]
    ys, x1 = c['andar']
    andar = [janela(a, k, yy, 0, x1)[:8] for yy in ys]
    anims = {'parado': {}, 'andar': {}, 'correr': {}}
    for i, d in enumerate(DIRS):
        esp = espelho if d in ('SE', 'E', 'NE') else (lambda im: im)
        anims['parado'][d] = [esp(montar(parado[i], cabs[i], ref[i]))]
        anims['andar'][d] = [esp(montar(q, cabs[i], ref[i])) for q in andar[i]]
        anims['correr'][d] = anims['andar'][d]
    tempos = {'atacar': {'fps': 9, 'impacto': 3}, 'dano': {'fps': 7}}
    # 2 direções: frente (olhando para a esquerda, 3/4) e costas
    for nome, chave in (('dano', 'dano'), ('atacar', ataque)):
        if not chave or chave not in c:
            continue
        (yf, xf0, xf1), (yc, xc0, xc1) = c[chave]
        fr = janela(a, k, yf, xf0, xf1)
        co = janela(a, k, yc, xc0, xc1)
        if not fr or not co:
            print('  sem', nome, pid)
            continue
        mf = [montar(q, cabs[1], ref[1], 'pe') for q in fr]
        mc = [montar(q, cabs[3], ref[3], 'pe') for q in co]
        anims[nome] = {'S': mf, 'SE': [espelho(q) for q in mf], 'E': [espelho(q) for q in mf], 'NE': [espelho(q) for q in mc], 'N': mc}
        if nome == 'atacar':
            tempos['atacar']['impacto'] = max(1, len(fr) // 2)
    gravar(pid, anims, tempos, 0.82, FONTE)
    print(pid, {n: len(v['S']) for n, v in anims.items()})


# ------------------------------------------------------------------ monstros (formas)

def monstro(pid, folha, janelas, densidade, tempos):
    """monstro de 2 direções (frente olhando para a esquerda e costas)"""
    a = carregar(folha)
    anims = {}
    for nome, ((yf, xf0, xf1), (yc, xc0, xc1)) in janelas.items():
        fr = janela(a, folha, yf, xf0, xf1, tol=40)
        co = janela(a, folha, yc, xc0, xc1, tol=40)

        def q(im):
            out = np.zeros((A * 2, L * 2, 4), np.uint8)
            im = aparar(im)
            pintar(out, im, L - im.shape[1] // 2, 2 * PE[1] - im.shape[0])
            return out

        mf = [q(i) for i in fr]
        mc = [q(i) for i in co] or mf
        anims[nome] = {'S': mf, 'SE': [espelho(x) for x in mf], 'E': [espelho(x) for x in mf], 'NE': [espelho(x) for x in mc], 'N': mc}
    D = os.path.join(SPR, pid)
    os.makedirs(D, exist_ok=True)
    man = {}
    for nome, por in anims.items():
        man[nome] = {}
        for d, qs in por.items():
            arq = f'{nome}_{d}.png'
            cv2.imwrite(os.path.join(D, arq), np.hstack(qs))
            man[nome][d] = {'arquivo': arq, 'quadros': len(qs)}
    alt = max(aparar(x).shape[0] for x in anims['parado']['S'])
    json.dump({'quadro': [L * 2, A * 2], 'pe': [L, 2 * PE[1]], 'altura': alt, 'densidade': densidade, 'tempos': tempos,
               'fonte': FONTE, 'anims': man}, open(os.path.join(D, 'manifesto.json'), 'w'), indent=1)
    print(pid, {n: len(v['S']) for n, v in anims.items()})


# ------------------------------------------------------------------ efeitos

def efeito(nome, quadros, fps, largura, chao=False, tempos=None):
    qs = [aparar(q) for q in quadros if q[..., 3].max() > 20]
    W = max(q.shape[1] for q in qs) + 4
    H = max(q.shape[0] for q in qs) + 4
    tira = []
    for q in qs:
        c = np.zeros((H, W, 4), np.uint8)
        y = H - q.shape[0] - 2 if chao else (H - q.shape[0]) // 2
        pintar(c, q, (W - q.shape[1]) // 2, y)
        tira.append(c)
    D = os.path.join(SPR, 'efeitos', nome)
    os.makedirs(D, exist_ok=True)
    cv2.imwrite(os.path.join(D, 'S.png'), np.hstack(tira))
    man = {'quadro': [W, H], 'quadros': len(tira), 'fps': fps, 'direcoes': ['S'], 'modo': 'unico', 'largura': largura,
           'centro': [0.5, 0.03 if chao else 0.5], 'fonte': FONTE}
    if tempos:
        man['tempos'] = tempos
    json.dump(man, open(os.path.join(D, 'manifesto.json'), 'w'), indent=1)
    print('efeito', nome, len(tira), (W, H))


def celulas(a, y0, y1, xs, meia):
    return [a[y0:y1, max(0, x - meia):x + meia].copy() for x in xs]


if __name__ == '__main__':
    for pid, (corpo, cab, mar, atk) in TRIPULACAO.items():
        personagem(pid, corpo, cab, mar, atk)

    # Zoan do Lobo: forma híbrida = lobisomem
    monstro('ro-lobisomem', 'lobisomem.png', {
        'parado': ((55, 0, 300), (56, 350, 700)),
        'andar': ((185, 0, 380), (187, 400, 800)),
        'atacar': ((345, 0, 700), (510, 0, 700)),
        'dano': ((655, 0, 200), (650, 280, 470)),
    }, 0.78, {'atacar': {'fps': 9, 'impacto': 3}, 'dano': {'fps': 6}, 'parado': {'fps': 5}})
    # Mera Mera: Corpo de Chamas = Agni (espírito de fogo)
    monstro('ro-agni', 'agni.png', {
        'parado': ((100, 0, 640), (300, 0, 640)),
        'andar': ((100, 0, 640), (300, 0, 640)),
        'atacar': ((484, 0, 640), (657, 0, 640)),
        'dano': ((845, 0, 200), (1225, 0, 200)),
    }, 1.15, {'atacar': {'fps': 9, 'impacto': 3}, 'dano': {'fps': 6}, 'parado': {'fps': 7}, 'andar': {'fps': 7}})

    # efeitos
    pf = carregar_preto('cao-fogo.png')
    efeito('pilar-fogo', celulas(pf, 1590, 1800, [74, 191, 301, 417, 542, 668, 801, 943], 50), 12, 1.6, chao=True)
    vr = carregar('fx-varios.png')
    efeito('tremor', janela(vr, 'vr', 996, 0, 650), 10, 2.4, chao=True,
           tempos=[0.07, 0.08, 0.1, 0.25, 0.45])
    efeito('nuvem-veneno', janela(vr, 'vr', 772, 0, 600, tol=12), 12, 1.8)
    ft = carregar('fx-fumaca-terra.png')
    efeito('anel-poeira', celulas(ft, 25, 120, [58, 184, 334, 485, 618, 768, 920], 72), 14, 2.6, chao=True)
    efeito('explosao-terra', janela(ft, 'ft', 212, 0, 650, tol=20), 12, 1.6, chao=True)
    # chamas com pedaços soltos (anel, faíscas): junta tudo de cada quadro (dilata mais)
    fr = carregar('fx-fogo-roxo.png')
    efeito('fogo-roxo', janela(fr, 'fr', 95, 250, 1100, tol=70, dil=16, minarea=300)
           + janela(fr, 'fr', 270, 200, 1100, tol=70, dil=16, minarea=300), 12, 1.6, chao=True)
    fa = carregar('fx-fogo-azul.png')
    efeito('fogo-azul', janela(fa, 'fa', 100, 0, 900, tol=70, dil=16, minarea=300)
           + janela(fa, 'fa', 340, 0, 900, tol=70, dil=16, minarea=300)
           + janela(fa, 'fa', 570, 0, 900, tol=70, dil=16, minarea=300), 12, 1.6, chao=True)
    ga = carregar('fx-garra.png')
    efeito('garra', janela(ga, 'ga', 44, 0, 400, tol=10), 10, 1.0)
    es = carregar('armas-espada.png')
    efeito('corte-arco', janela(es, 'es', 1462, 0, 340, tol=12), 16, 1.6)
    al = carregar_preto('fx-alfa.png')
    efeito('estrela-gelo', celulas(al, 1366, 1436, [435, 506, 584, 654], 36), 12, 0.9)
