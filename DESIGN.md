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

---

## Agora
- Protótipo das posturas + vontade na abordagem (contra a IA), depois no PvP.
- **Teste de tabuleiro em pixel art** (`/teste-tabuleiro`): tabuleiro 10×20 em
  dois conveses de 5×20 (um navio de cada lado, água entre eles), câmera de
  cima inclinada como na referência. Andar 1 casa = caminhada; mais de 1 =
  corrida, que termina freando (pé arrastando, tranco e poeira). Ataque com
  preparação, brilho na lâmina e rastro do corte.
- **Personagens modulares** (`/teste-boneco`, o provador): boneco 3D com
  corpo base + encaixes (cabelo, barba, chapéu, camisa, casaca, capa,
  cintura, calça, botas, arma), "fotografado" em pixel art em 8 direções
  (5 + espelho) com ciclos de 12 quadros. Trocar peça = assar de novo.

## Depois
_(ideias que entram mais tarde)_

## Em aberto
_(ideias ainda em discussão)_
