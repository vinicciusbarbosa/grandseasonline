import { ruidoSuave } from './ruido'
import type { Vetor } from '../mundo/Mundo'

/**
 * Vento por zona do mar. O dossiê pede "direção, intensidade e variação
 * temporal": cada mar tem um regime base, e o ruído faz a direção girar
 * devagar (minutos) e a intensidade ter rajadas (segundos).
 */
export type EstadoVento = {
  /** Para onde o vento sopra, em radianos (0 = leste, sentido horário na tela). */
  direcao: number
  /** 0 a 1. */
  intensidade: number
  /** 0 a 1: quão instável está. */
  turbulencia: number
}

type Regime = {
  direcaoBase: number
  giro: number
  intensidadeBase: number
  rajada: number
  turbulencia: number
  /** Escala de tempo da mudança de direção: menor = muda mais devagar. */
  ritmo: number
}

const GRAUS = Math.PI / 180

const REGIMES: Record<number, Regime> = {
  // East Blue: vento de oeste, regular — o mar mais tranquilo, onde se começa.
  1: { direcaoBase: -10 * GRAUS, giro: 70 * GRAUS, intensidadeBase: 0.6, rajada: 0.25, turbulencia: 0.2, ritmo: 0.012 },
  2: { direcaoBase: 30 * GRAUS, giro: 60 * GRAUS, intensidadeBase: 0.6, rajada: 0.25, turbulencia: 0.25, ritmo: 0.012 },
  3: { direcaoBase: 160 * GRAUS, giro: 60 * GRAUS, intensidadeBase: 0.6, rajada: 0.25, turbulencia: 0.25, ritmo: 0.012 },
  4: { direcaoBase: 200 * GRAUS, giro: 60 * GRAUS, intensidadeBase: 0.6, rajada: 0.25, turbulencia: 0.25, ritmo: 0.012 },
  // Grand Line: muda o tempo todo e sem aviso.
  5: { direcaoBase: 90 * GRAUS, giro: 180 * GRAUS, intensidadeBase: 0.7, rajada: 0.35, turbulencia: 0.6, ritmo: 0.05 },
  6: { direcaoBase: 270 * GRAUS, giro: 180 * GRAUS, intensidadeBase: 0.8, rajada: 0.4, turbulencia: 0.8, ritmo: 0.07 },
  // Calm Belt: calmaria quase total.
  7: { direcaoBase: 0, giro: 180 * GRAUS, intensidadeBase: 0.04, rajada: 0.03, turbulencia: 0.05, ritmo: 0.02 },
}

export function ventoEm(mar: number, p: Vetor, tempo: number): EstadoVento {
  const r = REGIMES[mar] ?? REGIMES[1]
  // Um leve gradiente espacial evita que o mar inteiro vire junto, como um bloco.
  const deriva = (p.x * 0.00025 + p.y * 0.00018)
  const direcao = r.direcaoBase + r.giro * ruidoSuave(tempo * r.ritmo + deriva, mar)
  const intensidade = Math.min(
    1,
    Math.max(0, r.intensidadeBase + r.rajada * ruidoSuave(tempo * 0.18 + deriva * 3, mar + 5)),
  )
  return { direcao, intensidade, turbulencia: r.turbulencia }
}

/**
 * Multiplicador de velocidade pelo vento, contínuo em vez de por faixas.
 * Com vento forte e aproveitamento 0,7 ele passa por perto da tabela do dossiê:
 * 0° ≈ +15%, 45° ≈ +11%, 90° ≈ +2%, 135° ≈ -6%, 180° ≈ -10%.
 */
export function fatorDoVento(rumo: number, vento: EstadoVento, aproveitamento: number) {
  const alinhamento = Math.cos(rumo - vento.direcao)
  const efeito = 0.025 + 0.125 * alinhamento
  return 1 + efeito * vento.intensidade * (aproveitamento / 0.7)
}
