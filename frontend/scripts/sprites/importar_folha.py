"""
Importa folhas de sprites geradas por IA (fundo magenta) para o jogo.

    # folha de referência: 1 linha com as 5 direções (S, SE, E, NE, N)
    python3 frontend/scripts/sprites/importar_folha.py referencia \\
        frontend/scripts/sprites/fonte/almirante/referencia.png almirante

    # animação de UMA direção: uma ou mais imagens (vírgula), em qualquer grade;
    # para a qualidade da referência: 3 imagens de 4 quadros, boneco ~700 px
    python3 frontend/scripts/sprites/importar_folha.py animacao \\
        frontend/scripts/sprites/fonte/almirante/andar_S.png almirante andar S

    # variação sorteada de vez em quando (ex.: rajada de vento no parado)
    python3 frontend/scripts/sprites/importar_folha.py animacao \\
        .../parado_S_vento.png almirante parado:vento S

    # quadros fora de ordem na folha: 6º argumento com a ordem (começa em 1)
    python3 frontend/scripts/sprites/importar_folha.py animacao \\
        .../andar_S_folha.png almirante andar S 1,2,3,8,5,6,7,4

O que faz com a imagem, do jeito que a IA entregar:
  1. tira o fundo magenta;
  2. acha cada figura (colunas da referência ou células da grade);
  3. converte para a pixel art na resolução nativa (176 px de altura);
  4. prende as cores na paleta do personagem (tirada da referência), para
     todas as folhas terem as mesmas cores;
  5. alinha o pé de todos os quadros no mesmo ponto do quadro 224×224;
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
# Modo "pixel art HD": guarda a arte como a IA entrega (só reduz para ~352 px
# de altura), sem forçar a grade de pixels nem reduzir as cores — textos e
# detalhes finos (MARINE no quepe) continuam legíveis. DENSIDADE = texels por
# "pixel de arte" do tabuleiro (a casa mede 108 pixels de arte).
HD = True
DENSIDADE = 2 if HD else 1
ALTURA = 176 * DENSIDADE
QUADRO = 224 * DENSIDADE
PE = (112 * DENSIDADE, 200 * DENSIDADE)
CORES = 128
# alinhar cada quadro pela cabeça/tronco ao molde da referência (desligado:
# com as folhas da IA piorou o tremido)
ALINHAR_PELO_MOLDE = False
DIRECOES = ['S', 'SE', 'E', 'NE', 'N']


def carregar(caminho):
    rgb = np.asarray(Image.open(caminho).convert('RGB')).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # magenta e as bordas misturadas com ele (rosado): vermelho e azul bem
    # acima do verde
    fundo = ((np.minimum(r, b) - g) > 60) & (np.abs(r - b) < 110)
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


def rosado(cor):
    """Pixels contaminados pelo fundo magenta (borda da figura)."""
    r, g, b = cor[..., 0], cor[..., 1], cor[..., 2]
    return (r - g > 70) & (b - g > 50) & (r > 120) & (b > 100)


def reduzir(rgb, alfa, escala):
    """Volta para a pixel art de verdade.

    Se a IA desenhou cada pixel da arte como um bloco de b×b (1/escala perto de
    um inteiro), acha o alinhamento da grade e pega a cor mais comum do miolo de
    cada bloco — sem misturar vizinhos. Senão, média por área."""
    b = round(1 / escala)
    if not HD and b >= 2 and abs(1 / escala - b) < 0.3:
        # a IA quase nunca acerta o bloco exato (4,14 em vez de 4): ajusta a
        # figura para blocos inteiros antes de ler a grade
        if abs(1 / escala - b) > 0.02:
            k = b * escala
            nh, nw = round(alfa.shape[0] * k), round(alfa.shape[1] * k)
            rgb = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_NEAREST)
            alfa = cv2.resize(alfa.astype(np.uint8), (nw, nh), interpolation=cv2.INTER_NEAREST) > 0
        g = rgb.mean(-1)
        melhor = None
        for fy in range(b):
            for fx in range(b):
                hh = (g.shape[0] - fy) // b * b
                ww = (g.shape[1] - fx) // b * b
                blocos = g[fy:fy + hh, fx:fx + ww].reshape(hh // b, b, ww // b, b)
                v = blocos.var(axis=(1, 3)).mean()
                if melhor is None or v < melhor[0]:
                    melhor = (v, fx, fy, hh, ww)
        _, fx, fy, hh, ww = melhor
        c = rgb[fy:fy + hh, fx:fx + ww].reshape(hh // b, b, ww // b, b, 3)
        a = alfa[fy:fy + hh, fx:fx + ww].reshape(hh // b, b, ww // b, b)
        # miolo do bloco (sem a borda, onde a IA borra) → mediana
        m = 1 if b >= 3 else 0
        miolo = c[:, m:b - m, :, m:b - m].transpose(0, 2, 1, 3, 4).reshape(hh // b, ww // b, -1, 3)
        cor = np.median(miolo, axis=2)
        return cor, (a.mean(axis=(1, 3)) > 0.5) & ~rosado(cor)
    h, w = alfa.shape
    H = max(1, round(h * escala))
    W = max(1, round(w * escala))
    m = alfa.astype(np.float32)
    soma = cv2.resize(rgb * m[..., None], (W, H), interpolation=cv2.INTER_AREA)
    peso = cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)
    cor = soma / np.maximum(peso, 1e-6)[..., None]
    return cor, (peso > 0.45) & ~rosado(cor)


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


def limpar(cor, mascara, paleta):
    """Cores finais e máscara sem pedaços soltos (restos do quadro vizinho)."""
    q = (cor if paleta is None else quantizar(cor, paleta)).clip(0, 255).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(mascara.astype(np.uint8), connectivity=8)
    if n > 2:
        maior = st[1:, cv2.CC_STAT_AREA].max()
        manter = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= maior * 0.03]
        mascara = np.isin(lab, manter)
    return q, mascara


def eixos(mascara):
    """Centro dos pés (linhas de baixo) e da cabeça (20% de cima)."""
    h, w = mascara.shape
    _, xs = np.nonzero(mascara[max(0, h - 6):])
    pe = xs.mean() if len(xs) else w / 2
    _, xs2 = np.nonzero(mascara[: max(1, h // 5)])
    return pe, (xs2.mean() if len(xs2) else pe)


def colocar(q, mascara, cx):
    """Põe a figura no quadro: coluna `cx` da figura no x da âncora, base no chão."""
    h, w = mascara.shape
    img = np.zeros((QUADRO, QUADRO, 4), np.uint8)
    ox = PE[0] - int(round(cx))
    oy = PE[1] - h
    ys, xs = np.nonzero(mascara)
    X, Y = xs + ox, ys + oy
    ok = (X >= 0) & (X < QUADRO) & (Y >= 0) & (Y < QUADRO)
    img[Y[ok], X[ok], :3] = q[ys[ok], xs[ok]]
    img[Y[ok], X[ok], 3] = 255
    return img


def encaixar_folha(figuras, paleta, pela_cabeca=False):
    """Encaixa todos os quadros de uma animação.

    Cada quadro é firmado pela média cabeça+pés (a casaca abrindo não o puxa
    para os lados); depois a folha inteira é deslocada de uma vez para os
    PÉS caírem no centro da casa (na diagonal o corpo é inclinado, e a média
    sozinha deixava os pés fora do centro).
    `pela_cabeca`: animações com passos (um pé no ar puxa o "centro dos pés"
    para o lado do pé apoiado) firmam só pela cabeça."""
    limpas = [limpar(c, m, paleta) for c, m in figuras]
    medidas = [eixos(m) for _, m in limpas]
    firmes = [cab if pela_cabeca else (pe + cab) / 2 for pe, cab in medidas]
    ajuste = float(np.median([pe - f for (pe, _), f in zip(medidas, firmes)]))
    return [colocar(q, m, f + ajuste) for (q, m), f in zip(limpas, firmes)]


def encaixar(cor, mascara, paleta):
    """Um quadro só (referência): pés no centro."""
    return encaixar_folha([(cor, mascara)], paleta)[0]


def manifesto(personagem):
    pasta = os.path.join(RAIZ, 'public', 'sprites', personagem)
    os.makedirs(pasta, exist_ok=True)
    caminho = os.path.join(pasta, 'manifesto.json')
    if os.path.exists(caminho):
        with open(caminho) as f:
            man = json.load(f)
        if man.get('densidade', 1) != DENSIDADE:
            man['anims'] = {}  # folhas de outro modo não servem mais
        man.update({'quadro': [QUADRO, QUADRO], 'pe': list(PE), 'altura': ALTURA, 'densidade': DENSIDADE})
        return pasta, caminho, man
    return pasta, caminho, {'quadro': [QUADRO, QUADRO], 'pe': list(PE), 'altura': ALTURA, 'densidade': DENSIDADE, 'anims': {}}


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
    moldes = os.path.join(os.path.dirname(os.path.abspath(arquivo)), 'moldes')
    os.makedirs(moldes, exist_ok=True)
    for d, (c, m) in zip(DIRECOES, reduzidos):
        nome = f'parado_{d}.png'
        q = encaixar(c, m, None if HD else paleta)
        # molde: todas as animações desta direção se alinham a ele
        Image.fromarray(q).save(os.path.join(moldes, f'{d}.png'))
        salvar_tira(pasta, nome, [q])
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
    linhas = []
    for y0, y1 in faixas(alfa.any(axis=1), 2):
        trechos = [(x0, x1) for x0, x1 in faixas(alfa[y0:y1].any(axis=0), 3) if alfa[y0:y1, x0:x1].sum() > 400]
        if trechos:
            linhas.append((y0, y1, trechos))
    # largura típica de UM quadro, na folha inteira: quadros encostados (casaca
    # tocando o vizinho) formam trechos de 2, 3... larguras e são divididos na
    # coluna mais vazia perto de cada corte
    larguras = sorted(x1 - x0 for _, _, t in linhas for x0, x1 in t)
    larg = float(np.median(larguras[: max(1, (len(larguras) + 1) // 2)]))
    quadros = []
    for y0, y1, trechos in linhas:
        for x0, x1 in trechos:
            n = max(1, round((x1 - x0) / larg))
            cortes = [x0]
            ocup = alfa[y0:y1, x0:x1].sum(axis=0)
            for k in range(1, n):
                alvo = (x1 - x0) * k // n
                janela = max(4, (x1 - x0) // (4 * n))
                c0, c1 = max(1, alvo - janela), min(x1 - x0 - 1, alvo + janela)
                cortes.append(x0 + c0 + int(np.argmin(ocup[c0:c1])))
            cortes.append(x1)
            for c0, c1 in zip(cortes, cortes[1:]):
                quadros.append((c0, c1, y0, y1))
    return quadros


def cinza(q):
    g = q[..., :3].astype(np.float32).mean(-1)
    return np.where(q[..., 3] > 0, g, -60.0)


def registrar(quadros, molde, busca=14):
    """Desloca cada quadro para a cabeça e o tronco (as partes paradas)
    ficarem exatamente sobre o molde — some o "tremido" de lado a lado."""
    y0, y1 = PE[1] - ALTURA, int(PE[1] - ALTURA * 0.42)
    x0, x1 = int(PE[0] - ALTURA * 0.2), int(PE[0] + ALTURA * 0.2)
    ref = cinza(molde)[y0:y1, x0:x1]
    saida = []
    desloc = []
    for q in quadros:
        g = cinza(q)
        melhor = (np.inf, 0, 0)
        for dy in range(-busca, busca + 1):
            for dx in range(-busca, busca + 1):
                janela = g[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
                e = np.abs(janela - ref).mean()
                if e < melhor[0]:
                    melhor = (e, dx, dy)
        _, dx, dy = melhor
        desloc.append((dx, dy))
        saida.append(np.roll(np.roll(q, dy, axis=0), dx, axis=1))
    print('  alinhamento (dx, dy):', desloc)
    return saida


def costura(ocup, alvo, j):
    """Caminho vertical de menor ocupação (pode curvar 1px por linha) dentro de
    alvo±j — separa figuras encostadas sem cortar a capa numa linha reta."""
    h = ocup.shape[0]
    faixa = ocup[:, alvo - j:alvo + j].astype(np.float64) + 1e-3
    custo = faixa.copy()
    for y in range(1, h):
        ant = custo[y - 1]
        viz = np.minimum(ant, np.minimum(np.r_[np.inf, ant[:-1]], np.r_[ant[1:], np.inf]))
        custo[y] += viz
    xs = np.empty(h, int)
    xs[-1] = int(np.argmin(custo[-1]))
    for y in range(h - 2, -1, -1):
        x = xs[y + 1]
        a, b = max(0, x - 1), min(2 * j, x + 2)
        xs[y] = a + int(np.argmin(custo[y, a:b]))
    return xs + alvo - j


def grade_fixa(alfa, achados):
    """Folha em grade (4 colunas × 3 linhas, 3 × 4, 4 × 2 ou 3 × 2) quando a
    detecção livre não achou a conta certa (quadros encostados ou uma
    manga partida em dois pedaços).
    Linhas pelas faixas vazias; colunas separadas por costuras de menor
    ocupação perto de cada divisão regular. Devolve (x0, x1, y0, y1, esq, dir):
    esq/dir = x da costura em cada linha (a célula é o que fica entre elas)."""
    H, W = alfa.shape
    linhas = faixas(alfa.any(axis=1), 2)
    for col in (4, 3):
        # 12 (4×3 / 3×4), 8 (4×2) ou 6 (3×2) quadros
        if len(linhas) * col not in (6, 8, 12):
            continue
        if achados == len(linhas) * col:
            return None
        caixas = []
        for y0, y1 in linhas:
            ocup = alfa[y0:y1]
            j = max(8, W // (col * 5))
            cortes = [np.zeros(y1 - y0, int)]
            cortes += [costura(ocup, W * k // col, j) for k in range(1, col)]
            cortes.append(np.full(y1 - y0, W))
            caixas += [(int(e.min()), int(d.max()), y0, y1, e, d) for e, d in zip(cortes, cortes[1:])]
        return caixas
    return None


def recortar_costura(rgb, alfa, x0, x1, y0, y1, esq, dir):
    a = alfa[y0:y1, x0:x1].copy()
    xs = np.arange(x0, x1)[None, :]
    a &= (xs >= esq[:, None]) & (xs < dir[:, None])
    return recortar(rgb[y0:y1, x0:x1], a, 0, x1 - x0, 0, y1 - y0)


def importar_animacao(arquivos, personagem, anim, direcao, ordem=None):
    """`arquivos`: uma ou mais imagens (separadas por vírgula), lidas em ordem.
    `ordem`: "1,2,3,8,..." reordena os quadros achados (a IA às vezes troca dois)."""
    pasta, cam, man = manifesto(personagem)
    if 'paleta' not in man:
        sys.exit('importe a referência do personagem primeiro (ela define a paleta)')
    paleta = None if HD else np.array(man['paleta'], np.float32)
    celulas = []
    for arquivo in arquivos.split(','):
        rgb, alfa = carregar(arquivo)
        caixas = achar_quadros(alfa)
        grade = grade_fixa(alfa, len(caixas))
        if grade:
            celulas += [recortar_costura(rgb, alfa, *c) for c in grade]
        else:
            celulas += [recortar(rgb, alfa, x0, x1, y0, y1) for x0, x1, y0, y1 in caixas]
    if ordem:
        celulas = [celulas[int(i) - 1] for i in ordem.split(',')]
    # escala: altura típica (mediana) das figuras ≈ ALTURA
    altura = float(np.median([a.shape[0] for _, a in celulas]))
    escala = ALTURA / altura
    passos = anim.split(':')[0] in ('andar', 'correr', 'frear')
    quadros = encaixar_folha([reduzir(c, a, escala) for c, a in celulas], paleta, passos)
    molde = os.path.join(os.path.dirname(os.path.abspath(arquivos.split(',')[0])), 'moldes', f'{direcao}.png')
    if ALINHAR_PELO_MOLDE and os.path.exists(molde):
        quadros = registrar(quadros, np.asarray(Image.open(molde).convert('RGBA')))
    # "parado:vento" = variação "vento" do parado (tocada de vez em quando)
    anim, _, variante = anim.partition(':')
    nome = f'{anim}-{variante}_{direcao}.png' if variante else f'{anim}_{direcao}.png'
    salvar_tira(pasta, nome, quadros)
    entrada = man['anims'].setdefault(anim, {}).setdefault(direcao, {'arquivo': nome, 'quadros': len(quadros)})
    if variante:
        entrada.setdefault('variantes', {})[variante] = {'arquivo': nome, 'quadros': len(quadros)}
    else:
        entrada.update({'arquivo': nome, 'quadros': len(quadros)})
    with open(cam, 'w') as f:
        json.dump(man, f, indent=1)
    print(f'{personagem} {anim} {direcao}: {len(quadros)} quadros, escala {escala:.3f} (bloco {1 / escala:.2f}px)')


if __name__ == '__main__':
    modo = sys.argv[1]
    if modo == 'referencia':
        importar_referencia(sys.argv[2], sys.argv[3])
    elif modo == 'animacao':
        importar_animacao(*sys.argv[2:7])
    else:
        sys.exit(__doc__)
