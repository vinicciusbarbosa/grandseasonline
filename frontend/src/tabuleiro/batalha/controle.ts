/**
 * Controle da batalha na tela (protótipo de teste — vez da tripulação).
 *
 * Preparação: escolhe a Akuma no Mi e o Haki de cada personagem.
 * Sua vez: toque num pirata → casas azuis andam (gasta o movimento da
 * tripulação); escolha uma skill no painel → casas vermelhas são alvos
 * válidos; toque num alvo para ver a área e toque de novo para usar
 * (gasta 1 ação e a energia). Liga o Haki de armamento / do Rei no painel.
 * Vez da Marinha: a IA joga, uma ação de cada vez, animada.
 *
 * Não desenha nada sozinho: pede ao `Palco` (a cena).
 */

import * as THREE from 'three'
import { mesmaCasa, type Casa } from '../tabuleiro'
import type { Personagem } from '../cena/personagem'
import type { Paleta, TipoEfeito } from '../cena/efeitos'
import { FRUTAS, alvoValido, casasDaArea, type Skill } from './armas'
import { TRIPULACOES, combatentesIniciais } from './elenco'
import { proximaAcao } from './ia'
import {
  HAOSHOKU,
  REI_IMBUIDO,
  TEMPO_POR_VEZ,
  aplicar,
  criarBatalha,
  motivo,
  movimentos,
  porId,
  skillsDe,
  vivos,
  type Acao,
  type Combatente,
  type Estado,
  type Evento,
  type Lado,
} from './regras'

export type Marca = 'mover' | 'alvo' | 'cura' | 'destino' | 'area'

export interface Palco {
  personagem(id: string): Personagem | undefined
  marcar(c: Casa, tipo: Marca): void
  limparMarcas(): void
  flutuar(p: Personagem, texto: string, cor: string, linha?: number): void
  sumir(p: Personagem): void
  /** efeito visual; resolve quando termina (ou o projétil chega) */
  efeito(tipo: TipoEfeito, paleta: Paleta, de: THREE.Vector3, op?: { para?: THREE.Vector3; dur?: number; escala?: number }): Promise<void>
  /** ponto do peito do personagem / centro da casa (mundo) */
  peito(p: Personagem): THREE.Vector3
  centro(c: Casa): THREE.Vector3
  hakiDoRei(p: Personagem): void
  tremer(s: number): void
  /** esquiva da observação: passo de lado com rastro */
  esquivar(p: Personagem, de: Personagem): Promise<void>
  /** Logia: o golpe atravessa (corpo vira elemento e volta) */
  atravessar(p: Personagem, elemento: string): Promise<void>
  /** aproxima a câmera nesses pontos (null volta ao que era) */
  focar(pontos: THREE.Vector3[] | null): void
  /** choque de dois Haki do Rei: explosão de raios negros e vermelhos */
  choqueRei(ponto: THREE.Vector3): void
  avisar(): void
}

const JOGADOR: Lado = 'piratas'

