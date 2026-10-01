/**
 * Combate por turnos SEM tabuleiro (tela estilo Honkai).
 *
 * As regras são as do tabuleiro (tabuleiro/batalha/regras.ts): mesmos
 * atributos, energia, espírito, skills de arma e de fruta com recarga, Haki de
 * armamento / observação / Rei, Logia, crítico, bloqueio, esquiva,
 * queimadura, congelar... O golpe é literalmente o mesmo código
 * (`golpeador`). O que muda sem as casas:
 *
 * - a vez é INDIVIDUAL, numa fila pela agilidade (quem é mais ágil age mais
 *   vezes): valor de ação = 10000 / velocidade; age o menor, o tempo anda;
 * - sem movimento e sem alcance: a área da skill vira o número de alvos —
 *   alvo → um; linha, leque, volta e explosão 3×3 → o alvo e os vizinhos
 *   na formação; explosão 5×5 e mapa → todos; si → o próprio;
 * - Haki do Rei em área pega todos os inimigos;
 * - a observação avançada revida golpes corpo a corpo (alcance 1).
 *
 * Os recursos andam na vez de cada um (energia, espírito, recargas,
 * queimadura, transformação), como andavam na vez da tripulação.
 */

import { type Skill } from '../tabuleiro/batalha/armas'
import {
  chanceHaki,
  ENERGIA_INICIAL,
  ENERGIA_MAX,
  ENERGIA_POR_VEZ,
  ESPIRITO_MAX,
  ESPIRITO_POR_VEZ,
  golpeador,
  HAOSHOKU,
  RECUPERA_ARMAMENTO,
  REI_IMBUIDO,
  skillsDe,
  sorteador,
  type Combatente,
  type Evento,
  type Lado,
} from '../tabuleiro/batalha/regras'

export type { Combatente, Lado }
export { skillsDe }

export type Alcance = 'um' | 'leque' | 'todos' | 'si' | 'aliado'
export const NOME_ALCANCE: Record<Alcance, string> = { um: 'Um alvo', leque: 'Alvo e vizinhos', todos: 'Todos', si: 'Em si', aliado: 'Um aliado' }

/** A área do tabuleiro vira o número de alvos. */
export function alcanceDe(s: Skill): Alcance {
  if (s.cura) return 'aliado'
  if (s.area === 'si') return 'si'
  if (s.area === 'mapa' || (s.area === 'explosao' && (s.raio ?? 1) >= 2)) return 'todos'
  if (s.area === 'alvo') return 'um'
  return 'leque'
}

/** Golpe de perto (avança até o alvo; a observação avançada revida). */
export const corpoACorpo = (s: Skill) => s.alcance <= 1 && s.area === 'alvo'

export const velocidade = (c: Combatente) => 80 + c.at.agl * 3

export type Ev = Evento | { t: 'perdeu'; id: string }

export type Estado = {
  combatentes: Combatente[]
  /** valor de ação de cada um (menor = age antes) */
  va: Record<string, number>
  /** quem está na vez (null entre uma vez e outra) */
  atual: string | null
  semente: number
  vencedor: Lado | null
}

export type Acao =
  | { t: 'skill'; id: string; skill: string; alvo: string }
  | { t: 'observar'; id: string; ligado: boolean }
  | { t: 'haki'; id: string; tipo: 'armamento' | 'rei'; ligado: boolean }
  | { t: 'haoshoku'; id: string }
  | { t: 'passar' }

export const vivos = (e: { combatentes: Combatente[] }, lado?: Lado) => e.combatentes.filter((c) => c.hp > 0 && (!lado || c.lado === lado))
export const porId = (e: { combatentes: Combatente[] }, id: string) => e.combatentes.find((c) => c.id === id)!
export const outro = (l: Lado): Lado => (l === 'piratas' ? 'marinha' : 'piratas')

export function criar(combatentes: Combatente[], semente = (Date.now() % 2147483646) + 1): Estado {
  const cs = structuredClone(combatentes)
  for (const c of cs) {
    c.energia = ENERGIA_INICIAL
    c.espirito = 0
    c.observando = false
    c.armamentoLigado = false
    c.reiLigado = false
    c.atordoado = false
    c.queimadura = null
    c.recargas = {}
  }
  return { combatentes: cs, va: Object.fromEntries(cs.map((c) => [c.id, 10000 / velocidade(c)])), atual: null, semente, vencedor: null }
}

/** Os próximos `n` a agir (prévia da fila). */
export function fila(e: Estado, n: number) {
  const va = new Map(vivos(e).map((c) => [c.id, e.va[c.id]]))
  const out: string[] = []
  while (out.length < n && va.size) {
    let id = ''
    let min = Infinity
    for (const [k, v] of va) {
      if (v < min) {
        min = v
        id = k
      }
    }
    out.push(id)
    for (const [k, v] of va) va.set(k, v - min)
    va.set(id, 10000 / velocidade(porId(e, id)))
  }
  return out
}

