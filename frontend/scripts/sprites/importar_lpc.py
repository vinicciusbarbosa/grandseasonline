"""
Importa um personagem montado no gerador LPC (Universal LPC Spritesheet
Character Generator, liberatedpixelcup.github.io) para o jogo.

No gerador: monte o personagem e baixe "ZIP: Split by animation and item"
(cada peça numa imagem separada). Depois:

    python3 frontend/scripts/sprites/importar_lpc.py <pasta-ou-zip> <nome> [arma_extra]

(arma_extra: arma no padrão LPC fora do gerador, ex. espingarda — ver
fonte/lpc/armas/LEIAME.md)

Gera public/sprites/<nome>/ com as tiras de cada animação por direção,
ampliadas 2× com suavização de pixel art (EPX): o boneco de ~48 px vira
~96 px, o tamanho de um personagem de Ragnarok. As folhas da LPC têm 4
direções (N, W, S, E); as diagonais usam a lateral mais próxima.

Animações: andar (walk), parado (1º quadro do walk), correr (o walk, mais
rápido) e atacar — golpe largo da arma (slash_oversize) se houver, arco
(shoot) para arqueiros, ou golpe curto (slash). Várias peças da LPC (casaca,
faixa...) não têm idle/run, por isso tudo sai do walk.

Como as peças vêm separadas, gera também a variante "haki" (Haki de
armamento) de cada animação: a arma negra com a aura roxa girando e a mão e
o antebraço que seguram a arma endurecidos — pintando só a camada certa
(arma, corpo, mangas), sem adivinhar pelo desenho.

Licença: a arte LPC é CC-BY-SA / GPL — os créditos (credits.csv) vão junto
para a pasta do personagem e precisam aparecer nos créditos do jogo.
"""
import json
import math
import random
import os
import shutil
import sys
import tempfile
import zipfile

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from haki_armamento import espiral  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ESCALA = 2
# linhas das folhas LPC
LINHAS = {'N': 0, 'W': 1, 'S': 2, 'E': 3}
# pé do boneco no quadro de 64 px
PE_64 = (32, 62)
# peças que formam o braço (pele e mangas); o resto não endurece
BRACO = ('body', 'clothes', 'jacket', 'gloves', 'arms', 'wrists', 'sleeves', 'bracers')
CABECA = ('head', 'expression', 'hair', 'hat', 'hat_trim', 'hat_overlay', 'hat_accessory', 'beard', 'facial_eyes')
ARCOS = ('normal', 'recurve', 'great', 'crossbow', 'slingshot')
# armas no padrão LPC que não estão no gerador (fonte/lpc/armas/): linhas da
# folha de 21 linhas usadas por animação
ARMAS_EXTRAS = {
    'espingarda': {'walk': 8, 'thrust': 4, 'ataque': ('standard/thrust', 64, {'fps': 12, 'impacto': 5})},
}
PASTA_ARMAS = os.path.join(os.path.dirname(__file__), 'fonte', 'lpc', 'armas')
# alcance do endurecimento a partir da mão (px da arte LPC): mão e punho da
# manga — mais que isso entra no peito quando a mão está na frente do corpo
ALCANCE = 5


def epx(a):
    """Scale2x/EPX: dobra o tamanho arredondando os degraus das diagonais."""
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    P, A, B, C, D = p[1:-1, 1:-1], p[:-2, 1:-1], p[1:-1, 2:], p[1:-1, :-2], p[2:, 1:-1]
    eq = lambda x, y: (x == y).all(-1)
    H, W = a.shape[:2]
    o = np.zeros((H * 2, W * 2, a.shape[2]), np.uint8)
    o[0::2, 0::2] = np.where((eq(C, A) & ~eq(C, D) & ~eq(A, B))[..., None], A, P)
    o[0::2, 1::2] = np.where((eq(A, B) & ~eq(A, C) & ~eq(B, D))[..., None], B, P)
    o[1::2, 0::2] = np.where((eq(D, C) & ~eq(D, B) & ~eq(C, A))[..., None], C, P)
    o[1::2, 1::2] = np.where((eq(B, D) & ~eq(B, A) & ~eq(D, C))[..., None], D, P)
    return o


def arquivo_do_item(nome):
    """'Saber (saber)' → 'saber__saber_' (como o gerador nomeia as camadas)."""
    return nome.lower().replace(' ', '_').replace('(', '_').replace(')', '_')


def tipos_das_camadas(personagem):
    """nome do arquivo da camada → tipo (weapon, body, clothes...)."""
    return {arquivo_do_item(s['name']): tipo for tipo, s in personagem['selections'].items()}


