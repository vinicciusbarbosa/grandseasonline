# Personagens em 3D (Blender) — guia do projeto

Leia isto antes de mexer no Blender pelo MCP. Resume o que já foi decidido
para os personagens do combate em tabuleiro (Sugoigame / Grand Seas Online).

## Como o trabalho está dividido (duas conversas)

O projeto é tocado por **duas conversas do Claude ao mesmo tempo**:

- **Conversa local (esta, com o Blender MCP):** cuida só dos personagens no
  Blender — modelos, materiais cel-shading, esqueleto, animações e exportação
  dos `.glb` para `frontend/public/personagens/`.
- **Conversa na nuvem (Claude Code on the web):** cuida do código do jogo —
  tabuleiro, carregador dos modelos, sombreamento no jogo, efeitos, combate —
  e dá apoio quando algo não der para resolver no Blender.

Regras para as duas não se atrapalharem:

1. **Branch única:** `claude/ola-wafo5q`. Faça `git pull` antes de começar e
   antes de cada push.
2. **Cada uma no seu pedaço:** a conversa local mexe em arquivos do Blender,
   nos `.glb` (e texturas) em `frontend/public/personagens/` e neste
   `BLENDER.md`. **Não altere código em `frontend/src`**: se precisar de algo
   no jogo, anote na seção "Pedidos para o jogo" abaixo e avise o dono do
   projeto, que repassa para a conversa da nuvem.
3. **Commits claros**, ex.: `Personagem: capitão vermelho v1 (.glb)`.
4. Arquivos `.blend` de trabalho ficam **fora do git** (são grandes); só vai o
   `.glb` exportado. Se quiser guardar o `.blend`, use uma pasta fora do
   projeto ou peça para configurar o Git LFS.

### Pedidos para o jogo

