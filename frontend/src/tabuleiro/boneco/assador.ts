import * as THREE from 'three'
import { ANIMACOES, type Extra } from './animacoes'
import { Boneco, type Aparencia } from './boneco'

/**
 * "Fotografa" o boneco em pixel art: câmera ortográfica com 48 pixels por
 * unidade, sem suavização, sombreamento em três tons e contorno escuro de um
 * pixel. Assa 5 direções (as outras 3 são o espelho) de cada animação, já com
 * o rastro do golpe e o brilho da lâmina desenhados no quadro.
 */

export const PX_POR_UNIDADE = 48
export const QUADRO_L = 208
export const QUADRO_A = 184
/** pixel do quadro onde fica o chão, entre os pés */
export const PE_X = 104
export const PE_Y = 160

/** Direções assadas (linhas da folha) e o giro do boneco em cada uma. */
export const DIRECOES = ['S', 'SE', 'E', 'NE', 'N'] as const
const GIRO: Record<(typeof DIRECOES)[number], number> = { S: 0, SE: 45, E: 90, NE: 135, N: 180 }

export type FolhaAnim = {
  nome: string
  canvas: HTMLCanvasElement
  quadros: number
  fps: number
  laco: boolean
  impacto?: number
  /** fumaça pedida em cada quadro (mesma para todas as direções) */
  poeira: ('E' | 'D' | undefined)[]
}

export type Folhas = Record<string, FolhaAnim>

const ELEVACAO = THREE.MathUtils.degToRad(24)

function estrela() {
  const c = document.createElement('canvas')
  c.width = c.height = 11
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(5, 0, 1, 11)
  g.fillRect(0, 5, 11, 1)
  g.fillRect(4, 4, 3, 3)
  g.fillStyle = '#fff4b0'
  g.fillRect(5, 2, 1, 1)
  g.fillRect(5, 8, 1, 1)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = t.minFilter = THREE.NearestFilter
  return t
}

