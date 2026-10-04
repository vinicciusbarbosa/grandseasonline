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


def celulas(arq, colunas, linhas=4):
    """quadros (RGBA) da folha: `linhas` x `colunas`. Cada pedaço desenhado vai
    para a célula onde está o seu centro (a espada do golpe pode passar da
    célula e não é cortada)"""
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


def machados(q, d):
    """dual machado: um machado pendurado em cada punho (lâmina para baixo,
    de face), por trás do corpo: o punho cobre o cabo. De lado só aparece o
    do punho da frente, por cima do corpo"""
    global _MACHADOS
    if '_MACHADOS' not in globals():
        _MACHADOS = celulas('machados.png', 6, 1)[0]
    q = np.pad(ro.aparar(q), ((0, 0), (9, 9), (0, 0)))
    H = q.shape[0]
    hsv = cv2.cvtColor(q[..., :3], cv2.COLOR_BGR2HSV).astype(int)
    h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    pele = (q[..., 3] > 0) & ((h <= 20) | (h >= 170)) & (sa >= 60) & (v >= 140)
    pele[:int(H * 0.36)] = False
    pele[int(H * 0.56):] = False
    ys, xs = np.nonzero(pele)
    if not len(xs):
        return q
    def ponta(lado):  # centro do punho na ponta do braço (esquerda/direita)
        borda = xs.min() if lado < 0 else xs.max()
        m = np.abs(xs - borda) <= 4
        return xs[m].mean(), ys[m].mean()
    alt = round(H * 0.42)
    def machado(k):
        m = _MACHADOS[k][::-1]  # lâmina para baixo
        return reduzir(m, alt / m.shape[0])
    def pendurar(alvo, m, x, y):
        ro.pintar(alvo, m, int(round(x - m.shape[1] / 2)), int(round(y - alt * 0.16)))
    if d in ('S', 'N'):
        fundo = np.zeros_like(q)
        k0, k1 = (0, 1) if d == 'S' else (2, 3)
        pendurar(fundo, machado(k0), *ponta(-1))
        pendurar(fundo, machado(k1), *ponta(1))
        ro.pintar(fundo, q, 0, 0)
        return fundo
    x, y = ponta(1 if d == 'E' else -1)
    out = q.copy()
    pendurar(out, machado(0 if d == 'E' else 1), x, y)
    # o punho por cima do cabo
    punho = q.copy()
    punho[..., 3] = np.where(pele & (np.hypot(np.arange(q.shape[1])[None] - x, np.arange(H)[:, None] - y) < 4), q[..., 3], 0)
    ro.pintar(out, punho, 0, 0)
    return out


def cabecas_ro(folha, linha):
    """cabeça do RO (S, SO, O, NO, N) -> frente, costas, direita (espelho), esquerda"""
    c = ro.cabecas(folha, linha)
    return {'S': c[0], 'N': c[4], 'W': c[2], 'E': ro.espelho(c[2])}


def cabecas_ia(arq, altura):
    """folha de cabeça da IA (frente, costas, direita, esquerda) com `altura` px.
    Cada cabeça ganha margem para o queixo ficar no meio (o montar centraliza)"""
    out = {}
    for d, q in zip(DIRS, celulas(arq, 4, 1)[0]):
        q = reduzir(q, altura / q.shape[0])
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
PARTES_LUTADOR = {'calca': (((165, 180), (0, 3)), 140, 170)}
# dual machado: o calção azul e a faixa vermelha da cintura
PARTES_MACHADO = {'calca': (((90, 112),), 50, 256), 'roupa': (((0, 8), (172, 180)), 150, 256)}
# atirador: a capa verde-escura (as estrelas amarelas ficam)
PARTES_ATIRADOR = {'roupa': (((60, 110),), 25, 125)}
PARTES_CABECA = {'cabelo': (((0, 28), (172, 180)), 110, 256)}  # cabelo laranja (a pele é menos saturada)


def tingir(q, partes, cores):
    """troca a cor das partes: cores = {parte: (matiz, x saturação, x valor)}"""
    if not cores:
        return q
    hsv = cv2.cvtColor(q[..., :3], cv2.COLOR_BGR2HSV).astype(np.float32)
    h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    vis = q[..., 3] > 0
    # as máscaras saem todas antes de pintar (senão a cor nova cai na faixa de outra parte)
    mascaras = {p: vis & (sa >= s_min) & (v < v_max) & np.any([(h >= a) & (h <= b) for a, b in faixas], axis=0)
                for p, (faixas, s_min, v_max) in partes.items() if p in cores}
    for parte, m in mascaras.items():
        nh, fs, fv = cores[parte]
        h[m] = nh
        sa[m] = np.clip(sa[m] * fs, 0, 255)
        v[m] = np.clip(v[m] * fv, 0, 255)
    out = q.copy()
    out[..., :3] = cv2.cvtColor(np.dstack([h, sa, v]).astype(np.uint8), cv2.COLOR_HSV2BGR)
    return out


