/**
 * Regras da batalha de tripulação — protótipo de TESTE (DESIGN.md: nada aqui
 * está fechado; o que ficar bom entra no jogo).
 *
 * Vez da tripulação, como no Sugoi: o lado mais ágil começa. Na sua vez, a
 * tripulação tem 5 MOVIMENTOS (1 casa cada, em 8 direções) divididos entre
 * todos e UM ataque: usar uma skill de ataque encerra a
 * vez. Skills fortes têm RECARGA (vezes da tripulação sem poder usar).
 * 90 s por vez; quem perde 3 vezes pelo tempo passa a ter só 30 s.
 *
 * Recursos de cada personagem:
 *   - energia  : paga as skills da arma; volta um pouco a cada vez;
 *   - espírito : sobe aos poucos e mais ao acertar/ser atingido; paga o
 *                Haki do Rei;
 *   - Haki     : usos (pela maestria) de armamento e observação; ligar e
 *                desligar é separado do ataque (não gasta a vez). O
 *                armamento recupera usos com espírito;
 *   - Logia    : cargas de intangibilidade (pela raridade da fruta).
 *
 * Módulo puro e determinístico (semente no estado): cada ação vira uma
 * função estado → estado + eventos, pronta para o servidor do multiplayer.
 */

import { mesmaCasa, vizinhos8, COLUNAS, LINHAS, type Casa } from '../tabuleiro'
import { FRUTAS, PRIMEIROS_SOCORROS, SKILLS_ARMA, VENCE, alvoValido, casasDaArea, distancia, type Skill, type TipoArma } from './armas'

export type Lado = 'piratas' | 'marinha'

export type Atributos = {
  atk: number
  def: number
  /** esquiva e quem começa */
  agl: number
  /** bloqueio (contra a CON do atacante) */
  res: number
  /** acerto (contra a AGL do alvo) */
  pre: number
  /** crítico (contra a CON do alvo) */
  dex: number
  con: number
}

export type Haki = {
  /** média de todos os Haki (duelos e disputas) */
  overall: number
  armamento: { usos: number; max: number; avancado: boolean } | null
  observacao: { usos: number; max: number; avancado: boolean } | null
  rei: boolean
}

export type Combatente = {
  id: string
  nome: string
  papel: string
  lado: Lado
  casa: Casa
  hp: number
  hpMax: number
  energia: number
  espirito: number
  at: Atributos
  arma: TipoArma
  /** profissão com efeito em batalha */
  profissao?: 'medico'
  haki: Haki
  /** Akuma no Mi (id em FRUTAS); Zoan: vezes restantes transformado */
  akuma: { fruta: string; transformado: number } | null
  /** Logia: cargas de intangibilidade */
  logia: { cargas: number; max: number } | null
  /** gasta Haki de observação quando atacado */
  observando: boolean
  /** Haki de armamento ligado: todo ataque usa (gasta 1 uso por ataque) */
  armamentoLigado: boolean
  /** Haki do Rei imbuído ligado: todo ataque usa (gasta espírito por ataque) */
  reiLigado: boolean
  /** Haki do Rei / congelado: perde a próxima vez */
  atordoado: boolean
  /** skill → vezes da tripulação que ainda faltam para poder usar */
  recargas: Record<string, number>
  /** queimadura: dano no começo de cada vez */
  queimadura: { dano: number; vezes: number } | null
}

export type Estado = {
  combatentes: Combatente[]
  vez: Lado
  /** quantas vezes já passou (1 = primeira vez do primeiro lado) */
  turno: number
  movimento: number
  /** vezes perdidas pelo tempo (3 ou mais: vez de 30 s) */
  perdidas: Record<Lado, number>
  semente: number
  vencedor: Lado | null
}

export type Efeito = 'acertou' | 'critico' | 'bloqueou' | 'esquivou' | 'observou' | 'atravessou' | 'desgastado'

