"""Gera os dados do mundo usados pela tela de navegação.

Lê o mundo do jogo legado e produz dois arquivos:

- ``frontend/public/mundo/terra.png`` (1840x1440, 10 px do mundo por pixel):
    R = distância com sinal até a costa (128 = costa, >128 água, <128 terra)
    G = tipo de terra (0 ilha, 128 Red Line, 255 montanha de borda)
    B = névoa fixa (0..255)
- ``frontend/src/navegacao/mundo/mundo.json``: grade lógica 460x360 (bloqueio em
  RLE), ilhas, correntes e redemoinhos.

A costa vem da arte original (``public/Imagens/Mapa/Mapa_Mundi``): é a única
fonte com o contorno real das terras. O bloqueio lógico é a união dessa arte com
``mapa_nao_navegavel.json``, o que o servidor de mapa do legado já usa.

Rodar da raiz do repositório (precisa de Pillow, numpy, scipy e PyYAML):

    python3 frontend/scripts/gerar_mundo.py
"""

import json
from pathlib import Path

import numpy as np
import yaml
from PIL import Image
from scipy import ndimage

RAIZ = Path(__file__).resolve().parents[2]
DADOS = RAIZ / "public" / "Data"
ARTE = RAIZ / "public" / "Imagens" / "Mapa" / "Mapa_Mundi"

LARGURA, ALTURA = 460, 360  # células lógicas (SQUARE_SIZE 40 no legado)
CELULA = 40  # px do mundo por célula
SUB = 4  # subdivisões por célula no mapa visual (10 px por pixel)
TILES_X, TILES_Y = 23, 18  # Mapa_Mundi: 23x18 imagens de 800 px
ALCANCE_SDF = 32  # em pixels do mapa visual

# Recorte usado no protótipo: o East Blue inteiro e a borda do Calm Belt.
# Coordenadas em células do mundo legado. Para gerar o mundo todo: (0, 0, 460, 360).
RECORTE = (230, 0, 230, 112)


def carregar_arte() -> np.ndarray:
    lado = 800 // (CELULA // SUB)  # 80 px por tile no mapa visual
    img = np.zeros((TILES_Y * lado, TILES_X * lado, 3), dtype=np.float32)
    for tx in range(TILES_X):
        for ty in range(TILES_Y):
            tile = Image.open(ARTE / f"{tx}_{ty}.jpg").convert("RGB").resize((lado, lado), Image.BOX)
            img[ty * lado:(ty + 1) * lado, tx * lado:(tx + 1) * lado] = np.asarray(tile, dtype=np.float32)
    return img


def celulas(caminho: Path):
    """Itera (x, y, valor) num JSON {x: {y: valor}}; o PHP às vezes serializa como lista."""
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    for x, linha in dados.items():
        pares = linha.items() if isinstance(linha, dict) else enumerate(linha)
        for y, valor in pares:
            if valor not in (None, [], ""):
                yield int(x), int(y), valor


