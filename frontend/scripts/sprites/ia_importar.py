"""
Corpos gerados por IA no padrão do Ragnarok (corpo sem cabeça, fundo magenta,
grade de células quadradas; uma linha por direção: frente, costas, direita,
esquerda) -> folhas do jogo, com a cabeça encaixada no pescoço de cada quadro.

    python3 ia_importar.py

Folhas em scripts/modelos/ia/<corpo>-<animação>.png. Cada linha tem os
quadros da animação; o 1º quadro do andar é o parado.
Só 4 direções: as diagonais usam a de lado (apelidos no manifesto).
"""
import json, os
import cv2, numpy as np
from scipy import ndimage

import ro_importar as ro

ORIG = os.path.join(ro.RAIZ, 'scripts', 'modelos', 'ia')
DIRS = ['S', 'N', 'E', 'W']  # ordem das linhas na folha
ALTURA_CORPO = 66  # px do corpo sem cabeça (pose parada), como os corpos do RO
# altura (px) da cabeça montada: ~42% do corpo parado (com metade ela ficava grande demais)
TAM_CABECA = 28


def celulas(arq, colunas, linhas=4, grade=False):
    """quadros (RGBA) da folha: `linhas` x `colunas`. Cada pedaço desenhado vai
    para a célula onde está o seu centro (a espada do golpe pode passar da
    célula e não é cortada). grade: as figuras encostam umas nas outras (as
    espadas se tocam) — as linhas saem dos vãos vazios entre elas e as colunas
    são cortadas em partes iguais"""
    img = cv2.imread(os.path.join(ORIG, arq))
    b, g, r = (img[..., k].astype(int) for k in range(3))
    s = ~((r - g > 80) & (b - g > 80))
    rosa = (r - g > 25) & (b - g > 25)
    borda = s & ~ndimage.binary_erosion(s)
    s &= ~(borda & rosa)
    s = ndimage.binary_opening(s)
    # tira o magenta que vazou na borda (lâmina da espada ficava rosa)
    perto = s & ~ndimage.binary_erosion(s, iterations=3)
    m = np.minimum(r, b)
    exc = np.where(perto & (m > g), m - g, 0)
    img = np.dstack([b - exc, g, r - exc]).clip(0, 255).astype(np.uint8)
    rgba = np.dstack([img, np.where(s, 255, 0).astype(np.uint8)])
    H, W = s.shape
    ch, cw = H / linhas, W / colunas
    if grade:
        tem = s.any(1)
        faixas, y = [], 0
        while y < H:
            if tem[y]:
                y0 = y
                while y < H and tem[y]:
                    y += 1
                faixas.append([y0, y])
            y += 1
        # junta as faixas mais próximas até sobrarem `linhas`
        while len(faixas) > linhas:
            k = int(np.argmin([faixas[i + 1][0] - faixas[i][1] for i in range(len(faixas) - 1)]))
            faixas[k:k + 2] = [[faixas[k][0], faixas[k + 1][1]]]
        out = []
        for y0, y1 in faixas:
            qs = []
            for j in range(colunas):
                q = np.zeros_like(rgba)
                x0, x1 = int(j * cw), int((j + 1) * cw)
                q[y0:y1, x0:x1] = rgba[y0:y1, x0:x1]
                a = ndimage.binary_opening(q[..., 3] > 0, iterations=2)
                # pontas de espada da figura vizinha que caíram nesta célula
                lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=2))
                if n > 1:
                    tam = ndimage.sum(a, lab, range(1, n + 1))
                    a &= np.isin(lab, 1 + np.nonzero(tam >= tam.max() * 0.05)[0])
                q[..., 3] = np.where(a, q[..., 3], 0)
                qs.append(ro.aparar(q))
            out.append(qs)
        return out
    lab, n = ndimage.label(ndimage.binary_dilation(s, iterations=3))
    lab = np.where(s, lab, 0)
    dono = {}
    for k, (cy, cx) in enumerate(ndimage.center_of_mass(s, lab, range(1, n + 1)), 1):
        tam = (lab == k).sum() if n < 400 else 1
        if tam < 40:
            continue
        dono.setdefault((min(linhas - 1, int(cy / ch)), min(colunas - 1, int(cx / cw))), []).append(k)
    out = []
    for i in range(linhas):
        qs = []
        for j in range(colunas):
            ks = dono.get((i, j), [])
            # o maior pedaço da célula e o que está perto dele
            m = np.isin(lab, ks)
            q = rgba.copy()
            q[..., 3] = np.where(m, q[..., 3], 0)
            qs.append(ro.aparar(q))
        out.append(qs)
    return out


