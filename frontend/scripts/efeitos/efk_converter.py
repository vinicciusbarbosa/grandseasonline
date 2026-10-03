"""
Efeito do Effekseer (.efkproj, o projeto em XML) -> JSON leve que o jogo toca
(src/tabuleiro/cena/efk.ts), mais as texturas.

    python3 scripts/efeitos/efk_converter.py <projeto.efkproj> <nome>

Grava public/sprites/efk/<nome>/efeito.json e copia as texturas usadas (Texture/*.png,
procuradas ao lado do projeto). O tocador do jogo cobre o que esses efeitos
usam: sprite, fita (ribbon) e anel; posição fixa, PVA (posição, velocidade,
aceleração com faixa aleatória) e curva; rotação fixa/PVA; escala fixa/easing;
geração em círculo; aditivo/mistura; fade; UV fixo e rolando.
Valores ausentes no XML usam o padrão do Effekseer.
"""
import json, os, shutil, sys
import xml.etree.ElementTree as ET

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def num(e, padrao=0.0):
    if e is None or e.text is None or not e.text.strip():
        return padrao
    t = e.text.strip()
    return 1.0 if t == 'True' else 0.0 if t == 'False' else float(t)


def faixa(e, padrao=0.0):
    """valor com Center/Max/Min (ou só o número) -> [min, max]"""
    if e is None:
        return [padrao, padrao]
    if e.find('Max') is not None or e.find('Min') is not None:
        c = num(e.find('Center'), padrao)
        return [num(e.find('Min'), c), num(e.find('Max'), c)]
    if e.find('Center') is not None:
        c = num(e.find('Center'), padrao)
        return [c, c]
    v = num(e, padrao)
    return [v, v]


def vetor(e, padrao=(0.0, 0.0, 0.0)):
    """X/Y/Z, cada um com faixa -> [[min,max] x3]"""
    return [faixa(None if e is None else e.find(k), p) for k, p in zip('XYZ', padrao)]


def cor(e):
    return [num(None if e is None else e.find(k), 255.0) / 255 for k in 'RGBA']


def curva(e):
    """FCurve (chaves lineares) -> [[quadro, valor], ...]"""
    if e is None:
        return [[0, 0]]
    ks = []
    for k in e:
        ks.append([num(k.find('Frame')), num(k.find('Value'))])
    return sorted(ks) or [[0, 0]]


def no(n):
    cv = n.find('CommonValues')
    g = lambda p: None if cv is None else cv.find(p)
    o = {
        'nome': n.findtext('Name') or '',
        'tipo': int(num(n.find('DrawingValues/Type'), 0)),
        'vida': faixa(g('Life'), 100),
        'max': int(num(None if g('MaxGeneration') is None else g('MaxGeneration').find('Value'), 1)),
        'intervalo': faixa(g('GenerationTime'), 1),
        'atraso': faixa(g('GenerationTimeOffset'), 0),
        # herança do pai: 0 não, 1 só ao nascer, 2 sempre (posição, rotação, escala)
        'heranca': [int(num(g(k), 2)) for k in ('LocationEffectType', 'RotationEffectType', 'ScaleEffectType')],
        'comPai': bool(num(g('RemoveWhenParentIsRemoved'), 0)),
    }
    # posição
    lv = n.find('LocationValues')
    if lv is not None:
        t = int(num(lv.find('Type'), 0))
        if t == 1:
            p = lv.find('PVA')
            o['pos'] = {'t': 'pva', 'p': vetor(p.find('Location')), 'v': vetor(p.find('Velocity')), 'a': vetor(p.find('Acceleration'))}
        elif t == 3:
            ks = lv.find('LocationFCurve/FCurve/Keys')
            o['pos'] = {'t': 'curva', 'c': [curva(None if ks is None else ks.find(k)) for k in 'XYZ']}
        else:
            o['pos'] = {'t': 'fixo', 'p': vetor(lv.find('Fixed/Location'))}
    # rotação (graus)
    rv = n.find('RotationValues')
    if rv is not None:
        t = int(num(rv.find('Type'), 0))
        if t == 1:
            p = rv.find('PVA')
            o['rot'] = {'t': 'pva', 'p': vetor(p.find('Rotation')), 'v': vetor(p.find('Velocity')), 'a': vetor(p.find('Acceleration'))}
        else:
            o['rot'] = {'t': 'fixo', 'p': vetor(rv.find('Fixed/Rotation'))}
    # escala
    sv = n.find('ScalingValues')
    if sv is not None:
        t = int(num(sv.find('Type'), 0))
        if t == 2:
            e = sv.find('Easing')
            o['esc'] = {'t': 'easing', 'de': vetor(e.find('Start'), (1, 1, 1)), 'ate': vetor(e.find('End'), (1, 1, 1))}
        else:
            o['esc'] = {'t': 'fixo', 'p': vetor(sv.find('Fixed/Scale'), (1, 1, 1))}
    # geração em círculo
    gl = n.find('GenerationLocationValues')
    if gl is not None and int(num(gl.find('Type'), 0)) == 3:
        c = gl.find('Circle')
        o['circulo'] = {
            'eixo': int(num(c.find('AxisDirection'), 2)), 'div': int(num(c.find('Division'), 8)),
            'ordem': int(num(c.find('Type'), 0)), 'raio': faixa(c.find('Radius'), 0),
            'a0': faixa(c.find('AngleStart'), 0), 'a1': faixa(c.find('AngleEnd'), 360),
            'ruido': faixa(c.find('AngleNoize'), 0),
        }
    # desenho
    rc = n.find('RendererCommonValues')
    if rc is not None:
        uvt = int(num(rc.find('UV'), 0))
        r = {
            'tex': rc.findtext('ColorTexture') or '',
            'mistura': int(num(rc.find('AlphaBlend'), 1)),  # 0 opaco, 1 mistura, 2 soma, 3 subtrai, 4 multiplica
            'fadeIn': num(rc.find('FadeIn/Frame'), 0) if int(num(rc.find('FadeInType'), 0)) else 0,
            'fadeOut': num(rc.find('FadeOut/Frame'), 0) if int(num(rc.find('FadeOutType'), 0)) else 0,
        }
        if uvt == 1:
            u = rc.find('UVFixed')
            r['uv'] = {'t': 'fixo', 'x': num(u.find('Start/X')), 'y': num(u.find('Start/Y')), 'w': num(u.find('Size/X'), 128), 'h': num(u.find('Size/Y'), 128)}
        elif uvt == 3:
            u = rc.find('UVScroll')
            r['uv'] = {'t': 'rolar', 'x': num(u.find('Start/X')), 'y': num(u.find('Start/Y')), 'w': num(u.find('Size/X'), 128), 'h': num(u.find('Size/Y'), 128),
                       'vx': num(u.find('Speed/X')), 'vy': num(u.find('Speed/Y'))}
        o['render'] = r
    dv = n.find('DrawingValues')
    if o['tipo'] == 2:
        s = dv.find('Sprite')
        o['sprite'] = {'billboard': int(num(s.find('Billboard'), 0)), 'cor': cor(s.find('ColorAll_Fixed'))}
    elif o['tipo'] == 3:
        s = dv.find('Ribbon')
        o['fita'] = {'l': num(s.find('Position_Fixed_L'), -0.5), 'r': num(s.find('Position_Fixed_R'), 0.5),
                     'cor': cor(s.find('ColorAll_Fixed')), 'olho': int(num(s.find('ViewpointDependent'), 0)),
                     'uvTipo': int(num(dv.find('TextureUVType/Type'), 0)), 'tile': num(dv.find('TextureUVType/TileLength'), 1)}
    elif o['tipo'] == 4:
        s = dv.find('Ring')
        loc = lambda p, px, py: [num(s.find(p + '/Location/X'), px), num(s.find(p + '/Location/Y'), py)]
        o['anel'] = {'vertices': int(num(s.find('VertexCount'), 16)), 'fora': loc('Outer_Fixed', 2, 0), 'dentro': loc('Inner_Fixed', 1, 0),
                     'meio': num(s.find('CenterRatio_Fixed'), 0.5),
                     'corFora': cor(s.find('OuterColor_Fixed')), 'corMeio': cor(s.find('CenterColor_Fixed')), 'corDentro': cor(s.find('InnerColor_Fixed'))}
    elif o['tipo'] == 5:
        s = dv.find('Model')
        o['modelo'] = {'arq': s.findtext('Model') or '', 'cor': cor(s.find('Color_Fixed')), 'culling': int(num(s.find('Culling'), 0))}
    o['filhos'] = [no(c) for c in n.findall('Children/Node')]
    return o


