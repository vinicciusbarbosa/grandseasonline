import * as THREE from 'three'
import { centroCasa, cruzaVao, type Casa } from '../tabuleiro'
import { LUZ_NEUTRA, type LuzPersonagem } from './luzSprite'

/**
 * Um personagem no tabuleiro: estado, movimento e tempo das animações. Anda
 * uma casa caminhando; mais de uma, corre — e no fim freia arrastando o pé,
 * com poeira. O desenho fica com o `Visual` (hoje, o sprite em pixel art),
 * que só recebe "qual animação, em que ponto, para onde olha".
 */

export type NomeAnim = 'parado' | 'andar' | 'correr' | 'frear' | 'parar' | 'atacar' | 'dano' | 'conjurar' | 'empurrar'
export type Direcao = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW'


/** Tempo e marcas de uma animação. */
export type InfoAnim = { quadros: number; fps: number; laco: boolean; impacto?: number; poeira: ('E' | 'D' | undefined)[] }

export type EstadoVisual = { anim: NomeAnim; tAnim: number; dir: Direcao; clarao: number; pos: THREE.Vector3; dt: number; luz: LuzPersonagem; haki?: Haki; tinta?: THREE.Color | null; oculto?: boolean; escala?: number }

/** Haki na arma: armamento (negro e roxo) ou o do Rei imbuído (negro e vermelho). */
export type Haki = false | 'armamento' | 'rei'

export interface Visual {
  readonly info: Record<NomeAnim, InfoAnim>
  /** o que vai para a cena */
  readonly objetos: THREE.Object3D[]
  /** altura do topo da cabeça (unidades do mundo) */
  readonly altura: number
  /** altura do sprite na tela (px da cena, sem zoom), do pé ao topo */
  readonly alturaPx: number
  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number): void
  /** a animação foi desenhada para essa direção? (sem isso, cai no que houver) */
  tem?(anim: NomeAnim, dir: Direcao): boolean
}
const VEL_ANDAR = 1.25 // casas/s: um ciclo de passos por casa
const VEL_CORRER = 3.1 // casas/s: ~2,5 casas por ciclo de passadas (0,8 s)
const FREIO = 0.7 // distância (casas) em que começa a frear
const PASSO_DIR: Record<Direcao, [number, number]> = { S: [1, 0], SE: [1, 1], E: [0, 1], NE: [-1, 1], N: [-1, 0], NW: [-1, -1], W: [0, -1], SW: [1, -1] }

/** Direção (8) a partir de um deslocamento no tabuleiro (linhas, colunas). */
export function direcaoDe(dl: number, dc: number): Direcao {
  if (dl === 0 && dc === 0) return 'S'
  const setor = Math.round(Math.atan2(dc, dl) / (Math.PI / 4)) // 0 = baixo (S), 2 = direita (E)
  const mapa: Record<string, Direcao> = { '0': 'S', '1': 'SE', '2': 'E', '3': 'NE', '4': 'N', '-4': 'N', '-3': 'NW', '-2': 'W', '-1': 'SW' }
  return mapa[String(setor)]
}

type Trecho = { de: THREE.Vector3; para: THREE.Vector3; t: number; dur: number; pulo: boolean; ultimo: boolean }

export class Personagem {
  readonly visual: Visual
  readonly id: string
  readonly nome: string
  casa: Casa
  dir: Direcao
  vida: number
  readonly vidaMax: number
  /** pedidos de poeira para a cena (posição do pé) */
  readonly poeiras: THREE.Vector3[] = []
  readonly pos = new THREE.Vector3()
  private anim: NomeAnim = 'parado'
  private tAnim = 0
  private ultimoQuadro = -1
  private readonly info: Record<NomeAnim, InfoAnim>
  private caminho: Casa[] = []
  private correndo = false
  /** corrida curta (2 casas): termina com uma parada brusca em vez de derrapar */
  private curto = false
  private trecho: Trecho | null = null
  private freio: { de: THREE.Vector3; para: THREE.Vector3 } | null = null
  private aoChegar: (() => void) | null = null
  private aoGolpe: (() => void) | null = null
  private golpeDado = false
  private clarao = 0
  private dtUltimo = 0
  /** Haki ligado: ataca com a lâmina negra (armamento) ou com raios vermelhos (Rei) */
  haki: Haki = false
  /** deslocamento visual (esquiva), sem mudar a casa */
  readonly deslize = new THREE.Vector3()
  /** cor que multiplica o sprite (Logia virando elemento) */
  tinta: THREE.Color | null = null
  /** some neste quadro (pisca) */
  oculto = false
  /** transformação/buff visível: Zoan (maior, tom de bisão), Gear Second
   * (vermelho, vapor), espada de luz (brilho dourado) */
  forma: 'zoan' | 'gear' | 'sabre' | 'lobo' | 'agni' | null = null
  /** tamanho do sprite (a Zoan cresce) */
  escala = 1