def reduzir(q, s):
    q = ro.aparar(q)
    h, w = q.shape[:2]
    # reduz pré-multiplicado (o fundo magenta não mancha a borda)
    a = q[..., 3:].astype(np.float32) / 255
    pm = np.dstack([q[..., :3] * a, a * 255]).astype(np.float32)
    p = cv2.resize(pm, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)
    al = p[..., 3:] / 255
    rgb = np.where(al > 0, p[..., :3] / np.maximum(al, 1e-6), 0)
    p = np.dstack([rgb, np.where(p[..., 3:] > 110, 255, 0)]).clip(0, 255).astype(np.uint8)  # borda dura
    return p


def pescoco_pele(cp, ref):
    """pescoço dos corpos da IA: o toco cortado é pele (rosa claro) no alto do
    tronco. Pega o pedaço de pele mais perto de onde o pescoço estaria (o
    jeito do RO, topo do tronco) — a mão erguida também é pele, mas fica longe"""
    ex, ey = ro.topo_tronco(cp, ref['dxc'], banda=ref.get('banda', 6), perc=ref.get('perc', 50))
    hsv = cv2.cvtColor(cp[..., :3], cv2.COLOR_BGR2HSV).astype(int)
    h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    pele = (cp[..., 3] > 0) & ((h <= 20) | (h >= 170)) & (sa >= 30) & (sa <= 150) & (v >= 150)
    lab, n = ndimage.label(pele)
    melhor = None
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        if len(ys) < 6:
            continue
        y = int(ys.min())
        topo = xs[ys < y + 4]
        x = float(topo.mean())
        larg, alt = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        larg_topo = topo.max() - topo.min() + 1
        # o toco do pescoço é largo (de frente ele emenda com o peito aberto da
        # camisa e fica comprido, mas o topo continua largo); braço e mão são
        # compridos e finos
        if alt > larg * 1.1 and larg_topo < 9:
            continue
        dist = np.hypot(x - ex, (y - ey) * 0.8)
        if dist < 16 and (melhor is None or dist < melhor[0]):
            melhor = (dist, x, y)
    return (melhor[1], melhor[2]) if melhor else (ex, ey)


# ataque: quadros em que o pescoço foi marcado à mão (x, y no corpo aparado).
# Arma de Luz, 3º quadro: as mãos juntas sobem acima do pescoço e o toco do
# pescoço fica escondido entre os braços
PESCOCO_ATAQUE = {('espadachim-luz', 'S', 2): (17, 14), ('espadachim-luz', 'N', 2): (21.5, 13),
                  ('espadachim-luz', 'E', 2): (16, 14), ('espadachim-luz', 'W', 2): (17.5, 13)}
# chute: quadros em que o pescoço foi marcado à mão (x no corpo aparado)
PESCOCO_CHUTE = {('S', 4): 59.5, ('N', 3): 21, ('N', 4): 21}


def pescoco_topo(cp, ref):
    """chute: o corpo inclina muito e a cintura sai do lugar, mas os punhos
    ficam abaixo do pescoço; o toco do pescoço é o ponto mais alto do corpo"""
    a = cp[..., 3] > 20
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    t = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_OPEN, k) > 0
    y = int(np.nonzero(t.any(1))[0].min())
    # no alto pode subir também um punho ou ombro: fica o pedaço maior da faixa
    lab, n = ndimage.label(t[y:y + 4])
    k = 1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))))
    return float(np.nonzero((lab == k).any(0))[0].mean()), y


