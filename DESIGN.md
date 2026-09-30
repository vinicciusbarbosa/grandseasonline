# Design do jogo — decisões e ideias

Onde fica registrado o que já foi decidido para a gameplay e as ideias que
ainda vão entrar. O técnico (como está implementado) fica em `MIGRACAO.md`.

Status: **decidido** (vamos fazer assim) · **agora** (próximas entregas) ·
**depois** (entra mais tarde) · **em aberto** (ainda discutindo).

---

## Decidido

### Combate de tripulação (PvP e abordagem)
Base: o tabuleiro por turnos do Sugoi, com três camadas por cima.

1. **Turnos simultâneos** (como Pokémon e Frozen Synapse): os dois jogadores
   planejam ao mesmo tempo — mover, atacar, postura — e o servidor resolve
   tudo junto, na ordem da iniciativa (AGL). Ninguém fica esperando o outro.
   Golpes em área são telegrafados: esquivar deles é se mover no tabuleiro.
2. **Postura secreta** (como Yomi): no fim do turno cada um escolhe, escondido,
   como reage ao próximo golpe — bloquear, esquivar, aparar (parry) ou
   contra-atacar. O atacante escolhe o tipo de golpe (comum, pesado, finta,
   área). Leitura, não reflexo: justo com qualquer ping e impossível de
   trapacear (o servidor só revela quando as duas escolhas chegam).
   Os atributos do legado pesam: AGL → esquiva, RES → bloqueio, DEX → parry.
3. **Vontade como moeda das reações**: aparar e contra-atacar custam vontade
   (a mesma que já sobe a cada rodada e aumenta o dano das habilidades).
   Sem parry infinito; gastar agora ou guardar para a habilidade forte.
4. **Timing só como bônus** (opcional): acertar o tempo na animação dá um
   extra pequeno ("perfeito"), nunca decide a luta.

Autoridade: tudo resolvido no servidor C# (escolhas escondidas até a revelação).

### Combate naval
De costado, sem trocar de modo: baterias de bombordo/boreste (Q/E), arco e
alcance, recarga, acerto pior com distância/velocidade/tempestade, casco e
velas. Abordagem quando o inimigo está avariado, perto e devagar.

### Mundo e navegação
**Escala.** Ilhas bem maiores que o navio (~10×, 2–3× o tamanho de hoje),
com casas, árvores e marcos na proporção certa em relação ao navio (casa ≈
1/3 do navio), na ilha inteira. Costa e porto bem detalhados; o interior na
mesma escala, com menos coisa (morros, floresta, estradas e os marcos). Ao
atracar, a cidade abre em outra tela, em escala real.
Técnica: a ilha é gerada em blocos (só o que aparece na tela) e com nível de
detalhe pela distância; uma imagem única por ilha não cabe na memória.

**Fidelidade ao anime.** Cada ilha mantém o contorno, os marcos e o clima do
anime (Shells Town com a base e o muro circular, Foosha com o moinho e o bar
da Makino, Orange Town com o circo do Buggy, Baratie, Arlong Park com a casa
da Nami, Loguetown com o cadafalso). Com a escala maior, cabem os detalhes
que hoje ficaram de fora. Rever cada ilha contra cenas do anime antes.

**Mapa.** O mar cresce bastante: viagens longas fazem parte do jogo. As
ilhas mantêm as posições do mapa oficial de One Piece (mesma direção e
proporção entre elas, distâncias maiores). Meta inicial: 3–8 min entre ilhas
vizinhas sem eventos; ajustar testando.

**Mar com conteúdo.** Navios NPC (Marinha, piratas, mercantes) em rotas,
encontros aleatórios, Reis do Mar (mais comuns longe das rotas seguras),
baús flutuantes e destroços com recompensa, clima (tempestade, neblina,
redemoinho). Algo à vista ou perto a cada 30–60 s de navegação — mar grande
sem conteúdo cansa.

**Exploração.** O mapa começa escondido (névoa); só a região inicial aparece.
Ilhas só entram no mapa depois de avistadas. Cartas náuticas (lojas, baús) e
NPCs revelam pedaços. Viagem rápida entre ilhas visitadas: opcional, depois.

**Tripulação e orientação.**
- **Sem cartógrafo:** sem minimapa, navega às cegas; no mapa-múndi só as ilhas
  visitadas (sem contorno da costa nem rotas).
- **Com cartógrafo:** minimapa, e o mapa vai sendo desenhado por onde o navio
  passa (a névoa some e fica registrada).
- **Navegador:** prevê o clima (tempestade, redemoinho) antes de acontecer e
  deixa o navio mais rápido/estável. Sem ele, o clima pega de surpresa.
- **East Blue:** bússola comum funciona (só aponta o norte). Log Pose não é
  necessário, como no anime.
