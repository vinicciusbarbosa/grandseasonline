import * as THREE from 'three'

/**
 * Rastro do corte em tempo real: guarda por onde a lâmina passou nos últimos
 * instantes e desenha uma meia-lua entre o meio e (além da) ponta — clara no
 * miolo, colorida nas bordas, sumindo com a idade.
 */

const VIDA = 0.16 // segundos que cada pedaço do rastro dura
const MAX = 48

type Amostra = { ponta: THREE.Vector3; meio: THREE.Vector3; idade: number; forca: number }

export class Rastro {
  readonly malha: THREE.Mesh
  private readonly geo = new THREE.BufferGeometry()
  private amostras: Amostra[] = []
  private readonly pos = new Float32Array(MAX * 2 * 3)
  private readonly cor = new Float32Array(MAX * 2 * 4)

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.cor, 4))
    const idx: number[] = []
    for (let i = 0; i < MAX - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.geo.setIndex(idx)
    this.malha = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.malha.frustumCulled = false
    this.malha.renderOrder = 10
  }

  atualizar(dt: number, ponta: THREE.Vector3, meio: THREE.Vector3, forca: number, miolo: number, meioCor: number, borda: number) {
    for (const a of this.amostras) a.idade += dt
    this.amostras = this.amostras.filter((a) => a.idade < VIDA)
    if (forca > 0) {
      // a ponta do rastro vai além da lâmina: o corte "corta o ar"
      const alem = ponta.clone().add(ponta.clone().sub(meio).multiplyScalar(0.3))
      this.amostras.push({ ponta: alem, meio: meio.clone(), idade: 0, forca })
      if (this.amostras.length > MAX) this.amostras.shift()
    }
    const n = this.amostras.length
    const c0 = new THREE.Color(miolo)
    const c1 = new THREE.Color(meioCor)
    const c2 = new THREE.Color(borda)
    const tmp = new THREE.Color()
    for (let i = 0; i < MAX; i++) {
      const a = this.amostras[Math.min(i, n - 1)]
      if (!a) break
      const v = 1 - a.idade / VIDA // 1 = novo
      const largura = 0.25 + 0.75 * v
      const dentro = a.meio.clone().lerp(a.ponta, 1 - largura * 0.8)
      this.pos.set([dentro.x, dentro.y, dentro.z, a.ponta.x, a.ponta.y, a.ponta.z], i * 6)
      const alfa = Math.min(1, v * 1.4) * a.forca
      tmp.copy(c1).lerp(c0, v)
      this.cor.set([c2.r, c2.g, c2.b, alfa * 0.6, tmp.r, tmp.g, tmp.b, alfa], i * 8)
    }
    this.geo.setDrawRange(0, Math.max(0, n - 1) * 6)
    this.geo.getAttribute('position').needsUpdate = true
    this.geo.getAttribute('color').needsUpdate = true
  }
}
