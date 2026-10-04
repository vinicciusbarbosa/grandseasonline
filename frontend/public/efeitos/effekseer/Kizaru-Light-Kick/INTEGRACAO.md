# Light Kick no sugoigame

Os assets contêm apenas efeitos de luz. Use o seu personagem e a animação de
chute do jogo. O voo/avanço, a pose, as colisões e o dano são controlados pelo jogo.

Caminho público: `/efeitos/effekseer/Kizaru-Light-Kick/`.
Manter as pastas `Model/` e `Texture/` ao lado dos quatro `.efkefc`.

## Encaixes e eixos

| Efeito | Origem | Orientação | Duração |
| --- | --- | --- | --- |
| `Kizaru_Light_Kick_Carga_Pe` | Tornozelo/pé que chuta | +Y aponta do pé para a canela | Contínuo; encerrar por código |
| `Kizaru_Light_Kick_Rastro` | Pé ou ponto do avanço | +Z na direção do avanço; cauda em -Z | Contínuo; encerrar por código |
| `Kizaru_Light_Kick_Arco` | Centro da varredura do chute | Y para cima, +Z para o alvo, plano principal YZ | Cerca de 0,55 s |
| `Kizaru_Light_Kick_Impacto` | Ponto real do contato | Clarão orientado para a câmera | Cerca de 0,6 s |

As raízes dos arquivos permanecem na origem. Partículas, filamentos e varredura
têm animação interna. Não há uma trajetória de personagem gravada nos assets.

## Sequência de uso

1. Iniciar `Carga_Pe` na preparação do chute e acompanhar a posição mundial do
   pé em cada atualização. Orientar +Y conforme a direção da canela na pose.
2. No avanço rápido, criar `Rastro`, orientar +Z para a direção do avanço e mover
   sua origem com o personagem/pé pelo código. Encerrar ao terminar o avanço.
3. No começo da varredura da perna, criar `Arco` no centro do movimento. Para um
   personagem de duas unidades de altura, um ponto cerca de 1,1 unidade acima
   dos pés serve como referência inicial; ajustar à sua animação de chute.
4. Criar `Impacto` no contato confirmado pelo combate, sincronizado com o frame
   da animação que aplica o chute. O avanço principal do arco dura cerca de
   9 quadros a 60 fps; isso é uma referência visual, não uma regra de dano.
5. Encerrar `Carga_Pe` após o contato/fim do chute. Encerrar também carga e rastro
   se a habilidade for interrompida ou cancelada. Arco e impacto se dissipam.

## Orientação básica no runtime WebGL

Com um vetor unitário de avanço `direcao`, a orientação do rastro pode ser:

```js
rastro.setRotation(
  -Math.asin(direcao.y),
  Math.atan2(direcao.x, direcao.z),
  0
);
rastro.setLocation(peMundo.x, peMundo.y, peMundo.z);
```

Os ângulos de `setRotation` são em radianos. Ajustar a carga à orientação real
do osso do tornozelo: os eixos do rig podem ser diferentes dos eixos do efeito.
Para um arco de chute vertical em direção horizontal, aplicar apenas o yaw:

```js
arco.setRotation(0, Math.atan2(direcao.x, direcao.z), 0);
```

Uma pose de chute lateral pode exigir que o jogo gire também o plano do arco.
O asset é independente do rig e permite esse ajuste na instância.

## Escala e brilho

A luz da carga se estende de Y=-0,17 a aproximadamente Y=0,87, com halo além
desse volume. Isso representa luz ao redor do tornozelo e parte da canela.
Não é um modelo de membro; o membro visível será o do personagem do jogo.

Começar em escala uniforme próxima de 1 para um personagem de duas unidades
de altura. Ajustar a carga, o arco e o impacto separadamente conforme a pose.
O impacto tem um clarão amplo; reduzir sua escala se o golpe for mais discreto.

O núcleo e os filamentos são volumétricos ou feitos de faixas cruzadas para
continuarem visíveis por outros ângulos. Os clarões se orientam para a câmera.
Os halos usam transparência aditiva, sem escrita de profundidade. O brilho
da prévia está nos próprios assets; o jogo pode acrescentar bloom.

Carregar os quatro efeitos uma vez e reutilizar as referências. O pacote de
modelos animados tem aproximadamente 20,1 MiB. A medição de desempenho deve
ser feita na cena final e na quantidade de instâncias prevista para o combate.

As prévias e o script de demonstração ficam fora da pasta de assets do jogo.
Na demonstração, um script movimenta a carga e o rastro e aciona arco/impacto.
Nenhum personagem é criado para demonstrar ou executar a skill.
