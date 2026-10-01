import * as THREE from 'three'
import type { Direcao, EstadoVisual, InfoAnim, NomeAnim, Visual } from './personagem'
import { atualizarLuz, materialIluminado } from './luzSprite'
import { PX_CASA, escalaPixel, posicionarPixel } from './pixel'
import { texturaSombra } from './texturas'
import { recurso } from './visualFolhas'
import { ANIMACOES, ATAQUES, poseEm, type Pose } from './animacoesRecorte'

/**
 * Personagem recortado em partes (como no Wakfu): cada vista (3/4 de frente
 * e 3/4 de costas) é um conjunto de peças com pivô — cabeça, tronco,
 * quadril, braços, antebraços, coxas e canelas — montadas e giradas por
 * código a cada quadro, num canvas que vira a textura do sprite.
 *
 * As peças saem de scripts/sprites/recorte.py (public/sprites/<id>/recorte/).
 * As animações são quadros-chave de ângulos (animacoesRecorte.ts).
 * Direções: as diagonais de frente usam a vista de frente, as de trás a de
 * costas; o outro lado é o espelho.
 */

type Peca = { x: number; y: number; l: number; a: number; pai: string | null; pivo: [number, number] }
type Vista = { olha: 1 | -1; altura: number; pe: [number, number]; tamanho: [number, number]; ordem: string[]; pecas: Record<string, Peca>; juntas: Record<string, [number, number]> }
/** arma solta (lâmina para cima, fio para a direita); `pega` = onde a mão segura */
type Arma = { l: number; a: number; pega: [number, number] }
type Esqueleto = { vistas: Record<NomeVista, Vista>; armas: Record<string, Arma> }
type NomeVista = 'frente' | 'costas'

/**
 * px do tabuleiro: altura do personagem. Proporção do Wakfu: o personagem
 * ocupa uma casa e tem ~1,45× a largura dela de altura.
 */
const ALTURA_PX = Math.round(PX_CASA * 1.45)
/** canvas: quanto cabe em volta do corpo (golpes, corrida), px do tabuleiro */
const QUADRO: [number, number] = [Math.round(ALTURA_PX * 1.45), Math.round(ALTURA_PX * 1.45)]
const PE: [number, number] = [QUADRO[0] / 2, QUADRO[1] - Math.round(ALTURA_PX * 0.1)]

const TEMPO: Record<NomeAnim, InfoAnim> = {
  parado: { quadros: 12, fps: 6, laco: true, poeira: [] },
  andar: { quadros: 8, fps: 10, laco: true, poeira: [] },
  correr: { quadros: 8, fps: 12.5, laco: true, poeira: [] },
  frear: { quadros: 12, fps: 12, laco: false, poeira: [undefined, undefined, 'E', undefined, 'E'] },
  parar: { quadros: 8, fps: 14, laco: false, poeira: [] },
  atacar: { quadros: 12, fps: 15, laco: false, impacto: 6, poeira: [] },
  dano: { quadros: 12, fps: 16, laco: false, poeira: [] },
}

/** lado da tela para onde olha (1 direita) e qual vista, por direção do tabuleiro */
const VISTA_DIR: Record<Direcao, [NomeVista, 1 | -1]> = {
  S: ['frente', -1], SW: ['frente', -1], W: ['frente', -1], SE: ['frente', 1], E: ['frente', 1],
  N: ['costas', 1], NE: ['costas', 1], NW: ['costas', -1],
}

let texSombra: THREE.Texture | null = null

export class VisualRecorte implements Visual {
  readonly info = TEMPO
  readonly objetos: THREE.Object3D[]
  readonly alturaPx = ALTURA_PX
  readonly altura = ALTURA_PX / 60
  private readonly vistas: Record<NomeVista, Vista>
  private readonly imagens: Record<NomeVista, Record<string, HTMLImageElement>>
  private readonly sprite: THREE.Sprite
  private readonly sombra: THREE.Mesh
  private readonly canvas = document.createElement('canvas')
  private readonly ctx: CanvasRenderingContext2D
  private readonly textura: THREE.CanvasTexture
  private densidade = 0
  /** arma nas duas mãos (machados) — null: mãos vazias */
  private readonly arma: { info: Arma; img: HTMLImageElement; tipo: string } | null

