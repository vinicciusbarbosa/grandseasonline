"""
Haki de armamento (Busoshoku) sobre os ataques já importados: gera
atacar-haki_<DIR>.png com a lâmina negra (brilho roxo/vermelho no fio), o
braço da espada endurecido (mão e antebraço negros e lustrosos) e faíscas
vermelhas estalando em volta — sem precisar redesenhar a animação.

    python3 frontend/scripts/sprites/haki_armamento.py almirante [DIR ...]

Registra no manifesto como variante "haki" do atacar (o jogo usa quando o
Haki de armamento está ligado).
"""
import json
import math
import os
import random
import sys

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def cores(q):
    al = q[..., 3] > 0
    r, g, b = (q[..., i].astype(int) for i in range(3))
    return al, r, g, b


def ouro(q):
    al, r, g, b = cores(q)
    return al & (r > 150) & (g > 100) & (b < 120) & (r > b + 60)


def guarda_na_mao(q):
    """Peças douradas encostadas numa mão (pele pequena — o rosto, a maior
    peça de pele, não conta: senão a dragona no ombro vira "guarda")."""
    al, r, g, b = cores(q)
    pele = al & (r > 180) & (g > 120) & (b > 80) & (r > b + 30) & (r - g < 90)
    gd = ouro(q)
    pele &= ~gd
    ns, rs, ss, _ = cv2.connectedComponentsWithStats(pele.astype(np.uint8), connectivity=8)
    if ns > 1:
        rosto = 1 + int(np.argmax(ss[1:, cv2.CC_STAT_AREA]))
        if ss[rosto, cv2.CC_STAT_AREA] >= 500:
            pele &= rs != rosto
    n, rot, st, _ = cv2.connectedComponentsWithStats(gd.astype(np.uint8), connectivity=8)
    pele_d = cv2.dilate(pele.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    m = np.zeros_like(al)
    for i in range(1, n):
        c = rot == i
        # guarda é compacta (o debrum dourado do casaco é comprido)
        compacta = max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) <= 45
        if compacta and (c & pele_d).sum() >= 4 and st[i, cv2.CC_STAT_AREA] < 900:
            m |= c
    return m


