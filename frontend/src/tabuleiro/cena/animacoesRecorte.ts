import type { NomeAnim } from './personagem'

/**
 * Animações do boneco recortado, em quadros-chave (como numa timeline do
 * Flash/Spine): em cada instante `t` (0 a 1 da animação), o ângulo de cada
 * peça em graus — positivo = para a frente (para onde o personagem olha);
 * nas canelas e antebraços é relativo ao osso de cima (joelho/cotovelo
 * dobrando para trás = negativo na canela, positivo no antebraço).
 * `dx`/`dy`: deslocamento do corpo todo (px da arte; dx positivo = para a
 * frente, dy positivo = para baixo); `sx`/`sy`: estica/achata o corpo a
 * partir do pé; `<peça>.e`: encurta o membro ao longo do osso (em 3/4, o
 * braço indo para a frente fica mais curto). Entre as chaves, curva suave.
 */

export type Pose = Partial<Record<string, number>>
export type Chave = { t: number; pose: Pose }

/** valor de descanso: ângulos e deslocamentos 0, escalas 1 */
const repouso = (nome: string) => (nome.endsWith('.e') || nome === 'sx' || nome === 'sy' ? 1 : 0)

/** chave espelhada (perna/braço de perto ↔ de longe), para os ciclos */
function trocarLados(p: Pose): Pose {
  const r: Pose = {}
  for (const [k, v] of Object.entries(p)) r[k.includes('_perto') ? k.replace('_perto', '_longe') : k.includes('_longe') ? k.replace('_longe', '_perto') : k] = v
  return r
}

// Andar: contato → desce (recebe o peso) → passagem → sobe, e o mesmo com a
// outra perna. Braços balançam pouco e encurtam ao ir para a frente (3/4).
const ANDAR_MEIO: Chave[] = [
  { t: 0, pose: { coxa_perto: 17, canela_perto: -3, coxa_longe: -15, canela_longe: -12, braco_perto: -9, 'braco_perto.e': 1, antebraco_perto: 10, braco_longe: 9, 'braco_longe.e': 0.95, antebraco_longe: 16, tronco: 4, cabeca: -2, dy: 1 } },
  { t: 0.125, pose: { coxa_perto: 11, canela_perto: -7, coxa_longe: -17, canela_longe: -28, braco_perto: -6, antebraco_perto: 12, braco_longe: 6, antebraco_longe: 14, tronco: 5, cabeca: -3, dy: 3.5, sy: 0.985 } },
  { t: 0.25, pose: { coxa_perto: -1, canela_perto: 0, coxa_longe: 5, canela_longe: -42, braco_perto: 0, antebraco_perto: 10, braco_longe: 0, antebraco_longe: 10, tronco: 4, cabeca: -2, dy: -2.5, sy: 1.01 } },
  { t: 0.375, pose: { coxa_perto: -10, canela_perto: 0, coxa_longe: 14, canela_longe: -22, braco_perto: 6, antebraco_perto: 14, braco_longe: -6, antebraco_longe: 10, tronco: 4, cabeca: -2, dy: -1 } },
]
const ANDAR: Chave[] = [...ANDAR_MEIO, ...ANDAR_MEIO.map((c) => ({ t: c.t + 0.5, pose: trocarLados(c.pose) }))]

// Correr: corpo inclinado, antebraços dobrados, fase no ar (dy negativo)
const CORRER_MEIO: Chave[] = [
  { t: 0, pose: { coxa_perto: 34, canela_perto: -8, coxa_longe: -24, canela_longe: -45, braco_perto: -28, 'braco_perto.e': 0.95, antebraco_perto: 95, 'antebraco_perto.e': 0.85, braco_longe: 26, antebraco_longe: 100, 'antebraco_longe.e': 0.85, tronco: 14, cabeca: -9, dy: 2, sy: 0.98 } },
  { t: 0.25, pose: { coxa_perto: 4, canela_perto: -14, coxa_longe: 18, canela_longe: -100, braco_perto: 0, antebraco_perto: 90, 'antebraco_perto.e': 0.85, braco_longe: 0, antebraco_longe: 95, 'antebraco_longe.e': 0.85, tronco: 13, cabeca: -8, dy: -9, sy: 1.02 } },
]
const CORRER: Chave[] = [...CORRER_MEIO, ...CORRER_MEIO.map((c) => ({ t: c.t + 0.5, pose: trocarLados(c.pose) }))]

const PARADO: Chave[] = [
  { t: 0, pose: { braco_perto: 2, antebraco_perto: 7, braco_longe: -2, antebraco_longe: 8 } },
  { t: 0.5, pose: { tronco: 1.2, cabeca: -1.5, braco_perto: 3, antebraco_perto: 10, braco_longe: -3, antebraco_longe: 11, dy: 0.6, sy: 1.012 } },
]

const NEUTRO: Pose = PARADO[0].pose

