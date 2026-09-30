# Projeto do novo jogo (Grand Seas) — documento original

> Texto extraído do PDF `OP_PROJECT.pdf` enviado pelo autor. Algumas partes
> estão desatualizadas (o autor mudou de ideia e não atualizou o arquivo): as
> decisões valem conforme o `DESIGN.md` e as conversas. Ex.: a tecnologia
> hoje é React + C#, não Godot + Java. O Sugoi (jogo original) é a fundação;
> este documento traz as ideias do jogo novo para juntar com ele.

```text
TECNOLOGIAS UTILIZADAS

   ●​   Frontend: Godot
   ●​   Backend: Java Spring Boot
   ●​   Banco de Dados: MySql
   ●​   Hospedagem: AWS (Cloud)
   ●​   Conteinerização: Docker

CRIAÇÃO DE PERSONAGEM

Criação de conta: email, senha, confirmar senha

No início, o jogador escolhe entre se tornar Pirata, Marinha ou Exército Revolucionário. Essa
escolha define a temática da interface (cores, botões, etc.).

Para Piratas:

   ●​   Nome do Capitão
   ●​   Nome da Tripulação
   ●​   Foto de card Personagem
   ●​   Criação da Jolly Roger (Bandeira personalizada)

Para Marinheiros:

   ●​   Nome do Marinheiro
   ●​   Nome do Destacamento
   ●​   Foto de card Personagem
   ●​   Criação da Bandeira da Marinha

Para Revolucionários:

   ●​   Nome do Revolucionario
   ●​   Estilo de Combate
   ●​   Nome do Exercito
   ●​   Foto de card Personagem
   ●​   Criação da Bandeira Revolucionária.

Após a criação:

   ●​ Botão para começar a aventura ou reformular a escolha

________________________________________________________________



SISTEMA DE TRIPULAÇÃO
    ●​   Capitão LVL 1 - 4    | Tripulação de 2 companheiros | Bote
    ●​   Capitão LVL 5 - 10 | Tripulação de 4 companheiros | Necessário Barco pequeno+
    ●​   Capitão LVL 11 - 20 | Tripulação de 6 companheiros | Necessário Barco médio+
    ●​   Capitão LVL 21 - 30 | Tripulação de 8 companheiros | Necessário Navio grande+
    ●​   Capitão LVL 31 - 50 | Tripulação de 10 companheiros | Necessário Navio de Guerra+


RAÇAS:

    ●​ Humano​
       Passiva: Sobrevivente | | Ao atingir 50% ou menos de HP, recebe +10 em todos
       os atributos por 3 turnos. Só ocorre uma vez por combate.
    ●​ Homem-Peixe​
       Passiva: Soberano dos Mares | Podem mergulhar sem ter a profissão
       mergulhador, Tem defesa aumentada
    ●​ Skypiean​
       Passiva: Voo Ágil | Agilidade elevada
    ●​ Gigante​
       Passiva: Força Titânica | Vigor e Atk elevado
    ●​ Mink​
       Passiva: Ataque Duplo | Tem chance de dar um segundo ataque consecutivo
       em habilidades de raça
    ●​ Ciborgue
​      Passiva: Auto-reparo| Recupera 5% do HP no início de cada turno

CLASSES DE COMBATE

    ●​   Lutador
    ●​   Espadachim
    ●​   Atirador
    ●​   Cientista

PROFISSÕES DISPONÍVEIS

    ●​   Médico
    ●​   Arqueólogo
    ●​   Navegador
    ●​   Carpinteiro
    ●​   Cozinheiro
    ●​   Mercador
    ●​   Músico
    ●​   Mergulhador
    ●​   Ladrão
  ●​ Ferreiro
  ●​ Explorador
  ●​ Artesão


FACÇÕES:

  ●​ Piratas: Opostos a todos, podem formar alianças entre si.
  ●​ Marinheiros: Combatem piratas e revolucionários, são amigos entre si.
  ●​ Revolucionários: Combatem o Governo Mundial e atacam Mary Geoise.




SISTEMA DE ALIANÇAS (CLANS)

  ●​   Apenas piratas podem formar alianças.
  ●​   Cada aliança pode ter no máximo 10 tripulações.
  ●​   Alianças impedem combates entre membros, exceto em Zonas Negras.
  ●​   Requisito: Capitão nível 50+

SISTEMA DE NAVEGAÇÃO

  ●​ Mapa dividido em: 4 Blues, GrandLine > (Paraíso, Novo Mundo e CalmBelt separando
     todos)
  ●​ Para viajar no Calm Belt requer no mínimo > Navio grande e Reforço de Kairoseki.
         ○​ Caso um jogador tente navegar sem esses requisitos, ele enfrentará rei dos
            mares imbatíveis.
  ●​ Para acessar a Grand Line: Capitão nivel 15+, Barco médio e Casco com reforço de
     Madeira bruta..
  ●​ Acessar o Novo mundo: Capitão nivel 31+, Navio Grande e Casco com reforço de
  ●​ Cada ilha possui nível recomendado para missões (PVE/IDLE).
  ●​ Navegação por quadrantes (coordenadas).
  ●​ Os marinheiros podem usar elevador em Mary Geoise para mudar de região (Paraiso >
     Novo Mundo).
  ●​ Para navegar nos blues, você pode usar normalmente a bussula normal, o NPC de
     missões da ilha te falará a direção da proxima ilha.
  ●​ Para navegar na grandline, será necessário comprar um LogPose, somente o LogPose
     informará a direção da proxima ilha, e o usuário precisará ficar algum tempo
     determinado na ilha para ele apontar a direção da proxima.
  ●​ Existe a possibilidade de comprar EternalPoses para marcar uma ilha especifica que o
     usuário desejar, ela vai apontar somente para ele sempre, mas apos usar em uma ilha,
     nao poderá usar este mesmo para outra ilha.
   ●​ No novo mundo há possibilidade de comprar o LogPose Triplo, ele apontará para 3 ilhas
      diferentes.
   ●​ Zonas navegaveis:
          ○​ Azul: Blues (sem PvP)
          ○​ Amarela: Paraíso (PvP com gold parcial)
          ○​ Vermelha/Negra: Novo Mundo (PvP com drop de itens/gold)
          ○​ Zona Negra: CalmBelt: com alto risco de destruição do Navio.

ZONAS DO MAPA

   ●​   Zona Azul: PvP desativado
   ●​   Zona Amarela: PvP com perda de % do gold
   ●​   Zona Vermelha: PvP com drop de itens aleatórios + 30% do gold
   ●​   Zona Negra: PvP com drop total de itens do barco + 50% do gold
   ●​   Zona da Morte: Em construção.


ILHAS:
O jogo atualmente terá as seguintes ilhas:
East Blue:
   1.​ Dawn Island
   2.​ Goat Island
   3.​ Shells Town
   4.​ Organ Island
   5.​ Ilha dos Animais Raros
   6.​ Gecko Island
   7.​ Baratie
   8.​ Conomi Island
   9.​ Loguetown
   10.​Reverse Mountain

North Blue:

   1.​ Rubeck
   2.​ Spider Miles
   3.​ Flevance
   4.​ Rakesh
   5.​ Downs Island
   6.​ Notice Town
   7.​ Whiteland Kingdom
   8.​ Lvneel Kingdom
   9.​ Deul Kingdom
   10.​Reverse Mountain
West Blue:

   1.​ Ilisia Kingdom
   2.​ Toroa Island
   3.​ Kano Country
   4.​ Ballywood Kingdom
   5.​ Reverse Mountain

South Blue:

   1.​ Karate Island
   2.​ Sorbet Kingdom
   3.​ Torino Kingdom
   4.​ Centurea Kingdom
   5.​ Judo Island
   6.​ Baterilla Island
   7.​ Briss Kingdom
   8.​ Reverse Mountain

Paradise:

   1.​ Twin Cape
   2.​ Whisky Peak
   3.​ Little Garden
   4.​ Drum Island
   5.​ Alabasta
   6.​ Jaya
   7.​ Long Ring Long Land
   8.​ Water 7
   9.​ Enies Lobby (Calm belt)
   10.​Florian Triangle (Thriller Bark)
   11.​ Impel Down (Calm belt)
   12.​Amazon Lily (Calm belt)
   13.​Kuraigana Island
   14.​Sabaody
   15.​Fishman Island

New World:

   1.​ G-5
   2.​ Punk Hazard
   3.​ Dressrosa Kingdom / Green Bit
   4.​ Zou
   5.​ Whole Cake
   6.​ Germa Kingdom
   7.​ Baltigo
   8.​ Wano
   9.​ Egghead
   10.​Elbaf
   11.​Sphinx Island
   12.​ Hachinosu (Pirate Island)
   13.​Loadestar Island

Redline:

Mary Geoise

Existe NPC’s que só estarão em certas ilhas, alguns deles ficaram em todas:​
NPC Carpinteiro - Conserta o barco, vende reforços e revestimentos condizentes com o nível
da ilha. faz upgrades no geral em relação ao barco.​
NPC Médico - Cura sua tripulação em determinado tempo, pode vender remedios​
NPC Mercador - Compra e vende itens e equipamentos no geral​
NPC Navegador - Dá dicas da posição da proxima ilha e tambem oferece dicas uteis em troco
de Berries​



NPCs Específicos por Região / Ilha

NPC Carpinteiro Avançado (ilhas maiores ou do Novo Mundo)

   ●​ Oferece upgrades de equipamentos avançados​

   ●​ Vende reforços de materiais raros (Carvalho Negro, Titânio Marinho, etc)

NPC Ferreiro (ilhas com mineração ou industriais)

   ●​ Refina armas e equipamentos​

   ●​ Vende ou faz melhorias para armas raras ou lendárias

NPC Alquimista / Cientista (ilhas científicas, Egghead, Punk Hazard)

   ●​ Cria poções, bombas ou itens especiais​

   ●​ Oferece quests para coleta de materiais raros

NPC Treinador de Combate (ilhas de treino ou militares)

   ●​ Permite treino de habilidades e atributos​
  ●​ Oferece missões de treino para ganhar EXP extra




SISTEMA DE DOMINAÇÃO DE ILHAS

  ●​ Ilhas podem ser dominadas por tripulações ou alianças.
  ●​ Dominação libera fast travel para os membros.
  ●​ Ilhas oferecem buffs e recursos únicos, como menos tempo em missões
     idle, +gold em missões, melhores comidas disponíveis, etc.
  ●​ Ilhas do Governo Mundial são invadidas periodicamente, mas não
     dominadas.



CORSÁRIOS

  ●​ Piratas podem se aliar à Marinha e se tornar Corsários.
  ●​ Necessario Bounty de 80.000.000 milhões para pedir permissão de
     corsário.
  ●​ Possuem barra de Karma (negativa = volta a ser pirata).
  ●​ Podem circular livremente entre bases da Marinha e usar elevador de
     Mary Geoise
  ●​ Ataques à jogadores da Marinha reduzem Karma drasticamente.
  ●​ Apenas 7 por era.

NAVIOS

  ●​ Tipos de Embarcações:
        ○​ Bote (Grátis) | 2 slots
        ○​ Barco pequeno (1000B) | 5 slots
        ○​ Barco médio (5000B) | 10 slots
        ○​ Navio grande (15000) | 20 slots
        ○​ Navio de Guerra (25000) | 30 slots
        ○​ Navio Nomeado: Eventos | 50 slots​
            (mais HP, maior armazenamento, imune a quebra de partes)
  ●​ Componentes de Embarcações::
        ○​ Revestimentos: Bolha - permite acessar Ilha dos Homens-Peixe,
           Nuve
         ○​ Reforços de partes: Madeira Bruta, Carvalho Negro, Ferro Naval,
            Aço Naval, Titânio Marinho, Kairoseki
         ○​ Partes: Casco, Vela, Leme, Mastro, Canhões, bola decanhoes
         ○​ Equipamentos especiais: Coup de Burst (pulo de x quadrados 1x
            por dia)
         ○​ Armazém: Depende do tamanho do barco
         ○​ Sistema de dano oculto nas partes; abaixo de 40% de HP, risco de
            quebra

SISTEMA DE LEVELING

  ●​ Nível: 1 a 50
  ●​ Ganha EXP por: Missões IDLE, Missões PVE, PVE, PVP, Eventos e
     Guerras

SISTEMA DE HAKI

  ●​ Liberado a partir do nível 30 (treino com tutor)
  ●​ Haki vai até nível 100
  ●​ Ao nível máximo, concede +30% ao atributo correspondente

Tipos de Haki:

  1.​ Busoshoku (Armadura): +30% Defesa. Nível máximo: +50 Defesa base
      e +10% defesa contra ataques de Akuma no Mi
  2.​ Kenbunshoku (Visão): +30% Esquiva. Nível máximo: habilidade
      autododge (desvia de 3 ataques)
  3.​ Haoshoku (Rei): 1% de chance de obtenção ao nível 20. Stuna
      oponentes com haki overall inferior por 1 turno. Se o oponente tiver Haki
      Overall equivalente ou superior, é iniciado um Duelo de Haki
      (dependendo de sorte, atributos e níveis de haki).

BOUNTY, HONOR e INFLUENCE

  ●​ Piratas: Ganham Bounty por atividades (PvE, PvP, eventos, domínio, etc)
  ●​ Marinheiros: Ganham Honor por atividades relacionadas a marinha
  ●​ Revolucionarios: Ganham Fama por atividades relacionadas a missoes e PvP ou PvE
     contra o governo mundial ou marinheiros, dominar ilhas ou diminuir recursos do gov.
     mundial
   ●​ Algumas profissões (como Arqueólogo) aumentam o ganho de bounty a cada ação
      realizada da profissão, por exemplo: Ao selecionar um personagem para ser
      arqueólogo, ele vai ser aumentado a bounty em x Berries.

SISTEMA DE RANKING

O ranking de jogadores será baseado em quanto de Bounty,Honor ou Influence que os
Capitães possuem.

Pirata:

   ●​ Rei dos Piratas: O primeiro jogador a conquistar todos estes requerimentos
         ○​ Ter derrotado pelo menos 1 Almirante ativo na zona negra​
             Possuir bounty mínimo de 5.000.000.000 berries
         ○​ Dominar no mínimo 3 ilhas importantes
         ○​ Ter visitado 100% das ilhas do jogo, incluindo as ilhas escondidas ou lendárias
         ○​ Estar em posse dos 4 Road Poneglyphs
         ○​ Ter vencido 1 outro Imperador em combate na zona negra
         ○​ Estar como Top 1 do ranking de recompensas (bounty)
   ●​ Imperador: Os 4 primeiros jogadores piratas com os seguintes requerimentos se tornam
      Imperadores
         ○​ Capitão nível 50
         ○​ Bounty minima de 2.240.000.000 bilhoes berries
         ○​ Dominar pelo menos 1 ilha
         ○​ Estar em uma aliança.
         ○​ Estar entre os top 4 do ranking de piratas​ ​        ​

          Lenda​ ​        ​  | 1.000.000.000 Bounty​
          Terror dos Mares​  | 700.000.000 Bounty​
          Comandante do Mar​ | 500.000.000 Bounty​
          Grande Pirata ​    | 50.000.000 Bounty​
          Supernova ​ ​      | 10.000.000 Bounty​
          Pirata de Elite ​  | 1.000.000 Bounty​
          Pirata Notório ​​  | 500.000 Bounty​
          Pirata Iniciante ​ | 200.000 Bounty​
          Foragido ​      ​  | 50.000 Bounty​
          Marujo​​        ​  | 10.000 Bounty​
          Bandido​        ​  | 0 Bounty




Marinha:

   ●​ Almirante de Frota: O jogador com este requisito se torna Almirante de Frota
         ○​ Ter sido Almirante em até 1 era atrás.
          ○​ Ter liderado a defesa de uma ilha do Governo Mundial ou Base Naval contra
             invasão de um Imperador.
          ○​ Estar no top 4 do ranking de marinheiros
          ○​ Votação global de marinheiros
   ●​ Almirante: Os 3 primeiros jogadores marinheiros com os seguintes requerimentos se
      tornam Almirantes
          ○​ Capitão nível 50+
          ○​ Honor mínimo: 1.800.000.000
          ○​ Estar em uma frota da Marinha.
          ○​ Ter derrotado pelo menos 1 pirata com bounty > 2 bilhões
          ○​ Ter defendido um ataque a uma ilha do Governo Mundial ou dominada pela
             Marinha

       Vice-Almirante​​   ​       | 1.000.000.000 Honor​
       Contra-Almirante​  ​       | 700.000.000 Honor​
       Comodoro​      ​   ​       | 500.000.000 Honor​
       Capitão ​      ​   ​       | 50.000.000 Honor​
       Comandante​ ​      ​       | 10.000.000 Honor​
       Tenente Comandante​​       | 1.000.000 Honor​
       Tenente​       ​   ​       | 500.000 Honor​
       Sargento-Mor​ ​    ​       | 200.000 Honor​
       Sargento​      ​   ​       | 50.000 Honor​
       Cabo​ ​        ​   ​       | 10.000 Honor​
       Soldado​       ​   ​       | 0 Honor




Exército Revolucionário:

Líder Supremo​
Chefe de Estado-Maior​
Comandante Regional​
Vice-Comandante Regional​
Oficial Tático​
Capitão de Esquadrão​
Tenente de Operações​
Sargento de Campo​
Agente Especial​
Recruta de Elite​
Soldado Revolucionário



SISTEMA DE ATRIBUTOS
  Atributo                                    Efeito

  Ataque                                      Dano físico

  Defesa                                      Dano Mitigado

  Vigor                                       Quantidade de hp do jogador

  Poder da Akuma no Mi                        Dano de habilidades

  Destreza                                    Crítico (% max) = multiplicador de dano

  Agilidade                                   Chance de desvio

  Precisão                                    Chance de acerto




SISTEMA DE COMBATE

   ●​ Combate por turno
   ●​ Tempo de 2min para cada jogador agir
   ●​ Haverá prioridade de skills apesar do turno > Instant Skill, Slow Skill,
      Rapid Skill
   ●​ Separar skills ativas/passivas e buffs, cada um com sua aba
   ●​ Uma tripulação luta contra todos da outra que tiverem hp > 0
   ●​ Haverá um “chat” para as informações dos acontecimentos da batalha
   ●​ O campo de batalha será representado por diversos quadrados, X,Y
   ●​ Dependendo da Akuma no Mi, ou até mesmo a arma, o ataque poderá ser
      lançado a vários quadrados de distância, ou até mesmo dar dano em
      varios quadrados
   ●​ Capitães que possuírem Haki do Rei podem usar a habilidade única,
      sendo ela uma Instant Skill, porém caso o outro capitão possua a skill
      tambem, o jogo perguntará se ele quer dar clash ou não

SISTEMA DE AKUMA NO MI:

As Akuma no Mi serão obtidas de diversas formas:

   ●​ Explorando ilhas com a profissão Explorador
   ●​ Mergulhando com a profissão Mergulhador
   ●​ Com uma pequena chance ao usar a profissão Ladrão
   ●​ Participando de Eventos

Os jogadores encontrarão apenas o tipo da fruta (Paramecia, Logia ou Zoan) e sua raridade. A
partir disso, caberá ao jogador:

   ●​ Nomear sua própria fruta
   ●​ Distribuir os pontos na árvore de habilidades da fruta
   ●​ Montar os ataques e passivas disponíveis

A raridade influencia diretamente:

   ●​ No dano base da Akuma
   ●​ Na quantidade de slots para ataques e habilidades
   ●​ Na geração de passivas únicas aleatórias

Características por tipo:

   ●​ Logia: Maior número de ataques disponíveis, maior dano de habilidades
   ●​ Zoan: Foco em passivas relacionadas a defesa e transformação
   ●​ Paramecia: Mais voltada para buffs, dano fisico e destreza​


As frutas já existentes no mundo de one piece serão únicas, respeitando os limites definidos
pelo tipo e raridade, mas também serão geradas frutas aleatórias pelo sistema.

Raridade das frutas:

Comum​
Rara ​
Épica ​
Lendária​
Mítica​
Divina

EQUIPAMENTOS

Categorias de Equipamentos:

   ●​ Arma: Aumenta dano físico ou efeitos especiais (espadas, rifles, bastões,
      garras, etc)
   ●​ Chapéu: Bônus de evasão, defesa +
   ●​ Camisa: Aumenta defesa física ou resistência a status
   ●​ Calça: Melhora agilidade, velocidade ou esquiva, defesa +
   ●​ Capa: Melhora a defesa e passivas
   ●​ Botas: Bônus de agilidade, defesa +
   ●​ Anel: Buff passivo (dano extra, regeneração, etc)
   ●​ Pingente: Bônus elementar, resistência ou aura especial (ex: reduzir Haki
      inimigo)

Sistema de Qualidade/Raridade:

   ●​ Comum
   ●​ Incomum
   ●​ Raro
   ●​ Épico
   ●​ Lendário
   ●​ Relíquia (únicos no servidor / de eventos / bosses especiais)

SISTEMA DE REFINO

Possibilidade de refinar a arma até +20 para a melhoria de seus atributos.​
Ao chegar em +15, existe chance de quebrar a arma na falha do refino.

SISTEMA DAVY BACK FIGHT

Em contrução.

SISTEMAS FUTUROS:
Leilão

```
