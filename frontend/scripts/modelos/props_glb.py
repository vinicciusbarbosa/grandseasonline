"""
Modelos .glb baixados -> versão leve para o navio (public/modelos/props/<nome>.glb).

    python3 scripts/modelos/props_glb.py <entrada.glb> <nome> [lado=512]

O jogo desenha os props com material Lambert (só a cor), então fica só a
textura de cor (baseColor, ou a difusa do KHR_materials_pbrSpecularGlossiness),
reduzida para `lado` px em JPEG; normal, rugosidade e oclusão saem.
"""
import io, json, os, struct, sys
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


def main(entrada, nome, lado=512):
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


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 512)