/** Os vizinhos de um alvo na formação (para o "leque"). */
export function vizinhos(e: Estado, id: string) {
  const linha = vivos(e, porId(e, id).lado)
  const i = linha.findIndex((c) => c.id === id)
  return [linha[i - 1], linha[i + 1]].filter(Boolean).map((c) => c!.id)
}

/** Quem é atingido por uma skill mirando `alvo`. */
export function alvosDe(e: Estado, c: Combatente, s: Skill, alvo: string): string[] {
  const a = alcanceDe(s)
  if (a === 'si') return [c.id]
  if (a === 'aliado') return [alvo]
  if (a === 'todos') return vivos(e, outro(c.lado)).map((x) => x.id)
  if (a === 'leque') return [alvo, ...vizinhos(e, alvo)]
  return [alvo]
}

/**
 * Anda o tempo até o próximo da fila e começa a vez dele (recursos andam;
 * atordoado perde a vez). Devolve o estado novo e os eventos.
 */
export function proximaVez(anterior: Estado): { estado: Estado; eventos: Ev[] } {
  const e: Estado = structuredClone(anterior)
  const ev: Ev[] = []
  const vs = vivos(e)
  const c = vs.reduce((a, b) => (e.va[b.id] < e.va[a.id] ? b : a))
  const passo = e.va[c.id]
  for (const x of vs) e.va[x.id] -= passo
  if (c.queimadura) {
    const d = Math.min(c.hp - 1, c.queimadura.dano) // queimadura não derruba
    if (d > 0) {
      c.hp -= d
      ev.push({ t: 'queimou', id: c.id, dano: d })
    }
    if (--c.queimadura.vezes <= 0) c.queimadura = null
  }
  if (c.akuma?.transformado) c.akuma.transformado--
  c.energia = Math.min(ENERGIA_MAX, c.energia + ENERGIA_POR_VEZ)
  c.espirito = Math.min(ESPIRITO_MAX, c.espirito + ESPIRITO_POR_VEZ)
  const arm = c.haki.armamento
  const reserva = c.haki.rei ? REI_IMBUIDO.espirito : 0
  if (arm && arm.usos < arm.max && c.espirito >= RECUPERA_ARMAMENTO.espirito + reserva) {
    c.espirito -= RECUPERA_ARMAMENTO.espirito
    arm.usos = Math.min(arm.max, arm.usos + RECUPERA_ARMAMENTO.usos)
    ev.push({ t: 'recuperou', id: c.id, usos: arm.usos })
  }
  if (c.atordoado) {
    // atordoado (Rei, gelo): perde esta vez
    c.atordoado = false
    ev.push({ t: 'perdeu', id: c.id })
    fimDaVez(e, c)
    return { estado: e, eventos: ev }
  }
  e.atual = c.id
  return { estado: e, eventos: ev }
}

function fimDaVez(e: Estado, c: Combatente) {
  for (const k of Object.keys(c.recargas)) if (--c.recargas[k] <= 0) delete c.recargas[k]
  e.va[c.id] = 10000 / velocidade(c)
  e.atual = null
}

/** Por que essa ação não pode (ou null se pode). */
export function motivo(e: Estado, a: Acao): string | null {
  if (e.vencedor) return 'A batalha acabou.'
  if (a.t === 'passar') return null
  const c = porId(e, a.id)
  if (!c || c.hp <= 0) return 'Personagem inválido.'
  if (e.atual !== c.id) return 'Não é a vez dele.'
  if (a.t === 'observar') return a.ligado && !c.haki.observacao?.usos ? 'Sem usos de Haki de observação.' : null
  if (a.t === 'haki') {
    if (!a.ligado) return null
    if (!c.haki.armamento) return `${c.nome} não tem Haki de armamento.`
    if (!c.haki.armamento.usos) return 'Sem usos de Haki de armamento (recupera com espírito).'
    if (a.tipo === 'rei') {
      if (!c.haki.rei || !c.haki.armamento.avancado) return 'Precisa de Haki do Rei e armamento avançado.'
      if (c.espirito < REI_IMBUIDO.espirito) return `Espírito insuficiente (${REI_IMBUIDO.espirito}).`
    }
    return null
  }
  if (a.t === 'haoshoku') {
    if (!c.haki.rei) return `${c.nome} não tem Haki do Rei.`
    return c.espirito < HAOSHOKU.espirito ? `Espírito insuficiente (${HAOSHOKU.espirito}).` : null
  }
  const s = skillsDe(c).find((x) => x.id === a.skill)
  if (!s) return 'Skill inválida.'
  if (c.recargas[s.id]) return `Em recarga (${c.recargas[s.id]}).`
  if (c.energia < s.energia) return 'Energia insuficiente.'
  const alc = alcanceDe(s)
  const alvo = alc === 'si' || alc === 'todos' ? null : porId(e, a.alvo)
  if (alc === 'aliado' && (!alvo || alvo.hp <= 0 || alvo.lado !== c.lado)) return 'Escolha um aliado.'
  if ((alc === 'um' || alc === 'leque') && (!alvo || alvo.hp <= 0 || alvo.lado === c.lado)) return 'Escolha um inimigo.'
  return null
}

