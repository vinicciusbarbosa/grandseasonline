"""
Modelos .glb baixados -> versão leve para o navio (public/modelos/props/<nome>.glb).

    python3 scripts/modelos/props_glb.py <entrada.glb> <nome> [lado=512] [reduzir=0] [poupar=prefixo,...]

O jogo desenha os props com material Lambert (só a cor), então fica só a
textura de cor (baseColor, ou a difusa do KHR_materials_pbrSpecularGlossiness),
reduzida para `lado` px em JPEG; normal, rugosidade e oclusão saem.
`reduzir` (0 a 1) tira essa fração dos triângulos de cada malha (colapso de
arestas, fast-simplification); a UV de cada vértice novo vem de um dos que
ele juntou (a normal também). As malhas cujo nome começa
com um dos prefixos de `poupar` ficam inteiras (a simplificação junta vértices
nas emendas da UV e mancha a textura; no cano do canhão isso aparece).
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def ler(caminho):
    b = open(caminho, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    ini = 20 + n + 8
    bn = struct.unpack('<I', b[20 + n:24 + n])[0]
    return j, b[ini:ini + bn]


def gravar(caminho, j, binario):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    binario += b'\0' * (-len(binario) % 4)
    total = 12 + 8 + len(js) + 8 + len(binario)
    with open(caminho, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(binario), 0x004E4942) + binario)


TIPOS = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
COMPS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def acessar(j, b, k):
    a = j['accessors'][k]
    v = j['bufferViews'][a['bufferView']]
    n = COMPS[a['type']]
    dt = np.dtype(TIPOS[a['componentType']])
    passo = v.get('byteStride', dt.itemsize * n)
    ini = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    bruto = np.frombuffer(b, np.uint8, count=passo * (a['count'] - 1) + dt.itemsize * n, offset=ini)
    linhas = np.lib.stride_tricks.as_strided(bruto, (a['count'], dt.itemsize * n), (passo, 1))
    return np.ascontiguousarray(linhas).view(dt).reshape(a['count'], n)


def reduzir(caminho, fracao, minimo=150, poupar=()):
    """simplifica cada malha do .glb gravado (posição, UV e índices novos; sem normal)"""
    import fast_simplification as fs
    j, b = ler(caminho)
    novo = bytearray()
    vistas, acessores = [], []

    def junta(arr, alvo=None):
        novo.extend(b'\0' * (-len(novo) % 4))
        vistas.append({'buffer': 0, 'byteOffset': len(novo), 'byteLength': arr.nbytes, **({'target': alvo} if alvo else {})})
        novo.extend(arr.tobytes())
        return len(vistas) - 1

    def acessor(arr, tipo, comp, alvo=None, limites=False):
        a = {'bufferView': junta(arr, alvo), 'componentType': comp, 'count': len(arr), 'type': tipo}
        if limites:
            a['min'] = arr.min(0).tolist()
            a['max'] = arr.max(0).tolist()
        acessores.append(a)
        return len(acessores) - 1

    # as imagens primeiro (só copiadas)
    for im in j.get('images', []):
        v = j['bufferViews'][im['bufferView']]
        o = v.get('byteOffset', 0)
        im['bufferView'] = junta(np.frombuffer(b[o:o + v['byteLength']], np.uint8))
    antes = depois = 0
    for m in j['meshes']:
        for pr in m['primitives']:
            pos = acessar(j, b, pr['attributes']['POSITION']).astype(np.float32)
            uv = acessar(j, b, pr['attributes']['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in pr['attributes'] else None
            nor = acessar(j, b, pr['attributes']['NORMAL']).astype(np.float32) if 'NORMAL' in pr['attributes'] else None
            idx = acessar(j, b, pr['indices']).reshape(-1, 3).astype(np.int64)
            antes += len(idx)
            if len(idx) > minimo and fracao > 0 and not m.get('name', '').startswith(tuple(poupar)):
                _, _, colapsos = fs.simplify(pos, idx, target_reduction=fracao, return_collapses=True)
                pos2, idx2, mapa = fs.replay_simplification(pos, idx, colapsos)
                if uv is not None:
                    uv2 = np.zeros((len(pos2), 2), np.float32)
                    uv2[mapa] = uv
                    uv = uv2
                if nor is not None:
                    n2 = np.zeros((len(pos2), 3), np.float32)
                    n2[mapa] = nor
                    nor = n2 / np.maximum(np.linalg.norm(n2, axis=1, keepdims=True), 1e-6)
                pos, idx = pos2.astype(np.float32), idx2
            depois += len(idx)
            atr = {'POSITION': acessor(pos, 'VEC3', 5126, 34962, True)}
            if nor is not None:
                atr['NORMAL'] = acessor(nor, 'VEC3', 5126, 34962)
            if uv is not None:
                atr['TEXCOORD_0'] = acessor(uv, 'VEC2', 5126, 34962)
            pr['attributes'] = atr
            pr['indices'] = acessor(idx.astype(np.uint32).reshape(-1), 'SCALAR', 5125, 34963)
    j['bufferViews'], j['accessors'] = vistas, acessores
    j['buffers'] = [{'byteLength': len(novo)}]
    gravar(caminho, j, bytes(novo))
    print(' reduzido', antes, '->', depois, 'triângulos', os.path.getsize(caminho) // 1024, 'KB')


def main(entrada, nome, lado=512, fracao=0.0, poupar=()):
    j, b = ler(entrada)
    # textura de cor de cada material
    cores = []
    for m in j.get('materials', []):
        sg = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness')
        tex = (m.get('pbrMetallicRoughness') or {}).get('baseColorTexture') or (sg or {}).get('diffuseTexture')
        cores.append(tex['index'] if tex else None)
    usadas = sorted({t for t in cores if t is not None})
    imgs = sorted({j['textures'][t]['source'] for t in usadas})
    # binário novo: as vistas que não são imagem, mais as imagens de cor em JPEG
    vistas_img = {im['bufferView'] for im in j.get('images', [])}
    novo, mapa, vistas = bytearray(), {}, []

    def junta(dados, base):
        novo.extend(b'\0' * (-len(novo) % 4))
        v = dict(base, byteOffset=len(novo), byteLength=len(dados))
        novo.extend(dados)
        vistas.append(v)
        return len(vistas) - 1

    for i, v in enumerate(j['bufferViews']):
        if i in vistas_img:
            continue
        o = v.get('byteOffset', 0)
        mapa[i] = junta(b[o:o + v['byteLength']], {k: x for k, x in v.items() if k not in ('byteOffset', 'byteLength')})
    images = []
    for k in imgs:
        im = j['images'][k]
        v = j['bufferViews'][im['bufferView']]
        o = v.get('byteOffset', 0)
        I = Image.open(io.BytesIO(b[o:o + v['byteLength']])).convert('RGB')
        I = I.resize((min(lado, I.width), min(lado, I.height)), Image.LANCZOS)
        s = io.BytesIO()
        I.save(s, 'JPEG', quality=88)
        images.append({'bufferView': junta(s.getvalue(), {'buffer': 0}), 'mimeType': 'image/jpeg'})
    for a in j.get('accessors', []):
        if 'bufferView' in a:
            a['bufferView'] = mapa[a['bufferView']]
    textures = [{'source': imgs.index(j['textures'][t]['source'])} for t in usadas]
    for m, t in zip(j.get('materials', []), cores):
        for k in ('extensions', 'normalTexture', 'occlusionTexture', 'emissiveTexture'):
            m.pop(k, None)
        pbr = {'metallicFactor': 0.0, 'roughnessFactor': 1.0}
        if t is not None:
            pbr['baseColorTexture'] = {'index': usadas.index(t)}
        m['pbrMetallicRoughness'] = pbr
    j['bufferViews'] = vistas
    j['buffers'] = [{'byteLength': len(novo)}]
    j['images'], j['textures'] = images, textures
    j.pop('samplers', None)
    for k in ('extensionsUsed', 'extensionsRequired'):
        if k in j:
            j[k] = [e for e in j[k] if e != 'KHR_materials_pbrSpecularGlossiness'] or None
            if j[k] is None:
                del j[k]
    saida = os.path.join(RAIZ, 'public', 'modelos', 'props', f'{nome}.glb')
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    gravar(saida, j, bytes(novo))
    print(nome, os.path.getsize(saida) // 1024, 'KB')
    if fracao > 0:
        reduzir(saida, fracao, poupar=poupar)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 512, float(sys.argv[4]) if len(sys.argv) > 4 else 0.0,
         tuple(sys.argv[5].split(',')) if len(sys.argv) > 5 else ())
