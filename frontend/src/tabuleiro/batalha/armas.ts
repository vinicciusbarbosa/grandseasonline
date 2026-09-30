/**
 * Skills por tipo de arma (DESIGN.md): toda arma do mesmo tipo dá as mesmas
 * skills; a raridade (depois) muda o dano e dá skills extras. Mais as skills
 * de profissão (médico) e do Haki do Rei.
 *
 * Área de cada skill, a partir da casa escolhida como alvo:
 *   alvo  — só a casa;
 *   linha — a reta (ou diagonal) do atacante até o alcance, na direção do alvo;
 *   leque — a casa e as duas vizinhas de lado (perpendiculares ao tiro);
 *   volta — as 8 casas em volta do atacante (o alvo é ele mesmo);
 *   si    — só o próprio personagem (transformação, buff);
 *   explosao — um quadrado em volta da casa alvo (raio 1 = 3×3, 2 = 5×5).
 */

import type { Casa } from '../tabuleiro'

export type TipoArma = 'espada' | 'maca' | 'espingarda' | 'adaga'
export type Area = 'alvo' | 'linha' | 'leque' | 'volta' | 'si' | 'explosao'
export type Elemento = 'fogo' | 'gelo' | 'luz' | 'fumaca'

export type Skill = {
  id: string
  nome: string
  descricao: string
  energia: number
  /** distância máxima até a casa alvo (0 = em volta de si) */
  alcance: number
  area: Area
  /** multiplicador do dano (0 = não causa dano) */
  mult: number
  /** golpes seguidos no mesmo alvo */
  golpes?: number
  /** fração da defesa ignorada */
  ignoraDef?: number
  /** pontos a menos na esquiva do alvo */
  precisao?: number
  /** pontos a mais na chance de crítico */
  critico?: number
  /** cura em vez de dano (mira aliados) */
  cura?: number
  /** Zoan: transforma por N vezes (+ATK, +DEF) */
  transforma?: number
  /** raio da explosão (padrão 1) */
  raio?: number
  /** elemento (Logia): fogo vence gelo, etc. */
  elemento?: Elemento
  /** queimadura: dano no começo de cada vez do alvo */
  queima?: { dano: number; vezes: number }
  /** chance (0–1) de congelar (perde a próxima vez) */
  congela?: number
}

export const SKILLS_ARMA: Record<TipoArma, Skill[]> = {
  espada: [
    { id: 'corte', nome: 'Corte', descricao: 'Golpe de perto.', energia: 0, alcance: 1, area: 'alvo', mult: 1 },
    { id: 'corte-duplo', nome: 'Corte Duplo', descricao: 'Dois cortes seguidos (×0,65 cada).', energia: 12, alcance: 1, area: 'alvo', mult: 0.65, golpes: 2 },
    { id: 'corte-voador', nome: 'Corte Voador', descricao: 'Lâmina de ar em linha reta: acerta todos até 3 casas.', energia: 22, alcance: 3, area: 'linha', mult: 0.8 },
    { id: 'estocada-perfurante', nome: 'Estocada Perfurante', descricao: 'Atravessa 2 casas em linha e ignora 30% da defesa.', energia: 28, alcance: 2, area: 'linha', mult: 1, ignoraDef: 0.3 },
    { id: 'tornado-laminas', nome: 'Tornado de Lâminas', descricao: 'Gira cortando tudo em volta (×0,9).', energia: 40, alcance: 0, area: 'volta', mult: 0.9 },
  ],
  maca: [
    { id: 'pancada', nome: 'Pancada', descricao: 'Golpe de perto.', energia: 0, alcance: 1, area: 'alvo', mult: 1.1 },
    { id: 'esmagar', nome: 'Esmagar', descricao: 'Golpe pesado que ignora 40% da defesa.', energia: 18, alcance: 1, area: 'alvo', mult: 1.4, ignoraDef: 0.4 },
    { id: 'onda-choque', nome: 'Onda de Choque', descricao: 'Bate no chão: acerta as 8 casas em volta.', energia: 28, alcance: 0, area: 'volta', mult: 0.7 },
    { id: 'tremor', nome: 'Tremor', descricao: 'Racha o convés em linha reta até 3 casas.', energia: 30, alcance: 3, area: 'linha', mult: 0.85 },
    { id: 'martelada-titanica', nome: 'Martelada Titânica', descricao: 'Golpe enorme num alvo (×2,1).', energia: 45, alcance: 1, area: 'alvo', mult: 2.1 },
  ],
  espingarda: [
    { id: 'tiro', nome: 'Tiro', descricao: 'Tiro a até 5 casas.', energia: 0, alcance: 5, area: 'alvo', mult: 0.9 },
    { id: 'tiro-certeiro', nome: 'Tiro Certeiro', descricao: 'Mira com calma a até 7 casas: mais dano e difícil de esquivar.', energia: 18, alcance: 7, area: 'alvo', mult: 1.2, precisao: 20 },
    { id: 'chumbo-grosso', nome: 'Chumbo Grosso', descricao: 'Espalha: a casa e as duas do lado, a até 4 casas.', energia: 25, alcance: 4, area: 'leque', mult: 0.65 },
    { id: 'rajada', nome: 'Rajada', descricao: 'Três tiros rápidos a até 5 casas (×0,45 cada).', energia: 30, alcance: 5, area: 'alvo', mult: 0.45, golpes: 3 },
    { id: 'tiro-perfurante', nome: 'Tiro Perfurante', descricao: 'Bala que atravessa todos em linha até 6 casas.', energia: 40, alcance: 6, area: 'linha', mult: 0.85 },
  ],
  adaga: [
    { id: 'estocada', nome: 'Estocada', descricao: 'Golpe de perto.', energia: 0, alcance: 1, area: 'alvo', mult: 0.85 },
    { id: 'corte-rapido', nome: 'Corte Rápido', descricao: 'Dois golpes rápidos (×0,55 cada).', energia: 10, alcance: 1, area: 'alvo', mult: 0.55, golpes: 2 },
    { id: 'arremesso', nome: 'Arremesso', descricao: 'Joga a adaga a até 3 casas.', energia: 15, alcance: 3, area: 'alvo', mult: 0.7 },
    { id: 'golpe-vital', nome: 'Golpe Vital', descricao: 'Mira um ponto fraco: +35% de chance de crítico.', energia: 25, alcance: 1, area: 'alvo', mult: 1, critico: 35 },
    { id: 'danca-laminas', nome: 'Dança das Lâminas', descricao: 'Gira cortando as 8 casas em volta (×0,6).', energia: 35, alcance: 0, area: 'volta', mult: 0.6 },
  ],
}

