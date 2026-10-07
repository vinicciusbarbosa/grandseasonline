"""
Arma de Luz (Pika Pika): onde a luz vai em cada quadro de cada personagem.

    python3 arma_luz.py

Grava public/sprites/<id>/luz.json com, por animação e direção, a lista de
pontos de cada quadro (px do quadro do manifesto):
  - espada: {x, y, a, c, atras?} — empunhadura (x, y), ângulo da lâmina na
    tela (graus, 0 = para cima, + = horário) e comprimento (px) da espada.
    O jogo prende a espada de luz do Kizaru (Effekseer) nesse ponto.
  - punho: {x, y} — punho do lutador (carga de luz do Yasakani).
O atirador ganha uma cópia das folhas com o cano do rifle em luz amarela
(<id>-luz), que o jogo usa enquanto a Arma de Luz está ligada.
"""
import json, os, shutil
import cv2, numpy as np
from scipy import ndimage

import ro_importar as ro

DIRS = ['S', 'N', 'E', 'W']


def folha(pid, anim):
    man = json.load(open(os.path.join(ro.SPR, pid, 'manifesto.json')))
    for d in DIRS:
        a = man['anims'].get(anim, {}).get(d)
        if not a:
            continue
        im = cv2.imread(os.path.join(ro.SPR, pid, a['arquivo']), cv2.IMREAD_UNCHANGED)
        w = im.shape[1] // a['quadros']
        yield d, [im[:, j * w:(j + 1) * w] for j in range(a['quadros'])]


def laminas(q, maximo=2):
    """lâminas (cinza claro, finas e compridas): [(empunhadura, ponta, comprimento)].
    A empunhadura é a ponta mais perto do meio do corpo"""
    hsv = cv2.cvtColor(q[..., :3], cv2.COLOR_BGR2HSV).astype(int)
    m = (q[..., 3] > 0) & (hsv[..., 1] < 70) & (hsv[..., 2] > 140)
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    ys0, xs0 = np.nonzero(q[..., 3] > 0)
    meio = np.array([np.median(xs0), np.percentile(ys0, 55)])
    out = []
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        if len(xs) < 12:
            continue
        P = np.c_[xs, ys].astype(float)
        c = P.mean(0)
        _, _, vt = np.linalg.svd(P - c, full_matrices=False)
        d = vt[0]
        proj = (P - c) @ d
        larg = ((P - c) @ vt[1]).std() * 4 + 1
        comp = proj.max() - proj.min()
        if comp < 10 or comp / larg < 3:
            continue
        a, b = c + d * proj.min(), c + d * proj.max()
        if np.linalg.norm(b - meio) < np.linalg.norm(a - meio):
            a, b = b, a
        out.append((a, b, comp))
    # as duas mais compridas (dual blade)
    return sorted(out, key=lambda x: -x[2])[:maximo]


def angulo(de, para):
    v = para - de
    return float(np.degrees(np.arctan2(v[0], -v[1])))


def katanas(pid):
    """as espadas de luz por cima das katanas: uma por lâmina achada"""
    luz = {}
    for anim in ('andar', 'atacar'):
        luz[anim] = {}
        for d, qs in folha(pid, anim):
            fr = []
            for q in qs:
                pts = [{'x': round(float(a[0]), 1), 'y': round(float(a[1]), 1), 'a': round(angulo(a, b), 1),
                        'c': round(comp * 1.12, 1)} for a, b, comp in laminas(q)]
                # lâmina escondida neste quadro (atrás do corpo, cruzada): a do quadro anterior
                if fr and len(pts) < len(fr[-1]):
                    pts += fr[-1][len(pts):]
                fr.append(pts)
            # o 1º quadro sem as duas: as do último
            if fr and len(fr[0]) < max(len(p) for p in fr):
                fr[0] = max(fr, key=len)
            luz[anim][d] = fr
    luz['correr'] = luz['andar']
    luz['parado'] = {d: v[:1] for d, v in luz['andar'].items()}
    return {'tipo': 'espada', 'anims': luz}


def punhos(pid):
    """lutador: as duas pontas do corpo na altura dos braços (os punhos)"""
    luz = {}
    for anim in ('andar', 'atacar'):
        luz[anim] = {}
        for d, qs in folha(pid, anim):
            fr = []
            for q in qs:
                a = q[..., 3] > 0
                ys = np.nonzero(a.any(1))[0]
                y0, y1 = ys.min(), ys.max()
                h = y1 - y0
                faixa = a.copy()
                faixa[:y0 + int(h * 0.3)] = False
                faixa[y0 + int(h * 0.62):] = False
                fy, fx = np.nonzero(faixa)
                pts = []
                for x in (fx.min(), fx.max()):
                    m = np.abs(fx - x) <= 3
                    pts.append({'x': round(float(fx[m].mean()), 1), 'y': round(float(fy[m].mean()), 1)})
                fr.append(pts)
            luz[anim][d] = fr
    luz['correr'] = luz['andar']
    luz['parado'] = {d: v[:1] for d, v in luz['andar'].items()}
    return {'tipo': 'punho', 'anims': luz}


