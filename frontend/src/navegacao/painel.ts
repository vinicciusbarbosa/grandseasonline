import type { InfoCombate } from './cena/CombateNaval'
import type { Mundo } from './mundo/Mundo'
import type { Batalha } from './sim/abordagem'
import type { Lado } from './sim/combateNaval'
import type { Descoberta } from './sim/descoberta'
import type { TipoNavio } from './sim/navios'

/**
 * Ponte entre a cena (Phaser) e o HUD (React). A cena publica um retrato do
 * estado umas dez vezes por segundo; o React assina com useSyncExternalStore.
 * Comandos vão no sentido contrário, pela interface `ControleNavegacao`.
 */
export type SituacaoNavio = 'atracado' | 'parado' | 'navegando' | 'indo-atracar' | 'redemoinho' | 'capturado' | 'naufragado'

export type RetratoNavegacao = {
  navio: TipoNavio
  situacao: SituacaoNavio
  ilhaAtual: string | null
  destino: string | null
  mar: string
  coordenada: string
  /** Em nós (1 nó = 12 px/s). */
  velocidade: number
  velocidadeMax: number
  rumo: number
  ventoDirecao: number
  ventoIntensidade: number
  /** Multiplicador de velocidade que o vento está dando agora. */
  fatorVento: number
  naCorrente: boolean
  velas: 'cheias' | 'a-re' | 'panejando' | 'frouxas'
  /** 0–1: intensidade da tempestade onde o navio está. */
  tempestade: number
  som: boolean
  zonaSegura: boolean
  descoberto: number
  escalaTempo: number
  grade: boolean
  posicao: { x: number; y: number }
  aviso: string | null
  combate: InfoCombate
  emAbordagem: boolean
  berries: number
}

export interface ControleNavegacao {
  trocarNavio(tipo: TipoNavio): void
  alternarGrade(): void
  alternarSom(): void
  irParaTempestade(): void
  irParaRedemoinho(): void
  definirEscalaTempo(escala: number): void
  navegarPara(x: number, y: number): void
  esquecerDescoberta(): void
  disparar(lado: Lado): void
  abordar(): Batalha | null
  terminarAbordagem(): void
}

type Ouvinte = () => void

class PainelNavegacao {
  /** Dados de leitura para o minimapa. A cena preenche ao ser criada. */
  fontes: { mundo: Mundo; descoberta: Descoberta; rota: () => { x: number; y: number }[] | null } | null = null
  private retrato: RetratoNavegacao | null = null
  private ouvintes = new Set<Ouvinte>()

  assinar = (ouvinte: Ouvinte) => {
    this.ouvintes.add(ouvinte)
    return () => this.ouvintes.delete(ouvinte)
  }

  obter = () => this.retrato

  publicar(retrato: RetratoNavegacao) {
    this.retrato = retrato
    for (const ouvinte of this.ouvintes) ouvinte()
  }
}

export const painelNavegacao = new PainelNavegacao()
