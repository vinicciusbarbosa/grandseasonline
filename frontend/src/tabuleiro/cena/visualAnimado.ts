import * as THREE from 'three'
import type { Direcao, EstadoVisual, InfoAnim, NomeAnim, Visual } from './personagem'
import { atualizarLuz, materialIluminado } from './luzSprite'
import { PX_CASA, escalaPixel, posicionarPixel } from './pixel'
import { texturaSombra } from './texturas'
import { recurso } from './visualFolhas'
import { carregarImagem, desenharPose, poseEm, recortarPeca, type Animacao, type NomeVista, type Projeto } from '../../editor/projeto'

/**
 * Personagem animado no editor de animação (/editor-animacao): lê
 * public/sprites/<id>/animacao.json, recorta as peças das folhas e monta a
 * pose a cada quadro num canvas que vira a textura do sprite.
 *
 * Diagonais de frente usam a vista "frente", as de trás a "costas"; o outro
 * lado é o espelho. Animação que falta numa vista usa a da outra vista, e
 * por fim o parado.
 */

/** px do tabuleiro: altura do personagem (~1,45× a largura da casa, como no Wakfu) */
const ALTURA_PX = Math.round(PX_CASA * 1.45)
const QUADRO: [number, number] = [Math.round(ALTURA_PX * 1.6), Math.round(ALTURA_PX * 1.5)]
const PE: [number, number] = [QUADRO[0] / 2, QUADRO[1] - Math.round(ALTURA_PX * 0.12)]
const QUADROS = 12

const VISTA_DIR: Record<Direcao, [NomeVista, 1 | -1]> = {
  S: ['frente', -1], SW: ['frente', -1], W: ['frente', -1], SE: ['frente', 1], E: ['frente', 1],
  N: ['costas', 1], NE: ['costas', 1], NW: ['costas', -1],
}
const NOMES: NomeAnim[] = ['parado', 'andar', 'correr', 'frear', 'parar', 'atacar', 'dano']
const PADRAO: Record<NomeAnim, { duracao: number; laco: boolean }> = {
  parado: { duracao: 1.6, laco: true },
  andar: { duracao: 0.8, laco: true },
  correr: { duracao: 0.64, laco: true },
  frear: { duracao: 1, laco: false },
  parar: { duracao: 0.6, laco: false },
  atacar: { duracao: 0.8, laco: false },
  dano: { duracao: 0.75, laco: false },
}

let texSombra: THREE.Texture | null = null

export class VisualAnimado implements Visual {
  readonly info = {} as Record<NomeAnim, InfoAnim>
  readonly objetos: THREE.Object3D[]
  readonly alturaPx = ALTURA_PX
  readonly altura = ALTURA_PX / 60
  private readonly proj: Projeto
  private readonly pecas: Map<string, HTMLCanvasElement>
  private readonly sprite: THREE.Sprite
  private readonly sombra: THREE.Mesh
  private readonly canvas = document.createElement('canvas')
  private readonly ctx: CanvasRenderingContext2D
  private readonly textura: THREE.CanvasTexture
  private densidade = 0

