"""Gera uma página HTML única (JS e sprites embutidos) de um teste (tabuleiro
ou outro), para publicar e abrir em qualquer lugar, inclusive no celular.

    npm --prefix frontend run build:teste && python3 frontend/scripts/pagina_unica.py saida.html

Os PNG entram como WebP sem perda (menores). Com `--sem-sprites` não são
embutidos (a página os busca em ./sprites/...) — mas publicados como arquivos
separados as texturas não carregam no artifact (boneco invisível).
"""
import base64, glob, io, json, os, sys
from PIL import Image
raiz = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
opcao = lambda nome, padrao: next((a.split('=', 1)[1] for a in sys.argv if a.startswith(f'--{nome}=')), padrao)
DIST = opcao('dist', 'dist-teste')
TITULO = opcao('titulo', 'Tabuleiro Pirata')
# --incluir=a,b: só os sprites cujo caminho (depois de sprites/) começa com um desses
INCLUIR = [x for x in opcao('incluir', '').split(',') if x]
js = open(glob.glob(os.path.join(raiz, DIST, 'assets', '*.js'))[0], encoding='utf8').read()
js = js.replace('</script', '<\\/script')
emb = {}
sem_sprites = '--sem-sprites' in sys.argv
# --qualidade=N: WebP com perda (N de 1 a 100) — só para caber no limite da página publicada
QUALIDADE = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--qualidade=')), 0)
# --pular=a,b: pastas de sprites que não entram (personagens fora do tabuleiro)
PULAR = next((a.split('=')[1].split(',') for a in sys.argv if a.startswith('--pular=')), [])
for arq in [] if sem_sprites else glob.glob(os.path.join(raiz, 'public', 'sprites', '**', '*.*'), recursive=True):
    dentro_sprites = os.path.relpath(arq, os.path.join(raiz, 'public', 'sprites')).replace(os.sep, '/')
    if arq.endswith('.csv') or dentro_sprites.split('/')[0] in PULAR:
        continue
    if INCLUIR and not any(dentro_sprites.startswith(x) for x in INCLUIR):
        continue
    rel = os.path.relpath(arq, os.path.join(raiz, 'public')).replace(os.sep, '/')
    if arq.endswith('.png'):
        # WebP sem perda: ~30% menor que o PNG (a página cabe no limite de 16 MB)
        b = io.BytesIO()
        if QUALIDADE:
            Image.open(arq).save(b, 'WEBP', quality=QUALIDADE, method=6, alpha_quality=100)
        else:
            Image.open(arq).save(b, 'WEBP', lossless=True, method=6, quality=100)
        emb[rel] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
        continue
    tipo = 'application/json' if arq.endswith('.json') else 'image/webp' if arq.endswith('.webp') else 'application/octet-stream'
    emb[rel] = f'data:{tipo};base64,' + base64.b64encode(open(arq, 'rb').read()).decode()
html = f'''<meta charset="utf-8" />
<title>{TITULO}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap" rel="stylesheet" />
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
