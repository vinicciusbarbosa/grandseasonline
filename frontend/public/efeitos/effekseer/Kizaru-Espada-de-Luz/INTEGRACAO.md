# Espada de luz do Kizaru

Carregar `/efeitos/effekseer/Kizaru-Espada-de-Luz/Kizaru_Espada_de_Luz.efkefc`.
As pastas `Model/` e `Texture/` devem acompanhar o arquivo. O `.efkproj` é a
versão editável para o Effekseer 1.80.7; o `.efk` é a exportação binária legada.

## Encaixe

| Referência | Coordenada local |
| --- | --- |
| Centro da empunhadura / origem para anexar à mão | `(0, 0, 0)` |
| Centro da guarda circular | `(0, 0.25, 0)` |
| Ponta da lâmina | `(0, 2.86, 0)` |
| Extremidade inferior da empunhadura | `(0, -0.30, 0)` |
| Direção da lâmina | `+Y` |

A raiz, a lâmina e a guarda permanecem fixas na pose local. O jogo acompanha a
posição mundial da mão, orienta a espada conforme o osso/encaixe e define a
escala. Não há trajetória de ataque ou personagem dentro do efeito.

O brilho fino acompanha as bordas retas da lâmina. Reflexos percorrem a lâmina,
pequenas centelhas cintilam e partículas se desprendem dela. Há uma pulsação
discreta na guarda e poeira luminosa ao redor. O efeito continua ativo até
ser encerrado pelo jogo.

## Runtime WebGL

Com `contexto` já inicializado, carregar uma vez e reutilizar o efeito:

```js
let espadaAtiva = null;
const efeitoEspada = contexto.loadEffect(
  '/efeitos/effekseer/Kizaru-Espada-de-Luz/Kizaru_Espada_de_Luz.efkefc',
  1,
  () => {
    espadaAtiva = contexto.play(efeitoEspada, mao.x, mao.y, mao.z);
    espadaAtiva.setScale(escala, escala, escala);
  }
);

// Executar durante a atualização da pose do personagem.
function acompanharMao(posicaoMundo, rotacaoXYZDoEncaixe) {
  if (!espadaAtiva) return;
  espadaAtiva.setLocation(posicaoMundo.x, posicaoMundo.y, posicaoMundo.z);
  espadaAtiva.setRotation(
    rotacaoXYZDoEncaixe.x,
    rotacaoXYZDoEncaixe.y,
    rotacaoXYZDoEncaixe.z
  );
}

function guardarEspada() {
  if (!espadaAtiva) return;
  espadaAtiva.stop();
  espadaAtiva = null;
}
```

Os ângulos são em radianos. A rotação passada precisa incluir a correção entre
o eixo da mão do seu rig e o eixo `+Y` da lâmina. Usar a transformação mundial
do encaixe, sem adicionar novamente o deslocamento do personagem.

A espada mede aproximadamente 3,16 unidades da base à ponta. Se quiser uma
espada com comprimento total de 1,6 unidade, começar com escala uniforme `0.5`.
Os clarões e o emblema circular da guarda se orientam para a câmera, como
elementos luminosos; a lâmina e a empunhadura usam geometria tridimensional.

## Brilho e arquivos

O halo está nos próprios assets, com transparência aditiva e sem escrita de
profundidade. A prévia foi renderizada pelo Effekseer WebGL sem bloom externo.
O jogo pode acrescentar bloom conforme a iluminação da cena.

Os cinco modelos da estrutura e dos halos são estáticos. Somente o modelo dos
reflexos contém 72 quadros de animação. O conjunto de modelos ocupa cerca de
1,1 MiB; as partículas são geradas pelo Effekseer. As prévias ficam fora da
pasta pública do jogo.

Referência visual fornecida: [Kizaru Light Sword, no Sketchfab](https://sketchfab.com/3d-models/kizaru-light-sword-4e42d56b01ec462195ba852a9e49ddeb).
As malhas e as máscaras luminosas deste pacote foram criadas para o efeito;
o modelo do link não foi baixado nem incluído.
