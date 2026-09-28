"""
Importa folhas de sprites geradas por IA (fundo magenta) para o jogo.

    # folha de referência: 1 linha com as 5 direções (S, SE, E, NE, N)
    python3 frontend/scripts/sprites/importar_folha.py referencia \\
        frontend/scripts/sprites/fonte/almirante/referencia.png almirante

    # folha de animação: 12 quadros de UMA direção, em qualquer grade
    python3 frontend/scripts/sprites/importar_folha.py animacao \\
        frontend/scripts/sprites/fonte/almirante/andar_S.png almirante andar S

O que faz com a imagem, do jeito que a IA entregar:
  1. tira o fundo magenta;
  2. acha cada figura (colunas da referência ou células da grade);
  3. reduz para a pixel art de verdade (média por área) com a altura padrão;
  4. prende as cores na paleta do personagem (tirada da referência), para
     todas as folhas terem as mesmas cores;
  5. alinha o pé de todos os quadros no mesmo ponto do quadro 128×128;
  6. põe contorno escuro de 1 pixel;
  7. salva em frontend/public/sprites/<personagem>/ e atualiza o manifesto.

Especificação completa: SPRITES.md.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
QUADRO = 128
PE = (64, 112)
ALTURA = 104  # do pé ao topo do chapéu (≈96 sem o chapéu)
CORES = 48
DIRECOES = ['S', 'SE', 'E', 'NE', 'N']


def carregar(caminho):
    rgb = np.asarray(Image.open(caminho).convert('RGB')).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # magenta: vermelho e azul altos, verde baixo
    fundo = (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)
    alfa = (~fundo).astype(np.uint8)
    # tira sujeira solta e franjas rosadas da borda
    alfa = cv2.morphologyEx(alfa, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return rgb.astype(np.float32), alfa > 0


def figuras_em_colunas(alfa, n):
    """Separa n figuras lado a lado pelas faixas vazias entre elas."""
    ocupado = alfa.any(axis=0)
    grupos = []
    x = 0
    W = alfa.shape[1]
    while x < W:
        if ocupado[x]:
            x0 = x
            while x < W and ocupado[x]:
                x += 1
            grupos.append((x0, x))
        x += 1
    # junta pedaços muito próximos até sobrarem n grupos
    while len(grupos) > n:
        vaos = [grupos[i + 1][0] - grupos[i][1] for i in range(len(grupos) - 1)]
        i = int(np.argmin(vaos))
        grupos[i] = (grupos[i][0], grupos[i + 1][1])
        del grupos[i + 1]
    return grupos


def recortar(rgb, alfa, x0, x1, y0, y1):
    a = alfa[y0:y1, x0:x1]
    ys, xs = np.nonzero(a)
    return rgb[y0 + ys.min():y0 + ys.max() + 1, x0 + xs.min():x0 + xs.max() + 1], a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def reduzir(rgb, alfa, escala):
    """Média por área (só dos pixels da figura) para a escala da pixel art."""
    h, w = alfa.shape
    H = max(1, round(h * escala))
    W = max(1, round(w * escala))
    m = alfa.astype(np.float32)
    soma = cv2.resize(rgb * m[..., None], (W, H), interpolation=cv2.INTER_AREA)
    peso = cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)
    cor = soma / np.maximum(peso, 1e-6)[..., None]
    return cor, peso > 0.45


def paleta_de(cores):
    px = cores.reshape(-1, 3).astype(np.float32)
    _, _, centros = cv2.kmeans(px, CORES, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 6, cv2.KMEANS_PP_CENTERS)
    return centros


def quantizar(cor, paleta):
    d = ((cor[..., None, :] - paleta[None, None]) ** 2).sum(-1)
    return paleta[d.argmin(-1)]


def contorno(img):
    a = img[..., 3] > 0
    viz = cv2.dilate(a.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
    borda = viz & ~a
    out = img.copy()
    # contorno escuro puxado para a cor vizinha
    media = cv2.blur(img[..., :3].astype(np.float32) * a[..., None], (3, 3)) / np.maximum(cv2.blur(a.astype(np.float32), (3, 3)), 1e-6)[..., None]
    out[borda, :3] = (20 + media[borda] * 0.16).astype(np.uint8)
    out[borda, 3] = 255
    return out


def encaixar(cor, mascara, paleta):
    """Põe a figura reduzida no quadro 128×128 com o pé na âncora."""
    q = quantizar(cor, paleta).clip(0, 255).astype(np.uint8)
    h, w = mascara.shape
    # centro do pé: meio dos pixels das 6 linhas de baixo
    ys, xs = np.nonzero(mascara[max(0, h - 6):])
    cx = int(round(xs.mean())) if len(xs) else w // 2
    img = np.zeros((QUADRO, QUADRO, 4), np.uint8)
    ox = PE[0] - cx
    oy = PE[1] - h
    for y in range(h):
        for x in range(w):
            if mascara[y, x]:
                X, Y = x + ox, y + oy
                if 0 <= X < QUADRO and 0 <= Y < QUADRO:
                    img[Y, X, :3] = q[y, x]
                    img[Y, X, 3] = 255
    return contorno(img)


def manifesto(personagem):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    os.makedirs(pasta, exist_ok=True)
    caminho = os.path.join(pasta, 'manifesto.json')
    if os.path.exists(caminho):
        with open(caminho) as f:
            return pasta, caminho, json.load(f)
    return pasta, caminho, {'quadro': [QUADRO, QUADRO], 'pe': list(PE), 'anims': {}}


def salvar_tira(pasta, nome, quadros):
    tira = np.concatenate(quadros, axis=1)
    Image.fromarray(tira).save(os.path.join(pasta, nome), optimize=True)


def importar_referencia(arquivo, personagem):
    rgb, alfa = carregar(arquivo)
    pasta, cam, man = manifesto(personagem)
    grupos = figuras_em_colunas(alfa, 5)
    recortes = [recortar(rgb, alfa, x0, x1, 0, alfa.shape[0]) for x0, x1 in grupos]
    altura = float(np.median([a.shape[0] for _, a in recortes]))
    escala = ALTURA / altura
    reduzidos = [reduzir(c, a, escala) for c, a in recortes]
    paleta = paleta_de(np.concatenate([c[m] for c, m in reduzidos]))
    man['paleta'] = paleta.round().astype(int).tolist()
    man['alturaFonte'] = altura
    for d, (c, m) in zip(DIRECOES, reduzidos):
        nome = f'parado_{d}.png'
        salvar_tira(pasta, nome, [encaixar(c, m, paleta)])
        man['anims'].setdefault('parado', {})[d] = {'arquivo': nome, 'quadros': 1}
    with open(cam, 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem}: 5 direções, escala {escala:.3f}, altura na fonte {altura:.0f}px → {pasta}')


def faixas(ocupado, vao_min):
    """Trechos ocupados separados por pelo menos `vao_min` vazios."""
    trechos = []
    i = 0
    n = len(ocupado)
    while i < n:
        if ocupado[i]:
            j = i
            while j < n and ocupado[j]:
                j += 1
            if trechos and i - trechos[-1][1] < vao_min:
                trechos[-1] = (trechos[-1][0], j)
            else:
                trechos.append((i, j))
            i = j
        else:
            i += 1
    return trechos


def achar_quadros(alfa):
    """Acha as figuras em qualquer grade: faixas de linhas, depois de colunas.
    Ordem de leitura: esquerda→direita, cima→baixo."""
    H, W = alfa.shape
    quadros = []
    for y0, y1 in faixas(alfa.any(axis=1), 2):
        for x0, x1 in faixas(alfa[y0:y1].any(axis=0), max(4, W // 60)):
            if alfa[y0:y1, x0:x1].sum() > 400:
                quadros.append((x0, x1, y0, y1))
    return quadros


def importar_animacao(arquivo, personagem, anim, direcao):
    rgb, alfa = carregar(arquivo)
    pasta, cam, man = manifesto(personagem)
    if 'paleta' not in man:
        sys.exit('importe a referência do personagem primeiro (ela define a paleta)')
    paleta = np.array(man['paleta'], np.float32)
    celulas = [recortar(rgb, alfa, x0, x1, y0, y1) for x0, x1, y0, y1 in achar_quadros(alfa)]
    # escala da folha: altura típica (mediana) das figuras ≈ ALTURA
    altura = float(np.median([a.shape[0] for _, a in celulas]))
    escala = ALTURA / altura
    quadros = [encaixar(*reduzir(c, a, escala), paleta) for c, a in celulas]
    nome = f'{anim}_{direcao}.png'
    salvar_tira(pasta, nome, quadros)
    man['anims'].setdefault(anim, {})[direcao] = {'arquivo': nome, 'quadros': len(quadros)}
    with open(cam, 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} {anim} {direcao}: {len(quadros)} quadros, escala {escala:.3f}')


if __name__ == '__main__':
    modo = sys.argv[1]
    if modo == 'referencia':
        importar_referencia(sys.argv[2], sys.argv[3])
    elif modo == 'animacao':
        importar_animacao(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    else:
        sys.exit(__doc__)
