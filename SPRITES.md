# Personagens em pixel art (estilo Ragnarok) — especificação

Guia para produzir os sprites dos personagens do combate em tabuleiro. Vale
para quem desenha (à mão, no Aseprite/LibreSprite, ou com IA como o PixelLab)
e para as conversas do Claude que ajudam na arte.

> Substitui o antigo `BLENDER.md` (o caminho 3D foi abandonado).

## Estilo

Pixel art detalhada em 3/4, como Ragnarok Online e as referências do dono do
projeto (capitão da Marinha de casaca branca, pirata de casaca vermelha,
golpes com energia vermelha/preta). Personagem visto levemente de cima (20–30°),
rosto e olhos bem legíveis, contorno escuro, sombra em 2–3 tons por cor.

Tema: **piratas e Marinha**, inspirado em One Piece, com personagens originais.

## A câmera do tabuleiro (já ajustada no jogo)

- Isométrica com perspectiva suave; o tabuleiro 10×20 cabe numa tela 1920×1080.
- Em pixels da arte, uma casa mede **~108 × 81 px** (levemente inclinada pelo
  giro da câmera). O personagem de 176 px cabe numa casa.
- Com o tabuleiro inteiro na tela, a imagem é reduzida (~0,6×); no zoom máximo
  cada pixel da arte vira 2,5 pixels da tela. A arte é sempre guardada na
  resolução nativa — nada é reduzido no arquivo.

## Tamanho e quadro

| item | valor |
|---|---|
| altura do personagem | **176 px** de arte (do pé ao topo do chapéu); no modo HD a arte é guardada com o dobro (352 px, sem forçar a grade de pixels) |
| quadro padrão | **224 × 224 px** (HD: 448 × 448) |
| ponto do pé (âncora) | **x = 112, y = 200** (HD: 224, 400) — meio entre os pés, no chão |
| quadro de ataque/especial | **320 × 320 px**, âncora **x = 160, y = 288** |
| largura do corpo | cabe nos ~108 px da casa; capa, arma e golpes podem passar |

Moldes prontos (casa, âncora e a linha dos 96 px) em `docs/sprites/`:
`molde_224.png` e `molde_320.png`.
Use o molde como camada de fundo no editor e apague antes de exportar.

## Direções

Desenha-se **5 direções**; as outras 3 o jogo espelha:

| código | direção | desenhar? |
|---|---|---|
| `S` | de frente | sim |
| `SE` | diagonal, frente-direita | sim |
| `E` | de lado, olhando para a direita | sim |
| `NE` | diagonal, costas-direita | sim |
| `N` | de costas | sim |
| `SW`, `W`, `NW` | — | não (espelho de SE, E, NE) |

## Camadas (customização)

Cada personagem é montado em tempo real empilhando camadas desenhadas
separadas, todas no **mesmo quadro e com a mesma âncora**:

| camada | anima? | observação |
|---|---|---|
| `corpo` | sim | corpo **com a roupa** (como no Ragnarok: a roupa é o "corpo"); tom de pele por paleta |
| `cabeca` | não (5 poses) | formato da cabeça, orelhas |
| `rosto` | não (S, SE, E) | olhos, sobrancelhas, nariz, boca — trocáveis; expressões opcionais |
| `cabelo` | não (5 poses) | pode ter `cabelo_tras` (atrás do corpo) e `cabelo` (na frente) |
| `chapeu` | não (5 poses) | e outros acessórios de cabeça |
| `arma` | sim | mesmos quadros do corpo em cada ação |
| `capa` | sim | `capa_tras`/`capa_frente` conforme a direção |

Cabeça, rosto, cabelo e chapéu **não animam**: o jogo "gruda" a cabeça no
ponto de encaixe de cada quadro do corpo. Por isso um cabelo ou chapéu novo é
só **5 desenhos**.

### Pontos de encaixe

Para cada quadro do `corpo`, exportar junto um PNG de mesmo tamanho
`<arquivo>_ancoras.png`, transparente, com **1 pixel** de cada cor:

