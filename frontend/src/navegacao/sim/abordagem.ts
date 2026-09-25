/**
 * Abordagem: combate de tripulação por turnos, depois que um navio encosta
 * no outro avariado.
 *
 * A fórmula de dano é a do legado, portada linha a linha de
 * public/Regras/Combate/Formulas/Ataque.php:
 *   - esquiva  = clamp(AGL do alvo − PRE do atacante, 0, 50) %
 *   - crítico  = clamp(DEX do atacante − CON do alvo, 0, 50) %, dano extra
 *                de clamp(DEX − CON, 25, 90) %
 *   - bloqueio = clamp(RES do alvo − CON do atacante, 0, 50) %, bloqueia 90%
 *   - dano     = (ATK×10 + dano da habilidade) × redução de área × redução
 *                de distância − DEF×10, com piso de 30% do dano da habilidade
 *   - dano da habilidade vem da VONTADE da tripulação (calc_dano_vontade)
 *
 * O que NÃO veio ainda (protótipo): tabuleiro com movimento, akuma, haki,
 * efeitos (sangramento, veneno...) e as habilidades reais de cada classe.
 */

export type Atributos = { atk: number; def: number; agl: number; res: number; pre: number; dex: number; con: number; vit: number }

export type Habilidade = {
  cod: string
  nome: string
  descricao: string
  /** Multiplicador sobre o dano da vontade (campo `dano` do habilidades.yaml). */
  dano: number
  alvo: 'inimigo' | 'todos-inimigos' | 'aliado' | 'todos-aliados'
  /** Rodadas de espera depois de usar. */
  recarga: number
  cura?: boolean
}

export type Lado = 'nos' | 'eles'

export type Combatente = {
  id: string
  nome: string
  papel: string
  lado: Lado
  /** 0 = linha de frente, 1 = retaguarda (conta na distância). */
  fileira: 0 | 1
  atributos: Atributos
  hp: number
  hpMax: number
  habilidades: Habilidade[]
  recargas: Record<string, number>
}

export type Evento =
  | { tipo: 'dano'; de: string; para: string; habilidade: string; dano: number; critico: boolean; bloqueou: boolean; esquivou: boolean }
  | { tipo: 'cura'; de: string; para: string; habilidade: string; cura: number }
  | { tipo: 'caiu'; quem: string }
  | { tipo: 'rodada'; rodada: number }

export type Batalha = {
  combatentes: Combatente[]
  vontade: Record<Lado, number>
  rodada: number
  /** Ordem de ação da rodada (ids), por AGL. */
  fila: string[]
  vez: number
  eventos: Evento[]
  fim: 'vitoria' | 'derrota' | null
}

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** HP como no legado: base + VIT × 30 (Funcoes/personagens.php). */
export function hpMaximo(a: Atributos) {
  return 7400 + a.vit * 30
}

/** Ataque::calc_dano_vontade */
export function danoDaVontade(vontade: number, multiplicador: number) {
  const base = vontade <= 40 ? 1000 + vontade * 130 : 6500 * Math.pow(1.03, vontade - 40)
  return base * multiplicador
}

export function chanceEsquiva(at: Atributos, alvo: Atributos) {
  return Math.round(limitar(alvo.agl - at.pre, 0, 50))
}
export function chanceCritico(at: Atributos, alvo: Atributos) {
  return Math.round(limitar(at.dex - alvo.con, 0, 50))
}
export function danoCritico(at: Atributos, alvo: Atributos) {
  return limitar(at.dex - alvo.con, 25, 90) / 100
}
export function chanceBloqueio(at: Atributos, alvo: Atributos) {
  return Math.round(limitar(alvo.res - at.con, 0, 50))
}

export function criarBatalha(nos: Combatente[], eles: Combatente[]): Batalha {
  const b: Batalha = { combatentes: [...nos, ...eles], vontade: { nos: 8, eles: 8 }, rodada: 1, fila: [], vez: 0, eventos: [], fim: null }
  montarFila(b)
  b.eventos.push({ tipo: 'rodada', rodada: 1 })
  return b
}