/** Como cada skill aparece: animação do corpo e efeito. */
type Visual = { efeito: TipoEfeito; modo: 'perto' | 'projetil' | 'area' | 'si'; escala?: number; tiros?: number }
const VISUAL: Record<string, Visual> = {
  corte: { efeito: 'impacto', modo: 'perto' },
  'corte-duplo': { efeito: 'impacto', modo: 'perto' },
  'corte-voador': { efeito: 'corte', modo: 'projetil', escala: 1.1 },
  'estocada-perfurante': { efeito: 'impacto', modo: 'area' },
  'tornado-laminas': { efeito: 'tornado', modo: 'si', escala: 2.6 },
  pancada: { efeito: 'impacto', modo: 'perto' },
  esmagar: { efeito: 'impacto', modo: 'perto', escala: 1.3 },
  'onda-choque': { efeito: 'onda', modo: 'si', escala: 3.2 },
  tremor: { efeito: 'onda', modo: 'area' },
  'martelada-titanica': { efeito: 'impacto', modo: 'perto', escala: 1.8 },
  tiro: { efeito: 'bala', modo: 'projetil', escala: 0.6 },
  'tiro-certeiro': { efeito: 'bala', modo: 'projetil', escala: 0.8 },
  'chumbo-grosso': { efeito: 'bala', modo: 'projetil', escala: 0.5, tiros: 3 },
  rajada: { efeito: 'bala', modo: 'projetil', escala: 0.55, tiros: 3 },
  'tiro-perfurante': { efeito: 'bala', modo: 'projetil', escala: 0.9 },
  estocada: { efeito: 'impacto', modo: 'perto', escala: 0.8 },
  'corte-rapido': { efeito: 'impacto', modo: 'perto', escala: 0.8 },
  arremesso: { efeito: 'adaga', modo: 'projetil', escala: 0.6 },
  'golpe-vital': { efeito: 'impacto', modo: 'perto' },
  'danca-laminas': { efeito: 'tornado', modo: 'si', escala: 2.4 },
  'primeiros-socorros': { efeito: 'aura', modo: 'area', escala: 1.2 },
  'nuvem-fumaca': { efeito: 'fumaca', modo: 'area', escala: 1.2 },
  'prisao-fumaca': { efeito: 'fumaca', modo: 'area', escala: 1.3 },
  'punho-fogo': { efeito: 'fogo', modo: 'projetil', escala: 0.9 },
  'imperador-chamas': { efeito: 'fogo', modo: 'area', escala: 1.4 },
  'raio-luz': { efeito: 'luz', modo: 'projetil', escala: 1 },
  'chuva-luz': { efeito: 'luz', modo: 'area', escala: 1.3 },
  'lanca-gelo': { efeito: 'gelo', modo: 'projetil', escala: 0.9 },
  'era-gelo': { efeito: 'gelo', modo: 'area', escala: 1.3 },
  pistola: { efeito: 'punho', modo: 'projetil', escala: 0.8 },
  metralhadora: { efeito: 'punho', modo: 'perto', escala: 0.8 },
  'forma-hibrida': { efeito: 'aura', modo: 'si', escala: 1.8 },
}
/** Efeitos de fruta não mudam de cor com o Haki; os de arma sim. */
const ELEMENTAIS = new Set<TipoEfeito>(['fogo', 'luz', 'gelo', 'fumaca', 'aura'])

// ------------------------------------------------------------ preparação
export type Config = { id: string; akuma: string; armamento: 0 | 1 | 2; observacao: 0 | 1 | 2; rei: boolean; overall: number }

/** Config inicial a partir do elenco de teste. */
function configPadrao(): Config[] {
  return TRIPULACOES.map((m) => ({
    id: m.id,
    akuma: m.akuma ?? '',
    armamento: m.haki?.armamento ? (m.haki.armamento.avancado ? 2 : 1) : 0,
    observacao: m.haki?.observacao ? (m.haki.observacao.avancado ? 2 : 1) : 0,
    rei: !!m.haki?.rei,
    overall: m.haki?.overall ?? 0,
  }))
}

function aplicarConfig(cs: Combatente[], cfg: Config[]) {
  for (const k of cfg) {
    const c = cs.find((x) => x.id === k.id)!
    c.akuma = k.akuma ? { fruta: k.akuma, transformado: 0 } : null
    c.logia = k.akuma && FRUTAS[k.akuma].tipo === 'logia' ? { cargas: 5, max: 5 } : null
    const usosA = k.armamento === 2 ? 6 : 4
    c.haki = {
      overall: k.overall,
      armamento: k.armamento ? { usos: usosA, max: usosA, avancado: k.armamento === 2 } : null,
      observacao: k.observacao ? { usos: 3, max: 3, avancado: k.observacao === 2 } : null,
      rei: k.rei,
    }
  }
  return cs
}

// ------------------------------------------------------------ HUD
export type SkillHud = { id: string; nome: string; descricao: string; energia: number; alcance: number; area: string; motivo: string | null; fruta: boolean }
export type RetratoBatalha = {
  fase: 'preparar' | 'minha' | 'inimiga' | 'fim'
  animando: boolean
  auto: boolean
  config: (Config & { nome: string; lado: Lado })[]
  turno: number
  vez: Lado
  acoes: number
  movimento: number
  tempo: number
  vencedor: Lado | null
  tripulacao: FichaHud[]
  inimigos: FichaHud[]
  selecionado: (FichaHud & { skills: SkillHud[]; skill: string | null; usarArmamento: boolean; usarRei: boolean; podeArmamento: boolean; podeRei: boolean; podeHaoshoku: boolean }) | null
  log: string[]
  dica: string
}
export type FichaHud = {
  id: string
  nome: string
  lado: Lado
  hp: number
  hpMax: number
  energia: number
  espirito: number
  fruta: string | null
  armamento: string | null
  observacao: string | null
  observando: boolean
  rei: boolean
  overall: number
  logia: string | null
  estados: string[]
}