export const ANIMACOES: Record<NomeAnim, Chave[]> = {
  parado: PARADO,
  andar: ANDAR,
  correr: CORRER,
  // derrapando: corpo para trás, perna da frente esticada
  frear: [
    { t: 0, pose: CORRER[0].pose },
    { t: 0.2, pose: { tronco: -12, cabeca: 4, coxa_perto: 30, canela_perto: 0, coxa_longe: -20, canela_longe: -28, braco_perto: -18, antebraco_perto: 45, braco_longe: -24, antebraco_longe: 45, dy: 4, sy: 0.97 } },
    { t: 0.75, pose: { tronco: -7, cabeca: 3, coxa_perto: 24, canela_perto: 0, coxa_longe: -16, canela_longe: -22, braco_perto: -10, antebraco_perto: 30, braco_longe: -14, antebraco_longe: 30, dy: 3 } },
    { t: 1, pose: NEUTRO },
  ],
  // parada brusca: o corpo vai para a frente e volta
  parar: [
    { t: 0, pose: ANDAR[0].pose },
    { t: 0.35, pose: { tronco: 9, cabeca: 4, coxa_perto: 14, coxa_longe: -10, canela_longe: -14, braco_perto: 14, braco_longe: 10, antebraco_perto: 28, antebraco_longe: 28, dy: 2, sy: 0.98 } },
    { t: 0.7, pose: { tronco: -3, cabeca: -2, braco_perto: -3, braco_longe: -3, sy: 1.01 } },
    { t: 1, pose: NEUTRO },
  ],
  // soco com o braço da frente: antecipa (recua, encolhe), golpeia esticando
  // (impacto no quadro 6 de 12 = t 0,5), segura e volta
  atacar: [
    { t: 0, pose: NEUTRO },
    { t: 0.16, pose: { tronco: -5, braco_perto: -14, antebraco_perto: 60, 'antebraco_perto.e': 0.92, braco_longe: 12, antebraco_longe: 70, dx: -2, dy: 1, sy: 0.985 } },
    { t: 0.38, pose: { tronco: -12, cabeca: 5, braco_perto: -32, 'braco_perto.e': 0.88, antebraco_perto: 118, 'antebraco_perto.e': 0.85, braco_longe: 24, antebraco_longe: 105, 'antebraco_longe.e': 0.9, coxa_perto: 8, coxa_longe: -10, canela_longe: -14, dx: -5, dy: 3, sx: 1.02, sy: 0.96 } },
    { t: 0.5, pose: { tronco: 17, cabeca: -6, braco_perto: 72, 'braco_perto.e': 0.9, antebraco_perto: 4, 'antebraco_perto.e': 1.06, braco_longe: -16, antebraco_longe: 122, 'antebraco_longe.e': 0.9, coxa_perto: 26, canela_perto: -6, coxa_longe: -22, canela_longe: -18, dx: 15, dy: 1, sx: 1.04, sy: 0.98 } },
    { t: 0.64, pose: { tronco: 14, cabeca: -5, braco_perto: 66, 'braco_perto.e': 0.92, antebraco_perto: 10, braco_longe: -12, antebraco_longe: 115, 'antebraco_longe.e': 0.9, coxa_perto: 24, canela_perto: -6, coxa_longe: -20, canela_longe: -16, dx: 13, dy: 1 } },
    { t: 1, pose: NEUTRO },
  ],
  // leva o golpe: tranco para trás (achata), cabeça jogada e volta
  dano: [
    { t: 0, pose: NEUTRO },
    { t: 0.1, pose: { tronco: -18, cabeca: -16, braco_perto: 24, antebraco_perto: 40, braco_longe: 28, antebraco_longe: 36, coxa_perto: 8, coxa_longe: -6, dx: -10, dy: 2, sx: 0.95, sy: 1.03 } },
    { t: 0.4, pose: { tronco: -8, cabeca: -5, braco_perto: 10, antebraco_perto: 20, braco_longe: 12, antebraco_longe: 20, coxa_perto: 5, dx: -6, sy: 0.99 } },
    { t: 1, pose: NEUTRO },
  ],
}

const suave = (k: number) => k * k * (3 - 2 * k)

/** Pose no instante `fase` (0 a 1); em laço, a última chave emenda na primeira. */
export function poseEm(chaves: Chave[], fase: number, laco: boolean): Pose {
  const n = chaves.length
  let i = n - 1
  while (i > 0 && chaves[i].t > fase) i--
  const a = chaves[i]
  const b = i + 1 < n ? chaves[i + 1] : laco ? { t: 1, pose: chaves[0].pose } : a
  const k = b === a ? 0 : suave(Math.min(1, Math.max(0, (fase - a.t) / (b.t - a.t))))
  const pose: Pose = {}
  for (const nome of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) pose[nome] = (a.pose[nome] ?? repouso(nome)) * (1 - k) + (b.pose[nome] ?? repouso(nome)) * k
  return pose
}