- **Grand Line** (depois da Reverse Mountain): a bússola gira sem direção.
  **Log Pose** grava o magnetismo da ilha: depois de um tempo mínimo nela
  (cada ilha com o seu), trava apontando para a próxima; sair antes = sem
  direção. Ilhas com mais de uma rota apontam conforme a ilha de origem (as
  7 rotas da entrada). **Eternal Pose**: item raro (baú, missão) que aponta
  sempre para uma ilha.

---

## Agora
- Protótipo das posturas + vontade na abordagem (contra a IA), depois no PvP.
- **Batalha completa prototipada** (decidido para o protótipo): **5 contra 5**
  (capitão, espadachim, atirador, médico, lutador × comandante, oficial,
  soldado, arqueiro, enfermeira), **turnos simultâneos + postura secreta**
  (como acima), **contra a IA e também em multiplayer para testes** (dois
  jogadores pelo servidor de teste `/mp`: cada um manda o plano do turno,
  o servidor resolve e devolve o resultado para os dois).
- **Batalha — decisões (conversa de 30/09)**:
  turnos **simultâneos com postura secreta** (mantido); tripulação de **2 a
  10** conforme o nível do capitão (tabela do `docs/projeto/OP_PROJECT.md`);
  **movimento da tripulação inteira** (pontos de movimento do lado, como no
  Sugoi); só algumas **profissões** dão efeito na batalha (médico, cozinheiro
  e outras a definir). **Todos os tripulantes lutam** (sem reservas, como no
  Sugoi — até 10 cabem na metade 5×20). Cada tripulante tem a **árvore de
  habilidades completa**; as ações do turno são da tripulação (como no Sugoi).
  **Habilidades das armas**: cada **tipo** de arma dá as mesmas habilidades
  (toda katana dá as skills A, B e C); raridade maior = mais dano; **Lendária**
  e **Relíquia** dão habilidades a mais. Relíquias são as armas que existem em
  One Piece (Wado Ichimonji, Yoru...), com habilidades únicas (não são únicas
  no servidor, por enquanto). A skill extra da Lendária é sorteada entre
  algumas opções. **Não dá para trocar de arma na batalha.**
  **Árvore de habilidades** (estilo Path of Exile): uma árvore **por classe**
  (espadachim, combatente, atirador, cientista), com vários caminhos/builds
  dentro dela — só passivas, buffs, slots de gemas e nós notáveis que
  modificam as skills da arma (a árvore não dá skills). Akuma no Mi tem
  árvore própria.
  **Itens com afixos aleatórios (prefixos/sufixos, como no Path of Exile 2)**,
  em vez dos itens predefinidos do Sugoi. Relíquias também têm afixos
  aleatórios; só a skill única delas é fixa. Afixos por raridade:
  Comum 0 · Incomum 1 · Raro 2–3 · Épico 3–4 · Lendário 4 + skill extra
  sorteada · Relíquia até 4 + 2 buffs especiais aleatórios + skill única
  fixa embutida. (A confirmar: lista inicial de afixos e buffs especiais,
  destino para itens sobrando — vender, desmontar para o Ferreiro.)
  Em aberto: atributos (base do Sugoi, modificada?) e
  árvore de habilidades (estilo Path of Exile?).
