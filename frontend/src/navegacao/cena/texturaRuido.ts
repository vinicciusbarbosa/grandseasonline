import Phaser from 'phaser'
import { fbm } from './fbm'

const LADO = 256

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

  const r = fbm(LADO, [8, 16, 32, 64], 1)
  const g = fbm(LADO, [4, 8, 16, 32], 2)
  const b = fbm(LADO, [16, 32, 64, 128], 3)
  for (let i = 0; i < LADO * LADO; i++) {
    imagem.data[i * 4] = r[i]
    imagem.data[i * 4 + 1] = g[i]
    imagem.data[i * 4 + 2] = b[i]
    imagem.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imagem, 0, 0)
  textura.refresh()
  // Linear é essencial: com filtro "nearest" o ruído vira mancha de pixel.
  textura.setFilter(Phaser.Textures.FilterMode.LINEAR)
}
