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