/** Skill de profissão (médico): cura um aliado perto. */
export const PRIMEIROS_SOCORROS: Skill = {
  id: 'primeiros-socorros',
  nome: 'Primeiros Socorros',
  descricao: 'Cura 35 de vida de um aliado a até 2 casas.',
  energia: 25,
  alcance: 2,
  area: 'alvo',
  mult: 0,
  cura: 35,
}

/**
 * Akuma no Mi de teste (uma de cada tipo). A árvore da fruta vem depois;
 * aqui só as skills e a passiva de cada uma.
 */
export type TipoAkuma = 'logia' | 'zoan' | 'paramecia'
export const FRUTAS: Record<string, { nome: string; tipo: TipoAkuma; elemento?: Elemento; passiva: string; skills: Skill[] }> = {
  fumaca: {
    nome: 'Fruta da Fumaça',
    tipo: 'logia',
    elemento: 'fumaca',
    passiva: 'Intangível: golpes sem Haki de armamento atravessam (gasta carga).',
    skills: [
      { id: 'nuvem-fumaca', nome: 'Nuvem de Fumaça', descricao: 'Fumaça que sufoca: a casa e as duas do lado, a até 2 casas.', energia: 20, alcance: 2, area: 'leque', mult: 0.6, elemento: 'fumaca' },
      { id: 'prisao-fumaca', nome: 'Prisão de Fumaça', descricao: 'Nuvem 3×3 a até 3 casas.', energia: 35, alcance: 3, area: 'explosao', mult: 0.55, elemento: 'fumaca' },
    ],
  },
  fogo: {
    nome: 'Fruta do Fogo',
    tipo: 'logia',
    elemento: 'fogo',
    passiva: 'Intangível. Fogo vence gelo: atinge a Logia de gelo mesmo sem Haki.',
    skills: [
      { id: 'punho-fogo', nome: 'Punho de Fogo', descricao: 'Punho de chamas a até 4 casas; queima (6 por vez, 2 vezes).', energia: 20, alcance: 4, area: 'alvo', mult: 1.1, elemento: 'fogo', queima: { dano: 6, vezes: 2 } },
      { id: 'imperador-chamas', nome: 'Imperador das Chamas', descricao: 'Explosão 3×3 a até 4 casas; queima.', energia: 45, alcance: 4, area: 'explosao', mult: 0.9, elemento: 'fogo', queima: { dano: 5, vezes: 2 } },
    ],
  },
  luz: {
    nome: 'Fruta da Luz',
    tipo: 'logia',
    elemento: 'luz',
    passiva: 'Intangível. Velocidade da luz: seus golpes não podem ser esquivados (só com observação).',
    skills: [
      { id: 'raio-luz', nome: 'Raio de Luz', descricao: 'Feixe em linha reta até 6 casas.', energia: 22, alcance: 6, area: 'linha', mult: 0.9, elemento: 'luz', precisao: 100 },
      { id: 'chuva-luz', nome: 'Chuva de Luz', descricao: 'Chuva de raios 3×3 a até 5 casas.', energia: 45, alcance: 5, area: 'explosao', mult: 0.8, elemento: 'luz', precisao: 100 },
    ],
  },
  gelo: {
    nome: 'Fruta do Gelo',
    tipo: 'logia',
    elemento: 'gelo',
    passiva: 'Intangível. Congela: o alvo pode perder a próxima vez.',
    skills: [
      { id: 'lanca-gelo', nome: 'Lança de Gelo', descricao: 'Lança a até 4 casas; 25% de congelar.', energia: 20, alcance: 4, area: 'alvo', mult: 1, elemento: 'gelo', congela: 0.25 },
      { id: 'era-gelo', nome: 'Era do Gelo', descricao: 'Congela uma área 5×5 a até 3 casas; 40% de congelar.', energia: 50, alcance: 3, area: 'explosao', raio: 2, mult: 0.55, elemento: 'gelo', congela: 0.4 },
    ],
  },
  borracha: {
    nome: 'Fruta da Borracha',
    tipo: 'paramecia',
    passiva: 'Corpo de borracha: metade do dano de maça (contundente) e de tiros.',
    skills: [
      { id: 'pistola', nome: 'Pistola', descricao: 'Soco esticado a até 3 casas.', energia: 15, alcance: 3, area: 'alvo', mult: 1 },
      { id: 'metralhadora', nome: 'Metralhadora', descricao: 'Chuva de socos: 4 golpes (×0,4 cada).', energia: 30, alcance: 1, area: 'alvo', mult: 0.4, golpes: 4 },
    ],
  },
  bisao: {
    nome: 'Fruta do Bisão',
    tipo: 'zoan',
    passiva: 'Forma híbrida: mais força e defesa enquanto transformado.',
    skills: [{ id: 'forma-hibrida', nome: 'Forma Híbrida', descricao: 'Transforma por 3 vezes: +30% de ataque, +10 de defesa.', energia: 30, alcance: 0, area: 'si', mult: 0, transforma: 3 }],
  },
}

