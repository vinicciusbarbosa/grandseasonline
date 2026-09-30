/** Ruído 256×256 que se repete sem emenda (R, G grossos; B fino), sem depender de Phaser. */
export const LADO_RUIDO = 256
const LADO = LADO_RUIDO

/** Os pixels RGBA (LADO×LADO) da textura de ruído — também usados pelo mar 3D. */
export function dadosRuido() {
  const dados = new Uint8Array(LADO * LADO * 4)
  const r = fbm(LADO, [8, 16, 32, 64], 1)
  const g = fbm(LADO, [4, 8, 16, 32], 2)
  const b = fbm(LADO, [16, 32, 64, 128], 3)
  for (let i = 0; i < LADO * LADO; i++) {
    dados[i * 4] = r[i]
    dados[i * 4 + 1] = g[i]
    dados[i * 4 + 2] = b[i]
    dados[i * 4 + 3] = 255
  }
  return dados
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
