# Boneco base para o DragonBones

Manequim careca e sem rosto, só para o rig. Anima-se uma vez em cima dele e
depois troca-se roupa, cabelo e rosto sem mexer na animação.

## Arquivos

- `base_ske.json` + `base_tex.json` + `base_tex.png`: projeto pronto
  (DragonBones 5.5) com dois esqueletos, `base_frente` (3/4 de frente) e
  `base_costas` (3/4 de costas). No DragonBones Pro: **File → Import** e
  escolha `base_ske.json`.
- `pecas/frente`, `pecas/costas`: as peças soltas (PNG transparente). Use de
  molde para desenhar roupa e cabelo.
- `fonte/`: as folhas originais (fundo magenta). Para refazer tudo:
  `python3 scripts/sprites/boneco_db.py` (dentro de `frontend/`).

## Ossos

`quadril` → `tronco` → `pescoco` → `cabeca` (→ `cabelo`); `tronco` → `capa`;
`tronco` → `braco_*` → `antebraco_*` → `mao_*`;
`quadril` → `coxa_*` → `canela_*` → `pe_*`.
`_perto` é o lado claro (mais perto da câmera), `_longe` o escuro.
`cabelo` e `capa` não têm peça: servem para cabelo comprido e capa balançarem.

## Slots vazios (para trocar depois)

Cada parte do corpo tem slots vazios logo acima dela na ordem de desenho:

| Parte | Slots vazios |
|---|---|
| cabeça | `olhos`, `boca`, `cabelo_frente`, `chapeu` (e `cabelo_tras` atrás de tudo) |
| tronco | `roupa_tronco`, `casaco` (e `capa_tras` atrás de tudo) |
| quadril | `roupa_quadril`, `cinto` |
| braço / antebraço / mão | `manga_*`, `manga_baixo_*`, `luva_*` (e `arma_*` atrás da mão) |
| coxa / canela / pé | `calca_*`, `calca_baixo_*`, `bota_*` |

Para vestir: desenhe a roupa **por cima da peça de `pecas/`, no mesmo tamanho
de imagem e na mesma posição**. Depois arraste a imagem para o slot no
DragonBones; com o mesmo tamanho ela já cai no lugar certo e segue o osso.

## Animações

Já existem vazias, com os nomes que o jogo entende: `parado`, `andar`,
`correr`, `atacar`, `dano`, `morrer`. Skills: use o nome da skill
(`corte-duplo`, …). No quadro em que o golpe acerta, ponha um **evento**
chamado `impacto`.

Evite mesh nas peças que vão ser trocadas (a peça nova precisaria ter
exatamente o mesmo tamanho).

## Exportar

**File → Export → Data Version 5.5, JSON + Texture Atlas**, e coloque os 3
arquivos de volta nesta pasta.