function montarFila(b: Batalha) {
  b.fila = b.combatentes
    .filter((c) => c.hp > 0)
    .sort((x, y) => y.atributos.agl - x.atributos.agl || (x.lado === 'nos' ? -1 : 1))
    .map((c) => c.id)
  b.vez = 0
}

export function porId(b: Batalha, id: string) {
  return b.combatentes.find((c) => c.id === id)!
}

/** Quem age agora (pula quem caiu durante a rodada). */
export function daVez(b: Batalha): Combatente | null {
  while (b.vez < b.fila.length) {
    const c = porId(b, b.fila[b.vez])
    if (c.hp > 0) return c
    b.vez++
  }
  return null
}

export function vivos(b: Batalha, lado: Lado) {
  return b.combatentes.filter((c) => c.lado === lado && c.hp > 0)
}

export function disponivel(c: Combatente, h: Habilidade) {
  return (c.recargas[h.cod] ?? 0) <= 0
}

/** Alvos possíveis para uma habilidade. */
export function alvosPossiveis(b: Batalha, c: Combatente, h: Habilidade) {
  const outro: Lado = c.lado === 'nos' ? 'eles' : 'nos'
  return h.alvo === 'inimigo' || h.alvo === 'todos-inimigos' ? vivos(b, outro) : vivos(b, c.lado)
}

/** Executa a ação de quem está na vez e avança o turno. */
export function agir(b: Batalha, habilidadeCod: string, alvoId: string | null, aleatorio: () => number = Math.random) {
  const at = daVez(b)
  if (!at || b.fim) return
  const h = at.habilidades.find((x) => x.cod === habilidadeCod)
  if (!h || !disponivel(at, h)) return

  const candidatos = alvosPossiveis(b, at, h)
  const alvos = h.alvo.startsWith('todos') ? candidatos : candidatos.filter((c) => c.id === alvoId)
  if (alvos.length === 0) return

  const danoHab = danoDaVontade(b.vontade[at.lado], h.dano)
  for (const alvo of alvos) {
    if (h.cura) {
      const cura = Math.round(danoHab * 0.55)
      alvo.hp = Math.min(alvo.hpMax, alvo.hp + cura)
      b.eventos.push({ tipo: 'cura', de: at.id, para: alvo.id, habilidade: h.nome, cura })
      continue
    }
    const e = { tipo: 'dano' as const, de: at.id, para: alvo.id, habilidade: h.nome, dano: 0, critico: false, bloqueou: false, esquivou: false }
    if (aleatorio() * 100 <= chanceEsquiva(at.atributos, alvo.atributos)) {
      e.esquivou = true
    } else {
      const distancia = 1 + at.fileira + alvo.fileira
      const reducaoDistancia = 1 - Math.max(0, distancia - 1.5) * 0.02
      const reducaoArea = 1 - Math.max(0, alvos.length - 1) * 0.1
      let dano = (at.atributos.atk * 10 + danoHab) * reducaoArea * reducaoDistancia
      dano = Math.max(danoHab * 0.3, dano - alvo.atributos.def * 10)
      if (aleatorio() * 100 <= chanceCritico(at.atributos, alvo.atributos)) {
        e.critico = true
        dano += danoCritico(at.atributos, alvo.atributos) * dano
      }
      if (aleatorio() * 100 <= chanceBloqueio(at.atributos, alvo.atributos)) {
        e.bloqueou = true
        dano -= 0.9 * dano
      }
      e.dano = Math.max(1, Math.round(dano))
      alvo.hp = Math.max(0, alvo.hp - e.dano)
    }
    b.eventos.push(e)
    if (alvo.hp <= 0) b.eventos.push({ tipo: 'caiu', quem: alvo.id })
  }

  at.recargas[h.cod] = h.recarga + 1
  avancar(b)
}

