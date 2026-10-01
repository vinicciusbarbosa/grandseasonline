"""
Arte parada de um personagem (imagens geradas, fundo branco) → recortes
transparentes para a batalha por turnos, animados só por código.

    python3 arte.py <pasta-com-as-imagens> <saida/>

Na pasta: parado.png, atacar.png, apanhar.png (de frente), costas.png e
splash.png (cut-in). Cada pose vira um .webp com alfa; o arte.json guarda o pé
(pivô, em fração da imagem) e a altura de referência de cada uma — as poses
saem na mesma escala do personagem (pela cabeça), não pela altura do recorte.
"""
import json, os, sys
import cv2, numpy as np
from scipy import ndimage

ORIGEM, SAIDA = sys.argv[1], sys.argv[2]
ALTURA = 900  # px da pose "parado" na saída (do topo da cabeça ao pé)


def recortar(img):
    """Alfa: o branco ligado à borda é fundo; as linhas do desenho seguram o resto."""
    branco = img.min(axis=2) > 236
    lab, _ = ndimage.label(branco)
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fundo = np.isin(lab, list(borda))
    corpo = ndimage.binary_fill_holes(~fundo)
    # só o maior pedaço (e o que encosta nele): some sujeira solta
    lab2, n2 = ndimage.label(ndimage.binary_dilation(corpo, iterations=3))
    tam = ndimage.sum(corpo, lab2, range(1, n2 + 1))
    corpo &= lab2 == (np.argmax(tam) + 1)
    # borda suave: 1 px de transição
    a = cv2.GaussianBlur(corpo.astype(np.float32), (3, 3), 0.8)
    a = np.clip((a - 0.15) / 0.7, 0, 1)
    # tira o halo branco da borda: escurece levemente onde o alfa é parcial
    rgb = img.astype(np.float32)
    rgb = rgb * (0.75 + 0.25 * a[..., None])
    return np.dstack([rgb, a * 255]).astype(np.uint8)


def caixa(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 20)
    return xs.min(), ys.min(), xs.max(), ys.max()


os.makedirs(SAIDA, exist_ok=True)
info = {}
# escala de cada pose em relação ao "parado" (mesmo tamanho de cabeça,
# medido à mão nas imagens: largura da cabeça com cabelo)
CABECA = {'parado': 205, 'atacar': 200, 'apanhar': 220, 'costas': 190}
for nome in ('parado', 'atacar', 'apanhar', 'costas'):
    img = cv2.imread(os.path.join(ORIGEM, f'{nome}.png'))
    rgba = recortar(img)
    x0, y0, x1, y1 = caixa(rgba)
    rgba = rgba[max(0, y0 - 4):y1 + 5, max(0, x0 - 4):x1 + 5]
    if nome == 'parado':
        k = ALTURA / rgba.shape[0]
        k_parado = k
        cab_parado = CABECA['parado']
    else:
        k = k_parado * cab_parado / CABECA[nome]
    rgba = cv2.resize(rgba, (round(rgba.shape[1] * k), round(rgba.shape[0] * k)), interpolation=cv2.INTER_AREA)
    # pé: o ponto mais baixo do corpo, no meio entre os dois pés (centro da sola)
    a = rgba[..., 3] > 20
    ys, xs = np.nonzero(a)
    baixo = ys.max()
    sola = xs[ys > baixo - rgba.shape[0] * 0.06]
    pe_x = (sola.min() + sola.max()) / 2 if nome != 'apanhar' else np.median(xs)
    # o meio do corpo (para centralizar na casa): média das colunas ocupadas
    meio = float(np.average(np.arange(a.shape[1]), weights=a.sum(0)))
    cv2.imwrite(os.path.join(SAIDA, f'{nome}.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 90])
    info[nome] = {'l': rgba.shape[1], 'a': rgba.shape[0], 'pe': [round(meio / rgba.shape[1], 4), round(baixo / rgba.shape[0], 4)]}
    print(nome, rgba.shape, info[nome])

sp = cv2.imread(os.path.join(ORIGEM, 'splash.png'))
sp = cv2.resize(sp, (1280, round(sp.shape[0] * 1280 / sp.shape[1])), interpolation=cv2.INTER_AREA)
cv2.imwrite(os.path.join(SAIDA, 'splash.webp'), sp, [cv2.IMWRITE_WEBP_QUALITY, 86])
info['altura'] = ALTURA
with open(os.path.join(SAIDA, 'arte.json'), 'w') as f:
    json.dump(info, f)
print('ok')
