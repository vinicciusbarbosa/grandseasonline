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
 *   explosao — um quadrado em volta da casa alvo (raio 1 = 3×3, 2 = 5×5);
 *   mapa  — o tabuleiro inteiro (só acerta inimigos; ex.: Ice Age).
 */

import type { Casa } from '../tabuleiro'

export type TipoArma = 'espada' | 'maca' | 'espingarda' | 'adaga'
export type Area = 'alvo' | 'linha' | 'leque' | 'volta' | 'si' | 'explosao' | 'mapa'
export type Elemento = 'fogo' | 'gelo' | 'luz' | 'fumaca'

export type Skill = {
  id: string
  nome: string
  descricao: string
  energia: number
  /** vezes da tripulação sem poder usar de novo (0 = sempre) */
  recarga?: number
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
  /** buff, transformação ou habilidade de profissão: não gasta o ataque da vez */
  livre?: boolean
  /** transforma/buff por N vezes: +30% de ataque (Zoan também +10 de defesa) */
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
    { id: 'corte-duplo', nome: 'Corte Duplo', descricao: 'Dois cortes seguidos (×0,65 cada).', energia: 12, recarga: 1, alcance: 1, area: 'alvo', mult: 0.65, golpes: 2 },
    { id: 'corte-voador', nome: 'Corte Voador', descricao: 'Lâmina de ar em linha reta: acerta todos até 3 casas.', energia: 22, recarga: 2, alcance: 3, area: 'linha', mult: 0.8 },
    { id: 'estocada-perfurante', nome: 'Estocada Perfurante', descricao: 'Atravessa 2 casas em linha e ignora 30% da defesa.', energia: 28, recarga: 2, alcance: 2, area: 'linha', mult: 1, ignoraDef: 0.3 },
    { id: 'tornado-laminas', nome: 'Tornado de Lâminas', descricao: 'Gira cortando tudo em volta (×0,9).', energia: 40, recarga: 3, alcance: 0, area: 'volta', mult: 0.9 },
  ],
  maca: [
    { id: 'pancada', nome: 'Pancada', descricao: 'Golpe de perto.', energia: 0, alcance: 1, area: 'alvo', mult: 1.1 },
    { id: 'esmagar', nome: 'Esmagar', descricao: 'Golpe pesado que ignora 40% da defesa.', energia: 18, recarga: 1, alcance: 1, area: 'alvo', mult: 1.4, ignoraDef: 0.4 },
    { id: 'onda-choque', nome: 'Onda de Choque', descricao: 'Bate no chão: acerta as 8 casas em volta.', energia: 28, recarga: 2, alcance: 0, area: 'volta', mult: 0.7 },
    { id: 'tremor', nome: 'Tremor', descricao: 'Racha o convés em linha reta até 3 casas.', energia: 30, recarga: 2, alcance: 3, area: 'linha', mult: 0.85 },
    { id: 'martelada-titanica', nome: 'Martelada Titânica', descricao: 'Golpe enorme num alvo (×2,1).', energia: 45, recarga: 3, alcance: 1, area: 'alvo', mult: 2.1 },
  ],
  espingarda: [
    { id: 'tiro', nome: 'Tiro', descricao: 'Tiro a até 5 casas.', energia: 0, alcance: 5, area: 'alvo', mult: 0.9 },
    { id: 'tiro-certeiro', nome: 'Tiro Certeiro', descricao: 'Mira com calma a até 7 casas: mais dano e difícil de esquivar.', energia: 18, recarga: 1, alcance: 7, area: 'alvo', mult: 1.2, precisao: 20 },
    { id: 'chumbo-grosso', nome: 'Chumbo Grosso', descricao: 'Espalha: a casa e as duas do lado, a até 4 casas.', energia: 25, recarga: 2, alcance: 4, area: 'leque', mult: 0.65 },
    { id: 'rajada', nome: 'Rajada', descricao: 'Três tiros rápidos a até 5 casas (×0,45 cada).', energia: 30, recarga: 2, alcance: 5, area: 'alvo', mult: 0.45, golpes: 3 },
    { id: 'tiro-perfurante', nome: 'Tiro Perfurante', descricao: 'Bala que atravessa todos em linha até 6 casas.', energia: 40, recarga: 3, alcance: 6, area: 'linha', mult: 0.85 },
  ],
  adaga: [
    { id: 'estocada', nome: 'Estocada', descricao: 'Golpe de perto.', energia: 0, alcance: 1, area: 'alvo', mult: 0.85 },
    { id: 'corte-rapido', nome: 'Corte Rápido', descricao: 'Dois golpes rápidos (×0,55 cada).', energia: 10, recarga: 1, alcance: 1, area: 'alvo', mult: 0.55, golpes: 2 },
    { id: 'arremesso', nome: 'Arremesso', descricao: 'Joga a adaga a até 3 casas.', energia: 15, recarga: 1, alcance: 3, area: 'alvo', mult: 0.7 },
    { id: 'golpe-vital', nome: 'Golpe Vital', descricao: 'Mira um ponto fraco: +35% de chance de crítico.', energia: 25, recarga: 2, alcance: 1, area: 'alvo', mult: 1, critico: 35 },
    { id: 'danca-laminas', nome: 'Dança das Lâminas', descricao: 'Gira cortando as 8 casas em volta (×0,6).', energia: 35, recarga: 3, alcance: 0, area: 'volta', mult: 0.6 },
  ],
}