export type Evento =
  | { t: 'vez'; lado: Lado; turno: number }
  | { t: 'mover'; id: string; caminho: Casa[] }
  | { t: 'skill'; id: string; skill: string; nome: string; alvo: Casa; casas: Casa[]; armamento: boolean; rei: boolean }
  | { t: 'golpe'; de: string; alvo: string; dano: number; efeito: Efeito }
  | { t: 'contra'; de: string; alvo: string; dano: number }
  | { t: 'cura'; de: string; alvo: string; valor: number }
  | { t: 'haoshoku'; id: string }
  | { t: 'transformou'; id: string; vezes: number }
  | { t: 'congelou'; id: string }
  | { t: 'queimou'; id: string; dano: number }
  | { t: 'atordoou'; id: string }
  | { t: 'resistiu'; id: string }
  | { t: 'haki'; id: string; tipo: 'armamento' | 'rei'; ligado: boolean }
  | { t: 'recuperou'; id: string; usos: number }
  | { t: 'clash'; de: string; alvo: string; resultado: 'venceu' | 'perdeu' | 'empate'; dano: number }
  | { t: 'caiu'; id: string }
  | { t: 'tempo'; lado: Lado }
  | { t: 'fim'; vencedor: Lado }

// ------------------------------------------------------------ números (teste)
export const MOVIMENTO_POR_VEZ = 5
export const TEMPO_POR_VEZ = 90 // s
export const TEMPO_PENALIDADE = 30 // s, depois de perder 3 vezes pelo tempo
export const tempoDaVez = (e: Estado) => (e.perdidas[e.vez] >= 3 ? TEMPO_PENALIDADE : TEMPO_POR_VEZ)
export const ENERGIA_MAX = 100
export const ENERGIA_INICIAL = 60
export const ENERGIA_POR_VEZ = 20
export const ESPIRITO_MAX = 100
export const ESPIRITO_POR_VEZ = 5
export const ESPIRITO_AO_ACERTAR = 8
export const ESPIRITO_AO_APANHAR = 12
/** Haki do Rei em área: espírito, raio */
export const HAOSHOKU = { espirito: 70, raio: 3 }
/** Haki do Rei imbuído no golpe: espírito a mais (precisa de armamento avançado) */
export const REI_IMBUIDO = { espirito: 40, mult: 1.35 }
/**
 * Disputa de Haki pelo overall: chance de o mais forte prevalecer cresce com
 * a diferença (igual = 50%, +3% por ponto, entre 5% e 95%) — sem degrau.
 */
export const chanceHaki = (dif: number) => Math.max(0.05, Math.min(0.95, 0.5 + dif * 0.03))
/** no começo da vez: gasta espírito para recuperar 1 uso de armamento */
export const RECUPERA_ARMAMENTO = { espirito: 25, usos: 1 }
/** Choque de Haki do Rei: quem é atacado com o Rei imbuído e também tem o
 * Rei (e espírito) responde; ganha o maior overall. Diferença até `empate`
 * explode e anula; atacante que vence ganha `bonus` no golpe; que perde
 * leva de volta o dano base puro. */
export const CLASH = { espirito: 30, empate: 3, bonus: 1.3 }
export const FORCA = 1.4
const MULT_ARMAMENTO = 1.4
const MULT_AVANCADO = 1.55
/** quanto da defesa o armamento fura (normal / avançado) */
const FURA_ARMAMENTO = 0.15
const FURA_AVANCADO = 0.35
/** observação: chance base de esquiva por maestria (normal / avançada) e teto */
export const OBSERVACAO = { normal: 0.3, avancada: 0.45, tetoNormal: 0.6, tetoAvancada: 0.75 }

// ------------------------------------------------------------ utilitários
/** Gerador determinístico (mulberry32). */
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

export { distancia }
export const vivos = (e: Estado, lado?: Lado) => e.combatentes.filter((c) => c.hp > 0 && (!lado || c.lado === lado))
export const porId = (e: Estado, id: string) => e.combatentes.find((c) => c.id === id)
export const outro = (l: Lado): Lado => (l === 'piratas' ? 'marinha' : 'piratas')
const dentro = (c: Casa) => c.l >= 0 && c.l < LINHAS && c.c >= 0 && c.c < COLUNAS
const limitar = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ocupante = (e: Estado, c: Casa) => vivos(e).find((o) => mesmaCasa(o.casa, c))

