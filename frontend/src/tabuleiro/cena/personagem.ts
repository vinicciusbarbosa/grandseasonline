import * as THREE from 'three'
import { DIRECOES, PE_X, PE_Y, QUADRO_A, QUADRO_L, type Folhas } from '../boneco/assador'
import { centroCasa, cruzaVao, type Casa } from '../tabuleiro'
import { posicionarPixel, texturaPixel } from './pixel'
import { texturaSombra } from './texturas'

/**
 * Um personagem no tabuleiro, desenhado com as folhas de pixel art assadas do
 * boneco (8 direções: 5 assadas + 3 espelhadas). Anda uma casa caminhando;
 * mais de uma, corre — e no fim freia arrastando o pé, com poeira.
 */

export type NomeAnim = 'parado' | 'andar' | 'correr' | 'frear' | 'atacar' | 'dano'
export type Direcao = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW'

const ESPELHO: Partial<Record<Direcao, Direcao>> = { SW: 'SE', W: 'E', NW: 'NE' }
const VEL_ANDAR = 1.25 // casas/s: um ciclo de passos por casa
const VEL_CORRER = 4.4
const FREIO = 0.55 // distância (casas) em que começa a frear
const PASSO_DIR: Record<Direcao, [number, number]> = { S: [1, 0], SE: [1, 1], E: [0, 1], NE: [-1, 1], N: [-1, 0], NW: [-1, -1], W: [0, -1], SW: [1, -1] }

/** Direção (8) a partir de um deslocamento no tabuleiro (linhas, colunas). */
export function direcaoDe(dl: number, dc: number): Direcao {
  if (dl === 0 && dc === 0) return 'S'
  const setor = Math.round(Math.atan2(dc, dl) / (Math.PI / 4)) // 0 = baixo (S), 2 = direita (E)
  const mapa: Record<string, Direcao> = { '0': 'S', '1': 'SE', '2': 'E', '3': 'NE', '4': 'N', '-4': 'N', '-3': 'NW', '-2': 'W', '-1': 'SW' }
  return mapa[String(setor)]
}

let texSombra: THREE.Texture | null = null

type Trecho = { de: THREE.Vector3; para: THREE.Vector3; t: number; dur: number; pulo: boolean; ultimo: boolean }

export class Personagem {
  readonly sprite: THREE.Sprite
  readonly sombra: THREE.Mesh
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
  private readonly folhas: Folhas
  private readonly texturas = new Map<string, THREE.Texture>()
  private caminho: Casa[] = []
  private correndo = false
  private trecho: Trecho | null = null
  private freio: { de: THREE.Vector3; para: THREE.Vector3 } | null = null
  private aoChegar: (() => void) | null = null
  private aoGolpe: (() => void) | null = null
  private golpeDado = false
  private clarao = 0

  constructor(id: string, nome: string, casa: Casa, vida: number, folhas: Folhas, dir: Direcao) {
    this.id = id
    this.nome = nome
    this.casa = casa
    this.vida = this.vidaMax = vida
    this.folhas = folhas
    this.dir = dir
    for (const [n, f] of Object.entries(folhas)) {
      const t = texturaPixel(f.canvas)
      t.repeat.set(1 / f.quadros, 1 / DIRECOES.length)
      this.texturas.set(n, t)
    }
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texturas.get('parado')!, alphaTest: 0.5 }))
    this.sprite.userData.personagem = this
    texSombra ??= texturaSombra()
    this.sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.38),
      new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }),
    )
    this.sombra.rotation.x = -Math.PI / 2
    const c = centroCasa(casa.l, casa.c)
    this.pos.set(c.x, 0, c.z)
    this.tAnim = Math.random() * 1.5
  }

  get ocupado() {
    return this.anim === 'atacar' || this.anim === 'dano' || this.anim === 'frear' || this.trecho !== null
  }

  private tocar(anim: NomeAnim) {
    if (this.anim === anim && this.folhas[anim].laco) return
    this.anim = anim
    this.tAnim = 0
    this.ultimoQuadro = -1
    this.golpeDado = false
    this.sprite.material.map = this.texturas.get(anim)!
    this.sprite.material.needsUpdate = true
  }

  /** Segue o caminho: uma casa andando, mais de uma correndo. */
  andar(caminho: Casa[], aoChegar?: () => void) {
    if (!caminho.length) {
      aoChegar?.()
      return
    }
    this.caminho = [...caminho]
    this.correndo = caminho.length > 1
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
      if (this.correndo && tr.ultimo && !tr.pulo && falta <= FREIO) {
        // correndo, o último trecho termina freando (arrastando o pé)
        this.trecho = null
        this.freio = { de: this.pos.clone(), para: tr.para.clone() }
        this.tocar('frear')
      } else if (tr.t >= 1) {
        if (tr.pulo) this.poeiras.push(this.pos.clone().setY(0))
        this.pos.copy(tr.para)
        this.proximoTrecho()
      }
    }
    const f = this.folhas[this.anim]
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
      else if (this.anim === 'frear') {
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

  posicionar(camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    const f = this.folhas[this.anim]
    const q = Math.min(f.quadros - 1, Math.floor(this.tAnim * f.fps))
    const base = ESPELHO[this.dir] ?? this.dir
    const linha = DIRECOES.indexOf(base as (typeof DIRECOES)[number])
    const espelha = this.dir in ESPELHO
    this.sprite.material.map!.offset.set(q / f.quadros, 1 - (linha + 1) / DIRECOES.length)
    const cx = PE_X / QUADRO_L
    this.sprite.center.set(espelha ? 1 - cx : cx, 1 - PE_Y / QUADRO_A)
    // clarão branco ao levar o golpe
    const k = this.clarao > 0 ? 3.2 : 1
    this.sprite.material.color.setRGB(k, k, k)
    posicionarPixel(this.sprite, this.pos, QUADRO_L, QUADRO_A, camera, telaL, telaA, espelha)
    this.sombra.position.set(this.pos.x, 0.012, this.pos.z)
    const s = 1 - Math.min(0.5, this.pos.y * 0.6)
    this.sombra.scale.set(s, s, 1)
  }

  /** Altura (px da cena) do topo da cabeça acima do pé. */
  get alturaPx() {
    return 118
  }
}
