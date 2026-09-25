import type { Vetor } from '../mundo/Mundo'

/**
 * Redemoinho no coração da tempestade. Quatro anéis, de fora para dentro:
 *
 *   borda    (< raio)     a água gira e puxa: o navio fica pesado de manobrar
 *   arrasto  (< arrasto)  o puxão vence o leme aos poucos
 *   captura  (< captura)  o jogador perde o controle; o navio gira para dentro
 *   centro   (< centro)   o navio se parte
 *
 * Raios em células; a física trabalha em px do mundo.
 */
export type Redemoinho = {
  cx: number
  cy: number
  raio: number
  arrasto: number
  captura: number
  centro: number
}

export const REDEMOINHOS: readonly Redemoinho[] = [{ cx: 158, cy: 97, raio: 11, arrasto: 7, captura: 4.2, centro: 0.7 }]

export type Zona = 'fora' | 'borda' | 'arrasto' | 'captura' | 'centro'

export type Influencia = {
  zona: Zona
  /** Distância ao centro, em px. */
  distancia: number
  /** 0 na borda de fora, 1 no centro. */
  profundidade: number
  /** Velocidade que a água impõe (giro + sucção), em px/s. */
  correnteza: Vetor
  /** Direção tangente (sentido do giro), em radianos. */
  tangente: number
  centro: Vetor
}

/** Sentido do giro: anti-horário na tela. */
const SENTIDO = -1

export function influenciaRedemoinho(p: Vetor, celula: number): Influencia | null {
  for (const r of REDEMOINHOS) {
    const cx = r.cx * celula
    const cy = r.cy * celula
    const dx = p.x - cx
    const dy = p.y - cy
    const d = Math.hypot(dx, dy)
    const raio = r.raio * celula
    if (d > raio) continue

    const profundidade = 1 - d / raio
    let zona: Zona = 'borda'
    if (d < r.centro * celula) zona = 'centro'
    else if (d < r.captura * celula) zona = 'captura'
    else if (d < r.arrasto * celula) zona = 'arrasto'

    // Giro mais rápido perto do centro; sucção cresce devagar e depois dispara.
    const radial = { x: -dx / Math.max(d, 1), y: -dy / Math.max(d, 1) }
    const tangencial = { x: -radial.y * SENTIDO, y: radial.x * SENTIDO }
    // Já na borda a água puxa de verdade; perto do centro, gira muito rápido.
    // A força entra suave na borda de fora (sem degrau).
    const entrada = Math.min(1, profundidade / 0.15)
    const giro = (30 + 120 * Math.pow(profundidade, 1.4)) * entrada
    const succao = (14 + 60 * Math.pow(profundidade, 1.6)) * entrada
    return {
      zona,
      distancia: d,
      profundidade,
      correnteza: {
        x: tangencial.x * giro + radial.x * succao,
        y: tangencial.y * giro + radial.y * succao,
      },
      tangente: Math.atan2(tangencial.y, tangencial.x),
      centro: { x: cx, y: cy },
    }
  }
  return null
}
