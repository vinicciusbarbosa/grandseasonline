"""
Fruta da Fumaça (estilo Smoker): texturas e efeitos no formato que o jogo
toca (src/tabuleiro/cena/efk.ts), feitos por código em vez do editor.

    python3 scripts/efeitos/fumaca.py

Grava public/sprites/efk/fumaca-jato, fumaca-nuvem e fumaca-prisao (efeito.json
+ Texture/*.png). Unidades do Effekseer: o personagem tem ~5 de altura, +Z é a
direção do alvo, tempo em quadros de 60 fps.

  fumaca-jato   — a fumaça sai das mãos e corre até o alvo (o nó "Fim" em Z
                  marca o impacto: o tocador estica o Z até o alvo de verdade);
  fumaca-nuvem  — a nuvem que engole cada casa atingida (Nuvem de Fumaça);
  fumaca-prisao — Prisão de Fumaça (White Out): colunas girando em volta da
                  área 3×3 se fecham numa cúpula e estouram.
"""
import json
import os

import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EFK = os.path.join(RAIZ, 'public', 'sprites', 'efk')
rng = np.random.default_rng(7)


# ------------------------------------------------------------ texturas
def ruido(n, oitavas=5, semente=0):
    """ruído fractal suave (value noise somado em oitavas), 0..1"""
    r = np.random.default_rng(semente)
    out = np.zeros((n, n))
    amp, tot = 1.0, 0.0
    for o in range(oitavas):
        g = 4 * 2 ** o
        base = r.random((g + 1, g + 1))
        base[-1, :] = base[0, :]
        base[:, -1] = base[:, 0]
        img = Image.fromarray((base * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        out += amp * np.asarray(img) / 255.0
        tot += amp
        amp *= 0.55
    return out / tot


def salvar(arr, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), 'RGBA').save(caminho, optimize=True)


def bola(n=256, semente=1):
    """bolha de fumaça: borda irregular pelo ruído, mais clara em cima"""
    y, x = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1
    r = np.sqrt(x * x + y * y)
    nz = ruido(n, 5, semente)
    borda = 0.72 + 0.28 * (nz - 0.5) * 2
    a = np.clip((borda - r) / 0.35, 0, 1) ** 1.4
    a *= 0.78 + 0.22 * ruido(n, 4, semente + 10)
    luz = np.clip(0.84 + 0.18 * (-y) + 0.16 * (nz - 0.5), 0, 1)
    return np.dstack([luz, luz, luz * 1.01, a])


def fiapo(n=256, semente=3):
    """fiapo: faixa esticada e torcida (o rastro do jato e as franjas)"""
    y, x = np.mgrid[0:n, 0:n] / (n - 1) * 2 - 1
    nz = ruido(n, 5, semente)
    yy = y + 0.25 * np.sin(x * 3.0 + nz * 4.0)
    a = np.clip(1 - np.abs(yy) / (0.35 + 0.2 * nz), 0, 1) ** 1.6
    a *= np.clip(1 - np.abs(x) ** 2.2, 0, 1)
    a *= 0.5 + 0.5 * ruido(n, 4, semente + 5)
    return np.dstack([np.ones_like(a), np.ones_like(a), np.ones_like(a), a])


def onda(n=256):
    """faixa macia (para o anel no chão): opaca no meio da altura, some nas pontas"""
    y = np.linspace(-1, 1, n)[:, None] * np.ones((1, n))
    nz = ruido(n, 4, 11)
    a = np.clip(1 - np.abs(y) * 1.15, 0, 1) ** 1.8 * (0.6 + 0.4 * nz)
    return np.dstack([np.ones_like(a), np.ones_like(a), np.ones_like(a), a])


# ------------------------------------------------------------ nós
def F(a, b=None):
    return [float(a), float(a if b is None else b)]


def V(x, y, z):
    return [F(*x) if isinstance(x, tuple) else F(x), F(*y) if isinstance(y, tuple) else F(y), F(*z) if isinstance(z, tuple) else F(z)]


def no(nome, tipo=0, vida=(60, 60), maxi=1, intervalo=(1, 1), atraso=(0, 0), heranca=(2, 2, 2), com_pai=True, filhos=(), **extra):
    n = {'nome': nome, 'tipo': tipo, 'vida': F(*vida), 'max': maxi, 'intervalo': F(*intervalo), 'atraso': F(*atraso),
         'heranca': list(heranca), 'comPai': com_pai, 'filhos': list(filhos)}
    n.update(extra)
    return n


def bolhas(nome, tex, cor, maxi, intervalo, vida, p, v, de, ate, fade=(4, 26), atraso=(0, 0), heranca=(1, 0, 0), giro=(-1.2, 1.2), mistura=1, a=None, circulo=None):
    """sprites de fumaça virados para a câmera, girando devagar e crescendo"""
    extra = {}
    if circulo:
        extra['circulo'] = circulo
    return no(nome, 2, vida, maxi, intervalo, atraso, heranca,
              pos={'t': 'pva', 'p': p, 'v': v, 'a': a or V(0, 0, 0)},
              rot={'t': 'pva', 'p': V(0, 0, (0, 360)), 'v': V(0, 0, giro), 'a': V(0, 0, 0)},
              esc={'t': 'easing', 'de': V(de, de, de), 'ate': V(ate, ate, ate)},
              render={'tex': tex, 'mistura': mistura, 'fadeIn': fade[0], 'fadeOut': fade[1]},
              sprite={'billboard': 0, 'cor': cor}, **extra)


BRANCA = [0.94, 0.95, 0.97, 0.9]
CINZA = [0.62, 0.65, 0.7, 0.75]
SOMBRA = [0.4, 0.42, 0.47, 0.55]
BOLA, FIAPO, ONDA = 'Texture/fumaca_bola.png', 'Texture/fumaca_fiapo.png', 'Texture/fumaca_onda.png'


def anel_chao(nome, atraso, vida, de, ate, cor, raio=(1.0, 0.55)):
    """anel deitado no chão que abre (o sopro da fumaça)"""
    return no(nome, 4, (vida, vida), 1, (1, 1), (atraso, atraso), (1, 1, 1),
              pos={'t': 'fixo', 'p': V(0, 0.15, 0)},
              rot={'t': 'fixo', 'p': V(90, 0, 0)},
              esc={'t': 'easing', 'de': V(de, de, de), 'ate': V(ate, ate, ate)},
              render={'tex': ONDA, 'mistura': 1, 'fadeIn': 2, 'fadeOut': vida * 0.7},
              anel={'vertices': 40, 'fora': [raio[0], 0], 'dentro': [raio[1], 0], 'meio': 0.5,
                    'corFora': [cor[0], cor[1], cor[2], 0], 'corMeio': cor, 'corDentro': [cor[0], cor[1], cor[2], 0]})


def jato():
    """corre do peito de quem lança até o alvo (Z 0 → 10, esticado até o alvo)"""
    emissor = no('Jato', 0, (40, 40), 1, (1, 1), (0, 0), (0, 0, 0), eterno=False,
                 pos={'t': 'curva', 'c': [[[0, 0], [16, 0]], [[0, 2.6], [16, 2.2]], [[0, 0.6], [16, 10]]]},
                 filhos=[
                     bolhas('Rastro', BOLA, BRANCA, 80, (0.22, 0.22), (24, 34), V((-0.35, 0.35), (-0.3, 0.3), (-0.2, 0.2)),
                            V((-0.025, 0.025), (0.008, 0.025), (0.0, 0.03)), 1.8, 3.8, fade=(2, 20)),
                     bolhas('Fiapos', FIAPO, [0.9, 0.92, 0.95, 0.7], 30, (0.6, 0.6), (16, 24), V((-0.4, 0.4), (-0.3, 0.3), 0),
                            V((-0.04, 0.04), (-0.01, 0.03), (-0.02, 0.0)), 0.8, 1.9, fade=(2, 14), giro=(-3, 3)),
                     bolhas('Miolo', BOLA, CINZA, 24, (0.7, 0.7), (18, 26), V((-0.15, 0.15), (-0.15, 0.15), 0),
                            V(0, (0.0, 0.01), 0), 1.2, 2.4, fade=(2, 14)),
                 ])
    # marca o impacto (o tocador estica o Z dos nós de cima até o alvo)
    fim = no('Fim', 0, (1, 1), 1, (1, 1), (16, 16), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 2.2, 10)})
    return {'fim': 50, 'filhos': [emissor, fim]}