export const distancia = (a: Casa, b: Casa) => Math.max(Math.abs(a.l - b.l), Math.abs(a.c - b.c))

/** Casas atingidas por uma skill usada de `de` mirando `alvo`. */
export function casasDaArea(s: Skill, de: Casa, alvo: Casa): Casa[] {
  const dl = Math.sign(alvo.l - de.l)
  const dc = Math.sign(alvo.c - de.c)
  switch (s.area) {
    case 'alvo':
      return [alvo]
    case 'linha': {
      const r: Casa[] = []
      for (let k = 1; k <= s.alcance; k++) r.push({ l: de.l + dl * k, c: de.c + dc * k })
      return r
    }
    case 'leque': {
      // perpendicular à direção do tiro
      const [pl, pc] = dl !== 0 && dc !== 0 ? [dl, -dc] : [dc, dl]
      return [alvo, { l: alvo.l + pl, c: alvo.c + pc }, { l: alvo.l - pl, c: alvo.c - pc }]
    }
    case 'si':
      return [de]
    case 'explosao': {
      const r: Casa[] = []
      const k = s.raio ?? 1
      for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) r.push({ l: alvo.l + a, c: alvo.c + b })
      return r
    }
    case 'volta': {
      const r: Casa[] = []
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) r.push({ l: de.l + a, c: de.c + b })
      return r
    }
  }
}

/** A casa alvo é válida para essa skill? (linha: só reta ou diagonal) */
export function alvoValido(s: Skill, de: Casa, alvo: Casa) {
  const d = distancia(de, alvo)
  if (s.area === 'volta' || s.area === 'si') return d === 0
  if (d === 0 || d > s.alcance) return false
  if (s.area === 'linha') return alvo.l === de.l || alvo.c === de.c || Math.abs(alvo.l - de.l) === Math.abs(alvo.c - de.c)
  return true
}

/** Elemento que atinge a Logia do outro mesmo sem Haki (fogo derrete gelo). */
export const VENCE: Partial<Record<Elemento, Elemento[]>> = { fogo: ['gelo'] }
