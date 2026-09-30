"""
Importa um personagem montado no gerador LPC (Universal LPC Spritesheet
Character Generator, liberatedpixelcup.github.io) para o jogo.

No gerador: monte o personagem e baixe "ZIP: Split by animation". Depois:

    python3 frontend/scripts/sprites/importar_lpc.py <pasta-ou-zip> <nome>

Gera public/sprites/<nome>/ com as tiras de cada animação por direção,
ampliadas 2× com suavização de pixel art (EPX): o boneco de ~48 px vira
~96 px, o tamanho de um personagem de Ragnarok. As folhas da LPC têm 4
direções (N, W, S, E); as diagonais usam a lateral mais próxima.

Animações: parado (idle), andar (walk), correr (run) e atacar — golpe largo
da arma (slash_oversize) se houver, arco (shoot) para arqueiros, ou golpe
curto (slash).

Licença: a arte LPC é CC-BY-SA / GPL — os créditos (credits.csv) vão junto
para a pasta do personagem e precisam aparecer nos créditos do jogo.
"""
import json
import os
import shutil
import sys
import tempfile
import zipfile

import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ESCALA = 2
# linhas das folhas LPC
LINHAS = {'N': 0, 'W': 1, 'S': 2, 'E': 3}
# pé do boneco no quadro de 64 px (e no de 192 px dos golpes largos)
PE_64 = (32, 62)


def epx(a):
    """Scale2x/EPX: dobra o tamanho arredondando os degraus das diagonais."""
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    P, A, B, C, D = p[1:-1, 1:-1], p[:-2, 1:-1], p[1:-1, 2:], p[1:-1, :-2], p[2:, 1:-1]
    eq = lambda x, y: (x == y).all(-1)
    H, W = a.shape[:2]
    o = np.zeros((H * 2, W * 2, 4), np.uint8)
    o[0::2, 0::2] = np.where((eq(C, A) & ~eq(C, D) & ~eq(A, B))[..., None], A, P)
    o[0::2, 1::2] = np.where((eq(A, B) & ~eq(A, C) & ~eq(B, D))[..., None], B, P)
    o[1::2, 0::2] = np.where((eq(D, C) & ~eq(D, B) & ~eq(C, A))[..., None], C, P)
    o[1::2, 1::2] = np.where((eq(B, D) & ~eq(B, A) & ~eq(D, C))[..., None], D, P)
    return o


def quadros_da_linha(folha, linha, tam, pular_primeiro=False):
    a = np.asarray(folha.convert('RGBA'))
    fs = []
    for c in range(a.shape[1] // tam):
        q = a[linha * tam:(linha + 1) * tam, c * tam:(c + 1) * tam]
        if q[..., 3].any():
            fs.append(q)
    return fs[1:] if pular_primeiro and len(fs) > 1 else fs


def importar(origem, nome):
    tmp = None
    if origem.endswith('.zip'):
        tmp = tempfile.mkdtemp()
        zipfile.ZipFile(origem).extractall(tmp)
        origem = tmp
    std = os.path.join(origem, 'standard')
    cus = os.path.join(origem, 'custom')
    pasta = os.path.join(RAIZ, 'public', 'sprites', nome)
    os.makedirs(pasta, exist_ok=True)

    # golpe: arma larga (192 px), arco ou golpe curto
    if os.path.exists(os.path.join(cus, 'slash_oversize.png')):
        ataque = ('custom/slash_oversize.png', 192, {'fps': 12, 'impacto': 3})
    elif os.path.exists(os.path.join(cus, 'walk_128.png')):  # tem arco
        ataque = ('standard/shoot.png', 64, {'fps': 16, 'impacto': 9})
    else:
        ataque = ('standard/slash.png', 64, {'fps': 12, 'impacto': 3})
    fontes = {
        'parado': ('standard/idle.png', 64, False),
        'andar': ('standard/walk.png', 64, True),  # o 1º quadro do walk é o parado
        'correr': ('standard/run.png', 64, False),
        'atacar': (ataque[0], ataque[1], False),
    }
    man = {
        'quadro': [64 * ESCALA, 64 * ESCALA],
        'pe': [PE_64[0] * ESCALA, PE_64[1] * ESCALA],
        'densidade': 1,
        'apelidos': {'SE': 'E', 'NE': 'E', 'SW': 'W', 'NW': 'W'},
        'tempos': {'parado': {'fps': 2}, 'atacar': ataque[2]},
        'fonte': 'LPC (Universal LPC Spritesheet Character Generator) — ver creditos.csv',
        'anims': {},
    }
    altura = 0
    for anim, (arq, tam, pular) in fontes.items():
        folha = Image.open(os.path.join(origem, arq))
        for d, linha in LINHAS.items():
            fs = quadros_da_linha(folha, linha, tam, pular)
            if not fs:
                continue
            tira = epx(np.concatenate(fs, axis=1))
            nome_arq = f'{anim}_{d}.png'
            Image.fromarray(tira).save(os.path.join(pasta, nome_arq), optimize=True)
            e = {'arquivo': nome_arq, 'quadros': len(fs)}
            if tam != 64:
                off = (tam - 64) // 2
                e['quadro'] = [tam * ESCALA, tam * ESCALA]
                e['pe'] = [(PE_64[0] + off) * ESCALA, (PE_64[1] + off) * ESCALA]
            man['anims'].setdefault(anim, {})[d] = e
            if anim == 'parado' and d == 'S':
                ys = np.nonzero(fs[0][..., 3].any(1))[0]
                altura = int(PE_64[1] - ys.min()) * ESCALA
    man['altura'] = altura
    with open(os.path.join(pasta, 'manifesto.json'), 'w') as f:
        json.dump(man, f, indent=1, ensure_ascii=False)
    cred = os.path.join(origem, 'credits', 'credits.csv')
    if os.path.exists(cred):
        shutil.copy(cred, os.path.join(pasta, 'creditos.csv'))
    if tmp:
        shutil.rmtree(tmp)
    print(f'{nome}: altura {altura} px, ataque {ataque[0]}')


if __name__ == '__main__':
    importar(sys.argv[1], sys.argv[2])