def nuvem():
    """a nuvem que engole uma casa: bolhas grandes subindo, miolo escuro e o anel no chão"""
    raiz = no('Nuvem', 0, (90, 90), 1, (1, 1), (0, 0), (0, 0, 0), pos={'t': 'fixo', 'p': V(0, 0, 0)}, filhos=[
        bolhas('Sombra', BOLA, SOMBRA, 8, (0.8, 0.8), (50, 65), V((-1.2, 1.2), (1.0, 3.2), (-1.2, 1.2)),
               V((-0.01, 0.01), (0.005, 0.015), (-0.01, 0.01)), 2.6, 5.0, fade=(5, 32)),
        bolhas('Bolhas', BOLA, BRANCA, 24, (0.6, 0.6), (50, 75), V((-1.9, 1.9), (0.4, 5.2), (-1.9, 1.9)),
               V((-0.025, 0.025), (0.01, 0.03), (-0.025, 0.025)), 2.4, 5.6, fade=(4, 36)),
        bolhas('Franja', FIAPO, [0.92, 0.93, 0.96, 0.6], 10, (1.5, 1.5), (30, 45), V((-1, 1), (0.4, 1.4), (-1, 1)),
               V((-0.08, 0.08), (0.0, 0.03), (-0.08, 0.08)), 1.2, 3.0, fade=(3, 22), giro=(-4, 4)),
        anel_chao('Sopro', 0, 30, 0.8, 4.2, [0.92, 0.93, 0.96, 0.3]),
    ])
    return {'fim': 80, 'filhos': [raiz]}


