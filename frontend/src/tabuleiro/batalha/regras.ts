/**
 * Regras da batalha de tripulação (protótipo): 5 contra 5 no tabuleiro 10×20.
 *
 * Turno simultâneo (DESIGN.md): os dois lados planejam ao mesmo tempo — para
 * onde cada um anda, quem ataca e com que golpe — e cada personagem escolhe
 * em segredo a postura com que vai receber os golpes da rodada. Depois tudo
 * se resolve junto, na ordem da iniciativa (AGL): cada um anda e age na sua
 * vez; quem se mexeu antes pode sair do alcance de quem vem depois.
 *
 * Golpe × postura (pedra-papel-tesoura):
 *   - comum  : bloquear segura (35%), aparar anula, esquivar às vezes;
 *   - pesado : quebra o bloqueio e o aparar, mas é fácil de esquivar;
 *   - finta  : engana quem apara ou contra-ataca, não dá para esquivar.
 * Aparar e contra-atacar custam vontade (do lado), que sobe a cada rodada.
 *
 * Módulo puro (sem desenho), determinístico pela semente do estado: o
 * servidor do multiplayer roda exatamente o mesmo código com os dois planos.
 */

import { alcance, mesmaCasa, COLUNAS, LINHAS, METADE, type Casa } from '../tabuleiro'

export type Lado = 'piratas' | 'marinha'
export type Golpe = 'comum' | 'pesado' | 'finta'
export type Postura = 'bloquear' | 'esquivar' | 'aparar' | 'contra'

export type Atributos = {
  /** força do golpe */
  atk: number
  /** reduz o dano recebido (0–60) */
  def: number
  /** iniciativa e esquiva */
  agl: number
  /** chance de crítico (contra a CON do alvo) */
  dex: number
  con: number
}

export type Combatente = {
  id: string
  nome: string
  papel: string
  lado: Lado
  casa: Casa
  hp: number
  hpMax: number
  at: Atributos
  /** casas que anda por turno */
  movimento: number
  /** distância (em casas, contando diagonais) do ataque */
  alcance: number
  /** ataque à distância (arma de fogo): não é contra-atacado de perto */
  distancia: boolean
  /** cura em vez de só atacar */
  cura?: { valor: number; alcance: number }
}

export type Acao = { tipo: 'atacar'; alvo: string; golpe: Golpe } | { tipo: 'curar'; alvo: string }

/** O que um personagem fará no turno. */
export type Plano = {
  /** caminho (sem a casa de partida), até `movimento` casas */
  caminho: Casa[]
  acao: Acao | null
  postura: Postura
}

export type Estado = {
  rodada: number
  combatentes: Combatente[]
  vontade: Record<Lado, number>
  semente: number
  vencedor: Lado | 'empate' | null
}

export type Evento =
  | { t: 'ordem'; ids: string[] }
  | { t: 'posturas'; posturas: Record<string, Postura> }
  | { t: 'mover'; id: string; caminho: Casa[] }
  | { t: 'atacar'; id: string; alvo: string; golpe: Golpe }
  | {
      t: 'golpe'
      de: string
      alvo: string
      golpe: Golpe
      postura: Postura
      efeito: 'acertou' | 'bloqueou' | 'esquivou' | 'aparou' | 'quebrou' | 'enganou'
      dano: number
      critico: boolean
    }
  | { t: 'contra'; de: string; alvo: string; dano: number }
  | { t: 'fora'; id: string; alvo: string }
  | { t: 'curar'; de: string; alvo: string; valor: number }
  | { t: 'caiu'; id: string }
  | { t: 'vontade'; lado: Lado; valor: number }
  | { t: 'fim'; vencedor: Lado | 'empate' }

export const CUSTO: Record<Postura, number> = { bloquear: 0, esquivar: 0, aparar: 2, contra: 3 }
export const VONTADE_POR_RODADA = 2
export const VONTADE_MAX = 10
/** escala geral do dano (ritmo da batalha: ~8–12 rodadas) */
export const FORCA = 2.1
export const MULT_GOLPE: Record<Golpe, number> = { comum: 1, pesado: 1.5, finta: 0.8 }

/**
 * Quanto do dano passa, conforme golpe × postura, e o que aconteceu.
 * `esquiva`: chance base de esquivar (somada à diferença de AGL).
 */
