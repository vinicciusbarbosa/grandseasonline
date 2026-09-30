# Balanceamento da batalha — simulações (protótipo)

Rodado com `frontend/scripts/balanceamento/rodar.sh`: IA × IA, cada confronto
com metade das batalhas de cada lado (tira a vantagem de lado). ~40 mil
batalhas. Regras da época: 1 ataque por vez, 5 movimentos, recarga, Haki
ligado separado, armamento recupera com espírito, Logia com 3 cargas.

"Base" = time sem Akuma e sem Haki. Percentual = vitória do time com o fator.

## Controle

- Espelho (base × base): **49%** — sem vantagem de lado.
- Confrontos aleatórios: lado A **50%**.
- Elenco de teste da tela (Piratas × Marinha): **54%**.

## Um fator num papel (o resto do time sem nada)

| fator | Capitão | Espadachim | Lutador | Atirador | Médico |
|---|---|---|---|---|---|
| Observação avançada | 94% | 95% | 92% | 95% | 58% |
| Logia Luz | 91% | 95% | 86% | 81% | 54% |
| Rei + armamento avançado | 89% | 83% | 85% | 69% | 53% |
| Logia Fogo | 83% | 85% | 86% | 87% | 59% |
| Logia Gelo | 83% | 86% | 80% | 83% | 46% |
| Logia Fumaça | 78% | 83% | 85% | 84% | 49% |
| Observação | 85% | 80% | 82% | 82% | 50% |
| Armamento avançado | 76% | 84% | 79% | 65% | 52% |
| Paramecia Borracha | 77% | 71% | 83% | 64% | 61% |
| Armamento | 51% | 69% | 59% | 59% | 47% |
| Zoan Bisão | 55% | 55% | 51% | 51% | 52% |
| Haki do Rei (sem armamento) | 48% | 45% | 46% | 49% | 51% |

## Estratégias do time inteiro (matriz, média contra todas)

Observação avançada 89% · Rei + arm. avançado 85% · Arm. avançado 67% ·
Logia Fogo 59% · Logia Gelo 55% · Logia Fumaça 54% · Borracha 40% ·
Armamento 35% · Bisão 9% · Nada 9%.

Destaques: Observação avançada vence Logia 94–100% e Arm. avançado 81%;
só perde para Rei + arm. avançado (25%).

## Overall (capitães com Rei + arm. avançado)

| diferença | −12 | −6 | −4 | −2 | 0 | +2 | +4 | +6 | +12 |
|---|---|---|---|---|---|---|---|---|---|
| vitória | 21% | 12% | 19% | 47% | 42% | 51% | 83% | 83% | 84% |

Degrau: de ±2 (empate no choque) para ±4 o resultado vira.

## Confrontos aleatórios (2 000): peso de cada coisa a mais no time

Obs. avançada +19 p.p. · Arm. avançado +17 · Capitão Rei+arm.av. +13 ·
Logia +10 · Observação +10 · Armamento +7 · Haki do Rei +6 · Borracha +5 ·
overall (+10 na média) +5 · Bisão +1.

## Desequilíbrios encontrados

1. **Anular um ataque vale uma vez inteira.** Com 1 ataque por vez, cada
   esquiva da observação e cada carga de Logia anulam a vez toda do
   inimigo. Por isso a Observação (principalmente a avançada, que ainda
   revida) e a Logia dominam.
2. **Observação garantida** contra quem tem overall menor: contra time sem
   Haki, 3 usos = 3 vezes inimigas perdidas.
3. **Haki do Rei sozinho não ajuda (e até atrapalha):** o Haki do Rei em área
   gasta a vez e atordoar um personagem quase não importa — a tripulação ataca
   com outro.
4. **Zoan (Bisão) não faz diferença:** transformar gasta a vez.
5. **Médico:** fator nele quase não muda nada (ataque baixo, raramente ataca).
6. **Overall é um degrau:** 4 pontos decidem o choque e o atordoamento.
7. **Armamento normal é fraco** perto do avançado.

## Bug corrigido durante o estudo

A IA ignorava quem tinha Logia com cargas (achava que o golpe "não
valia"): ninguém batia no Logia e ele vencia sozinho (100%). Agora a IA
trata cada carga/uso de observação como um escudo a quebrar (84%).

## Rodada 2 — depois dos ajustes

Mudanças: Haki do Rei em área não gasta a vez (atordoa na próxima vez);
observação é chance (normal 30%, avançada 45%, teto 60/75%); buffs,
transformação e profissão não gastam a vez; armamento ×1,4 / avançado
×1,55 e fura 15/35% da defesa; companheiros não se ferem.

- Espelho 49% · aleatório 51% (sem vantagem de lado).
- Time inteiro × nada: Haki do Rei 38% → **84%**; Bisão 46% → **91%**;
  Armamento 78% → **92%**; Observação 100% → 97%.
- Um fator num papel: Observação ~80% → **~70%**; Observação avançada
  ~94% → **~86%**; Haki do Rei ~47% → **~57%**; Bisão ~52% → **~63%**;
  Armamento ~58% → **~72%**.
- Matriz (média): Rei + arm. av. 93% · Arm. avançado 80% · Obs. avançada
  77% · Logias ~50% · Armamento 50% · Borracha 33% · Bisão 15% · Nada 2%.
- Overall: −4 → 25%, 0 → 50%, +4 → 70% (antes 19% / 42% / 83%).
- Elenco de teste: estava 30% para os piratas; ajustado (Comandante sem
  observação, Médico com observação) → ~52%.

Ainda forte: Rei + armamento avançado (é o "topo" do Haki) e Logia contra
time sem Haki (é a proposta da Logia; contra armamento fica ~50%).
