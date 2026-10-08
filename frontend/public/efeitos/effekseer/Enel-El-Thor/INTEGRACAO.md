# El Thor do Enel

Descarga de plasma branco com halo ciano e azul, faixas curvas de energia,
ramificações elétricas que piscam e se regeneram, pressão no ar e impacto
com clarão, faíscas e ondas no chão. As raízes permanecem fixas; o código
do jogo define os encaixes. O pacote contém apenas os efeitos.

Caminho público: `/efeitos/effekseer/Enel-El-Thor/`.
Manter `Model/` e `Texture/` junto dos `.efkefc`. Os `.efkproj` são editáveis
no Effekseer 1.80.7; os `.efk` são exportações binárias legadas.

## Arquivos

| Efeito | Encaixe | Comportamento |
| --- | --- | --- |
| `Enel_El_Thor` | Origem na emissão; frente `+Z` | Carga de 0,5 s, descarga e impacto na extremidade, a 8 unidades |
| `Enel_El_Thor_Carga` | Origem na mão | Carga contínua, encerrada por `stop()` |
| `Enel_El_Thor_Descarga` | Origem na emissão; frente `+Z` | Descarga de aproximadamente 0,75 s; comprimento padrão 8 |
| `Enel_El_Thor_Impacto` | Origem no ponto de impacto; `+Y` para cima | Clarão, arcos e dissipação por aproximadamente 1,15 s |
| `Enel_El_Thor_Celeste` | Origem no chão | Carga a 8 unidades de altura, descarga para baixo e impacto na raiz |

As sequências completas terminam dentro de 2 segundos. As durações supõem
60 quadros de atualização do Effekseer por segundo. O loop do editor serve
para repetir a prévia; os efeitos completos são finitos no runtime.

## Encaixe manual na mão

Carregar e reutilizar os arquivos com `contexto.loadEffect(...)`. Ao começar
a habilidade, criar a carga e atualizar sua posição mundial junto da mão:

```js
const carga = contexto.play(efeitoCarga, mao.x, mao.y, mao.z);
// Durante a carga:
carga.setLocation(mao.x, mao.y, mao.z);

// Ao disparar, no tempo definido pelo jogo:
carga.stop();
const descarga = contexto.play(efeitoDescarga, mao.x, mao.y, mao.z);
// direcao é um vetor unitário; os ângulos do runtime são em radianos.
descarga.setRotation(-Math.asin(direcao.y), Math.atan2(direcao.x, direcao.z), 0);
descarga.setScale(largura, largura, comprimento / 8);

// O jogo confirma o contato e posiciona o impacto independentemente:
const impacto = contexto.play(efeitoImpacto, contato.x, contato.y, contato.z);
impacto.setScale(escalaImpacto, escalaImpacto, escalaImpacto);
```

Usar o mesmo valor para X e Y na descarga. Z controla o alcance. A escala Z
também alonga suas ramificações e faixas. Para preservar essas proporções,
usar escala uniforme e adaptar o alcance da habilidade no jogo.

O impacto separado mantém as ondas no plano XZ. Em terrenos inclinados,
orientar o impacto conforme a normal da superfície. Em alvos no ar, o jogo
pode usar somente a descarga ou modificar o `.efkproj` para remover as ondas
de chão. O asset é visual; colisão e dano são controlados pelo combate.

Na sequência `Enel_El_Thor`, a descarga nasce no quadro 30 e o impacto no
quadro 31, em `(0, 0, 8)`. A orientação do impacto acompanha a raiz dessa
sequência. Para direção e contato independentes, usar os arquivos separados.

## Variante celeste

```js
const celeste = contexto.play(efeitoCeleste, alvoChao.x, alvoChao.y, alvoChao.z);
// Escala uniforme altera altura, largura e área juntas:
celeste.setScale(escala, escala, escala);
```

A raiz da variante celeste fica no chão, com Y para cima. A descarga parte de
Y=8, aponta para baixo e termina na raiz. Para altura e área independentes,
posicionar uma carga e uma descarga separadas acima do alvo; girar a descarga
com `setRotation(Math.PI / 2, 0, 0)` e usar sua escala Z para a altura desejada.

## Acabamento e recursos

O corpo usa interpolação Catmull–Rom e 65 amostras ao longo do feixe. As faixas
que envolvem a descarga usam 81 amostras. Os raios de partículas são Ribbons
nativos com seis subdivisões de spline por trecho, regeneração rápida e um
perfil luminoso que suaviza as bordas. As ondas e a erupção também têm curvas
densamente amostradas. O glow usa transparência aditiva e não escreve profundidade.

A prévia foi renderizada no Effekseer WebGL sem bloom externo. O brilho está
nos assets; o jogo pode adicionar bloom. Os sete modelos animados totalizam
aproximadamente 59 MiB no disco. São dependências compartilhadas entre os
cinco efeitos. Carregar os efeitos usados pela habilidade uma vez e reutilizá-los.

As prévias ficam fora da pasta pública do jogo. Elas mostram o efeito horizontal,
a variante celeste e a carga, sem personagem nem cenário modelado.