export class ControleBatalha {
  private estado: Estado
  private config: Config[] = configPadrao()
  private fase: RetratoBatalha['fase'] = 'preparar'
  private animando = false
  private sel: string | null = null
  private skill: string | null = null
  private armamento = false
  private rei = false
  private previa: Casa | null = null
  private mov: ReturnType<typeof movimentos> | null = null
  private dica = ''
  private log: string[] = []
  private inicioVez = 0
  private relogio = 0
  private readonly palco: Palco

  constructor(palco: Palco) {
    this.palco = palco
    this.estado = criarBatalha(combatentesIniciais())
    this.relogio = window.setInterval(() => this.checarTempo(), 500)
  }

  get combatentes() {
    return this.estado.combatentes
  }

  destruir() {
    clearInterval(this.relogio)
  }

  // ------------------------------------------------------------ preparação
  mudarConfig(id: string, campo: 'akuma' | 'armamento' | 'observacao' | 'rei' | 'overall', valor: string | number | boolean) {
    const k = this.config.find((x) => x.id === id)
    if (!k || this.fase !== 'preparar') return
    ;(k as Record<string, unknown>)[campo] = valor
    this.palco.avisar()
  }

  comecar() {
    this.estado = criarBatalha(aplicarConfig(combatentesIniciais(), this.config))
    this.log = [`Batalha começa: ${this.estado.vez === JOGADOR ? 'os piratas' : 'a Marinha'} (mais ágil) começa.`]
    this.novaVez()
  }

  novaBatalha() {
    location.reload()
  }

  // ------------------------------------------------------------ vez
  private novaVez() {
    this.inicioVez = performance.now()
    this.sel = null
    this.skill = null
    this.previa = null
    if (this.estado.vencedor) {
      this.fase = 'fim'
      this.redesenhar()
      return
    }
    this.fase = this.estado.vez === JOGADOR ? 'minha' : 'inimiga'
    this.dica = this.fase === 'minha' ? 'Sua vez: toque num pirata.' : 'Vez da Marinha…'
    this.redesenhar()
    if (this.fase === 'inimiga' || this.auto) void this.jogarIA()
  }

  /** a IA joga pelos piratas também (para assistir e testar) */
  auto = false
  alternarAuto() {
    this.auto = !this.auto
    if (this.auto && this.fase === 'minha' && !this.animando) void this.jogarIA()
    this.palco.avisar()
  }