export function aplicar(anterior: Estado, a: Acao): { estado: Estado; eventos: Ev[] } | { erro: string } {
  const m = motivo(anterior, a)
  if (m) return { erro: m }
  const e: Estado = structuredClone(anterior)
  const rnd = sorteador(e.semente)
  const ev: Evento[] = []
  let perto = false
  const { golpear } = golpeador(rnd, ev, () => perto)
  let acabou = false

  switch (a.t) {
    case 'passar':
      acabou = true
      break
    case 'observar':
      porId(e, a.id).observando = a.ligado
      break
    case 'haki': {
      const c = porId(e, a.id)
      if (a.tipo === 'armamento') {
        c.armamentoLigado = a.ligado
        if (!a.ligado) c.reiLigado = false
      } else {
        c.reiLigado = a.ligado
        if (a.ligado) c.armamentoLigado = true
      }
      ev.push({ t: 'haki', id: c.id, tipo: a.tipo, ligado: a.ligado })
      break
    }
    case 'haoshoku': {
      // não gasta a vez (como no tabuleiro); sem casas, pega todos os inimigos
      const c = porId(e, a.id)
      c.espirito -= HAOSHOKU.espirito
      ev.push({ t: 'haoshoku', id: c.id })
      for (const o of vivos(e, outro(c.lado))) {
        if (rnd() < chanceHaki(c.haki.overall - o.haki.overall)) {
          o.atordoado = true
          ev.push({ t: 'atordoou', id: o.id })
        } else ev.push({ t: 'resistiu', id: o.id })
      }
      break
    }
    case 'skill': {
      const c = porId(e, a.id)
      const s = skillsDe(c).find((x) => x.id === a.skill)!
      const armamento = c.armamentoLigado && (c.haki.armamento?.usos ?? 0) > 0
      const rei = armamento && c.reiLigado && c.espirito >= REI_IMBUIDO.espirito
      c.energia -= s.energia
      if (s.recarga) c.recargas[s.id] = s.recarga + 1 // conta a partir do fim desta vez
      if (armamento) c.haki.armamento!.usos--
      if (rei) c.espirito -= REI_IMBUIDO.espirito
      if (!c.haki.armamento?.usos) c.armamentoLigado = c.reiLigado = false
      if (c.espirito < REI_IMBUIDO.espirito) c.reiLigado = false
      const alvos = alvosDe(e, c, s, a.alvo)
      ev.push({ t: 'skill', id: c.id, skill: s.id, nome: s.nome, alvo: { l: 0, c: 0 }, casas: [], armamento, rei })
      if (s.transforma && c.akuma) {
        c.akuma.transformado = s.transforma
        ev.push({ t: 'transformou', id: c.id, vezes: s.transforma })
      } else if (s.cura) {
        const o = porId(e, a.alvo)
        const valor = Math.min(s.cura, o.hpMax - o.hp)
        o.hp += valor
        ev.push({ t: 'cura', de: c.id, alvo: o.id, valor })
      } else {
        perto = corpoACorpo(s)
        for (const id of alvos) {
          const alvo = porId(e, id)
          for (let g = 0; g < (s.golpes ?? 1) && alvo.hp > 0 && c.hp > 0; g++) golpear(c, alvo, s, armamento, rei)
        }
      }
      if (!c.haki.armamento?.usos) c.armamentoLigado = c.reiLigado = false
      // atacar encerra a vez; buff, transformação e profissão não
      if (!s.livre) acabou = true
      break
    }
  }

  for (const lado of ['piratas', 'marinha'] as Lado[]) {
    if (!e.vencedor && !vivos(e, lado).length) {
      e.vencedor = outro(lado)
      ev.push({ t: 'fim', vencedor: e.vencedor })
    }
  }
  if (acabou && e.atual) fimDaVez(e, porId(e, e.atual))
  e.semente = Math.floor(rnd() * 2147483646) + 1
  return { estado: e, eventos: ev }
}
