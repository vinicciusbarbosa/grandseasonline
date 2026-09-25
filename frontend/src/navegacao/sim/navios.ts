/**
 * Atributos de navegação, na escala 0–10 do dossiê. A conversão para unidades
 * físicas (px/s, graus/s) fica em `fisicaDoNavio`, num lugar só, para que o
 * balanceamento continue falando a língua do design.
 */
export type AtributosNavegacao = {
  maxSpeed: number
  acceleration: number
  deceleration: number
  turnRate: number
  driftFactor: number
  waveResistance: number
  windEfficiency: number
}

export type TipoNavio = 'pirata' | 'marinha'

export type ModeloNavio = {
  tipo: TipoNavio
  nome: string
  descricao: string
  atributos: AtributosNavegacao
}

export const NAVIOS: Record<TipoNavio, ModeloNavio> = {
  pirata: {
    tipo: 'pirata',
    nome: 'Brave Tide',
    descricao: 'Leve e ousado. Acelera rápido, curva fechado e sente mais o mar.',
    atributos: {
      maxSpeed: 8.5,
      acceleration: 7.5,
      deceleration: 6.8,
      turnRate: 8.2,
      driftFactor: 6.5,
      waveResistance: 5.5,
      windEfficiency: 7.2,
    },
  },
  marinha: {
    tipo: 'marinha',
    nome: 'Justice Crest',
    descricao: 'Pesado e firme. Curva largo, mas atravessa mar agitado sem balançar.',
    atributos: {
      maxSpeed: 7.8,
      acceleration: 6.2,
      deceleration: 6.5,
      turnRate: 5.7,
      driftFactor: 4.8,
      waveResistance: 8.4,
      windEfficiency: 6.1,
    },
  },
}

/** Os mesmos atributos, em unidades de simulação. */
export type FisicaNavio = {
  /** px/s */
  velocidadeMax: number
  /** px/s² */
  aceleracao: number
  /** px/s² */
  desaceleracao: number
  /** rad/s */
  giro: number
  /** Quão rápido a velocidade real alinha com a proa (1/s). Menor = mais deriva. */
  aderencia: number
  /** Multiplicador da amplitude das ondas no visual (1 = neutro). */
  sensibilidadeOnda: number
  /** 0–1: quanto do bônus/penalidade do vento o navio aproveita. */
  aproveitamentoVento: number
}

export function fisicaDoNavio(a: AtributosNavegacao): FisicaNavio {
  return {
    velocidadeMax: a.maxSpeed * 16,
    aceleracao: a.acceleration * 5,
    desaceleracao: a.deceleration * 6,
    giro: ((a.turnRate * 12) * Math.PI) / 180,
    aderencia: 6.5 - a.driftFactor * 0.55,
    sensibilidadeOnda: 1.55 - a.waveResistance * 0.1,
    aproveitamentoVento: a.windEfficiency / 10,
  }
}
