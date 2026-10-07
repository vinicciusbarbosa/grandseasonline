# Laser contínuo do Kizaru

O personagem carrega luz na ponta do dedo e dispara um laser que fica aceso
em linha reta. A carga reúne partículas e ganha brilho; o disparo tem um clarão
curto, seguido pelo núcleo branco, halo dourado uniforme e reflexos que correm
ao longo do feixe. O pacote contém apenas os efeitos de luz.

Caminho público: `/efeitos/effekseer/Kizaru-Laser-de-Luz/`.
Manter `Model/` e `Texture/` ao lado dos `.efkefc`. Os `.efkproj` são editáveis
no Effekseer 1.80.7; os `.efk` são exportações binárias legadas.

## Arquivos e encaixes

| Efeito | Origem e eixo | Duração |
| --- | --- | --- |
| `Kizaru_Laser_Carga_Dedo` | Ponta do dedo | Contínua até `stop()` |
| `Kizaru_Laser_Continuo` | Ponta do dedo; frente `+Z`; comprimento padrão 8 | Contínua até `stop()` |
| `Kizaru_Laser_Disparo` | Ponta do dedo; frente `+Z` | Cerca de 0,35 segundo |
| `Kizaru_Laser_Contato` | Ponto confirmado de contato; laser vindo de `-Z` | Contínuo até `stop()` |

As raízes permanecem fixas. A posição e a rotação mundial vêm do código do
jogo. Os modelos do núcleo e do halo têm um único quadro: a linha não dobra,
não oscila e não se desloca. Os reflexos e as partículas têm animação interna.

## Controlador opcional

Carregar os efeitos uma vez e passar as referências ao módulo:

```js
import { criarLaserContinuo } from
  '/efeitos/effekseer/Kizaru-Laser-de-Luz/laser-controlador.js';

// Referências carregadas por contexto.loadEffect(...):
const habilidade = criarLaserContinuo(contexto, {
  carga: efeitoCarga,
  laser: efeitoLaser,
  disparo: efeitoDisparo,
  contato: efeitoContato // opcional
}, {
  origem: [dedoMundo.x, dedoMundo.y, dedoMundo.z],
  direcao: [direcao.x, direcao.y, direcao.z],
  comprimento: 8,
  largura: 1,
  tempoCarga: 0.9
});

// Durante cada atualização, antes de atualizar o Effekseer:
habilidade.posicionar(
  [dedoMundo.x, dedoMundo.y, dedoMundo.z],
  [direcao.x, direcao.y, direcao.z],
  distanciaAteContatoOuAlcanceMaximo,
  contatoConfirmado
);
habilidade.atualizar(deltaSegundos);

// Ao soltar a habilidade, interromper o ataque ou remover o personagem:
// habilidade.encerrar();
```

O controlador aceita a direção como vetor XYZ e a normaliza. `estado` retorna
`carregando`, `disparando` ou `encerrado`. Ao terminar a carga, ele encerra a carga,
cria o clarão e mantém o laser contínuo. A duração da fase de laser é definida
pelo jogo, chamando `encerrar()` no momento desejado. O controlador não atualiza
nem desenha o contexto do Effekseer.

Definir o comprimento pela distância até o primeiro contato confirmado ou pelo
alcance máximo. O brilho de contato aparece somente quando `contatoConfirmado`
é verdadeiro. O laser é visual: o combate do jogo confirma colisão e aplica dano.

## Uso manual

Os efeitos podem ser controlados separadamente. Manter carga e clarão do disparo
na posição mundial da ponta do dedo. Ao disparar, encerrar a carga, iniciar o
clarão e o laser, e acompanhar o dedo enquanto o feixe estiver ativo.

```js
const laser = contexto.play(efeitoLaser, dedo.x, dedo.y, dedo.z);
// direcao é um vetor unitário; ângulos em radianos.
laser.setRotation(-Math.asin(direcao.y), Math.atan2(direcao.x, direcao.z), 0);
laser.setScale(largura, largura, comprimento / 8);
// Em cada atualização: laser.setLocation(dedo.x, dedo.y, dedo.z);
// Ao terminar: laser.stop();
```

A escala Z controla o comprimento. As escalas X e Y controlam a espessura do
laser; usar o mesmo valor em ambas. Para carga, clarão e contato, usar escala
uniforme. A escala de cada efeito pode ser ajustada à proporção do seu personagem.

## Brilho e prévia

O núcleo branco usa geometria em volume e os halos usam faixas cruzadas, para
o laser continuar visível de outros ângulos. O glow está nos próprios assets,
com transparência aditiva e sem escrita de profundidade. A prévia foi renderizada
pelo Effekseer WebGL sem bloom externo. O jogo pode acrescentar bloom.

O pacote de modelos ocupa cerca de 3,5 MiB. Carregar e reutilizar os efeitos;
encerrar carga, laser e contato quando a habilidade terminar.

Na demonstração, a carga dura 0,9 segundo e o laser permanece aceso por cerca
de 1,6 segundo. Esses tempos são definidos pelo script da prévia; o asset
contínuo não contém esse limite. A prévia principal mostra o feixe no ar.
Há também uma conferência separada do efeito de contato. Nenhum personagem
é criado. As prévias ficam fora da pasta pública do jogo.
