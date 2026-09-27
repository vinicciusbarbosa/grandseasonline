import * as THREE from 'three'
import metaPersonagens from '../personagens.json'
import { centroCasa, cruzaVao, type Casa } from '../tabuleiro'
import { texturaSombra } from './texturas'

/**
 * Um personagem em pixel art no tabuleiro. As animações vêm prontas, quadro a
 * quadro a 60 fps (scripts/personagens/assar_personagens.py); aqui só se
 * escolhe o quadro, anda de casa em casa e desenha o sprite com um texel =
 * um pixel da tela, sempre alinhado à grade de pixels (nada de borrão).
 */

export type NomeAnim = 'parado' | 'andar' | 'atacar' | 'dano'

type InfoAnim = {
  arquivo: string
  quadros: number
  colunas: number
  largura: number
  altura: number
  peX: number
  peY: number
  laco: boolean
}

type Meta = Record<string, { olha: number; fps: number; anims: Record<NomeAnim, InfoAnim> }>
const META = metaPersonagens as unknown as Meta

const VELOCIDADE = 2.8 // casas por segundo
/** Momento do golpe dentro da animação de ataque (fração). */
export const IMPACTO = 0.39

const carregador = new THREE.TextureLoader()
const cacheTex = new Map<string, THREE.Texture>()
function tex(arquivo: string) {
  let t = cacheTex.get(arquivo)
  if (!t) {
    t = carregador.load(`/tabuleiro/personagens/${arquivo}`)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    cacheTex.set(arquivo, t)
  }
  return t
}

let texSombra: THREE.Texture | null = null

export class Personagem {
  readonly sprite: THREE.Sprite
  readonly sombra: THREE.Mesh
  casa: Casa
  /** 1 = olhando para a direita */
  olhar: number
  vida: number
  readonly vidaMax: number
  private anim: NomeAnim = 'parado'
  private tAnim = 0
  private readonly texturas = new Map<NomeAnim, THREE.Texture>()
  private readonly info: Meta[string]
  /** posição no convés (x, z) e altura (pulo) */
  readonly pos = new THREE.Vector3()
  private caminho: Casa[] = []
  private trecho: { de: THREE.Vector3; para: THREE.Vector3; t: number; dur: number; pulo: boolean } | null = null
  private aoChegar: (() => void) | null = null
  private aoGolpe: (() => void) | null = null
  private golpeDado = false

  readonly id: string
  readonly nome: string

