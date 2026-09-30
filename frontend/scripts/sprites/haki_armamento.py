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


def braco(q, guarda, ml):
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
    dist = cv2.distanceTransform((~mao).astype(np.uint8), cv2.DIST_L2, 5)
    manga = al & (b > r + 20) & (b > 90) & (dist < 24)
    n2, rot2, _, _ = cv2.connectedComponentsWithStats((manga | mao).astype(np.uint8), connectivity=8)
    ids = set(np.unique(rot2[mao])) - {0}
    m = np.isin(rot2, list(ids)) & (manga | mao)
    escuro = al & (np.maximum(np.maximum(r, g), b) < 80)
    m |= (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & escuro & (dist < 26)
    return m, (dist + 0.0,)


def pintar_braco(q, m, dist):
    al, r, g, b = cores(q)
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
    out = q.copy()
    # perto da mão: negro total; mais longe: vai sumindo (o haki "subindo" o braço)
    f = np.clip(1 - (dist - 14) / 18, 0, 1)
    negro = np.stack([16 + 38 * lum, 12 + 22 * lum, 22 + 46 * lum], -1)
    brilho = np.clip((lum - 0.75) / 0.25, 0, 1)[..., None] * np.array([90, 25, 80])
    alvo = np.clip(negro + brilho, 0, 255)
    mix = out[..., :3] * (1 - f[..., None]) + alvo * f[..., None]
    out[m, :3] = mix[m].astype(np.uint8)
    return out


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


def espiral(q, ml, guarda, fase, semente=0):
    """Haki do anime: fios negros enrolando e girando em volta da lâmina, com
    borda roxa, brilho e fiapos que escapam. Pixels opacos (o jogo corta
    alfa < 0.5)."""
    e = eixo(ml, guarda)
    if e is None:
        return q
    # a espiral passa um pouco da ponta (o Haki "escorre" da lâmina)
    tg = e[-1] - e[-3]
    tg /= np.hypot(*tg) or 1
    e = np.vstack([e, e[-1] + tg * 4, e[-1] + tg * 8, e[-1] + tg * 12])
    seg = np.diff(e, axis=0)
    comp = np.hypot(seg[:, 0], seg[:, 1]) + 1e-6
    s = np.r_[0, np.cumsum(comp)]
    L = s[-1]
    tang = np.vstack([seg / comp[:, None], seg[-1:] / comp[-1]])
    norm = np.stack([-tang[:, 1], tang[:, 0]], 1)
    t = s / max(L, 1)
    envol = np.clip(np.minimum((t - 0.04) * 6, (1.0 - t) * 7), 0, 1) ** 0.7
    fios = []
    for k in range(2):
        ang = s / 56.0 * 2 * np.pi + fase + k * np.pi
        amp = 9.5 * envol + 1.5
        pts = (e + norm * (amp * np.sin(ang))[:, None]) * SS
        prof = np.cos(ang)
        larg = (5.4 + 2.6 * prof) * (0.35 + 0.65 * envol) * SS
        fios.append((pts, prof, larg))
    rnd = random.Random(semente)
    # fiapos: pedacinhos de fio que se soltam da lâmina e se enrolam
    fiapos = []
    for _ in range(3):
        i = rnd.randrange(len(e) // 5, len(e))
        lado = rnd.choice((-1, 1))
        p = e[i] + norm[i] * lado * 9
        a0 = math.atan2(norm[i][1] * lado, norm[i][0] * lado) + rnd.uniform(-0.6, 0.6)
        pts, larg = [], []
        for j in range(9):
            a0 += rnd.uniform(0.2, 0.55) * lado
            p = p + np.array([math.cos(a0), math.sin(a0)]) * 2.4
            pts.append(p * SS)
            larg.append((3.2 - j * 0.3) * SS)
        fiapos.append((pts, larg))
    H, W = q.shape[:2]
    ESCURO, BORDA, LUZ = (8, 3, 14, 255), (92, 34, 170, 255), (206, 150, 255, 255)

    def tras(d):
        for pts, prof, larg in fios:
            for i in range(len(pts) - 1):
                if prof[i] <= 0:
                    _fita(d, pts[i:i + 2], [larg[i] + 2 * SS, larg[i + 1] + 2 * SS], BORDA)
                    _fita(d, pts[i:i + 2], larg[i:i + 2], (34, 10, 58, 255))

    def frente(d):
        for pts, larg in fiapos:
            _fita(d, pts, [w + 2 * SS for w in larg], BORDA)
            _fita(d, pts, larg, ESCURO)
        for pts, prof, larg in fios:
            for i in range(len(pts) - 1):
                if prof[i] > 0:
                    _fita(d, pts[i:i + 2], [larg[i] + 2.4 * SS, larg[i + 1] + 2.4 * SS], BORDA)
            for i in range(len(pts) - 1):
                if prof[i] > 0:
                    _fita(d, pts[i:i + 2], larg[i:i + 2], ESCURO)
            # brilho: filete claro no meio do fio, só onde ele está mais "de frente"
            for i in range(len(pts) - 1):
                if prof[i] > 0.35:
                    dx, dy = pts[i + 1] - pts[i]
                    n = math.hypot(dx, dy) or 1
                    off = np.array([dy, -dx]) / n * larg[i] * 0.22
                    w = SS * (0.8 + 0.8 * prof[i])
                    _fita(d, [pts[i] + off, pts[i + 1] + off], [w, w], LUZ)

    rgb_t, m_t = _desenhar(W, H, tras)
    rgb_f, m_f = _desenhar(W, H, frente)
    out = q.copy()
    al = out[..., 3] > 0
    tudo = ml | m_t | m_f
    # aura roxa em degradê em volta de tudo (só no vazio, não pinta o corpo)
    dist = cv2.distanceTransform((~tudo).astype(np.uint8), cv2.DIST_L2, 5)
    for lim, cor in ((4.6, (54, 16, 100)), (3.2, (96, 36, 180)), (1.8, (158, 86, 240))):
        anel = (dist > 0) & (dist <= lim) & ~al
        out[anel] = (*cor, 255)
    m = m_t & ~ml
    out[m, :3] = rgb_t[m].astype(np.uint8)
    out[m, 3] = 255
    out[m_f, :3] = rgb_f[m_f].astype(np.uint8)
    out[m_f, 3] = 255
    return out


# quadros (1..12) com a espada fora da bainha em todos os ataques
QUADROS_LAMINA = range(3, 11)


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
                mb, info = braco(q, gd, ml)
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
