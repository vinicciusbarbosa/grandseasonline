# Haki do Rei imbuído

Emissão de Haki fluindo ao redor do corpo e explosão no contato de um ataque.
O fluxo ocupa o volume de um personagem imaginário; o impacto abre descargas
em várias direções. Os raios têm núcleo negro, bordas vermelhas luminosas,
glow, pontas dissipadas e bifurcações. Não há personagem dentro do pacote.

Caminho público: `/efeitos/effekseer/Haki-Rei-Imbuido/`.
Manter `Model/` e `Texture/` ao lado dos `.efkefc`. Fontes `.efkproj` editáveis
no Effekseer 1.80.7; arquivos `.efk` para o formato binário legado.

## Arquivos e encaixes

| Efeito | Origem | Duração visual aproximada |
| --- | --- | --- |
| `Haki_Rei_Imbuido_Fluxo` | Pés de quem ataca; `+Y` para cima | 0,65 s |
| `Haki_Rei_Imbuido_Impacto` | Ponto atingido no inimigo | 0,8 s, com o estouro concentrado no início |
| `Haki_Rei_Imbuido_Onda_Chao` | Solo sob o impacto; ondas no plano XZ | 0,7 s |
| `Haki_Rei_Imbuido_Demonstracao` | Centro da demonstração | Sequência completa de até 1,7 s |

Os tempos supõem 60 quadros de atualização do Effekseer por segundo. As
raízes permanecem fixas. O jogo posiciona os efeitos; a animação interna
fica por conta dos raios, faíscas, clarões e ondas de pressão.

## Ataque imbuído

Carregar uma vez os efeitos usados pela habilidade. No início da animação
do ataque, emitir o fluxo e acompanhar a posição dos pés de quem ataca:

```js
const fluxo = contexto.play(efeitoFluxo, pes.x, pes.y, pes.z);
// Volume padrão: aproximadamente 2 unidades de altura.
const escalaCorpo = alturaPersonagem / 2;
fluxo.setScale(escalaCorpo, escalaCorpo, escalaCorpo);

// Enquanto o atacante se desloca, durante essa emissão curta:
fluxo.setLocation(pes.x, pes.y, pes.z);
```

As origens dos raios são sorteadas em X=-0,4..0,4, Y=0,06..1,92 e
Z=-0,34..0,34, com direções e escalas variáveis. Isso distribui as descargas
pelo volume do corpo. Não exige ossos ou modelo dentro do efeito.

No instante em que o combate confirmar o contato, iniciar a explosão:

```js
const impacto = contexto.play(efeitoImpacto, contato.x, contato.y, contato.z);
impacto.setScale(escalaImpacto, escalaImpacto, escalaImpacto);

// Onda de chão opcional, usando a altura real do solo:
const onda = contexto.play(efeitoOndaChao, contato.x, alturaSolo, contato.z);
onda.setScale(escalaOnda, escalaOnda, escalaOnda);
```

O impacto tem origem no contato e pode acontecer no ar. A onda de chão é
separada para não criar um anel flutuando à altura do peito do inimigo.
Em superfícies inclinadas, orientar a onda pela normal do solo. Colisão,
dano, interrupções e eventuais tremores de câmera pertencem ao jogo.

O impacto principal alcança visualmente cerca de 4 a 5 unidades a partir
do contato, variando com as descargas. A onda de chão chega a aproximadamente
3,7 unidades. Usar escala uniforme para ajustar essas áreas. Elas não são
hitboxes. Em cancelamentos, chamar `fluxo.stop()`; os efeitos são finitos
e terminam sozinhos no uso normal.

## Demonstração

`Haki_Rei_Imbuido_Demonstracao` coloca o fluxo à esquerda, em X=-2,1.
No quadro 18 (0,3 s), coloca o impacto à direita, em X=2,1, Y=1,05,
e a onda de chão abaixo dele. É uma sequência pronta para conferir
as fases, com espaços vazios para os personagens do jogo. Para o combate,
usar os três arquivos separados e o tempo real da animação.

## Renderização e validação

Os raios são partículas Ribbon nativas com seis subdivisões de spline
por trecho. A textura `Haki_Negro_Vermelho.png` preserva o centro negro
com alpha blend normal; bordas e halos reforçam o vermelho. A pressão
usa dois modelos animados com arcos suaves. O glow está incluído e a
prévia foi renderizada sem bloom externo.

Os modelos somam aproximadamente 12,8 MiB e são compartilhados pelos
efeitos. A validação usa o runtime Effekseer WebGL em três ângulos,
sementes diferentes e quadros finais vazios. A prévia não mede desempenho
nem colisões dentro do combate do jogo.
