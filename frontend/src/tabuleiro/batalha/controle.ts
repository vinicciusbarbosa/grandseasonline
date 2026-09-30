/**
 * Controle da batalha na tela: o jogador planeja o turno dos piratas no
 * tabuleiro (tocar no pirata → casa azul para andar → inimigo vermelho para
 * atacar; golpe e postura no painel), confirma, a IA planeja a Marinha, as
 * regras resolvem e a cena anima os eventos na ordem.
 *
 * Não desenha nada sozinho: pede ao `Palco` (a cena) para marcar casas,
 * mostrar textos e mexer os personagens.
 */

import { mesmaCasa, type Casa } from '../tabuleiro'
import type { Personagem } from '../cena/personagem'
import { combatentesIniciais } from './elenco'
import { planejarIA } from './ia'
import {
  CUSTO,
  casasDeMovimento,
  criarBatalha,
  distancia,
  porId,
  resolverTurno,
  sorteador,
  vivos,
  type Combatente,
  type Estado,
  type Evento,
  type Golpe,
  type Lado,
  type Plano,
  type Postura,
} from './regras'

export type Marca = 'mover' | 'alvo' | 'cura' | 'destino'

export interface Palco {
  personagem(id: string): Personagem | undefined
  marcar(c: Casa, tipo: Marca): void
  limparMarcas(): void
  flutuar(p: Personagem, texto: string, cor: string, linha?: number): void
  sumir(p: Personagem): void
  /** o estado da tela mudou (HUD) */
  avisar(): void
}

export const NOME_GOLPE: Record<Golpe, string> = { comum: 'Comum', pesado: 'Pesado', finta: 'Finta' }
export const NOME_POSTURA: Record<Postura, string> = { bloquear: 'Bloquear', esquivar: 'Esquivar', aparar: 'Aparar', contra: 'Contra-atacar' }

const JOGADOR: Lado = 'piratas'

export type RetratoBatalha = {
  fase: 'planejar' | 'resolver' | 'fim'
  rodada: number
  vontade: Record<Lado, number>
  /** vontade dos piratas que sobra depois das posturas já escolhidas */
  vontadeLivre: number
  vencedor: Lado | 'empate' | null
  tripulacao: { id: string; nome: string; hp: number; hpMax: number; planejado: boolean }[]
  selecionado: null | {
    id: string
    nome: string
    papel: string
    hp: number
    hpMax: number
    golpe: Golpe
    postura: Postura
    alvo: string | null
    acao: 'atacar' | 'curar' | null
    cura: boolean
  }
  dica: string
}

export class ControleBatalha {
  private estado: Estado
  private planos: Record<string, Plano> = {}
  /** golpe escolhido de cada pirata (fica mesmo sem alvo ainda) */
  private golpes: Record<string, Golpe> = {}
  private sel: string | null = null
  private fase: RetratoBatalha['fase'] = 'planejar'
  private dica = 'Toque num pirata para planejar o turno.'
  private movimento: ReturnType<typeof casasDeMovimento> | null = null
  private readonly palco: Palco

  constructor(palco: Palco) {
    this.palco = palco
    this.estado = criarBatalha(combatentesIniciais())
  }

  get combatentes() {
    return this.estado.combatentes
  }

  // ------------------------------------------------------------ planejar
  private plano(id: string): Plano {
    return (this.planos[id] ??= { caminho: [], acao: null, postura: 'bloquear' })
  }

  /** Onde o personagem estará no fim do movimento planejado. */
  private destino(c: Combatente) {
    const p = this.planos[c.id]
    return p?.caminho.length ? p.caminho[p.caminho.length - 1] : c.casa
  }

  private vontadeLivre(exceto?: string) {
    const gasto = Object.entries(this.planos)
      .filter(([id]) => id !== exceto)
      .reduce((s, [, p]) => s + CUSTO[p.postura], 0)
    return this.estado.vontade[JOGADOR] - gasto
  }

