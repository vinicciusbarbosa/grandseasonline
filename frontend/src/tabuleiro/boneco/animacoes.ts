import type * as THREE from 'three'
import type { NomeOsso, ParamPano } from './boneco'

/** Qualquer esqueleto com os ossos do boneco (o boneco em si ou o proxy do VRM). */
export type Posavel = { raiz: THREE.Object3D; ossos: Record<NomeOsso, THREE.Object3D> }

/**
 * Animações dos capitães, quadro a quadro. Cada uma é uma função da fase
 * t (0–1) que posa os ossos; as de laço usam só senos com ciclos inteiros,
 * então o último quadro emenda no primeiro.
 *
 * Convenções (ossos pendurados para baixo): rotação X negativa leva a ponta
 * para a frente; no tronco, X positiva inclina para a frente.
 */

export type Extra = {
  capa: ParamPano
  abas: ParamPano
  /** janela de tempo (t) em que a ponta da espada deixa rastro */
  rastro?: { de: number; ate: number; forca: number }
  /** brilho carregando na lâmina (preparação do golpe) */
  brilho?: number
  /** a animação pede fumaça no pé neste quadro */
  poeira?: 'E' | 'D'
}

export type Animacao = {
  quadros: number
  fps: number
  laco: boolean
  /** quadro em que o golpe acerta (ataque) */
  impacto?: number
  pose: (b: Posavel, t: number) => Extra
}

const TAU = Math.PI * 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const suave = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

type Pose = Partial<Record<NomeOsso, [number, number, number]>> & { y?: number; frente?: number }

function aplicar(b: Posavel, p: Pose) {
  for (const [nome, v] of Object.entries(p)) {
    if (nome === 'y') b.ossos.quadril.position.y += v as number
    else if (nome === 'frente') b.raiz.translateZ(v as number)
    else {
      const [x, y, z] = v as [number, number, number]
      const o = b.ossos[nome as NomeOsso]
      o.rotation.x += x
      o.rotation.y += y
      o.rotation.z += z
    }
  }
}

function misturar(a: Pose, c: Pose, t: number): Pose {
  const r: Pose = {}
  const chaves = new Set([...Object.keys(a), ...Object.keys(c)])
  for (const k of chaves) {
    const va = (a as Record<string, unknown>)[k]
    const vc = (c as Record<string, unknown>)[k]
    if (k === 'y' || k === 'frente') {
      ;(r as Record<string, number>)[k] = lerp((va as number) ?? 0, (vc as number) ?? 0, t)
    } else {
      const x = (va as number[]) ?? [0, 0, 0]
      const y = (vc as number[]) ?? [0, 0, 0]
      ;(r as Record<string, number[]>)[k] = [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]
    }
  }
  return r
}

/** Interpola uma lista de poses-chave [t, pose] com suavização. */
function chaves(lista: [number, Pose][], t: number): Pose {
  if (t <= lista[0][0]) return lista[0][1]
  for (let i = 0; i < lista.length - 1; i++) {
    const [ta, pa] = lista[i]
    const [tb, pb] = lista[i + 1]
    if (t <= tb) return misturar(pa, pb, suave((t - ta) / (tb - ta)))
  }
  return lista[lista.length - 1][1]
}

/** Guarda: pernas abertas, espada baixa apontando para a frente. */
export const GUARDA: Pose = {
  y: -0.035,
  coxaE: [-0.14, 0, 0.12],
  canelaE: [0.2, 0, 0],
  peE: [-0.06, 0.25, -0.1],
  coxaD: [0.1, 0, -0.12],
  canelaD: [0.18, 0, 0],
  peD: [-0.2, -0.25, 0.1],
  tronco: [0.04, 0.18, 0],
  peito: [0, 0.06, 0],
  cabeca: [0, -0.2, 0],
  bracoE: [0.05, 0, 0.32],
  antebracoE: [-0.45, 0, 0],
  maoE: [0, 0, 0],
  bracoD: [-0.5, 0, -0.32],
  antebracoD: [-0.55, 0, 0],
  maoD: [0.25, 0, 0],
  espada: [0.9, 0.35, 0],
}

