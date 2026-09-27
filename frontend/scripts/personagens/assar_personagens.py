"""
Assa as animações dos personagens do teste de tabuleiro (pixel art).

    python3 frontend/scripts/personagens/assar_personagens.py

Parte de um sprite parado (fonte/*.png, recortado pixel a pixel da arte de
referência) e gera, quadro a quadro a 60 fps, as animações:

    parado  — respiração, capa balançando, cabelo/pluma
    andar   — passo com as pernas alternando, corpo subindo e descendo
    atacar  — preparação, golpe de espada com rastro, acompanhamento, volta
    dano    — clarão, recuo e volta

Tudo trabalha no pixel da própria arte (nada de filtro/interpolação): cada
quadro é o sprite original deformado por um campo de deslocamento suave e
amostrado pelo vizinho mais próximo, então as cores e a quantidade de pixels
continuam as da arte. O braço da espada é uma camada rígida que gira no
cotovelo.

Saída: public/tabuleiro/personagens/<id>-<anim>.png (folhas em grade) e
src/tabuleiro/personagens.json (tamanho do quadro, âncora do pé etc.).
"""
import json
import math
import os

import cv2
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
SAIDA_IMG = os.path.join(RAIZ, 'public', 'tabuleiro', 'personagens')
SAIDA_JSON = os.path.join(RAIZ, 'src', 'tabuleiro', 'personagens.json')
FPS = 60
MARGEM = 64  # espaço em volta do sprite para capa, espada e rastro


def poligono(forma, pts):
    m = np.zeros(forma, np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m > 0


def suave(m, s):
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)


def rampa(x, a, b):
    return np.clip((x - a) / (b - a), 0.0, 1.0)


def suaviza(t):
    return t * t * (3 - 2 * t)


def ease_out(t):
    return 1 - (1 - t) ** 3


def ease_in(t):
    return t ** 2.2


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------------------
# Personagens (coordenadas em pixels da arte, antes da margem)
# --------------------------------------------------------------------------

PERSONAGENS = {
    'capitao-vermelho': dict(
        fonte='capitao_vermelho.png',
        olha=1,  # olha para a direita
        pe=(62, 121),  # ponto no chão, entre os pés
        ombro=45, cintura=68, quadril=82,
        cabeca=[(22, 0), (96, 0), (92, 46), (30, 46)],
        # capa: região e ponto onde ela prende (nos ombros)
        capas=[
            dict(pts=[(0, 40), (52, 40), (52, 72), (40, 100), (0, 104)], presa=(46, 48), raio=(6, 52), amp=(2.6, 1.2, 1.0)),
            dict(pts=[(80, 56), (96, 56), (96, 100), (78, 100)], presa=(82, 58), raio=(4, 38), amp=(1.2, 0.6, 0.4)),
        ],
        pernas=[
            dict(pts=[(36, 84), (60, 84), (58, 125), (36, 125)], quadril=84, pe=124),
            dict(pts=[(62, 84), (90, 84), (90, 118), (62, 118)], quadril=84, pe=116),
        ],
        # espada nova (vem da do capitão negro), presa na mão
        espada=dict(mao=(88, 67), angulo=38.0, cotovelo=(82, 56),
                    mao_pts=[(83, 60), (93, 60), (94, 72), (84, 72)]),
    ),
    'capitao-negro': dict(
        fonte='capitao_negro.png',
        olha=-1,
        pe=(80, 114),
        ombro=34, cintura=60, quadril=78,
        cabeca=[(56, 0), (110, 0), (108, 34), (58, 34)],
        capas=[
            dict(pts=[(96, 50), (136, 60), (136, 110), (96, 110), (88, 80)], presa=(98, 48), raio=(8, 60), amp=(2.0, 1.0, 0.8)),
            dict(pts=[(44, 74), (64, 74), (62, 94), (44, 94)], presa=(60, 70), raio=(4, 24), amp=(1.0, 0.5, 0.3)),
        ],
        pernas=[
            dict(pts=[(56, 76), (78, 76), (76, 108), (54, 108)], quadril=78, pe=106),
            dict(pts=[(80, 76), (106, 76), (108, 117), (84, 117)], quadril=78, pe=116),
        ],
        braco=dict(pts=[(0, 53), (12, 57), (30, 62), (46, 60), (48, 56), (54, 57), (58, 56), (64, 52), (68, 55),
                        (66, 64), (62, 70), (55, 75), (49, 75), (47, 70), (30, 70), (20, 69), (8, 64), (0, 58)],
                   cotovelo=(65, 55), preencher_x=46),
    ),
}


