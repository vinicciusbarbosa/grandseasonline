import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CHAO, MATERIAL } from './paleta'
import { aleatorio } from './pecas'

/** Metadados de uma ilha (gerados em scripts/ilhas → mundo/ilhas.json). */
export type ObjetoIlha = { t: string; x: number; y: number; r?: number; [k: string]: unknown }
export type MetaIlha = {
  id: number
  nome: string
  x: number
  y: number
  passo: number
  colunas: number
  linhas: number
  alturaMax: number
  flutuante: boolean
  objetos: ObjetoIlha[]
  vegetacao?: { palmeiras?: number; pinheiros?: number }
}

const DESLOCAMENTO_ALTURA = 32
const ESCALA_ALTURA = 64

/** Mapa de altura + materiais de uma ilha, lido do PNG (R,G = altura; B = material). */
export class MapaIlha {
  readonly meta: MetaIlha
  readonly h: Float32Array
  readonly mat: Uint8Array

  constructor(meta: MetaIlha, dados: ImageData) {
    this.meta = meta
    const n = meta.colunas * meta.linhas
    this.h = new Float32Array(n)
    this.mat = new Uint8Array(n)
    const d = dados.data
    for (let i = 0; i < n; i++) {
      this.h[i] = ((d[i * 4] << 8) | d[i * 4 + 1]) / ESCALA_ALTURA - DESLOCAMENTO_ALTURA
      this.mat[i] = d[i * 4 + 2]
    }
  }

  /** Altura do chão num ponto do mundo (bilinear). */
  altura(x: number, y: number) {
    const { colunas, linhas, passo } = this.meta
    const gx = Math.max(0, Math.min(colunas - 1.001, (x - this.meta.x) / passo))
    const gy = Math.max(0, Math.min(linhas - 1.001, (y - this.meta.y) / passo))
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const fx = gx - ix
    const fy = gy - iy
    const i = iy * colunas + ix
    const a = this.h[i] * (1 - fx) + this.h[i + 1] * fx
    const b = this.h[i + colunas] * (1 - fx) + this.h[i + colunas + 1] * fx
    return a * (1 - fy) + b * fy
  }

  material(x: number, y: number) {
    const { colunas, linhas, passo } = this.meta
    const gx = Math.round((x - this.meta.x) / passo)
    const gy = Math.round((y - this.meta.y) / passo)
    if (gx < 0 || gy < 0 || gx >= colunas || gy >= linhas) return 0
    return this.mat[gy * colunas + gx]
  }

  /** Menor altura sob um círculo (para objetos não flutuarem em encosta). */
  alturaMinima(x: number, y: number, raio: number) {
    let m = this.altura(x, y)
    for (let a = 0; a < 6; a++) m = Math.min(m, this.altura(x + Math.cos(a) * raio, y + Math.sin(a) * raio))
    return m
  }
}