  private async jogarIA() {
    await new Promise((r) => setTimeout(r, 700))
    let guarda = 0
    const lado = this.estado.vez
    while (this.estado.vez === lado && (lado !== JOGADOR || this.auto) && !this.estado.vencedor && guarda++ < 80) {
      const a = proximaAcao(this.estado)
      const ok = await this.executar(a)
      if (!ok) await this.executar({ t: 'passar' })
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  private checarTempo() {
    if (this.fase !== 'minha' || this.animando || this.auto) return
    if (this.tempo() <= 0) void this.executar({ t: 'tempo' })
    else this.palco.avisar()
  }

  private tempo() {
    return Math.max(0, Math.ceil(TEMPO_POR_VEZ - (performance.now() - this.inicioVez) / 1000))
  }

  /** Aplica uma ação e anima. Devolve se deu certo. */
  private async executar(a: Acao) {
    const r = aplicar(this.estado, a)
    if ('erro' in r) {
      this.dica = r.erro
      this.palco.avisar()
      return false
    }
    const vezAntes = this.estado.vez
    this.animando = true
    this.palco.limparMarcas()
    this.palco.avisar()
    await this.animar(this.estado, r.eventos)
    this.estado = r.estado
    for (const c of this.estado.combatentes) {
      const p = this.palco.personagem(c.id)
      if (p) p.vida = c.hp
    }
    this.animando = false
    if (this.estado.vez !== vezAntes || this.estado.vencedor) this.novaVez()
    else {
      // continua com o mesmo personagem escolhido
      this.previa = null
      if (a.t === 'skill') this.skill = null
      if (this.sel && (porId(this.estado, this.sel)?.hp ?? 0) <= 0) this.sel = null
      this.redesenhar()
    }
    return true
  }

  // ------------------------------------------------------------ toques
  clique(alvo: { casa: Casa; personagem: Personagem | null } | null) {
    if (this.fase !== 'minha' || this.animando) {
      if (alvo?.personagem) this.inspecionar(alvo.personagem.id)
      return
    }
    if (!alvo) return this.selecionar(null)
    const sel = this.sel ? porId(this.estado, this.sel) : null
    const s = sel && this.skill ? skillsDe(sel).find((x) => x.id === this.skill) : null
    if (sel && s) {
      if (!alvoValido(s, sel.casa, alvo.casa)) {
        this.dica = 'Fora do alcance da skill.'
        return this.palco.avisar()
      }
      if (this.previa && mesmaCasa(this.previa, alvo.casa)) return void this.usar(alvo.casa)
      this.previa = alvo.casa
      this.dica = 'Toque de novo para confirmar.'
      return this.redesenhar()
    }
    const c = alvo.personagem ? porId(this.estado, alvo.personagem.id) : null
    if (c && c.hp > 0) {
      if (c.lado === JOGADOR) return this.selecionar(c.id === this.sel ? null : c.id)
      return this.inspecionar(c.id)
    }
    if (sel && this.mov?.caminho(alvo.casa)) {
      void this.executar({ t: 'mover', id: sel.id, caminho: this.mov.caminho(alvo.casa)! })
      return
    }
    this.selecionar(null)
  }

  private inspecionar(id: string) {
    const c = porId(this.estado, id)
    if (!c) return
    this.dica = `${c.nome}: ${c.hp}/${c.hpMax} de vida, energia ${c.energia}, espírito ${c.espirito}${c.akuma ? `, ${FRUTAS[c.akuma.fruta].nome}` : ''}.`
    this.palco.avisar()
  }

  selecionar(id: string | null) {
    this.sel = id
    this.skill = null
    this.previa = null
    this.armamento = false
    this.rei = false
    if (id) {
      const c = porId(this.estado, id)!
      this.dica = c.atordoado ? `${c.nome} está atordoado nesta vez.` : `${c.nome}: casa azul anda; escolha uma skill para atacar.`
    } else this.dica = this.fase === 'minha' ? 'Sua vez: toque num pirata.' : ''
    this.redesenhar()
  }

  escolherSkill(id: string | null) {
    if (!this.sel) return
    this.skill = this.skill === id ? null : id
    this.previa = null
    const c = porId(this.estado, this.sel)!
    const s = this.skill ? skillsDe(c).find((x) => x.id === this.skill) : null
    if (s && (s.area === 'si' || s.area === 'volta')) this.previa = c.casa
    this.dica = s ? (s.area === 'si' || s.area === 'volta' ? 'Toque no personagem (ou em Usar) para confirmar.' : 'Toque numa casa vermelha para mirar.') : ''
    this.redesenhar()
  }

  alternarArmamento() {
    this.armamento = !this.armamento
    if (!this.armamento) this.rei = false
    this.palco.avisar()
  }

  alternarRei() {
    this.rei = !this.rei
    if (this.rei) this.armamento = true
    this.palco.avisar()
  }

  observar() {
    if (!this.sel) return
    const c = porId(this.estado, this.sel)!
    void this.executar({ t: 'observar', id: c.id, ligado: !c.observando })
  }

  haoshoku() {
    if (this.sel) void this.executar({ t: 'haoshoku', id: this.sel })
  }

  usarPrevia() {
    if (this.previa) void this.usar(this.previa)
  }

  passar() {
    if (this.fase === 'minha' && !this.animando) void this.executar({ t: 'passar' })
  }

  private async usar(alvo: Casa) {
    if (!this.sel || !this.skill) return
    await this.executar({ t: 'skill', id: this.sel, skill: this.skill, alvo, armamento: this.armamento, rei: this.rei })
  }

  private redesenhar() {
    this.palco.limparMarcas()
    this.mov = null
    const sel = this.sel ? porId(this.estado, this.sel) : null
    if (sel && this.fase === 'minha' && !sel.atordoado) {
      const s = this.skill ? skillsDe(sel).find((x) => x.id === this.skill) : null
      if (s) {
        for (let l = 0; l < 10; l++)
          for (let c = 0; c < 20; c++) {
            const casa = { l, c }
            if (alvoValido(s, sel.casa, casa)) this.palco.marcar(casa, s.cura ? 'cura' : 'alvo')
          }
        if (this.previa) for (const x of casasDaArea(s, sel.casa, this.previa)) this.palco.marcar(x, 'area')
      } else if (this.estado.movimento > 0) {
        this.mov = movimentos(this.estado, sel)
        for (const c of this.mov.casas) this.palco.marcar(c, 'mover')
      }
    }
    this.palco.avisar()
  }

  // ------------------------------------------------------------ animação
  private registrar(texto: string) {
    this.log = [...this.log.slice(-40), texto]
  }

  private async animar(antes: Estado, eventos: Evento[]) {
    const P = (id: string) => this.palco.personagem(id)
    const nome = (id: string) => porId(antes, id)?.nome ?? id
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (let i = 0; i < eventos.length; i++) {
      const e = eventos[i]
      switch (e.t) {
        case 'mover': {
          const p = P(e.id)
          if (p) await new Promise<void>((r) => p.andar(e.caminho, r))
          break
        }
        case 'skill': {
          // junta os eventos desta skill (até a próxima skill/mover/vez)
          let j = i + 1
          while (j < eventos.length && !['skill', 'mover', 'vez', 'haoshoku'].includes(eventos[j].t)) j++
          const resto = eventos.slice(i + 1, j)
          i = j - 1
          await this.animarSkill(antes, e, resto)
          break
        }
        case 'haoshoku': {
          const p = P(e.id)
          if (!p) break
          this.registrar(`${nome(e.id)} solta o Haki do Rei!`)
          this.palco.flutuar(p, 'Haki do Rei!', '#ff4a5a', 1)
          this.palco.hakiDoRei(p)
          await esperar(900)
          break
        }
        case 'atordoou':
        case 'resistiu':
        case 'congelou':
        case 'caiu':
        case 'cura':
        case 'golpe':
        case 'contra':
        case 'clash':
          await this.resultado(antes, e)
          break
        case 'queimou': {
          const p = P(e.id)
          if (p) {
            this.palco.flutuar(p, `Queimadura -${e.dano}`, '#ff9a4a')
            void this.palco.efeito('fogo', 'normal', this.palco.peito(p), { dur: 0.5, escala: 0.8 })
            p.vida = Math.max(1, p.vida - e.dano)
          }
          this.registrar(`${nome(e.id)} sofre ${e.dano} de queimadura.`)
          await esperar(400)
          break
        }
        case 'transformou': {
          const p = P(e.id)
          if (p) {
            this.palco.flutuar(p, 'Forma Híbrida!', '#ffcf6a', 1)
            await this.palco.efeito('aura', 'normal', this.palco.peito(p), { dur: 0.8, escala: 1.8 })
          }
          this.registrar(`${nome(e.id)} se transforma (${e.vezes} vezes).`)
          break
        }
        case 'tempo':
          this.registrar('Tempo esgotado! A vez passa.')
          break
        case 'vez':
          this.registrar(`— Vez ${e.turno}: ${e.lado === JOGADOR ? 'piratas' : 'Marinha'} —`)
          break
        case 'fim':
          this.registrar(e.vencedor === JOGADOR ? 'Vitória dos piratas!' : 'A Marinha venceu.')
          break
      }
    }
  }

  private async animarSkill(antes: Estado, e: Extract<Evento, { t: 'skill' }>, resto: Evento[]) {
    const a = this.palco.personagem(e.id)
    if (!a) return
    const c = porId(antes, e.id)!
    const s = skillsDe(c).find((x) => x.id === e.skill) as Skill
    const v = VISUAL[s.id] ?? { efeito: 'impacto', modo: 'perto' }
    const paleta: Paleta = ELEMENTAIS.has(v.efeito) ? 'normal' : e.rei ? 'rei' : e.armamento ? 'armamento' : 'normal'
    this.registrar(`${c.nome} usa ${s.nome}${e.rei ? ' com Haki do Rei' : e.armamento ? ' com Haki de armamento' : ''}.`)
    this.palco.flutuar(a, s.nome, e.rei ? '#ff5a6a' : e.armamento ? '#c890ff' : '#ffffff', 2)
    a.haki = e.rei ? 'rei' : e.armamento ? 'armamento' : false
    const alvoCasa = e.alvo
    // choque de Haki do Rei: antes do golpe
    const clash = resto.find((x) => x.t === 'clash') as Extract<Evento, { t: 'clash' }> | undefined
    if (clash) {
      await this.animarClash(antes, clash)
      if (clash.resultado !== 'venceu' && s.area === 'alvo') {
        for (const r of resto) if (r !== clash) await this.resultado(antes, r)
        this.palco.focar(null)
        a.haki = false
        return
      }
    }
    // vira para o alvo e toca o golpe
    const primeiro = resto.find((x) => x.t === 'golpe' || x.t === 'cura') as { alvo: string } | undefined
    const pAlvo = primeiro ? this.palco.personagem(primeiro.alvo) : undefined
    const destino = pAlvo ?? null
    await new Promise<void>((r) => {
      if (destino && destino !== a) a.atacar(destino, r)
      else {
        if (!mesmaCasa(alvoCasa, c.casa)) a.olharPara(alvoCasa)
        a.atacar(a, r)
      }
    })
    // efeito da skill
    const origem = this.palco.peito(a)
    const fim = e.casas.length ? e.casas[e.casas.length - 1] : alvoCasa
    const ate = pAlvo ? this.palco.peito(pAlvo) : this.palco.centro(v.modo === 'projetil' && s.area === 'linha' ? fim : alvoCasa)
    if (v.modo === 'projetil') {
      const tiros = v.tiros ?? 1
      const alvos = s.area === 'leque' ? e.casas.map((x) => this.palco.centro(x)) : Array(tiros).fill(ate)
      await Promise.all(
        alvos.map((p, k) => new Promise<void>((r) => setTimeout(() => void this.palco.efeito(v.efeito, paleta, origem, { para: p, dur: 0.12 + origem.distanceTo(p) * 0.05, escala: v.escala }).then(r), k * 120))),
      )
    } else if (v.modo === 'si') {
      void this.palco.efeito(v.efeito, paleta, origem, { dur: 0.7, escala: v.escala })
      await new Promise((r) => setTimeout(r, 250))
    } else if (v.modo === 'area') {
      for (const x of e.casas) void this.palco.efeito(v.efeito, paleta, this.palco.centro(x).setY(0.5), { dur: 0.6, escala: v.escala })
      await new Promise((r) => setTimeout(r, 300))
    }
    if (e.rei) {
      this.palco.tremer(0.35)
      void this.palco.efeito('raio', 'rei', ate, { dur: 0.6, escala: 2.2 })
    } else if (e.armamento) this.palco.tremer(0.15)
    // resultados, um por um
    for (const r of resto) if (r !== clash) await this.resultado(antes, r, v, paleta)
    if (clash) this.palco.focar(null)
    a.haki = false
  }

  /**
   * Choque de Haki do Rei: a câmera aproxima os dois, cada um golpeia na
   * direção do outro sem as armas se tocarem, e entre eles o Haki explode
   * em raios negros e vermelhos. Ganha o maior overall.
   */
  private async animarClash(antes: Estado, k: Extract<Evento, { t: 'clash' }>) {
    const a = this.palco.personagem(k.de)
    const b = this.palco.personagem(k.alvo)
    if (!a || !b) return
    const nome = (id: string) => porId(antes, id)?.nome ?? id
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    this.palco.focar([a.pos, b.pos])
    this.palco.flutuar(b, 'Haki do Rei!', '#ff4a5a', 2)
    await esperar(550)
    a.haki = 'rei'
    b.haki = 'rei'
    const meio = this.palco.peito(a).lerp(this.palco.peito(b), 0.5)
    await Promise.all([
      new Promise<void>((r) => a.atacar(b, r)),
      new Promise<void>((r) => setTimeout(() => b.atacar(a, r), 60)),
    ])
    this.palco.choqueRei(meio.clone().setY(0))
    this.palco.tremer(0.8)
    void this.palco.efeito('raio', 'rei', meio, { dur: 0.9, escala: 1.9 })
    void this.palco.efeito('impacto', 'rei', meio, { dur: 0.6, escala: 1.4 })
    await esperar(500)
    void this.palco.efeito('raio', 'rei', meio, { dur: 0.8, escala: 1.5 })
    await esperar(700)
    b.haki = false
    if (k.resultado === 'empate') {
      this.palco.tremer(0.6)
      void this.palco.efeito('impacto', 'rei', meio, { dur: 0.7, escala: 2 })
      this.palco.flutuar(a, 'Anulou!', '#ffd34a', 1)
      this.palco.flutuar(b, 'Anulou!', '#ffd34a', 1)
      this.registrar(`Choque de Haki do Rei entre ${nome(k.de)} e ${nome(k.alvo)}: empate, o golpe se anula.`)
      a.haki = false
      await esperar(700)
    } else if (k.resultado === 'venceu') {
      this.palco.flutuar(a, 'Venceu o choque!', '#ff5a6a', 1)
      this.registrar(`${nome(k.de)} vence o choque de Haki do Rei contra ${nome(k.alvo)} (golpe mais forte).`)
      await esperar(400)
    } else {
      void this.palco.efeito('impacto', 'rei', this.palco.peito(a), { dur: 0.5, escala: 1.6 })
      a.sofrer(k.dano, b)
      this.palco.flutuar(a, `Perdeu o choque! -${k.dano}`, '#ff5a6a', 1)
      this.registrar(`${nome(k.alvo)} vence o choque de Haki do Rei: ${nome(k.de)} leva o próprio golpe (${k.dano}).`)
      a.haki = false
      await esperar(700)
    }
  }

  private async resultado(antes: Estado, e: Evento, v?: Visual, paleta: Paleta = 'normal') {
    const P = (id: string) => this.palco.personagem(id)
    const nome = (id: string) => porId(antes, id)?.nome ?? id
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    switch (e.t) {
      case 'golpe': {
        const a = P(e.de)
        const b = P(e.alvo)
        if (!a || !b) return
        if (e.efeito === 'atravessou') {
          const fruta = porId(antes, e.alvo)?.akuma?.fruta ?? 'fumaca'
          this.palco.flutuar(b, 'Atravessou!', '#dfe6f3', 1)
          this.registrar(`O golpe atravessa ${nome(e.alvo)} (Logia).`)
          await this.palco.atravessar(b, FRUTAS[fruta]?.elemento ?? 'fumaca')
          return
        }
        if (e.efeito === 'observou') {
          this.palco.flutuar(b, 'Observação!', '#9fe0ff', 1)
          this.registrar(`${nome(e.alvo)} prevê o golpe (Haki de observação) e esquiva.`)
          await this.palco.esquivar(b, a)
          return
        }
        if (e.efeito === 'esquivou') {
          this.palco.flutuar(b, 'Esquivou!', '#9fe0ff', 1)
          this.registrar(`${nome(e.alvo)} esquiva.`)
          await this.palco.esquivar(b, a)
          return
        }
        if (v && (v.modo === 'perto' || v.modo === 'projetil')) void this.palco.efeito(v.efeito === 'corte' || v.efeito === 'bala' || v.efeito === 'adaga' || v.efeito === 'punho' ? 'impacto' : v.efeito, paleta, this.palco.peito(b), { dur: 0.4, escala: (v.escala ?? 1) * 0.9 })
        b.sofrer(e.dano, a)
        const txt: Record<string, string> = { critico: 'Crítico! ', bloqueou: 'Bloqueou ', desgastado: 'Desgastado! ' }
        this.palco.flutuar(b, `${txt[e.efeito] ?? ''}-${e.dano}`, e.efeito === 'critico' ? '#ff5a4a' : '#ffe27a')
        this.registrar(`${nome(e.de)} acerta ${nome(e.alvo)}: ${e.dano}${e.efeito === 'critico' ? ' (crítico)' : e.efeito === 'bloqueou' ? ' (bloqueou)' : e.efeito === 'desgastado' ? ' (Logia desgastada)' : ''}.`)
        await esperar(260)
        return
      }
      case 'contra': {
        const a = P(e.de)
        const b = P(e.alvo)
        if (!a || !b) return
        this.palco.flutuar(a, 'Contra-ataque!', '#ff9a7a', 2)
        await new Promise<void>((r) =>
          a.atacar(b, () => {
            b.sofrer(e.dano, a)
            this.palco.flutuar(b, `-${e.dano}`, '#ffe27a')
            r()
          }),
        )
        this.registrar(`${nome(e.de)} revida na hora (observação avançada): ${e.dano}.`)
        await esperar(300)
        return
      }
      case 'cura': {
        const b = P(e.alvo)
        if (!b) return
        b.vida = Math.min(b.vidaMax, b.vida + e.valor)
        this.palco.flutuar(b, `+${e.valor}`, '#7dff8a')
        this.registrar(`${nome(e.de)} cura ${nome(e.alvo)}: +${e.valor}.`)
        await esperar(400)
        return
      }
      case 'atordoou':
      case 'congelou': {
        const b = P(e.id)
        if (!b) return
        this.palco.flutuar(b, e.t === 'congelou' ? 'Congelado!' : 'Atordoado!', e.t === 'congelou' ? '#a8ecff' : '#ff5a6e', 1)
        if (e.t === 'congelou') void this.palco.efeito('gelo', 'normal', this.palco.peito(b), { dur: 0.6, escala: 1 })
        this.registrar(`${nome(e.id)} ${e.t === 'congelou' ? 'congela' : 'fica atordoado pelo Haki do Rei'} e perde a próxima vez.`)
        await esperar(350)
        return
      }
      case 'clash': {
        // choque com um alvo que não foi o principal (golpe em área)
        await this.animarClash(antes, e)
        this.palco.focar(null)
        return
      }
      case 'resistiu': {
        const b = P(e.id)
        if (b) this.palco.flutuar(b, 'Resistiu!', '#ffd34a', 1)
        this.registrar(`${nome(e.id)} resiste ao Haki do Rei.`)
        return
      }
      case 'caiu': {
        const b = P(e.id)
        if (b) {
          this.palco.flutuar(b, 'Caiu!', '#ff6a6a', 1)
          this.palco.sumir(b)
        }
        this.registrar(`${nome(e.id)} caiu.`)
        await esperar(450)
        return
      }
      default:
        return
    }
  }

  // ------------------------------------------------------------ retrato
  private ficha(c: Combatente): FichaHud {
    const p = this.palco.personagem(c.id)
    const nv = (h: { avancado: boolean; usos: number; max: number } | null) => (h ? `${h.avancado ? 'avançado ' : ''}${h.usos}/${h.max}` : null)
    const estados: string[] = []
    if (c.atordoado) estados.push('atordoado')
    if (c.queimadura) estados.push('queimando')
    if (c.akuma?.transformado) estados.push(`transformado (${c.akuma.transformado})`)
    return {
      id: c.id,
      nome: c.nome,
      lado: c.lado,
      hp: this.animando ? (p?.vida ?? c.hp) : c.hp,
      hpMax: c.hpMax,
      energia: c.energia,
      espirito: c.espirito,
      fruta: c.akuma ? FRUTAS[c.akuma.fruta].nome : null,
      armamento: nv(c.haki.armamento),
      observacao: nv(c.haki.observacao),
      observando: c.observando,
      rei: c.haki.rei,
      overall: c.haki.overall,
      logia: c.logia ? `${c.logia.cargas}/${c.logia.max}` : null,
      estados,
    }
  }

  retrato(): RetratoBatalha {
    const e = this.estado
    const s = this.sel ? porId(e, this.sel) : null
    const nomes = new Map(TRIPULACOES.map((m) => [m.id, m]))
    return {
      fase: this.fase,
      animando: this.animando,
      auto: this.auto,
      config: this.config.map((k) => ({ ...k, nome: nomes.get(k.id)!.nome, lado: nomes.get(k.id)!.lado })),
      turno: e.turno,
      vez: e.vez,
      acoes: e.acoes,
      movimento: e.movimento,
      tempo: this.fase === 'minha' ? this.tempo() : TEMPO_POR_VEZ,
      vencedor: e.vencedor,
      tripulacao: e.combatentes.filter((c) => c.lado === JOGADOR).map((c) => this.ficha(c)),
      inimigos: e.combatentes.filter((c) => c.lado !== JOGADOR).map((c) => this.ficha(c)),
      selecionado: s
        ? {
            ...this.ficha(s),
            skills: skillsDe(s).map((k) => ({
              id: k.id,
              nome: k.nome,
              descricao: k.descricao,
              energia: k.energia,
              alcance: k.alcance,
              area: k.area,
              fruta: !!s.akuma && FRUTAS[s.akuma.fruta].skills.includes(k),
              motivo: s.energia < k.energia ? 'Energia insuficiente' : e.acoes <= 0 ? 'Sem ações' : s.atordoado ? 'Atordoado' : null,
            })),
            skill: this.skill,
            usarArmamento: this.armamento,
            usarRei: this.rei,
            podeArmamento: (s.haki.armamento?.usos ?? 0) > 0,
            podeRei: s.haki.rei && !!s.haki.armamento?.avancado && s.espirito >= REI_IMBUIDO.espirito,
            podeHaoshoku: s.haki.rei && s.espirito >= HAOSHOKU.espirito && !motivo(e, { t: 'haoshoku', id: s.id }),
          }
        : null,
      log: this.log.slice(-8),
      dica: this.dica,
    }
  }
}

export { vivos }