/** Skills que o personagem tem (arma + profissão). */
export function skillsDe(c: Combatente): Skill[] {
  return [...SKILLS_ARMA[c.arma], ...(c.akuma ? FRUTAS[c.akuma.fruta].skills : []), ...(c.profissao === 'medico' ? [PRIMEIROS_SOCORROS] : [])]
}

/** Ataque e defesa com a transformação Zoan. */
export const atkDe = (c: Combatente) => c.at.atk * (c.akuma?.transformado ? 1.3 : 1)
export const defDe = (c: Combatente) => c.at.def + (c.akuma?.transformado && FRUTAS[c.akuma.fruta].tipo === 'zoan' ? 10 : 0)

/** De onde vem o golpe (para a passiva de borracha). */
const armaDaSkill = (c: Combatente, s: Skill): TipoArma | 'fruta' => (SKILLS_ARMA[c.arma].includes(s) ? c.arma : 'fruta')

/** Casas alcançáveis andando até `max` casas (retas ou diagonais), com o caminho. */
export function movimentos(e: Estado, c: Combatente, max = e.movimento) {
  const chave = (x: Casa) => x.l * COLUNAS + x.c
  const veio = new Map<number, Casa | null>([[chave(c.casa), null]])
  const dist = new Map<number, number>([[chave(c.casa), 0]])
  const fila: Casa[] = [c.casa]
  while (fila.length) {
    const a = fila.shift()!
    const d = dist.get(chave(a))!
    if (d >= max) continue
    for (const v of vizinhos8(a)) {
      if (dist.has(chave(v)) || ocupante(e, v)) continue
      dist.set(chave(v), d + 1)
      veio.set(chave(v), a)
      fila.push(v)
    }
  }
  /**
   * Caminho mais curto até a casa, o mais reto possível: entre os caminhos de
   * mesmo tamanho, escolhe a cada passo a casa mais perto da reta entre a
   * origem e o destino (anda reto em linha, coluna ou diagonal; nada de
   * desviar para a linha do lado e voltar).
   */
  const caminho = (ate: Casa): Casa[] | null => {
    if (!dist.has(chave(ate)) || mesmaCasa(ate, c.casa)) return null
    const dl = ate.l - c.casa.l
    const dc = ate.c - c.casa.c
    const n = Math.hypot(dl, dc) || 1
    const fora = (x: Casa) => Math.abs((x.l - c.casa.l) * dc - (x.c - c.casa.c) * dl) / n
    const r: Casa[] = [ate]
    let p = ate
    while (dist.get(chave(p))! > 1) {
      const d = dist.get(chave(p))!
      const antes = vizinhos8(p).filter((v) => dist.get(chave(v)) === d - 1)
      antes.sort((x, y) => fora(x) - fora(y) || (x.l === p.l || x.c === p.c ? 0 : 1) - (y.l === p.l || y.c === p.c ? 0 : 1))
      p = antes[0]
      r.unshift(p)
    }
    return r
  }
  const casas = [...dist.keys()].filter((k) => k !== chave(c.casa)).map((k) => ({ l: Math.floor(k / COLUNAS), c: k % COLUNAS }))
  return { casas, caminho }
}

// ------------------------------------------------------------ início
export function criarBatalha(combatentes: Combatente[], semente = (Date.now() % 2147483646) + 1): Estado {
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
  const media = (l: Lado) => {
    const v = cs.filter((c) => c.lado === l)
    return v.reduce((s, c) => s + c.at.agl, 0) / Math.max(1, v.length)
  }
  const rnd = sorteador(semente)
  const dp = media('piratas')
  const dm = media('marinha')
  const vez: Lado = dp > dm ? 'piratas' : dm > dp ? 'marinha' : rnd() < 0.5 ? 'piratas' : 'marinha'
  return { combatentes: cs, vez, turno: 1, movimento: MOVIMENTO_POR_VEZ, perdidas: { piratas: 0, marinha: 0 }, semente: Math.floor(rnd() * 2147483646) + 1, vencedor: null }
}

/**
 * Preparação (antes da primeira vez): cada lado liga ou não o Haki dos seus
 * personagens. Não gasta nada além do que o Haki já gasta no ataque.
 */