/** Ruído de valor 2D (determinístico) em 0..1. */
function ruido(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const h = (a: number, b: number) => {
    let n = (a * 374761393 + b * 668265263) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v
}

function fbm(x: number, y: number) {
  return ruido(x, y) * 0.55 + ruido(x * 2.1, y * 2.1) * 0.3 + ruido(x * 4.3, y * 4.3) * 0.15
}

const ca = new THREE.Color()
const cb = new THREE.Color()

/** A malha do chão, com cor por vértice (material, ruído, umidade na beira). */
export function malhaTerreno(mapa: MapaIlha) {
  const { colunas, linhas, passo, x: x0, y: y0 } = mapa.meta
  const n = colunas * linhas
  const pos = new Float32Array(n * 3)
  const cores = new Float32Array(n * 3)
  for (let j = 0; j < linhas; j++) {
    for (let i = 0; i < colunas; i++) {
      const k = j * colunas + i
      const x = x0 + i * passo
      const z = y0 + j * passo
      const h = mapa.h[k]
      pos[k * 3] = x
      pos[k * 3 + 1] = h
      pos[k * 3 + 2] = z

      const m = mapa.mat[k] || MATERIAL.AREIA
      const base = CHAO[m] ?? CHAO[MATERIAL.GRAMA]
      const r1 = fbm(x / 38, z / 38)
      const r2 = ruido(x / 9, z / 9)
      ca.setHex(base.cor)
      if (base.escura !== undefined) {
        cb.setHex(base.escura)
        ca.lerp(cb, Math.max(0, Math.min(1, (r1 - 0.35) * 1.8)))
      }
      const v = 1 + (r2 - 0.5) * base.variacao * 2
      ca.multiplyScalar(v)
      // Areia molhada na linha d'água; pedra mais clara no alto.
      if (h < 1.2) ca.lerp(cb.setHex(0xc9b58a), Math.max(0, Math.min(1, (1.2 - h) / 1.6)) * 0.7)
      if (h > 60) ca.lerp(cb.setHex(0xe8e0d0), Math.min(0.35, (h - 60) / 200))
      cores[k * 3] = ca.r
      cores[k * 3 + 1] = ca.g
      cores[k * 3 + 2] = ca.b
    }
  }
  // Borra as cores (2 passadas 3×3): a troca de material vira degradê, sem o
  // serrilhado dos triângulos na divisa areia/grama.
  const tmp = new Float32Array(cores.length)
  for (let passada = 0; passada < 2; passada++) {
    for (let j = 0; j < linhas; j++) {
      for (let i = 0; i < colunas; i++) {
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j + dj
          if (jj < 0 || jj >= linhas) continue
          for (let di = -1; di <= 1; di++) {
            const ii = i + di
            if (ii < 0 || ii >= colunas) continue
            const k = (jj * colunas + ii) * 3
            r += cores[k]
            g += cores[k + 1]
            b += cores[k + 2]
            n++
          }
        }
        const k = (j * colunas + i) * 3
        tmp[k] = r / n
        tmp[k + 1] = g / n
        tmp[k + 2] = b / n
      }
    }
    cores.set(tmp)
  }

  const indices: number[] = []
  for (let j = 0; j < linhas - 1; j++) {
    for (let i = 0; i < colunas - 1; i++) {
      const a = j * colunas + i
      const b = a + 1
      const c = a + colunas
      const d = c + 1
      // pula quadrados inteiramente no fundo do mar
      if (mapa.h[a] < -4 && mapa.h[b] < -4 && mapa.h[c] < -4 && mapa.h[d] < -4) continue
      indices.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  const malha = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }))
  malha.receiveShadow = true
  malha.castShadow = true
  return malha
}

// ---- Árvores ---------------------------------------------------------------------------

type TipoArvore = 'folhosa' | 'pinheiro' | 'palmeira' | 'tangerina'

function pintar(g: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex)
  const n = g.getAttribute('position').count
  const cores = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) cores.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  if (g.getAttribute('uv')) g.deleteAttribute('uv')
  return g.index ? g.toNonIndexed() : g
}

function peca(g: THREE.BufferGeometry, hex: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(sx, sy, sz)))
  return pintar(g, hex)
}

