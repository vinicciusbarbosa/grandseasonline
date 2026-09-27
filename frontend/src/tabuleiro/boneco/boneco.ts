import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Boneco modular dos personagens, "fotografado" em pixel art pelo assador.
 *
 * Corpo base (esqueleto + pele + rosto) e peças independentes que vestem os
 * ossos por cima: cabelo, barba, chapéu, camisa, casaca, capa, cintura,
 * calça, botas e arma. Trocar uma peça é `vestir(encaixe, peça)`; depois o
 * jogo assa de novo as folhas daquela combinação. Olha para +Z; a mão da
 * arma é a do lado -X.
 */

export type NomeOsso =
  | 'quadril'
  | 'tronco'
  | 'peito'
  | 'pescoco'
  | 'cabeca'
  | 'coxaE'
  | 'canelaE'
  | 'peE'
  | 'coxaD'
  | 'canelaD'
  | 'peD'
  | 'bracoE'
  | 'antebracoE'
  | 'maoE'
  | 'bracoD'
  | 'antebracoD'
  | 'maoD'
  | 'espada'

// ------------------------------------------------------------------ peças

export type Corpo = { tipo: 'forte' | 'magro'; pele: number }
export type Cabelo = { estilo: 'curto' | 'longo' | 'careca'; cor: number }
export type Barba = { estilo: 'bigode' | 'cheia'; cor: number } | null
export type Chapeu = { estilo: 'pirata' | 'tricornio'; cor: number; debrum: number; caveira: boolean; pluma: number | null } | null
export type Camisa = { estilo: 'aberta' | 'fechada'; cor: number } | null
export type Casaca = { estilo: 'curta' | 'longa'; cor: number; forro: number; debrum: number; dragonas: boolean } | null
export type Capa = { cor: number; forro: number; debrum: number } | null
export type Cintura = { estilo: 'cinto' | 'faixa'; cor: number } | null
export type Calca = { cor: number }
export type Botas = { estilo: 'curta' | 'alta'; cor: number; punho: number | null }
export type Arma = { estilo: 'sabre'; lamina: number; guarda: number; efeito: [number, number, number] } | null

export type Aparencia = {
  corpo: Corpo
  cabelo: Cabelo
  barba: Barba
  chapeu: Chapeu
  camisa: Camisa
  casaca: Casaca
  capa: Capa
  cintura: Cintura
  calca: Calca
  botas: Botas
  arma: Arma
}

export type Encaixe = keyof Aparencia

export type ParamPano = {
  /** quanto o pano vai para trás (rad a partir da vertical) */
  atras: number
  /** amplitude da onda que desce pelo pano */
  onda: number
  /** fase (0–1) da onda; ciclos inteiros fecham o laço */
  fase: number
  /** balanço para os lados */
  lado: number
}

// ------------------------------------------------------------------ materiais e formas

const gradiente = (() => {
  const d = new Uint8Array([72, 72, 72, 255, 150, 150, 150, 255, 255, 255, 255, 255])
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

export function toon(cor: number, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color: cor, gradientMap: gradiente, ...extra })
}

const escurecer = (cor: number, k: number) => new THREE.Color(cor).multiplyScalar(k).getHex()

function capsula(r: number, comp: number, mat: THREE.Material, seg = 8) {
  const g = new THREE.CapsuleGeometry(r, comp, 3, seg)
  g.translate(0, -comp / 2, 0) // pendurada a partir da junta
  return new THREE.Mesh(g, mat)
}

function caixa(w: number, h: number, d: number, mat: THREE.Material, r = 0.03) {
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, rr), mat)
}

function esfera(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat)
  m.scale.set(sx, sy, sz)
  return m
}

function cilindro(r0: number, r1: number, h: number, mat: THREE.Material, seg = 10) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat)
}