  constructor(id: string, nome: string, casa: Casa, vida: number) {
    this.id = id
    this.nome = nome
    this.info = META[id]
    this.casa = casa
    this.vida = this.vidaMax = vida
    this.olhar = this.info.olha
    for (const a of Object.keys(this.info.anims) as NomeAnim[]) {
      // cada folha é de um personagem só: pode usar a textura direto
      this.texturas.set(a, tex(this.info.anims[a].arquivo))
    }
    const mat = new THREE.SpriteMaterial({ map: this.texturas.get('parado')!, alphaTest: 0.5, transparent: false })
    this.sprite = new THREE.Sprite(mat)
    this.sprite.userData.personagem = this
    texSombra ??= texturaSombra()
    this.sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.42),
      new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }),
    )
    this.sombra.rotation.x = -Math.PI / 2
    const c = centroCasa(casa.l, casa.c)
    this.pos.set(c.x, 0, c.z)
    // começa a respiração em pontos diferentes para não ficarem sincronizados
    this.tAnim = Math.random() * 2
  }

  get ocupado() {
    return this.anim === 'atacar' || this.anim === 'dano' || this.trecho !== null
  }

  tocar(anim: NomeAnim) {
    this.anim = anim
    this.tAnim = 0
    this.golpeDado = false
    this.sprite.material.map = this.texturas.get(anim)!
    this.sprite.material.needsUpdate = true
  }

  /** Anda pelo caminho (casas vizinhas em sequência). */
  andar(caminho: Casa[], aoChegar?: () => void) {
    if (!caminho.length) {
      aoChegar?.()
      return
    }
    this.caminho = [...caminho]
    this.aoChegar = aoChegar ?? null
    this.tocar('andar')
    this.proximoTrecho()
  }

  private proximoTrecho() {
    const prox = this.caminho.shift()
    if (!prox) {
      this.trecho = null
      this.tocar('parado')
      const f = this.aoChegar
      this.aoChegar = null
      f?.()
      return
    }
    const c = centroCasa(prox.l, prox.c)
    const para = new THREE.Vector3(c.x, 0, c.z)
    const pulo = cruzaVao(this.casa, prox)
    if (prox.c !== this.casa.c) this.olhar = prox.c > this.casa.c ? 1 : -1
    const dist = para.distanceTo(this.pos)
    this.trecho = { de: this.pos.clone(), para, t: 0, dur: (dist / VELOCIDADE) * (pulo ? 1.25 : 1), pulo }
    this.casa = prox
  }

  atacar(alvo: Personagem, aoGolpe: () => void) {
    if (alvo.casa.c !== this.casa.c) this.olhar = alvo.casa.c > this.casa.c ? 1 : -1
    this.aoGolpe = aoGolpe
    this.tocar('atacar')
  }

  sofrer(dano: number, deOnde: number) {
    this.vida = Math.max(0, this.vida - dano)
    // recua para longe de quem bateu
    if (deOnde !== 0) this.olhar = -deOnde
    this.tocar('dano')
  }

  atualizar(dt: number) {
    if (this.trecho) {
      const tr = this.trecho
      tr.t = Math.min(1, tr.t + dt / tr.dur)
      this.pos.lerpVectors(tr.de, tr.para, tr.t)
      this.pos.y = tr.pulo ? Math.sin(Math.PI * tr.t) * 0.75 : 0
      if (tr.t >= 1) {
        this.pos.copy(tr.para)
        this.proximoTrecho()
      }
    }
    const info = this.info.anims[this.anim]
    this.tAnim += dt
    const dur = info.quadros / this.info.fps
    if (this.anim === 'atacar' && !this.golpeDado && this.tAnim >= dur * IMPACTO) {
      this.golpeDado = true
      const f = this.aoGolpe
      this.aoGolpe = null
      f?.()
    }
    if (this.tAnim >= dur) {
      if (info.laco) this.tAnim %= dur
      else {
        this.tocar(this.trecho ? 'andar' : 'parado')
      }
    }
  }

  /**
   * Posiciona o sprite: tamanho exato em pixels (um texel por pixel) e canto
   * alinhado à grade de pixels da tela.
   */
  posicionar(camera: THREE.PerspectiveCamera, largura: number, altura: number) {
    const info = this.info.anims[this.anim]
    const q = Math.min(info.quadros - 1, Math.floor(this.tAnim * this.info.fps))
    const map = this.sprite.material.map!
    const img = map.image as HTMLImageElement | undefined
    const tw = img?.width || info.colunas * info.largura
    const th = img?.height || Math.ceil(info.quadros / info.colunas) * info.altura
    const col = q % info.colunas
    const lin = Math.floor(q / info.colunas)
    map.repeat.set(info.largura / tw, info.altura / th)
    map.offset.set((col * info.largura) / tw, 1 - ((lin + 1) * info.altura) / th)

    const espelha = this.olhar !== this.info.olha
    const cx = info.peX / info.largura
    this.sprite.center.set(espelha ? 1 - cx : cx, 1 - info.peY / info.altura)

    // pé no mundo → pixel da tela (arredondado) → de volta ao mundo
    const pe = this.pos.clone()
    const ndc = pe.clone().project(camera)
    const px = Math.round(((ndc.x + 1) / 2) * largura)
    const py = Math.round(((1 - ndc.y) / 2) * altura)
    // puxa um pouco para a câmera, para não brigar com o piso
    const paraCamera = camera.position.clone().sub(pe).normalize().multiplyScalar(0.45)
    const ndcZ = pe.clone().add(paraCamera).project(camera).z
    const alinhado = new THREE.Vector3((px / largura) * 2 - 1, 1 - (py / altura) * 2, ndcZ).unproject(camera)
    this.sprite.position.copy(alinhado)
    // mundo por pixel na profundidade do sprite
    const prof = alinhado.clone().applyMatrix4(camera.matrixWorldInverse).z * -1
    const porPixel = (2 * prof * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / altura
    this.sprite.scale.set(info.largura * porPixel * (espelha ? -1 : 1), info.altura * porPixel, 1)

    this.sombra.position.set(this.pos.x, 0.012, this.pos.z)
    const s = 1 - Math.min(0.5, this.pos.y * 0.6)
    this.sombra.scale.set(s, s, 1)
  }

  /** Ponto acima da cabeça (para barra de vida e números). */
  topo() {
    const info = this.info.anims.parado
    return { pe: this.pos.clone(), alturaPx: info.peY }
  }
}