  constructor(id: string, nome: string, casa: Casa, vida: number, visual: Visual, dir: Direcao) {
    this.id = id
    this.nome = nome
    this.casa = casa
    this.vida = this.vidaMax = vida
    this.visual = visual
    this.info = visual.info
    this.dir = dir
    const c = centroCasa(casa.l, casa.c)
    this.pos.set(c.x, 0, c.z)
    this.tAnim = Math.random() * 1.5
  }

  /** quadro segurado por uma skill (posar); null = animação livre */
  private fixo: number | null = null

  get ocupado() {
    return this.fixo !== null || this.anim === 'atacar' || this.anim === 'dano' || this.anim === 'frear' || this.anim === 'parar' || this.trecho !== null
  }

  private tocar(anim: NomeAnim) {
    if (this.anim === anim && this.info[anim].laco) return
    this.anim = anim
    this.tAnim = 0
    this.ultimoQuadro = -1
    this.golpeDado = false
  }

  /** Segue o caminho: uma casa andando, mais de uma correndo. */
  andar(caminho: Casa[], aoChegar?: () => void) {
    if (!caminho.length) {
      aoChegar?.()
      return
    }
    this.caminho = [...caminho]
    this.correndo = caminho.length > 1
    this.curto = caminho.length === 2
    this.aoChegar = aoChegar ?? null
    this.tocar(this.correndo ? 'correr' : 'andar')
    this.proximoTrecho()
  }

  private proximoTrecho() {
    const prox = this.caminho.shift()
    if (!prox) {
      this.trecho = null
      this.tocar('parado')
      this.chegou()
      return
    }
    const c = centroCasa(prox.l, prox.c)
    const para = new THREE.Vector3(c.x, 0, c.z)
    const pulo = cruzaVao(this.casa, prox)
    this.dir = direcaoDe(prox.l - this.casa.l, prox.c - this.casa.c)
    const vel = this.correndo ? VEL_CORRER : VEL_ANDAR
    const dist = Math.hypot(para.x - this.pos.x, para.z - this.pos.z)
    this.trecho = { de: this.pos.clone().setY(0), para, t: 0, dur: (dist / vel) * (pulo ? 1.2 : 1), pulo, ultimo: this.caminho.length === 0 }
    this.casa = prox
  }

  private chegou() {
    this.correndo = false
    const f = this.aoChegar
    this.aoChegar = null
    f?.()
  }

  atacar(alvo: Personagem, aoGolpe: () => void) {
    this.dir = direcaoDe(alvo.casa.l - this.casa.l, alvo.casa.c - this.casa.c)
    this.aoGolpe = aoGolpe
    this.tocar('atacar')
  }

  sofrer(dano: number, de: Personagem) {
    this.vida = Math.max(0, this.vida - dano)
    this.dir = direcaoDe(de.casa.l - this.casa.l, de.casa.c - this.casa.c)
    this.clarao = 0.12
    this.tocar('dano')
  }

  /**
   * Segura um quadro de uma animação de skill (o efeito manda no tempo: o
   * Entei ergue o braço enquanto a bola cresce e arremessa no voo). Sem a
   * animação desenhada nessa direção, não faz nada.
   */
  posar(anim: NomeAnim, quadro: number) {
    if (!(this.visual.tem?.(anim, this.dir) ?? false)) return false
    const f = this.info[anim]
    if (this.anim !== anim) this.tocar(anim)
    this.fixo = Math.min(f.quadros - 1, quadro)
    this.tAnim = (this.fixo + 0.5) / f.fps
    return true
  }

  /** Solta a pose da skill e volta a ficar parado. */
  soltarPose() {
    if (this.fixo === null) return
    this.fixo = null
    this.tocar('parado')
  }