/** Textura do pano: cor, debrum nas laterais e na barra. */
function texturaPano(cor: number, debrum: number) {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const g = c.getContext('2d')!
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
  g.fillStyle = hex(cor)
  g.fillRect(0, 0, 32, 32)
  g.fillStyle = hex(debrum)
  g.fillRect(0, 0, 2, 32)
  g.fillRect(30, 0, 2, 32)
  g.fillRect(0, 29, 32, 3)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ------------------------------------------------------------------ pano

/** Pano (capa ou abas da casaca): grade de vértices recalculada a cada quadro. */
class Pano {
  readonly malha = new THREE.Group()
  private readonly geo = new THREE.BufferGeometry()
  private readonly nu: number
  private readonly nv: number
  private readonly comp: number
  private readonly ancora: (u: number) => THREE.Vector3
  private readonly abre: number
  private readonly radial: ((u: number) => THREE.Vector2) | null

  constructor(
    op: { nu: number; nv: number; comp: number; abre?: number; avesso?: boolean },
    ancora: (u: number) => THREE.Vector3,
    radial: ((u: number) => THREE.Vector2) | null,
    cor: number,
    forro: number,
    debrum: number,
  ) {
    this.nu = op.nu
    this.nv = op.nv
    this.comp = op.comp
    this.abre = op.abre ?? 0
    this.ancora = ancora
    this.radial = radial
    const { nu, nv } = op
    const uv = new Float32Array(nu * nv * 2)
    const idx: number[] = []
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        uv[(j * nu + i) * 2] = i / (nu - 1)
        uv[(j * nu + i) * 2 + 1] = 1 - j / (nv - 1)
        if (i < nu - 1 && j < nv - 1) {
          const a = j * nu + i
          idx.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1)
        }
      }
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nu * nv * 3), 3))
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geo.setIndex(idx)
    this.malha.add(
      // qual lado é o "de fora" depende da ordem em que a grade foi montada
      new THREE.Mesh(this.geo, toon(0xffffff, { map: texturaPano(cor, debrum), side: op.avesso ? THREE.BackSide : THREE.FrontSide })),
      new THREE.Mesh(this.geo, toon(0xffffff, { map: texturaPano(forro, debrum), side: op.avesso ? THREE.FrontSide : THREE.BackSide })),
    )
  }

  /** `baixo`, `tras` e `lat` são gravidade, trás e esquerda no espaço do osso. */
  atualizar(p: ParamPano, baixo: THREE.Vector3, tras: THREE.Vector3, lat: THREE.Vector3) {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute
    const seg = this.comp / (this.nv - 1)
    const onda = Math.PI * 2 * p.fase
    const d = new THREE.Vector3()
    for (let i = 0; i < this.nu; i++) {
      const u = i / (this.nu - 1)
      const ponto = this.ancora(u).clone()
      const fora = this.radial?.(u)
      const centro = u * 2 - 1
      for (let j = 0; j < this.nv; j++) {
        const v = j / (this.nv - 1)
        pos.setXYZ(j * this.nu + i, ponto.x, ponto.y, ponto.z)
        const th = p.atras * (0.35 + 0.65 * v) + p.onda * Math.sin(onda - v * 2.6 + u * 1.1) * (0.25 + v)
        d.copy(baixo).multiplyScalar(Math.cos(th)).addScaledVector(tras, Math.sin(th))
        d.addScaledVector(lat, centro * this.abre * 0.5 + p.lado * Math.sin(onda - v * 2.0 + 1.3 + u) * v * 0.6)
        if (fora) {
          d.x += fora.x * 0.35 * (0.3 + v)
          d.z += fora.y * 0.35 * (0.3 + v)
        }
        ponto.addScaledVector(d.normalize(), seg)
      }
    }
    pos.needsUpdate = true
    this.geo.computeVertexNormals()
    this.geo.computeBoundingSphere()
  }
}

// ------------------------------------------------------------------ boneco

const ABERTURA = 0.62 // meia abertura (rad) da frente da casaca

export class Boneco {
  readonly raiz = new THREE.Group()
  readonly ossos = {} as Record<NomeOsso, THREE.Object3D>
  aparencia: Aparencia
  /** ponta da lâmina no espaço do osso da espada */
  readonly ponta = new THREE.Vector3(-0.08, 0, 0.98)
  private readonly repouso = new Map<THREE.Object3D, THREE.Vector3>()
  private readonly pecas = new Map<Encaixe, THREE.Object3D[]>()
  private capa: Pano | null = null
  private abas: Pano | null = null
  private base: THREE.Object3D[] = []