  private constructor(proj: Projeto, pecas: Map<string, HTMLCanvasElement>) {
    this.proj = proj
    this.pecas = pecas
    for (const n of NOMES) {
      const a = this.animacao(n, 'frente') ?? this.animacao(n, 'costas')
      const dur = a?.duracao ?? PADRAO[n].duracao
      const laco = a?.laco ?? PADRAO[n].laco
      this.info[n] = { quadros: QUADROS, fps: QUADROS / dur, laco, impacto: n === 'atacar' ? Math.round((a?.impacto ?? 0.5) * QUADROS) : undefined, poeira: [] }
    }
    this.ctx = this.canvas.getContext('2d')!
    this.textura = new THREE.CanvasTexture(this.canvas)
    this.textura.colorSpace = THREE.SRGBColorSpace
    this.textura.minFilter = THREE.LinearFilter
    this.textura.generateMipmaps = false
    this.sprite = new THREE.Sprite(materialIluminado({ map: this.textura }))
    texSombra ??= texturaSombra()
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }))
    this.sombra.rotation.x = -Math.PI / 2
    this.objetos = [this.sprite, this.sombra]
  }

  /** null se o personagem ainda não tem animacao.json */
  static async carregar(personagem: string) {
    const base = `${import.meta.env.BASE_URL}sprites/${personagem}/`
    const url = recurso(`${base}animacao.json`)
    let proj: Projeto
    try {
      if (url.startsWith('data:')) proj = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))) as Projeto
      else {
        const r = await fetch(url)
        if (!r.ok) return null
        proj = (await r.json()) as Projeto
      }
    } catch {
      return null
    }
    const usadas = new Set(Object.values(proj.pecas).map((p) => p.folha))
    const folhas = new Map<string, HTMLImageElement>()
    await Promise.all([...usadas].map(async (f) => folhas.set(f, await carregarImagem(recurso(`${base}folhas/${f}`)))))
    const pecas = new Map<string, HTMLCanvasElement>()
    for (const [id, p] of Object.entries(proj.pecas)) {
      const img = folhas.get(p.folha)
      if (img) pecas.set(id, recortarPeca(img, p))
    }
    return new VisualAnimado(proj, pecas)
  }

  private animacao(n: NomeAnim, v: NomeVista): Animacao | undefined {
    const a = this.proj.animacoes[v]?.[n]
    return a && a.chaves.length ? a : undefined
  }

  tem() {
    return true
  }

  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    const dens = Math.min(3, Math.max(1, Math.ceil(escalaPixel.zoom * 2) / 2))
    if (dens !== this.densidade) {
      this.densidade = dens
      this.canvas.width = QUADRO[0] * dens
      this.canvas.height = QUADRO[1] * dens
      this.textura.dispose()
    }
    const info = this.info[e.anim]
    const dur = info.quadros / info.fps
    const fase = info.laco ? (e.tAnim / dur) % 1 : Math.min(1, e.tAnim / dur)
    let [vista, lado] = VISTA_DIR[e.dir]
    const outra: NomeVista = vista === 'frente' ? 'costas' : 'frente'
    let anim = this.animacao(e.anim, vista)
    if (!anim && this.animacao(e.anim, outra)) {
      vista = outra
      anim = this.animacao(e.anim, outra)
    }
    anim ??= this.animacao('parado', vista) ?? this.animacao('parado', outra)
    const c = this.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (anim) {
      const k = (ALTURA_PX * dens) / this.proj.altura
      const espelho = lado === this.proj.olha[vista] ? 1 : -1
      const base = new DOMMatrix().translate(PE[0] * dens, PE[1] * dens).scale(k * espelho, k)
      desenharPose(c, this.proj, poseEm(anim, fase), base, this.pecas)
    }
    this.textura.needsUpdate = true
    const mat = this.sprite.material
    this.sprite.center.set(PE[0] / QUADRO[0], 1 - PE[1] / QUADRO[1])
    const kl = e.clarao > 0 ? 3.2 : 1
    mat.color.setRGB(kl, kl, kl)
    if (e.tinta) mat.color.multiply(e.tinta)
    this.sprite.visible = !e.oculto
    const peY = 1 - PE[1] / QUADRO[1]
    atualizarLuz(mat, this.textura, false, peY, peY + ALTURA_PX / QUADRO[1], e.luz)
    posicionarPixel(this.sprite, e.pos, QUADRO[0], QUADRO[1], camera, telaL, telaA, false, 0.45)
    if (e.escala && e.escala !== 1) this.sprite.scale.multiplyScalar(e.escala)
    this.sombra.position.set(e.pos.x, 0.012, e.pos.z)
    const s = 1 - Math.min(0.5, e.pos.y * 0.6)
    this.sombra.scale.set(s, s, 1)
  }
}