def prisao():
    """White Out: uma parede de fumaça gira em volta da área (raio ~1,5 casa),
    sobe, se fecha numa cúpula que engole tudo e estoura"""
    R = 6.4  # 1 casa ≈ 4 unidades
    giro = no('Giro', 0, (74, 74), 1, (1, 1), (0, 0), (0, 0, 0), eterno=False,
              pos={'t': 'fixo', 'p': V(0, 0, 0)},
              rot={'t': 'pva', 'p': V(0, 0, 0), 'v': V(0, 6, 0), 'a': V(0, 0.08, 0)},
              esc={'t': 'easing', 'de': V(1, 1, 1), 'ate': V(0.35, 1, 0.35)},
              filhos=[
                  # parede: muitas bolhas em volta, subindo alto (vivem além do giro: comPai falso)
                  dict(bolhas('Parede', BOLA, BRANCA, 520, (0.13, 0.13), (26, 36), V((-0.4, 0.4), (0, 1.5), (-0.4, 0.4)),
                              V(0, (0.12, 0.22), 0), 2.0, 4.4, fade=(3, 18), heranca=(1, 0, 0),
                              circulo={'eixo': 1, 'div': 24, 'ordem': 0, 'raio': F(R, R + 0.6), 'a0': F(0), 'a1': F(360), 'ruido': F(0)}), comPai=False),
                  dict(bolhas('Fiapos', FIAPO, [0.9, 0.92, 0.95, 0.6], 140, (0.5, 0.5), (18, 26), V(0, (0.5, 4.0), 0),
                              V(0, (0.05, 0.1), 0), 1.6, 3.0, fade=(3, 14), heranca=(1, 0, 0), giro=(-5, 5),
                              circulo={'eixo': 1, 'div': 16, 'ordem': 0, 'raio': F(R - 0.4, R + 1.0), 'a0': F(0), 'a1': F(360), 'ruido': F(0)}), comPai=False),
              ])
    domo = bolhas('Domo', BOLA, [0.86, 0.88, 0.92, 0.92], 22, (0.9, 0.9), (44, 58), V((-4.2, 4.2), (0.6, 6.0), (-4.2, 4.2)),
                  V((-0.01, 0.01), (0.0, 0.012), (-0.01, 0.01)), 4.5, 8.5, fade=(8, 26), atraso=(42, 42), heranca=(0, 0, 0))
    miolo = bolhas('Miolo', BOLA, SOMBRA, 10, (1.5, 1.5), (34, 44), V((-2.5, 2.5), (1.0, 4.0), (-2.5, 2.5)),
                   V(0, 0, 0), 3.5, 6.0, fade=(8, 22), atraso=(50, 50), heranca=(0, 0, 0))
    estouro = bolhas('Estouro', BOLA, BRANCA, 26, (0.12, 0.12), (30, 44), V((-1.5, 1.5), (0.5, 3.5), (-1.5, 1.5)),
                     V((-0.26, 0.26), (0.02, 0.08), (-0.26, 0.26)), 2.6, 6.0, fade=(2, 28), atraso=(72, 72), heranca=(0, 0, 0))
    return {'fim': 125, 'filhos': [
        anel_chao('Sopro', 0, 26, 1.0, 6.5, [0.9, 0.92, 0.95, 0.3]),
        giro, domo, miolo, estouro,
        anel_chao('Onda', 72, 34, 1.5, 10.0, [0.94, 0.95, 0.97, 0.45]),
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
        salvar(texs[t], os.path.join(pasta, t))
    json.dump(efeito, open(os.path.join(pasta, 'efeito.json'), 'w'), separators=(',', ':'))
    print(nome, sorted(usadas))


if __name__ == '__main__':
    texs = {BOLA: bola(), FIAPO: fiapo(), ONDA: onda()}
    gravar('fumaca-jato', jato(), texs)
    gravar('fumaca-nuvem', nuvem(), texs)
    gravar('fumaca-prisao', prisao(), texs)