  constructor(a: Aparencia) {
    this.aparencia = a
    const O = (nome: NomeOsso, pai: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Group()
      o.name = nome
      o.position.set(x, y, z)
      pai.add(o)
      this.ossos[nome] = o
      this.repouso.set(o, o.position.clone())
      return o
    }
    const quadril = O('quadril', this.raiz, 0, 0.94, 0)
    for (const [l, s] of [['E', 1], ['D', -1]] as const) {
      const coxa = O(`coxa${l}`, quadril, 0.12 * s, -0.02, 0)
      const canela = O(`canela${l}`, coxa, 0, -0.42, 0)
      O(`pe${l}`, canela, 0, -0.42, 0)
    }
    const tronco = O('tronco', quadril, 0, 0.12, 0)
    const peito = O('peito', tronco, 0, 0.24, 0)
    const pescoco = O('pescoco', peito, 0, 0.3, 0)
    O('cabeca', pescoco, 0, 0.08, 0)
    for (const [l, s] of [['E', 1], ['D', -1]] as const) {
      const braco = O(`braco${l}`, peito, 0.33 * s, 0.19, 0)
      const ante = O(`antebraco${l}`, braco, 0, -0.3, 0)
      O(`mao${l}`, ante, 0, -0.29, 0)
    }
    O('espada', this.ossos.maoD, 0, -0.04, 0)
    this.montarCorpo()
    for (const e of Object.keys(a) as Encaixe[]) if (e !== 'corpo') this.vestir(e, a[e] as never)
  }

  // ---------------------------------------------------------------- corpo base
  private montarCorpo() {
    for (const o of this.base) o.removeFromParent()
    this.base = []
    const { tipo, pele: corPele } = this.aparencia.corpo
    const f = tipo === 'forte' ? 1 : 0.84
    const pele = toon(corPele)
    const sombra = toon(escurecer(corPele, 0.72))
    const escuro = toon(0x1a1014)
    const add = (osso: NomeOsso, m: THREE.Object3D, x = 0, y = 0, z = 0) => {
      m.position.set(x, y, z)
      this.ossos[osso].add(m)
      this.base.push(m)
      return m
    }
    for (const l of ['E', 'D'] as const) {
      add(`coxa${l}`, capsula(0.11 * f, 0.3, pele))
      add(`canela${l}`, capsula(0.092 * f, 0.32, pele))
      add(`pe${l}`, caixa(0.12, 0.07, 0.22, pele, 0.03), 0, -0.04, 0.05)
      add(`braco${l}`, esfera(0.125 * f, pele))
      add(`braco${l}`, capsula(0.1 * f, 0.2, pele))
      add(`antebraco${l}`, capsula(0.088 * f, 0.18, pele))
      add(`mao${l}`, esfera(0.085, pele, 1, 1.1, 1), 0, -0.03, 0)
    }
    add('quadril', caixa(0.38 * f, 0.2, 0.25, pele, 0.08), 0, 0.02, 0)
    add('tronco', caixa(0.34 * f, 0.24, 0.22, pele, 0.09), 0, 0.1, 0)
    add('peito', caixa(0.54 * f, 0.32, 0.29, pele, 0.12), 0, 0.08, 0)
    // gomos do abdômen e o peitoral: dão leitura de músculo no pixel
    for (const [x, y] of [[-0.05, 0.14], [0.05, 0.14], [-0.05, 0.22], [0.05, 0.22]]) add('tronco', caixa(0.07, 0.06, 0.02, sombra, 0.01), x * f, y, 0.105)
    add('peito', caixa(0.3 * f, 0.02, 0.02, sombra, 0.005), 0, 0.03, 0.135)
    add('pescoco', cilindro(0.075, 0.085, 0.1, pele, 8), 0, 0.03, 0)
    add('cabeca', esfera(0.215, pele, 0.95, 1.08, 1), 0, 0.17, 0)
    add('cabeca', caixa(0.2, 0.12, 0.18, pele, 0.05), 0, 0.06, 0.05)
    for (const s of [1, -1]) add('cabeca', caixa(0.05, 0.035, 0.02, escuro, 0.005), 0.075 * s, 0.17, 0.185)
    add('cabeca', caixa(0.035, 0.06, 0.04, sombra, 0.01), 0, 0.13, 0.2)
    add('cabeca', caixa(0.07, 0.015, 0.02, toon(0xf0e8dc), 0.004), 0, 0.06, 0.17)
    // sobrancelhas seguem a cor do cabelo (vão no encaixe do cabelo)
  }