class Rig:
    def __init__(self, id_, cfg, espada_pixels=None):
        self.id = id_
        self.cfg = cfg
        arte = np.asarray(Image.open(os.path.join(AQUI, 'fonte', cfg['fonte'])).convert('RGBA'))
        h, w = arte.shape[:2]
        M = MARGEM
        self.H, self.W = h + M + 8, w + 2 * M
        self.ox, self.oy = M, M
        base = np.zeros((self.H, self.W, 4), np.uint8)
        base[M:M + h, M:M + w] = arte
        self.base = base

        def P(pts):
            return [(x + M, y + M) for x, y in pts]

        self.P = P
        forma = (self.H, self.W)
        silh = base[..., 3] > 0
        self.ombro, self.cintura, self.quadril = cfg['ombro'] + M, cfg['cintura'] + M, cfg['quadril'] + M
        self.pe = (cfg['pe'][0] + M, cfg['pe'][1] + M)
        self.cabeca = suave(poligono(forma, P(cfg['cabeca'])) & silh, 1.5)

        # capas: peso cresce com a distância do ponto onde prende
        yy, xx = np.mgrid[0:self.H, 0:self.W].astype(np.float32)
        self.yy, self.xx = yy, xx
        self.capas = []
        for c in cfg['capas']:
            reg = suave(poligono(forma, P(c['pts'])), 2.0)
            px, py = c['presa'][0] + M, c['presa'][1] + M
            d = np.hypot(xx - px, yy - py)
            peso = reg * rampa(d, c['raio'][0], c['raio'][1]) ** 1.3
            self.capas.append((peso, d, c['amp']))

        self.pernas = []
        for p in cfg['pernas']:
            reg = suave(poligono(forma, P(p['pts'])), 1.2)
            peso = reg * rampa(yy, p['quadril'] + M, p['pe'] + M)
            self.pernas.append(peso)

        # camada do braço (rígida) e corpo com o buraco preenchido
        self.braco = None
        if 'braco' in cfg:
            b = cfg['braco']
            m = poligono(forma, P(b['pts'])) & silh
            camada = np.zeros_like(base)
            camada[m] = base[m]
            corpo = base.copy()
            corpo[m] = 0
            tapar = m & (xx >= b['preencher_x'] + M)
            corpo = self.tapar(corpo, tapar)
            self.base = corpo
            self.braco = dict(camada=camada, piv=(b['cotovelo'][0] + M, b['cotovelo'][1] + M), ang0=0.0)
        elif 'espada' in cfg and espada_pixels is not None:
            e = cfg['espada']
            camada = np.zeros_like(base)
            # mão sai do corpo e vai para a camada do braço
            mm = poligono(forma, P(e['mao_pts'])) & silh
            camada[mm] = base[mm]
            self.base = self.tapar(base.copy(), mm)
            # espada espelhada (lâmina para a direita), girada para baixo
            lam, guarda = espada_pixels
            lam = lam[:, ::-1].copy()
            gx = lam.shape[1] - 1 - guarda[0]
            gy = guarda[1]
            R = cv2.getRotationMatrix2D((float(gx), float(gy)), -e['angulo'], 1.0)
            mx, my = e['mao'][0] + M, e['mao'][1] + M
            R[0, 2] += mx - gx
            R[1, 2] += my - gy
            rot = cv2.warpAffine(lam, R, (self.W, self.H), flags=cv2.INTER_NEAREST, borderValue=(0, 0, 0, 0))
            atras = rot[..., 3] > 0
            camada[atras & (camada[..., 3] == 0)] = rot[atras & (camada[..., 3] == 0)]
            self.braco = dict(camada=camada, piv=(e['cotovelo'][0] + M, e['cotovelo'][1] + M), ang0=0.0)

    @staticmethod
    def tapar(img, buraco):
        """Preenche um buraco dentro do sprite com as cores vizinhas (pixel a pixel)."""
        img = img.copy()
        falta = buraco.copy()
        cheio = (img[..., 3] > 0) & ~falta
        for _ in range(40):
            if not falta.any():
                break
            viz = cv2.dilate(cheio.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            borda = falta & viz
            ys, xs = np.nonzero(borda)
            for y, x in zip(ys, xs):
                bloco = img[y - 1:y + 2, x - 1:x + 2].reshape(-1, 4)
                ok = cheio[y - 1:y + 2, x - 1:x + 2].reshape(-1)
                cand = bloco[ok]
                # cor mais comum entre os vizinhos: mantém a paleta
                cores, cont = np.unique(cand, axis=0, return_counts=True)
                img[y, x] = cores[cont.argmax()]
            cheio |= borda
            falta &= ~borda
        return img

    # ------------------------------------------------------------------
    def quadro(self, respira=0.0, fase_capa=0.0, capa_extra=(0.0, 0.0), pernas=((0, 0), (0, 0)),
               corpo_dy=0.0, inclina=0.0, desloca=(0.0, 0.0), braco_ang=0.0, braco_d=(0.0, 0.0),
               clarao=0.0, rastro=None):
        yy, xx = self.yy, self.xx
        Dx = np.zeros_like(xx)
        Dy = np.zeros_like(yy)
        # respiração: o tronco estica para cima, a cabeça acompanha
        tronco = rampa(self.cintura - yy, 0, self.cintura - self.ombro)
        Dy -= respira * tronco
        Dy -= respira * 0.35 * self.cabeca
        # corpo acima do quadril sobe/desce (passo) e inclina (ataque)
        acima = rampa(self.quadril + 4 - yy, 0, 8)
        Dy += corpo_dy * acima
        Dx += inclina * rampa(self.quadril - yy, 0, self.quadril - (self.oy + 4))
        # capas
        for peso, d, (ax, ay, a2) in self.capas:
            onda = math.tau * fase_capa
            Dx += peso * (ax * np.sin(onda - d * 0.09) + a2 * np.sin(2 * onda - d * 0.16 + 1.1) + capa_extra[0])
            Dy += peso * (ay * np.sin(onda - d * 0.09 + 0.9) + capa_extra[1])
        # pernas
        for peso, (dx, dy) in zip(self.pernas, pernas):
            Dx += peso * dx
            Dy += peso * dy
        # amostra no vizinho mais próximo (mantém os pixels da arte)
        mapa_x = (xx - Dx - desloca[0]).astype(np.float32)
        mapa_y = (yy - Dy - desloca[1]).astype(np.float32)
        out = cv2.remap(self.base, mapa_x, mapa_y, cv2.INTER_NEAREST, borderValue=(0, 0, 0, 0))

        if self.braco is not None:
            px, py = self.braco['piv']
            # o cotovelo acompanha o corpo naquele ponto
            iy, ix = int(round(py)), int(round(px))
            ddx = float(Dx[iy, ix]) + desloca[0] + braco_d[0]
            ddy = float(Dy[iy, ix]) + desloca[1] + braco_d[1]
            R = cv2.getRotationMatrix2D((float(px), float(py)), braco_ang, 1.0)
            R[0, 2] += ddx
            R[1, 2] += ddy
            cam = cv2.warpAffine(self.braco['camada'], R, (self.W, self.H), flags=cv2.INTER_NEAREST,
                                 borderValue=(0, 0, 0, 0))
            if rastro is not None:
                out = self.desenhar_rastro(out, rastro, (px + ddx, py + ddy))
            vis = cam[..., 3] > 0
            out[vis] = cam[vis]
        if clarao > 0:
            vis = out[..., 3] > 0
            c = out[..., :3].astype(np.float32)
            c[vis] = c[vis] + (255 - c[vis]) * clarao
            out[..., :3] = c.astype(np.uint8)
        return out

    def desenhar_rastro(self, out, rastro, piv):
        """Rastro do golpe: meia-lua entre o ângulo de alguns quadros atrás e o atual.

        Grossa e clara perto da lâmina, afina e esfria para trás."""
        a0, a1, forca = rastro
        if forca <= 0 or abs(a1 - a0) < 1:
            return out
        cam = self.braco['camada'][..., 3] > 0
        ys, xs = np.nonzero(cam)
        bx, by = self.braco['piv']
        r_out = float(np.max(np.hypot(xs - bx, ys - by))) + 1
        r_in = r_out * 0.55
        yy, xx = self.yy, self.xx
        dx, dy = xx - piv[0], yy - piv[1]
        r = np.hypot(dx, dy)
        ang = np.degrees(np.arctan2(-dy, dx))
        b0, b1 = self.angulo_lamina0 + a0, self.angulo_lamina0 + a1
        sentido = 1 if b1 > b0 else -1
        # t: 0 no início do rastro, 1 na lâmina
        rel = ((ang - b0) * sentido) % 360
        t = rel / abs(b1 - b0)
        dentro = t <= 1
        # espessura: perto da lâmina ocupa quase todo o raio, atrás só a ponta
        r_min = r_out - (r_out - r_in) * t ** 0.7
        dentro &= (r >= r_min) & (r <= r_out) & (t > 0.02)
        if not dentro.any():
            return out
        nivel = t * forca * (0.55 + 0.45 * (r - r_min) / np.maximum(r_out - r_min, 1))
        out = out.copy()
        for lim, cor in ((0.15, (70, 110, 190)), (0.35, (140, 185, 240)), (0.6, (215, 235, 255)), (0.8, (255, 255, 250))):
            out[dentro & (nivel > lim)] = (*cor, 255)
        return out


def extrair_espada(rig_negro):
    """Lâmina + guarda da espada do capitão negro (para dar uma ao vermelho)."""
    cam = rig_negro.braco['camada']
    M = MARGEM
    x0, x1, y0, y1 = M + 0, M + 52, M + 50, M + 78
    lam = cam[y0:y1, x0:x1].copy()
    guarda = (48, 65 - 50)  # onde a mão segura, em coords do recorte
    return lam, guarda


# --------------------------------------------------------------------------
# Animações
# --------------------------------------------------------------------------

def anim_parado(rig, n=120):
    qs = []
    for i in range(n):
        f = i / n
        s = 0.5 - 0.5 * math.cos(math.tau * f)
        qs.append(rig.quadro(respira=1.6 * s, fase_capa=f))
    return qs


def anim_andar(rig, n=36):
    qs = []
    for i in range(n):
        f = i / n
        ph = math.tau * f
        passo = 3.0
        pa = (passo * math.sin(ph), -2.6 * max(0.0, math.cos(ph)))
        pb = (-passo * math.sin(ph), -2.6 * max(0.0, -math.cos(ph)))
        bob = -1.4 * (0.5 - 0.5 * math.cos(2 * ph))
        olha = rig.cfg['olha']
        qs.append(rig.quadro(respira=0.6, fase_capa=f * 2 % 1.0,
                             capa_extra=(-1.8 * olha, -0.4), pernas=(pa, pb), corpo_dy=bob,
                             inclina=1.2 * olha))
    return qs


def anim_atacar(rig, n=54):
    """0-0.3 prepara (braço sobe), 0.3-0.42 golpe, até 0.6 segue, depois volta."""
    olha = rig.cfg['olha']
    # ângulo positivo = anti-horário na tela. Para quem olha à esquerda,
    # levantar a espada é girar no sentido horário (negativo).
    sobe, desce = (-110.0, 55.0) if olha < 0 else (150.0, -45.0)
    qs = []
    hist = [0.0] * 3
    for i in range(n):
        f = i / (n - 1)
        if f < 0.3:
            t = ease_out(f / 0.3)
            ang = lerp(0, sobe, t)
            inc = lerp(0, -3.0 * olha, t)
            lunge = 0.0
            rast = None
        elif f < 0.42:
            t = ease_in((f - 0.3) / 0.12)
            ang = lerp(sobe, desce, t)
            inc = lerp(-3.0 * olha, 4.0 * olha, t)
            lunge = lerp(0, 9.0 * olha, t)
            rast = (hist[0], ang, 1.0)
        elif f < 0.6:
            t = (f - 0.42) / 0.18
            ang = lerp(desce, desce * 0.85, t)
            inc = 4.0 * olha
            lunge = 9.0 * olha
            rast = (hist[0], ang, 1.0 - t * 3.0) if t < 0.3 else None
        else:
            t = suaviza((f - 0.6) / 0.4)
            ang = lerp(desce * 0.85, 0, t)
            inc = lerp(4.0 * olha, 0, t)
            lunge = lerp(9.0 * olha, 0, t)
            rast = None
        agach = -1.5 * math.sin(math.pi * min(1.0, f / 0.6))
        qs.append(rig.quadro(respira=0.8, fase_capa=f, capa_extra=(-2.5 * olha * math.sin(math.pi * f), 0),
                             inclina=inc, desloca=(lunge, 0), corpo_dy=-agach, braco_ang=ang,
                             pernas=((1.5 * olha * math.sin(math.pi * min(1, f / 0.6)), 0), (0, 0)),
                             rastro=rast))
        hist = hist[1:] + [ang]
    return qs


def anim_dano(rig, n=24):
    olha = rig.cfg['olha']
    qs = []
    for i in range(n):
        f = i / (n - 1)
        rec = -5.0 * olha * math.sin(math.pi * f) * (1 - f * 0.3)
        cl = max(0.0, 1 - f * 5) * 0.85
        qs.append(rig.quadro(respira=0.4, fase_capa=f, capa_extra=(2.0 * olha * math.sin(math.pi * f), -1),
                             inclina=-3 * olha * math.sin(math.pi * f), desloca=(rec, 0), clarao=cl))
    return qs


def folha(quadros, nome):
    h, w = quadros[0].shape[:2]
    # corta o espaço vazio comum a todos os quadros
    tudo = np.zeros((h, w), bool)
    for q in quadros:
        tudo |= q[..., 3] > 0
    ys, xs = np.nonzero(tudo)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    fw, fh = x1 - x0, y1 - y0
    cols = max(1, min(len(quadros), 4096 // fw))
    linhas = math.ceil(len(quadros) / cols)
    img = np.zeros((linhas * fh, cols * fw, 4), np.uint8)
    for i, q in enumerate(quadros):
        r, c = divmod(i, cols)
        img[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw] = q[y0:y1, x0:x1]
    Image.fromarray(img).save(os.path.join(SAIDA_IMG, nome), optimize=True)
    return dict(arquivo=nome, quadros=len(quadros), colunas=int(cols), largura=int(fw), altura=int(fh), x0=int(x0), y0=int(y0))


def main():
    os.makedirs(SAIDA_IMG, exist_ok=True)
    negro = Rig('capitao-negro', PERSONAGENS['capitao-negro'])
    negro.angulo_lamina0 = 170.0  # a lâmina aponta para a esquerda
    vermelho = Rig('capitao-vermelho', PERSONAGENS['capitao-vermelho'], extrair_espada(negro))
    vermelho.angulo_lamina0 = -PERSONAGENS['capitao-vermelho']['espada']['angulo']
    meta = {}
    for rig in (vermelho, negro):
        anims = {
            'parado': (anim_parado(rig), True),
            'andar': (anim_andar(rig), True),
            'atacar': (anim_atacar(rig), False),
            'dano': (anim_dano(rig), False),
        }
        info = {}
        for nome, (qs, laco) in anims.items():
            f = folha(qs, f'{rig.id}-{nome}.png')
            f['laco'] = laco
            # âncora (pé) relativa ao quadro recortado
            f['peX'] = int(rig.pe[0] - f['x0'])
            f['peY'] = int(rig.pe[1] - f['y0'])
            info[nome] = f
            print(rig.id, nome, len(qs), 'quadros', f['largura'], 'x', f['altura'])
        meta[rig.id] = dict(olha=rig.cfg['olha'], fps=FPS, anims=info)
    os.makedirs(os.path.dirname(SAIDA_JSON), exist_ok=True)
    with open(SAIDA_JSON, 'w') as fp:
        json.dump(meta, fp, indent=1)


if __name__ == '__main__':
    main()
