import Phaser from 'phaser'
import { dadosRuido, LADO_RUIDO } from './dadosRuido'

const LADO = LADO_RUIDO

/**
 * Textura de ruído 256×256 que se repete sem emenda: três canais com
 * ruídos diferentes (R e G grossos, B fino). O shader lê daqui em vez de
 * calcular ruído por pixel — é a principal diferença de desempenho.
 *
 * Tamanho potência de 2 para o WebGL aceitar repetição (REPEAT).
 */
export function criarTexturaRuido(cena: Phaser.Scene, chave: string) {
  if (cena.textures.exists(chave)) return
  const textura = cena.textures.createCanvas(chave, LADO, LADO)!
  const ctx = textura.getContext()
  const imagem = ctx.createImageData(LADO, LADO)
  imagem.data.set(dadosRuido())
  ctx.putImageData(imagem, 0, 0)
  textura.refresh()
  // Linear é essencial: com filtro "nearest" o ruído vira mancha de pixel.
  textura.setFilter(Phaser.Textures.FilterMode.LINEAR)
}
