/**
 * Protocolo do multiplayer beta (WebSocket em /mp, JSON).
 *
 * O servidor só repassa e arbitra o básico (vagas na sala, relógio, placar).
 * Cada cliente é dono do próprio navio: simula o movimento, decide os acertos
 * das SUAS salvas e aplica o dano que RECEBE. É simples e responsivo para um
 * teste entre dois amigos; a versão de verdade é autoritativa no servidor C#.
 */

export type NavioMp = 'pirata' | 'marinha'

export type JogadorMp = {
  id: string
  nome: string
  navio: NavioMp
  ilha: string
  /** Navios inimigos afundados por ele. */
  abates: number
}

/** Retrato do navio de um jogador, enviado ~15× por segundo. */
export type EstadoMp = {
  x: number
  y: number
  rumo: number
  v: number
  mx: number
  my: number
  casco: number
  cascoMax: number
  velas: number
  velasMax: number
  naufragio: number | null
}

export type DisparoMp = {
  ox: number
  oy: number
  dx: number
  dy: number
  acerta: boolean
  voo: number
  atraso: number
  dano: number
}

export type LadoMp = 'bombordo' | 'boreste'

export type MsgCliente =
  | { t: 'entrar'; nome: string; navio: NavioMp; ilha: string }
  | { t: 'estado'; e: EstadoMp }
  | { t: 'salva'; lado: LadoMp; disparos: DisparoMp[] }
  | { t: 'afundei'; por: string | null }
  | { t: 'ping'; c: number }

export type MsgServidor =
  | { t: 'bemvindo'; id: string; relogio: number; jogadores: JogadorMp[] }
  | { t: 'cheio' }
  | { t: 'jogadores'; jogadores: JogadorMp[] }
  | { t: 'estado'; id: string; e: EstadoMp }
  | { t: 'salva'; id: string; lado: LadoMp; disparos: DisparoMp[] }
  | { t: 'afundou'; id: string; por: string | null }
  | { t: 'saiu'; id: string; nome: string }
  | { t: 'pong'; c: number; relogio: number }

export const MAX_JOGADORES = 2
