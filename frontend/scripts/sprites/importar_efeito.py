"""
Importa uma folha de efeito (spritesheet em fundo magenta) para o jogo.

Uso: python3 importar_efeito.py <folha> <nome> <linhas> <colunas> <direcoes> [fps]
  direcoes: as linhas da folha em ordem, separadas por vírgula (ex.: E,SE,NE,S,N)

Tira o magenta (chroma key) calculando a transparência de cada pixel e
recuperando a cor original nas bordas (sem franja rosa); cada pedaço do desenho
é separado do vizinho pela costura com menos desenho entre os dois quadros
(o rastro que invade a célula vizinha continua no quadro certo) — e
grava uma tira por direção em public/sprites/efeitos/<nome>/ + manifesto.json.
As direções que faltam (W, SW, NW) o jogo faz espelhando E, SE, NE.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

MAGENTA = np.array([245.0, 3.0, 250.0])


def tirar_magenta(q):
    """RGB (float) → RGBA sem o fundo magenta."""
    r, g, b = q[..., 0], q[..., 1], q[..., 2]
    # quanto o pixel é "magenta": azul e vermelho acima do verde
    m = np.clip((np.minimum(r, b) - g - 40) / (np.minimum(MAGENTA[0], MAGENTA[2]) - MAGENTA[1] - 40), 0, 1)
    a = 1 - m
    # recupera a cor da frente: obs = a*F + (1-a)*M
    fr = np.where(a[..., None] > 0.05, (q - (1 - a[..., None]) * MAGENTA) / np.maximum(a[..., None], 0.05), q)
    fr = np.clip(fr, 0, 255)
    # fogo não tem mais azul que verde: tira o resto do rosa
    fr[..., 2] = np.minimum(fr[..., 2], fr[..., 1] + 30)
    a = np.where(a < 0.08, 0, a)
    return np.dstack([fr, a * 255]).astype(np.uint8)


def costura(custo, eixo_centro):
    """Caminho de menor custo de cima a baixo (uma coluna por linha, passo ±1).
    custo: (h, w). Prefere passar perto de `eixo_centro`. Devolve x por linha."""
    h, w = custo.shape
    c = custo + 0.002 * np.abs(np.arange(w) - eixo_centro)[None, :]
    M = c.copy()
    for y in range(1, h):
        esq = np.r_[np.inf, M[y - 1, :-1]]
        dir_ = np.r_[M[y - 1, 1:], np.inf]
        M[y] += np.minimum(np.minimum(esq, M[y - 1]), dir_)
    xs = np.zeros(h, int)
    xs[-1] = int(np.argmin(M[-1]))
    for y in range(h - 2, -1, -1):
        x = xs[y + 1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        xs[y] = lo + int(np.argmin(M[y, lo:hi]))
    return xs


def faixas_ocupadas(perfil):
    ocupado = perfil > perfil.max() * 0.01
    faixas, ini = [], None
    for x, o in enumerate(ocupado):
        if o and ini is None:
            ini = x
        if not o and ini is not None:
            faixas.append((ini, x))
            ini = None
    if ini is not None:
        faixas.append((ini, len(perfil)))
    return [f for f in faixas if f[1] - f[0] > 3]


def importar(folha, nome, linhas, colunas, direcoes, fps):
    im = np.asarray(Image.open(folha).convert('RGB')).astype(np.float32)
    H, W = im.shape[:2]
    ch = H / linhas
    rgba = tirar_magenta(im)
    alfa = rgba[..., 3].astype(np.float32) / 255
    yy, xx = np.mgrid[:H, :W]
    # costuras entre linhas (horizontais): y por coluna
    lim_l = [np.zeros(W)] + [None] * (linhas - 1) + [np.full(W, H)]
    for r in range(1, linhas):
        b = r * ch
        y0, y1 = int(b - 0.35 * ch), int(b + 0.35 * ch)
        lim_l[r] = costura(alfa[y0:y1].T, b - y0) + y0
    masc_l = [(yy >= lim_l[li][None, :]) & (yy < lim_l[li + 1][None, :]) for li in range(linhas)]
    # colunas do artista (não é grade uniforme: os quadros pequenos ficam mais
    # juntos): os `colunas` picos de desenho de uma linha, com espaçamento
    # mínimo. Testa cada linha e fica com a mais bem espaçada (nas linhas com
    # rastro horizontal, um quadro passa por cima do outro).
    nucleo = np.exp(-0.5 * (np.arange(-45, 46) / 15) ** 2)
    sup = int(0.55 * W / colunas)

    def picos(perfil):
        perfil = np.convolve(perfil, nucleo / nucleo.sum(), 'same')
        cs = []
        for _ in range(colunas):
            x = int(np.argmax(perfil))
            cs.append(x)
            perfil[max(0, x - sup):x + sup] = -1
        return sorted(cs)

    def por_blocos(li):
        """Os `colunas` maiores blocos de desenho da linha (partes próximas
        juntas). Nota: menor = melhor (sem sobreposição entre os blocos e o
        próximo bloco bem menor, só faísca)."""
        y0, y1 = int(li * ch + ch * 0.1), int((li + 1) * ch - ch * 0.1)
        faixa = cv2.dilate((alfa[y0:y1] > 0.25).astype(np.uint8), np.ones((9, 9), np.uint8))
        n, _, st, cen = cv2.connectedComponentsWithStats(faixa)
        blocos = sorted(((st[k, 4], cen[k][0], st[k, 0], st[k, 0] + st[k, 2]) for k in range(1, n)), reverse=True)
        if len(blocos) < colunas:
            return None
        top = sorted(blocos[:colunas], key=lambda b: b[1])
        sobra = sum(max(0, top[i][3] - top[i + 1][2]) for i in range(colunas - 1))
        proximo = blocos[colunas][0] / blocos[colunas - 1][0] if len(blocos) > colunas else 0
        return sobra * 10 + proximo, [float(b[1]) for b in top]

    candidatos = [c for c in (por_blocos(li) for li in range(linhas)) if c]
    if candidatos and min(candidatos)[0] < 5:
        centros = min(candidatos)[1]
    else:
        # sem linha com os quadros separados: picos do perfil
        perfis = [(alfa * masc_l[li]).sum(0) for li in range(linhas)]
        centros = min((np.var(np.diff(np.diff(cs))), cs) for cs in (picos(pf.copy()) for pf in perfis))[1]
    divisas = [(centros[k - 1] + centros[k]) / 2 for k in range(1, colunas)]
    quadros, meia_l, meia_a = [], 1, 1
    for li in range(linhas):
        a_l = alfa * masc_l[li]
        lim_c = [np.zeros(H)]
        for k, b in enumerate(divisas):
            meia = min(45, (centros[k + 1] - centros[k]) * 0.3)
            x0, x1 = int(max(0, b - meia)), int(min(W, b + meia))
            lim_c.append(costura(a_l[:, x0:x1], b - x0) + x0)
        lim_c.append(np.full(H, W))
        cy = (li + 0.5) * ch
        qs = []
        for ci in range(colunas):
            m = masc_l[li] & (xx >= lim_c[ci][:, None]) & (xx < lim_c[ci + 1][:, None]) & (rgba[..., 3] > 0)
            ys, xs = np.nonzero(m)
            cx = centros[ci]
            if len(xs):
                meia_l = max(meia_l, np.abs(xs - cx).max())
                meia_a = max(meia_a, np.abs(ys - cy).max())
            qs.append((ys, xs, cx, cy))
        quadros.append(qs)
    # mesmo tamanho para todos; cada quadro ancorado no centro da sua coluna
    # (o movimento desenhado dentro da folha continua na animação)
    L, A = int(meia_l * 2) + 6, int(meia_a * 2) + 6
    raiz = os.path.dirname(os.path.abspath(__file__))
    pasta = os.path.join(raiz, '..', '..', 'public', 'sprites', 'efeitos', nome)
    os.makedirs(pasta, exist_ok=True)
    for li, d in enumerate(direcoes):
        tira = np.zeros((A, L * colunas, 4), np.uint8)
        for ci, (ys, xs, cx, cy) in enumerate(quadros[li]):
            qx = (xs - cx + L / 2).astype(int)
            qy = (ys - cy + A / 2).astype(int)
            ok = (qx >= 0) & (qx < L) & (qy >= 0) & (qy < A)
            tira[qy[ok], qx[ok] + ci * L] = rgba[ys[ok], xs[ok]]
        Image.fromarray(tira).save(os.path.join(pasta, f'{d}.png'), optimize=True)
    man = {'quadro': [L, A], 'quadros': colunas, 'fps': fps, 'direcoes': direcoes}
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(nome, man, 'colunas em', [int(c) for c in centros])


if __name__ == '__main__':
    a = sys.argv[1:]
    importar(a[0], a[1], int(a[2]), int(a[3]), a[4].split(','), int(a[5]) if len(a) > 5 else 16)