function avancar(b: Batalha) {
  if (vivos(b, 'eles').length === 0) b.fim = 'vitoria'
  else if (vivos(b, 'nos').length === 0) b.fim = 'derrota'
  if (b.fim) return

  b.vez++
  if (daVez(b)) return
  // Fim da rodada: a vontade cresce (Combate::incrementa_vontade) e as recargas andam.
  b.rodada++
  b.vontade.nos = Math.min(40, b.vontade.nos + 2)
  b.vontade.eles = Math.min(40, b.vontade.eles + 2)
  for (const c of b.combatentes) for (const k of Object.keys(c.recargas)) c.recargas[k] = Math.max(0, c.recargas[k] - 1)
  b.eventos.push({ tipo: 'rodada', rodada: b.rodada })
  montarFila(b)
}

/**
 * IA simples: cura quem está mal, usa golpe em área se há vários alvos,
 * senão o golpe mais forte disponível no inimigo com menos HP.
 */
export function decidirIA(b: Batalha): { habilidade: string; alvo: string | null } | null {
  const c = daVez(b)
  if (!c) return null
  const prontas = c.habilidades.filter((h) => disponivel(c, h))
  const aliadoMal = vivos(b, c.lado).sort((x, y) => x.hp / x.hpMax - y.hp / y.hpMax)[0]
  const cura = prontas.find((h) => h.cura)
  if (cura && aliadoMal && aliadoMal.hp < aliadoMal.hpMax * 0.45) {
    return { habilidade: cura.cod, alvo: cura.alvo === 'aliado' ? aliadoMal.id : null }
  }
  const inimigos = vivos(b, c.lado === 'nos' ? 'eles' : 'nos').sort((x, y) => x.hp - y.hp)
  const area = prontas.find((h) => h.alvo === 'todos-inimigos')
  if (area && inimigos.length >= 3) return { habilidade: area.cod, alvo: null }
  const golpe = prontas.filter((h) => h.alvo === 'inimigo').sort((x, y) => y.dano - x.dano)[0]
  return golpe ? { habilidade: golpe.cod, alvo: inimigos[0]?.id ?? null } : null
}

// ---- Tripulações do protótipo -------------------------------------------------------------

type Molde = { nome: string; papel: string; fileira: 0 | 1; atributos: Atributos; habilidades: Habilidade[] }

const h = (cod: string, nome: string, descricao: string, dano: number, alvo: Habilidade['alvo'], recarga: number, cura = false): Habilidade => ({
  cod,
  nome,
  descricao,
  dano,
  alvo,
  recarga,
  cura,
})

const PIRATAS: Molde[] = [
  {
    nome: 'Capitão',
    papel: 'Lutador',
    fileira: 0,
    atributos: { atk: 70, def: 45, agl: 40, res: 45, pre: 45, dex: 40, con: 45, vit: 70 },
    habilidades: [
      h('soco', 'Soco', 'Golpe direto em um inimigo.', 1, 'inimigo', 0),
      h('giro', 'Golpe Giratório', 'Acerta todos os inimigos.', 0.75, 'todos-inimigos', 2),
      h('explosao', 'Soco Explosivo', 'Golpe pesado em um inimigo.', 1.8, 'inimigo', 3),
    ],
  },
  {
    nome: 'Espadachim',
    papel: 'Espadachim',
    fileira: 0,
    atributos: { atk: 75, def: 40, agl: 50, res: 35, pre: 55, dex: 70, con: 35, vit: 50 },
    habilidades: [
      h('corte', 'Corte', 'Corte rápido em um inimigo.', 1, 'inimigo', 0),
      h('corte-duplo', 'Corte Duplo', 'Dois cortes seguidos: dano alto.', 1.5, 'inimigo', 2),
      h('tornado', 'Tornado de Lâminas', 'Acerta todos os inimigos.', 0.85, 'todos-inimigos', 3),
    ],
  },
  {
    nome: 'Atiradora',
    papel: 'Atiradora',
    fileira: 1,
    atributos: { atk: 55, def: 30, agl: 60, res: 30, pre: 80, dex: 60, con: 30, vit: 40 },
    habilidades: [
      h('tiro', 'Tiro', 'Tiro preciso de longe.', 1, 'inimigo', 0),
      h('certeiro', 'Tiro Certeiro', 'Mira no ponto fraco.', 1.7, 'inimigo', 2),
      h('chuva', 'Chuva de Balas', 'Acerta todos os inimigos.', 0.7, 'todos-inimigos', 3),
    ],
  },
  {
    nome: 'Médica',
    papel: 'Médica',
    fileira: 1,
    atributos: { atk: 35, def: 35, agl: 50, res: 50, pre: 40, dex: 35, con: 50, vit: 45 },
    habilidades: [
      h('golpe', 'Golpe', 'Ataque simples.', 0.8, 'inimigo', 0),
      h('curativo', 'Curativo', 'Recupera a vida de um aliado.', 1.2, 'aliado', 2, true),
      h('remedio', 'Remédio da Tripulação', 'Recupera um pouco de todos.', 0.6, 'todos-aliados', 4, true),
    ],
  },
]