  private constructor(vistas: Record<NomeVista, Vista>, imagens: Record<NomeVista, Record<string, HTMLImageElement>>, arma: VisualRecorte['arma']) {
    this.vistas = vistas
    this.imagens = imagens
    this.arma = arma
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

  static async carregar(personagem: string, nomeArma?: string) {
    const base = `${import.meta.env.BASE_URL}sprites/${personagem}/recorte/`
    const url = recurso(`${base}esqueleto.json`)
    const esq = (url.startsWith('data:') ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))) : await (await fetch(url)).json()) as Esqueleto
    const vistas = esq.vistas
    const carregarImg = (arquivo: string) =>
      new Promise<HTMLImageElement>((ok, erro) => {
        const img = new Image()
        img.onload = () => ok(img)
        img.onerror = () => erro(new Error(`recorte ${arquivo}`))
        img.src = recurso(`${base}${arquivo}`)
      })
    const imagens = { frente: {}, costas: {} } as Record<NomeVista, Record<string, HTMLImageElement>>
    await Promise.all((Object.keys(vistas) as NomeVista[]).flatMap((v) => Object.keys(vistas[v].pecas).map(async (p) => (imagens[v][p] = await carregarImg(`${v}/${p}.png`)))))
    const info = nomeArma ? esq.armas[nomeArma] : undefined
    const arma = info && nomeArma ? { info, img: await carregarImg(`armas/${nomeArma}.png`), tipo: nomeArma } : null
    return new VisualRecorte(vistas, imagens, arma)
  }

  tem() {
    return true
  }

  /** Monta a pose no canvas (densidade = texels por px do tabuleiro). */
  private desenhar(nomeVista: NomeVista, lado: 1 | -1, pose: Pose, dens: number) {
    const v = this.vistas[nomeVista]
    const c = this.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const k = (ALTURA_PX * dens) / v.altura
    // espelha quando a vista olha para o outro lado
    const espelho = lado === v.olha ? 1 : -1
    // ângulo positivo = membro para a frente (para onde a vista olha)
    const sinal = -v.olha
    // corpo todo: estica/achata a partir do pé (sx, sy)
    const base = new DOMMatrix().translate(PE[0] * dens, PE[1] * dens).scale(k * espelho * (pose.sx ?? 1), k * (pose.sy ?? 1)).translate(-v.pe[0] + (pose.dx ?? 0) * v.olha, -v.pe[1] + (pose.dy ?? 0))
    const mundo = new Map<string, DOMMatrix>()
    const matriz = (n: string): DOMMatrix => {
      const pronta = mundo.get(n)
      if (pronta) return pronta
      const p = v.pecas[n]
      const pai = p.pai ? matriz(p.pai) : base
      const ang = ((pose[n] ?? 0) * sinal * Math.PI) / 180
      // `<peça>.e`: encurta/estica ao longo do osso (membro indo para a frente/trás em 3/4)
      const m = pai.translate(p.pivo[0], p.pivo[1]).rotate((ang * 180) / Math.PI).scale(1, pose[`${n}.e`] ?? 1).translate(-p.pivo[0], -p.pivo[1])
      mundo.set(n, m)
      return m
    }
    for (const n of v.ordem) {
      const p = v.pecas[n]
      if (!p) continue
      c.setTransform(matriz(n))
      c.drawImage(this.imagens[nomeVista][n], p.x, p.y)
      // arma: filha do antebraço, presa na mão; de repouso aponta para baixo
      // e um pouco para a frente, com o fio para a frente
      const lado = n === 'antebraco_perto' ? 'perto' : n === 'antebraco_longe' ? 'longe' : null
      if (lado && this.arma) {
        const a = this.arma.info
        const mao = v.juntas[`mao_${lado}`]
        const ang = 180 + (30 + (pose[`arma_${lado}`] ?? 0)) * sinal
        c.setTransform(matriz(n).translate(mao[0], mao[1]).rotate(ang).scale(sinal, 1).translate(-a.pega[0], -a.pega[1]))
        c.drawImage(this.arma.img, 0, 0)
      }
    }
  }

  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    // canvas na resolução da tela (zoom), até 3 texels por px
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
    const [vista, lado] = VISTA_DIR[e.dir]
    const chaves = e.anim === 'atacar' && this.arma ? (ATAQUES[this.arma.tipo] ?? ANIMACOES.atacar) : ANIMACOES[e.anim]
    this.desenhar(vista, lado, poseEm(chaves, fase, info.laco), dens)
    this.textura.needsUpdate = true
    const mat = this.sprite.material
    this.sprite.center.set(PE[0] / QUADRO[0], 1 - PE[1] / QUADRO[1])
    const k = e.clarao > 0 ? 3.2 : 1
    mat.color.setRGB(k, k, k)
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
