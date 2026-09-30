"""
Monta animações de efeito a partir de uma ou várias folhas (fundo magenta).

Funções:
  quadros_linhas(folha, contagem) — recorta cada linha em N quadros pelas
      colunas vazias entre eles (os quadros não precisam ter a mesma largura);
  quadros_grade(folha, linhas, colunas) — grade uniforme;
  gravar(nome, quadros, fps, ancora) — grava a animação (atlas em grade) em
      public/sprites/efeitos/<nome>/ com o manifesto (modo 'unico').
Cada quadro é um RGBA já sem o magenta; `ancora` = 'chao' (base do desenho
no pé do quadro) ou 'centro'.
"""
import json
import math
import os

import numpy as np
from PIL import Image

import importlib.util

_spec = importlib.util.spec_from_file_location('ie', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'importar_efeito.py'))
ie = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ie)

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'sprites', 'efeitos')


def _rgba(folha):
    im = np.asarray(Image.open(folha).convert('RGB')).astype(np.float32)
    return ie.tirar_magenta(im)


def quadros_grade(folha, linhas, colunas):
    rgba = _rgba(folha)
    H, W = rgba.shape[:2]
    ch, cw = H / linhas, W / colunas
    return [[rgba[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)] for c in range(colunas)] for r in range(linhas)]


def _cortes(perfil, n):
    """n-1 colunas de corte: os vales mais fundos do perfil, afastados entre si."""
    p = np.convolve(perfil, np.ones(9) / 9, 'same')
    oc = np.nonzero(p > p.max() * 0.01)[0]
    x0, x1 = oc[0], oc[-1]
    sep = (x1 - x0) / n * 0.55
    cand = [x for x in range(x0 + 5, x1 - 5) if p[x] == p[x - 5:x + 6].min() and x0 + sep * 0.5 < x < x1 - sep * 0.5]
    cand.sort(key=lambda x: p[x])
    ch = []
    for x in cand:
        if all(abs(x - y) > sep for y in ch):
            ch.append(x)
        if len(ch) == n - 1:
            break
    return sorted(ch)


