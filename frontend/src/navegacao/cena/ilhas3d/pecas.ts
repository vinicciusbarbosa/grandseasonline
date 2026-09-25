import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Montador de modelos: cada peça (caixa, cilindro, telhado...) vira geometria
 * com a cor gravada nos vértices, já posicionada no mundo. No fim tudo é
 * fundido numa malha só — uma chamada de desenho para a ilha inteira.
 *
 * Eixos do Three aqui: X = x do mundo, Z = y do mundo (sul), Y = altura.
 * Ângulos `r` são os do mundo 2D (atan2 em x/y); no Three viram rotação -r em Y.
 */

const cor = new THREE.Color()

export class Pecas {
  private readonly geos: THREE.BufferGeometry[] = []
  private readonly pilha: THREE.Matrix4[] = [new THREE.Matrix4()]
  /** Caixas (no mundo) de cada objeto, para saber a altura de cada faixa. */
  readonly caixas: THREE.Box3[] = []

  private get topo() {
    return this.pilha[this.pilha.length - 1]
  }

  /** Executa `fn` com um referencial local em (x, y, z) girado `r` (ângulo do mundo 2D). */
  em(x: number, y: number, z: number, r: number, fn: () => void) {
    const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(-r))
    this.pilha.push(this.topo.clone().multiply(m))
    fn()
    this.pilha.pop()
  }

  /** Igual a `em`, mas com uma matriz qualquer (rotações em X/Z, escala). */
  com(m: THREE.Matrix4, fn: () => void) {
    this.pilha.push(this.topo.clone().multiply(m))
    fn()
    this.pilha.pop()
  }

  add(geo: THREE.BufferGeometry, hex: number, suave = false, local?: THREE.Matrix4) {
    let g = geo
    if (suave) {
      if (!g.getAttribute('normal')) g.computeVertexNormals()
      if (g.index) g = g.toNonIndexed()
    } else {
      if (g.index) g = g.toNonIndexed()
      g.deleteAttribute('normal')
      g.computeVertexNormals()
    }
    if (g.getAttribute('uv')) g.deleteAttribute('uv')
    const m = local ? this.topo.clone().multiply(local) : this.topo
    g.applyMatrix4(m)
    cor.setHex(hex)
    const n = g.getAttribute('position').count
    const cores = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      cores[i * 3] = cor.r
      cores[i * 3 + 1] = cor.g
      cores[i * 3 + 2] = cor.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
    this.geos.push(g)
    return g
  }

  /** Caixa com a base apoiada em y (centro em x, z). */
  caixa(w: number, h: number, d: number, hex: number, x = 0, y = 0, z = 0, r = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), hex, false, lugar(x, y + h / 2, z, r))
  }

  cilindro(rTopo: number, rBase: number, h: number, hex: number, x = 0, y = 0, z = 0, lados = 10, suave = true) {
    return this.add(new THREE.CylinderGeometry(rTopo, rBase, h, lados), hex, suave, lugar(x, y + h / 2, z, 0))
  }

  cone(r: number, h: number, hex: number, x = 0, y = 0, z = 0, lados = 10, suave = false) {
    return this.add(new THREE.ConeGeometry(r, h, lados), hex, suave, lugar(x, y + h / 2, z, 0))
  }

  esfera(r: number, hex: number, x = 0, y = 0, z = 0, achatar = 1, detalhe = 1) {
    const m = lugar(x, y, z, 0).multiply(new THREE.Matrix4().makeScale(1, achatar, 1))
    return this.add(new THREE.IcosahedronGeometry(r, detalhe), hex, true, m)
  }

  /**
   * Telhado de duas águas: cumeeira ao longo de Z (comprimento `w`), caindo
   * para ±X (profundidade `d`), com beiral `beiral`.
   */
  telhado(w: number, d: number, altura: number, hex: number, y = 0, beiral = 1.2, quatroAguas = false) {
    const x = d / 2 + beiral
    const z = w / 2 + beiral
    const zc = quatroAguas ? Math.max(0, z - x * 0.9) : z
    // prettier-ignore
    const v = [
      // água -X
      -x, 0, -z,   0, altura, -zc,   0, altura, zc,
      -x, 0, -z,   0, altura, zc,    -x, 0, z,
      // água +X
      x, 0, z,     0, altura, zc,    0, altura, -zc,
      x, 0, z,     0, altura, -zc,   x, 0, -z,
      // oitões (ou águas de ponta)
      -x, 0, z,    0, altura, zc,    x, 0, z,
      x, 0, -z,    0, altura, -zc,   -x, 0, -z,
    ]
    // Os triângulos acima estão escritos no sentido horário; inverte para a normal apontar para fora.
    for (let i = 0; i < v.length; i += 9) {
      for (let k = 0; k < 3; k++) [v[i + 3 + k], v[i + 6 + k]] = [v[i + 6 + k], v[i + 3 + k]]
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    return this.add(g, hex, false, lugar(0, y, 0, 0))
  }

  /** Telhado de uma água só (barracos, alpendres): cai para +X. */
  meiaAgua(w: number, d: number, alto: number, baixo: number, hex: number, y = 0, beiral = 1) {
    const x = d / 2 + beiral
    const z = w / 2 + beiral
    // prettier-ignore
    const v = [
      -x, alto, -z,  -x, alto, z,  x, baixo, z,
      -x, alto, -z,  x, baixo, z,  x, baixo, -z,
    ]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    // dupla face: vista de baixo também
    const g2 = g.clone()
    g2.setIndex([0, 2, 1, 3, 5, 4])
    this.add(g, hex, false, lugar(0, y, 0, 0))
    return this.add(g2, hex, false, lugar(0, y, 0, 0))
  }

  /** Muro reto de (x0,z0) até (x1,z1), no referencial atual. */
  muro(x0: number, z0: number, x1: number, z1: number, altura: number, espessura: number, hex: number, y = 0) {
    const comp = Math.hypot(x1 - x0, z1 - z0)
    const r = Math.atan2(z1 - z0, x1 - x0)
    return this.caixa(comp, altura, espessura, hex, (x0 + x1) / 2, y, (z0 + z1) / 2, r)
  }

  /** Registra a caixa do que foi adicionado desde `desde` (para o recorte em faixas). */
  marcar(desde: number) {
    const caixa = new THREE.Box3()
    for (let i = desde; i < this.geos.length; i++) {
      this.geos[i].computeBoundingBox()
      caixa.union(this.geos[i].boundingBox!)
    }
    if (!caixa.isEmpty()) this.caixas.push(caixa)
  }

  get total() {
    return this.geos.length
  }

  malha(material: THREE.Material) {
    if (this.geos.length === 0) return null
    const g = mergeGeometries(this.geos, false)!
    for (const x of this.geos) x.dispose()
    this.geos.length = 0
    const m = new THREE.Mesh(g, material)
    m.castShadow = true
    m.receiveShadow = true
    return m
  }
}

/** Matriz de translação + rotação (ângulo do mundo 2D). */
export function lugar(x: number, y: number, z: number, r: number) {
  return new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(-r))
}

/** Gerador pseudoaleatório determinístico (mulberry32): a mesma ilha sai sempre igual. */
export function aleatorio(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function escolher<T>(lista: readonly T[], rng: () => number) {
  return lista[Math.floor(rng() * lista.length) % lista.length]
}

/** Clareia (+) ou escurece (−) uma cor em RGB. */
export function tom(hex: number, f: number) {
  const r = (hex >> 16) & 255
  const g = (hex >> 8) & 255
  const b = hex & 255
  const ajustar = (c: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f))))
  return (ajustar(r) << 16) | (ajustar(g) << 8) | ajustar(b)
}
