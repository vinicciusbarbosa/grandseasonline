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
    """Peças douradas encostadas na pele (a guarda que a mão segura)."""
    al, r, g, b = cores(q)
    pele = al & (r > 180) & (g > 120) & (b > 80) & (r > b + 30) & (r - g < 90)
    gd = ouro(q)
    n, rot, st, _ = cv2.connectedComponentsWithStats(gd.astype(np.uint8), connectivity=8)
    pele_d = cv2.dilate(pele.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    m = np.zeros_like(al)
    for i in range(1, n):
        c = rot == i
        if (c & pele_d).sum() >= 4 and st[i, cv2.CC_STAT_AREA] < 900:
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
            if comprido > fino_min and longe > minimo:
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
    brilho = np.clip((lum - 0.85) / 0.15, 0, 1)[..., None] * 0.8
    fio = np.array([170, 60, 170])
    cor = base * (1 - brilho) + fio * brilho
    out[m, :3] = np.clip(cor[m], 0, 255).astype(np.uint8)
    # contorno vermelho fino por fora (o "vapor" do haki)
    borda = (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~m & ~al
    out[borda] = (150, 10, 40, 255)
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
    for _ in range(rnd.randint(3, 5)):
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
        d.line(pts, fill=(120, 0, 25, 255), width=3)
        d.line(pts, fill=(255, 60, 90, 255), width=1)
    img.alpha_composite(cam)
    return np.asarray(img)


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
                q = faiscas(q, ml, hash((d, i)) & 0xffff)
            quadros.append(q)
        nome = f'atacar-haki_{d}.png'
        Image.fromarray(np.concatenate(quadros, axis=1)).save(os.path.join(pasta, nome), optimize=True)
        e.setdefault('variantes', {})['haki'] = {'arquivo': nome, 'quadros': n}
        print(f'{personagem} atacar {d}: lâmina achada em {achou}/{n} quadros')
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)


if __name__ == '__main__':
    gerar(sys.argv[1], sys.argv[2:] or None)
