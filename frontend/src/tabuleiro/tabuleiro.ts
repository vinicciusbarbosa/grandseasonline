/**
 * Geometria e regras do tabuleiro de combate: 10×20, como no legado
 * (`render_tabuleiro` do combate.php), dividido em duas metades de 5×20 —
 * cada uma no convés de um navio, com um vão de água entre eles.
 *
 * Linha 0–4: navio de cima · linha 5–9: navio de baixo. Coluna 0–19.
 * No mundo 3D: X ao longo das colunas, Z para perto da câmera, Y para cima;
 * o piso do convés fica em y = 0 e cada casa mede 1.
 */

import type { TipoCasa } from './cena/texturas'

export const COLUNAS = 20
export const LINHAS = 10
export const METADE = 5
/** Distância entre os dois tabuleiros (a borda dos cascos + a água). */
export const VAO = 1.7

export type Casa = { l: number; c: number }

export function centroCasa(l: number, c: number) {
  const x = c - COLUNAS / 2 + 0.5
  const z = l < METADE ? -VAO / 2 - METADE + l + 0.5 : VAO / 2 + (l - METADE) + 0.5
  return { x, z }
}

/** Casa sob um ponto do convés (ou null fora do tabuleiro). */
export function casaEm(x: number, z: number): Casa | null {
  const c = Math.floor(x + COLUNAS / 2)
  if (c < 0 || c >= COLUNAS) return null
  let l: number
  if (z >= -VAO / 2 - METADE && z < -VAO / 2) l = Math.floor(z + VAO / 2 + METADE)
  else if (z >= VAO / 2 && z < VAO / 2 + METADE) l = METADE + Math.floor(z - VAO / 2)
  else return null
  return { l, c }
}

/** Tipo de cada casa de uma metade (5×20): madeira, amarela (borda) ou grade. */
export function tiposMetade(cima: boolean): TipoCasa[][] {
  const t: TipoCasa[][] = []
  const grades = cima
    ? [[1, 7], [3, 4], [2, 13], [4, 16]]
    : [[0, 6], [2, 10], [3, 3], [1, 15], [4, 12]]
  for (let l = 0; l < METADE; l++) {
    const linha: TipoCasa[] = []
    for (let c = 0; c < COLUNAS; c++) linha.push(c === 0 || c === COLUNAS - 1 ? 'amarela' : 'madeira')
    t.push(linha)
  }
  for (const [l, c] of grades) t[l][c] = 'grade'
  return t
}

export const vizinhos = (a: Casa): Casa[] =>
  [
    { l: a.l - 1, c: a.c },
    { l: a.l + 1, c: a.c },
    { l: a.l, c: a.c - 1 },
    { l: a.l, c: a.c + 1 },
  ].filter((v) => v.l >= 0 && v.l < LINHAS && v.c >= 0 && v.c < COLUNAS)

export const mesmaCasa = (a: Casa, b: Casa) => a.l === b.l && a.c === b.c

/** Casas alcançáveis em até `passos`, sem atravessar ocupadas. Guarda o caminho. */
export function alcance(de: Casa, passos: number, ocupada: (c: Casa) => boolean) {
  const chave = (c: Casa) => c.l * COLUNAS + c.c
  const veio = new Map<number, Casa | null>([[chave(de), null]])
  const dist = new Map<number, number>([[chave(de), 0]])
  const fila: Casa[] = [de]
  while (fila.length) {
    const a = fila.shift()!
    const d = dist.get(chave(a))!
    if (d >= passos) continue
    for (const v of vizinhos(a)) {
      const k = chave(v)
      if (dist.has(k) || ocupada(v)) continue
      dist.set(k, d + 1)
      veio.set(k, a)
      fila.push(v)
    }
  }
  const caminho = (ate: Casa): Casa[] | null => {
    if (!veio.has(chave(ate))) return null
    const cam: Casa[] = []
    let p: Casa | null = ate
    while (p && !mesmaCasa(p, de)) {
      cam.unshift(p)
      p = veio.get(chave(p)) ?? null
    }
    return cam
  }
  const casas = [...dist.keys()].filter((k) => k !== chave(de)).map((k) => ({ l: Math.floor(k / COLUNAS), c: k % COLUNAS }))
  return { casas, caminho }
}

/** Passo que atravessa o vão entre os navios (vira um pulo). */
export const cruzaVao = (a: Casa, b: Casa) => (a.l < METADE) !== (b.l < METADE)