def rifle_de_luz(pid):
    """cópia das folhas do atirador com o cano do rifle em luz amarela"""
    destino = os.path.join(ro.SPR, pid + '-luz')
    if os.path.exists(destino):
        shutil.rmtree(destino)
    shutil.copytree(os.path.join(ro.SPR, pid), destino)
    for arq in os.listdir(destino):
        if not arq.endswith('.png'):
            continue
        p = os.path.join(destino, arq)
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2HSV).astype(int)
        cinza = (im[..., 3] > 0) & (hsv[..., 1] < 45) & (hsv[..., 2] > 140)
        lab, n = ndimage.label(cinza, structure=np.ones((3, 3)))
        cano = np.zeros_like(cinza)
        for k in range(1, n + 1):
            ys, xs = np.nonzero(lab == k)
            if len(xs) < 6:
                continue
            P = np.c_[xs, ys].astype(float)
            c = P.mean(0)
            _, s, vt = np.linalg.svd(P - c, full_matrices=False)
            comp = np.ptp((P - c) @ vt[0])
            larg = ((P - c) @ vt[1]).std() * 4 + 1
            if comp >= 8 and comp / larg >= 2.5:
                cano |= lab == k
        # o cano vira luz (núcleo branco, borda amarela) com um brilho em volta
        out = im.astype(np.float32)
        v = hsv[..., 2][cano].astype(np.float32) / 255
        out[cano, 0] = 120 + 100 * v
        out[cano, 1] = 235
        out[cano, 2] = 255
        out[cano, 3] = 255
        halo = cv2.GaussianBlur(cano.astype(np.float32), (0, 0), 1.6)
        halo = np.clip(halo * 2.2, 0, 1) * (~cano)
        cor = np.array([60, 230, 255], np.float32)
        a0 = out[..., 3:] / 255
        a1 = halo[..., None] * 0.85
        ar = a1 + a0 * (1 - a1)
        out[..., :3] = np.where(ar > 0, (cor * a1 + out[..., :3] * a0 * (1 - a1)) / np.maximum(ar, 1e-6), 0)
        out[..., 3:] = ar * 255
        cv2.imwrite(p, out.clip(0, 255).astype(np.uint8))
    print(pid + '-luz', 'cano em luz')


# Capitão (espadachim de colete vermelho) com a espada de luz nas duas mãos:
# empunhadura marcada à mão em cada quadro das folhas pirata-capitao-luz
C = 52  # comprimento da espada (px)
CAPITAO = {
    'atacar': {
        'S': [(75, 84, 20), (52, 75, -45), (74, 52, 0), (91, 91, 120), (97, 72, 90), (76, 83, 20)],
        'N': [(75, 80, 0, 1), (102, 68, 60), (66, 50, 0), (50, 89, -120), (43, 63, -90), (75, 80, 0, 1)],
        'E': [(91, 80, 45), (47, 68, -60), (85, 56, 0), (104, 86, 120), (118, 64, 90), (93, 80, 45)],
        'W': [(57, 78, -45), (101, 70, 60, 1), (72, 52, 0), (44, 85, -120), (105, 60, 45, 1), (58, 79, -45)],
    },
    # andando: a espada na mão da frente, apontada para baixo
    'andar': {'S': [(98, 72, 150)] * 8, 'N': [(52, 72, -150, 1)] * 8, 'E': [(91, 71, 135)] * 8, 'W': [(59, 71, -135)] * 8},
}


def capitao():
    luz = {}
    for anim, por_dir in CAPITAO.items():
        luz[anim] = {d: [[{'x': p[0], 'y': p[1], 'a': p[2], 'c': C, **({'atras': True} if len(p) > 3 else {})}] for p in qs]
                     for d, qs in por_dir.items()}
    luz['correr'] = luz['andar']
    luz['parado'] = {d: v[:1] for d, v in luz['andar'].items()}
    return {'tipo': 'espada', 'anims': luz}


def gravar(pid, dados):
    json.dump(dados, open(os.path.join(ro.SPR, pid, 'luz.json'), 'w'), separators=(',', ':'))
    print(pid, dados['tipo'])


if __name__ == '__main__':
    gravar('pirata-capitao-luz', capitao())
    for pid in ('pirata-medico', 'marinha-enfermeira'):
        gravar(pid, katanas(pid))
    for pid in ('pirata-lutador', 'marinha-soldado', 'marinha-oficial'):
        gravar(pid, punhos(pid))
    for pid in ('pirata-atiradora', 'marinha-atirador'):
        rifle_de_luz(pid)