def trocar_pernas(q, corte=0.7):
    """espelha as pernas do joelho para baixo em volta do meio dos pés: o pé
    que estava erguido passa a ser o outro. Só a faixa das pernas (a espada
    pendurada ao lado fica onde está)"""
    q = q.copy()
    h = q.shape[0]
    y0 = int(h * corte)
    pes = q[h - 10:, :, 3] > 20
    xs = np.nonzero(pes.any(0))[0]
    if not len(xs):
        return q
    cx = (xs.min() + xs.max()) / 2
    w = int(np.ceil(max(cx - xs.min(), xs.max() - cx))) + 2
    x0, x1 = int(round(cx - w)), int(round(cx + w))
    if x0 < 0 or x1 > q.shape[1]:
        q = np.pad(q, ((0, 0), (max(0, -x0), max(0, x1 - q.shape[1])), (0, 0)))
        d = max(0, -x0)
        x0, x1 = x0 + d, x1 + d
    q[y0:, x0:x1] = q[y0:, x0:x1][:, ::-1]
    return q


def cabecas_ro(folha, linha):
    """cabeça do RO (S, SO, O, NO, N) -> frente, costas, direita (espelho), esquerda"""
    c = ro.cabecas(folha, linha)
    return {'S': c[0], 'N': c[4], 'W': c[2], 'E': ro.espelho(c[2])}


def nitido(q, k=0.7):
    """realça os detalhes depois de reduzir (olhos e boca somem no borrão)"""
    rgb = q[..., :3].astype(np.float32)
    borrado = cv2.GaussianBlur(rgb, (0, 0), 0.8)
    q = q.copy()
    q[..., :3] = np.clip(rgb + k * (rgb - borrado), 0, 255).astype(np.uint8)
    return q


def cabecas_ia(arq, altura):
    """folha de cabeça da IA (frente, costas, direita, esquerda). As cabeças
    da folha variada (cabecas/) foram desenhadas na mesma escala: todas
    reduzidas pelo mesmo fator (rosto do mesmo tamanho; cabelo volumoso ou
    rabo de cavalo ficam maiores, como no desenho). Nas outras, `altura` px.
    Cada cabeça ganha margem para o queixo ficar no meio (o montar centraliza)"""
    out = {}
    for d, q in zip(DIRS, celulas(arq, 4, 1)[0]):
        fator = altura / 100 if arq.startswith('cabecas/') else altura / q.shape[0]
        q = nitido(reduzir(q, fator))
        a = q[..., 3] > 0
        h = a.shape[0]
        # queixo = os pixels mais de baixo (de lado, a média da faixa de baixo
        # puxava para o cabelo da nuca e a cabeça ficava para trás do pescoço)
        ys, xs = np.nonzero(a[h - max(3, round(h * 0.15)):])
        queixo = float(xs.mean())
        falta = int(round(2 * queixo - q.shape[1]))
        if falta > 0:
            q = np.pad(q, ((0, 0), (0, falta), (0, 0)))
        elif falta < 0:
            q = np.pad(q, ((0, 0), (-falta, 0), (0, 0)))
        out[d] = q
    return out


# partes que dá para tingir: (matizes OpenCV 0-180, saturação mínima, valor máximo)
PARTES_ESPADACHIM = {
    'roupa': (((168, 180), (0, 5)), 115, 215),   # colete e faixa vermelhos (o couro marrom fica)
    'calca': (((95, 135),), 40, 255),            # calça azul
}
# lutador: o calção vinho
PARTES_LUTADOR = {'calca': (((165, 180), (0, 3)), 140, 170, 0.42)}
# atirador: a capa verde-escura (as estrelas amarelas ficam)
PARTES_ATIRADOR = {'roupa': (((60, 110),), 25, 125)}
PARTES_CABECA = {'cabelo': (((0, 28), (172, 180)), 110, 256)}  # cabelo laranja (a pele é menos saturada)


