import type { Config } from './elenco'
import type { Acao, Lado, ModoVez } from './regras'

/**
 * Batalha multiplayer (WebSocket em /mpb, no mesmo servidor do Vite): dois
 * jogadores, um em cada navio. O servidor guarda o estado da batalha e roda
 * as mesmas regras (são determinísticas pela semente): valida cada ação, a
 * repassa aos dois na mesma ordem e cada um anima do seu lado.
 *
 * Duas salas: /mpb (vez da tripulação) e /mpb-fila (fila única por AGL).
 *
 * Fluxo: sala (os dois entram) → preparação (até 5 min: cada um monta a sua
 * tripulação; começa quando os dois dão Pronto ou o tempo acaba) → Haki
 * (10 s para ligar o Haki) → vezes alternadas até o fim.
 */

export const PREPARO_MP = 5 * 60 // s
export const PREPARO_HAKI_MP = 10 // s
/** folga do servidor sobre o tempo da vez (as animações correm nos clientes) */
export const FOLGA_VEZ_MP = 15 // s

export type JogadorBatalhaMp = { nome: string; lado: Lado; pronto: boolean }
/** Haki ligado de um tripulante no fim da preparação */
export type HakiMp = { id: string; armamento: boolean; observacao: boolean }

export type MsgClienteBatalha =
  | { t: 'entrar'; nome: string }
  /** a montagem da própria tripulação (só as linhas do seu lado contam) */
  | { t: 'config'; config: Config[] }
  | { t: 'pronto'; pronto: boolean }
  | { t: 'haki'; haki: HakiMp[] }
  | { t: 'acao'; acao: Acao }

export type MsgServidorBatalha =
  | { t: 'bemvindo'; lado: Lado; nomes: string[] }
  | { t: 'cheio' }
  /** a sala: quem está, quem deu pronto e quanto falta da preparação (s; null = esperando o oponente) */
  | { t: 'sala'; jogadores: JogadorBatalhaMp[]; restam: number | null }
  /** a preparação acabou: a montagem dos dois lados e a semente da batalha */
  | { t: 'comecar'; config: Config[]; semente: number; modo?: ModoVez }
  /** a preparação de Haki acabou: o que cada um ligou */
  | { t: 'iniciar'; haki: HakiMp[] }
  /** ação aceita (n = ordem), para os dois aplicarem */
  | { t: 'acao'; n: number; acao: Acao }
  | { t: 'erro'; texto: string }
  | { t: 'saiu'; nome: string }