  /** Toca uma animação de skill inteira (sem efeito mandando no tempo). */
  tocarSkill(anim: NomeAnim) {
    if (!(this.visual.tem?.(anim, this.dir) ?? false)) return false
    this.fixo = null
    this.tocar(anim)
    return true
  }

  /** Vira para uma casa sem sair do lugar. */
  olharPara(c: Casa) {
    if (!this.ocupado) this.dir = direcaoDe(c.l - this.casa.l, c.c - this.casa.c)
  }

  atualizar(dt: number) {
    if (this.trecho) {
      const tr = this.trecho
      tr.t = Math.min(1, tr.t + dt / tr.dur)
      this.pos.lerpVectors(tr.de, tr.para, tr.t)
      this.pos.y = tr.pulo ? Math.sin(Math.PI * tr.t) * 0.7 : 0
      const falta = Math.hypot(tr.para.x - this.pos.x, tr.para.z - this.pos.z)
      // sem derrapagem/parada desenhada nessa direção: termina a corrida e fica parado
      const freia = this.visual.tem ? this.visual.tem('frear', this.dir) || this.visual.tem('parar', this.dir) : true
      if (this.correndo && freia && tr.ultimo && !tr.pulo && falta <= FREIO) {
        // correndo, o último trecho termina freando (arrastando o pé)
        this.trecho = null
        this.freio = { de: this.pos.clone(), para: tr.para.clone() }
        const parar = this.visual.tem?.('parar', this.dir) ?? false
        const frear = this.visual.tem?.('frear', this.dir) ?? true
        this.tocar((this.curto && parar) || !frear ? 'parar' : 'frear')
      } else if (tr.t >= 1) {
        if (tr.pulo) this.poeiras.push(this.pos.clone().setY(0))
        this.pos.copy(tr.para)
        this.proximoTrecho()
      }
    }
    const f = this.info[this.anim]
    this.dtUltimo = dt
    if (this.fixo !== null) {
      this.clarao = Math.max(0, this.clarao - dt)
      return
    }
    this.tAnim += dt
    const dur = f.quadros / f.fps
    if (this.freio) {
      // desliza até o centro da casa perdendo velocidade
      const t = Math.min(1, this.tAnim / (dur * 0.45))
      this.pos.lerpVectors(this.freio.de, this.freio.para, 1 - (1 - t) ** 2)
      if (t >= 1) this.freio = null
    }
    const q = Math.min(f.quadros - 1, Math.floor(this.tAnim * f.fps))
    if (q !== this.ultimoQuadro) {
      this.ultimoQuadro = q
      if (f.poeira[q]) this.poeiras.push(this.pePosicao())
    }
    if (this.anim === 'atacar' && !this.golpeDado && f.impacto !== undefined && q >= f.impacto) {
      this.golpeDado = true
      const g = this.aoGolpe
      this.aoGolpe = null
      g?.()
    }
    if (this.tAnim >= dur) {
      if (f.laco) this.tAnim %= dur
      else if (this.anim === 'frear' || this.anim === 'parar') {
        this.freio = null
        this.tocar('parado')
        this.chegou()
      } else this.tocar(this.trecho ? (this.correndo ? 'correr' : 'andar') : 'parado')
    }
    this.clarao = Math.max(0, this.clarao - dt)
  }

  /** Ponto do pé da frente, para a poeira. */
  private pePosicao() {
    const [dl, dc] = PASSO_DIR[this.dir]
    const n = Math.hypot(dl, dc) || 1
    return new THREE.Vector3(this.pos.x + (dc / n) * 0.3, 0, this.pos.z + (dl / n) * 0.3)
  }

  posicionar(camera: THREE.PerspectiveCamera, telaL: number, telaA: number, luz: LuzPersonagem = LUZ_NEUTRA) {
    this.visual.mostrar({ anim: this.anim, tAnim: this.tAnim, dir: this.dir, clarao: this.clarao, pos: this.deslize.lengthSq() ? this.pos.clone().add(this.deslize) : this.pos, dt: this.dtUltimo, luz, haki: this.haki, tinta: this.tinta, oculto: this.oculto, escala: this.escala }, camera, telaL, telaA)
  }

  /** Ponto no mundo logo acima da cabeça (barra de vida, números). */
  topo(extra = 0) {
    return this.pos.clone().setY(this.pos.y + this.visual.altura + extra)
  }
}
