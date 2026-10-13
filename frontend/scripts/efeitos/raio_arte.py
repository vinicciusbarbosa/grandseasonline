"""
Arte do dragão de trovão (Sango) e dos raios, desenhada por código: curvas
suaves (Catmull-Rom), traços que afinam, sombreamento de anime em 4 tons de
azul/ciano, contorno branco, acentos violeta e olhos dourados. Desenha em
dobro do tamanho e reduz (bordas lisas).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# paleta
NAVY = (10, 28, 86)
AZUL = (24, 96, 210)
CIANO = (64, 206, 255)
CLARO = (175, 242, 255)
BRANCO = (248, 255, 255)
VIOLETA = (150, 105, 255)
OURO = (255, 228, 120)


def catmull(pts, n=10, fechado=True):
    """curva suave passando pelos pontos; ponto (x, y, 1) = quina viva"""
    P = [np.array(p[:2], float) for p in pts]
    viva = [len(p) > 2 and p[2] for p in pts]
    m = len(P)
    out = []
    for i in range(m if fechado else m - 1):
        p0, p1, p2, p3 = P[(i - 1) % m], P[i], P[(i + 1) % m], P[(i + 2) % m]
        if not fechado:
            p0 = P[max(i - 1, 0)]
            p3 = P[min(i + 2, m - 1)]
        if viva[i]:
            p0 = p1 - (p2 - p1)
        if viva[(i + 1) % m]:
            p3 = p2 + (p2 - p1)
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(tuple(q))
    if not fechado:
        out.append(tuple(P[-1]))
    return out


def traco(pts, w0, w1, n=12):
    """traço que afina de w0 a w1 ao longo da curva (vira um polígono)"""
    c = np.array(catmull(pts, n, fechado=False))
    tan = np.gradient(c, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True) + 1e-9
    nor = np.stack([-tan[:, 1], tan[:, 0]], 1)
    w = np.linspace(w0, w1, len(c))[:, None] / 2
    a = c + nor * w
    b = c - nor * w
    return [tuple(p) for p in np.concatenate([a, b[::-1]])]


class Tela:
    """desenho em escala (coordenadas de projeto 0..1000, saída n×n)"""

    def __init__(self, n=1024, ss=2):
        self.n, self.ss = n, ss
        self.k = n * ss / 1000
        self.img = Image.new('RGBA', (n * ss, n * ss), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def p(self, pts):
        return [(x * self.k, y * self.k) for x, y in pts]

    def poli(self, pts, cor, linha=None, larg=0):
        q = self.p(pts)
        self.d.polygon(q, fill=cor)
        if linha:
            self.d.line(q + [q[0]], fill=linha, width=max(1, int(larg * self.k)), joint='curve')

    def linha(self, pts, cor, larg):
        self.d.line(self.p(pts), fill=cor, width=max(1, int(larg * self.k)), joint='curve')

    def elipse(self, cx, cy, rx, ry, cor):
        k = self.k
        self.d.ellipse(((cx - rx) * k, (cy - ry) * k, (cx + rx) * k, (cy + ry) * k), fill=cor)

    def pronto(self):
        return self.img.resize((self.n, self.n), Image.LANCZOS)


def espelho(pts):
    return [(1000 - p[0], p[1]) + tuple(p[2:]) for p in pts]


def brilho_atras(img, cor, raio, forca=0.85):
    """halo colorido atrás do desenho"""
    h = img.filter(ImageFilter.GaussianBlur(raio))
    a = np.asarray(h).astype(np.float32)
    a[..., :3] = np.array(cor, np.float32)
    a[..., 3] = np.clip(a[..., 3] * forca * 1.4, 0, 255)
    out = Image.fromarray(a.astype(np.uint8), 'RGBA')
    out.alpha_composite(img)
    return out


# ------------------------------------------------------------ cabeça
def chama(cx, cy, ang, r0, r1, larg, curva):
    """língua de chama pontuda saindo de (cx, cy) na direção ang (graus)"""
    a = np.radians(ang)
    d = np.array([np.cos(a), np.sin(a)])
    nrm = np.array([-d[1], d[0]])
    base = np.array([cx, cy]) + d * r0
    ponta = np.array([cx, cy]) + d * r1 + nrm * curva
    meio = (base + ponta) / 2 + nrm * curva * 0.6
    return [tuple(base + nrm * larg), tuple(meio + nrm * larg * 0.35), tuple(ponta) + (1,), tuple(meio - nrm * larg * 0.25), tuple(base - nrm * larg)]


def cabeca(n=1024):
    T = Tela(n)
    W, L = BRANCO + (255,), 9  # contorno
    rng = np.random.default_rng(5)
    # --- juba em 3 camadas (fundo azul-escuro, azul, ciano), pontas curvas
    for camada, (cor, r1, larg) in enumerate([(AZUL + (245,), 480, 135), (CIANO + (250,), 425, 110), (CLARO + (250,), 360, 85)]):
        for ang in np.linspace(150, 390, 11 - camada * 2):
            if 245 < ang % 360 < 295 and camada == 0:
                continue  # o meio de cima fica para os chifres
            curva = 85 * np.sign(np.cos(np.radians(ang))) * (1 - camada * 0.25)
            pts = chama(500, 470, ang + rng.uniform(-6, 6), 160, r1 + rng.uniform(-30, 30), larg, curva)
            T.poli(catmull(pts, 8), cor, W, 5)
    # --- chifres: par grande para trás e par menor
    for pts, w0, cor in [([(420, 300), (360, 190), (250, 110), (150, 40)], 62, CLARO), ([(385, 330), (300, 280), (210, 250), (130, 245)], 42, CIANO)]:
        for lado in (pts, espelho(pts)):
            forma = traco(lado, w0, 4)
            T.poli(forma, cor + (255,), W, 6)
            # sombra num lado do chifre
            meio = traco(lado, w0 * 0.45, 2)
            T.poli(meio, AZUL + (200,))
            # anéis
            c = catmull(lado, 10, fechado=False)
            for t in range(6, len(c) - 4, 5):
                x, y = c[t]
                T.linha([(x - w0 * 0.25, y - w0 * 0.15), (x + w0 * 0.25, y + w0 * 0.15)], NAVY + (220,), 4)
    # --- crânio (silhueta), barbatanas das bochechas
    cranio = [(500, 255), (600, 270, 1), (650, 330), (700, 400), (760, 440, 1), (705, 470), (690, 540), (640, 600), (590, 640), (500, 655),
              (410, 640), (360, 600), (310, 540), (295, 470), (240, 440, 1), (300, 400), (350, 330), (400, 270, 1)]
    T.poli(catmull(cranio, 10), CIANO + (255,), W, L)
    # sombra lateral e de baixo (tom azul), luz no meio (claro)
    for lado in (False, True):
        s = [(330, 440), (360, 520), (420, 610), (470, 640), (420, 560), (380, 470)]
        T.poli(catmull(espelho(s) if lado else s, 8), AZUL + (220,))
    T.poli(catmull([(500, 290), (560, 330), (545, 470), (520, 560), (500, 590), (480, 560), (455, 470), (440, 330)], 8), CLARO + (230,))
    # escamas na testa e no focinho
    for y0, nx, r in [(330, 4, 22), (370, 5, 20), (420, 4, 18), (470, 3, 16)]:
        for i in range(nx):
            x = 500 + (i - (nx - 1) / 2) * r * 1.9
            T.d.arc([(x - r) * T.k, (y0 - r * 0.7) * T.k, (x + r) * T.k, (y0 + r * 0.7) * T.k], 20, 160, fill=AZUL + (230,), width=int(3 * T.k))
    # --- sobrancelhas pesadas com espinhos
    sob = [(330, 365), (380, 310), (420, 300, 1), (440, 265), (465, 320), (480, 350), (420, 345)]
    for s in (sob, espelho(sob)):
        T.poli(catmull(s, 8), AZUL + (255,), W, 6)
    # --- olhos dourados com pupila em fenda e brilho
    olho = [(375, 380), (420, 360), (470, 372, 1), (455, 398), (400, 404)]
    for o in (olho, espelho(olho)):
        T.poli(catmull(o, 8), OURO + (255,), W, 5)
    for cx in (430, 570):
        T.elipse(cx, 383, 7, 17, NAVY + (255,))
        T.elipse(cx - 9 if cx < 500 else cx + 9, 375, 5, 5, BRANCO + (255,))
    # --- focinho: narinas e rugas
    for x in (468, 532):
        T.elipse(x, 575, 12, 7, NAVY + (255,))
        T.elipse(x, 572, 5, 3, CIANO + (255,))
    for s in ([(400, 470), (430, 520), (445, 560)], [(372, 520), (400, 580)]):
        T.linha(catmull(s, 6, fechado=False), W, 4)
        T.linha(catmull(espelho(s), 6, fechado=False), W, 4)
    # --- boca aberta: céu da boca escuro, língua violeta, presas e dentes
    boca = [(385, 610), (440, 640), (500, 648), (560, 640), (615, 610, 1), (585, 700), (545, 770), (500, 790), (455, 770), (415, 700)]
    T.poli(catmull(boca, 8), NAVY + (255,), W, 7)
    T.poli(catmull([(445, 720), (500, 700), (555, 720), (530, 770), (500, 780), (470, 770)], 8), VIOLETA + (255,))
    T.linha([(500, 705), (500, 770)], (90, 60, 190, 255), 4)
    for x in np.linspace(420, 580, 7):
        T.poli([(x - 11, 628 + abs(x - 500) * -0.12), (x + 11, 628 + abs(x - 500) * -0.12), (x, 662)], W)
    for x in np.linspace(440, 560, 5):
        T.poli([(x - 9, 770 - abs(x - 500) * 0.4), (x + 9, 770 - abs(x - 500) * 0.4), (x, 742)], W)
    for x, s in ((405, 1), (595, -1)):
        T.poli([(x - 14 * s, 612), (x + 10 * s, 616), (x + 6 * s, 712)], W, BRANCO + (255,), 2)
    # --- mandíbula e barba de chamas
    # barba de chamas (atrás do queixo), depois o queixo
    for ang, r1 in ((90, 300), (72, 250), (108, 250), (58, 190), (122, 190)):
        T.poli(catmull(chama(500, 740, ang, 40, r1, 46, 40 * np.cos(np.radians(ang))), 8), CIANO + (245,), W, 5)
    queixo = [(410, 745), (455, 790), (500, 800), (545, 790), (590, 745), (560, 830), (500, 860), (440, 830)]
    T.poli(catmull(queixo, 8), AZUL + (255,), W, L)
    # --- bigodes longos, afinando
    for b in ([(430, 600), (330, 640), (220, 700), (150, 820), (170, 940)], [(440, 615), (360, 700), (300, 800)]):
        T.poli(traco(b, 16, 2), W)
        T.poli(traco(espelho(b), 16, 2), W)
    img = T.pronto()
    img = brilho_atras(img, VIOLETA, 26, 0.55)
    return brilho_atras(img, CIANO, 12, 0.9)


# ------------------------------------------------------------ corpo, raios, faíscas
def corpo(n=256):
    """faixa do corpo (repete ao longo): escamas em arco, barriga clara, borda branca e veios elétricos"""
    T = Tela(n, 2)
    u0, u1 = 70, 930  # largura útil
    # degradê lateral: azul nas bordas, ciano, claro no meio
    for i, (cor, a, b) in enumerate([(AZUL, u0, u1), (CIANO, 170, 830), (CLARO, 330, 670)]):
        T.poli([(a, 0), (b, 0), (b, 1000), (a, 1000)], cor + (235,))
    # escamas: fileiras de arcos (meia-lua) que se repetem ao longo
    for linha, y in enumerate(range(-60, 1100, 125)):
        off = 0 if linha % 2 else 70
        for x in range(u0 + off, u1, 140):
            T.d.arc([(x - 70) * T.k, (y - 60) * T.k, (x + 70) * T.k, (y + 70) * T.k], 200, 340, fill=NAVY + (210,), width=int(5 * T.k))
            T.d.arc([(x - 60) * T.k, (y - 46) * T.k, (x + 60) * T.k, (y + 58) * T.k], 215, 325, fill=BRANCO + (160,), width=int(3 * T.k))
    # veios elétricos violeta ao longo
    rng = np.random.default_rng(3)
    for x0 in (300, 700):
        pts, x = [], x0
        for y in range(0, 1001, 50):
            pts.append((x, y))
            x = np.clip(x + rng.uniform(-50, 50), u0 + 60, u1 - 60)
        T.linha(pts, VIOLETA + (230,), 6)
    # contorno branco das bordas
    T.poli([(u0 - 26, 0), (u0 + 4, 0), (u0 + 4, 1000), (u0 - 26, 1000)], BRANCO + (255,))
    T.poli([(u1 - 4, 0), (u1 + 26, 0), (u1 + 26, 1000), (u1 - 4, 1000)], BRANCO + (255,))
    return T.pronto()


def halo(n=128, cor=CIANO):
    u = np.linspace(-1, 1, n)[None, :] * np.ones((n, 1))
    a = np.clip(1 - np.abs(u), 0, 1) ** 1.6
    c = np.array(cor, float) / 255
    img = np.dstack([np.full_like(u, c[0]), np.full_like(u, c[1]), np.full_like(u, c[2]), a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def brilho(n=128, cor=(0.75, 1.0, 1.0)):
    y, x = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1
    r = np.sqrt(x * x + y * y)
    a = np.clip(1 - r, 0, 1) ** 2.2
    core = np.clip(1 - r * 3, 0, 1)
    img = np.dstack([np.clip(cor[0] + core, 0, 1), np.clip(cor[1] + core, 0, 1), np.clip(cor[2] + core, 0, 1), a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def estrela(n=128):
    """faísca em cruz (os pontinhos brilhando da imagem)"""
    y, x = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1
    a = np.clip(1 - np.abs(x) * 9, 0, 1) * np.clip(1 - np.abs(y), 0, 1) + np.clip(1 - np.abs(y) * 9, 0, 1) * np.clip(1 - np.abs(x), 0, 1)
    a = np.clip(a + np.clip(1 - np.sqrt(x * x + y * y) * 3, 0, 1), 0, 1)
    img = np.dstack([np.full_like(a, 0.85), np.ones_like(a), np.ones_like(a), a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def relampago(n=512, cor=CIANO, semente=1, galhos=4):
    """raio ramificado (deslocamento do ponto médio): halo colorido, meio claro, miolo branco"""
    rng = np.random.default_rng(semente)

    def raio(a, b, desvio, nivel):
        if nivel == 0:
            return [a, b]
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + rng.uniform(-desvio, desvio))
        return raio(a, m, desvio / 2, nivel - 1)[:-1] + raio(m, b, desvio / 2, nivel - 1)
    tronco = raio((20, 500), (980, 500), 260, 6)
    ramos = []
    for _ in range(galhos):
        i = rng.integers(8, len(tronco) - 12)
        a = tronco[i]
        b = (a[0] + rng.uniform(150, 320), a[1] + rng.uniform(-220, 220))
        ramos.append(raio(a, b, 90, 4))
    T = Tela(n, 2)
    for pts, w in [(tronco, 1.0)] + [(r, 0.55) for r in ramos]:
        T.linha(pts, cor + (255,), 26 * w)
    img = T.pronto().filter(ImageFilter.GaussianBlur(n / 60))
    T2 = Tela(n, 2)
    for pts, w in [(tronco, 1.0)] + [(r, 0.55) for r in ramos]:
        T2.linha(pts, CLARO + (255,), 10 * w)
        T2.linha(pts, BRANCO + (255,), 4 * w)
    img.alpha_composite(T2.pronto())
    return img


def crista(n=256):
    """barbatana dorsal em chamas: 3 tons, contorno branco"""
    T = Tela(n, 2)
    rng = np.random.default_rng(8)
    for cor, alt, larg in [(AZUL, 1.0, 1.0), (CIANO, 0.75, 0.7), (CLARO, 0.45, 0.4)]:
        pts = [(60, 950)]
        x = 60
        while x < 900:
            w = rng.uniform(110, 170)
            pts.append((x + w * 0.55, 950 - alt * rng.uniform(600, 880), 1))
            x += w
            pts.append((x, 950 - alt * rng.uniform(150, 300)))
        pts.append((940, 950, 1))
        T.poli(catmull(pts, 6), cor + (240,), BRANCO + (255,), 7)
    return T.pronto()


def rachadura(n=512):
    """rachaduras elétricas no chão (vistas de cima), saindo do centro"""
    rng = np.random.default_rng(12)
    T = Tela(n, 2)
    for ang in np.linspace(0, 360, 9, endpoint=False) + rng.uniform(-15, 15, 9):
        pts, x, y = [(500, 500)], 500, 500
        a = np.radians(ang)
        for k in range(8):
            a += rng.uniform(-0.5, 0.5)
            x, y = x + np.cos(a) * 55, y + np.sin(a) * 55
            pts.append((x, y))
        T.linha(pts, CIANO + (255,), 18)
        T.linha(pts, BRANCO + (255,), 6)
    img = T.pronto()
    return brilho_atras(img, (40, 120, 255), 10, 0.7)


# ------------------------------------------------------------ versão "energia" (como a referência)
def serrilha(pts, faixas, rng, alt=(30, 70), passo=6, puxa=(-0.6, 0.0)):
    """contorno fechado com pontas de chama nas faixas (frações 0..1 do contorno):
    a cada `passo` pontos sai uma ponta para fora, puxada para trás (`puxa`)"""
    P = np.array(pts, float)
    c = P.mean(0)
    out = []
    m = len(P)
    for i, q in enumerate(P):
        out.append(tuple(q))
        f = i / m
        if i % passo == passo // 2 and any(f0 <= f < f1 for f0, f1 in faixas):
            nrm = q - c
            nrm /= np.linalg.norm(nrm) + 1e-9
            h = rng.uniform(*alt)
            ponta = q + nrm * h + np.array(puxa) * h
            out.append(tuple(ponta))
    return out


def faiscas(T, rng, caixa, n, cor=BRANCO):
    """pontinhos de luz espalhados (o 'pó' de eletricidade da referência)"""
    x0, y0, x1, y1 = caixa
    for _ in range(n):
        r = rng.uniform(1.5, 4.5)
        T.elipse(rng.uniform(x0, x1), rng.uniform(y0, y1), r, r, cor + (int(rng.uniform(70, 170)),))


def contorno_unico(img, larg=4, cor=BRANCO, dentro=None):
    """contorno branco em volta da silhueta inteira (as partes se fundem numa
    forma só, como no desenho da referência). `dentro`: camada extra (riscos,
    faíscas) recortada para ficar só dentro da silhueta."""
    a = img.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    borda = Image.fromarray(np.clip(np.asarray(a.filter(ImageFilter.MaxFilter(larg * 2 + 1)), np.int16)
                                    - np.asarray(a.filter(ImageFilter.MinFilter(3)), np.int16), 0, 255).astype(np.uint8))
    if dentro is not None:
        d = np.asarray(dentro).copy()
        d[..., 3] = np.minimum(d[..., 3], np.asarray(a.filter(ImageFilter.MinFilter(larg * 2 + 1))))
        img.alpha_composite(Image.fromarray(d, 'RGBA'))
    linha = Image.new('RGBA', img.size, cor + (0,))
    linha.putalpha(borda.filter(ImageFilter.GaussianBlur(0.6)))
    img.alpha_composite(linha)
    return img


def cabeca_energia(n=1024):
    """cabeça do dragão de raio como a referência: uma silhueta só, ciano de um
    tom, contorno branco fino, bordas em labaredas, boca fechada, só a lasca de
    luz do olho; sem juba. De perfil (focinho para a direita, um pouco para
    baixo); o jogo espelha quando o alvo está à esquerda."""
    T = Tela(n)
    FILL = (70, 215, 250, 225)
    rng = np.random.default_rng(4)
    # labaredas largas que saem da nuca, da sobrancelha e de baixo do queixo
    for cx, cy, ang, r0, r1, larg, curva in [
        (560, 330, 235, 0, 230, 34, -40), (520, 340, 215, 0, 200, 30, -30),   # pontas da sobrancelha (chifres)
        (400, 360, 200, 20, 260, 46, -40), (340, 420, 185, 20, 270, 50, -30), (320, 500, 165, 20, 240, 46, 30),
        (380, 590, 140, 10, 210, 42, 40),                                       # nuca
        (520, 640, 115, 10, 230, 40, 30), (640, 630, 100, 10, 290, 46, 25), (740, 600, 85, 10, 200, 34, 20),  # barba
        (700, 400, 250, 0, 120, 26, -20), (820, 445, 255, 0, 90, 20, -15),    # cristas do focinho
    ]:
        T.poli(catmull(chama(cx, cy, ang + rng.uniform(-4, 4), r0, r1, larg, curva), 8), FILL)
    # cabeça: crânio, sobrancelha marcada, focinho longo, nariz e queixo (boca fechada)
    base = [(300, 440), (380, 350), (480, 330), (560, 300, 1), (600, 372), (720, 402), (850, 442), (900, 470, 1), (925, 522, 1), (880, 545),
            (800, 552, 1), (840, 578, 1), (760, 612), (640, 640), (520, 660), (420, 620), (330, 540)]
    T.poli(catmull(base, 10), FILL)
    img = T.pronto()
    # por dentro: o lado de longe mais escuro, riscos e pó de luz (recortados na silhueta)
    D = Tela(n)
    D.poli(catmull([(500, 600), (640, 580), (780, 556), (860, 552), (770, 590), (650, 625), (540, 645)], 8), (25, 160, 230, 110))
    D.linha([(918, 528), (850, 548), (790, 552), (700, 572), (630, 595)], BRANCO + (240,), 5)   # boca fechada
    D.linha([(880, 478), (760, 440), (640, 418)], BRANCO + (190,), 4)                            # sulco do focinho
    for q in ([(420, 380), (470, 420)], [(390, 470), (450, 505)], [(460, 560), (520, 595)], [(560, 340), (590, 390)],
              [(700, 425), (745, 440)], [(620, 600), (600, 690)], [(360, 430), (300, 420)]):
        D.linha(q, BRANCO + (190,), 4)
    D.poli(traco([(555, 425), (610, 412), (670, 428)], 28, 2, 8), BRANCO + (255,))               # lasca de luz do olho
    faiscas(D, rng, (250, 200, 950, 950), 260)
    img = contorno_unico(img, 3, dentro=D.pronto())
    img = brilho_atras(img, (40, 120, 255), 26, 0.55)
    return brilho_atras(img, CIANO, 10, 0.8)


def corpo_energia(n=256):
    """faixa do corpo como a referência: ciano de um tom, contorno branco fino,
    alguns riscos brancos curtos e pó de luz"""
    T = Tela(n, 2)
    u0, u1 = 90, 910
    rng = np.random.default_rng(6)
    T.poli([(u0, 0), (u1, 0), (u1, 1000), (u0, 1000)], (70, 215, 250, 215))
    T.poli([(u0, 0), (u0 + 230, 0), (u0 + 230, 1000), (u0, 1000)], (30, 170, 235, 215))
    for y in range(40, 1000, 160):
        x = rng.uniform(300, 700)
        T.linha([(x, y), (x + rng.uniform(-40, 40), y + 90)], BRANCO + (170,), 9)
    faiscas(T, rng, (u0, 0, u1, 1000), 50)
    T.poli([(u0 - 22, 0), (u0 + 2, 0), (u0 + 2, 1000), (u0 - 22, 1000)], BRANCO + (255,))
    T.poli([(u1 - 2, 0), (u1 + 22, 0), (u1 + 22, 1000), (u1 - 2, 1000)], BRANCO + (255,))
    return T.pronto()


def crista_energia(n=256):
    """labaredas de energia na borda do corpo: um tom ciano translúcido, contorno branco"""
    T = Tela(n, 2)
    rng = np.random.default_rng(8)
    pts = [(60, 950)]
    x = 60
    while x < 900:
        w = rng.uniform(110, 170)
        pts.append((x + w * 0.55, 950 - rng.uniform(600, 880), 1))
        x += w
        pts.append((x, 950 - rng.uniform(150, 300)))
    pts.append((940, 950, 1))
    T.poli(catmull(pts, 6), (70, 215, 250, 215), BRANCO + (255,), 5)
    return T.pronto()


# ------------------------------------------------------------ versão anime (cartoon, cores vivas)
CIANO_VIVO = (40, 225, 255)
AZUL_VIVO = (25, 110, 255)
LUZ = (205, 252, 255)


def estrela4(T, cx, cy, R, r, cor, giro=0.0):
    """estrela de 4 pontas (a chispa de anime)"""
    pts = []
    for k in range(8):
        a = np.radians(giro + k * 45)
        d = R if k % 2 == 0 else r
        pts.append((cx + np.cos(a) * d, cy + np.sin(a) * d))
    T.poli(pts, cor)


def zigue(rng, a, b, n=7, amp=22):
    """linha de raio quebrada de a até b"""
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    nrm = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
    pts = [tuple(a)]
    for t in np.linspace(0, 1, n)[1:-1]:
        pts.append(tuple(a + d * t + nrm * rng.uniform(-amp, amp)))
    pts.append(tuple(b))
    return pts


def cabeca_anime(n=1024):
    """a ponta do dragão-rajada: sem cabeça desenhada, só a frente do corpo um
    pouco mais larga e arredondada (como cobra), nas cores do corpo, e o olho
    é uma aura de raio fluindo para trás. A ponta esquerda some no corpo.
    Focinho para a direita: o jogo gira o sprite para onde o dragão anda.
    Escala: o sprite tem 8 unidades e o corpo 3.8 de largura (~475 aqui)."""
    T = Tela(n)
    rng = np.random.default_rng(11)
    forma = [(0, 262), (300, 255), (560, 225), (760, 250), (880, 330), (915, 420), (920, 500), (915, 580), (880, 670), (760, 750),
             (560, 775), (300, 745), (0, 738)]
    T.poli(catmull(forma, 12), CIANO_VIVO + (235,))
    img = T.pronto()
    D = Tela(n)
    D.poli(catmull([(0, 600), (300, 610), (560, 640), (760, 620), (900, 560), (880, 670), (760, 750), (560, 775), (300, 745), (0, 738)], 8),
           AZUL_VIVO + (200,))
    D.poli(catmull([(0, 340), (300, 330), (560, 310), (760, 330), (870, 390), (850, 410), (740, 370), (560, 360), (300, 380), (0, 390)], 8),
           LUZ + (220,))
    for k in range(3):   # raios estalando por cima
        y = rng.uniform(380, 640)
        D.linha(zigue(rng, (rng.uniform(0, 200), y), (rng.uniform(600, 880), y + rng.uniform(-80, 80)), 8, 30), BRANCO + (230,), 5)
    faiscas(D, rng, (0, 230, 920, 770), 120)
    img = contorno_unico(img, 5, dentro=D.pronto())
    # olho: aura de raio (brilho + labaredas de luz e arcos fluindo para trás)
    O = Tela(n)
    ex, ey = 700, 420
    for k in range(7):
        comp = rng.uniform(300, 520)
        sobe = rng.uniform(-170, 10)
        pts = [(ex - 10 - t * comp, ey + sobe * t ** 1.3 + 22 * np.sin(t * 6 + k)) for t in np.linspace(0, 1, 12)]
        O.poli(traco(pts, rng.uniform(30, 50), 2, 8), (BRANCO if k % 3 == 0 else CIANO_VIVO) + (235,))
    for k in range(4):
        O.linha(zigue(rng, (ex - 20, ey), (ex - 320 - k * 40, ey - 150 + k * 50), 8, 24), BRANCO + (255,), 7 - k)
    O.elipse(ex, ey, 50, 24, LUZ + (255,))
    O.elipse(ex + 5, ey, 30, 13, BRANCO + (255,))
    olho = brilho_atras(O.pronto(), CIANO_VIVO, 26, 1.0)
    img.alpha_composite(brilho_atras(olho, BRANCO, 8, 0.9))
    img = brilho_atras(img, AZUL_VIVO, 40, 0.75)
    img = brilho_atras(img, CIANO_VIVO, 14, 0.95)
    # a ponta de trás some no corpo (sem corte nem contorno)
    a = np.asarray(img).copy()
    rampa = np.clip(np.arange(n) / (n * 0.22), 0, 1)
    a[..., 3] = (a[..., 3] * rampa[None, :]).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def corpo_anime(n=256):
    """faixa do corpo: cel-shading em 3 tons vivos, contorno branco, pó de luz"""
    T = Tela(n, 2)
    u0, u1 = 90, 910
    rng = np.random.default_rng(6)
    T.poli([(u0, 0), (u1, 0), (u1, 1000), (u0, 1000)], CIANO_VIVO + (235,))
    T.poli([(u0, 0), (u0 + 250, 0), (u0 + 250, 1000), (u0, 1000)], AZUL_VIVO + (220,))
    T.poli([(560, 0), (700, 0), (700, 1000), (560, 1000)], LUZ + (210,))
    for y in range(40, 1000, 200):
        x = rng.uniform(380, 520)
        T.linha([(x, y), (x + rng.uniform(-30, 30), y + 80)], BRANCO + (170,), 9)
    faiscas(T, rng, (u0, 0, u1, 1000), 40)
    T.poli([(u0 - 24, 0), (u0 + 2, 0), (u0 + 2, 1000), (u0 - 24, 1000)], BRANCO + (255,))
    T.poli([(u1 - 2, 0), (u1 + 24, 0), (u1 + 24, 1000), (u1 - 2, 1000)], BRANCO + (255,))
    return T.pronto()


def crista_anime(n=256):
    T = Tela(n, 2)
    rng = np.random.default_rng(8)
    pts = [(60, 950)]
    x = 60
    while x < 900:
        w = rng.uniform(110, 170)
        pts.append((x + w * 0.55, 950 - rng.uniform(600, 880), 1))
        x += w
        pts.append((x, 950 - rng.uniform(150, 300)))
    pts.append((940, 950, 1))
    T.poli(catmull(pts, 6), CIANO_VIVO + (235,), BRANCO + (255,), 5)
    return brilho_atras(T.pronto(), CIANO_VIVO, 6, 0.9)


def aura(n=256):
    """aura de raio que flui ao longo do corpo (repete na vertical): fiapos
    ondulando e pequenos arcos, mais forte nas bordas"""
    T = Tela(n, 2)
    rng = np.random.default_rng(13)
    for k in range(14):
        x0 = rng.uniform(40, 960)
        amp, fase, per = rng.uniform(20, 60), rng.uniform(0, 6.3), int(rng.integers(1, 3))
        y0, y1 = sorted(rng.uniform(0, 1000, 2))
        pts = [(x0 + amp * np.sin(2 * np.pi * per * y / 1000 + fase), y) for y in np.linspace(y0, y0 + rng.uniform(250, 500), 12)]
        cor = (CIANO_VIVO if k % 3 else BRANCO) + (int(rng.uniform(150, 230)),)
        T.linha(pts, cor, rng.uniform(6, 14))
        T.linha([(x, y - 1000) for x, y in pts], cor, 8)  # o que passa de 1000 volta por cima
    for k in range(5):
        x, y = rng.uniform(80, 920), rng.uniform(80, 900)
        T.linha(zigue(rng, (x, y), (x + rng.uniform(-80, 80), y + rng.uniform(80, 160)), 5, 20), BRANCO + (255,), 6)
    img = T.pronto()
    return brilho_atras(img, CIANO_VIVO, 6, 0.9)
