import Phaser from 'phaser'

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

/** Soma de ruídos de valor periódicos (cada período divide o lado, então emenda). */
function fbm(lado: number, periodos: number[], semente: number) {
  const soma = new Float32Array(lado * lado)
  let peso = 0.5
  let total = 0
  for (const periodo of periodos) {
    const grade = new Float32Array(periodo * periodo)
    let s = semente * 7919 + periodo * 104729
    for (let i = 0; i < grade.length; i++) {
      s = (s * 1103515245 + 12345) % 2147483648
      grade[i] = s / 2147483648
    }
    const passo = lado / periodo
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        const gx = x / passo
        const gy = y / passo
        const x0 = Math.floor(gx)
        const y0 = Math.floor(gy)
        const fx = suavizar(gx - x0)
        const fy = suavizar(gy - y0)
        const x1 = (x0 + 1) % periodo
        const y1 = (y0 + 1) % periodo
        const a = grade[y0 * periodo + x0]
        const b = grade[y0 * periodo + x1]
        const c = grade[y1 * periodo + x0]
        const d = grade[y1 * periodo + x1]
        soma[y * lado + x] += peso * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy)
      }
    }
    total += peso
    peso *= 0.5
  }
  const saida = new Uint8ClampedArray(lado * lado)
  for (let i = 0; i < soma.length; i++) saida[i] = (soma[i] / total) * 255
  return saida
}

function suavizar(t: number) {
  return t * t * (3 - 2 * t)
}