def modelo(de, para):
    """.efkmodel (versão 5, com poses) -> JSON com base64: índices (u16),
    UV (f32), cor por vértice (u8, da 1ª pose) e posições de cada pose (f32)"""
    import base64, struct
    import numpy as np
    d = open(de, 'rb').read()
    versao, escala, _, poses = struct.unpack_from('<ifii', d, 0)
    o = 16
    out = {'poses': []}
    for k in range(poses):
        nv, = struct.unpack_from('<i', d, o)
        o += 4
        v = np.frombuffer(d, np.uint8, nv * 60, o).reshape(nv, 60)
        o += nv * 60
        nf, = struct.unpack_from('<i', d, o)
        o += 4
        f = np.frombuffer(d, '<i4', nf * 3, o)
        o += nf * 12
        b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
        out['poses'].append(b64(v[:, :12].copy().view('<f4').reshape(nv, 3) * escala))
        if k == 0:
            out.update(nv=nv, nf=nf, idx=b64(f.astype('<u2')), uv=b64(v[:, 48:56].copy().view('<f4')), cor=b64(v[:, 56:60]))
    json.dump(out, open(para, 'w'), separators=(',', ':'))


def converter(proj, nome):
    raiz = ET.parse(proj).getroot()
    ef = {'fim': num(raiz.find('EndFrame'), 120), 'filhos': [no(c) for c in raiz.findall('Root/Children/Node')]}
    texs = set()
    mods = set()

    def junta(n):
        if n.get('render', {}).get('tex'):
            texs.add(n['render']['tex'])
        if n.get('modelo', {}).get('arq'):
            mods.add(n['modelo']['arq'])
        for f in n['filhos']:
            junta(f)
    for f in ef['filhos']:
        junta(f)
    dest = os.path.join(RAIZ, 'public', 'sprites', 'efk', nome)
    os.makedirs(dest, exist_ok=True)
    for t in texs:
        de = os.path.join(os.path.dirname(proj), t)
        os.makedirs(os.path.join(dest, os.path.dirname(t)), exist_ok=True)
        shutil.copy(de, os.path.join(dest, t))
    for m in mods:
        os.makedirs(os.path.join(dest, os.path.dirname(m)), exist_ok=True)
        modelo(os.path.join(os.path.dirname(proj), m), os.path.join(dest, m + '.json'))
    ef['texturas'] = sorted(texs)
    ef['modelos'] = sorted(mods)
    json.dump(ef, open(os.path.join(dest, 'efeito.json'), 'w'), separators=(',', ':'))
    print(nome, os.path.getsize(os.path.join(dest, 'efeito.json')), 'bytes,', len(texs), 'texturas')


if __name__ == '__main__':
    converter(sys.argv[1], sys.argv[2])
