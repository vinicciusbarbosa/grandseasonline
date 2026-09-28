import * as THREE from 'three'
import { DIRECOES, PE_X, PE_Y, QUADRO_A, QUADRO_L, type Folhas } from '../boneco/assador'
import type { Direcao, EstadoVisual, InfoAnim, NomeAnim, Visual } from './personagem'
import { ESCALA_ARTE_ANTIGA, posicionarPixel, texturaPixel } from './pixel'
import { texturaSombra } from './texturas'

/**
 * Visual em pixel art: folhas assadas do boneco, 8 direções (5 assadas + 3
 * espelhadas), um texel por pixel da tela.
 */

const ESPELHO: Partial<Record<Direcao, Direcao>> = { SW: 'SE', W: 'E', NW: 'NE' }
let texSombra: THREE.Texture | null = null

export class VisualSprite implements Visual {
  readonly info: Record<NomeAnim, InfoAnim>
  readonly objetos: THREE.Object3D[]
  readonly altura = 2.3
  readonly alturaPx = 118 * ESCALA_ARTE_ANTIGA
  private readonly sprite: THREE.Sprite
  private readonly sombra: THREE.Mesh
  private readonly texturas = new Map<string, THREE.Texture>()
  private animAtual = ''

  constructor(folhas: Folhas) {
    this.info = folhas as unknown as Record<NomeAnim, InfoAnim>
    for (const [n, f] of Object.entries(folhas)) {
      const t = texturaPixel(f.canvas)
      t.repeat.set(1 / f.quadros, 1 / DIRECOES.length)
      this.texturas.set(n, t)
    }
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texturas.get('parado')!, alphaTest: 0.5 }))
    texSombra ??= texturaSombra()
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.38), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }))
    this.sombra.rotation.x = -Math.PI / 2
    this.objetos = [this.sprite, this.sombra]
  }

  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    if (e.anim !== this.animAtual) {
      this.animAtual = e.anim
      this.sprite.material.map = this.texturas.get(e.anim)!
      this.sprite.material.needsUpdate = true
    }
    const f = this.info[e.anim]
    const q = Math.min(f.quadros - 1, Math.floor(e.tAnim * f.fps))
    const base = ESPELHO[e.dir] ?? e.dir
    const linha = DIRECOES.indexOf(base as (typeof DIRECOES)[number])
    const espelha = e.dir in ESPELHO
    this.sprite.material.map!.offset.set(q / f.quadros, 1 - (linha + 1) / DIRECOES.length)
    const cx = PE_X / QUADRO_L
    this.sprite.center.set(espelha ? 1 - cx : cx, 1 - PE_Y / QUADRO_A)
    const k = e.clarao > 0 ? 3.2 : 1
    this.sprite.material.color.setRGB(k, k, k)
    posicionarPixel(this.sprite, e.pos, QUADRO_L * ESCALA_ARTE_ANTIGA, QUADRO_A * ESCALA_ARTE_ANTIGA, camera, telaL, telaA, espelha)
    this.sombra.position.set(e.pos.x, 0.012, e.pos.z)
    const s = 1 - Math.min(0.5, e.pos.y * 0.6)
    this.sombra.scale.set(s, s, 1)
  }
}