  // ---------------------------------------------------------------- peças
  /** Troca a peça de um encaixe (null tira a peça). */
  vestir<E extends Encaixe>(encaixe: E, peca: Aparencia[E]) {
    this.aparencia = { ...this.aparencia, [encaixe]: peca }
    if (encaixe === 'corpo') {
      this.montarCorpo()
      return
    }
    for (const o of this.pecas.get(encaixe) ?? []) o.removeFromParent()
    if (encaixe === 'capa') this.capa = null
    if (encaixe === 'casaca') this.abas = null
    const partes: THREE.Object3D[] = []
    const add = (osso: NomeOsso, m: THREE.Object3D, x = 0, y = 0, z = 0) => {
      m.position.set(x, y, z)
      this.ossos[osso].add(m)
      partes.push(m)
      return m
    }
    const f = this.aparencia.corpo.tipo === 'forte' ? 1 : 0.84
    const P = peca as never
    switch (encaixe) {
      case 'cabelo':
        this.pecaCabelo(P, add)
        break
      case 'barba':
        if (peca) this.pecaBarba(P, add)
        break
      case 'chapeu':
        if (peca) this.pecaChapeu(P, add)
        break
      case 'camisa':
        if (peca) this.pecaCamisa(P, add, f)
        break
      case 'casaca':
        if (peca) this.pecaCasaca(P, add, f)
        break
      case 'capa':
        if (peca) this.pecaCapa(P, add)
        break
      case 'cintura':
        if (peca) this.pecaCintura(P, add, f)
        break
      case 'calca':
        this.pecaCalca(P, add, f)
        break
      case 'botas':
        this.pecaBotas(P, add, f)
        break
      case 'arma':
        if (peca) this.pecaArma(P, add)
        break
    }
    this.pecas.set(encaixe, partes)
  }

  private pecaCabelo(c: Cabelo, add: Adicionar) {
    const mat = toon(c.cor)
    for (const s of [1, -1]) {
      const sob = add('cabeca', caixa(0.075, 0.022, 0.02, mat, 0.005), 0.075 * s, 0.21, 0.186)
      sob.rotation.z = -0.25 * s
    }
    if (c.estilo === 'careca') return
    add('cabeca', esfera(0.21, mat, 1.02, 0.9, 0.95), 0, 0.2, -0.04)
    const longo = c.estilo === 'longo'
    const n = longo ? 7 : 6
    for (let k = 0; k < n; k++) {
      const a = (k / (n - 1) - 0.5) * 2.6
      const comp = longo ? 0.3 + 0.08 * Math.cos(a * 2) : 0.12 + (k % 2) * 0.05
      const m = add('cabeca', capsula(0.05, comp, mat, 6), Math.sin(a) * 0.19, 0.2, -Math.cos(a) * 0.17)
      m.rotation.set(-0.35 * Math.cos(a), 0, 0.5 * Math.sin(a))
    }
    // franja
    for (const x of [-0.1, 0, 0.1]) {
      const m = add('cabeca', capsula(0.045, 0.06, mat, 6), x, 0.33, 0.12)
      m.rotation.set(-0.9, 0, x * 3)
    }
  }

  private pecaBarba(b: NonNullable<Barba>, add: Adicionar) {
    const mat = toon(b.cor)
    add('cabeca', caixa(0.14, 0.03, 0.03, mat, 0.01), 0, 0.085, 0.18)
    if (b.estilo === 'cheia') add('cabeca', caixa(0.2, 0.1, 0.12, mat, 0.04), 0, 0.02, 0.1)
  }