_(a conversa local anota aqui o que precisa no código — ex.: "o carregador
precisa ler o osso `weapon`", "capa usa ossos `cape_*` para simular mola")_

1. **Esconder região do corpo por baixo da roupa.** O corpo vem em quatro
   malhas (`corpo__tronco`, `corpo__bracos`, `corpo__pernas`, `corpo__pes`).
   Sugestão de regra: `camisa`/`casaca` escondem `corpo__tronco` (a casaca
   também `corpo__bracos`, se tiver manga), `calca` esconde `corpo__pernas`,
   `botas` esconde `corpo__pes`. A tabela exata vai junto com as primeiras
   roupas.
2. **Nomes dos ossos** são os do esqueleto acima (`arma`, `capa_1..3`,
   `cabelo_1..3`, `dedos_D/E`) — não `weapon`/`cape_*`.

### Registro de entregas

_(a conversa local anota aqui cada `.glb` enviado: nome, o que tem, o que
falta)_

## Estilo alvo

3D com cel-shading imitando ilustração 2D, como **Guilty Gear Xrd/Strive**,
**Dragon Ball FighterZ** e **2XKO** (Riot). Referências passadas pelo dono do
projeto: arte do Darius no estilo 2XKO e animações do portfólio de Remy Hobo
(personagem de cabelo verde com espada curva).

Tema do jogo: **piratas** (inspirado em One Piece, mas com personagens
originais — nada de Luffy/Zoro etc. por direitos autorais).

Características que precisam aparecer:

- **Sombra em blocos duros** (1 ou 2 tons), nada de degradê realista.
- **Contorno** fino por "casca invertida" + **linhas internas pintadas** na
  textura (dobras de roupa, músculos).
- **Rosto limpo:** normais do rosto transferidas de uma esfera/forma simples
  (Data Transfer) para a sombra cair como desenho.
- **Sombra controlada à mão:** cor de vértice ou textura de limiar dizendo onde
  a sombra aparece mais/menos.
- **Cores chapadas**, paleta forte; brilhos (especular) desenhados, não físicos.
- **Proporção heroica:** ombros largos, mãos e pés um pouco grandes, poses
  exageradas.
- **Animação pose a pose "em 2s e 3s"**: cada pose segura 2–3 quadros (a 30
  fps), com antecipação, impacto e deformações exageradas nos golpes.

Referência técnica: palestra da GDC *"GuiltyGearXrd's Art Style: The X Factor
Between 2D and 3D"* (Junya Motomura).

## Como os personagens são montados (peças trocáveis)

O jogo vai deixar trocar cabelo, roupas e corpo. Então cada personagem é:

- **Um esqueleto (Armature) único e padrão** para todos os personagens, objeto
  `esqueleto`, com os mesmos nomes de ossos. É próprio (nem Rigify nem Mixamo),
  mas com estrutura de humanoide comum, para dar de converter uma animação do
  Mixamo por tabela de nomes se um dia precisar. Nomes sem acento e sem espaço;
  lado pelo sufixo `_E` (esquerda, -X) / `_D` (direita, +X). 31 ossos, pose A
  (braços a 35°), 1,8 m, olhando para +Y:

  ```
  raiz (não deforma)
  └ quadril → coluna → peito → pescoco → cabeca → cabelo_1 → cabelo_2 → cabelo_3
              peito → ombro_X → braco_X → antebraco_X → mao_X → dedos_X
                                                         mao_D → arma
              peito → capa_1 → capa_2 → capa_3
    quadril → coxa_X → canela_X → pe_X → dedos_pe_X
  ```

  `dedos_X` é um osso só (abre/fecha a mão: segurar a arma, punho). `arma`
  deforma e a malha da arma vai 100% nele. O `.blend` base fica em
  `C:\projsdev\sugoigame-blender\base.blend` (fora do git).
- **Corpo dividido por regiões**, para o jogo esconder a pele que fica por baixo
  da roupa (e ela não atravessar o tecido): `corpo__tronco`, `corpo__bracos`,
  `corpo__pernas`, `corpo__pes`, mais `cabeca__<peca>`.
- **Malhas separadas por encaixe**, todas com skin no mesmo esqueleto:
  `cabeca`, `cabelo`, `barba`, `chapeu`, `camisa`, `casaca`, `capa`,
  `cintura`, `calca`, `botas`, `arma`.
- Nome de cada malha: `<encaixe>__<peca>`, ex.: `chapeu__tricornio_negro`,
  `casaca__longa_negra`, `cabelo__longo_castanho`.
- A arma vai presa num osso próprio da mão direita (`arma`/`weapon`).
- Capa, abas de casaca e cabelo comprido: ossos extras em corrente para
  balançar (o jogo pode simular por mola).

## Animações necessárias

Todas no mesmo esqueleto, nomes exatos (o jogo procura por eles):

| nome      | laço | notas |
|-----------|------|-------|
| `parado`  | sim  | guarda com a arma, respiração, capa ao vento |
| `andar`   | sim  | um ciclo = uma casa do tabuleiro |
| `correr`  | sim  | corpo inclinado, braço livre bombeando, arma arrastando atrás |
| `frear`   | não  | pé da frente arrasta, tranco do corpo para a frente, se acomoda |
| `atacar`  | não  | prepara (gira, arma lá atrás), corta, acompanha, volta |
| `dano`    | não  | recua e volta |

O personagem anima **no lugar** (sem sair da origem; o jogo move ele de casa
em casa), **de frente para a vista Frontal do Blender (Numpad 1)**, ou seja,
olhando para **−Y do Blender** — exportando com "+Y Up", isso vira a frente
(+Z) no jogo.

### Esqueleto

- Próprio e simples, estrutura de humanoide comum: `quadril → coluna → peito
  → pescoco → cabeca`; `ombro → braco → antebraco → mao (+ dedos)`;
  `coxa → canela → pe → dedos_pe`. Nomes **sem acento nem espaço**.
- Lados com sufixo **`_L` / `_R`** (o Blender só espelha — Symmetrize, colar
  pose espelhada — com L/R). O jogo aceita qualquer sufixo.
- Pose de descanso em **A** simétrica (braços ~45°, cotovelos e joelhos
  levemente dobrados), pés no chão, origem entre os pés.
- Ossos extras: `arma` (filho de `mao_R`, na palma, onde segura o cabo);
  `cabelo_1..3` (filho de `cabeca`, saindo da nuca/onde está o cabelo);
  `capa_1..3` (filho de `peito`, saindo dos ombros/costas); `dedos_L/R` para
  abrir/fechar a mão.
- Rosto: olhos, sobrancelhas e boca **não** são malhas separadas — ficam numa
  área reservada da textura do rosto; o jogo troca os desenhos (customização
  e expressões).
- Corpo dividido em regiões (tronco, braços, pernas, pés) para o jogo esconder
  o que fica debaixo da roupa.

## Exportação para o jogo

- Formato: **glTF binário (`.glb`)**, *Include → Selected/Visible*,
  *Mesh → Apply Modifiers* (menos o contorno, que o jogo refaz), *Animation →
  Export Deformation Bones Only*, sem compressão Draco por enquanto.
- Escala: 1 unidade = 1 metro; personagem com ~1,8 m.
- Onde salvar: `frontend/public/personagens/<nome>.glb` e fazer commit/push.
- Texturas: cores base por peça (PNG até 1024), linhas internas pintadas nela.

No jogo, o carregador refaz o cel-shading (sombra em blocos, contorno, brilho
de borda) e toca as animações segurando quadros como no Blender.

## Onde o jogo está

- Combate em tabuleiro: `frontend/src/tabuleiro/` (tela `/teste-tabuleiro`).
- Decisões de gameplay: `DESIGN.md`.
- Tabuleiro 10×20: dois conveses de 5×20, um navio de cada lado.