/** Árvore de anime: copa em bolas sobrepostas, clara em cima. Tamanho ~1 (escala na instância). */
function geometriaArvore(tipo: TipoArvore) {
  const partes: THREE.BufferGeometry[] = []
  if (tipo === 'folhosa') {
    partes.push(peca(new THREE.CylinderGeometry(0.5, 0.75, 4, 6), 0x7a5232, 0, 2, 0))
    partes.push(peca(new THREE.IcosahedronGeometry(4.2, 1), 0x3d8f36, 0, 7, 0, 1, 0.9, 1))
    partes.push(peca(new THREE.IcosahedronGeometry(3.1, 1), 0x4ea43e, -2.2, 8.6, 1.2, 1, 0.9, 1))
    partes.push(peca(new THREE.IcosahedronGeometry(2.9, 1), 0x55ad44, 2.1, 8.9, -0.8, 1, 0.9, 1))
    partes.push(peca(new THREE.IcosahedronGeometry(2.4, 1), 0x6cc24a, 0.2, 10.4, 0.4, 1, 0.85, 1))
  } else if (tipo === 'pinheiro') {
    partes.push(peca(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), 0x6a4a2e, 0, 1.5, 0))
    partes.push(peca(new THREE.ConeGeometry(3.6, 6, 8), 0x2f6e3a, 0, 5, 0))
    partes.push(peca(new THREE.ConeGeometry(2.8, 5, 8), 0x377d42, 0, 8, 0))
    partes.push(peca(new THREE.ConeGeometry(1.9, 4, 8), 0x3f8a4a, 0, 10.8, 0))
  } else if (tipo === 'palmeira') {
    // tronco curvo em três gomos
    partes.push(peca(new THREE.CylinderGeometry(0.45, 0.6, 4, 6), 0x9a7650, 0, 2, 0))
    partes.push(peca(new THREE.CylinderGeometry(0.38, 0.45, 4, 6), 0xa47f58, 0.6, 5.8, 0))
    partes.push(peca(new THREE.CylinderGeometry(0.32, 0.38, 4, 6), 0x9a7650, 1.4, 9.4, 0))
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      const folha = new THREE.BoxGeometry(6.5, 0.25, 1.5)
      folha.applyMatrix4(new THREE.Matrix4().makeTranslation(3, 0, 0))
      folha.applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.35))
      folha.applyMatrix4(new THREE.Matrix4().makeRotationY(a))
      folha.applyMatrix4(new THREE.Matrix4().makeTranslation(1.6, 11.4, 0))
      partes.push(pintar(folha, k % 2 ? 0x4fa83e : 0x3e9235))
    }
    partes.push(peca(new THREE.IcosahedronGeometry(0.8, 0), 0x6b4a2a, 1.6, 11, 0))
  } else {
    // tangerineira: copa baixa e redonda com frutas laranja
    partes.push(peca(new THREE.CylinderGeometry(0.4, 0.6, 2.5, 6), 0x7a5232, 0, 1.25, 0))
    partes.push(peca(new THREE.IcosahedronGeometry(3.2, 1), 0x3f8f3a, 0, 5, 0, 1, 0.85, 1))
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4
      const y = 3.6 + (k % 3) * 1.2
      partes.push(peca(new THREE.IcosahedronGeometry(0.55, 0), 0xf28a1e, Math.cos(a) * 3, y, Math.sin(a) * 3))
    }
  }
  const g = mergeGeometries(partes, false)!
  g.computeVertexNormals()
  return g
}

/** Onde não pode ter árvore: casas, muralhas, cais... (círculos em px do mundo). */
export type Bloqueio = { x: number; y: number; r: number }[]

/**
 * Espalha as árvores pelo material do chão: mata fechada na FLORESTA, poucas
 * na grama, pinheiros esparsos na pedra, palmeiras na areia (se a ilha pede).
 */
