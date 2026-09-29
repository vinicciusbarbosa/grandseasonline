"""Gera uma página HTML única (JS e sprites embutidos) do teste de tabuleiro,
para publicar e abrir em qualquer lugar, inclusive no celular.

    npm --prefix frontend run build:teste && python3 frontend/scripts/pagina_unica.py saida.html

Com `--sem-sprites` os sprites não são embutidos (a página os busca em
./sprites/..., publicados como arquivos ao lado dela — acima de ~12 MB de
sprites a página única passaria do limite).
"""
import base64, glob, json, os, sys
raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
js = open(glob.glob(os.path.join(raiz, 'dist-teste', 'assets', '*.js'))[0], encoding='utf8').read()
js = js.replace('</script', '<\\/script')
emb = {}
sem_sprites = '--sem-sprites' in sys.argv
for arq in [] if sem_sprites else glob.glob(os.path.join(raiz, 'public', 'sprites', '**', '*.*'), recursive=True):
    rel = os.path.relpath(arq, os.path.join(raiz, 'public')).replace(os.sep, '/')
    tipo = 'application/json' if arq.endswith('.json') else 'image/png'
    emb[rel] = f'data:{tipo};base64,' + base64.b64encode(open(arq, 'rb').read()).decode()
html = f'''<title>Tabuleiro Pirata</title>
<style>
  :root {{ color-scheme: dark; }}
  html, body {{ height: 100%; }}
  body {{ margin: 0; background: #0b2a66; color: #f3e3c3; overflow: hidden; }}
  #raiz {{ position: fixed; inset: 0; }}
</style>
<div id="raiz"></div>
<script>window.__embutidos = {json.dumps(emb)};</script>
<script type="module">
{js}
</script>
'''
open(sys.argv[1], 'w', encoding='utf8').write(html)
print(f'{sys.argv[1]}: {len(html)/1024:.0f} KB, {len(emb)} arquivos embutidos')