  private pecaChapeu(c: NonNullable<Chapeu>, add: Adicionar) {
    const matCh = toon(c.cor)
    const matAba = toon(c.cor, { side: THREE.DoubleSide })
    const matDeb = toon(c.debrum)
    const g = new THREE.Group()
    add('cabeca', g, 0, 0.33, 0)
    const copa = esfera(0.19, matCh, 1.05, 0.72, 1)
    copa.position.y = 0.05
    g.add(copa)
    const larg = c.estilo === 'pirata' ? 1.15 : 1
    const sobe = (ang: number) =>
      c.estilo === 'tricornio'
        ? (1 - Math.abs(Math.cos(1.5 * ang))) * 0.22
        : Math.max(0, Math.cos(ang)) * 0.24 + Math.max(0, -Math.cos(ang)) * 0.12 - Math.abs(Math.sin(ang)) * 0.02
    const aba = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 30, 1)
    const pa = aba.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i)
      const z = pa.getZ(i)
      const r = Math.hypot(x, z)
      pa.setY(i, pa.getY(i) + sobe(Math.atan2(x, z)) * Math.min(1, (r - 0.12) / 0.3))
      pa.setX(i, x * larg)
    }
    aba.computeVertexNormals()
    g.add(new THREE.Mesh(aba, matAba))
    const pts: THREE.Vector3[] = []
    for (let k = 0; k < 48; k++) {
      const ang = (k / 48) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.sin(ang) * 0.42 * larg, sobe(ang) + 0.015, Math.cos(ang) * 0.42))
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.022, 4, true), matDeb))
    if (c.caveira) {
      const osso = toon(0xf2ece0)
      const cav = esfera(0.065, osso, 1, 0.95, 0.5)
      cav.position.set(0, 0.17, 0.33)
      cav.rotation.x = -0.6
      g.add(cav)
      for (const s of [1, -1]) {
        const o = caixa(0.2, 0.03, 0.02, osso, 0.01)
        o.position.set(0, 0.14, 0.34)
        o.rotation.set(-0.6, 0, 0.6 * s)
        g.add(o)
      }
    }
    if (c.pluma !== null) {
      const pl = capsula(0.05, 0.36, toon(c.pluma), 6)
      pl.position.set(-0.18, 0.12, 0.02)
      pl.rotation.set(0.3, 0, 1.9)
      g.add(pl)
    }
  }

  private pecaCamisa(c: NonNullable<Camisa>, add: Adicionar, f: number) {
    const mat = toon(c.cor)
    const w = c.estilo === 'aberta' ? 0.4 : 1
    // costas e lados da camisa (a frente fica aberta no estilo "aberta")
    const perfil = [[0.2, -0.3], [0.25, 0.0], [0.27, 0.2], [0.13, 0.28]].map(([r, y]) => new THREE.Vector2(r * f, y))
    const ab = c.estilo === 'aberta' ? 0.5 : 0.001
    const m = new THREE.Mesh(new THREE.LatheGeometry(perfil, 14, ab, Math.PI * 2 - ab * 2), toon(c.cor, { side: THREE.DoubleSide }))
    m.scale.set(1, 1, 0.62)
    add('peito', m, 0, 0.01, 0)
    for (const l of ['E', 'D'] as const) add(`braco${l}`, capsula(0.09 * f, 0.16 * w + 0.04, mat))
  }

  private pecaCasaca(c: NonNullable<Casaca>, add: Adicionar, f: number) {
    const mat = toon(c.cor)
    const deb = toon(c.debrum)
    const perfil = [[0.21, -0.3], [0.25, -0.12], [0.3, 0.06], [0.33, 0.18], [0.3, 0.26], [0.13, 0.3]].map(
      ([r, y]) => new THREE.Vector2(r * f, y),
    )
    const corpo = new THREE.Mesh(new THREE.LatheGeometry(perfil, 16, ABERTURA, Math.PI * 2 - ABERTURA * 2), toon(c.cor, { side: THREE.DoubleSide }))
    corpo.scale.set(1, 1, 0.66)
    add('peito', corpo, 0, 0.02, 0)
    for (const s of [1, -1]) {
      const lap = add('peito', caixa(0.04, 0.5, 0.03, deb, 0.01), 0.1 * s * f, -0.08, 0.14)
      lap.rotation.z = -0.12 * s
    }
    for (const l of ['E', 'D'] as const) {
      add(`braco${l}`, esfera(0.135 * f, mat))
      add(`braco${l}`, capsula(0.11 * f, 0.2, mat))
      add(`antebraco${l}`, capsula(0.1 * f, 0.18, mat))
      add(`antebraco${l}`, cilindro(0.115 * f, 0.115 * f, 0.08, deb), 0, -0.22, 0)
    }
    if (c.dragonas) {
      for (const s of [1, -1]) {
        add('peito', esfera(0.1, deb, 1.3, 0.5, 1.1), 0.25 * s * f, 0.25, 0)
        for (let k = 0; k < 5; k++) add('peito', cilindro(0.012, 0.012, 0.09, deb, 4), (0.35 + (k - 2) * 0.012) * s * f, 0.2, (k - 2) * 0.04)
      }
    }
    const abas = new Pano(
      { nu: 11, nv: 7, comp: c.estilo === 'longa' ? 0.72 : 0.42 },
      (u) => {
        const ang = ABERTURA + u * (Math.PI * 2 - ABERTURA * 2)
        return new THREE.Vector3(Math.sin(ang) * 0.25 * f, -0.05, Math.cos(ang) * 0.18)
      },
      (u) => {
        const ang = ABERTURA + u * (Math.PI * 2 - ABERTURA * 2)
        return new THREE.Vector2(Math.sin(ang), Math.cos(ang) * 0.7)
      },
      c.cor,
      c.forro,
      c.debrum,
    )
    add('tronco', abas.malha)
    this.abas = abas
  }

  private pecaCapa(c: NonNullable<Capa>, add: Adicionar) {
    const capa = new Pano(
      { nu: 7, nv: 9, comp: 1.05, abre: 0.55, avesso: true },
      (u) => {
        const x = (u - 0.5) * 0.56
        return new THREE.Vector3(x, 0.26 - Math.abs(x) * 0.15, -0.12 - 0.06 * (1 - (2 * u - 1) ** 2))
      },
      null,
      c.cor,
      c.forro,
      c.debrum,
    )
    add('peito', capa.malha)
    // gola que prende a capa
    const gola = add('peito', cilindro(0.2, 0.26, 0.08, toon(c.cor), 12), 0, 0.27, -0.02)
    gola.scale.z = 0.7
    this.capa = capa
  }

  private pecaCintura(c: NonNullable<Cintura>, add: Adicionar, f: number) {
    const mat = toon(c.cor)
    if (c.estilo === 'cinto') {
      add('quadril', caixa(0.42 * f, 0.06, 0.28, mat, 0.02), 0, 0.12, 0)
      add('quadril', caixa(0.08, 0.06, 0.03, toon(0xe0b040), 0.01), 0, 0.12, 0.14)
    } else {
      add('quadril', caixa(0.43 * f, 0.09, 0.29, mat, 0.03), 0, 0.12, 0)
      const ponta = add('quadril', caixa(0.07, 0.24, 0.03, mat, 0.01), 0.12, -0.02, 0.14)
      ponta.rotation.z = 0.15
    }
  }

  private pecaCalca(c: Calca, add: Adicionar, f: number) {
    const mat = toon(c.cor)
    add('quadril', caixa(0.41 * f, 0.22, 0.27, mat, 0.08), 0, 0.02, 0)
    for (const l of ['E', 'D'] as const) {
      add(`coxa${l}`, capsula(0.12 * f, 0.3, mat))
      add(`canela${l}`, capsula(0.1 * f, 0.2, mat))
    }
  }

  private pecaBotas(b: Botas, add: Adicionar, f: number) {
    const mat = toon(b.cor)
    const sola = toon(0x1a1014)
    for (const l of ['E', 'D'] as const) {
      if (b.estilo === 'alta') {
        add(`canela${l}`, capsula(0.105 * f, 0.32, mat))
        add(`canela${l}`, cilindro(0.125 * f, 0.11 * f, 0.07, mat), 0, -0.02, 0)
      } else {
        add(`canela${l}`, cilindro(0.09, 0.095, 0.2, mat), 0, -0.32, 0)
      }
      if (b.punho !== null) add(`canela${l}`, cilindro(0.11, 0.1, 0.07, toon(b.punho)), 0, b.estilo === 'alta' ? -0.02 : -0.2, 0)
      add(`pe${l}`, caixa(0.16, 0.1, 0.28, mat, 0.045), 0, -0.035, 0.05)
      add(`pe${l}`, caixa(0.16, 0.025, 0.29, sola, 0.01), 0, -0.08, 0.05)
    }
  }

  private pecaArma(a: NonNullable<Arma>, add: Adicionar) {
    const forma = new THREE.Shape()
    forma.moveTo(-0.022, 0.12)
    forma.quadraticCurveTo(-0.03, 0.55, -0.08, 0.98)
    forma.quadraticCurveTo(0.02, 0.8, 0.045, 0.55)
    forma.lineTo(0.032, 0.12)
    forma.lineTo(-0.022, 0.12)
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.018, bevelEnabled: false })
    geo.translate(0, 0, -0.009)
    const lam = add('espada', new THREE.Mesh(geo, toon(a.lamina)))
    lam.rotation.x = Math.PI / 2 // lâmina ao longo de +Z do osso
    const guarda = add('espada', new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 10, Math.PI * 1.2), toon(a.guarda)), 0, 0, 0.1)
    guarda.rotation.y = Math.PI / 2
    const cabo = add('espada', cilindro(0.022, 0.022, 0.16, toon(0x3a2418), 6), 0, 0, 0.02)
    cabo.rotation.x = Math.PI / 2
  }

  // ---------------------------------------------------------------- pose
  /** Volta todos os ossos para o repouso. */
  zerar() {
    for (const [o, p] of this.repouso) {
      o.position.copy(p)
      o.rotation.set(0, 0, 0)
    }
    this.raiz.position.set(0, 0, 0)
  }

  /** Recalcula os panos depois de posar os ossos. */
  atualizarPanos(capa: ParamPano, abas: ParamPano) {
    this.raiz.updateMatrixWorld(true)
    const raizQ = new THREE.Quaternion()
    this.raiz.getWorldQuaternion(raizQ)
    const emOsso = (o: THREE.Object3D) => {
      const q = new THREE.Quaternion()
      o.getWorldQuaternion(q)
      const inv = q.invert().multiply(raizQ)
      return [new THREE.Vector3(0, -1, 0).applyQuaternion(inv), new THREE.Vector3(0, 0, -1).applyQuaternion(inv), new THREE.Vector3(1, 0, 0).applyQuaternion(inv)] as const
    }
    if (this.capa) this.capa.atualizar(capa, ...emOsso(this.ossos.peito))
    if (this.abas) this.abas.atualizar(abas, ...emOsso(this.ossos.tronco))
  }
}