export function arvores(mapa: MapaIlha, bloqueios: Bloqueio) {
  const rng = aleatorio(mapa.meta.id * 7919)
  const { colunas, linhas, passo, x: x0, y: y0 } = mapa.meta
  const palmeiras = mapa.meta.vegetacao?.palmeiras ?? 0
  const lista: Record<TipoArvore, { x: number; y: number; z: number; s: number; r: number; tom: number }[]> = {
    folhosa: [],
    pinheiro: [],
    palmeira: [],
    tangerina: [],
  }
  // Grade de bloqueio (rápida) a cada 4 px.
  const bl = new Uint8Array(colunas * linhas)
  for (const b of bloqueios) {
    const r = Math.ceil(b.r / passo)
    const ci = Math.round((b.x - x0) / passo)
    const cj = Math.round((b.y - y0) / passo)
    for (let j = cj - r; j <= cj + r; j++)
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= colunas || j >= linhas) continue
        if (Math.hypot(i - ci, j - cj) * passo <= b.r) bl[j * colunas + i] = 1
      }
  }

  const espaco = 7.5
  const largura = colunas * passo
  const altura = linhas * passo
  for (let y = y0; y < y0 + altura; y += espaco) {
    for (let x = x0; x < x0 + largura; x += espaco) {
      const px = x + (rng() - 0.5) * espaco * 0.9
      const py = y + (rng() - 0.5) * espaco * 0.9
      const h = mapa.altura(px, py)
      if (h < 1.5) continue
      const gi = Math.round((px - x0) / passo)
      const gj = Math.round((py - y0) / passo)
      if (gi < 0 || gj < 0 || gi >= colunas || gj >= linhas || bl[gj * colunas + gi]) continue
      const m = mapa.mat[gj * colunas + gi]
      const bosque = fbm(px / 60, py / 60)
      let tipo: TipoArvore | null = null
      let s = 1
      if (m === MATERIAL.FLORESTA) {
        if (rng() < 0.93) {
          tipo = h > 70 && rng() < 0.5 ? 'pinheiro' : 'folhosa'
          s = 0.95 + rng() * 0.55
        }
      } else if (m === MATERIAL.GRAMA) {
        if (rng() < 0.02 + Math.max(0, bosque - 0.6) * 0.5) {
          tipo = 'folhosa'
          s = 0.85 + rng() * 0.4
        }
      } else if (m === MATERIAL.CAMPINA) {
        if (rng() < 0.06) {
          tipo = 'folhosa'
          s = 0.8 + rng() * 0.4
        }
      } else if (m === MATERIAL.ROCHA || m === MATERIAL.PENHASCO) {
        if (rng() < 0.06) {
          tipo = 'pinheiro'
          s = 0.7 + rng() * 0.4
        }
      } else if (m === MATERIAL.AREIA) {
        if (palmeiras > 0 && h > 2 && rng() < palmeiras) {
          tipo = 'palmeira'
          s = 0.9 + rng() * 0.35
        }
      }
      if (!tipo) continue
      lista[tipo].push({ x: px, y: h - 0.5, z: py, s, r: rng() * Math.PI * 2, tom: 0.85 + rng() * 0.3 })
    }
  }

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })
  const malhas: THREE.InstancedMesh[] = []
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const cor = new THREE.Color()
  for (const tipo of Object.keys(lista) as TipoArvore[]) {
    const itens = lista[tipo]
    if (itens.length === 0) continue
    const malha = new THREE.InstancedMesh(geometriaArvore(tipo), material, itens.length)
    itens.forEach((a, i) => {
      q.setFromAxisAngle(eixoY, a.r)
      m4.compose(new THREE.Vector3(a.x, a.y, a.z), q, new THREE.Vector3(a.s, a.s, a.s))
      malha.setMatrixAt(i, m4)
      malha.setColorAt(i, cor.setRGB(a.tom, a.tom * (0.95 + (a.tom - 0.85) * 0.2), a.tom * 0.9))
    })
    malha.castShadow = true
    malha.receiveShadow = true
    malhas.push(malha)
  }
  return malhas
}

/** Acrescenta árvores avulsas (ex.: pomar de tangerinas) — reaproveita a mesma geometria. */
export function arvoresAvulsas(tipo: TipoArvore, pontos: { x: number; y: number; z: number; s: number }[]) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })
  const malha = new THREE.InstancedMesh(geometriaArvore(tipo), material, Math.max(1, pontos.length))
  const m4 = new THREE.Matrix4()
  pontos.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s))
    malha.setMatrixAt(i, m4)
  })
  malha.count = pontos.length
  malha.castShadow = true
  malha.receiveShadow = true
  return malha
}