/** Skill de profissão (médico): cura um aliado perto. */
export const PRIMEIROS_SOCORROS: Skill = {
  id: 'primeiros-socorros',
  nome: 'Primeiros Socorros',
  descricao: 'Cura 35 de vida de um aliado a até 2 casas (profissão: não gasta a vez).',
  energia: 25,
  recarga: 2,
  alcance: 2,
  area: 'alvo',
  mult: 0,
  cura: 35,
  livre: true,
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
      { id: 'nuvem-fumaca', nome: 'Nuvem de Fumaça', descricao: 'Fumaça que sufoca: a casa e as duas do lado, a até 2 casas.', energia: 20, recarga: 1, alcance: 2, area: 'leque', mult: 0.6, elemento: 'fumaca' },
      { id: 'prisao-fumaca', nome: 'Prisão de Fumaça', descricao: 'Nuvem 3×3 a até 3 casas.', energia: 35, recarga: 3, alcance: 3, area: 'explosao', mult: 0.55, elemento: 'fumaca' },
    ],
  },
  fogo: {
    nome: 'Fruta do Fogo (Mera Mera)',
    tipo: 'logia',
    elemento: 'fogo',
    passiva: 'Intangível. Fogo vence gelo: atinge a Logia de gelo mesmo sem Haki.',
    skills: [
      { id: 'hiken', nome: 'Punho de Fogo (Hiken)', descricao: 'Punho de fogo gigante a até 4 casas; queima. De perto, explode à queima-roupa; de longe, é arremessado.', energia: 20, recarga: 1, alcance: 4, area: 'alvo', mult: 1.15, elemento: 'fogo', queima: { dano: 6, vezes: 2 } },
      { id: 'hotarubi', nome: 'Vaga-lumes (Hotarubi)', descricao: 'Bolinhas verdes flutuam até a área 3×3 (até 4 casas) e explodem; queima.', energia: 30, recarga: 2, alcance: 4, area: 'explosao', mult: 0.7, elemento: 'fogo', queima: { dano: 5, vezes: 2 } },
      { id: 'higan', nome: 'Balas de Fogo (Higan)', descricao: 'Rajada de balas de fogo disparadas do dedo no alvo (até 3 casas); dano alto e queima.', energia: 30, recarga: 2, alcance: 3, area: 'alvo', mult: 1.5, elemento: 'fogo', queima: { dano: 8, vezes: 2 } },
      { id: 'corpo-chamas', nome: 'Corpo de Chamas (Agni)', descricao: 'Vira um espírito de fogo por 3 vezes: +30% de ataque (não gasta a vez).', energia: 25, recarga: 4, alcance: 0, area: 'si', mult: 0, transforma: 3, livre: true },
      { id: 'entei', nome: 'Entei', descricao: 'Sol de fogo gigante sobre a cabeça, arremessado: explode 5×5 a até 5 casas; queima.', energia: 55, recarga: 4, alcance: 5, area: 'explosao', raio: 2, mult: 1, elemento: 'fogo', queima: { dano: 8, vezes: 2 } },
    ],
  },
  luz: {
    nome: 'Fruta da Luz (Pika Pika)',
    tipo: 'logia',
    elemento: 'luz',
    passiva: 'Intangível. Velocidade da luz: seus golpes não podem ser esquivados (só com observação).',
    skills: [
      { id: 'yata', nome: 'Yata no Kagami', descricao: 'Vira um raio de luz: sobe rebatendo no ar e mergulha no chão numa área 3×3 a até 6 casas, explodindo.', energia: 35, recarga: 3, alcance: 6, area: 'explosao', mult: 1.2, elemento: 'luz', precisao: 100 },
      { id: 'yasakani', nome: 'Chuva de Joias (Yasakani no Magatama)', descricao: 'Cruza os braços, carrega luz nas mãos e dispara uma rajada de joias de luz numa área 3×3 a até 6 casas.', energia: 40, recarga: 3, alcance: 6, area: 'explosao', mult: 0.85, elemento: 'luz', precisao: 100 },
      { id: 'chute-luz', nome: 'Chute da Luz', descricao: 'Chute na velocidade da luz: vai até o alvo (até 6 casas) e volta.', energia: 25, recarga: 1, alcance: 6, area: 'alvo', mult: 1.25, elemento: 'luz', precisao: 100 },
      { id: 'raio-luz', nome: 'Raio de Luz', descricao: 'Feixe em linha reta até 6 casas.', energia: 22, recarga: 1, alcance: 6, area: 'linha', mult: 0.9, elemento: 'luz', precisao: 100 },
    ],
  },
  gelo: {
    nome: 'Fruta do Gelo (Hie Hie)',
    tipo: 'logia',
    elemento: 'gelo',
    passiva: 'Intangível. Congela: o alvo pode perder a próxima vez.',
    skills: [
      { id: 'lanca-gelo', nome: 'Lanças de Gelo (Partisan)', descricao: 'Lanças de gelo a até 4 casas; congela o alvo.', energia: 20, recarga: 1, alcance: 4, area: 'alvo', mult: 1, elemento: 'gelo', congela: 1 },
      { id: 'ice-saber', nome: 'Sabre de Gelo', descricao: 'Espada de gelo de perto; congela o alvo.', energia: 18, recarga: 1, alcance: 1, area: 'alvo', mult: 1.3, elemento: 'gelo', congela: 1 },
      { id: 'ice-time', nome: 'Ice Time', descricao: 'Toque que congela o alvo ao lado.', energia: 30, recarga: 3, alcance: 1, area: 'alvo', mult: 0.5, elemento: 'gelo', congela: 1 },
      { id: 'pheasant-beak', nome: 'Bico de Faisão (Pheasant Beak)', descricao: 'Uma ave de gelo voa até o alvo (até 5 casas) e explode em cristais; congela o alvo.', energia: 35, recarga: 3, alcance: 5, area: 'alvo', mult: 1.5, elemento: 'gelo', congela: 1 },
      { id: 'era-gelo', nome: 'Era do Gelo (Ice Age)', descricao: 'Congela o mapa inteiro: acerta e congela todos os inimigos.', energia: 60, recarga: 5, alcance: 0, area: 'mapa', mult: 0.45, elemento: 'gelo', congela: 1 },
    ],
  },
  borracha: {
    nome: 'Fruta da Borracha (Gomu Gomu)',
    tipo: 'paramecia',
    passiva: 'Corpo de borracha: metade do dano de maça (contundente) e de tiros.',
    skills: [
      { id: 'pistola', nome: 'Gomu Gomu no Pistol', descricao: 'Soco esticado a até 3 casas.', energia: 15, recarga: 1, alcance: 3, area: 'alvo', mult: 1 },
      { id: 'gatling', nome: 'Gomu Gomu no Gatling', descricao: 'Rajada de socos esticados: 6 golpes (×0,3 cada) a até 2 casas.', energia: 30, recarga: 2, alcance: 2, area: 'alvo', mult: 0.3, golpes: 6 },
      { id: 'gear-second', nome: 'Gear Second', descricao: 'Sangue acelerado: corpo vermelho soltando vapor, +30% de ataque por 3 vezes (não gasta a vez).', energia: 20, recarga: 4, alcance: 0, area: 'si', mult: 0, transforma: 3, livre: true },
    ],
  },
  bisao: {
    nome: 'Fruta do Bisão',
    tipo: 'zoan',
    passiva: 'Forma híbrida: mais força e defesa enquanto transformado.',
    skills: [{ id: 'forma-hibrida', nome: 'Forma Híbrida', descricao: 'Transforma por 3 vezes: +30% de ataque, +10 de defesa (não gasta a vez).', energia: 30, recarga: 4, alcance: 0, area: 'si', mult: 0, transforma: 3, livre: true }],
  },
  lobo: {
    nome: 'Fruta do Lobo (Inu Inu, modelo Lobo)',
    tipo: 'zoan',
    passiva: 'Forma híbrida: vira lobisomem, mais força e defesa enquanto transformado.',
    skills: [
      { id: 'forma-lobisomem', nome: 'Forma Híbrida (Lobisomem)', descricao: 'Vira lobisomem por 3 vezes: +30% de ataque, +10 de defesa (não gasta a vez).', energia: 30, recarga: 4, alcance: 0, area: 'si', mult: 0, transforma: 3, livre: true },
      { id: 'garras', nome: 'Garras', descricao: 'Dois rasgos de garra de perto (×0,7 cada).', energia: 15, recarga: 1, alcance: 1, area: 'alvo', mult: 0.7, golpes: 2 },
      { id: 'uivo', nome: 'Uivo Selvagem', descricao: 'Salta e bate no chão: acerta as 8 casas em volta (×0,8).', energia: 30, recarga: 3, alcance: 0, area: 'volta', mult: 0.8 },
    ],
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
    case 'mapa': {
      const r: Casa[] = []
      for (let l = 0; l < 10; l++) for (let c = 0; c < 20; c++) r.push({ l, c })
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
  if (s.area === 'volta' || s.area === 'si' || s.area === 'mapa') return d === 0
  if (d === 0 || d > s.alcance) return false
  if (s.area === 'linha') return alvo.l === de.l || alvo.c === de.c || Math.abs(alvo.l - de.l) === Math.abs(alvo.c - de.c)
  return true
}

/** Elemento que atinge a Logia do outro mesmo sem Haki (fogo derrete gelo). */
export const VENCE: Partial<Record<Elemento, Elemento[]>> = { fogo: ['gelo'] }