def camadas_da_arma_extra(nome, anim):
    """Peça de arma extra para uma animação: por cima do corpo, e por trás
    dele na linha de costas (N) — [(z, tipo, item, imagem)]."""
    info = ARMAS_EXTRAS[nome]
    folha = np.asarray(Image.open(os.path.join(PASTA_ARMAS, f'{nome}.png')).convert('RGBA'))
    ini = info[anim] * 64
    bloco = folha[ini:ini + 4 * 64]
    frente, tras = bloco.copy(), np.zeros_like(bloco)
    tras[:64], frente[:64] = bloco[:64], 0  # linha 0 = costas
    return [(5, 'weapon', f'{nome}-tras', tras), (140, 'weapon', nome, frente)]


def ler_camadas(pasta, tipos, extras=()):
    """Camadas de uma animação, na ordem de desenho: [(tipo, item, imagem)]."""
    out = []
    def z(n):  # '150 saber.png' → 150; '0-1 espada.png' → -1 (atrás do corpo)
        p = n.split(' ')[0]
        return int(p) if p.isdigit() else -int(p.split('-')[-1])

    for arq in sorted(os.listdir(pasta), key=lambda n: (z(n), n)):
        item = arq.split(' ', 1)[1][:-4]
        out.append((z(arq), tipos.get(item, '?'), item, np.asarray(Image.open(os.path.join(pasta, arq)).convert('RGBA'))))
    out += list(extras)
    out.sort(key=lambda c: c[0])
    return [c[1:] for c in out]


def enegrecer(a, mask, f=None):
    """Preto lustroso do Haki: escuro com reflexo roxo onde era claro."""
    rgb = a[..., :3].astype(np.float32)
    lum = (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]) / 255.0
    negro = np.stack([10 + 30 * lum, 6 + 12 * lum, 16 + 40 * lum], -1)
    reflexo = np.clip((lum - 0.7) / 0.3, 0, 1)[..., None] * np.array([70, 36, 120])
    alvo = np.clip(negro + reflexo, 0, 255)
    k = mask.astype(np.float32) if f is None else mask * f
    a = a.copy()
    a[..., :3] = (rgb * (1 - k[..., None]) + alvo * k[..., None]).astype(np.uint8)
    return a


def clarao(im):
    """Clarão do disparo (amarelo vivo) — fica aceso mesmo com Haki."""
    r, g, b = (im[..., i].astype(int) for i in range(3))
    return (r > 200) & (g > 180) & (b < 140)