export function hakiPreparacao(anterior: Estado, id: string, tipo: 'armamento' | 'rei' | 'observacao', ligado: boolean): Estado {
  const e: Estado = structuredClone(anterior)
  const c = porId(e, id)
  if (!c) return anterior
  if (tipo === 'observacao') c.observando = ligado && (c.haki.observacao?.usos ?? 0) > 0
  else if (tipo === 'armamento') {
    c.armamentoLigado = ligado && (c.haki.armamento?.usos ?? 0) > 0
    if (!c.armamentoLigado) c.reiLigado = false
  } else {
    c.reiLigado = ligado && c.haki.rei && !!c.haki.armamento?.avancado && c.espirito >= REI_IMBUIDO.espirito
    if (c.reiLigado) c.armamentoLigado = true
  }
  return e
}

// ------------------------------------------------------------ ações
export type Acao =
  | { t: 'mover'; id: string; caminho: Casa[] }
  | { t: 'skill'; id: string; skill: string; alvo: Casa }
  | { t: 'observar'; id: string; ligado: boolean }
  | { t: 'haki'; id: string; tipo: 'armamento' | 'rei'; ligado: boolean }
  | { t: 'haoshoku'; id: string }
  | { t: 'passar' }
  | { t: 'tempo' }

export type Resultado = { estado: Estado; eventos: Evento[] } | { erro: string }