def quadros_linhas(folha, contagem):
    """Uma lista por linha; `contagem` = quadros de cada linha."""
    rgba = _rgba(folha)
    a = rgba[..., 3].astype(np.float32) / 255
    linhas = [b for b in ie.faixas_ocupadas(a.sum(1)) if b[1] - b[0] > 15]
    assert len(linhas) == len(contagem), (folha, len(linhas))
    # a faixa de cada linha vai até a metade do espaço vazio
    lim = [0] + [(linhas[i][1] + linhas[i + 1][0]) // 2 for i in range(len(linhas) - 1)] + [a.shape[0]]
    out = []
    for r, n in enumerate(contagem):
        y0, y1 = lim[r], lim[r + 1]
        corte = [0] + _cortes(a[y0:y1].sum(0), n) + [a.shape[1]]
        out.append([rgba[y0:y1, corte[i]:corte[i + 1]] for i in range(n)])
    return out


def aparar(q):
    """Recorta o quadro na caixa do desenho."""
    ys, xs = np.nonzero(q[..., 3] > 0)
    if not len(xs):
        return q[:1, :1]
    return q[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def escalar(q, k):
    if abs(k - 1) < 1e-3:
        return q
    h, w = q.shape[:2]
    return np.asarray(Image.fromarray(q).resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS))


def _salvar(nome, atlas, man, extra):
    pasta = os.path.join(RAIZ, nome)
    os.makedirs(pasta, exist_ok=True)
    for f in os.listdir(pasta):
        os.remove(os.path.join(pasta, f))
    Image.fromarray(atlas).save(os.path.join(pasta, 'S.png'), optimize=True)
    if extra:
        man.update(extra)
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(nome, man)
    return man


def _atlas(quadros, L, A, pos):
    n = len(quadros)
    gc = min(n, max(1, int(8192 // L)))
    gl = math.ceil(n / gc)
    atlas = np.zeros((A * gl, L * gc, 4), np.uint8)
    for i, q in enumerate(quadros):
        r, c = divmod(i, gc)
        h, w = q.shape[:2]
        x, y = pos(i)
        sub = atlas[r * A:(r + 1) * A, c * L:(c + 1) * L]
        y0, x0 = max(0, y), max(0, x)
        y1, x1 = min(A, y + h), min(L, x + w)
        if y1 > y0 and x1 > x0:
            sub[y0:y1, x0:x1] = q[y0 - y:y1 - y, x0 - x:x1 - x]
    return atlas, [gc, gl]


def gravar_ponto(nome, quadros, fps, px, extra=None):
    """quadros: lista de (rgba, ax, ay) — (ax, ay) é o ponto do desenho que
    fica fixo (pivô do sprite: gira e voa em torno dele). px = pixels por casa."""
    esq = max(ax for q, ax, ay in quadros)
    dir_ = max(q.shape[1] - ax for q, ax, ay in quadros)
    cima = max(ay for q, ax, ay in quadros)
    baixo = max(q.shape[0] - ay for q, ax, ay in quadros)
    L, A = int(esq + dir_) + 8, int(cima + baixo) + 8
    X, Y = int(esq) + 4, int(cima) + 4
    atlas, grade = _atlas([q for q, _, _ in quadros], L, A, lambda i: (X - int(quadros[i][1]), Y - int(quadros[i][2])))
    man = {'quadro': [L, A], 'quadros': len(quadros), 'grade': grade, 'fps': fps, 'direcoes': ['S'], 'modo': 'unico',
           'centro': [round(X / L, 4), round(1 - Y / A, 4)], 'largura': round(L / px, 3)}
    return _salvar(nome, atlas, man, extra)


def gravar(nome, quadros, fps, ancora='chao', ancora_x='centro', extra=None):
    """quadros: lista de (rgba, dx, dy) — deslocamento do desenho em relação
    à âncora (px). ancora 'chao': o fundo do desenho + dy fica no pé do quadro."""
    Ls = [q.shape[1] + 2 * abs(dx) for q, dx, dy in quadros]
    As = [q.shape[0] + abs(dy) for q, dx, dy in quadros]
    L = int(max(Ls)) + 8
    A = int(max(As)) + 8 if ancora == 'chao' else int(max(q.shape[0] + 2 * abs(dy) for q, dx, dy in quadros)) + 8
    n = len(quadros)
    gc = min(n, max(1, int(8192 // L)))
    gl = math.ceil(n / gc)
    atlas = np.zeros((A * gl, L * gc, 4), np.uint8)
    for i, (q, dx, dy) in enumerate(quadros):
        r, c = divmod(i, gc)
        h, w = q.shape[:2]
        x = int(L / 2 - w / 2 + dx) if ancora_x == 'centro' else int(dx)
        y = A - 4 - h + int(dy) if ancora == 'chao' else int(A / 2 - h / 2 + dy)
        sub = atlas[r * A:(r + 1) * A, c * L:(c + 1) * L]
        y0, x0 = max(0, y), max(0, x)
        y1, x1 = min(A, y + h), min(L, x + w)
        if y1 > y0 and x1 > x0:
            sub[y0:y1, x0:x1] = np.maximum(sub[y0:y1, x0:x1], q[y0 - y:y1 - y, x0 - x:x1 - x]) if False else q[y0 - y:y1 - y, x0 - x:x1 - x]
    pasta = os.path.join(RAIZ, nome)
    os.makedirs(pasta, exist_ok=True)
    for f in os.listdir(pasta):
        os.remove(os.path.join(pasta, f))
    Image.fromarray(atlas).save(os.path.join(pasta, 'S.png'), optimize=True)
    man = {'quadro': [L, A], 'quadros': n, 'grade': [gc, gl], 'fps': fps, 'direcoes': ['S'], 'modo': 'unico', 'ancora': ancora}
    if extra:
        man.update(extra)
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(nome, {k: v for k, v in man.items()})
    return man