- vermelho puro `#FF0000`: base do pescoço (onde a cabeça encaixa);
- azul puro `#0000FF`: palma da mão da arma.

### Cores trocáveis (paleta)

Cabelo, pele e as cores principais da roupa são pintados com **rampas
reservadas** e o jogo troca a paleta (cabelo preto/loiro/ruivo com o mesmo
desenho):

- cabelo: 5 tons de cinza `#1E1E1E #4A4A4A #7A7A7A #AAAAAA #DADADA`;
- pele: 4 tons de referência `#6E3A28 #B8704E #E3A27A #F6CBA8`;
- roupa (cor principal trocável): 5 tons de verde puro
  `#0C3A0C #1E6A1E #2E9A2E #50C850 #9CF09C`.

Demais cores (dourado, botões, couro, metal) ficam como são.

## Folhas geradas por IA (qualidade da referência)

Uma animação de 12 quadros numa imagem só, com o boneco no tamanho da
referência:

- folha de **2048 × 3072 px**, **4 colunas × 3 linhas**;
- células de **512 × 1024 px**, lidas da esquerda para a direita, de cima
  para baixo;
- boneco com **~700 px de altura** (cada pixel da arte = bloco de 4×4),
  igual à referência;
- fundo magenta `#FF00FF`, espaço vazio entre os quadros.

O importador acha os quadros sozinho (aceita também várias imagens separadas
por vírgula):

```
python3 frontend/scripts/sprites/importar_folha.py animacao \
  andar_S.png almirante andar S
```

## Animações

| nome | quadros | fps | laço | notas |
|---|---|---|---|---|
| `parado` | 4 | 6 | sim | guarda, respiração, capa ao vento |
| `andar` | 8 | 12 | sim | usado para andar 1 casa |
| `correr` | 8 | 14 | sim | 2+ casas; corpo inclinado, braços bombeando |
| `frear` | 4 | 12 | não | pé arrasta, tranco do corpo; o jogo põe a poeira |
| `atacar` | 8–10 | 14 | não | prepara, corta, acompanha; marcar o quadro do impacto |
| `dano` | 3 | 12 | não | recua |
| `derrota` | 5 | 10 | não | cai |

Efeitos (cortes, energia, explosão, poeira) são **folhas separadas** e maiores,
reaproveitadas por todos; não desenhe no corpo.

## Arquivos

```
frontend/public/sprites/
  corpo/<peca>/<anim>_<DIR>.png          # tira horizontal: quadros lado a lado
  corpo/<peca>/<anim>_<DIR>_ancoras.png
  cabeca/<peca>/<DIR>.png
  rosto/<peca>/<DIR>.png
  cabelo/<peca>/<DIR>.png   (e cabelo_tras/)
  chapeu/<peca>/<DIR>.png
  arma/<peca>/<anim>_<DIR>.png
  capa/<peca>/<anim>_<DIR>.png
  efeitos/<nome>.png
```

Nomes sem acento e sem espaço, ex.: `corpo/marinha_capitao/andar_SE.png`.
PNG com transparência, sem suavização (nada de pixels semitransparentes nas
bordas).

## Por onde começar

1. Um `corpo` (capitão da Marinha), uma `cabeca`, um `rosto`, um `cabelo`, o
   `chapeu` quepe e a `arma` sabre.
2. Só `parado`, `andar` e `atacar`, nas 5 direções.
3. Mandar para o jogo e testar no tabuleiro antes de produzir o resto.

## Divisão de trabalho

- **Arte** (dono do projeto, com IA de imagem/PixelLab e limpeza no editor):
  desenhos, animações, paletas, exportação nos nomes acima.
- **Código** (conversa do Claude na nuvem): motor de camadas e encaixes, troca
  de paleta, provador, animações no tabuleiro, efeitos, importação/validação
  das folhas. Não mexer em `frontend/src` pela conversa de arte: anote pedidos
  aqui e repasse.
- Branch única: `claude/ola-wafo5q`; `git pull` antes de começar e de enviar.