const MARINHA: Molde[] = [
  {
    nome: 'Capitão da Patrulha',
    papel: 'Oficial',
    fileira: 0,
    atributos: { atk: 65, def: 50, agl: 38, res: 50, pre: 45, dex: 40, con: 45, vit: 65 },
    habilidades: [
      h('sabre', 'Golpe de Sabre', 'Golpe firme em um inimigo.', 1, 'inimigo', 0),
      h('investida', 'Investida', 'Golpe pesado.', 1.6, 'inimigo', 3),
      h('ordem', 'Ordem de Fogo', 'A tripulação atira em todos.', 0.7, 'todos-inimigos', 3),
    ],
  },
  {
    nome: 'Sargento',
    papel: 'Sargento',
    fileira: 0,
    atributos: { atk: 60, def: 45, agl: 42, res: 40, pre: 45, dex: 45, con: 40, vit: 55 },
    habilidades: [
      h('baioneta', 'Baioneta', 'Estocada em um inimigo.', 1, 'inimigo', 0),
      h('rajada', 'Rajada', 'Tiros em todos os inimigos.', 0.65, 'todos-inimigos', 3),
    ],
  },
  {
    nome: 'Marinheiro',
    papel: 'Mosqueteiro',
    fileira: 1,
    atributos: { atk: 50, def: 35, agl: 45, res: 35, pre: 60, dex: 45, con: 35, vit: 40 },
    habilidades: [h('mosquete', 'Mosquete', 'Tiro de mosquete.', 1, 'inimigo', 0), h('mira', 'Mira Firme', 'Tiro cuidadoso.', 1.4, 'inimigo', 2)],
  },
  {
    nome: 'Enfermeiro',
    papel: 'Enfermeiro',
    fileira: 1,
    atributos: { atk: 35, def: 35, agl: 45, res: 45, pre: 40, dex: 35, con: 45, vit: 40 },
    habilidades: [h('cassetete', 'Cassetete', 'Golpe simples.', 0.8, 'inimigo', 0), h('primeiros', 'Primeiros Socorros', 'Cura um aliado.', 1.1, 'aliado', 2, true)],
  },
]

function montar(moldes: Molde[], lado: Lado, vidaInicial: number, prefixo: string): Combatente[] {
  return moldes.map((m, i) => {
    const hpMax = hpMaximo(m.atributos)
    return {
      id: `${prefixo}${i}`,
      nome: m.nome,
      papel: m.papel,
      lado,
      fileira: m.fileira,
      atributos: m.atributos,
      hpMax,
      hp: Math.round(hpMax * vidaInicial),
      habilidades: m.habilidades,
      recargas: {},
    }
  })
}

/**
 * A abordagem herda o estado do combate naval: quanto mais o casco
 * inimigo apanhou, mais feridos estão os marujos dele.
 */
export function batalhaDeAbordagem(tipoJogador: 'pirata' | 'marinha', cascoInimigo: number, cascoJogador: number) {
  const nossos = tipoJogador === 'pirata' ? PIRATAS : MARINHA
  const deles = tipoJogador === 'pirata' ? MARINHA : PIRATAS
  return criarBatalha(
    montar(nossos, 'nos', 0.65 + 0.35 * cascoJogador, 'n'),
    montar(deles, 'eles', 0.45 + 0.4 * cascoInimigo, 'e'),
  )
}