def personagem(pid, corpo, cabeca, densidade=0.82, cores=None, partes=None, altura=ALTURA_CORPO, ataque=(6, 3), igualar=False, armar=None):
    """cabeca: ('cabecas-N.png', linha) do RO ou 'arquivo.png' gerado por IA.
    cores: {parte|'cabelo': (matiz, x saturação, x valor)} para tingir;
    partes: as partes tingíveis desse corpo (padrão: as do espadachim);
    altura: px do corpo parado; ataque: (quadros da folha, quadro do impacto);
    igualar: a folha do ataque foi desenhada noutro tamanho — o 1º quadro do
    ataque fica com a altura do corpo parado; armar(q, d): põe a arma no corpo
    já reduzido (andar)"""
    PARTES_CORPO = partes or PARTES_ESPADACHIM
    andar = celulas(f'{corpo}-andar.png', 8)
    # escala: corpo parado (frente) com `altura` px; a cabeça tem o tamanho de
    # sempre (metade do corpo padrão), não cresce com um corpo maior
    s = altura / andar[0][0].shape[0]
    cabs = cabecas_ia(cabeca, round(ALTURA_CORPO * 0.5)) if isinstance(cabeca, str) else cabecas_ro(*cabeca)
    cabs = {d: tingir(c, PARTES_CABECA, cores) for d, c in cabs.items()}
    anims = {'parado': {}, 'andar': {}, 'correr': {}}
    refs = {}
    for i, d in enumerate(DIRS):
        qs = [tingir(reduzir(q, s), PARTES_CORPO, cores) for q in andar[i]]
        if armar:
            qs = [armar(q, d) for q in qs]
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
        anims['atacar'] = {d: [ro.montar(tingir(reduzir(q, sa), PARTES_CORPO, cores), cabs[d], refs[d], 'pe', achar=pescoco_pele) for q in atacar[i]] for i, d in enumerate(DIRS)}
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


if __name__ == '__main__':
    # teste: o corpo novo fica no Capitão (o Espadachim volta ao do RO)
    personagem('pirata-capitao', 'espadachim', 'cabeca-espetado.png')
    # variações de cor do mesmo personagem
    personagem('espadachim-azul', 'espadachim', 'cabeca-espetado.png',
               cores={'roupa': (108, 0.95, 1.05), 'calca': (20, 0.25, 0.75), 'cabelo': (112, 0.45, 0.42)})
    personagem('espadachim-verde', 'espadachim', 'cabeca-espetado.png',
               cores={'roupa': (60, 0.7, 0.8), 'calca': (16, 0.55, 1.35), 'cabelo': (24, 0.3, 1.2)})
    # lutador novo (soco) nos dois lados: o da Marinha de calção azul; a cabeça
    # é a do Capitão com outra cor de cabelo (cada um diferente)
    personagem('pirata-lutador', 'lutador', 'cabeca-espetado.png', partes=PARTES_LUTADOR, altura=72, igualar=True,
               cores={'cabelo': (0, 0.25, 0.3)})
    personagem('marinha-soldado', 'lutador', 'cabeca-espetado.png', partes=PARTES_LUTADOR, altura=72, igualar=True,
               cores={'calca': (110, 0.9, 1.2), 'cabelo': (22, 0.35, 1.25)})
    # atirador novo (rifle, 8 quadros no tiro) nos dois lados: o da Marinha de capa azul-marinho
    # dual machado no Médico e na Enfermeira (a da Marinha de calção azul-marinho
    # e faixa azul); só a folha do andar
    personagem('pirata-medico', 'machado', 'cabeca-espetado.png', partes=PARTES_MACHADO, armar=machados,
               cores={'cabelo': (60, 0.45, 0.55)})
    personagem('marinha-enfermeira', 'machado', 'cabeca-espetado.png', partes=PARTES_MACHADO, armar=machados,
               cores={'calca': (115, 1.3, 0.55), 'roupa': (110, 0.8, 0.8), 'cabelo': (150, 0.45, 0.8)})
    personagem('pirata-atiradora', 'atirador', 'cabeca-espetado.png', partes=PARTES_ATIRADOR, ataque=(8, 3), igualar=True,
               cores={'cabelo': (112, 0.55, 0.5)})
    personagem('marinha-atirador', 'atirador', 'cabeca-espetado.png', partes=PARTES_ATIRADOR, ataque=(8, 3), igualar=True,
               cores={'roupa': (112, 2.2, 2.4), 'cabelo': (12, 0.45, 0.62)})
