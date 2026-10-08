"""
Corpo de Chamas: o fogo que envolve o alvo no Hidaruma (Ace_Hidaruma_Detonacao,
nó "Centro do alvo em chamas", só os emissores "Fogo envolvendo o corpo"),
gerando sem parar. O jogo toca nos pés do personagem e encerra no fim da skill.

    python3 scripts/efeitos/efk_converter.py public/efeitos/effekseer/Ace-Hotarubi-Hidaruma/Ace_Hidaruma_Detonacao.efkproj hidaruma-fogo
    python3 scripts/efeitos/em_chamas.py

Grava public/sprites/efk/em-chamas/ (e apaga a conversão temporária hidaruma-fogo).
"""
import json, os, shutil

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EFK = os.path.join(RAIZ, 'public', 'sprites', 'efk')

fonte = os.path.join(EFK, 'hidaruma-fogo')
d = json.load(open(os.path.join(fonte, 'efeito.json')))
centro = next(c for c in d['filhos'][0]['filhos'] if c['nome'].startswith('Centro'))
fogo = [f for f in centro['filhos'] if f['nome'].startswith('Fogo envolvendo')]
for f in fogo:
    f['max'] = 10 ** 9  # gera até o jogo encerrar
corpo = dict(centro, nome='Corpo em chamas', eterno=True, vida=[10 ** 9, 10 ** 9], filhos=fogo)
saida = os.path.join(EFK, 'em-chamas')
os.makedirs(os.path.join(saida, 'Texture'), exist_ok=True)
texs = sorted({f['render']['tex'] for f in fogo})
json.dump({'fim': 0, 'filhos': [corpo], 'texturas': texs}, open(os.path.join(saida, 'efeito.json'), 'w'), separators=(',', ':'))
for t in texs:
    shutil.copy(os.path.join(fonte, t), os.path.join(saida, t))
shutil.rmtree(fonte)
print('em-chamas', len(fogo), 'emissores', texs)