  clique(alvo: { casa: Casa; personagem: Personagem | null } | null) {
    if (this.fase !== 'planejar') return
    if (!alvo) return this.selecionar(null)
    const cAlvo = alvo.personagem ? porId(this.estado, alvo.personagem.id) : null
    const sel = this.sel ? porId(this.estado, this.sel) : null
    if (cAlvo && cAlvo.hp > 0) {
      if (sel && cAlvo.id === sel.id) {
        // tocar de novo no próprio pirata: se tinha caminho, volta a ficar parado
        if (this.plano(sel.id).caminho.length) {
          this.plano(sel.id).caminho = []
          return this.redesenhar()
        }
        return this.selecionar(null)
      }
      if (sel && cAlvo.lado !== JOGADOR) return this.definirAlvo(sel, cAlvo, 'atacar')
      if (sel && sel.cura && cAlvo.lado === JOGADOR) return this.definirAlvo(sel, cAlvo, 'curar')
      if (cAlvo.lado === JOGADOR) return this.selecionar(cAlvo.id)
      this.dica = 'Escolha primeiro um pirata.'
      return this.palco.avisar()
    }
    if (sel && this.movimento?.caminho(alvo.casa) && !this.destinoOcupado(alvo.casa, sel.id)) {
      this.plano(sel.id).caminho = this.movimento.caminho(alvo.casa)!
      // alvo que saiu do alcance a partir do novo destino continua valendo:
      // as regras conferem na hora (ele também pode vir para perto)
      this.dica = `${sel.nome}: agora toque num inimigo para atacar.`
      return this.redesenhar()
    }
    this.selecionar(null)
  }

  private destinoOcupado(casa: Casa, id: string) {
    return vivos(this.estado, JOGADOR).some((o) => o.id !== id && this.planos[o.id]?.caminho.length && mesmaCasa(this.destino(o), casa))
  }

  private definirAlvo(sel: Combatente, alvo: Combatente, tipo: 'atacar' | 'curar') {
    const de = this.destino(sel)
    const alc = tipo === 'curar' ? sel.cura!.alcance : sel.alcance
    const p = this.plano(sel.id)
    p.acao = tipo === 'curar' ? { tipo, alvo: alvo.id } : { tipo, alvo: alvo.id, golpe: this.golpes[sel.id] ?? 'comum' }
    this.dica =
      distancia(de, alvo.casa) <= alc
        ? `${sel.nome} vai ${tipo === 'curar' ? 'curar' : 'atacar'} ${alvo.nome}.`
        : `${alvo.nome} está fora de alcance daí — só acerta se ele chegar perto.`
    this.redesenhar()
  }

  selecionar(id: string | null) {
    this.sel = id
    if (id) {
      const c = porId(this.estado, id)!
      this.dica = `${c.nome}: casa azul anda, inimigo vermelho ataca${c.cura ? ', aliado verde cura' : ''}.`
    } else this.dica = 'Toque num pirata para planejar o turno.'
    this.redesenhar()
  }

  escolherGolpe(g: Golpe) {
    if (!this.sel) return
    this.golpes[this.sel] = g
    const a = this.planos[this.sel]?.acao
    if (a?.tipo === 'atacar') a.golpe = g
    this.palco.avisar()
  }

  escolherPostura(p: Postura) {
    if (!this.sel) return
    if (CUSTO[p] > this.vontadeLivre(this.sel)) {
      this.dica = 'Vontade insuficiente para essa postura.'
      return this.palco.avisar()
    }
    this.plano(this.sel).postura = p
    this.redesenhar()
  }

  limparPlano() {
    if (!this.sel) return
    delete this.planos[this.sel]
    this.redesenhar()
  }

  private redesenhar() {
    this.palco.limparMarcas()
    this.movimento = null
    // destinos planejados de todos
    for (const c of vivos(this.estado, JOGADOR)) if (this.planos[c.id]?.caminho.length) this.palco.marcar(this.destino(c), 'destino')
    const sel = this.sel ? porId(this.estado, this.sel) : null
    if (sel && this.fase === 'planejar') {
      const outros = vivos(this.estado, JOGADOR)
        .filter((o) => o.id !== sel.id && this.planos[o.id]?.caminho.length)
        .map((o) => this.destino(o))
      this.movimento = casasDeMovimento(this.estado, sel, outros)
      for (const c of this.movimento.casas) if (!outros.some((o) => mesmaCasa(o, c))) this.palco.marcar(c, 'mover')
      const de = this.destino(sel)
      for (const o of vivos(this.estado)) {
        if (o.lado !== JOGADOR && distancia(de, o.casa) <= sel.alcance) this.palco.marcar(o.casa, 'alvo')
        if (sel.cura && o.lado === JOGADOR && distancia(de, o.casa) <= sel.cura.alcance) this.palco.marcar(o.casa, 'cura')
      }
    }
    this.palco.avisar()
  }

  // ------------------------------------------------------------ resolver
  async confirmar() {
    if (this.fase !== 'planejar') return
    this.sel = null
    this.palco.limparMarcas()
    this.fase = 'resolver'
    this.dica = 'Resolvendo o turno…'
    this.palco.avisar()
    const ia = planejarIA(this.estado, 'marinha', sorteador(this.estado.semente ^ 0x5bd1e995))
    const { estado, eventos } = resolverTurno(this.estado, { ...this.planos, ...ia })
    await this.animar(eventos)
    this.estado = estado
    for (const c of estado.combatentes) {
      const p = this.palco.personagem(c.id)
      if (p) p.vida = c.hp
    }
    this.planos = {}
    this.fase = estado.vencedor ? 'fim' : 'planejar'
    this.dica = estado.vencedor ? '' : `Rodada ${estado.rodada}: planeje o turno.`
    this.redesenhar()
  }