def main() -> None:
    mundo = yaml.safe_load((DADOS / "mundo.yaml").read_text(encoding="utf-8"))
    ilhas = [
        {"id": int(i["ilha"]), "nome": i["nome"], "mar": int(i["mar"]), "x": int(i["x"]), "y": int(i["y"])}
        for i in mundo["ilhas"].values()
        if "x" in i and "y" in i
    ]
    mares = {int(k): v["nome"] for k, v in mundo["mares"].items()}

    # --- Água segundo a arte ---------------------------------------------------
    arte = carregar_arte()
    r, g, b = arte[..., 0], arte[..., 1], arte[..., 2]
    agua = (b > r + 25) & (b >= g - 5)
    # Tira os pontinhos azuis do meio da rocha e fecha frestas de 1 px.
    agua = ndimage.binary_opening(agua, iterations=2)

    # Só conta a água ligada a alguma doca: sobra de azul dentro de montanha vira terra.
    rotulos, _ = ndimage.label(agua)
    ligados = {rotulos[i["y"] * SUB + SUB // 2, i["x"] * SUB + SUB // 2] for i in ilhas} - {0}
    agua = np.isin(rotulos, list(ligados))

    terra = ~agua
    # Buraquinhos de terra menores que meia célula são ruído da arte (ícones, nuvens).
    rot_terra, n_terra = ndimage.label(terra)
    tamanhos = ndimage.sum(terra, rot_terra, range(1, n_terra + 1))
    for idx, tam in enumerate(tamanhos, start=1):
        if tam < 3:
            terra[rot_terra == idx] = False
    rot_terra, n_terra = ndimage.label(terra)
    tamanhos = ndimage.sum(terra, rot_terra, range(1, n_terra + 1))

    # --- Tipo de terra -----------------------------------------------------------
    alt, larg = terra.shape
    ys, xs = np.mgrid[0:alt, 0:larg]
    cx, cy = xs / SUB, ys / SUB
    grande = np.zeros_like(terra)
    for idx, tam in enumerate(tamanhos, start=1):
        if tam > 4000:
            grande |= rot_terra == idx
    tipo = np.zeros(terra.shape, dtype=np.uint8)
    borda = (cy < 22) | (cy > 336)
    tipo[grande & ~borda] = 128
    tipo[grande & borda] = 255
    tipo = ndimage.uniform_filter(tipo.astype(np.float32), size=9).astype(np.uint8)

    # --- Distância com sinal até a costa ------------------------------------------
    dist_agua = ndimage.distance_transform_edt(agua)
    dist_terra = ndimage.distance_transform_edt(terra)
    sdf = np.where(agua, dist_agua - 0.5, -(dist_terra - 0.5))
    canal_r = np.clip(128 + sdf * (127 / ALCANCE_SDF), 0, 255).astype(np.uint8)

    # --- Névoa fixa ------------------------------------------------------------------
    nevoa = np.zeros((ALTURA, LARGURA), dtype=np.float32)
    for x, y, v in celulas(DADOS / "mapa_nevoa.json"):
        if 0 <= x < LARGURA and 0 <= y < ALTURA:
            nevoa[y, x] = float(v) / 100
    nevoa_vis = np.asarray(
        Image.fromarray((nevoa * 255).astype(np.uint8)).resize((larg, alt), Image.BILINEAR)
    )

    x0, y0, rl, ra = RECORTE
    fatia = np.s_[y0 * SUB:(y0 + ra) * SUB, x0 * SUB:(x0 + rl) * SUB]
    canal_r, tipo, nevoa_vis, terra = canal_r[fatia], tipo[fatia], nevoa_vis[fatia], terra[fatia]

    destino_png = RAIZ / "frontend" / "public" / "mundo" / "terra.png"
    destino_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.dstack([canal_r, tipo, nevoa_vis])).save(destino_png, optimize=True)

    # --- Grade lógica -----------------------------------------------------------------
    # Bloqueada se a arte diz terra em mais da metade da célula, ou se o legado bloqueia.
    def dentro(x: int, y: int) -> bool:
        return x0 <= x < x0 + rl and y0 <= y < y0 + ra

    fracao_terra = terra.reshape(ra, SUB, rl, SUB).mean(axis=(1, 3))
    bloqueio = fracao_terra > 0.5
    for x, y, _ in celulas(DADOS / "mapa_nao_navegavel.json"):
        if dentro(x, y):
            bloqueio[y - y0, x - x0] = True
    ilhas = [i for i in ilhas if dentro(i["x"], i["y"])]
    for i in ilhas:  # a doca é sempre navegável, como no servidor de mapa do legado
        bloqueio[i["y"] - y0, i["x"] - x0] = False

    plano = bloqueio.flatten().astype(np.uint8)
    rle, atual, cont = [], 0, 0
    for v in plano:
        if v == atual:
            cont += 1
        else:
            rle.append(cont)
            atual, cont = v, 1
    rle.append(cont)

    correntes = [
        [x - x0, y - y0, int(v["direcao"]), int(v["intensidade"])]
        for x, y, v in celulas(DADOS / "mapa_corrente.json")
        if dentro(x, y)
    ]

    redemoinho = np.zeros((ALTURA, LARGURA), dtype=bool)
    for x, y, _ in celulas(DADOS / "mapa_redemoinho.json"):
        if dentro(x, y):
            redemoinho[y, x] = True
    rot_red, n_red = ndimage.label(redemoinho)
    redemoinhos = []
    for idx in range(1, n_red + 1):
        py, px = np.nonzero(rot_red == idx)
        raio = max(px.max() - px.min(), py.max() - py.min()) / 2 + 0.5
        redemoinhos.append([round(float(px.mean()) + 0.5 - x0, 2), round(float(py.mean()) + 0.5 - y0, 2), round(float(raio), 2)])

    saida = {
        "origem": [x0, y0],
        "largura": rl,
        "altura": ra,
        "celula": CELULA,
        "subdivisao": SUB,
        "bloqueioRle": rle,
        "mares": mares,
        "ilhas": [{**i, "x": i["x"] - x0, "y": i["y"] - y0} for i in sorted(ilhas, key=lambda i: i["id"])],
        "correntes": correntes,
        "redemoinhos": redemoinhos,
    }
    destino_json = RAIZ / "frontend" / "src" / "navegacao" / "mundo" / "mundo.json"
    destino_json.parent.mkdir(parents=True, exist_ok=True)
    destino_json.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"recorte {RECORTE}: terra.png {destino_png.stat().st_size // 1024} KB, mundo.json {destino_json.stat().st_size // 1024} KB")
    print(f"{len(ilhas)} ilhas, {len(correntes)} correntes, {len(redemoinhos)} redemoinhos, "
          f"{int(bloqueio.sum())} células bloqueadas")


if __name__ == "__main__":
    main()
