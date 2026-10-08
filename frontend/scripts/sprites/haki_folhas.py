"""
Haki de armamento nas folhas novas (cabeça desenhada, HD×2): gera, para
cada animação e direção, a variante "haki" com a arma e o braço negros como
no anime — o jogo troca para ela quando o armamento está ligado.

    python3 frontend/scripts/sprites/haki_folhas.py espada pirata-espadachim pirata-capitao
    python3 frontend/scripts/sprites/haki_folhas.py punho pirata-lutador marinha-soldado marinha-oficial

espada: a lâmina (peça prateada fina e comprida; a camisa branca é grossa e
fica), a guarda dourada encostada nela e a mão e o antebraço que seguram.
punho: as faixas de couro dos pulsos e a pele perto delas (mão e antebraço).

Rode depois do ia_importar (que regrava a pasta e apaga as variantes).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
K3 = np.ones((3, 3), np.uint8)


def canais(q):
    al = q[..., 3] > 0
    r, g, b = (q[..., i].astype(int) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    return al, r, g, b, mx, mn


def pele(q):
    al, r, g, b, mx, mn = canais(q)
    return al & (r > 165) & (g > 105) & (b > 60) & (r > b + 30) & (r - g < 100)


def crescer(semente, livre, passos):
    """crescimento geodésico a partir da semente por dentro de `livre`; devolve (máscara, distância)"""
    dist = np.full(semente.shape, 999.0, np.float32)
    dist[semente] = 0
    feito = semente.copy()
    for p in range(1, passos + 1):
        novo = (cv2.dilate(feito.astype(np.uint8), K3) > 0) & livre & ~feito
        if not novo.any():
            break
        dist[novo] = p
        feito |= novo
    return feito, dist


def cabeca(q, al):
    """linha abaixo da qual começa o corpo (o rosto e o cabelo ficam de fora)"""
    ys = np.nonzero(al.any(1))[0]
    if not len(ys):
        return 0
    return int(ys[0] + (ys[-1] - ys[0]) * 0.3)


def mascara_espada(q):
    al, r, g, b, mx, mn = canais(q)
    prata = al & (mx - mn < 45) & (mx > 140)
    # a lâmina é a peça prateada grande que quase não encosta na pele (as
    # mangas brancas da camisa encostam no braço quase inteiras)
    pd = cv2.dilate(pele(q).astype(np.uint8), K3) > 0
    n, rot, st, _ = cv2.connectedComponentsWithStats(prata.astype(np.uint8), connectivity=8)
    lam = np.zeros_like(al)
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA]
        if a < 150 or max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) < 30:
            continue
        if ((rot == i) & pd).sum() <= a * 0.1:
            lam |= rot == i
    if not lam.any():
        return lam, lam, lam, None
    # contorno escuro colado na lâmina também é lâmina
    lam |= (cv2.dilate(lam.astype(np.uint8), K3) > 0) & al & (mx < 110)
    ouro = al & (r > 150) & (g > 95) & (b < 130) & (r > b + 55)
    perto = cv2.dilate(lam.astype(np.uint8), np.ones((13, 13), np.uint8)) > 0
    ng, rg, sg, _ = cv2.connectedComponentsWithStats(ouro.astype(np.uint8), connectivity=8)
    guarda = np.zeros_like(al)
    for i in range(1, ng):
        c = rg == i
        if (c & perto).any() and sg[i, cv2.CC_STAT_AREA] < 600:
            guarda |= c
    # mão: pele encostada na guarda (ou na base da lâmina); braço: cresce dela
    base = guarda if guarda.any() else lam
    linha = cabeca(q, al)
    corpo = np.zeros_like(al)
    corpo[linha:] = True
    pl = pele(q) & corpo
    mao = pl & (cv2.dilate(base.astype(np.uint8), np.ones((13, 13), np.uint8)) > 0)
    if not mao.any():
        return lam, guarda, np.zeros_like(al), None
    # braçadeira de couro marrom colada na mão (não as botas nem o cinto)
    couro = al & (mx < 150) & (mx - mn > 25) & corpo & (cv2.dilate(mao.astype(np.uint8), np.ones((21, 21), np.uint8)) > 0)
    livre = (pl | couro) & ~lam & ~guarda
    braco, dist = crescer(mao, livre, 26)
    return lam, guarda, braco, dist


def mascara_punho(q, dica=None):
    """faixas de couro dos pulsos (as que encostam num punho) e mão/antebraço"""
    al, r, g, b, mx, mn = canais(q)
    hsv = cv2.cvtColor(q[..., :3], cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    vazio = np.zeros_like(al)
    ys = np.nonzero(al.any(1))[0]
    if not len(ys):
        return vazio, vazio, None
    alto = ys[-1] - ys[0]
    corpo = np.zeros_like(al)
    corpo[int(ys[0] + alto * 0.3): int(ys[-1] - alto * 0.24)] = True  # sem cabeça nem pés (sandálias)
    # couro marrom-escuro (a sombra da pele tem o mesmo tom, mas é clara ou
    # só um traço fino: some na abertura 3×3)
    couro = al & corpo & (h >= 2) & (h <= 17) & (s > 100) & (v > 35) & (v < 140)
    couro = cv2.morphologyEx(couro.astype(np.uint8), cv2.MORPH_OPEN, K3) > 0
    # punhos: peças de pele compactas (o tronco é grande; a corda do cinto,
    # da cor da pele, é larga e baixa)
    pl = pele(q) & corpo & ~couro
    np_, rp, sp, _ = cv2.connectedComponentsWithStats(pl.astype(np.uint8), connectivity=4)
    punhos = vazio.copy()
    tronco = 1 + int(np.argmax(sp[1:, cv2.CC_STAT_AREA])) if np_ > 1 else -1
    for k in range(1, np_):
        w, hh, a = sp[k, cv2.CC_STAT_WIDTH], sp[k, cv2.CC_STAT_HEIGHT], sp[k, cv2.CC_STAT_AREA]
        if k != tronco and 60 <= a <= 700 and max(w, hh) <= 32 and w <= hh * 2.2:
            punhos |= rp == k
    perto = cv2.dilate(punhos.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    n, rot, st, _ = cv2.connectedComponentsWithStats(couro.astype(np.uint8), connectivity=8)
    faixas = vazio.copy()
    # `dica`: as faixas dos quadros vizinhos (o pulso quase não sai do lugar
    # de um quadro para o outro): o couro que cai nelas também é faixa
    perto_dica = cv2.dilate(dica.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0 if dica is not None else vazio
    for k in range(1, n):
        c = rot == k
        a = st[k, cv2.CC_STAT_AREA]
        if 25 <= a <= 900 and ((c & perto).sum() >= 4 or (c & perto_dica).sum() >= a * 0.5):
            faixas |= c
    if not faixas.any():
        return faixas, faixas, None
    # mão e antebraço: o punho encostado e a pele em volta da faixa (pouco,
    # para não pintar o peito nem o quadril)
    livre = (pele(q) & corpo) | (al & (mx < 80) & corpo) | faixas
    semente = faixas | (punhos & (cv2.dilate(faixas.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0))
    braco, dist = crescer(semente, livre, 14)
    # o punho inteiro entra
    for k in range(1, np_):
        c = rp == k
        if (c & punhos).any() and (c & braco).any():
            braco |= c
            dist[c] = np.minimum(dist[c], 4)
    return faixas, braco, dist


def negro(q, m, f=None):
    """preto lustroso com reflexo roxo onde era claro; `f` (0–1) mistura (degradê)"""
    al, r, g, b, mx, mn = canais(q)
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
    base = np.stack([10 + 26 * lum, 6 + 12 * lum, 16 + 38 * lum], -1)
    brilho = np.clip((lum - 0.72) / 0.28, 0, 1)[..., None] * np.array([150, 90, 230])
    alvo = np.clip(base + brilho, 0, 255)
    out = q.astype(np.float32)
    k = (f if f is not None else np.ones(m.shape, np.float32))[..., None]
    mix = out[..., :3] * (1 - k) + alvo * k
    out[m, :3] = mix[m]
    return out


def aura(out, m, al):
    """contorno roxo fino por fora (o vapor do Haki)"""
    b5 = (cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~al
    out[b5] = (120, 50, 210, 150)
    b3 = (cv2.dilate(m.astype(np.uint8), K3) > 0) & ~al
    out[b3] = (165, 95, 255, 220)
    return out


def haki_quadro(q, tipo, dica=None):
    al = q[..., 3] > 0
    if tipo == 'espada':
        lam, guarda, braco, dist = mascara_espada(q)
        if not lam.any():
            return q, False
        out = q.astype(np.float32)
        if dist is not None and braco.any():
            f = np.clip(1 - (dist - 18) / 12, 0, 1)  # some em degradê perto do cotovelo
            out = negro(out.astype(np.uint8), braco, f)
        out = negro(out.astype(np.uint8), lam | guarda)
        duro = lam | guarda | (braco & (dist < 22) if dist is not None else braco)
        return aura(out, duro, al).astype(np.uint8), True
    faixas, braco, dist = mascara_punho(q, dica)
    if dist is None:
        return q, False
    f = np.clip(1 - (dist - 9) / 6, 0, 1)
    out = negro(q, braco, f)
    return aura(out, braco & (dist < 11), al).astype(np.uint8), True


def gerar(tipo, pid):
    pasta = os.path.join(RAIZ, 'public', 'sprites', pid)
    arq = os.path.join(pasta, 'manifesto.json')
    man = json.load(open(arq))
    Q = man['quadro'][0]
    total = achados = 0
    for anim, dirs in man['anims'].items():
        for d, e in dirs.items():
            T = np.asarray(Image.open(os.path.join(pasta, e['arquivo'])).convert('RGBA'))
            n = T.shape[1] // Q
            quadros = [T[:, i * Q:(i + 1) * Q].copy() for i in range(n)]
            dicas = [None] * n
            if tipo == 'punho':
                # 1ª passada: as faixas de cada quadro; a 2ª usa as dos vizinhos (laço)
                fx = [mascara_punho(q)[0] for q in quadros]
                dicas = [fx[(i - 1) % n] | fx[(i + 1) % n] if n > 1 else None for i in range(n)]
            qs = []
            for i in range(n):
                q, ok = haki_quadro(quadros[i], tipo, dicas[i])
                qs.append(q)
                total += 1
                achados += ok
            nome = f'{anim}-haki_{d}.png'
            Image.fromarray(np.concatenate(qs, axis=1)).save(os.path.join(pasta, nome), optimize=True)
            e.setdefault('variantes', {})['haki'] = {'arquivo': nome, 'quadros': n}
    json.dump(man, open(arq, 'w'), indent=1)
    print(f'{pid}: haki em {achados}/{total} quadros')


if __name__ == '__main__':
    for pid in sys.argv[2:]:
        gerar(sys.argv[1], pid)