- **Batalha — turno e Haki (conversa de 30/09, segunda parte)**:
  - Turno **alternado** (mudou: o simultâneo não combina com o tabuleiro —
    o movimento de um estragaria o plano do outro). Quem começa depende da
    **agilidade**; um lado age enquanto o outro assiste, e a vez passa na
    hora. Postura secreta fica para depois. **Como no Sugoi: UM ataque por
    vez da tripulação** — usar uma skill (ou o Haki do Rei em área) encerra
    a vez (mudou: várias ações por vez deixavam um personagem atacar 5
    vezes, muito roubado). Skills com **recarga** (vezes da tripulação sem
    poder usar de novo); o golpe básico da arma não tem recarga.
  - **Movimento igual ao Sugoi**: 5 movimentos por vez para a tripulação
    toda (1 casa cada, em 8 direções), antes do ataque.
  - **Haki de armamento**: o jogador liga nos ataques; usos por batalha
    limitados pela **maestria** (ex.: maestria 100 → 10 usos, 50 → 5).
    **Armamento avançado**: fura % da defesa, dá bônus de dano e (quando a
    postura existir) fura a postura/bloqueio.
  - **Haki do Rei imbuído** no ataque: precisa ter Haki do Rei **e** o
    armamento avançado; também pode ser lançado em área. Só depois que o
    personagem acumula **espírito** suficiente.
  - **Choque de Haki do Rei (clash)**: quem ataca com o Rei imbuído um
    alvo que também tem Haki do Rei e espírito suficiente entra num choque
    (a câmera aproxima os dois, os golpes se encontram sem as armas se
    tocarem, raios e explosão como no anime). Ganha o maior **overall**:
    atacante vence → o golpe entra com bônus de dano; atacante perde →
    leva de volta o dano base puro do próprio golpe; overall praticamente
    igual → o choque explode e o ataque se anula. (Teste: o defensor gasta
    30 de espírito; diferença ≤ 3 = empate; bônus ×1,3.)
  - **Haki de observação**: gasta usos como o armamento (não fica ligado o
    tempo todo). Ao gastar: esquiva garantida contra quem tem Haki menor;
    contra Haki igual ou maior, a chance sai de uma fórmula (esquiva atual +
    esquiva do Haki − overall de Haki do inimigo) — aumenta, mas não chega a
    100%. **Observação avançado** (prevê ataques): esquiva e contra-ataca na hora.
  - **O Haki mais forte prevalece**: em disputas em que o Haki conta, o mais
    forte tem grande chance de vencer o mais fraco. **Duelo de Haki** pelo
    **overall** (média de todos os tipos; cálculo a definir).
  - **Logia**: intangível contra golpes sem Haki de armamento e sem
    Kairoseki, com **cargas de intangibilidade por batalha** (recurso só
    dela, não gasta energia nem ações): cada golpe que atravessaria gasta 1.
    Quantidade pela raridade da fruta (ex.: Comum 3, Rara 5, Épica 8,
    Lendária 12, Mítica 16, Divina 20) + bônus de maestria da Akuma. Sem
    cargas, fica "desgastado" e toma os golpes. Haki e Kairoseki sempre
    atingem, sem gastar carga.
  - **Sem vontade da tripulação** (a do Sugoi sai): cada personagem tem o
    próprio **espírito** — sobe pouco a pouco a cada turno e mais ao acertar
    ou ser atingido; é gasto para usar o Haki do Rei.
  - **Vez da tripulação** (testar primeiro): o lado mais ágil começa; na sua
    vez anda com quem quiser e ataca uma vez. Depois testar a **fila por
    personagem** (ordem pela AGL de cada um). **Tempo por vez** igual ao
    Sugoi: 90 s; quem perde a vez pelo tempo 3 vezes passa a ter só 30 s.
  - **Mirar**: escolher um pirata já deixa o golpe básico pronto; inimigos
    que dá para acertar ficam em vermelho forte, o alcance em vermelho
    fraco e a área do golpe em laranja. Mouse: passar por cima mostra a
    área e um clique ataca; toque: o primeiro toque mostra a área e o botão
    "Atacar", o segundo confirma. Clicar no inimigo ou na casa dele dá no
    mesmo. Golpe que não pega ninguém não é aceito (não gasta a vez à toa).
  - Tudo aqui é **teste**: o que ficar bom entra, o resto sai.
- **Regras do protótipo** (`frontend/src/tabuleiro/batalha/regras.ts`, puro e
  determinístico pela semente — o servidor do multiplayer usa o mesmo):
  cada um anda até 3 casas e age; ordem por AGL. Golpes: comum, pesado
  (×1,5, quebra bloqueio/aparar, fácil de esquivar), finta (×0,8, engana
  aparar/contra, não dá para esquivar). Posturas: bloquear (35% passa),
  esquivar, aparar (2 de vontade, anula o comum), contra-atacar (3, revida
  de perto). Vontade: começa 2, +2 por rodada, máx. 10. Atirador alcança 4
  casas; médico cura 32 a até 3 casas. Formações espelhadas; IA × IA dá
  ~50% para cada lado, ~11 rodadas.
- **Arte provisória**: personagens montados no gerador LPC (Liberated Pixel
  Cup, CC-BY-SA/GPL — créditos em `public/sprites/<nome>/creditos.csv`),
  ampliados 2× (~96 px, tamanho de Ragnarok), 4 direções (diagonais usam a
  lateral). Importador: `frontend/scripts/sprites/importar_lpc.py`; lista das
  tripulações em `frontend/scripts/sprites/fonte/lpc/tripulacoes.json`.
  A arte final será desenhada à mão depois (mesmo formato de manifesto).
- **Teste de tabuleiro em pixel art** (`/teste-tabuleiro`): tabuleiro 10×20 em
  dois conveses de 5×20 (um navio de cada lado, água entre eles), câmera de
  cima inclinada como na referência. Andar 1 casa = caminhada; mais de 1 =
  corrida, que termina freando (pé arrastando, tranco e poeira). Ataque com
  preparação, brilho na lâmina e rastro do corte.
- **Personagens modulares** (`/teste-boneco`, o provador): boneco 3D com
  corpo base + encaixes (cabelo, barba, chapéu, camisa, casaca, capa,
  cintura, calça, botas, arma), "fotografado" em pixel art em 8 direções
  (5 + espelho) com ciclos de 12 quadros. Trocar peça = assar de novo.

- **Personagens em pixel art estilo Ragnarok** (decidido): sprites em camadas
  (corpo+roupa, cabeça, rosto, cabelo, chapéu, arma, capa), 96 px de altura,
  5 direções + espelho. Especificação completa em `SPRITES.md`. O tabuleiro já
  usa câmera isométrica com perspectiva suave e casa de ~63×48 px no meio.

## Depois
_(ideias que entram mais tarde)_

## Em aberto
_(ideias ainda em discussão)_
