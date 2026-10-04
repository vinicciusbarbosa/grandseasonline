# Yasakani no Magatama no jogo

O pacote contém só os efeitos. O personagem, a subida para o ar, a pose das
mãos, os alvos, as colisões e o dano pertencem ao jogo.

Carregue os cinco `.efkefc` desta pasta mantendo `Texture/` e `Model/` junto deles.
O caminho público do pacote é `/efeitos/effekseer/Kizaru-Yasakani-no-Magatama/`.

## Sequência sugerida

1. O jogo coloca o personagem no ar e entra na pose da habilidade.
2. Cria uma instância de `Kizaru_Yasakani_Carga_Mao` em cada mão. Atualiza a
   posição de cada efeito com a posição mundial da mão durante a animação.
3. Deixa carregar por aproximadamente 0,5 a 0,75 s.
4. Inicia uma rajada alternada ou simultânea entre as duas mãos. Para uma
   rajada densa como a prévia, cria duas bolas a cada 0,05 s durante 1,4 s.
   A quantidade é uma escolha do jogo; o efeito não impõe esse valor.
5. Para cada bola, cria `Kizaru_Yasakani_Projetil` na mão, orienta seu +Z para
   o alvo e move a instância por código. Cria `Kizaru_Yasakani_Disparo` na palma.
6. Na colisão, encerra a bola e cria `Kizaru_Yasakani_Impacto` no ponto de contato.
7. Encerra as duas cargas quando terminar a rajada. Encerra também bolas que
   excederem o alcance ou forem canceladas pelo sistema de combate.

## Encaixe das mãos

`Carga_Mao` tem a origem no centro do clarão, sem deslocamento de altura.
Use-a nos sockets/ossos das mãos, ou nos pontos mundiais equivalentes da pose.
Isso permite que o seu personagem se mova e voe sem reconstruir o efeito.

`Carga_Dupla` oferece uma formação pronta com duas cargas, mas não acompanha
ossos individuais. Serve para prévia ou para um personagem com pose fixa que
coincida com os deslocamentos locais documentados no LEIA-ME.

## Orientação do projétil no runtime WebGL

Exemplo de uso dos handles; adapte `efeitos`, `mao`, `alvo` e o controle do
tempo ao código do projeto. As posições abaixo são mundiais. Os ângulos
passados a `setRotation` são em radianos.

```js
const dx = alvo.x - mao.x;
const dy = alvo.y - mao.y;
const dz = alvo.z - mao.z;
const distancia = Math.hypot(dx, dy, dz);

if (distancia > 0.0001) {
  const direcao = { x: dx / distancia, y: dy / distancia, z: dz / distancia };
  const bala = contexto.play(efeitos.projetil, mao.x, mao.y, mao.z);
  bala.setRotation(-Math.asin(direcao.y), Math.atan2(direcao.x, direcao.z), 0);

  // Em cada atualização do jogo, velocidade em unidades por segundo:
  // posicao += direcao * velocidade * deltaSegundos;
  // bala.setLocation(posicao.x, posicao.y, posicao.z);

  // Na colisão:
  // bala.stop();
  // contexto.play(efeitos.impacto, contato.x, contato.y, contato.z);
}
```

A atualização do contexto Effekseer e suas matrizes de câmera seguem a
integração do jogo. O exemplo não muda a câmera nem aplica dano.

## Escala e brilho

A bola tem um corpo com cerca de 0,47 unidade de diâmetro e 0,79 unidade de
comprimento, além da cauda e do halo. Para um personagem de duas unidades de
altura, começar com escala uniforme de 0,7 a 1,0 e ajustar no jogo.

O halo tem transparência aditiva e não escreve profundidade. O núcleo da bola
é volumétrico; os clarões e parte do halo se orientam para a câmera. Há glow
visível mesmo sem um pós-processamento de bloom. A câmera da prévia usa somente
o runtime de efeitos, sem bloom adicional.

As cargas e bolas têm emissão contínua e devem ser encerradas pelo jogo.
O disparo e o impacto se dissipam sozinhos. `Loop` no editor é a repetição da
prévia; não deve ser usado pelo jogo para repetir impactos automaticamente.

As imagens e GIFs de demonstração ficam fora da pasta de assets do jogo.
