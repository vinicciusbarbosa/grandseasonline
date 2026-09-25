/**
 * Balanço do navio nas ondas. É só visual: mexe no "ShipVisual", nunca na
 * posição lógica.
 *
 * Cada navio soma várias senoides com sementes próprias, e uma envoltória lenta
 * modula a amplitude — assim há momentos de quase calmaria e momentos de
 * balanço forte, e o movimento nunca se repete de forma reconhecível.
 */
export type PerfilOnda = {
  fase: number[]
}

export type Balanco = {
  /** Subida/descida, -1..1 aproximadamente. */
  altura: number
  /** Rolagem (inclinação lateral), em graus. */
  rolagem: number
  /** Arfagem (proa sobe/desce), em graus. */
  arfagem: number
}

/** Estado do mar por região: amplitude e irregularidade das ondas. */
export type EstadoMar = { amplitude: number; irregularidade: number }

export const MAR_CALMO: EstadoMar = { amplitude: 0.35, irregularidade: 0.2 }
export const MAR_MODERADO: EstadoMar = { amplitude: 1, irregularidade: 0.5 }
export const MAR_TEMPESTADE: EstadoMar = { amplitude: 2.2, irregularidade: 1 }

export function criarPerfilOnda(semente: number): PerfilOnda {
  const fase: number[] = []
  let s = semente * 9301 + 49297
  for (let i = 0; i < 8; i++) {
    s = (s * 9301 + 49297) % 233280
    fase.push((s / 233280) * Math.PI * 2)
  }
  return { fase }
}

export function balanco(perfil: PerfilOnda, t: number, mar: EstadoMar, sensibilidade: number): Balanco {
  const [a, b, c, d, e, f, g, h] = perfil.fase
  // Envoltória: grupos de ondas maiores chegam e passam.
  const grupo = 0.55 + 0.45 * Math.sin(t * 0.13 + g) * Math.sin(t * 0.071 + h)
  const k = mar.amplitude * sensibilidade * grupo
  const irr = mar.irregularidade

  const altura =
    (Math.sin(t * 0.8 + a) * 0.5 + Math.sin(t * 1.7 + b) * 0.24 * (1 + irr) + Math.sin(t * 0.31 + c) * 0.62) * k

  const rolagem = (Math.sin(t * 1.1 + d) * 1.8 + Math.sin(t * 0.47 + e) * 0.9 + Math.sin(t * 2.3 + f) * 0.5 * irr) * k

  const arfagem = (Math.sin(t * 0.9 + e) * 1.1 + Math.sin(t * 1.9 + a) * 0.5 * irr) * k

  return { altura, rolagem, arfagem }
}