const panoParado = (t: number): ParamPano => ({ atras: 0.16, onda: 0.12, fase: t, lado: 0.12 })

export const ANIMACOES: Record<string, Animacao> = {
  parado: {
    quadros: 12,
    fps: 8,
    laco: true,
    pose(b, t) {
      const s = Math.sin(TAU * t)
      aplicar(b, GUARDA)
      aplicar(b, {
        y: -0.012 * (1 - Math.cos(TAU * t)) * 0.5,
        tronco: [-0.025 * s, 0, 0],
        peito: [-0.03 * s, 0, 0],
        cabeca: [0.03 * s, 0, 0],
        bracoE: [0, 0, 0.04 * s],
        bracoD: [0, 0, -0.03 * s],
        canelaE: [0.02 * (1 - Math.cos(TAU * t)), 0, 0],
        canelaD: [0.02 * (1 - Math.cos(TAU * t)), 0, 0],
      })
      return { capa: panoParado(t), abas: { atras: 0.06, onda: 0.05, fase: t, lado: 0.05 } }
    },
  },

  andar: {
    quadros: 12,
    fps: 15,
    laco: true,
    pose(b, t) {
      const p = TAU * t
      const s = Math.sin(p)
      const c = Math.cos(p)
      const coxaE = -0.5 * s
      const coxaD = 0.5 * s
      const canE = 0.08 + 0.85 * Math.max(0, c) ** 1.4
      const canD = 0.08 + 0.85 * Math.max(0, -c) ** 1.4
      aplicar(b, {
        y: -0.045 * (1 - Math.cos(2 * p)) * 0.5 + 0.01,
        coxaE: [coxaE, 0, 0.03],
        canelaE: [canE, 0, 0],
        peE: [-(coxaE + canE) * 0.7 + 0.05, 0, 0],
        coxaD: [coxaD, 0, -0.03],
        canelaD: [canD, 0, 0],
        peD: [-(coxaD + canD) * 0.7 + 0.05, 0, 0],
        tronco: [0.07, 0.1 * s, 0.02 * Math.cos(2 * p)],
        peito: [0, 0.06 * s, 0],
        cabeca: [-0.05, -0.12 * s, 0],
        bracoE: [0.42 * s, 0, 0.12],
        antebracoE: [-0.35 - 0.2 * Math.max(0, -s), 0, 0],
        bracoD: [-0.2 - 0.18 * s, 0, -0.14],
        antebracoD: [-0.5, 0, 0],
        maoD: [0.2, 0, 0],
        espada: [1.1, 0.25, 0],
      })
      return {
        capa: { atras: 0.38, onda: 0.2, fase: t * 2, lado: 0.12 },
        abas: { atras: 0.18, onda: 0.14, fase: t * 2, lado: 0.1 },
      }
    },
  },

  correr: {
    quadros: 12,
    fps: 24,
    laco: true,
    pose(b, t) {
      const p = TAU * t
      const s = Math.sin(p)
      // perna esquerda: coxa vai de -1.25 (joelho alto) a +0.7 (empurrando)
      const coxaE = -0.28 - 0.97 * s
      const coxaD = -0.28 + 0.97 * s
      const joelho = (fase: number) => 0.2 + 1.9 * Math.max(0, -Math.sin(fase - 0.75)) ** 1.25
      const canE = joelho(p)
      const canD = joelho(p + Math.PI)
      aplicar(b, {
        y: -0.07 - 0.06 * Math.cos(2 * p),
        coxaE: [coxaE, 0, 0.02],
        canelaE: [canE, 0, 0],
        peE: [-(coxaE + canE) * 0.45 + 0.25, 0, 0],
        coxaD: [coxaD, 0, -0.02],
        canelaD: [canD, 0, 0],
        peD: [-(coxaD + canD) * 0.45 + 0.25, 0, 0],
        tronco: [0.55, 0.16 * s, 0],
        peito: [0.08, 0.1 * s, 0],
        cabeca: [-0.55, -0.2 * s, 0],
        // braço livre bombeia com o cotovelo dobrado
        bracoE: [0.95 * s, 0, 0.12],
        antebracoE: [-1.45 + 0.25 * s, 0, 0],
        // braço da espada vai para trás, lâmina arrastando
        bracoD: [0.75 - 0.25 * s, 0, -0.22],
        antebracoD: [-0.35, 0, 0],
        maoD: [0.3, 0, 0],
        espada: [2.45, 0.3, 0],
      })
      return {
        capa: { atras: 1.25, onda: 0.34, fase: t * 2, lado: 0.28 },
        abas: { atras: 0.85, onda: 0.3, fase: t * 2, lado: 0.2 },
      }
    },
  },

  // parada brusca depois de correr: pé da frente arrasta, tranco para a frente
  frear: {
    quadros: 10,
    fps: 16,
    laco: false,
    pose(b, t) {
      const pose = chaves(
        [
          [0, {
            y: -0.14,
            coxaE: [-0.95, 0, 0.05], canelaE: [0.1, 0, 0], peE: [0.35, 0, 0],
            coxaD: [0.55, 0, -0.05], canelaD: [1.25, 0, 0], peD: [-0.6, 0, 0],
            tronco: [-0.28, 0.2, 0], peito: [-0.1, 0, 0], cabeca: [0.25, 0, 0],
            bracoE: [-1.0, 0, 0.55], antebracoE: [-0.4, 0, 0],
            bracoD: [0.5, 0, -0.5], antebracoD: [-0.3, 0, 0], maoD: [0.3, 0, 0], espada: [2.2, 0.3, 0],
          }],
          [0.28, {
            y: -0.16,
            coxaE: [-0.8, 0, 0.05], canelaE: [0.2, 0, 0], peE: [0.2, 0, 0],
            coxaD: [0.45, 0, -0.05], canelaD: [1.15, 0, 0], peD: [-0.5, 0, 0],
            tronco: [-0.2, 0.2, 0], peito: [-0.05, 0, 0], cabeca: [0.15, 0, 0],
            bracoE: [-1.3, 0, 0.7], antebracoE: [-0.3, 0, 0],
            bracoD: [0.2, 0, -0.7], antebracoD: [-0.3, 0, 0], maoD: [0.3, 0, 0], espada: [1.8, 0.3, 0],
          }],
          // o tranco: o corpo vai para a frente de uma vez
          [0.45, {
            y: -0.1,
            coxaE: [-0.45, 0, 0.08], canelaE: [0.35, 0, 0], peE: [0.05, 0, 0],
            coxaD: [0.25, 0, -0.08], canelaD: [0.6, 0, 0], peD: [-0.25, 0, 0],
            tronco: [0.42, 0.1, 0], peito: [0.12, 0, 0], cabeca: [-0.3, 0, 0],
            bracoE: [-0.4, 0, 0.35], antebracoE: [-0.9, 0, 0],
            bracoD: [-0.7, 0, -0.35], antebracoD: [-0.6, 0, 0], maoD: [0.3, 0, 0], espada: [1.0, 0.3, 0],
          }],
          [0.7, { ...GUARDA, tronco: [-0.06, 0.18, 0], y: -0.02 }],
          [1, GUARDA],
        ],
        t,
      )
      aplicar(b, pose)
      // o pano segue o embalo: vem para a frente e volta
      const atras = t < 0.45 ? lerp(1.2, -0.55, suave(t / 0.45)) : lerp(-0.55, 0.16, suave((t - 0.45) / 0.55))
      return {
        capa: { atras, onda: 0.25 * (1 - t), fase: t, lado: 0.2 * (1 - t) },
        abas: { atras: atras * 0.7, onda: 0.2 * (1 - t), fase: t, lado: 0.1 },
        poeira: t < 0.05 || (t > 0.25 && t < 0.35) ? 'E' : undefined,
      }
    },
  },

  // prepara (gira o corpo, espada lá atrás, lâmina carrega), corta, acompanha e volta
  atacar: {
    quadros: 16,
    fps: 18,
    laco: false,
    impacto: 7,
    pose(b, t) {
      const prep: Pose = {
        y: -0.1,
        coxaE: [-0.55, 0, 0.12], canelaE: [0.45, 0, 0], peE: [0.05, 0.2, 0],
        coxaD: [0.45, 0, -0.12], canelaD: [0.55, 0, 0], peD: [-0.2, -0.3, 0],
        tronco: [-0.05, 0.75, 0], peito: [0, 0.25, 0], cabeca: [0, -0.8, 0],
        bracoE: [-0.9, 0.2, 0.25], antebracoE: [-0.25, 0, 0],
        bracoD: [-2.5, 0, -0.35], antebracoD: [-0.9, 0, 0], maoD: [-0.2, 0, 0], espada: [0.6, 0.6, 0.3],
      }
      const meio: Pose = {
        ...prep,
        y: -0.14,
        tronco: [0.15, 0.05, 0], peito: [0.05, 0, 0], cabeca: [-0.1, -0.1, 0],
        bracoD: [-1.55, -0.3, -0.1], antebracoD: [-0.2, 0, 0], maoD: [0, 0, 0], espada: [1.3, 0.2, 0],
        bracoE: [-0.2, 0, 0.6], antebracoE: [-0.6, 0, 0],
        frente: 0.18,
      }
      const fim: Pose = {
        y: -0.2,
        coxaE: [-0.85, 0, 0.12], canelaE: [0.7, 0, 0], peE: [0.2, 0.2, 0],
        coxaD: [0.7, 0, -0.12], canelaD: [0.45, 0, 0], peD: [-0.3, -0.3, 0],
        tronco: [0.42, -0.65, 0], peito: [0.1, -0.25, 0], cabeca: [-0.3, 0.75, 0],
        bracoE: [0.35, 0, 0.75], antebracoE: [-0.5, 0, 0],
        bracoD: [-0.25, 0.3, 0.85], antebracoD: [-0.2, 0, 0], maoD: [0.2, 0, 0], espada: [1.4, -0.3, 0],
        frente: 0.34,
      }
      const pose = chaves(
        [
          [0, GUARDA],
          [0.26, prep],
          [0.38, { ...prep, tronco: [-0.08, 0.82, 0], bracoD: [-2.6, 0, -0.38] }],
          [0.44, meio],
          [0.5, fim],
          [0.68, { ...fim, y: -0.18, tronco: [0.36, -0.6, 0] }],
          [1, GUARDA],
        ],
        t,
      )
      aplicar(b, pose)
      const golpe = t >= 0.38 && t <= 0.62
      const vento = t > 0.38 ? Math.max(0, 1 - (t - 0.38) / 0.5) : 0
      return {
        capa: { atras: 0.16 + 0.7 * vento, onda: 0.15 + 0.2 * vento, fase: t * 2, lado: 0.15 + 0.3 * vento },
        abas: { atras: 0.06 + 0.5 * vento, onda: 0.1 + 0.2 * vento, fase: t * 2, lado: 0.1 + 0.2 * vento },
        rastro: golpe ? { de: 0.38, ate: Math.min(t, 0.5), forca: t <= 0.5 ? 1 : 1 - (t - 0.5) / 0.12 } : undefined,
        brilho: t > 0.16 && t < 0.4 ? clamp01((t - 0.16) / 0.12) : 0,
      }
    },
  },

  dano: {
    quadros: 8,
    fps: 16,
    laco: false,
    pose(b, t) {
      const k = Math.sin(Math.PI * clamp01(t / 0.7)) * (1 - t * 0.2)
      aplicar(b, GUARDA)
      aplicar(b, {
        y: -0.05 * k,
        tronco: [-0.45 * k, -0.2 * k, 0],
        peito: [-0.15 * k, 0, 0],
        cabeca: [-0.4 * k, 0, 0.1 * k],
        bracoE: [-0.6 * k, 0, 0.4 * k],
        bracoD: [-0.2 * k, 0, -0.4 * k],
        coxaE: [0.2 * k, 0, 0],
        canelaE: [0.2 * k, 0, 0],
        frente: -0.22 * k,
      })
      return {
        capa: { atras: -0.2 * k + 0.16, onda: 0.2, fase: t, lado: 0.2 * k },
        abas: { atras: -0.1 * k + 0.06, onda: 0.1, fase: t, lado: 0.1 * k },
      }
    },
  },
}
