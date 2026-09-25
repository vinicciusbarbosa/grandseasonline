"""Kit para modelar ilhas à mão: costa, relevo, materiais e objetos.

Cada ilha é um mapa de altura (em px do mundo) com um material por amostra e
uma lista de objetos (casas, moinhos, muralhas...). O gerador do mundo usa a
costa para a navegação (terra.png e a grade de bloqueio); a cena usa tudo
para montar a ilha em 3D (cena/ilhas3d).

Coordenadas: em CÉLULAS do recorte (40 px), como as docas do legado — é mais
fácil de pensar no mapa. Alturas em px do mundo.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

CELULA = 40
DESLOCAMENTO_ALTURA = 32  # a altura vai no PNG somada a isso, para caber o fundo abaixo do mar
ESCALA_ALTURA = 64  # 1/64 px de precisão

# Materiais (o mesmo índice em cena/ilhas3d/paleta.ts).
AREIA = 1
GRAMA = 2
FLORESTA = 3
ROCHA = 4
TERRA_BATIDA = 5
CALCADA = 6
LIXO = 7
CAMPO = 8
RIO = 9
CAMPINA = 10
POMAR = 11
PENHASCO = 12  # pedra de falésia: posto sozinho onde a encosta é íngreme


@dataclass
class Ilha:
    id: int
    nome: str
    # Caixa da ilha, em células do recorte.
    x0: float
    y0: float
    largura: float
    altura: float
    semente: int = 1
    passo: int = 4  # px do mundo por amostra
    objetos: list = field(default_factory=list)
    flutuante: bool = False  # Baratie: não é terra, é um navio parado
    vegetacao: dict = field(default_factory=dict)  # ex.: {"palmeiras": 0.05}
    bloqueio_extra: list = field(default_factory=list)  # células bloqueadas sem ser terra

    def __post_init__(self):
        self.px0 = self.x0 * CELULA
        self.py0 = self.y0 * CELULA
        self.nx = int(round(self.largura * CELULA / self.passo)) + 1
        self.ny = int(round(self.altura * CELULA / self.passo)) + 1
        self.rng = np.random.default_rng(self.semente)
        ys, xs = np.mgrid[0:self.ny, 0:self.nx]
        # Posição de cada amostra em células do recorte.
        self.cx = self.x0 + xs * self.passo / CELULA
        self.cy = self.y0 + ys * self.passo / CELULA
        self.forma = np.zeros((self.ny, self.nx), dtype=np.float32)  # 1 dentro, 0 fora (antes do ruído)
        self.h = np.zeros((self.ny, self.nx), dtype=np.float32)
        self.mat = np.full((self.ny, self.nx), GRAMA, dtype=np.uint8)
        self.terra = np.zeros((self.ny, self.nx), dtype=bool)
        self.costa = None  # distância (px) até a costa, positiva em terra

    # ---- utilidades ---------------------------------------------------------------

    def _grade(self, pontos):
        """Células do recorte → coordenadas da grade (float)."""
        return [((x - self.x0) * CELULA / self.passo, (y - self.y0) * CELULA / self.passo) for x, y in pontos]

    def mascara(self, pontos, suave: float = 0.0) -> np.ndarray:
        """Polígono (células) → máscara 0..1 na grade, com borda suavizada em px."""
        img = Image.new("L", (self.nx * 4, self.ny * 4), 0)
        ImageDraw.Draw(img).polygon([(x * 4, y * 4) for x, y in self._grade(pontos)], fill=255)
        m = np.asarray(img.resize((self.nx, self.ny), Image.BOX), dtype=np.float32) / 255
        if suave > 0:
            m = ndimage.gaussian_filter(m, suave / self.passo)
        return m

    def linha(self, pontos, largura_px: float, suave: float = 0.0) -> np.ndarray:
        img = Image.new("L", (self.nx * 4, self.ny * 4), 0)
        dr = ImageDraw.Draw(img)
        g = [(x * 4, y * 4) for x, y in self._grade(pontos)]
        w = max(1, int(round(largura_px / self.passo * 4)))
        dr.line(g, fill=255, width=w, joint="curve")
        for x, y in g:
            dr.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
        m = np.asarray(img.resize((self.nx, self.ny), Image.BOX), dtype=np.float32) / 255
        if suave > 0:
            m = ndimage.gaussian_filter(m, suave / self.passo)
        return m

    def circulo(self, cx, cy, raio_cel, suave: float = 0.0) -> np.ndarray:
        d = np.hypot(self.cx - cx, self.cy - cy) * CELULA
        r = raio_cel * CELULA
        if suave <= 0:
            return (d <= r).astype(np.float32)
        return np.clip((r - d) / suave + 0.5, 0, 1).astype(np.float32)

    def ruido(self, escala_px: float, oitavas: int = 4) -> np.ndarray:
        """fBm suave em -1..1 (soma de ruído branco borrado em várias escalas)."""
        total = np.zeros((self.ny, self.nx), dtype=np.float32)
        amp, soma = 1.0, 0.0
        s = escala_px / self.passo
        for _ in range(oitavas):
            r = ndimage.gaussian_filter(self.rng.standard_normal((self.ny, self.nx)).astype(np.float32), max(0.6, s), mode="wrap")
            r /= r.std() + 1e-6
            total += r * amp
            soma += amp
            amp *= 0.5
            s *= 0.5
        return total / soma / 2

    # ---- costa ------------------------------------------------------------------------

    def contorno(self, pontos, recorte_px: float = 14, escala_ruido: float = 70):
        """Soma um pedaço de terra (polígono em células) com a costa recortada."""
        self.forma = np.maximum(self.forma, self.mascara(pontos))

    def fechar_costa(self, recorte_px: float = 14, escala_ruido: float = 70):
        """Aplica o ruído na costa e calcula a distância até ela."""
        dentro = self.forma > 0.5
        dist = ndimage.distance_transform_edt(dentro) * self.passo - ndimage.distance_transform_edt(~dentro) * self.passo
        dist = ndimage.gaussian_filter(dist, 1.2) + self.ruido(escala_ruido, 4) * recorte_px
        self.terra = dist > 0
        # Tira ilhotas de ruído e buracos.
        rot, n = ndimage.label(self.terra)
        if n > 1:
            tam = ndimage.sum(self.terra, rot, range(1, n + 1))
            for i, t in enumerate(tam, start=1):
                if t < 60:
                    self.terra[rot == i] = False
        self.terra = ndimage.binary_fill_holes(self.terra)
        # A distância até a costa é o próprio campo suave (não o da máscara
        # binária, que sai em degraus de um passo): a linha d'água fica lisa.
        self.costa = np.where(self.terra, np.maximum(dist, 0.5), np.minimum(dist, -0.5)).astype(np.float32)

    # ---- relevo ------------------------------------------------------------------------

    def base(self, praia: float = 22, planalto: float = 14, subida: float = 0.22):
        """Praia baixa junto à costa e um planalto suave para dentro."""
        d = self.costa
        rampa = np.clip((d - praia) * subida, 0, None)
        h = np.where(d < praia, d * (2.2 / praia), 2.2 + planalto * (1 - np.exp(-rampa / max(planalto, 1))))
        # Abaixo do mar: continua com a mesma inclinação da praia (sem quina na
        # linha d'água, que serrilharia o recorte) e só depois afunda.
        h = np.where(d < 0, d * (2.2 / praia) + np.minimum(d + 10, 0) * 0.6, h)
        self.h = h.astype(np.float32) + np.where(d > praia, self.ruido(90, 3) * 2.0, 0)

    def falesia(self, pontos, altura: float, largura_px: float = 20, suave: float = 18):
        """Trecho de costa em penhasco: sobe quase a pique até `altura`."""
        m = self.mascara(pontos, suave)
        d = np.clip(self.costa, 0, None)
        alvo = altura * np.clip(d / largura_px, 0, 1) ** 0.6
        self.h = np.where(self.costa > 0, np.maximum(self.h, alvo * m + self.h * (1 - m)), self.h)

    def montanha(self, cx, cy, raio_cel, altura, aspereza: float = 0.35, alongar=(1.0, 1.0, 0.0)):
        """Pico gaussiano com cristas (ruído "ridged")."""
        sx, sy, ang = alongar
        dx = (self.cx - cx) * CELULA
        dy = (self.cy - cy) * CELULA
        c, s = math.cos(ang), math.sin(ang)
        u = (dx * c + dy * s) / sx
        v = (-dx * s + dy * c) / sy
        r = np.hypot(u, v) / (raio_cel * CELULA)
        forma = np.exp(-(r ** 2) * 2.2)
        cristas = 1 - np.abs(self.ruido(raio_cel * CELULA * 0.35, 4)) * 2
        pico = altura * forma * (1 - aspereza + aspereza * cristas)
        self.h = np.where(self.terra, self.h + pico * np.clip(self.costa / 30, 0, 1), self.h)

    def plato(self, pontos, altura: float | None = None, suave: float = 16):
        """Aplaina uma área (cidade, praça). Sem `altura`, usa a média de lá."""
        m = self.mascara(pontos, suave)
        if altura is None:
            dentro = m > 0.5
            altura = float(self.h[dentro].mean()) if dentro.any() else 4.0
        self.h = self.h * (1 - m) + altura * m
        return altura

    def plato_circular(self, cx, cy, raio_cel, altura=None, suave: float = 14):
        m = self.circulo(cx, cy, raio_cel, suave)
        if altura is None:
            altura = float(self.h[m > 0.5].mean()) if (m > 0.5).any() else 4.0
        self.h = self.h * (1 - m) + altura * m
        return altura

    def degraus(self, cx, cy, raios_alturas, suave: float = 8):
        """Patamares concêntricos (um morro com a cidade em anéis, como Goa)."""
        for raio, altura in raios_alturas:
            m = self.circulo(cx, cy, raio, suave)
            self.h = np.maximum(self.h, altura * m + self.h * (1 - m))

    def cavar(self, pontos, largura_px: float, profundidade: float, suave: float = 6):
        m = self.linha(pontos, largura_px, suave)
        self.h -= m * profundidade
        return m

    # ---- materiais ---------------------------------------------------------------------

    def pintar(self, mascara: np.ndarray, material: int, limiar: float = 0.5):
        self.mat[(mascara > limiar) & self.terra] = material

    def pintar_poligono(self, pontos, material: int, recorte: float = 0.0):
        m = self.mascara(pontos, 6)
        if recorte:
            m = m + self.ruido(40, 3) * recorte
        self.pintar(m, material)

    def estrada(self, pontos, largura_px: float = 7, material: int = TERRA_BATIDA, aplainar: bool = True):
        m = self.linha(pontos, largura_px)
        if aplainar:
            suave = ndimage.gaussian_filter(self.h, 2.0)
            mm = ndimage.gaussian_filter(m, 1.0)
            self.h = self.h * (1 - mm) + suave * mm
        self.pintar(m, material)

    def materiais_automaticos(self, praia: float = 18, rocha_acima: float | None = None):
        """Areia na beira, pedra nas encostas íngremes e (opcional) nos picos."""
        gy, gx = np.gradient(self.h, self.passo)
        inclinacao = np.hypot(gx, gy)
        areia = (self.costa < praia + self.ruido(30, 2) * 6) & (self.h < 5) & (self.mat != CALCADA) & (self.mat != RIO)
        self.mat[areia & self.terra] = AREIA
        if rocha_acima is not None:
            self.mat[(self.h > rocha_acima + self.ruido(40, 3) * 12) & self.terra & (self.mat != CALCADA)] = ROCHA
        # Encosta de pedra só onde é quase a pique; a mata aguenta mais inclinação.
        livre = self.terra & (self.mat != CALCADA)
        self.mat[(inclinacao > 1.5) & livre & (self.mat != FLORESTA)] = PENHASCO
        self.mat[(inclinacao > 2.6) & livre] = PENHASCO

    # ---- objetos -----------------------------------------------------------------------

    def obj(self, tipo: str, x: float, y: float, aplainar: float = 0.0, **params):
        """Objeto em (x, y) células. `aplainar` (células) nivela o chão embaixo."""
        if aplainar > 0:
            self.plato_circular(x, y, aplainar, suave=10)
        self.objetos.append({"t": tipo, "x": round(x * CELULA, 1), "y": round(y * CELULA, 1), **params})

    def pontos_px(self, pontos):
        return [[round(x * CELULA, 1), round(y * CELULA, 1)] for x, y in pontos]

    # ---- saída ---------------------------------------------------------------------------

    def exportar_png(self, caminho):
        v = np.clip((self.h + DESLOCAMENTO_ALTURA) * ESCALA_ALTURA, 0, 65535).astype(np.uint32)
        img = np.dstack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), self.mat, np.full(v.shape, 255, np.uint8)])
        Image.fromarray(img, "RGBA").save(caminho, optimize=True)

    def meta(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "x": self.px0,
            "y": self.py0,
            "passo": self.passo,
            "colunas": self.nx,
            "linhas": self.ny,
            "alturaMax": round(float(self.h.max()), 1),
            "flutuante": self.flutuante,
            "vegetacao": self.vegetacao,
            "objetos": self.objetos,
        }

    def terra_em(self, sub: int, x0_cel: int, y0_cel: int, largura_cel: int, altura_cel: int) -> np.ndarray:
        """Máscara de terra reamostrada para a grade visual do mundo (sub px por célula)."""
        ys, xs = np.mgrid[0:altura_cel * sub, 0:largura_cel * sub]
        # centro de cada pixel visual, em px do mundo
        px = (x0_cel + (xs + 0.5) / sub) * CELULA
        py = (y0_cel + (ys + 0.5) / sub) * CELULA
        gx = (px - self.px0) / self.passo
        gy = (py - self.py0) / self.passo
        h = ndimage.map_coordinates(self.h, [gy, gx], order=1, cval=-10)
        return h > 0


# ---- cidades -----------------------------------------------------------------------------

def _amostra(ilha: Ilha, x: float, y: float) -> float:
    gx = (x - ilha.x0) * CELULA / ilha.passo
    gy = (y - ilha.y0) * CELULA / ilha.passo
    return float(ndimage.map_coordinates(ilha.h, [[gy], [gx]], order=1, cval=-10)[0])


def _costa_em(ilha: Ilha, x: float, y: float) -> float:
    gx = (x - ilha.x0) * CELULA / ilha.passo
    gy = (y - ilha.y0) * CELULA / ilha.passo
    return float(ndimage.map_coordinates(ilha.costa, [[gy], [gx]], order=1, cval=-10)[0])


class Ocupacao:
    """Evita objetos sobrepostos: guarda círculos (x, y, raio) em células."""

    def __init__(self):
        self.circulos: list[tuple[float, float, float]] = []

    def livre(self, x, y, r):
        return all(math.hypot(x - a, y - b) > r + c for a, b, c in self.circulos)

    def ocupar(self, x, y, r):
        self.circulos.append((x, y, r))


def casas_na_rua(
    ilha: Ilha,
    ocupacao: Ocupacao,
    pontos,
    estilo: str,
    espaco: float = 0.72,
    recuo: float = 0.5,
    tamanho=(0.42, 0.62),
    andares=(1, 2),
    falhas: float = 0.12,
    lados=(1, -1),
    costa_min: float = 10,
    altura_max: float | None = None,
):
    """Casas enfileiradas dos dois lados de uma rua, de frente para ela."""
    rng = ilha.rng
    # Caminha pela polilinha em passos de `espaco` células.
    seg = []
    for (ax, ay), (bx, by) in zip(pontos, pontos[1:]):
        seg.append((ax, ay, bx, by, math.hypot(bx - ax, by - ay)))
    total = sum(s[4] for s in seg)
    d = espaco * 0.5
    while d < total:
        resto = d
        for ax, ay, bx, by, comp in seg:
            if resto <= comp:
                t = resto / comp
                x, y = ax + (bx - ax) * t, ay + (by - ay) * t
                ang = math.atan2(by - ay, bx - ax)
                break
            resto -= comp
        for lado in lados:
            if rng.random() < falhas:
                continue
            w = rng.uniform(*tamanho)
            p = rng.uniform(tamanho[0], tamanho[1] * 0.9)
            nx, ny = -math.sin(ang) * lado, math.cos(ang) * lado
            hx, hy = x + nx * (recuo + p / 2), y + ny * (recuo + p / 2)
            raio = max(w, p) * 0.55
            if not ocupacao.livre(hx, hy, raio):
                continue
            if _costa_em(ilha, hx, hy) < costa_min:
                continue
            chao = _amostra(ilha, hx, hy)
            if altura_max is not None and chao > altura_max:
                continue
            ocupacao.ocupar(hx, hy, raio)
            ilha.plato_circular(hx, hy, raio * 1.1, suave=6)
            nand = int(rng.integers(andares[0], andares[1] + 1))
            ilha.obj(
                "casa",
                hx,
                hy,
                r=round(ang + (math.pi / 2 if lado > 0 else -math.pi / 2), 3),
                w=round(w * CELULA, 1),
                d=round(p * CELULA, 1),
                h=round(nand * 8.5 + rng.uniform(-1, 1.5), 1),
                e=estilo,
                v=int(rng.integers(0, 1000)),
            )
        d += espaco * rng.uniform(0.85, 1.15)


def circulo_pts(cx, cy, r, n=48, a0=0.0, a1=2 * math.pi):
    return [(cx + math.cos(a0 + (a1 - a0) * i / n) * r, cy + math.sin(a0 + (a1 - a0) * i / n) * r) for i in range(n + 1)]


def espalhar(ilha: Ilha, ocupacao: Ocupacao, tipo: str, n: int, regiao, raio: float, tentativas: int = 20, **params):
    """Objetos soltos numa região (máscara em células via função), sem sobrepor."""
    rng = ilha.rng
    x0, y0, x1, y1 = regiao
    feitos = 0
    for _ in range(n * tentativas):
        if feitos >= n:
            break
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if _costa_em(ilha, x, y) < 8 or not ocupacao.livre(x, y, raio):
            continue
        ocupacao.ocupar(x, y, raio)
        ilha.obj(tipo, x, y, r=round(float(rng.uniform(0, math.tau)), 3), v=int(rng.integers(0, 1000)), **params)
        feitos += 1


def anel_irregular(ilha: Ilha, cx: float, cy: float, raio: float, ondula: float = 0.06, n: int = 72, fase: float = 0.0):
    """Círculo 'torto' (muralhas e patamares de verdade não são compasso)."""
    f1, f2, f3 = fase + 0.7, fase * 1.7 + 2.1, fase * 2.3 + 4.4
    pts = []
    for k in range(n + 1):
        a = math.tau * k / n
        r = raio * (1 + ondula * (0.6 * math.sin(3 * a + f1) + 0.4 * math.sin(5 * a + f2) + 0.25 * math.sin(8 * a + f3)))
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def patamares(ilha: Ilha, niveis, suave: float = 6):
    """Cada nível: (polígono, altura). O de dentro sobe por cima do de fora."""
    for pontos, altura in niveis:
        m = ilha.mascara(pontos, suave)
        ilha.h = np.maximum(ilha.h, altura * m + ilha.h * (1 - m))


def cidade_em_grade(
    ilha: Ilha,
    ocupacao: Ocupacao,
    poligono,
    estilo: str,
    angulo: float = 0.0,
    quadra: float = 2.0,
    largura_rua: float = 8,
    material: int = CALCADA,
    **casas,
):
    """Quarteirões: ruas em grade (giradas de `angulo`) recortadas pelo
    polígono, com casas dos dois lados de cada rua."""
    xs = [p[0] for p in poligono]
    ys = [p[1] for p in poligono]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    raio = max(max(xs) - min(xs), max(ys) - min(ys))
    dentro = ilha.mascara(poligono)
    c, s_ = math.cos(angulo), math.sin(angulo)

    def no_poligono(x, y):
        gx = int(round((x - ilha.x0) * CELULA / ilha.passo))
        gy = int(round((y - ilha.y0) * CELULA / ilha.passo))
        return 0 <= gx < ilha.nx and 0 <= gy < ilha.ny and dentro[gy, gx] > 0.5

    ruas = []
    for eixo in (0, 1):
        k = -raio
        while k <= raio:
            trecho = []
            t = -raio
            while t <= raio:
                u, v = (t, k) if eixo == 0 else (k, t)
                x, y = cx + u * c - v * s_, cy + u * s_ + v * c
                if no_poligono(x, y):
                    trecho.append((x, y))
                elif len(trecho) > 1:
                    ruas.append(trecho)
                    trecho = []
                else:
                    trecho = []
                t += 0.25
            if len(trecho) > 1:
                ruas.append(trecho)
            k += quadra
    for r in ruas:
        ilha.estrada([r[0], r[-1]], largura_rua, material)
    for r in ruas:
        casas_na_rua(ilha, ocupacao, [r[0], r[-1]], estilo, **casas)
    return ruas
