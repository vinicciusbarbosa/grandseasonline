"""
Fruta do Trovão (Goro Goro, do Enel): "Sango", o dragão de raio. Texturas e
efeitos no formato que o jogo toca (src/tabuleiro/cena/efk.ts), feitos por
código (traço de anime: ciano com contorno branco, brilho e faíscas).

    python3 scripts/efeitos/raio.py

Grava public/sprites/efk/raio-dragao (a carga nas mãos e o dragão serpenteando
até o alvo; o nó "Fim" marca o impacto e o tocador estica o Z até o alvo de
verdade) e public/sprites/efk/raio-impacto (a explosão elétrica no alvo).
Unidades: o personagem tem ~5 de altura (1 casa ≈ 4); tempo em quadros de 60 fps.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from fumaca import F, V, no, ruido  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EFK = os.path.join(RAIZ, 'public', 'sprites', 'efk')
CIANO = (70, 225, 255)
CIANO_ESCURO = (25, 150, 225)
BRANCO = (245, 255, 255)


# ------------------------------------------------------------ texturas
def brilho_png(n=128):
    y, x = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1
    r = np.sqrt(x * x + y * y)
    a = np.clip(1 - r, 0, 1) ** 2.2
    img = np.dstack([0.75 + 0.25 * a, np.ones_like(a), np.ones_like(a), a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def zigzag_png(n=256, semente=4):
    """raio torto (passeio aleatório) com halo: branco no meio, ciano em volta"""
    r = np.random.default_rng(semente)
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts, y = [], n / 2
    for x in np.linspace(8, n - 8, 14):
        pts.append((x, y))
        y = np.clip(y + r.uniform(-28, 28), 40, n - 40)
    # um galho
    k = 6
    galho = [pts[k]]
    gy = pts[k][1]
    for x in np.linspace(pts[k][0], pts[k][0] + 70, 5)[1:]:
        gy += r.uniform(-22, 22)
        galho.append((x, gy))
    halo = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    dh = ImageDraw.Draw(halo)
    dh.line(pts, fill=CIANO + (200,), width=14, joint='curve')
    dh.line(galho, fill=CIANO + (150,), width=9, joint='curve')
    halo = halo.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(halo)
    d.line(pts, fill=BRANCO + (255,), width=4, joint='curve')
    d.line(galho, fill=BRANCO + (230,), width=3, joint='curve')
    return img


def corpo_png(n=256):
    """o corpo (fita): ciano com faixas mais claras ao longo, contorno branco nas bordas"""
    u = np.linspace(-1, 1, n)[None, :] * np.ones((n, 1))
    nz = ruido(n, 4, 21)
    listras = 0.5 + 0.5 * np.sin(u * 9 + nz * 6)
    fill_a = np.clip(1 - np.abs(u) / 0.9, 0, 1) ** 0.35 * 0.92
    borda = np.exp(-((np.abs(u) - 0.86) / 0.05) ** 2)
    rr = (CIANO[0] / 255) * (1 - 0.35 * listras) + borda
    gg = (CIANO[1] / 255) + 0.1 * listras + borda
    bb = np.ones_like(u)
    a = np.clip(fill_a + borda * 0.95, 0, 1)
    img = np.dstack([np.clip(rr, 0, 1), np.clip(gg, 0, 1), bb, a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def halo_png(n=128):
    """halo macio da fita (soma luz)"""
    u = np.linspace(-1, 1, n)[None, :] * np.ones((n, 1))
    a = np.clip(1 - np.abs(u), 0, 1) ** 1.6
    img = np.dstack([np.full_like(u, 0.45), np.full_like(u, 0.9), np.ones_like(u), a])
    return Image.fromarray((img * 255).astype(np.uint8), 'RGBA')


def crista_png(n=256, semente=8):
    """crista em chamas pontudas (a juba ao longo do corpo)"""
    r = np.random.default_rng(semente)
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(10, n - 20)]
    x = 10
    while x < n - 30:
        w = r.uniform(25, 45)
        pts.append((x + w * 0.45, r.uniform(25, 110)))
        x += w
        pts.append((x, r.uniform(150, 190)))
    pts.append((n - 10, n - 20))
    d.polygon(pts, fill=CIANO + (230,), outline=BRANCO + (255,))
    d.line(pts + [pts[0]], fill=BRANCO + (255,), width=4, joint='curve')
    return img


def cabeca_png(n=512):
    """cabeça de dragão DE FRENTE, boca aberta (traço de anime): lê bem em
    qualquer direção do golpe (o sprite fica virado para a câmera)"""
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    L = BRANCO + (255,)
    c = n / 2

    def esp(poly):  # espelha no eixo vertical
        return [(n - x, y) for x, y in poly]
    corpo = CIANO + (240,)
    sombra = CIANO_ESCURO + (235,)
    juba = [(150, 230), (40, 190), (110, 260), (10, 300), (115, 310), (45, 380), (150, 345), (120, 430), (195, 360)]
    chifre = [(205, 175), (120, 90), (60, 10), (150, 70), (230, 150)]
    chifre2 = [(180, 205), (90, 170), (20, 120), (110, 140), (200, 180)]
    rosto = [(256, 120), (330, 150), (372, 200), (380, 262), (340, 310), (318, 335), (194, 335), (172, 310), (132, 262), (140, 200), (182, 150)]
    boca = [(196, 318), (316, 318), (300, 405), (212, 405)]
    queixo = [(206, 402), (306, 402), (288, 455), (224, 455)]
    testa = [(256, 120), (232, 70), (256, 95), (280, 70)]
    for poly, cor in [(juba, sombra), (esp(juba), sombra), (chifre2, corpo), (esp(chifre2), corpo), (chifre, corpo), (esp(chifre), corpo),
                      (rosto, corpo), (queixo, sombra), (testa, corpo)]:
        d.polygon(poly, fill=cor)
        d.line(poly + [poly[0]], fill=L, width=6, joint='curve')
    # boca aberta (escura por dentro) com dentes
    d.polygon(boca, fill=(10, 60, 120, 245))
    d.line(boca + [boca[0]], fill=L, width=6, joint='curve')
    for k in range(5):
        x = 206 + k * 22
        d.polygon([(x, 320), (x + 14, 320), (x + 7, 345)], fill=L)
        d.polygon([(x + 4, 403), (x + 16, 403), (x + 10, 380)], fill=L)
    # presas
    d.polygon([(200, 318), (214, 318), (210, 368)], fill=L)
    d.polygon([(n - 200, 318), (n - 214, 318), (n - 210, 368)], fill=L)
    # olhos: fendas brancas inclinadas, brilhando
    olho = [(176, 222), (232, 236), (238, 250), (186, 240)]
    for poly in (olho, esp(olho)):
        d.polygon(poly, fill=L)
    # sobrancelhas espetadas e narinas
    sob = [(165, 205), (200, 170), (245, 215)]
    d.line(sob, fill=L, width=5, joint='curve')
    d.line(esp(sob), fill=L, width=5, joint='curve')
    d.line([(236, 300), (246, 292)], fill=L, width=4)
    d.line([(n - 236, 300), (n - 246, 292)], fill=L, width=4)
    # bigodes longos saindo do focinho
    d.line([(190, 310), (110, 360), (60, 450)], fill=L, width=5, joint='curve')
    d.line([(n - 190, 310), (n - 110, 360), (n - 60, 450)], fill=L, width=5, joint='curve')
    # brilho por trás (halo)
    halo = img.copy().filter(ImageFilter.GaussianBlur(14))
    hb = np.asarray(halo).astype(np.float32)
    hb[..., :3] = np.array(CIANO, np.float32)
    hb[..., 3] *= 0.8
    out = Image.fromarray(hb.astype(np.uint8), 'RGBA')
    out.alpha_composite(img)
    return out


# ------------------------------------------------------------ nós
def sprite(nome, tex, cor, maxi, intervalo, vida, p, v, de, ate, fade=(1, 6), atraso=(0, 0), heranca=(1, 0, 0), giro=(0, 360), vgiro=(0, 0),
           mistura=2, billboard=0, a=None, rot=None, com_pai=False):
    n = no(nome, 2, vida, maxi, intervalo, atraso, heranca, com_pai,
           pos={'t': 'pva', 'p': p, 'v': v, 'a': a or V(0, 0, 0)},
           rot=rot or {'t': 'pva', 'p': V(0, 0, giro), 'v': V(0, 0, vgiro), 'a': V(0, 0, 0)},
           esc={'t': 'easing', 'de': V(de, de, de), 'ate': V(ate, ate, ate)},
           render={'tex': tex, 'mistura': mistura, 'fadeIn': fade[0], 'fadeOut': fade[1]},
           sprite={'billboard': billboard, 'cor': cor})
    return n


def fita(nome, tex, cor, largura, vida, mistura, intervalo=0.5, rolar=0.0):
    render = {'tex': tex, 'mistura': mistura, 'fadeIn': 0, 'fadeOut': vida * 0.75}
    if rolar:
        render['uv'] = {'t': 'rolar', 'x': 0, 'y': 0, 'w': 256, 'h': 256, 'vx': 0, 'vy': rolar}
    return no(nome, 3, (vida, vida), 10 ** 9, (intervalo, intervalo), (0, 0), (1, 0, 0), False,
              pos={'t': 'fixo', 'p': V(0, 0, 0)},
              # cada ponto da fita encolhe com a idade: o corpo afina até a cauda
              esc={'t': 'easing', 'de': V(1, 1, 1), 'ate': V(0.12, 0.12, 0.12)},
              render=render,
              fita={'l': -largura, 'r': largura, 'cor': cor, 'olho': 1, 'uvTipo': 0, 'tile': 1})


BRILHO, ZIG, CORPO, HALO, CRISTA, CABECA = ('Texture/raio_brilho.png', 'Texture/raio_zigzag.png', 'Texture/raio_corpo.png',
                                           'Texture/raio_halo.png', 'Texture/raio_crista.png', 'Texture/dragao_cabeca.png')
CIANO_F = [0.35, 0.9, 1.0, 1.0]


def dragao():
    """carga nas mãos (0–14), o dragão serpenteia até o alvo (10–40) e some"""
    T0, T1 = 10, 40  # parte e chega (quadros)
    # trajetória suave: serpenteia de lado, sobe em arco e mergulha no alvo
    ts = np.linspace(0, 1, 16)
    q = [T0 + (T1 - T0) * t for t in ts]
    curva = [
        [[a, float(2.2 * np.sin(2 * np.pi * 1.25 * t) * (1 - t ** 3))] for a, t in zip(q, ts)],
        [[a, float(2.8 + 4.4 * np.sin(np.pi * t) - 0.2 * t)] for a, t in zip(q, ts)],
        [[a, float(0.8 + 9.2 * t)] for a, t in zip(q, ts)],
    ]
    cabeca = no('Cabeça', 0, (T1 + 4, T1 + 4), 1, (1, 1), (0, 0), (0, 0, 0), eterno=False,
                pos={'t': 'curva', 'c': curva},
                filhos=[
                    fita('Halo', HALO, [0.4, 0.85, 1.0, 0.55], 3.4, 26, 2, rolar=0),
                    fita('Corpo', CORPO, [1, 1, 1, 1], 1.8, 24, 1, rolar=0),
                    fita('Núcleo', HALO, [0.9, 1.0, 1.0, 0.9], 0.5, 20, 2),
                    # a cabeça: de frente, virada para a câmera
                    dict(sprite('Cabeça', CABECA, [1, 1, 1, 1], 1, (1, 1), (T1 - T0 + 2, T1 - T0 + 2), V(0, 0.4, 0.4), V(0, 0, 0), 7.0, 7.0,
                                fade=(3, 4), atraso=(T0, T0), heranca=(2, 0, 0), mistura=1, giro=(0, 0)), comPai=True),
                    dict(sprite('Brilho da cabeça', BRILHO, CIANO_F, 1, (1, 1), (T1 - T0, T1 - T0), V(0, 0.3, 0.4), V(0, 0, 0), 8.0, 8.0,
                                fade=(3, 4), atraso=(T0, T0), heranca=(2, 0, 0)), comPai=True),
                    sprite('Arcos', ZIG, [0.85, 1.0, 1.0, 1.0], 10 ** 9, (0.6, 0.6), (5, 8), V((-1.3, 1.3), (-1.0, 1.4), (-0.6, 0.6)),
                           V(0, 0, 0), 1.4, 2.4, fade=(0, 4), atraso=(T0, T0)),
                    sprite('Crista', CRISTA, [1, 1, 1, 0.95], 10 ** 9, (1.0, 1.0), (16, 20), V((-0.2, 0.2), (1.0, 1.5), 0),
                           V(0, (0.0, 0.02), 0), 2.4, 1.0, fade=(1, 7), atraso=(T0, T0), giro=(-20, 20), mistura=1),
                    sprite('Faíscas', BRILHO, CIANO_F, 10 ** 9, (0.35, 0.35), (16, 26), V((-1.5, 1.5), (-1.2, 1.2), (-1, 1)),
                           V((-0.03, 0.03), (-0.01, 0.04), (-0.03, 0.03)), 0.35, 0.15, fade=(1, 12), atraso=(T0, T0)),
                ])
    carga = no('Carga', 0, (T0 + 6, T0 + 6), 1, (1, 1), (0, 0), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 2.8, 0.8)}, filhos=[
        sprite('Brilho', BRILHO, CIANO_F, 1, (1, 1), (T0 + 6, T0 + 6), V(0, 0, 0), V(0, 0, 0), 1.0, 4.5, fade=(2, 6), heranca=(2, 0, 0)),
        sprite('Faíscas na mão', ZIG, [0.85, 1, 1, 1], 30, (0.5, 0.5), (4, 6), V((-1, 1), (-1, 1), (-0.6, 0.6)), V(0, 0, 0), 1.0, 1.8,
               fade=(0, 3), heranca=(2, 0, 0)),
    ])
    fim = no('Fim', 0, (1, 1), 1, (1, 1), (T1, T1), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 2.6, 10)})
    return {'fim': T1 + 20, 'filhos': [carga, cabeca, fim]}


def impacto():
    """explosão elétrica: clarão, raios em estrela, anel no chão, faíscas e restos de arco"""
    return {'fim': 50, 'filhos': [
        no('Impacto', 0, (50, 50), 1, (1, 1), (0, 0), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 0, 0)}, filhos=[
            sprite('Clarão', BRILHO, [0.8, 1.0, 1.0, 1.0], 1, (1, 1), (12, 12), V(0, 2.5, 0), V(0, 0, 0), 3.0, 16.0, fade=(0, 9), heranca=(2, 0, 0)),
            sprite('Estrela', ZIG, [0.9, 1.0, 1.0, 1.0], 14, (0.4, 0.4), (8, 12), V((-0.4, 0.4), (1.5, 3.5), (-0.4, 0.4)), V(0, 0, 0), 4.5, 7.5,
                   fade=(0, 6), heranca=(2, 0, 0)),
            sprite('Raio do céu', ZIG, [0.9, 1.0, 1.0, 1.0], 3, (2, 2), (8, 10), V((-0.3, 0.3), 6.0, (-0.3, 0.3)), V(0, 0, 0), 12, 12,
                   fade=(0, 5), heranca=(2, 0, 0), giro=(80, 100), billboard=0),
            no('Anel', 4, (22, 22), 1, (1, 1), (0, 0), (2, 0, 0), pos={'t': 'fixo', 'p': V(0, 0.2, 0)}, rot={'t': 'fixo', 'p': V(90, 0, 0)},
               esc={'t': 'easing', 'de': V(1, 1, 1), 'ate': V(9, 9, 9)},
               render={'tex': HALO, 'mistura': 2, 'fadeIn': 0, 'fadeOut': 16},
               anel={'vertices': 48, 'fora': [1.0, 0], 'dentro': [0.75, 0], 'meio': 0.5, 'corFora': [0.4, 0.9, 1, 0], 'corMeio': [0.6, 1, 1, 1], 'corDentro': [0.4, 0.9, 1, 0]}),
            sprite('Faíscas', BRILHO, CIANO_F, 36, (0.1, 0.1), (20, 32), V((-0.5, 0.5), (1.5, 3.0), (-0.5, 0.5)),
                   V((-0.28, 0.28), (0.05, 0.25), (-0.28, 0.28)), 0.5, 0.2, fade=(0, 14), heranca=(2, 0, 0), a=V(0, (-0.012, -0.008), 0)),
            sprite('Arcos', ZIG, [0.8, 1.0, 1.0, 0.9], 30, (1.0, 1.0), (4, 6), V((-2.4, 2.4), (0.3, 4.0), (-2.4, 2.4)), V(0, 0, 0), 1.6, 2.6,
                   fade=(0, 3), atraso=(4, 4), heranca=(2, 0, 0)),
        ]),
    ]}


def gravar(nome, efeito, texs):
    pasta = os.path.join(EFK, nome)
    os.makedirs(os.path.join(pasta, 'Texture'), exist_ok=True)
    usadas = set()

    def coletar(n):
        if 'render' in n:
            usadas.add(n['render']['tex'])
        for f in n['filhos']:
            coletar(f)
    for f in efeito['filhos']:
        coletar(f)
    efeito['texturas'] = sorted(usadas)
    for t in usadas:
        texs[t].save(os.path.join(pasta, t), optimize=True)
    json.dump(efeito, open(os.path.join(pasta, 'efeito.json'), 'w'), separators=(',', ':'))
    print(nome, sorted(usadas))


if __name__ == '__main__':
    texs = {BRILHO: brilho_png(), ZIG: zigzag_png(), CORPO: corpo_png(), HALO: halo_png(), CRISTA: crista_png(), CABECA: cabeca_png()}
    gravar('raio-dragao', dragao(), texs)
    gravar('raio-impacto', impacto(), texs)