def tom_pele(q, s_max=160):
    """cor mediana da pele (matiz, saturação, valor) de um quadro"""
    hsv = cv2.cvtColor(q[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)
    h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (q[..., 3] > 0) & (h >= 3) & (h <= 22) & (sa >= 40) & (sa <= s_max) & (v >= 150)
    if m.sum() < 5:  # pele mais morena/saturada: alarga a faixa
        m = (q[..., 3] > 0) & (h >= 3) & (h <= 22) & (sa >= 40) & (v >= 110)
    return np.median(h[m]), np.median(sa[m]), np.median(v[m])


def igualar_pele(cab, alvo, original):
    """deixa a pele do rosto com o tom da pele do corpo (alvo: matiz,
    saturação, valor). Só os pixels perto da cor da pele do rosto (no espaço
    Lab) mudam — o cabelo loiro e os olhos ficam como estão —, e a diferença
    de cor é somada, mantendo a sombra e o brilho do desenho"""
    th, ts, tv = tom_pele(original, 110)
    hsv_px = lambda h, s_, v: cv2.cvtColor(np.uint8([[[h, s_, v]]]), cv2.COLOR_HSV2BGR)
    lab_px = lambda bgr: cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)[0, 0]
    de = lab_px(hsv_px(th, ts, tv))
    para = lab_px(hsv_px(*alvo))
    lab = cv2.cvtColor(cab[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_o = cv2.cvtColor(original[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    dist = np.linalg.norm(lab_o - de, axis=2)
    peso = np.clip((20 - dist) / 8, 0, 1) * (original[..., 3] > 0)
    lab += peso[..., None] * (para - de)
    out = cab.copy()
    out[..., :3] = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    return out


def tingir(q, partes, cores):
    """troca a cor das partes: cores = {parte: (matiz, x saturação, x valor)}.
    Uma parte pode ter um 4º valor: só abaixo dessa fração da altura do quadro
    (o calção do lutador tem o mesmo vinho do contorno do peito)"""
    if not cores:
        return q
    hsv = cv2.cvtColor(q[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)
    h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    vis = q[..., 3] > 0
    # as máscaras saem todas antes de pintar (senão a cor nova cai na faixa de outra parte)
    linhas = np.arange(q.shape[0])[:, None] / q.shape[0]
    mascaras = {p: vis & (sa >= c[1]) & (v < c[2]) & np.any([(h >= a) & (h <= b) for a, b in c[0]], axis=0)
                   & (linhas >= (c[3] if len(c) > 3 else 0))
                for p, c in partes.items() if p in cores}
    for parte, m in mascaras.items():
        nh, fs, fv = cores[parte]
        h[m] = nh
        sa[m] = np.clip(sa[m] * fs, 0, 255)
        v[m] = np.clip(v[m] * fv, 0, 255)
    out = q.copy()
    out[..., :3] = cv2.cvtColor(np.dstack([h, sa, v]).astype(np.uint8), cv2.COLOR_HSV2BGR)
    return out


def personagem(pid, corpo, cabeca, densidade=0.82, cores=None, partes=None, altura=ALTURA_CORPO, ataque=(6, 3), igualar=False, alternar=(), braco_cima=False, trocar=None, fecha_parado=False, grade=False):
    """cabeca: ('cabecas-N.png', linha) do RO ou 'arquivo.png' gerado por IA.
    cores: {parte|'cabelo': (matiz, x saturação, x valor)} para tingir;
    partes: as partes tingíveis desse corpo (padrão: as do espadachim);
    altura: px do corpo parado; ataque: (quadros da folha, quadro do impacto);
    igualar: a folha do ataque foi desenhada noutro tamanho — o 1º quadro do
    ataque fica com a altura do corpo parado; alternar: quadros do andar em
    que o pé erguido é o mesmo da primeira metade do passo — de frente e de
    costas as pernas são espelhadas (o passo passa a alternar os pés);
    trocar: {dir: {quadro: quadro de onde copiar}} no andar (passo que repetia
    o pé); fecha_parado: o último quadro do andar vira o parado (o 1º);
    braco_cima: no ataque os braços sobem acima do pescoço e ficam na frente
    da cabeça"""
    PARTES_CORPO = partes or PARTES_ESPADACHIM
    andar = celulas(f'{corpo}-andar.png', 8, grade=grade)
    for i, d in enumerate(DIRS):
        for j, de in (trocar or {}).get(d, {}).items():
            andar[i][j] = andar[i][de]
        if fecha_parado:
            andar[i][-1] = andar[i][0]
    # escala: corpo parado (frente) com `altura` px; a cabeça tem o tamanho de
    # sempre (metade do corpo padrão), não cresce com um corpo maior
    s = altura / andar[0][0].shape[0]
    cabs = cabecas_ia(cabeca, TAM_CABECA) if isinstance(cabeca, str) else cabecas_ro(*cabeca)
    # o rosto com o mesmo tom de pele do corpo (antes de tingir o cabelo)
    pele = tom_pele(andar[0][0])
    cabs = {d: igualar_pele(tingir(c, PARTES_CABECA, cores), pele, c) for d, c in cabs.items()}
    anims = {'parado': {}, 'andar': {}, 'correr': {}}
    refs = {}
    for i, d in enumerate(DIRS):
        qs = [tingir(reduzir(q, s), PARTES_CORPO, cores) for q in andar[i]]
        if d in ('S', 'N'):
            qs = [trocar_pernas(q) if j in alternar else q for j, q in enumerate(qs)]
        ref = refs[d] = ro.pescoco_parado(qs[0])
        # corpo da IA se inclina mais no golpe: procura o pescoço numa faixa larga
        # sobre: a cabeça desce 8 px no pescoço (o toco da IA é mais largo que o queixo de lado)
        ref.update(banda=11, perc=30, sobre=8)
        anims['parado'][d] = [ro.montar(qs[0], cabs[d], ref, achar=pescoco_pele)]
        anims['andar'][d] = [ro.montar(q, cabs[d], ref, achar=pescoco_pele) for q in qs]
        anims['correr'][d] = anims['andar'][d]
    tempos = {'andar': {'fps': 10}, 'correr': {'fps': 12}}
    if os.path.exists(os.path.join(ORIG, f'{corpo}-atacar.png')):
        atacar = celulas(f'{corpo}-atacar.png', ataque[0])
        sa = altura / atacar[0][0].shape[0] if igualar else s
        anims['atacar'] = {d: [ro.montar(tingir(reduzir(q, sa), PARTES_CORPO, cores), cabs[d], refs[d], 'pe', braco_por_cima=braco_cima,
                                        achar=(lambda cp, ref, p=PESCOCO_ATAQUE[(corpo, d, j)]: p) if (corpo, d, j) in PESCOCO_ATAQUE else pescoco_pele)
                               for j, q in enumerate(atacar[i])] for i, d in enumerate(DIRS)}
        tempos['atacar'] = {'fps': 10 if ataque[0] == 6 else round(10 * ataque[0] / 6, 2), 'impacto': ataque[1]}
    # skills de akuma (6 quadros, 4 direções): 'conjurar' = Entei (braço para o
    # alto e arremesso), 'empurrar' = vaga-lumes (palmas para a frente)
    # 'cruzar' = Yasakani (abre os braços e cruza na frente do peito)
    # 'chutar' = Chute da Luz (Kizaru): pula e chuta de lado
    for anim, arq in (('conjurar', 'entei'), ('empurrar', 'hotarubi'), ('cruzar', 'yasakani'), ('chutar', 'chute')):
        if os.path.exists(os.path.join(ORIG, f'{corpo}-{arq}.png')):
            fs = celulas(f'{corpo}-{arq}.png', 6)
            def achar(d, j, anim=anim):
                if anim != 'chutar':
                    return pescoco_pele
                if (d, j) in PESCOCO_CHUTE:  # o braço erguido fica mais alto que o pescoço
                    return lambda cp, ref: (PESCOCO_CHUTE[(d, j)], 0)
                return pescoco_topo
            anims[anim] = {d: [ro.montar(tingir(reduzir(q, s), PARTES_CORPO, cores), cabs[d], refs[d], 'pe', braco_por_cima=True, achar=achar(d, j))
                               for j, q in enumerate(fs[i])] for i, d in enumerate(DIRS)}
    ro.gravar(pid, anims, tempos, densidade, 'Gerado por IA no padrão do Ragnarok (teste)')
    arq = os.path.join(ro.SPR, pid, 'manifesto.json')
    man = json.load(open(arq))
    man['apelidos'] = {'SE': 'E', 'NE': 'E', 'SW': 'W', 'NW': 'W'}
    json.dump(man, open(arq, 'w'), indent=1)
    print(pid, {n: len(v['S']) for n, v in anims.items()})


def personagem_completo(pid, corpo, altura=95, cores=None, partes=None, ataque=(6, 3), grade=False, hd=2):
    """folhas que já vêm com a cabeça desenhada (sem encaixe de cabeça nem
    de pele): andar (8 quadros) e atacar. altura: px da figura parada de
    frente; o 1º quadro do ataque fica com a mesma altura. O quadro fica preso
    pelo centro do tronco (o cabelo e as espadas não puxam a figura).
    hd: a folha é gravada em hd× (o rosto e os olhos ficam com o detalhe do
    desenho; reduzir até o tamanho do tabuleiro borrava a expressão)"""
    altura *= hd
    andar = celulas(f'{corpo}-andar.png', 8, grade=grade)
    s = altura / andar[0][0].shape[0]
    atacar = celulas(f'{corpo}-atacar.png', ataque[0]) if os.path.exists(os.path.join(ORIG, f'{corpo}-atacar.png')) else None
    sa = altura / atacar[0][0].shape[0] if atacar else s

    def pronto(q, sc):
        q = tingir(reduzir(q, sc), partes or {}, cores)
        a = q[..., 3] > 0
        h = q.shape[0]
        faixa = a[int(h * 0.25):int(h * 0.6)]
        cols = np.nonzero(faixa.any(0))[0]
        xs = np.nonzero(faixa)[1]
        cx = float(np.median(xs)) if len(xs) else q.shape[1] / 2
        out = np.zeros((ro.A * hd, ro.L * hd, 4), np.uint8)
        ro.pintar(out, q, int(round(ro.PE[0] * hd - cx)), ro.PE[1] * hd - h)
        return out

    anims = {'parado': {}, 'andar': {}, 'correr': {}}
    for i, d in enumerate(DIRS):
        # a folha do andar pode desenhar cada direção num tamanho (o perfil
        # menor): cada direção fica com a altura do 1º quadro do ataque nela
        sd = s if not atacar else atacar[i][0].shape[0] * sa / andar[i][0].shape[0]
        qs = [pronto(q, sd) for q in andar[i]]
        anims['parado'][d] = [qs[0]]
        anims['andar'][d] = qs
        anims['correr'][d] = qs
    tempos = {'andar': {'fps': 10}, 'correr': {'fps': 12}}
    if atacar:
        anims['atacar'] = {d: [pronto(q, sa) for q in atacar[i]] for i, d in enumerate(DIRS)}
        tempos['atacar'] = {'fps': 10 if ataque[0] == 6 else round(10 * ataque[0] / 6, 2), 'impacto': ataque[1]}
    ro.gravar(pid, anims, tempos, 0.82, 'Gerado por IA no padrão do Ragnarok (teste)', hd=hd)
    arq = os.path.join(ro.SPR, pid, 'manifesto.json')
    man = json.load(open(arq))
    man['apelidos'] = {'SE': 'E', 'NE': 'E', 'SW': 'W', 'NW': 'W'}
    json.dump(man, open(arq, 'w'), indent=1)
    print(pid, {n: len(v['S']) for n, v in anims.items()})


# partes da folha espadachim2 (matiz OpenCV 0–180, saturação mínima, valor máximo)
# lutador2: o calção vinho (só da cintura para baixo; a cicatriz do peito fica)
PARTES_LUTADOR2 = {'calca': (((168, 180), (0, 4)), 120, 200, 0.45)}
PARTES_ATIRADOR2 = {'capa': ([(36, 82)], 10, 200), 'cabelo': ([(0, 12)], 80, 115)}
PARTES_CAPITAO = {'colete': ([(0, 6), (170, 180)], 110, 256), 'cabelo': ([(7, 19)], 150, 256), 'calca': ([(100, 125)], 60, 256)}


def cabecas_sorteadas(ids):
    """teste: uma cabeça de cabecas/ (28, cabecas-variadas.png) sorteada para
    cada personagem, sem repetir. O sorteio fica guardado em sorteio.json
    (apague o arquivo para sortear de novo)"""
    import random
    arq = os.path.join(ORIG, 'cabecas', 'sorteio.json')
    sorteio = json.load(open(arq)) if os.path.exists(arq) else {}
    livres = [k for k in range(28) if k not in sorteio.values()]
    random.shuffle(livres)
    for pid in ids:
        if pid not in sorteio:
            sorteio[pid] = livres.pop()
    json.dump(sorteio, open(arq, 'w'), indent=1)
    return {pid: f'cabecas/cabeca-{k:02d}.png' for pid, k in sorteio.items()}


if __name__ == '__main__':
    CAB = cabecas_sorteadas(['pirata-capitao', 'pirata-lutador', 'marinha-soldado', 'pirata-atiradora', 'marinha-atirador',
                             'pirata-medico', 'marinha-enfermeira', 'pirata-espadachim', 'marinha-almirante', 'marinha-oficial'])
    # o Capitão é espadachim de sabre como o outro (a folha nova, com a cabeça
    # desenhada), mas de cabelo preto e colete e calça escuros
    personagem_completo('pirata-capitao', 'espadachim2', altura=92, partes=PARTES_CAPITAO,
                        cores={'colete': (0, 0.15, 0.35), 'cabelo': (0, 0.0, 0.3), 'calca': (110, 0.3, 0.6)})
    # Arma de Luz (Pika Pika): o Capitão de mãos vazias, segurando a espada de
    # luz (o efeito do Effekseer vai na mão, pelas marcas de empunhadura)
    personagem('pirata-capitao-luz', 'espadachim-luz', CAB['pirata-capitao'], braco_cima=True)
    # teste das folhas já com a cabeça desenhada: espadachim de sabre e atirador
    personagem_completo('pirata-espadachim', 'espadachim2', altura=92)
    personagem_completo('pirata-atiradora', 'atirador2', altura=92, ataque=(8, 3))
    # o 2º espadachim pirata (colete azul) e o espadachim da Marinha (colete
    # azul-marinho, calça clara); o 2º lutador da Marinha de calção azul-marinho
    personagem('marinha-almirante', 'espadachim', CAB['marinha-almirante'], alternar=(4, 5, 6),
               cores={'roupa': (112, 0.9, 0.55), 'calca': (110, 0.15, 1.6)})
    personagem_completo('marinha-oficial', 'lutador2', altura=92, partes=PARTES_LUTADOR2, cores={'calca': (112, 0.9, 0.7)})
    # variações de cor do mesmo personagem
    personagem('espadachim-azul', 'espadachim', 'cabeca-espetado.png', alternar=(4, 5, 6),
               cores={'roupa': (108, 0.95, 1.05), 'calca': (20, 0.25, 0.75)})
    personagem('espadachim-verde', 'espadachim', 'cabeca-espetado.png', alternar=(4, 5, 6),
               cores={'roupa': (60, 0.7, 0.8), 'calca': (16, 0.55, 1.35)})
    # lutador novo (folha com a cabeça desenhada) nos dois lados: o pirata de
    # calção vinho, os do outro navio de calção azul e azul-marinho (acima)
    personagem_completo('pirata-lutador', 'lutador2', altura=92)
    personagem_completo('marinha-soldado', 'lutador2', altura=92, partes=PARTES_LUTADOR2, cores={'calca': (108, 0.9, 1.2)})
    # atirador novo (rifle, 8 quadros no tiro) nos dois lados: o da Marinha de capa azul-marinho
    # os médicos (profissão): atirador de capa vinho nos piratas, espadachim
    # de colete azul-claro na Marinha
    # os outros atiradores com a folha nova da atiradora (cabeça desenhada):
    # o médico de cabelo preto; o do outro navio de capa azul-marinho
    personagem_completo('pirata-medico', 'atirador2', altura=92, ataque=(8, 3), partes=PARTES_ATIRADOR2,
                        cores={'cabelo': (0, 0.2, 0.45)})
    personagem('marinha-enfermeira', 'espadachim', CAB['marinha-enfermeira'], alternar=(4, 5, 6),
               cores={'roupa': (100, 0.6, 1.25), 'calca': (110, 0.15, 1.6)})
    personagem_completo('marinha-atirador', 'atirador2', altura=92, ataque=(8, 3), partes=PARTES_ATIRADOR2,
                        cores={'capa': (110, 3.4, 1.0)})