  novaBatalha() {
    location.reload()
  }

  private async animar(eventos: Evento[]) {
    const P = (id: string) => this.palco.personagem(id)
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (let i = 0; i < eventos.length; i++) {
      const e = eventos[i]
      switch (e.t) {
        case 'mover': {
          const p = P(e.id)
          if (p) await new Promise<void>((r) => p.andar(e.caminho, r))
          break
        }
        case 'atacar': {
          const a = P(e.id)
          const b = P(e.alvo)
          const res = eventos[i + 1]
          if (!a || !b) break
          await new Promise<void>((r) =>
            a.atacar(b, () => {
              if (res?.t === 'golpe') this.mostrarGolpe(res, a, b)
              else if (res?.t === 'fora') this.palco.flutuar(a, 'Fora de alcance', '#bbbbbb')
              r()
            }),
          )
          if (res?.t === 'golpe' || res?.t === 'fora') i++
          await esperar(450)
          break
        }
        case 'contra': {
          const a = P(e.de)
          const b = P(e.alvo)
          if (!a || !b) break
          this.palco.flutuar(a, 'Contra-ataque!', '#ff9a7a', 1)
          await new Promise<void>((r) =>
            a.atacar(b, () => {
              b.sofrer(e.dano, a)
              this.palco.flutuar(b, `-${e.dano}`, '#ffe27a')
              r()
            }),
          )
          await esperar(450)
          break
        }
        case 'curar': {
          const a = P(e.de)
          const b = P(e.alvo)
          if (!a || !b) break
          if (a !== b) a.olharPara(b.casa)
          b.vida = Math.min(b.vidaMax, b.vida + e.valor)
          this.palco.flutuar(b, `+${e.valor}`, '#7dff8a')
          await esperar(700)
          break
        }
        case 'fora': {
          const a = P(e.id)
          if (a) this.palco.flutuar(a, 'Fora de alcance', '#bbbbbb')
          await esperar(500)
          break
        }
        case 'caiu': {
          const p = P(e.id)
          if (p) {
            this.palco.flutuar(p, 'Caiu!', '#ff6a6a', 1)
            this.palco.sumir(p)
          }
          await esperar(600)
          break
        }
        default:
          break
      }
    }
  }

  private mostrarGolpe(g: Extract<Evento, { t: 'golpe' }>, a: Personagem, b: Personagem) {
    const texto: Record<typeof g.efeito, string> = {
      acertou: '',
      bloqueou: 'Bloqueou',
      esquivou: 'Esquivou!',
      aparou: 'Aparou!',
      quebrou: 'Quebrou a guarda!',
      enganou: 'Finta!',
    }
    if (texto[g.efeito]) this.palco.flutuar(b, texto[g.efeito], g.efeito === 'esquivou' || g.efeito === 'aparou' ? '#9fe0ff' : '#ffb46a', 1)
    if (g.dano > 0) {
      b.sofrer(g.dano, a)
      this.palco.flutuar(b, `${g.critico ? 'Crítico! ' : ''}-${g.dano}`, g.critico ? '#ff5a4a' : '#ffe27a')
    }
  }

  // ------------------------------------------------------------ HUD
  retrato(): RetratoBatalha {
    const s = this.sel ? porId(this.estado, this.sel) : null
    const p = s ? this.planos[s.id] : undefined
    return {
      fase: this.fase,
      rodada: this.estado.rodada,
      vontade: { ...this.estado.vontade },
      vontadeLivre: this.vontadeLivre(),
      vencedor: this.estado.vencedor,
      tripulacao: this.estado.combatentes
        .filter((c) => c.lado === JOGADOR)
        .map((c) => ({ id: c.id, nome: c.nome, hp: this.palco.personagem(c.id)?.vida ?? c.hp, hpMax: c.hpMax, planejado: !!this.planos[c.id]?.acao || !!this.planos[c.id]?.caminho.length })),
      selecionado: s
        ? {
            id: s.id,
            nome: s.nome,
            papel: s.papel,
            hp: s.hp,
            hpMax: s.hpMax,
            golpe: this.golpes[s.id] ?? 'comum',
            postura: p?.postura ?? 'bloquear',
            alvo: p?.acao?.alvo ?? null,
            acao: p?.acao?.tipo ?? null,
            cura: !!s.cura,
          }
        : null,
      dica: this.dica,
    }
  }
}
