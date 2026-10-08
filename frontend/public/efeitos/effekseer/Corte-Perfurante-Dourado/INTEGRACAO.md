# Corte perfurante dourado — 4 casas

Corte de energia amarelo e dourado, sem personagem. Frente curva vertical, núcleo claro e fios de energia na cauda. Avança em linha reta, atravessa os alvos e se desfaz no limite do alcance. Os flashes de perfuração são curtos e não interrompem o voo.

## Arquivos

Cada efeito inclui projeto editável `.efkproj`, exportação nativa `.efkefc` e XML `.efk`. Preserve as pastas `Model` e `Texture` ao copiar.

| Efeito | Uso |
|---|---|
| `Corte_Perfurante_Dourado_Demonstracao` | Sequência completa de 4 casas, origem no chão, frente +Z. |
| `Corte_Perfurante_Dourado_Projetil` | Corte com raiz fixa, para movimentar pelo jogo. Origem no centro do corte. |
| `Corte_Perfurante_Dourado_Disparo` | Flash de lançamento. |
| `Corte_Perfurante_Dourado_Perfuracao` | Flash separado em cada alvo confirmado. |
| `Corte_Perfurante_Dourado_Dissipacao` | Desaparecimento no fim do alcance. |

## Demonstração pronta

Escala 1: cada casa equivale a 1 unidade. Altura do corte: 0,95. Lançamento no frame 4; percurso de 4 unidades em 24 frames (0,4 segundo a 60 fps). Flashes nas posições Z = 1, 2, 3 e 4. Depois há uma breve dissipação. Não há dano implementado no pacote.

A demonstração usa flashes em todas as casas para visualizar o percurso. No combate, use os efeitos separados e gere flashes apenas nos alvos realmente atingidos. Girar a raiz orienta +Z para a direção do tiro. Escalar a demonstração também escala o percurso; use o controlador quando tamanho visual e alcance precisarem ser independentes.

## Controlador para Effekseer WebGL

`perfurante-controlador.mjs` recebe origem e destino no mundo. O jogo determina o destino quatro casas à frente, os alvos atingidos e o dano. `passagens` contém a fração do percurso de cada alvo (0 a 1). O controlador ordena as passagens, dispara cada uma uma vez e mantém o projétil ativo até chegar ao destino.

```js
import { criarCortePerfurante } from './perfurante-controlador.mjs';

const tiro = criarCortePerfurante({
  context,
  efeitos: { projetil, disparo, perfuracao, dissipacao }, // efeitos carregados
  origem: { x: 0, y: 0, z: 0 },
  destino: { x: 0, y: 0, z: 4 },
  passagens: [
    { id: 'alvoA', fracao: .25 },
    { id: 'alvoB', fracao: .75 }
  ],
  altura: .95,
  escala: 1,
  duracao: .4,
  aoPerfurar: (alvo, posicao) => { /* resolver conforme o combate */ }
});

// No tick, antes de atualizar/desenhar o contexto Effekseer:
tiro.atualizar(dtEmSegundos);
// tiro.cancelar() para interromper e remover seus efeitos.
```

O controlador usa segundos, orientação em radianos e +Z como frente. `altura` é somada ao Y dos pontos. Alterar `escala` não altera origem, destino ou alcance. A duração máxima é 1,8 segundo, dentro da vida útil do projétil (2 segundos). Em um tick que ultrapassa várias passagens, todas são processadas na ordem. `cancelar()` impede callbacks futuros.

Use os centros reais das casas do tabuleiro para origem/destino e distâncias projetadas ao longo da trajetória para as frações. Quatro passos diagonais cobrem uma distância maior que quatro unidades; o vão entre os barcos também modifica a distância física.

## Uso no projeto atual

O pacote foi salvo em `frontend/public/efeitos/effekseer/Corte-Perfurante-Dourado`. O jogador atual do jogo usa a conversão para JSON em `src/tabuleiro/cena/efk.ts`; não carrega diretamente estes `.efkefc`. Para esse jogador, converta os projetos com `frontend/scripts/efeitos/efk_converter.py` e associe os resultados à skill. O controlador incluído é para a API nativa Effekseer WebGL. A ligação à lógica de combate ainda precisa ser feita.

## Verificação

Exportado e renderizado no runtime nativo Effekseer WebGL. Conferidos três ângulos, duas sementes, passagens consecutivas, término sem resíduos e controlador com quatro passagens sem parada antecipada. Projetil, disparo, perfuração e dissipação também renderizados separadamente.
