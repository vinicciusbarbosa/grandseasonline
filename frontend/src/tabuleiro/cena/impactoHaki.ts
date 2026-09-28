import * as THREE from 'three'

/**
 * Onde um raio do Haki do Rei bate no convés: rachadura escura com brilho
 * vermelho no chão (fica um pouco e some), clarão em estrela e estilhaços de
 * madeira voando.
 */

const VIDA = 1.4 // s da rachadura
const VIDA_CLARAO = 0.45
const PX = 256

function tela() {
  const c = document.createElement('canvas')
  c.width = c.height = PX
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { c, g: c.getContext('2d')!, t }
}

type Lasca = { x: number; y: number; vx: number; vy: number; giro: number; tam: number }

export class ImpactoHaki {
  readonly objetos: THREE.Object3D[]
  vivo = true
  private t = 0
  private readonly rach = tela()
  private readonly clarao = tela()
  private readonly matRach: THREE.MeshBasicMaterial
  private readonly sprite: THREE.Sprite
  private readonly lascas: Lasca[] = []

  constructor(pos: THREE.Vector3, tamanho: number) {
    this.desenharRachadura()
    this.matRach = new THREE.MeshBasicMaterial({ map: this.rach.t, transparent: true, depthWrite: false })
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * tamanho, 2.2 * tamanho), this.matRach)
    chao.rotation.x = -Math.PI / 2
    chao.rotation.z = Math.random() * Math.PI * 2
    chao.position.set(pos.x, 0.018, pos.z)
    chao.renderOrder = 0
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.clarao.t, transparent: true, depthWrite: false, depthTest: false }))
    this.sprite.scale.set(1.8 * tamanho, 1.8 * tamanho, 1)
    this.sprite.center.set(0.5, 0.35)
    this.sprite.position.set(pos.x, 0.05, pos.z)
    this.sprite.renderOrder = 3
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * (0.05 + Math.random() * 0.9) // para cima, espalhando
      const v = 140 + Math.random() * 260
      this.lascas.push({ x: PX / 2, y: PX * 0.65, vx: Math.cos(a) * v, vy: Math.sin(a) * v, giro: Math.random() * 6, tam: 3 + Math.random() * 6 })
    }
    this.objetos = [chao, this.sprite]
  }

  /** Rachadura: linhas pretas quebradas saindo do centro, com brilho vermelho. */
  private desenharRachadura() {
    const { g, t } = this.rach
    const c = PX / 2
    const linhas: [number, number][][] = []
    const n = 5 + Math.floor(Math.random() * 4)
    for (let i = 0; i < n; i++) {
      let a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      let x = c
      let y = c
      const pts: [number, number][] = [[x, y]]
      const comp = PX * (0.18 + Math.random() * 0.3)
      const seg = 3 + Math.floor(Math.random() * 3)
      for (let k = 0; k < seg; k++) {
        a += (Math.random() - 0.5) * 1.1
        const p = (comp / seg) * (0.6 + Math.random() * 0.8)
        x += Math.cos(a) * p
        y += Math.sin(a) * p
        pts.push([x, y])
      }
      linhas.push(pts)
    }
    const tracar = (pts: [number, number][]) => {
      g.beginPath()
      g.moveTo(pts[0][0], pts[0][1])
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y)
      g.stroke()
    }
    g.lineJoin = 'miter'
    g.lineCap = 'round'
    // buraco central escuro
    const buraco = g.createRadialGradient(c, c, 0, c, c, PX * 0.16)
    buraco.addColorStop(0, 'rgba(10,2,2,0.95)')
    buraco.addColorStop(0.6, 'rgba(40,6,6,0.7)')
    buraco.addColorStop(1, 'rgba(40,6,6,0)')
    g.fillStyle = buraco
    g.fillRect(0, 0, PX, PX)
    g.shadowColor = 'rgba(255,30,60,1)'
    g.shadowBlur = 16
    g.strokeStyle = 'rgba(255,40,70,0.95)'
    g.lineWidth = 11
    linhas.forEach(tracar)
    g.shadowBlur = 0
    g.strokeStyle = 'rgba(12,2,2,1)'
    g.lineWidth = 5.5
    linhas.forEach(tracar)
    t.needsUpdate = true
  }

  atualizar(dt: number) {
    this.t += dt
    if (this.t >= VIDA) {
      this.vivo = false
      return
    }
    // rachadura: aparece de uma vez, some no fim
    this.matRach.opacity = this.t < VIDA * 0.6 ? 1 : 1 - (this.t - VIDA * 0.6) / (VIDA * 0.4)
    const { g, t } = this.clarao
    g.clearRect(0, 0, PX, PX)
    const k = this.t / VIDA_CLARAO
    if (k < 1) {
      const cx = PX / 2
      const cy = PX * 0.65
      // estrela de clarão
      const raio = PX * (0.12 + 0.3 * Math.sqrt(k))
      g.save()
      g.translate(cx, cy)
      g.scale(1, 0.55)
      g.fillStyle = `rgba(255,40,70,${(1 - k) * 0.9})`
      g.beginPath()
      const pontas = 10
      for (let i = 0; i <= pontas * 2; i++) {
        const r = i % 2 === 0 ? raio : raio * 0.35
        const a = (i / (pontas * 2)) * Math.PI * 2
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      g.fill()
      const miolo = g.createRadialGradient(0, 0, 0, 0, 0, raio * 0.45)
      miolo.addColorStop(0, `rgba(255,235,240,${1 - k})`)
      miolo.addColorStop(1, 'rgba(255,60,90,0)')
      g.fillStyle = miolo
      g.beginPath()
      g.arc(0, 0, raio * 0.45, 0, Math.PI * 2)
      g.fill()
      // anel de choque
      g.strokeStyle = `rgba(255,120,140,${1 - k})`
      g.lineWidth = 4
      g.beginPath()
      g.arc(0, 0, raio * 1.1, 0, Math.PI * 2)
      g.stroke()
      g.restore()
    }
    // estilhaços do convés
    for (const l of this.lascas) {
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.vy += 700 * dt
      const alfa = Math.max(0, 1 - this.t / 0.9)
      if (alfa <= 0) continue
      g.save()
      g.translate(l.x, l.y)
      g.rotate(l.giro + this.t * 10)
      g.fillStyle = `rgba(70,40,28,${alfa})`
      g.fillRect(-l.tam / 2, -l.tam / 3, l.tam, l.tam * 0.66)
      g.fillStyle = `rgba(170,110,70,${alfa})`
      g.fillRect(-l.tam / 2, -l.tam / 3, l.tam, 1.5)
      g.restore()
    }
    t.needsUpdate = true
  }

  descartar() {
    this.rach.t.dispose()
    this.clarao.t.dispose()
    this.matRach.dispose()
  }
}