const TABELA: Record<Golpe, Record<Postura, { passa: number; efeito: Extract<Evento, { t: 'golpe' }>['efeito']; esquiva?: number; revide?: number }>> = {
  comum: {
    bloquear: { passa: 0.35, efeito: 'bloqueou' },
    esquivar: { passa: 1, efeito: 'acertou', esquiva: 0.45 },
    aparar: { passa: 0, efeito: 'aparou' },
    contra: { passa: 1, efeito: 'acertou', revide: 0.8 },
  },
  pesado: {
    bloquear: { passa: 1, efeito: 'quebrou' },
    esquivar: { passa: 1, efeito: 'acertou', esquiva: 0.75 },
    aparar: { passa: 1, efeito: 'quebrou' },
    contra: { passa: 1, efeito: 'acertou', revide: 0.8 },
  },
  finta: {
    bloquear: { passa: 0.6, efeito: 'bloqueou' },
    esquivar: { passa: 1, efeito: 'acertou', esquiva: 0 },
    aparar: { passa: 1.3, efeito: 'enganou' },
    contra: { passa: 1.3, efeito: 'enganou' },
  },
}

// ------------------------------------------------------------------ sorteio
/** Gerador determinístico (mulberry32): mesma semente, mesma batalha. */
export function sorteador(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------------------ geometria
/** Distância em casas (diagonal conta 1). */
export const distancia = (a: Casa, b: Casa) => Math.max(Math.abs(a.l - b.l), Math.abs(a.c - b.c))

export const vivos = (e: Estado, lado?: Lado) => e.combatentes.filter((c) => c.hp > 0 && (!lado || c.lado === lado))
export const porId = (e: Estado, id: string) => e.combatentes.find((c) => c.id === id)
export const inimigo = (l: Lado): Lado => (l === 'piratas' ? 'marinha' : 'piratas')
export const dentro = (c: Casa) => c.l >= 0 && c.l < LINHAS && c.c >= 0 && c.c < COLUNAS
/** Metade do tabuleiro (navio) de cada lado: piratas em cima, Marinha embaixo. */
export const noNavioDe = (c: Casa, lado: Lado) => (lado === 'piratas' ? c.l < METADE : c.l >= METADE)

/**
 * Casas para onde um personagem pode andar neste turno. `bloqueadas`:
 * casas que não pode ocupar (outros personagens, destinos já planejados).
 */
export function casasDeMovimento(e: Estado, c: Combatente, bloqueadas: Casa[] = []) {
  const ocupada = (x: Casa) => bloqueadas.some((b) => mesmaCasa(b, x)) || vivos(e).some((o) => o !== c && mesmaCasa(o.casa, x))
  return alcance(c.casa, c.movimento, ocupada)
}

// ------------------------------------------------------------------ batalha
export function criarBatalha(combatentes: Combatente[], semente = Date.now() % 2147483647): Estado {
  return { rodada: 1, combatentes: combatentes.map((c) => ({ ...c, casa: { ...c.casa } })), vontade: { piratas: 2, marinha: 2 }, semente, vencedor: null }
}

export const planoParado = (): Plano => ({ caminho: [], acao: null, postura: 'bloquear' })

/**
 * Resolve um turno com os planos dos dois lados. Não altera `anterior`:
 * devolve o estado novo e a lista de eventos (para animar na ordem).
 */
export function resolverTurno(anterior: Estado, planos: Record<string, Plano>): { estado: Estado; eventos: Evento[] } {
  const e: Estado = structuredClone(anterior)
  const rnd = sorteador(e.semente)
  const ev: Evento[] = []
  const plano = (id: string) => planos[id] ?? planoParado()

  // ordem: AGL maior primeiro (empate por sorteio)
  const desempate = new Map(e.combatentes.map((c) => [c.id, rnd()]))
  const ordem = vivos(e)
    .slice()
    .sort((a, b) => b.at.agl - a.at.agl || desempate.get(b.id)! - desempate.get(a.id)!)
  ev.push({ t: 'ordem', ids: ordem.map((c) => c.id) })

  // posturas: paga a vontade na ordem da iniciativa; sem vontade, bloqueia
  const posturas: Record<string, Postura> = {}
  for (const c of ordem) {
    let p = plano(c.id).postura
    if (e.vontade[c.lado] < CUSTO[p]) p = 'bloquear'
    e.vontade[c.lado] -= CUSTO[p]
    posturas[c.id] = p
  }
  ev.push({ t: 'posturas', posturas })

  const derrubar = (alvo: Combatente) => {
    if (alvo.hp <= 0) {
      alvo.hp = 0
      ev.push({ t: 'caiu', id: alvo.id })
    }
  }

  for (const c of ordem) {
    if (c.hp <= 0) continue
    const p = plano(c.id)
    // anda até onde der (para antes de uma casa que ficou ocupada)
    const feito: Casa[] = []
    for (const passo of p.caminho.slice(0, c.movimento)) {
      if (!dentro(passo) || vivos(e).some((o) => o !== c && mesmaCasa(o.casa, passo))) break
      feito.push(passo)
      c.casa = { ...passo }
    }
    if (feito.length) ev.push({ t: 'mover', id: c.id, caminho: feito })

    const a = p.acao
    if (!a) continue
    const alvo = porId(e, a.alvo)
    if (!alvo || alvo.hp <= 0) continue
    if (a.tipo === 'curar') {
      if (!c.cura || alvo.lado !== c.lado || distancia(c.casa, alvo.casa) > c.cura.alcance) {
        ev.push({ t: 'fora', id: c.id, alvo: alvo.id })
        continue
      }
      const valor = Math.min(c.cura.valor, alvo.hpMax - alvo.hp)
      alvo.hp += valor
      ev.push({ t: 'curar', de: c.id, alvo: alvo.id, valor })
      continue
    }
    if (alvo.lado === c.lado) continue
    ev.push({ t: 'atacar', id: c.id, alvo: alvo.id, golpe: a.golpe })
    if (distancia(c.casa, alvo.casa) > c.alcance) {
      ev.push({ t: 'fora', id: c.id, alvo: alvo.id })
      continue
    }
    const postura = posturas[alvo.id] ?? 'bloquear'
    const regra = TABELA[a.golpe][postura]
    // aparar só funciona de perto: contra um tiro vira bloqueio
    const r = postura === 'aparar' && c.distancia ? TABELA[a.golpe].bloquear : regra
    let efeito = r.efeito
    let passa = r.passa
    if (r.esquiva !== undefined) {
      const chance = Math.min(0.9, Math.max(0.05, r.esquiva + (alvo.at.agl - c.at.agl) * 0.02))
      if (r.esquiva > 0 && rnd() < chance) {
        efeito = 'esquivou'
        passa = 0
      }
    }
    const chanceCritico = Math.min(0.5, Math.max(0.03, 0.08 + (c.at.dex - alvo.at.con) * 0.02))
    const critico = passa > 0 && rnd() < chanceCritico
    const bruto = c.at.atk * FORCA * MULT_GOLPE[a.golpe] * (1 - Math.min(60, alvo.at.def) / 100) * (0.9 + rnd() * 0.2) * (critico ? 1.5 : 1)
    const dano = passa > 0 ? Math.max(1, Math.round(bruto * passa)) : 0
    alvo.hp -= dano
    ev.push({ t: 'golpe', de: c.id, alvo: alvo.id, golpe: a.golpe, postura, efeito, dano, critico })
    derrubar(alvo)
    // contra-ataque: quem esperava o golpe revida, se alcança o atacante
    if (r.revide && alvo.hp > 0 && distancia(alvo.casa, c.casa) <= alvo.alcance) {
      const d = Math.max(1, Math.round(alvo.at.atk * FORCA * r.revide * (1 - Math.min(60, c.at.def) / 100) * (0.9 + rnd() * 0.2)))
      c.hp -= d
      ev.push({ t: 'contra', de: alvo.id, alvo: c.id, dano: d })
      derrubar(c)
    }
  }

  // fim da rodada
  const p = vivos(e, 'piratas').length
  const m = vivos(e, 'marinha').length
  if (!p || !m) {
    e.vencedor = !p && !m ? 'empate' : p ? 'piratas' : 'marinha'
    ev.push({ t: 'fim', vencedor: e.vencedor })
  } else {
    e.rodada++
    for (const lado of ['piratas', 'marinha'] as Lado[]) {
      e.vontade[lado] = Math.min(VONTADE_MAX, e.vontade[lado] + VONTADE_POR_RODADA)
      ev.push({ t: 'vontade', lado, valor: e.vontade[lado] })
    }
  }
  e.semente = Math.floor(rnd() * 2147483646) + 1
  return { estado: e, eventos: ev }
}
