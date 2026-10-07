# Yata no Kagami

O pacote contém o efeito completo e peças separadas para controlar a trajetória.
Todos os efeitos são de luz e permanecem com a raiz fixa na origem local.
O personagem, a colisão e o dano ficam sob controle do jogo.

Caminho público: `/efeitos/effekseer/Kizaru-Yata-no-Kagami/`.
Manter `Model/` e `Texture/` ao lado dos `.efkefc`. Os `.efkproj` são as versões
editáveis para o Effekseer 1.80.7; os `.efk` são exportações binárias legadas.

## Sequência completa

Carregar `Kizaru_Yata_no_Kagami.efkefc` e iniciar a instância no local do impacto
final no chão. A luz começa ao lado desse ponto, sobe em quatro trechos que
alternam a direção, faz quatro reflexões, concentra no ápice e mergulha.
A explosão tem um clarão branco/dourado, raios que se expandem, três ondas no
chão e partículas que se dissipam.

| Ponto relativo à raiz | XYZ local | Momento a 60 fps |
| --- | --- | --- |
| Emissão | `(-1.65, 0.65, 0)` | Carga inicial |
| Reflexão 1 | `(2.10, 2.15, 0.08)` | Quadro 22 |
| Reflexão 2 | `(-2.15, 3.65, -0.08)` | Quadro 34 |
| Reflexão 3 | `(2.05, 5.15, 0.06)` | Quadro 46 |
| Reflexão 4 / ápice | `(0, 6.65, 0)` | Quadro 58 |
| Impacto no chão | `(0, 0, 0)` | Quadro 72 |

A quarta reflexão é a mudança de direção que prepara a descida. Há uma
concentração curta no alto, entre os quadros 58 e 66; o mergulho dura seis
quadros (0,1 segundo). As ondas e as partículas desaparecem em seguida.
O efeito completo se encerra em cerca de 2,5 segundos. Pode haver uma diferença
de aproximadamente um quadro na primeira atualização do runtime.

Y é o eixo vertical. O zigue-zague ocorre principalmente no plano XY.
Girar a instância em Y para orientar esse plano na cena; escala uniforme
altera a largura, a altura e o tamanho da explosão juntos. A altura padrão
é 6,65 unidades acima do chão. Ajustar a escala ao tamanho do seu personagem.

```js
const instancia = contexto.play(efeitoCompleto, alvo.x, alvo.y, alvo.z);
instancia.setRotation(0, anguloHorizontal, 0); // radianos
instancia.setScale(escala, escala, escala);
// Para interromper a habilidade:
// instancia.stop();
```

## Pontos definidos pelo jogo

| Peça | Encaixe e comportamento |
| --- | --- |
| `Kizaru_Yata_Feixe_Trecho` | Origem no começo do trecho; fim em `+Z = 1`; contínuo até `stop()` |
| `Kizaru_Yata_Reflexo` | Origem no ponto que rebate; clarão curto com centelhas e anel luminoso |
| `Kizaru_Yata_Explosao` | Origem no chão; dura cerca de 1,3 segundo |

Carregar as três peças uma vez. O módulo `yata-controlador.js` usa seis pontos
mundiais: emissão, quatro reflexões e impacto. O quarto ponto de reflexão é
o ápice da trajetória. Para uma descida vertical, usar os mesmos X e Z no
ápice e no impacto. O módulo replica os tempos da sequência e permite cancelar
todas as instâncias criadas. Não atualiza o contexto nem cria personagem.

```js
import { criarYataPersonalizado } from
  '/efeitos/effekseer/Kizaru-Yata-no-Kagami/yata-controlador.js';

// efeitos.feixe, efeitos.reflexo e efeitos.explosao já estão carregados.
const habilidade = criarYataPersonalizado(contexto, efeitos, [
  [mao.x, mao.y, mao.z],
  [alvo.x+2.1, alvo.y+2.15, alvo.z],
  [alvo.x-2.15, alvo.y+3.65, alvo.z],
  [alvo.x+2.05, alvo.y+5.15, alvo.z],
  [alvo.x, alvo.y+6.65, alvo.z],
  [alvo.x, alvo.y, alvo.z]
]);

// Durante a atualização normal do jogo, antes de atualizar o Effekseer:
habilidade.atualizar(deltaSegundos);
// O loop do jogo atualiza contexto e desenha os efeitos normalmente.
// Interrupção: habilidade.cancelar();
```

O evento visual do impacto ocorre 1,2 segundo após o início. Aplicar dano apenas
quando o combate confirmar o contato. O módulo é uma referência visual para
a trajetória; pode ser adaptado à sincronização e à rede do jogo.

Para orientar manualmente um trecho, usando um vetor de direção normalizado:

```js
feixe.setLocation(inicio.x, inicio.y, inicio.z);
feixe.setRotation(-Math.asin(direcao.y), Math.atan2(direcao.x, direcao.z), 0);
feixe.setScale(largura, largura, comprimento);
```

## Brilho e recursos

O núcleo branco e o halo dourado são feitos de faixas cruzadas em volume,
visíveis de outros ângulos. Os clarões se orientam para a câmera. Os halos
usam transparência aditiva, sem escrita de profundidade. O glow está nos
próprios assets; a prévia foi renderizada sem bloom externo.

O pacote de modelos ocupa aproximadamente 29,2 MiB e é compartilhado pelos
quatro efeitos. Carregar e reutilizar os efeitos; medir o desempenho na cena
real conforme a quantidade de instâncias. A sequência completa tem a trajetória
local gravada nos modelos animados. Para caminhos diferentes, usar as peças
separadas e o controlador, em vez de mover a raiz do efeito completo.

As prévias e ferramentas de geração ficam fora da pasta pública do jogo.