def compor(camadas, haki, braco=True):
    """Junta as camadas de um quadro. Com haki, pinta arma e braço antes.
    Devolve (imagem, máscara da arma visível, máscara da mão na arma)."""
    H, W = camadas[0][2].shape[:2]
    alfa = lambda c: c[2][..., 3] > 0
    arma = np.zeros((H, W), bool)
    for c in camadas:
        if c[0] in ('weapon', 'ammo'):
            arma |= alfa(c)
    mao = np.zeros((H, W), bool)
    if haki and arma.any() and not braco:
        camadas = [(t, i, enegrecer(im, (im[..., 3] > 0) & ~clarao(im)) if t in ('weapon', 'ammo') else im) for t, i, im in camadas]
    elif haki and arma.any():
        corpo = np.zeros((H, W), bool)
        for c in camadas:
            if c[0] == 'body':
                corpo |= alfa(c)
        perto = cv2.dilate(arma.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        mao = corpo & perto
        if not mao.any():  # mão coberta (luva, manga): a peça do braço encostada na arma
            for c in camadas:
                if c[0] in BRACO:
                    mao |= alfa(c) & perto
        livre = np.zeros((H, W), bool)
        cabeca = np.zeros((H, W), bool)
        for c in camadas:
            if c[0] in BRACO:
                livre |= alfa(c)
            if c[0] in CABECA:
                cabeca |= alfa(c)
        livre &= ~(cv2.dilate(cabeca.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        dist = np.full((H, W), 99.0, np.float32)
        dist[mao] = 0
        feito = mao.copy()
        for passo in range(1, ALCANCE + 1):
            novo = (cv2.dilate(feito.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & livre & ~feito
            if not novo.any():
                break
            dist[novo] = passo
            feito |= novo
        f = np.clip(1 - (dist - (ALCANCE - 2)) / 2, 0, 1)
        camadas = [
            (t, i, enegrecer(im, im[..., 3] > 0) if t in ('weapon', 'ammo')
             else enegrecer(im, feito & (im[..., 3] > 0), f) if t in BRACO else im)
            for t, i, im in camadas
        ]
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    topo = np.full((H, W), -1)
    for n, (t, _, im) in enumerate(camadas):
        img.alpha_composite(Image.fromarray(im))
        topo[im[..., 3] > 0] = n
    visivel = np.isin(topo, [n for n, c in enumerate(camadas) if c[0] in ('weapon', 'ammo')])
    return np.asarray(img), visivel & arma, mao


def quadros(camadas, linha, tam):
    """Quadros não vazios de uma linha (direção): [[(tipo, item, recorte)]]."""
    n = camadas[0][2].shape[1] // tam
    out = []
    for c in range(n):
        q = [(t, i, im[linha * tam:(linha + 1) * tam, c * tam:(c + 1) * tam]) for t, i, im in camadas]
        if any(x[2][..., 3].any() for x in q):
            out.append(q)
    return out


def tira(qs, haki, arco, semente):
    """Quadros → tira ampliada 2× (com o Haki desenhado por cima, se pedido)."""
    fs = []
    for k, q in enumerate(qs):
        img, arma, mao = compor(q, haki, braco=not arco)
        big = epx(img)
        if haki and arma.any() and not arco:
            ml = np.kron(arma, np.ones((ESCALA, ESCALA), bool))
            gd = np.kron(mao, np.ones((ESCALA, ESCALA), bool))
            if not gd.any():
                # sem pele encostada (mão coberta): o ponto da arma que toca o corpo
                resto = (big[..., 3] > 0) & ~ml
                gd = ml & (cv2.dilate(resto.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
            big = espiral(big, ml, gd, k * 1.9, semente + k, esc=0.38)
        elif haki and arma.any():
            # arco e armas de fogo: arma negra e brilho roxo em volta, sem
            # endurecer o braço (a arma atravessa o corpo) — a espiral é para lâminas
            ml = np.kron(arma, np.ones((ESCALA, ESCALA), bool))
            anel = (cv2.dilate(ml.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & (big[..., 3] == 0)
            anel &= ~(cv2.dilate(clarao(big).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
            big = big.copy()
            big[anel] = (150, 76, 245, 220)
        fs.append(big)
    return np.concatenate(fs, axis=1)


def rei_de(normal, haki, largura, semente):
    """Haki do Rei imbuído: a versão com Haki vira negra e VERMELHA (o roxo
    do armamento troca de cor) e ganha raios negros de borda vermelha
    estalando em volta da arma."""
    rnd = random.Random(semente * 7 + 3)
    out = haki.copy()
    mudou = np.any(haki != normal, axis=-1) & (haki[..., 3] > 0)
    r, g, b = (out[..., i].astype(np.float32) for i in range(3))
    roxo = mudou & (b > g + 25) & (r > g)
    out[..., 0] = np.where(roxo, np.clip(b * 1.0, 0, 255), r).astype(np.uint8)
    out[..., 1] = np.where(roxo, g * 0.35, g).astype(np.uint8)
    out[..., 2] = np.where(roxo, r * 0.3, b).astype(np.uint8)
    H = out.shape[0]
    for x0 in range(0, out.shape[1], largura):
        m = mudou[:, x0:x0 + largura]
        ys, xs = np.nonzero(m)
        if not len(ys):
            continue
        q = np.ascontiguousarray(out[:, x0:x0 + largura])
        raio = np.zeros_like(q)
        for _ in range(rnd.randint(2, 3)):
            i = rnd.randrange(len(ys))
            p = np.array([xs[i], ys[i]], np.float32)
            ang = rnd.uniform(0, 2 * math.pi)
            pts = [p.copy()]
            for _ in range(4):
                ang += rnd.uniform(-0.9, 0.9)
                p = p + np.array([math.cos(ang), math.sin(ang)]) * rnd.uniform(4, 8)
                pts.append(p.copy())
            pl = np.array(pts, np.int32).reshape(-1, 1, 2)
            cv2.polylines(raio, [pl], False, (215, 16, 36, 255), 3, lineType=cv2.LINE_8)
            cv2.polylines(raio, [pl], False, (14, 0, 6, 255), 1, lineType=cv2.LINE_8)
        # só no vazio e na própria arma (não risca o corpo)
        onde = (raio[..., 3] > 0) & ((q[..., 3] == 0) | m)
        q[onde] = raio[onde]
        out[:, x0:x0 + largura] = q
    return out


def importar(origem, nome, arma_extra=None):
    tmp = None
    if origem.endswith('.zip'):
        tmp = tempfile.mkdtemp()
        zipfile.ZipFile(origem).extractall(tmp)
        origem = tmp
    personagem = json.load(open(os.path.join(origem, 'character.json')))
    tipos = tipos_das_camadas(personagem)
    arma = personagem['selections'].get('weapon', {}).get('itemId', '')
    arco = any(a in arma for a in ARCOS) or bool(arma_extra)  # à distância: sem espiral
    pasta = os.path.join(RAIZ, 'public', 'sprites', nome)
    if os.path.isdir(pasta):
        shutil.rmtree(pasta)
    os.makedirs(pasta)

    # golpe: arma extra, arma larga (192 px), arco ou golpe curto
    if arma_extra:
        ataque = ARMAS_EXTRAS[arma_extra]['ataque']
    elif os.path.isdir(os.path.join(origem, 'custom', 'slash_oversize')):
        ataque = ('custom/slash_oversize', 192, {'fps': 12, 'impacto': 3})
    elif arco:
        ataque = ('standard/shoot', 64, {'fps': 16, 'impacto': 9})
    else:
        ataque = ('standard/slash', 64, {'fps': 12, 'impacto': 3})
    man = {
        'quadro': [64 * ESCALA, 64 * ESCALA],
        'pe': [PE_64[0] * ESCALA, PE_64[1] * ESCALA],
        'densidade': 1,
        'apelidos': {'SE': 'E', 'NE': 'E', 'SW': 'W', 'NW': 'W'},
        'tempos': {'atacar': ataque[2]},
        'fonte': 'LPC (Universal LPC Spritesheet Character Generator) — ver creditos.csv',
        'anims': {},
    }
    extra = lambda anim: camadas_da_arma_extra(arma_extra, anim) if arma_extra else ()
    andar = ler_camadas(os.path.join(origem, 'standard', 'walk'), tipos, extra('walk'))
    golpe = ler_camadas(os.path.join(origem, *ataque[0].split('/')), tipos, extra(ataque[0].split('/')[-1]))
    altura = 0
    semente = sum(map(ord, nome))
    for d, linha in LINHAS.items():
        qa = quadros(andar, linha, 64)
        qg = quadros(golpe, linha, ataque[1])
        partes = {'parado': (qa[:1], 64), 'andar': (qa[1:], 64), 'atacar': (qg, ataque[1])}
        for anim, (qs, tam) in partes.items():
            tiras = {}
            for haki in (False, True):
                arq = f'{anim}{"-haki" if haki else ""}_{d}.png'
                tiras[haki] = tira(qs, haki, arco, semente)
                Image.fromarray(tiras[haki]).save(os.path.join(pasta, arq), optimize=True)
            e = {'arquivo': f'{anim}_{d}.png', 'quadros': len(qs),
                 'variantes': {'haki': {'arquivo': f'{anim}-haki_{d}.png', 'quadros': len(qs)}}}
            if anim == 'atacar':
                rei = rei_de(tiras[False], tiras[True], tam * ESCALA, semente + linha)
                Image.fromarray(rei).save(os.path.join(pasta, f'atacar-rei_{d}.png'), optimize=True)
                e['variantes']['rei'] = {'arquivo': f'atacar-rei_{d}.png', 'quadros': len(qs)}
            if tam != 64:
                off = (tam - 64) // 2
                e['quadro'] = [tam * ESCALA, tam * ESCALA]
                e['pe'] = [(PE_64[0] + off) * ESCALA, (PE_64[1] + off) * ESCALA]
            man['anims'].setdefault(anim, {})[d] = e
        # correr: o próprio andar, mais rápido (mesmos arquivos)
        man['anims'].setdefault('correr', {})[d] = json.loads(json.dumps(man['anims']['andar'][d]))
        if d == 'S':
            img, _, _ = compor(qa[0], False)
            ys = np.nonzero(img[..., 3].any(1))[0]
            altura = int(PE_64[1] - ys.min()) * ESCALA
    man['altura'] = altura
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1, ensure_ascii=False)
    cred = os.path.join(origem, 'credits', 'credits.csv')
    if os.path.exists(cred):
        shutil.copy(cred, os.path.join(pasta, 'creditos.csv'))
    if tmp:
        shutil.rmtree(tmp)
    print(f'{nome}: altura {altura} px, ataque {ataque[0]}{" (arco)" if arco else ""}')


if __name__ == '__main__':
    importar(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
