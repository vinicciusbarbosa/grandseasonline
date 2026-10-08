# Rajada de corte azul

Meia-lua de energia que avança pelo cenário mantendo sua curva. A borda branca tem glow azul e ciano, corpo luminoso, cauda ondulante, filamentos finos e partículas soltas. O pack contém apenas os efeitos, sem personagens. A meia-lua fica aproximadamente no plano XZ, com uma pequena inclinação e espessura para a perspectiva elevada do tabuleiro.

Pasta pública: `/efeitos/effekseer/Rajada-Corte-Azul/`. Preserve `Model/` e `Texture/` ao lado dos efeitos. Abra os `.efkproj` no Effekseer 1.80.7; use os `.efkefc` no runtime nativo. Também acompanham exportações `.efk`.

## Efeitos

| Arquivo | Uso e origem | Tempo |
| --- | --- | --- |
| `Rajada_Corte_Azul_3_Casas` | Sequência pronta: origem no solo, projétil a Y = 0,8; avança para +Z e dissipa em Z = 3 | Disparo no frame 0, voo de 6 a 36, impacto no 36; encerrado antes do frame 85 |
| `Rajada_Corte_Azul_Projetil` | Meia-lua independente, origem no centro da rajada; raiz fixa para movimento externo | Até 90 frames, mais partículas residuais; interromper quando chegar |
| `Rajada_Corte_Azul_Disparo` | Flash curto no ponto de lançamento | Cerca de 0,25 s |
| `Rajada_Corte_Azul_Impacto` | Dissipação/contato no ponto de chegada | Cerca de 0,4 s |

## Três casas

O tabuleiro atual, em `frontend/src/tabuleiro/tabuleiro.ts`, usa casas de **1 unidade**. O efeito pronto avança 3 unidades durante 30 frames: `0,1 unidade/frame`, ou `6 unidades/segundo`. Apenas o grupo do projétil se desloca; o disparo e o impacto ficam em seus pontos. A raiz da sequência completa permanece na origem.

Esse alcance mede a posição central do projétil. A ponta e a cauda têm extensão visual; não use sua malha como definição automática da área de dano. A meia-lua mede cerca de 2 unidades de largura; sua cauda local se estende aproximadamente até Z = -1,7. A lógica de quais casas recebem dano pertence ao combate.

Para a sequência pronta, mantenha escala 1 se quiser percurso de 3 unidades. Escalar o efeito inteiro também escala seu deslocamento. Para ajustar o tamanho visual mantendo as três casas, use o projétil separado e mova sua posição no código.

Em diagonais, três passos podem representar `3 × √2` unidades. Entre navios, o vão de água aumenta a distância entre os centros das casas. Use as posições reais retornadas por `centroCasa`, em vez de assumir sempre 3 metros/unidades.

## Controlador opcional para Effekseer WebGL

`rajada-controlador.mjs` aceita os efeitos já carregados e oferece `atualizar(dtEmSegundos)`, `finalizado` e `cancelar()`. Ele orienta a frente +Z para o destino, aplica escala ao corpo, move o centro de origem a destino, para o projétil na chegada e toca o impacto uma única vez.

```js
import { criarRajada } from '/efeitos/effekseer/Rajada-Corte-Azul/rajada-controlador.mjs';

// Carregue previamente os três .efkefc separados com context.loadEffect().
const de = centroCasa(casaInicial.l, casaInicial.c);
const ate = centroCasa(casaInicial.l, casaInicial.c + 3);
const rajada = criarRajada({
  context,
  efeitos: { disparo: efeitoDisparo, projetil: efeitoProjetil, impacto: efeitoImpacto },
  origem: de,
  destino: ate,
  altura: 0.8,
  escala: 0.8,
  duracao: 0.5,
  atraso: 0.1,
  aoChegar: () => resolverContato(),
});

// No tick do jogo:
rajada.atualizar(deltaEmSegundos);
// O context.update()/draw() continua pertencendo ao renderizador do jogo.
```

Verifique limites do tabuleiro e a regra de alcance antes de criar a rajada. O controlador recebe posições mundiais, não regras de combate. O tempo de voo suportado é de até 1,3 s, dentro da vida do projétil independente. O helper foi testado no runtime WebGL; a resolução de contato no exemplo deve ser substituída pela lógica da sua skill.

## Tocador atual do SugoiGame

O jogo usa o adaptador Three.js `frontend/src/tabuleiro/cena/efk.ts`, que recebe `efeito.json`, convertido pelo script `frontend/scripts/efeitos/efk_converter.py`. Os projetos nativos deste pack podem passar pelo mesmo conversor. Exemplo, executado na pasta `frontend`:

```powershell
python scripts/efeitos/efk_converter.py public/efeitos/effekseer/Rajada-Corte-Azul/Rajada_Corte_Azul_Projetil.efkproj rajada-corte-azul-projetil
```

Repita para disparo e impacto com nomes distintos. O helper `.mjs` usa a API nativa do Effekseer; no tocador Three.js, reproduza seu movimento atualizando o grupo do projétil e usando as mesmas posições de origem e destino. A ligação ao cadastro de skills, conversão e validação visual no combate atual não fazem parte deste pack.

## Verificação

Os quatro efeitos foram exportados no Effekseer 1.80.7 e renderizados no runtime WebGL em três ângulos. Foram verificados: movimento da rajada, partículas com sementes diferentes, encerramento sem resíduos, percurso controlado de origem a destino e chegada única. O preview contém somente os assets e um piso de teste; não representa uma integração já executada no combate do jogo.