type Adicionar = (osso: NomeOsso, m: THREE.Object3D, x?: number, y?: number, z?: number) => THREE.Object3D

// ------------------------------------------------------------------ os dois capitães

export const CAPITAES: Record<string, Aparencia> = {
  'capitao-vermelho': {
    corpo: { tipo: 'forte', pele: 0xe8a878 },
    cabelo: { estilo: 'curto', cor: 0x3f5a3a },
    barba: { estilo: 'cheia', cor: 0x3a2a24 },
    chapeu: { estilo: 'pirata', cor: 0xb0222a, debrum: 0xe0a83a, caveira: true, pluma: 0x3a3450 },
    camisa: null,
    casaca: { estilo: 'curta', cor: 0xb0242a, forro: 0x5a1418, debrum: 0xe0a83a, dragonas: false },
    capa: { cor: 0xa81e26, forro: 0x3a1a24, debrum: 0xe0a83a },
    cintura: { estilo: 'cinto', cor: 0x2a2226 },
    calca: { cor: 0xe88a2c },
    botas: { estilo: 'curta', cor: 0x7a4a2a, punho: 0xe8e4f0 },
    arma: { estilo: 'sabre', lamina: 0xd8dde6, guarda: 0xe0a83a, efeito: [0xfff6d0, 0xffb340, 0xd8401c] },
  },
  'capitao-negro': {
    corpo: { tipo: 'forte', pele: 0xdca070 },
    cabelo: { estilo: 'longo', cor: 0x2a1c16 },
    barba: { estilo: 'bigode', cor: 0x2a1c16 },
    chapeu: { estilo: 'tricornio', cor: 0x262228, debrum: 0xeae6ea, caveira: false, pluma: null },
    camisa: null,
    casaca: { estilo: 'longa', cor: 0x2c2a30, forro: 0x7a1420, debrum: 0xe8b43c, dragonas: true },
    capa: null,
    cintura: { estilo: 'faixa', cor: 0xb0202c },
    calca: { cor: 0xeceaf2 },
    botas: { estilo: 'alta', cor: 0x2a2428, punho: null },
    arma: { estilo: 'sabre', lamina: 0xdfe4ec, guarda: 0xe8b43c, efeito: [0xf0fbff, 0x8cd0ff, 0x2a6ae0] },
  },
}