/** Por que essa ação não pode (ou null se pode). */
export function motivo(e: Estado, a: Acao): string | null {
  if (e.vencedor) return 'A batalha acabou.'
  if (a.t === 'passar' || a.t === 'tempo') return null
  const c = porId(e, a.id)
  if (!c || c.hp <= 0) return 'Personagem inválido.'
  if (c.lado !== e.vez) return 'Não é a vez dele.'
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
  if (c.atordoado) return `${c.nome} está atordoado.`
  if (a.t === 'mover') {
    if (!a.caminho.length) return 'Caminho vazio.'
    if (a.caminho.length > e.movimento) return 'Movimento insuficiente.'
    let de = c.casa
    for (const p of a.caminho) {
      if (!dentro(p) || distancia(de, p) !== 1 || ocupante(e, p)) return 'Caminho bloqueado.'
      de = p
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
  if (!alvoValido(s, c.casa, a.alvo)) return 'Fora de alcance.'
  if (s.cura) {
    const o = ocupante(e, a.alvo)
    if (!o || o.lado !== c.lado) return 'Escolha um aliado.'
  } else if (!s.transforma) {
    // não deixa gastar a vez num golpe que não pega ninguém
    const pega = casasDaArea(s, c.casa, a.alvo).some((x) => dentro(x) && ocupante(e, x)?.lado === outro(c.lado))
    if (!pega) return s.area === 'alvo' ? 'Escolha um inimigo.' : 'Nenhum inimigo na área.'
  }
  return null
}


/**
 * O golpe de um personagem em outro, com todas as regras (choque de Haki do
 * Rei, Logia, observação, esquiva, armamento, crítico, bloqueio, borracha,
 * queimadura, congelar, atordoar). `revida` diz se a observação avançada
 * revida (no tabuleiro: de perto).
 */
export function golpeador(rnd: () => number, ev: Evento[], revida: (c: Combatente, alvo: Combatente) => boolean) {
  const espirito = (c: Combatente, v: number) => (c.espirito = Math.min(ESPIRITO_MAX, c.espirito + v))

  const ferir = (alvo: Combatente, dano: number) => {
    alvo.hp = Math.max(0, alvo.hp - dano)
    espirito(alvo, ESPIRITO_AO_APANHAR)
    if (alvo.hp === 0) {
      alvo.observando = false
      ev.push({ t: 'caiu', id: alvo.id })
    }
  }

  /** observação já usada neste ataque, por alvo (true = previu e esquiva de tudo) */
  const observados = new Map<string, boolean>()
  /** Logias em que o armamento já pagou o uso extra neste ataque */
  const pagouLogia = new Set<string>()
  const clashes = new Map<string, 'venceu' | 'perdeu' | 'empate'>()

  /** Um golpe de `c` em `alvo`. */
  const golpear = (c: Combatente, alvo: Combatente, s: Skill, armamento: boolean, rei: boolean, mult = s.mult): void => {
    // Choque de Haki do Rei (uma vez por alvo na ação)
    if (rei && alvo.haki.rei && !clashes.has(alvo.id) && alvo.espirito >= CLASH.espirito) {
      alvo.espirito -= CLASH.espirito
      const dif = c.haki.overall - alvo.haki.overall
      const resultado = Math.abs(dif) <= CLASH.empate ? 'empate' : rnd() < chanceHaki(dif) ? 'venceu' : 'perdeu'
      clashes.set(alvo.id, resultado)
      const volta = resultado === 'perdeu' ? Math.max(1, Math.round(atkDe(c) * FORCA * mult)) : 0
      ev.push({ t: 'clash', de: c.id, alvo: alvo.id, resultado, dano: volta })
      if (resultado === 'perdeu') ferir(c, volta)
    }
    const choque = clashes.get(alvo.id)
    if (choque === 'perdeu' || choque === 'empate') return
    if (choque === 'venceu') mult *= CLASH.bonus
    // Logia: sem Haki nem Kairoseki, atravessa (gasta carga) — a menos que o
    // elemento do golpe vença o da fruta (fogo derrete gelo)
    const elemAlvo = alvo.akuma ? FRUTAS[alvo.akuma.fruta].elemento : undefined
    const venceElemento = !!(s.elemento && elemAlvo && VENCE[s.elemento]?.includes(elemAlvo))
    // tocar a Logia com Haki custa 1 uso a mais de armamento (uma vez por
    // ataque); sem esse uso, o golpe atravessa como se não tivesse Haki
    if (alvo.logia && alvo.logia.cargas > 0 && armamento && !venceElemento && !pagouLogia.has(alvo.id)) {
      const arm = c.haki.armamento
      if (arm && arm.usos > 0) {
        arm.usos--
        pagouLogia.add(alvo.id)
      } else armamento = false
    }
    if (alvo.logia && !armamento && !venceElemento) {
      if (alvo.logia.cargas > 0) {
        alvo.logia.cargas--
        ev.push({ t: 'golpe', de: c.id, alvo: alvo.id, dano: 0, efeito: 'atravessou' })
        return
      }
    }
    // Haki de observação: um uso por ataque; se prevê, esquiva de todos os
    // hits dele (o resultado vale para os golpes seguintes do mesmo ataque)
    const obs = alvo.haki.observacao
    const previu = observados.get(alvo.id)
    if (previu) return
    if (previu === undefined && alvo.observando && obs && obs.usos > 0) {
      obs.usos--
      if (!obs.usos) alvo.observando = false
      observados.set(alvo.id, false)
      // chance (nunca garantida): maestria + diferença de Haki + agilidade
      // contra precisão; a avançada tem base e teto maiores
      const chance = limitar(
        (obs.avancado ? OBSERVACAO.avancada : OBSERVACAO.normal) + (alvo.haki.overall - c.haki.overall) / 100 + (alvo.at.agl - c.at.pre) / 100,
        0.05,
        obs.avancado ? OBSERVACAO.tetoAvancada : OBSERVACAO.tetoNormal,
      )
      if (rnd() < chance) {
        observados.set(alvo.id, true)
        ev.push({ t: 'golpe', de: c.id, alvo: alvo.id, dano: 0, efeito: 'observou' })
        // observação avançada: prevê e revida na hora (de perto)
        if (obs.avancado && revida(c, alvo)) {
          const d = Math.max(1, Math.round(atkDe(alvo) * FORCA * 0.8 * (1 - Math.min(60, defDe(c)) / 100) * (0.9 + rnd() * 0.2)))
          ev.push({ t: 'contra', de: alvo.id, alvo: c.id, dano: d })
          ferir(c, d)
        }
        return
      }
    }
    // esquiva normal
    const esquiva = limitar((alvo.at.agl - c.at.pre) * 2 + 5 - (s.precisao ?? 0), 0, 45) / 100 // luz: precisão 100 = não esquiva
    if (rnd() < esquiva) {
      ev.push({ t: 'golpe', de: c.id, alvo: alvo.id, dano: 0, efeito: 'esquivou' })
      return
    }
    const avancado = armamento && !!c.haki.armamento?.avancado
    let def = Math.min(60, defDe(alvo)) * (1 - (s.ignoraDef ?? 0)) * (armamento ? 1 - (avancado ? FURA_AVANCADO : FURA_ARMAMENTO) : 1)
    def = Math.max(0, def)
    const critico = rnd() < limitar((c.at.dex - alvo.at.con) * 2 + 5 + (s.critico ?? 0), 0, 75) / 100
    const bloqueio = !avancado && rnd() < limitar((alvo.at.res - c.at.con) * 2, 0, 40) / 100
    let dano = atkDe(c) * FORCA * mult * (1 - def / 100) * (0.9 + rnd() * 0.2)
    // Paramecia de borracha: contundente e tiro pela metade
    const origem = armaDaSkill(c, s)
    if (alvo.akuma?.fruta === 'borracha' && (origem === 'maca' || origem === 'espingarda') && !armamento) dano *= 0.5
    if (armamento) dano *= avancado ? MULT_AVANCADO : MULT_ARMAMENTO
    if (rei) dano *= REI_IMBUIDO.mult
    if (critico) dano *= 1.5
    if (bloqueio) dano *= 0.5
    const final = Math.max(1, Math.round(dano))
    const logiaSemCarga = !!alvo.logia && !armamento && !venceElemento
    ev.push({ t: 'golpe', de: c.id, alvo: alvo.id, dano: final, efeito: logiaSemCarga ? 'desgastado' : bloqueio ? 'bloqueou' : critico ? 'critico' : 'acertou' })
    espirito(c, ESPIRITO_AO_ACERTAR)
    ferir(alvo, final)
    if (alvo.hp > 0 && s.queima) alvo.queimadura = { ...s.queima }
    if (alvo.hp > 0 && s.congela && !alvo.atordoado && rnd() < s.congela) {
      alvo.atordoado = true
      ev.push({ t: 'congelou', id: alvo.id })
    }
    // Haki do Rei imbuído: atordoa quem tem Haki mais fraco
    if (rei && alvo.hp > 0) {
      if (rnd() < chanceHaki(c.haki.overall - alvo.haki.overall)) {
        alvo.atordoado = true
        ev.push({ t: 'atordoou', id: alvo.id })
      } else ev.push({ t: 'resistiu', id: alvo.id })
    }
  }

  return { golpear, ferir, espirito }
}

export function aplicar(anterior: Estado, a: Acao): Resultado {
  const m = motivo(anterior, a)
  if (m) return { erro: m }
  const e: Estado = structuredClone(anterior)
  const rnd = sorteador(e.semente)
  const ev: Evento[] = []
  const { golpear, espirito } = golpeador(rnd, ev, (c, alvo) => distancia(alvo.casa, c.casa) <= 1)
  let fimDaVez = false

  switch (a.t) {
    case 'mover': {
      const c = porId(e, a.id)!
      c.casa = { ...a.caminho[a.caminho.length - 1] }
      e.movimento -= a.caminho.length
      ev.push({ t: 'mover', id: c.id, caminho: a.caminho })
      break
    }
    case 'observar': {
      porId(e, a.id)!.observando = a.ligado
      break
    }
    case 'haki': {
      const c = porId(e, a.id)!
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
      const c = porId(e, a.id)!
      c.espirito -= HAOSHOKU.espirito
      ev.push({ t: 'haoshoku', id: c.id })
      for (const o of vivos(e, outro(c.lado))) {
        if (distancia(o.casa, c.casa) > HAOSHOKU.raio) continue
        if (rnd() < chanceHaki(c.haki.overall - o.haki.overall)) {
          o.atordoado = true
          ev.push({ t: 'atordoou', id: o.id })
        } else ev.push({ t: 'resistiu', id: o.id })
      }
      break
    }
    case 'skill': {
      const c = porId(e, a.id)!
      const s = skillsDe(c).find((x) => x.id === a.skill)!
      // o Haki que estiver ligado vai no ataque
      const armamento = c.armamentoLigado && (c.haki.armamento?.usos ?? 0) > 0
      const rei = armamento && c.reiLigado && c.espirito >= REI_IMBUIDO.espirito
      c.energia -= s.energia
      if (s.recarga) c.recargas[s.id] = s.recarga + 1 // conta a partir do fim desta vez
      if (armamento) c.haki.armamento!.usos--
      if (rei) c.espirito -= REI_IMBUIDO.espirito
      // acabou o recurso: desliga sozinho
      if (!c.haki.armamento?.usos) c.armamentoLigado = c.reiLigado = false
      if (c.espirito < REI_IMBUIDO.espirito) c.reiLigado = false
      const casas = casasDaArea(s, c.casa, a.alvo).filter(dentro)
      ev.push({ t: 'skill', id: c.id, skill: s.id, nome: s.nome, alvo: a.alvo, casas, armamento, rei })
      if (s.transforma && c.akuma) {
        c.akuma.transformado = s.transforma
        ev.push({ t: 'transformou', id: c.id, vezes: s.transforma })
        break
      }
      if (s.cura) {
        const o = ocupante(e, a.alvo)!
        const valor = Math.min(s.cura, o.hpMax - o.hp)
        o.hp += valor
        ev.push({ t: 'cura', de: c.id, alvo: o.id, valor })
        break
      }
      for (const casa of casas) {
        const alvo = ocupante(e, casa)
        // só acerta inimigos: companheiros não se ferem
        if (!alvo || alvo.lado === c.lado) continue
        for (let g = 0; g < (s.golpes ?? 1) && alvo.hp > 0 && c.hp > 0; g++) golpear(c, alvo, s, armamento, rei)
      }
      if (!c.haki.armamento?.usos) c.armamentoLigado = c.reiLigado = false
      break
    }
    case 'passar':
    case 'tempo': {
      if (a.t === 'tempo') {
        e.perdidas[e.vez]++
        ev.push({ t: 'tempo', lado: e.vez })
      }
      fimDaVez = true
      break
    }
  }
  // atacar encerra a vez, como no Sugoi
  // (buffs, transformação, profissão e o Haki do Rei em área não gastam a vez)
  if (a.t === 'skill' && !skillsDe(porId(e, a.id)!).find((x) => x.id === a.skill)?.livre) fimDaVez = true

  const acabou = ['piratas', 'marinha'].some((l) => !vivos(e, l as Lado).length)
  if (fimDaVez && !acabou) {
    // quem estava atordoado perdeu esta vez; as recargas andam uma vez
    for (const c of vivos(e, e.vez)) {
      c.atordoado = false
      for (const k of Object.keys(c.recargas)) if (--c.recargas[k] <= 0) delete c.recargas[k]
    }
    e.vez = outro(e.vez)
    e.turno++
    e.movimento = MOVIMENTO_POR_VEZ
    for (const c of vivos(e, e.vez)) {
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
      espirito(c, ESPIRITO_POR_VEZ)
      // armamento recupera com espírito
      const arm = c.haki.armamento
      // quem tem o Rei só usa o espírito que sobra acima do custo do Rei imbuído
      const reserva = c.haki.rei ? REI_IMBUIDO.espirito : 0
      if (arm && arm.usos < arm.max && c.espirito >= RECUPERA_ARMAMENTO.espirito + reserva) {
        c.espirito -= RECUPERA_ARMAMENTO.espirito
        arm.usos = Math.min(arm.max, arm.usos + RECUPERA_ARMAMENTO.usos)
        ev.push({ t: 'recuperou', id: c.id, usos: arm.usos })
      }
    }
    ev.push({ t: 'vez', lado: e.vez, turno: e.turno })
  }

  for (const lado of ['piratas', 'marinha'] as Lado[]) {
    if (!e.vencedor && !vivos(e, lado).length) {
      e.vencedor = outro(lado)
      ev.push({ t: 'fim', vencedor: e.vencedor })
    }
  }
  e.semente = Math.floor(rnd() * 2147483646) + 1
  return { estado: e, eventos: ev }
}