export class Assador {
  private readonly renderer: THREE.WebGLRenderer
  private readonly cena = new THREE.Scene()
  private readonly camera: THREE.OrthographicCamera
  private readonly alvo: THREE.WebGLRenderTarget
  private readonly buf = new Uint8Array(QUADRO_L * QUADRO_A * 4)
  private readonly brilho: THREE.Sprite

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    const P = PX_POR_UNIDADE
    this.camera = new THREE.OrthographicCamera(-PE_X / P, (QUADRO_L - PE_X) / P, PE_Y / P, -(QUADRO_A - PE_Y) / P, 0.1, 60)
    this.camera.position.set(0, Math.sin(ELEVACAO) * 20, Math.cos(ELEVACAO) * 20)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    // luz presa à câmera: do alto à esquerda, na frente
    const sol = new THREE.DirectionalLight(0xfff2e0, 3.4)
    sol.position.set(-6, 12, 9)
    this.cena.add(sol, new THREE.HemisphereLight(0xc8d8ff, 0x806050, 1.1))
    this.alvo = new THREE.WebGLRenderTarget(QUADRO_L, QUADRO_A, { depthBuffer: true })
    this.alvo.texture.colorSpace = THREE.SRGBColorSpace
    this.brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: estrela(), depthTest: false }))
    this.brilho.renderOrder = 10
  }

  assar(aparencia: Aparencia): Folhas {
    const b = new Boneco(aparencia)
    this.cena.add(b.raiz)
    const folhas: Folhas = {}
    const corEfeito = aparencia.arma?.efeito ?? [0xffffff, 0xaaccff, 0x4466cc]
    for (const [nome, anim] of Object.entries(ANIMACOES)) {
      const canvas = document.createElement('canvas')
      canvas.width = anim.quadros * QUADRO_L
      canvas.height = DIRECOES.length * QUADRO_A
      const g = canvas.getContext('2d')!
      const poeira: FolhaAnim['poeira'] = []
      DIRECOES.forEach((dir, linha) => {
        for (let q = 0; q < anim.quadros; q++) {
          const t = anim.laco ? q / anim.quadros : q / (anim.quadros - 1)
          const posar = (tt: number) => {
            b.zerar()
            b.raiz.rotation.y = THREE.MathUtils.degToRad(GIRO[dir])
            return anim.pose(b, tt)
          }
          // rastro: amostra a ponta e a base da lâmina ao longo do golpe
          const extra0 = posar(t)
          const rastro = extra0.rastro ? this.rastro(b, posar, extra0.rastro, corEfeito) : null
          const extra: Extra = posar(t)
          b.atualizarPanos(extra.capa, extra.abas)
          if (rastro) this.cena.add(rastro)
          if (extra.brilho) {
            b.raiz.updateMatrixWorld(true)
            const p = b.ponta.clone()
            b.ossos.espada.localToWorld(p)
            this.brilho.position.copy(p)
            const s = (11 / PX_POR_UNIDADE) * (0.6 + 0.8 * extra.brilho * (0.75 + 0.25 * Math.sin(q * 2.1)))
            this.brilho.scale.set(s, s, 1)
            this.cena.add(this.brilho)
          }
          this.renderer.setRenderTarget(this.alvo)
          this.renderer.setClearColor(0x000000, 0)
          this.renderer.clear()
          this.renderer.render(this.cena, this.camera)
          this.renderer.readRenderTargetPixels(this.alvo, 0, 0, QUADRO_L, QUADRO_A, this.buf)
          this.renderer.setRenderTarget(null)
          if (rastro) {
            this.cena.remove(rastro)
            rastro.geometry.dispose()
          }
          this.cena.remove(this.brilho)
          g.putImageData(contorno(this.buf), q * QUADRO_L, linha * QUADRO_A)
          if (linha === 0) poeira.push(extra.poeira)
        }
      })
      folhas[nome] = { nome, canvas, quadros: anim.quadros, fps: anim.fps, laco: anim.laco, impacto: anim.impacto, poeira }
    }
    this.cena.remove(b.raiz)
    return folhas
  }

  /** Meia-lua do golpe: faixa entre a base e (além da) ponta da lâmina. */
  private rastro(
    b: Boneco,
    posar: (t: number) => Extra,
    r: NonNullable<Extra['rastro']>,
    cores: [number, number, number],
  ) {
    const N = 14
    const base: THREE.Vector3[] = []
    const ponta: THREE.Vector3[] = []
    const inicio = r.de + (r.ate - r.de) * (1 - Math.max(0, Math.min(1, r.forca)))
    for (let i = 0; i <= N; i++) {
      const tt = inicio + ((r.ate - inicio) * i) / N
      posar(tt)
      b.raiz.updateMatrixWorld(true)
      const p = b.ponta.clone()
      const q = b.ponta.clone().multiplyScalar(0.3)
      b.ossos.espada.localToWorld(p)
      b.ossos.espada.localToWorld(q)
      // a ponta do rastro vai além da lâmina: o corte "corta o ar"
      const alem = p.clone().sub(q).multiplyScalar(0.28)
      ponta.push(p.add(alem))
      base.push(q)
    }
    const pos: number[] = []
    const cor: number[] = []
    const c0 = new THREE.Color(cores[2])
    const c1 = new THREE.Color(cores[1])
    const c2 = new THREE.Color(cores[0])
    for (let i = 0; i <= N; i++) {
      const idade = i / N // 0 = mais antigo
      // mais fino no começo do rastro
      const q = base[i].clone().lerp(ponta[i], 1 - (0.35 + 0.65 * idade) * 0.85)
      pos.push(q.x, q.y, q.z, ponta[i].x, ponta[i].y, ponta[i].z)
      const dentro = idade < 0.35 ? c0 : idade < 0.75 ? c1 : c2
      const fora = idade < 0.5 ? c1 : c2
      cor.push(dentro.r, dentro.g, dentro.b, fora.r, fora.g, fora.b)
    }
    const idx: number[] = []
    for (let i = 0; i < N; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3))
    geo.setIndex(idx)
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
    m.renderOrder = 5
    return m
  }
}

/**
 * Converte o quadro lido da GPU (de baixo para cima) em ImageData, com alfa
 * binário e contorno de um pixel: escuro, puxado para a cor vizinha.
 */
function contorno(buf: Uint8Array) {
  const W = QUADRO_L
  const H = QUADRO_A
  const img = new ImageData(W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 4
    for (let x = 0; x < W; x++) {
      const i = src + x * 4
      const o = (y * W + x) * 4
      if (buf[i + 3] > 100) {
        d[o] = buf[i]
        d[o + 1] = buf[i + 1]
        d[o + 2] = buf[i + 2]
        d[o + 3] = 255
      }
    }
  }
  const cheio = new Uint8Array(W * H)
  for (let k = 0; k < W * H; k++) cheio[k] = d[k * 4 + 3] ? 1 : 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x
      if (cheio[k]) continue
      let viz = -1
      if (x > 0 && cheio[k - 1]) viz = k - 1
      else if (x < W - 1 && cheio[k + 1]) viz = k + 1
      else if (y > 0 && cheio[k - W]) viz = k - W
      else if (y < H - 1 && cheio[k + W]) viz = k + W
      if (viz < 0) continue
      const o = k * 4
      d[o] = 20 + d[viz * 4] * 0.18
      d[o + 1] = 12 + d[viz * 4 + 1] * 0.14
      d[o + 2] = 16 + d[viz * 4 + 2] * 0.16
      d[o + 3] = 255
    }
  return img
}
