"""
Fruta do Trovão (Goro Goro, do Enel): "Sango", o dragão de raio. Texturas e
efeitos no formato que o jogo toca (src/tabuleiro/cena/efk.ts), feitos por
código (traço de anime: ciano com contorno branco, brilho e faíscas). A arte
(cabeça, corpo, raios) fica em raio_arte.py.

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

sys.path.insert(0, os.path.dirname(__file__))
from fumaca import F, V, no  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EFK = os.path.join(RAIZ, 'public', 'sprites', 'efk')


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


AURA = 'Texture/raio_aura.png'
BRILHO, ZIG, CORPO, HALO, CRISTA, CABECA = ('Texture/raio_brilho.png', 'Texture/raio_zigzag.png', 'Texture/raio_corpo.png',
                                           'Texture/raio_halo.png', 'Texture/raio_crista.png', 'Texture/dragao_cabeca.png')
ZIG_V, HALO_V, ESTRELA, RACHA = 'Texture/raio_zigzag_violeta.png', 'Texture/raio_halo_violeta.png', 'Texture/raio_estrela.png', 'Texture/raio_rachadura.png'
CIANO_F = [0.35, 0.9, 1.0, 1.0]
AZUL_F = [0.25, 0.5, 1.0, 1.0]


def espiral(nome, tex, cor, largura, vida, fase, raio=1.3, passos=10):
    """fita fina enrolada no corpo: cada ponto nasce girado em volta do eixo do movimento"""
    n = fita(nome, tex, cor, largura, vida, 2, intervalo=0.5)
    n['circulo'] = {'eixo': 2, 'div': passos, 'ordem': 1, 'raio': F(raio, raio), 'a0': F(fase), 'a1': F(fase + 360), 'ruido': F(0)}
    return n


def dragao():
    """carga nas mãos (0–14), o dragão serpenteia até o alvo (10–42) e some"""
    T0, T1 = 10, 42  # parte e chega (quadros)
    # trajetória suave: serpenteia de lado, sobe em arco e mergulha no alvo
    ts = np.linspace(0, 1, 18)
    q = [T0 + (T1 - T0) * t for t in ts]
    curva = [
        [[a, float(2.4 * np.sin(2 * np.pi * 1.25 * t) * (1 - t ** 3))] for a, t in zip(q, ts)],
        [[a, float(3.0 + 4.6 * np.sin(np.pi * t) - 0.3 * t)] for a, t in zip(q, ts)],
        [[a, float(0.8 + 9.2 * t)] for a, t in zip(q, ts)],
    ]
    corpo = fita('Corpo', CORPO, [1, 1, 1, 1], 1.9, 26, 1)
    corpo['fita']['uvTipo'] = 1  # escamas repetem pela distância
    corpo['fita']['tile'] = 6.0
    # a aura de raio que flui pelo corpo todo (textura rolando ao longo)
    aura = fita('Aura', AURA, [0.6, 1.0, 1.0, 0.95], 3.0, 24, 2, rolar=-9.0)
    aura['fita']['uvTipo'] = 1
    aura['fita']['tile'] = 5.0
    cabeca = no('Cabeça', 0, (T1 + 4, T1 + 4), 1, (1, 1), (0, 0), (0, 0, 0), eterno=False,
                pos={'t': 'curva', 'c': curva},
                filhos=[
                    fita('Halo azul', HALO, [0.2, 0.45, 1.0, 0.6], 5.0, 28, 2),
                    fita('Halo', HALO, [0.35, 0.9, 1.0, 0.75], 3.4, 26, 2),
                    aura,
                    corpo,
                    fita('Núcleo', HALO, [0.95, 1.0, 1.0, 0.75], 0.45, 20, 2),
                    sprite('Crista', CRISTA, [1, 1, 1, 0.95], 10 ** 9, (0.9, 0.9), (16, 22), V((-0.15, 0.15), (1.3, 1.7), 0),
                           V(0, (0.0, 0.015), 0), 2.8, 0.9, fade=(1, 9), atraso=(T0, T0), giro=(-18, 18), mistura=1),
                    sprite('Arcos', ZIG, [0.9, 1.0, 1.0, 1.0], 10 ** 9, (0.55, 0.55), (5, 8), V((-1.6, 1.6), (-1.2, 1.8), (-0.8, 0.8)),
                           V(0, 0, 0), 2.0, 3.2, fade=(0, 4), atraso=(T0, T0)),
                    sprite('Faíscas', ESTRELA, [0.9, 1.0, 1.0, 1.0], 10 ** 9, (0.3, 0.3), (18, 30), V((-1.8, 1.8), (-1.4, 1.6), (-1.2, 1.2)),
                           V((-0.03, 0.03), (-0.01, 0.04), (-0.03, 0.03)), 0.55, 0.1, fade=(1, 14), atraso=(T0, T0), vgiro=(-6, 6)),
                    sprite('Poeira', BRILHO, CIANO_F, 10 ** 9, (0.25, 0.25), (20, 34), V((-2.2, 2.2), (-1.6, 2.0), (-1.4, 1.4)),
                           V((-0.015, 0.015), (0.0, 0.02), (-0.015, 0.015)), 0.22, 0.06, fade=(2, 16), atraso=(T0, T0)),
                    # aura dos olhos: chispas e arcos soltos na cabeça que ficam para trás (rastro)
                    dict(sprite('Aura dos olhos', ZIG, [0.85, 1.0, 1.0, 1.0], 10 ** 9, (0.35, 0.35), (6, 10), V((-0.5, 0.5), (0.6, 1.2), (-0.5, 0.5)),
                                V((-0.02, 0.02), (0.0, 0.03), (-0.02, 0.02)), 1.6, 0.6, fade=(0, 5), atraso=(T0, T0)), comPai=True),
                    dict(sprite('Chispas dos olhos', ESTRELA, [1, 1, 1, 1], 10 ** 9, (0.5, 0.5), (8, 14), V((-0.4, 0.4), (0.7, 1.1), (-0.4, 0.4)),
                                V(0, 0, 0), 0.9, 0.1, fade=(0, 8), atraso=(T0, T0), vgiro=(-10, 10)), comPai=True),
                    # a cabeça: virada para a câmera e girada para onde anda (billboard 3), com brilho forte atrás
                    dict(sprite('Brilho da cabeça', BRILHO, AZUL_F, 1, (1, 1), (T1 - T0, T1 - T0), V(0, 0.3, 0.4), V(0, 0, 0), 12.0, 12.0,
                                fade=(3, 4), atraso=(T0, T0), heranca=(2, 0, 0)), comPai=True),
                    dict(sprite('Brilho claro', BRILHO, CIANO_F, 1, (1, 1), (T1 - T0, T1 - T0), V(0, 0.3, 0.4), V(0, 0, 0), 7.0, 7.0,
                                fade=(3, 4), atraso=(T0, T0), heranca=(2, 0, 0)), comPai=True),
                    dict(sprite('Cabeça', CABECA, [1, 1, 1, 1], 1, (1, 1), (T1 - T0 + 2, T1 - T0 + 2), V(0, 0.4, 0.5), V(0, 0, 0), 8.0, 8.0,
                                fade=(3, 4), atraso=(T0, T0), heranca=(2, 0, 0), mistura=1, giro=(0, 0), billboard=3), comPai=True),
                ])
    carga = no('Carga', 0, (T0 + 6, T0 + 6), 1, (1, 1), (0, 0), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 2.8, 0.8)}, filhos=[
        sprite('Brilho', BRILHO, CIANO_F, 1, (1, 1), (T0 + 6, T0 + 6), V(0, 0, 0), V(0, 0, 0), 1.0, 5.5, fade=(2, 6), heranca=(2, 0, 0)),
        sprite('Brilho azul', BRILHO, AZUL_F, 1, (1, 1), (T0 + 6, T0 + 6), V(0, 0, 0), V(0, 0, 0), 2.0, 8.0, fade=(2, 8), heranca=(2, 0, 0)),
        sprite('Faíscas na mão', ZIG, [0.9, 1, 1, 1], 34, (0.45, 0.45), (4, 6), V((-1.2, 1.2), (-1.2, 1.2), (-0.6, 0.6)), V(0, 0, 0), 1.4, 2.4,
               fade=(0, 3), heranca=(2, 0, 0)),
        sprite('Faíscas 2', ZIG, [0.8, 0.95, 1, 1], 16, (0.9, 0.9), (4, 6), V((-1.4, 1.4), (-1.4, 1.4), (-0.6, 0.6)), V(0, 0, 0), 1.6, 2.6,
               fade=(0, 3), heranca=(2, 0, 0)),
    ])
    fim = no('Fim', 0, (1, 1), 1, (1, 1), (T1, T1), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 2.6, 10)})
    return {'fim': T1 + 24, 'filhos': [carga, cabeca, fim]}


def impacto():
    """explosão elétrica: clarão, pilares de raio do céu, estrela de raios ciano e
    violeta, rachaduras brilhando no chão, anéis, faíscas e restos de arco"""
    chao = lambda nome, tex, cor, vida, de, ate, fade, atraso=(0, 0), mistura=2: no(
        nome, 2, (vida, vida), 1, (1, 1), atraso, (2, 0, 0), False,
        pos={'t': 'fixo', 'p': V(0, 0.08, 0)}, rot={'t': 'fixo', 'p': V(-90, 0, 0)},
        esc={'t': 'easing', 'de': V(de, de, de), 'ate': V(ate, ate, ate)},
        render={'tex': tex, 'mistura': mistura, 'fadeIn': fade[0], 'fadeOut': fade[1]}, sprite={'billboard': 2, 'cor': cor})
    anel = lambda nome, atraso, vida, ate, cor: no(
        nome, 4, (vida, vida), 1, (1, 1), (atraso, atraso), (2, 0, 0), False, pos={'t': 'fixo', 'p': V(0, 0.2, 0)}, rot={'t': 'fixo', 'p': V(90, 0, 0)},
        esc={'t': 'easing', 'de': V(1, 1, 1), 'ate': V(ate, ate, ate)}, render={'tex': HALO, 'mistura': 2, 'fadeIn': 0, 'fadeOut': vida * 0.7},
        anel={'vertices': 56, 'fora': [1.0, 0], 'dentro': [0.78, 0], 'meio': 0.5, 'corFora': cor[:3] + [0], 'corMeio': cor, 'corDentro': cor[:3] + [0]})
    return {'fim': 60, 'filhos': [
        no('Impacto', 0, (60, 60), 1, (1, 1), (0, 0), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 0, 0)}, filhos=[
            sprite('Clarão azul', BRILHO, AZUL_F, 1, (1, 1), (16, 16), V(0, 2.5, 0), V(0, 0, 0), 4.0, 22.0, fade=(0, 12), heranca=(2, 0, 0)),
            sprite('Clarão', BRILHO, [0.85, 1.0, 1.0, 1.0], 1, (1, 1), (12, 12), V(0, 2.5, 0), V(0, 0, 0), 3.0, 15.0, fade=(0, 9), heranca=(2, 0, 0)),
            chao('Rachaduras', RACHA, [1, 1, 1, 1], 48, 9.0, 10.5, (0, 30)),
            chao('Brilho no chão', BRILHO, CIANO_F, 30, 6.0, 12.0, (0, 22)),
            sprite('Pilar', ZIG, [0.95, 1.0, 1.0, 1.0], 3, (2, 2), (9, 12), V((-0.4, 0.4), 6.5, (-0.4, 0.4)), V(0, 0, 0), 14, 14,
                   fade=(0, 6), heranca=(2, 0, 0), giro=(82, 98)),
            sprite('Pilar 2', ZIG, [0.8, 0.95, 1, 1], 2, (3, 3), (8, 10), V((-0.8, 0.8), 6.5, (-0.8, 0.8)), V(0, 0, 0), 13, 13,
                   fade=(0, 6), heranca=(2, 0, 0), giro=(80, 100)),
            sprite('Estrela', ZIG, [0.95, 1.0, 1.0, 1.0], 14, (0.35, 0.35), (8, 12), V((-0.4, 0.4), (1.5, 3.5), (-0.4, 0.4)), V(0, 0, 0), 5.0, 8.5,
                   fade=(0, 6), heranca=(2, 0, 0)),
            sprite('Estrela 2', ZIG, [0.8, 0.95, 1, 1], 8, (0.6, 0.6), (8, 12), V((-0.4, 0.4), (1.5, 3.5), (-0.4, 0.4)), V(0, 0, 0), 5.5, 9.0,
                   fade=(0, 6), heranca=(2, 0, 0)),
            anel('Anel', 0, 24, 10, [0.6, 1, 1, 1]),
            anel('Anel azul', 4, 28, 13, [0.3, 0.6, 1, 0.9]),
            sprite('Faíscas', ESTRELA, [0.9, 1.0, 1.0, 1.0], 40, (0.1, 0.1), (20, 34), V((-0.5, 0.5), (1.5, 3.0), (-0.5, 0.5)),
                   V((-0.3, 0.3), (0.05, 0.28), (-0.3, 0.3)), 0.7, 0.2, fade=(0, 14), heranca=(2, 0, 0), a=V(0, (-0.013, -0.008), 0), vgiro=(-8, 8)),
            sprite('Arcos', ZIG, [0.85, 1.0, 1.0, 0.9], 34, (1.0, 1.0), (4, 6), V((-2.6, 2.6), (0.3, 4.0), (-2.6, 2.6)), V(0, 0, 0), 1.8, 2.8,
                   fade=(0, 3), atraso=(4, 4), heranca=(2, 0, 0)),
            sprite('Poeira', BRILHO, CIANO_F, 40, (0.4, 0.4), (24, 36), V((-3, 3), (0.3, 4.5), (-3, 3)), V((-0.01, 0.01), (0.005, 0.02), (-0.01, 0.01)),
                   0.25, 0.08, fade=(2, 18), atraso=(6, 6), heranca=(2, 0, 0)),
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
    import raio_arte as A
    # traço de anime: cores vivas, cel-shading, contorno branco e muito brilho
    texs = {BRILHO: A.brilho(), ZIG: A.relampago(cor=A.CIANO, semente=1), AURA: A.aura(),
            CORPO: A.corpo_anime(), HALO: A.halo(), CRISTA: A.crista_anime(), CABECA: A.cabeca_anime(),
            ESTRELA: A.estrela(), RACHA: A.rachadura()}
    gravar('raio-dragao', dragao(), texs)
    gravar('raio-impacto', impacto(), texs)