def lamina(q, minimo=55, fino_min=3.5):
    """Lâmina: peça prateada fina e comprida que sai de uma guarda segurada
    pela mão e se afasta dela. Devolve (máscara da lâmina, guarda usada)."""
    al, r, g, b = cores(q)
    vazio = np.zeros_like(al)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    prata = al & (mx - mn < 70) & (mx > 105)
    escuro = al & (mx < 95)
    gm = guarda_na_mao(q)
    if not gm.any():
        return vazio, vazio
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    grosso = cv2.morphologyEx(prata.astype(np.uint8), cv2.MORPH_OPEN, k) > 0
    grosso = cv2.dilate(grosso.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    fino = prata & ~grosso
    ng, rg, _, _ = cv2.connectedComponentsWithStats(gm.astype(np.uint8), connectivity=8)
    n, rot, st, _ = cv2.connectedComponentsWithStats(fino.astype(np.uint8), connectivity=8)
    # cada guarda candidata junta as peças finas e compridas que saem dela;
    # a espada é a guarda com a lâmina mais longa (as outras são dragonas,
    # botões e debruns dourados encostados na pele)
    melhor, m, guarda = 0, vazio.copy(), vazio.copy()
    for gi in range(1, ng):
        gc = rg == gi
        gy, gx = np.nonzero(gc)
        cx, cy = gx.mean(), gy.mean()
        perto = cv2.dilate(gc.astype(np.uint8), np.ones((13, 13), np.uint8)) > 0
        mg, alcance = vazio.copy(), 0
        for i in range(1, n):
            comp = rot == i
            if st[i, cv2.CC_STAT_AREA] < 60 or not (comp & perto).any():
                continue
            ys, xs = np.nonzero(comp)
            longe = np.hypot(xs - cx, ys - cy).max()
            pts = np.stack([xs, ys], 1).astype(np.float32)
            pts -= pts.mean(0)
            ev = np.linalg.eigvalsh(np.cov(pts.T))
            comprido = math.sqrt(max(ev[1], 1e-6)) / math.sqrt(max(ev[0], 1e-6))
            # aço tem um tom azulado; o branco do casaco é neutro
            azulado = (b[comp] - r[comp]).mean() > 9
            if comprido > fino_min and longe > minimo and azulado:
                mg |= comp
                alcance = max(alcance, longe)
        if alcance > melhor:
            melhor, m, guarda = alcance, mg, gc
    if m.any():
        m |= (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & escuro
    return m, guarda


def pintar_lamina(q, m):
    al, r, g, b = cores(q)
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
    out = q.copy()
    # corpo negro com leve tom roxo; realce onde era claro (o fio), em vermelho-roxo
    base = np.stack([10 + 22 * lum, 6 + 10 * lum, 16 + 34 * lum], -1)
    brilho = np.clip((lum - 0.82) / 0.18, 0, 1)[..., None] * 0.9
    fio = np.array([205, 150, 255])
    cor = base * (1 - brilho) + fio * brilho
    out[m, :3] = np.clip(cor[m], 0, 255).astype(np.uint8)
    # contorno vermelho fino por fora (o "vapor" do haki)
    borda = (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~m & ~al
    out[borda] = (96, 30, 170, 255)
    return out


def braco(q, guarda, ml, alcance=None):
    """Mão que segura a guarda (só a peça de pele encostada nela) e o
    antebraço: manga azul ligada à mão, até ~24 px dela. Ignora o rosto
    (peça de pele grande ou no alto da figura)."""
    al, r, g, b = cores(q)
    vazio = np.zeros_like(al)
    if not guarda.any():
        return vazio, None
    pele = al & (r > 180) & (g > 120) & (b > 80) & (r > b + 30) & (r - g < 90) & ~guarda
    n, rot, st, _ = cv2.connectedComponentsWithStats(pele.astype(np.uint8), connectivity=8)
    rosto = max(range(1, n), key=lambda i: st[i, cv2.CC_STAT_AREA]) if n > 1 else -1
    if rosto > 0 and st[rosto, cv2.CC_STAT_AREA] < 500:
        rosto = -1
    gd = cv2.dilate(guarda.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    mao = vazio.copy()
    for i in range(1, n):
        c = rot == i
        if i != rosto and (c & gd).any() and st[i, cv2.CC_STAT_AREA] < 500:
            mao |= c
    if not mao.any():
        return vazio, None
    # antebraço: cresce a partir da mão por dentro da figura (distância
    # geodésica), pela manga azul, punho branco/dourado e contorno — até perto
    # do cotovelo. Não entra na lâmina, na guarda nem no rosto.
    face = (rot == rosto) if rosto > 0 else vazio
    manga = (b > r + 20) & (b > 70)
    punho = (np.minimum(np.minimum(r, g), b) > 170) | ouro(q)
    contorno = np.maximum(np.maximum(r, g), b) < 80
    # branco (manga do casaco, chapéu) só colado na mão: o chapéu e o casaco
    # são brancos como a manga e o braço vazaria para eles
    livre = al & ~ml & ~guarda & ~face & (manga | punho | contorno | pele)
    # cabeça fora (o chapéu é branco como a manga): elipse em volta do cabelo
    mx_, mn_ = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    cabelo = al & (mx_ < 125) & (mx_ > 35) & (mx_ - mn_ < 40)
    nc, rc, sc, cc = cv2.connectedComponentsWithStats(cabelo.astype(np.uint8), connectivity=8)
    if nc > 1:
        i = 1 + int(np.argmax(sc[1:, cv2.CC_STAT_AREA]))
        if sc[i, cv2.CC_STAT_AREA] > 300:
            hx, hy = cc[i]
            yy0, xx0 = np.mgrid[:al.shape[0], :al.shape[1]]
            livre &= ((xx0 - hx) / 52.0) ** 2 + ((yy0 - hy + 22) / 60.0) ** 2 > 1
    # o antebraço sai da mão para o lado contrário da lâmina: o que fica do
    # lado da lâmina (calça, paletó na frente do golpe) não é braço
    yy, xx = np.mgrid[:al.shape[0], :al.shape[1]]
    my, mx = [v.mean() for v in np.nonzero(mao)]
    ly, lx = [v.mean() for v in np.nonzero(ml)]
    v = np.array([lx - mx, ly - my])
    v /= np.hypot(*v) or 1
    livre &= ((xx - mx) * v[0] + (yy - my) * v[1]) < 8
    dist = np.full(al.shape, 999.0, np.float32)
    dist[mao] = 0
    feito = mao.copy()
    k = np.ones((3, 3), np.uint8)
    alcance = alcance or ALCANCE_BRACO
    for passo in range(1, alcance + 1):
        novo = (cv2.dilate(feito.astype(np.uint8), k) > 0) & livre & ~feito
        if not novo.any():
            break
        dist[novo] = passo
        feito |= novo
    return feito, (dist + (ALCANCE_BRACO - alcance),)


ALCANCE_BRACO = 42


def pintar_braco(q, m, dist):
    """Braço endurecido como no anime: preto lustroso com reflexo roxo onde
    a luz batia e contorno de aura roxa; some em degradê perto do cotovelo."""
    al, r, g, b = cores(q)
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
    out = q.astype(np.float32)
    f = np.clip(1 - (dist - (ALCANCE_BRACO - 12)) / 12, 0, 1)
    negro = np.stack([8 + 22 * lum, 5 + 10 * lum, 14 + 30 * lum], -1)
    reflexo = np.clip((lum - 0.78) / 0.22, 0, 1)[..., None] * np.array([96, 44, 160])
    alvo = np.clip(negro + reflexo, 0, 255)
    mix = out[..., :3] * (1 - f[..., None]) + alvo * f[..., None]
    out[m, :3] = mix[m]
    # aura: contorno roxo por fora do braço (onde está vazio)
    duro = m & (f > 0.4)
    borda = (cv2.dilate(duro.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~al
    out[borda] = (132, 60, 230, 200)
    borda1 = (cv2.dilate(duro.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~al
    out[borda1] = (170, 100, 255, 235)
    return out.astype(np.uint8)


def faiscas(q, m, semente):
    """Raiozinhos vermelho-escuros estalando em volta da lâmina."""
    ys, xs = np.nonzero(m)
    if len(ys) < 20:
        return q
    rnd = random.Random(semente)
    img = Image.fromarray(q)
    cam = Image.new('RGBA', img.size, (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(cam)
    for _ in range(rnd.randint(1, 2)):
        i = rnd.randrange(len(xs))
        x, y = float(xs[i]), float(ys[i])
        pts = [(x, y)]
        ang = rnd.uniform(0, 2 * math.pi)
        for _ in range(rnd.randint(3, 5)):
            ang += rnd.uniform(-1.1, 1.1)
            passo = rnd.uniform(5, 11)
            x += math.cos(ang) * passo
            y += math.sin(ang) * passo
            pts.append((x, y))
        d.line(pts, fill=(34, 6, 52, 255), width=3)
        d.line(pts, fill=(200, 110, 255, 255), width=1)
    img.alpha_composite(cam)
    return np.asarray(img)


def eixo(ml, guarda):
    """Linha central da lâmina, da guarda até a ponta (pontos a cada ~3 px)."""
    ys, xs = np.nonzero(ml)
    gy, gx = np.nonzero(guarda)
    cx, cy = (gx.mean(), gy.mean()) if len(gx) else (xs.mean(), ys.mean())
    d = np.hypot(xs - cx, ys - cy)
    pts = []
    for a in np.arange(d.min(), d.max() + 3, 3):
        sel = (d >= a) & (d < a + 3)
        if sel.sum() >= 2:
            pts.append((xs[sel].mean(), ys[sel].mean()))
    if len(pts) < 4:
        return None
    p = np.array(pts)
    # suaviza (média móvel) sem encolher as pontas
    q = p.copy()
    for i in range(1, len(p) - 1):
        q[i] = p[max(0, i - 2):i + 3].mean(0)
    return q


SS = 4  # superamostragem dos traços (curvas lisas, borda recortada no fim)


def _fita(d, pts, larg, cor):
    """Traço de largura variável (um círculo + trapézio por segmento)."""
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        w0, w1 = larg[i] / 2, larg[i + 1] / 2
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        d.polygon([(x0 + nx * w0, y0 + ny * w0), (x1 + nx * w1, y1 + ny * w1),
                   (x1 - nx * w1, y1 - ny * w1), (x0 - nx * w0, y0 - ny * w0)], fill=cor)
        d.ellipse([x1 - w1, y1 - w1, x1 + w1, y1 + w1], fill=cor)
    x, y = pts[0]
    d.ellipse([x - larg[0] / 2, y - larg[0] / 2, x + larg[0] / 2, y + larg[0] / 2], fill=cor)


def _desenhar(W, H, pinta):
    """Desenha em SS× e reduz: cor média onde a cobertura passa de metade."""
    from PIL import ImageDraw
    img = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    pinta(ImageDraw.Draw(img))
    a = np.asarray(img).astype(np.float32)
    a = a.reshape(H, SS, W, SS, 4)
    alfa = a[..., 3].mean((1, 3))
    rgb = (a[..., :3] * a[..., 3:4]).sum((1, 3)) / np.maximum(a[..., 3].sum((1, 3)), 1)[..., None]
    return rgb, alfa > 127


def _cobertura(W, H, pinta):
    """Desenha em SS× e devolve a cobertura (0–1) de cada pixel."""
    from PIL import ImageDraw
    img = Image.new('L', (W * SS, H * SS), 0)
    pinta(ImageDraw.Draw(img))
    a = np.asarray(img).astype(np.float32) / 255.0
    return a.reshape(H, SS, W, SS).mean((1, 3))


def espiral(q, ml, guarda, fase, semente=0, esc=1.0):
    """Haki do anime como AURA: energia negra enrolando e girando na lâmina
    (fios que se partem e tremulam), labaredas negras de borda roxa saindo
    dela, faíscas e um brilho roxo difuso e translúcido em volta.
    O jogo mostra pixels com alfa ≥ 0.5 (misturando), então o brilho usa
    alfa entre 0.5 e 0.9 no vazio e clareia o que está por baixo no corpo.
    `esc`: tamanho do efeito (1 = lâmina do almirante, ~200 px)."""
    e = eixo(ml, guarda)
    if e is None:
        return q
    tg = e[-1] - e[-3]
    tg /= np.hypot(*tg) or 1
    e = np.vstack([e, e[-1] + tg * 5 * esc, e[-1] + tg * 10 * esc])
    seg = np.diff(e, axis=0)
    comp = np.hypot(seg[:, 0], seg[:, 1]) + 1e-6
    s = np.r_[0, np.cumsum(comp)]
    L = s[-1]
    tang = np.vstack([seg / comp[:, None], seg[-1:] / comp[-1]])
    norm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    t = s / max(L, 1)
    envol = np.clip(np.minimum((t - 0.04) * 6, (1.0 - t) * 6), 0, 1) ** 0.7
    rnd = random.Random(semente)
    H, W = q.shape[:2]

    # --- fios de energia: espiral que se parte em trechos e afina nas pontas
    trechos = []
    for k in range(3):
        ang = s / (50.0 * esc) * 2 * np.pi + fase * (1 + 0.15 * k) + k * 2 * np.pi / 3
        amp = ((7.5 + 2.5 * np.sin(s / (17 * esc) + fase * 2 + k)) * envol + 1) * esc
        pts = e + norm * (amp * np.sin(ang))[:, None]
        prof = np.cos(ang)
        # liga/desliga ao longo do fio (tremula a cada quadro)
        ligado = np.sin(s / (9.0 * esc) - fase * 3.1 + k * 2.3) + 0.5 * np.sin(s / (4.3 * esc) + fase * 5 + k) > -0.35
        i = 0
        while i < len(pts) - 1:
            if not ligado[i]:
                i += 1
                continue
            j = i
            while j < len(pts) - 1 and ligado[j]:
                j += 1
            if j - i >= 2:
                u = np.linspace(0, np.pi, j - i + 1)
                larg = esc * (1.5 + 4.8 * np.sin(u)) * (0.6 + 0.4 * (prof[i:j + 1] > 0)) * (0.4 + 0.6 * envol[i:j + 1])
                trechos.append((pts[i:j + 1], larg, prof[i:j + 1].mean() > 0))
            i = j + 1

    # --- labaredas: línguas afinando que saem da lâmina para os lados
    chamas = []
    for _ in range(rnd.randint(8, 12)):
        i = rnd.randrange(max(1, len(e) // 6), len(e))
        lado = rnd.choice((-1, 1))
        p = e[i].copy()
        d = norm[i] * lado * 0.8 + tang[i] * rnd.uniform(-0.2, 0.7)
        d /= np.hypot(*d) or 1
        tam = rnd.uniform(10, 22) * (0.5 + 0.5 * envol[i]) * esc
        pts, larg = [], []
        n = 7
        for j in range(n):
            pts.append(p.copy())
            larg.append((5.5 * (1 - j / (n - 1)) ** 1.2 + 0.4) * esc)
            ang = math.atan2(d[1], d[0]) + math.sin(j * 0.9 + fase * 2 + i) * 0.5
            d = np.array([math.cos(ang), math.sin(ang)])
            p = p + d * tam / n
        chamas.append((np.array(pts), np.array(larg)))

    def riscar(lista, extra, so_frente=None):
        def pinta(d):
            for pts, larg, *fr in lista:
                if so_frente is not None and fr and fr[0] != so_frente:
                    continue
                _fita(d, [tuple(p * SS) for p in pts], [(w + extra) * SS for w in larg], 255)
        return pinta

    nucleo_f = _cobertura(W, H, riscar(trechos, 0, True))
    borda_f = _cobertura(W, H, riscar(trechos, 2.2 * max(esc, 0.5), True))
    nucleo_t = _cobertura(W, H, riscar(trechos, 0, False))
    chama_n = _cobertura(W, H, riscar(chamas, 0))
    chama_b = _cobertura(W, H, riscar(chamas, 2.0 * max(esc, 0.5)))

    out = q.astype(np.float32)
    al = q[..., 3] > 0
    # brilho difuso: blur da lâmina + energia
    fonte = np.maximum(ml.astype(np.float32), np.maximum(borda_f, chama_b))
    brilho = cv2.GaussianBlur(fonte, (0, 0), 5.5 * max(esc, 0.45)) * 2.1
    brilho = np.clip(brilho, 0, 1)
    cor_brilho = np.array([150, 70, 255], np.float32)
    # no corpo: clareia em roxo
    k = (brilho * 0.55)[..., None] * (al & ~ml)[..., None]
    out[..., :3] = out[..., :3] * (1 - k) + cor_brilho * k
    # no vazio: aura translúcida (alfa 0.5–0.85), com um pontilhado na franja
    yy, xx = np.mgrid[:H, :W]
    vazio = ~al
    forte = vazio & (brilho > 0.22)
    franja = vazio & (brilho > 0.12) & (brilho <= 0.22) & ((xx + yy + int(fase * 7)) % 2 == 0)
    tom = np.clip((brilho - 0.12) / 0.6, 0, 1)[..., None]
    cor = np.array([70, 20, 140], np.float32) * (1 - tom) + np.array([176, 104, 255], np.float32) * tom
    for m, a0 in ((forte, 150), (franja, 132)):
        out[m, :3] = cor[m]
        out[m, 3] = np.clip(a0 + tom[m, 0] * 90, 0, 225)

    def por(cob, rgb, lim=0.45, somente_fora=None):
        m = cob > lim
        if somente_fora is not None:
            m &= ~somente_fora
        out[m, :3] = rgb
        out[m, 3] = 255

    # energia de trás (só fora da lâmina), labaredas, energia da frente
    por(nucleo_t, (40, 10, 72), somente_fora=ml)
    por(chama_b, (132, 60, 230))
    por(chama_n, (14, 4, 24))
    por(borda_f, (150, 76, 245))
    por(nucleo_f, (8, 2, 14))
    # miolo quente: um filete lilás no meio dos trechos mais grossos da frente
    miolo = cv2.erode((nucleo_f > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0 if esc > 0.6 else np.zeros(q.shape[:2], bool)
    out[miolo, :3] = (52, 16, 92)
    # faíscas: pontinhos claros soltos em volta
    ys, xs = np.nonzero(borda_f > 0.3)
    for _ in range(min(len(ys), 10)):
        i = rnd.randrange(len(ys))
        y, x = ys[i] + rnd.randint(-8, 8) * esc, xs[i] + rnd.randint(-8, 8) * esc
        y, x = int(y), int(x)
        if 0 <= y < H - 1 and 0 <= x < W - 1:
            out[y:y + 2, x:x + 2] = (225, 190, 255, 255)
    return np.clip(out, 0, 255).astype(np.uint8)


# quadros (1..12) com a espada fora da bainha em todos os ataques
QUADROS_LAMINA = range(3, 11)
# golpe com o braço longe do corpo: endurece até o cotovelo (nos outros a
# mão está no quadril e o braço se confundiria com o casaco)
QUADROS_BRACO = range(4, 10)


def gerar(personagem, direcoes=None):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    man = json.load(open(os.path.join(pasta, 'manifesto.json')))
    Q = man['quadro'][0]
    ataques = man['anims'].get('atacar', {})
    for d in direcoes or list(ataques):
        e = ataques.get(d)
        if not e:
            continue
        T = np.asarray(Image.open(os.path.join(pasta, e['arquivo'])).convert('RGBA'))
        n = T.shape[1] // Q
        quadros, achou = [], 0
        for i in range(n):
            q = T[:, i * Q:(i + 1) * Q].copy()
            ml, gd = lamina(q) if (i + 1) in QUADROS_LAMINA else (np.zeros(q.shape[:2], bool),) * 2
            if (i + 1) in QUADROS_LAMINA and ml.sum() <= 80:
                # golpe: a lâmina aparece curta (em perspectiva) — critério mais frouxo
                ml, gd = lamina(q, 28, 2.5)
            if ml.sum() > 40:
                achou += 1
                mb, info = braco(q, gd, ml, ALCANCE_BRACO if (i + 1) in QUADROS_BRACO else 14)
                if info is not None:
                    q = pintar_braco(q, mb, info[0])
                q = pintar_lamina(q, ml)
                q = espiral(q, ml, gd, i * 1.9, hash((d, i)) & 0xffff)
            quadros.append(q)
        nome = f'atacar-haki_{d}.png'
        Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
        e.setdefault('variantes', {})['haki'] = {'arquivo': nome, 'quadros': n}
        print(f'{personagem} atacar {d}: lâmina achada em {achou}/{n} quadros')
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)


if __name__ == '__main__':
    gerar(sys.argv[1], sys.argv[2:] or None)
