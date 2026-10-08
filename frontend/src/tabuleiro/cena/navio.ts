import * as THREE from 'three'
import { COLUNAS, METADE, VAO, tiposMetade } from '../tabuleiro'
import type { TipoCasa } from './texturas'
import { recurso } from './visualFolhas'
import {
  rng,
  texturaBarril,
  texturaCaixote,
  texturaCorda,
  texturaFerro,
  texturaMadeira,
  texturaTabuleiro,
  texturaTampa,
  texturaVela,
} from './texturas'

/**
 * Os dois navios do combate, lado a lado (como na referência): o de cima com
 * o castelo de popa, mastro e vela vermelha; o de baixo com a amurada da
 * frente, canhão e a bandeira azul. Cada convés carrega meio tabuleiro 5×20.
 */

const TEXELS = 48 // texels por unidade do mundo (uma casa = 48)

/** Caixa com UV na escala do mundo: a textura repete em vez de esticar. */
function caixa(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], tam = 64) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  const faces: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = faces[f]
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * fu * TEXELS) / tam, (uv.getY(k) * fv * TEXELS) / tam)
    }
  }
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Vela lisa (sem caveira): dobras verticais, costuras e uma faixa colorida. */
function texturaVelaLisa(cor: [number, number, number], faixa: [number, number, number]) {
  const w = 96
  const h = 112
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  for (let x = 0; x < w; x++) {
    const k = 0.84 + Math.sin((x / w) * Math.PI * 3.2) * 0.1 - Math.pow(Math.abs(x / w - 0.5) * 2, 3) * 0.2
    const q = Math.round(k * 6) / 6
    g.fillStyle = `rgb(${cor[0] * q},${cor[1] * q},${cor[2] * q})`
    g.fillRect(x, 0, 1, h)
  }
  g.fillStyle = `rgba(0,0,0,0.12)`
  for (let y = 18; y < h; y += 22) g.fillRect(0, y, w, 1)
  g.fillStyle = `rgb(${faixa.join(',')})`
  g.fillRect(0, h * 0.62, w, 9)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

/** Bandeira da Marinha: branca, gaivota azul e a faixa azul embaixo. */
function texturaBandeiraMarinha() {
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 72
  const g = c.getContext('2d')!
  g.fillStyle = '#eef0f4'
  g.fillRect(0, 0, 96, 72)
  g.fillStyle = '#2c4f9e'
  g.fillRect(0, 56, 96, 10)
  g.strokeStyle = '#2c4f9e'
  g.lineWidth = 6
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(22, 36)
  g.quadraticCurveTo(36, 16, 48, 32)
  g.quadraticCurveTo(60, 16, 74, 36)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

const lambert = (map: THREE.Texture | null, cor = 0xffffff, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ map, color: cor, ...extra })

export class Materiais {
  convesMargem = lambert(texturaMadeira(64, 64, 2, 64 / 5, 11))
  casco = lambert(texturaMadeira(64, 64, 5, 64 / 6, 12))
  cascoClaro = lambert(texturaMadeira(64, 64, 3, 64 / 6, 13))
  amurada = lambert(texturaMadeira(64, 64, 3, 64 / 3, 14, true))
  poste = lambert(texturaMadeira(32, 32, 3, 8, 15, true))
  caixote = lambert(texturaCaixote(16))
  barril = lambert(texturaBarril(17))
  tampa = lambert(texturaTampa(18))
  ferro = lambert(texturaFerro())
  corda = lambert(texturaCorda())
  mastro = lambert(texturaMadeira(32, 64, 2, 6, 19, true))
  azul = lambert(null, 0x2c4f9e)
  lanterna = new THREE.MeshBasicMaterial({ color: 0xffd36a })
}

function poste(M: Materiais, x: number, z: number, alt: number) {
  const g = new THREE.Group()
  const p = caixa(0.26, alt, 0.26, M.poste, 32)
  p.position.set(x, alt / 2, z)
  const tampa = caixa(0.34, 0.1, 0.34, M.amurada)
  tampa.position.set(x, alt + 0.05, z)
  const bola = caixa(0.18, 0.12, 0.18, M.poste, 32)
  bola.position.set(x, alt + 0.16, z)
  g.add(p, tampa, bola)
  return g
}

/** Amurada entre dois pontos (ao longo de X ou de Z): postes, corrimão, balaústres. */
function amurada(M: Materiais, x0: number, z0: number, x1: number, z1: number, alt = 0.72) {
  const g = new THREE.Group()
  const comp = Math.hypot(x1 - x0, z1 - z0)
  const aoLongoX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
  const n = Math.max(1, Math.round(comp / 1.6))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    g.add(poste(M, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, alt + 0.12))
  }
  const corr = aoLongoX ? caixa(comp, 0.1, 0.2, M.amurada) : caixa(0.2, 0.1, comp, M.amurada)
  corr.position.set((x0 + x1) / 2, alt, (z0 + z1) / 2)
  const baixo = aoLongoX ? caixa(comp, 0.08, 0.16, M.amurada) : caixa(0.16, 0.08, comp, M.amurada)
  baixo.position.set((x0 + x1) / 2, 0.12, (z0 + z1) / 2)
  g.add(corr, baixo)
  const nb = Math.round(comp / 0.32)
  for (let i = 1; i < nb; i++) {
    const t = i / nb
    const b = caixa(0.08, alt - 0.16, 0.08, M.poste, 32)
    b.position.set(x0 + (x1 - x0) * t, alt / 2 + 0.04, z0 + (z1 - z0) * t)
    g.add(b)
  }
  return g
}

function barril(M: Materiais, x: number, z: number, y = 0, deitado = false) {
  const perfil: THREE.Vector2[] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    perfil.push(new THREE.Vector2(0.27 + Math.sin(t * Math.PI) * 0.05, t * 0.7))
  }
  const corpo = new THREE.Mesh(new THREE.LatheGeometry(perfil, 12), M.barril)
  const tampa = new THREE.Mesh(new THREE.CircleGeometry(0.27, 12), M.tampa)
  tampa.rotation.x = -Math.PI / 2
  tampa.position.y = 0.7
  const g = new THREE.Group()
  g.add(corpo, tampa)
  for (const m of [corpo, tampa]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  g.position.set(x, y, z)
  if (deitado) {
    g.rotation.z = Math.PI / 2
    g.position.y = y + 0.3
  }
  return g
}

function caixote(M: Materiais, x: number, z: number, s = 0.6, y = 0, rot = 0) {
  const c = caixa(s, s, s, M.caixote, 32 * (s / 0.66))
  c.position.set(x, y + s / 2, z)
  c.rotation.y = rot
  return c
}

/** Canhão no reparo de madeira, apontando para `dir` (radianos em torno de Y). */
function canhao(M: Materiais, x: number, z: number, dir: number) {
  const g = new THREE.Group()
  const reparo = caixa(0.6, 0.3, 0.8, M.casco)
  reparo.position.y = 0.25
  g.add(reparo)
  for (const sx of [-0.33, 0.33])
    for (const sz of [-0.25, 0.25]) {
      const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), M.poste)
      roda.rotation.z = Math.PI / 2
      roda.position.set(sx, 0.16, sz)
      roda.castShadow = true
      g.add(roda)
    }
  const perfil = [
    [0.2, 0],
    [0.21, 0.05],
    [0.17, 0.12],
    [0.15, 0.5],
    [0.12, 0.95],
    [0.14, 1.0],
    [0.14, 1.08],
    [0.09, 1.08],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const cano = new THREE.Mesh(new THREE.LatheGeometry(perfil, 12), M.ferro)
  cano.castShadow = true
  cano.rotation.x = Math.PI / 2 - 0.1
  cano.position.set(0, 0.52, -0.25)
  g.add(cano)
  g.position.set(x, 0, z)
  g.rotation.y = dir
  return g
}

function lanterna(M: Materiais, x: number, z: number, alt: number, luzes: THREE.PointLight[]) {
  const g = poste(M, x, z, alt)
  const caixaL = caixa(0.2, 0.26, 0.2, M.ferro)
  caixaL.position.set(x, alt + 0.36, z)
  const vidro = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), M.lanterna)
  vidro.position.set(x, alt + 0.36, z)
  const topo = caixa(0.26, 0.06, 0.26, M.ferro)
  topo.position.set(x, alt + 0.52, z)
  g.add(caixaL, vidro, topo)
  const luz = new THREE.PointLight(0xffb040, 3.0, 4.5, 1.6)
  luz.position.set(x, alt + 0.4, z)
  g.add(luz)
  luzes.push(luz)
  return g
}

/** Rolo de corda no chão. */
function rolo(M: Materiais, x: number, z: number) {
  const g = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.26 - i * 0.07, 0.05, 6, 16), M.corda)
    t.rotation.x = -Math.PI / 2
    t.position.y = 0.05 + i * 0.07
    t.castShadow = true
    g.add(t)
  }
  g.position.set(x, 0, z)
  return g
}

/** Corda esticada entre dois pontos (enxárcia). */
function cabo(M: Materiais, a: THREE.Vector3, b: THREE.Vector3, r = 0.035) {
  const d = new THREE.Vector3().subVectors(b, a)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), M.corda)
  m.position.copy(a).addScaledVector(d, 0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  m.castShadow = true
  return m
}

/** Enxárcia: dois cabos com os degraus (enfrechates) entre eles. */
function enxarcia(M: Materiais, base0: THREE.Vector3, base1: THREE.Vector3, topo: THREE.Vector3) {
  const g = new THREE.Group()
  g.add(cabo(M, base0, topo), cabo(M, base1, topo))
  for (let i = 1; i < 9; i++) {
    const t = i / 10
    const a = base0.clone().lerp(topo, t)
    const b = base1.clone().lerp(topo, t)
    g.add(cabo(M, a, b, 0.022))
  }
  return g
}

function bandeira(M: Materiais, x: number, z: number, tex: THREE.Texture) {
  const g = new THREE.Group()
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.2, 8), M.mastro)
  haste.position.y = 2.1
  g.add(haste)
  const geo = new THREE.PlaneGeometry(2.0, 1.6, 10, 4)
  const pano = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }))
  pano.position.set(-1.0, 3.3, 0)
  pano.userData.ondula = geo
  g.add(pano)
  g.position.set(x, 0, z)
  return { g, pano }
}


export type Navios = {
  grupo: THREE.Group
  luzes: THREE.PointLight[]
  panos: THREE.Mesh[]
  /** retângulos dos cascos no plano XZ (para a espuma do mar) */
  cascos: THREE.Vector4[]
}

// ===================================================================== navio

/**
 * Navio de verdade em volta de cada metade do tabuleiro (5×20): casco curvo
 * (seções ao longo do comprimento, proa em ponta, popa com espelho), bordas
 * subindo nas pontas, castelo de proa e tombadilho elevados fora do
 * tabuleiro, portinholas com canhões, cintas, gurupés, dois mastros com
 * vergas, velas e cordame. O convés onde ficam as casas continua plano em y = 0.
 *
 * Coordenadas locais do navio: proa para +X, tabuleiro em x ∈ [-10, 10],
 * z ∈ [-2.5, 2.5]. O da Marinha é girado 180° (proa para o outro lado).
 */

type Estilo = {
  casco: THREE.Material
  espelho: THREE.Material
  faixa: THREE.Material
  faixa2: THREE.Material
  vela: THREE.Texture
  velasAbertas: boolean
  bandeira: THREE.Texture
}

const POPA = -13.6
const PROA = 17.2
const MEIA = 3.2 // meia boca no convés
const FIM_TAB = 10.6 // onde termina o convés principal (o tabuleiro vai até 10)
const ALT_PROA = 0.75 // piso do castelo de proa
const ALT_POPA = 1.35 // piso do tombadilho
const QUILHA = -2.8

const liso = (k: number) => {
  const t = Math.min(1, Math.max(0, k))
  return t * t * (3 - 2 * t)
}
/** meia boca no plano, ao longo do comprimento */
function boca(x: number) {
  if (x > 9) {
    const t = (x - 9) / (PROA - 9)
    return MEIA * Math.max(0, 1 - Math.pow(t, 2.1))
  }
  return MEIA * (0.8 + 0.2 * liso((x - POPA) / 4))
}
/** borda de cima do casco (sobe na proa e na popa) */
function borda(x: number) {
  return 0.55 + 0.85 * liso((x - FIM_TAB) / (PROA - FIM_TAB)) + 1.45 * liso((-FIM_TAB - x) / (-FIM_TAB - POPA))
}
/** fundo: a roda de proa sobe até a ponta */
function fundo(x: number) {
  return QUILHA + 2.2 * liso((x - 12) / (PROA - 12))
}
/** forma da seção: 1 na borda, 0 na quilha (barriga leve) */
function secao(s: number) {
  return Math.sqrt(Math.max(0, 1 - Math.pow(s, 2.5))) * (1 + 0.04 * Math.sin(Math.PI * s))
}

function cascoGeo() {
  const NX = 96
  const MS = 14
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const linha = MS * 2 + 1
  for (let i = 0; i <= NX; i++) {
    const x = POPA + ((PROA - POPA) * i) / NX
    const b = boca(x)
    const t = borda(x)
    const f = fundo(x)
    let v = 0
    let ant: [number, number] | null = null
    for (let j = 0; j < linha; j++) {
      const lado = j < MS ? -1 : 1
      const s = j <= MS ? j / MS : (2 * MS - j) / MS
      const y = t + (f - t) * s
      const z = lado * b * secao(s) * (j === MS ? 0 : 1)
      if (ant) v += Math.hypot(y - ant[0], z - ant[1])
      ant = [y, z]
      pos.push(x, y, z)
      uv.push((x * TEXELS) / 64, (v * TEXELS) / 64)
    }
  }
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < linha - 1; j++) {
      const a = i * linha + j
      const b = a + linha
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** espelho de popa: tampa a primeira seção */
function espelhoGeo() {
  const MS = 14
  const x = POPA
  const b = boca(x)
  const t = borda(x)
  const f = fundo(x)
  const pts: THREE.Vector2[] = []
  for (let j = 0; j <= MS; j++) pts.push(new THREE.Vector2(-b * secao(j / MS), t + (f - t) * (j / MS)))
  for (let j = MS - 1; j >= 0; j--) pts.push(new THREE.Vector2(b * secao(j / MS), t + (f - t) * (j / MS)))
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts))
  // (z, y) → mundo, voltado para -X
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const zz = p.getX(i)
    const yy = p.getY(i)
    p.setXYZ(i, x, yy, zz)
    uv.setXY(i, (zz * TEXELS) / 64, (yy * TEXELS) / 64)
  }
  geo.computeVertexNormals()
  return geo
}

/** faixa (cinta) colada no casco na altura y, nas duas bordas */
function faixaGeo(y: number, alt: number, xMin = POPA, xMax = PROA - 0.3) {
  const pos: number[] = []
  const idx: number[] = []
  const N = 90
  for (const lado of [-1, 1]) {
    const ini = pos.length / 3
    let n = 0
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N
      const t = borda(x)
      const f = fundo(x)
      const zDe = (yy: number) => {
        const s = Math.min(1, Math.max(0, (t - yy) / (t - f)))
        return lado * (boca(x) * secao(s) + 0.025)
      }
      if (y + alt / 2 > t) continue
      pos.push(x, y - alt / 2, zDe(y - alt / 2), x, y + alt / 2, zDe(y + alt / 2))
      n++
    }
    for (let i = 0; i < n - 1; i++) {
      const a = ini + i * 2
      if (lado > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/**
 * Casas do tabuleiro com as tábuas pintadas (public/sprites/piso/tabuas.png:
 * 4×4 casas de 128 px vistas de cima). Enquanto a imagem carrega fica a
 * madeira desenhada em código. Madeira: uma das tábuas comuns sorteada
 * (as manchadas/rachadas mais raras); grade: a grade de ferro; amarela (as
 * colunas das pontas): a tábua com o tom amarelo por cima.
 */
const PISO_COMUNS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 0, 1, 2, 3, 4, 5, 6, 7, 15]
const PISO_RAROS = [11, 10, 14]
const PISO_GRADE = 12
function pisoPintado(tex: THREE.CanvasTexture, tipos: TipoCasa[][], semente: number) {
  const img = new Image()
  img.onload = () => {
    const T = 128
    const linhas = tipos.length
    const colunas = tipos[0].length
    const c = document.createElement('canvas')
    c.width = colunas * T
    c.height = linhas * T
    const g = c.getContext('2d')!
    const r = rng(semente)
    for (let l = 0; l < linhas; l++) {
      for (let k = 0; k < colunas; k++) {
        const tipo = tipos[l][k]
        const i = tipo === 'grade' ? PISO_GRADE : r() < 0.08 ? PISO_RAROS[Math.floor(r() * PISO_RAROS.length)] : PISO_COMUNS[Math.floor(r() * PISO_COMUNS.length)]
        g.drawImage(img, (i % 4) * T, Math.floor(i / 4) * T, T, T, k * T, l * T, T, T)
        if (tipo === 'amarela') {
          g.fillStyle = 'rgba(226,206,110,0.45)'
          g.fillRect(k * T, l * T, T, T)
        }
      }
    }
    tex.image = c
    // pintura (não é pixel art): suaviza ao afastar
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
  }
  img.src = recurso(`${import.meta.env.BASE_URL}sprites/piso/tabuas.png`)
}

/** piso plano seguindo a planta do casco, de x0 a x1, na altura y */
function pisoGeo(x0: number, x1: number, y: number, recuo = 0.12) {
  const pts: THREE.Vector2[] = []
  const N = 30
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N
    pts.push(new THREE.Vector2(x, -Math.max(0.05, boca(x) - recuo)))
  }
  for (let i = N; i >= 0; i--) {
    const x = x0 + ((x1 - x0) * i) / N
    pts.push(new THREE.Vector2(x, Math.max(0.05, boca(x) - recuo)))
  }
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts))
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const xx = p.getX(i)
    const zz = p.getY(i)
    // z invertido: a face fica virada para cima
    p.setXYZ(i, xx, y, -zz)
    uv.setXY(i, (xx * TEXELS) / 64, (zz * TEXELS) / 64)
  }
  geo.computeVertexNormals()
  return geo
}

/** corrimão em cima da borda do casco, dos dois lados */
function corrimao(M: Materiais, g: THREE.Group) {
  const N = 60
  for (const lado of [-1, 1])
    for (let i = 0; i < N; i++) {
      const xa = POPA + 0.05 + ((PROA - 0.6 - POPA) * i) / N
      const xb = POPA + 0.05 + ((PROA - 0.6 - POPA) * (i + 1)) / N
      const a = new THREE.Vector3(xa, borda(xa) + 0.05, lado * (boca(xa) - 0.02))
      const b = new THREE.Vector3(xb, borda(xb) + 0.05, lado * (boca(xb) - 0.02))
      const d = b.clone().sub(a)
      const m = new THREE.Mesh(new THREE.BoxGeometry(d.length() + 0.02, 0.1, 0.2), M.amurada)
      m.position.copy(a).addScaledVector(d, 0.5)
      m.lookAt(b)
      m.rotateY(Math.PI / 2)
      m.castShadow = true
      g.add(m)
    }
}

/** portinholas com canhões saindo (bateria de cima) e fechadas (de baixo) */
function portinholas(M: Materiais, g: THREE.Group, est: Estilo) {
  const escuro = new THREE.MeshLambertMaterial({ color: 0x140c08 })
  for (const lado of [-1, 1]) {
    for (let x = -9; x <= 9; x += 2.25) {
      const y = 0.18
      const s = (borda(x) - y) / (borda(x) - fundo(x))
      const z = lado * (boca(x) * secao(s) + 0.03)
      const furo = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.04), escuro)
      furo.position.set(x, y, z)
      g.add(furo)
      const moldura = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.06), est.faixa)
      moldura.position.set(x, y + 0.19, z)
      g.add(moldura)
      const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 10), M.ferro)
      cano.rotation.x = Math.PI / 2
      cano.position.set(x, y, z + lado * 0.22)
      cano.castShadow = true
      g.add(cano)
      // fechada, na bateria de baixo
      const yb = -0.42
      const sb = (borda(x + 1.1) - yb) / (borda(x + 1.1) - fundo(x + 1.1))
      const tampa = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.05), est.faixa2)
      tampa.position.set(x + 1.1, yb, lado * (boca(x + 1.1) * secao(sb) + 0.03))
      g.add(tampa)
    }
  }
}

/** vela quadrada inflada entre duas vergas (no plano YZ, enfunada para +X) */
function velaQuadrada(tex: THREE.Texture, larg: number, alt: number) {
  const geo = new THREE.PlaneGeometry(larg, alt, 10, 8)
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (larg / 2)
    const v = p.getY(i) / (alt / 2)
    p.setZ(i, (1 - u * u) * (1 - v * v * 0.5) * alt * 0.16)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }))
  // plano XY → plano ZY, inflado para +X
  m.rotation.y = Math.PI / 2
  m.castShadow = true
  return m
}

/** vela triangular/latina no plano XY (de frente para a câmera) */
function velaPlana(tex: THREE.Texture, pts: [number, number][]) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))))
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getX(i) - x0) / (x1 - x0), (p.getY(i) - y0) / (y1 - y0))
    p.setZ(i, Math.sin(((p.getX(i) - x0) / (x1 - x0)) * Math.PI) * 0.25)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }))
  m.castShadow = true
  return m
}

/** mastro com cesto, vergas e velas (abertas ou recolhidas); devolve o topo */
function mastroNavio(M: Materiais, g: THREE.Group, x: number, base: number, alt: number, est: Estilo, giro: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, alt, 12), M.mastro)
  m.position.set(x, base + alt / 2, 0)
  m.castShadow = true
  g.add(m)
  for (const y of [0.4, 0.55, alt * 0.5]) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.31 - y * 0.012, 0.05, 6, 14), M.corda)
    a.rotation.x = Math.PI / 2
    a.position.set(x, base + y, 0)
    g.add(a)
  }
  // cesto da gávea
  const cesto = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.22, 14), M.casco)
  cesto.position.set(x, base + alt * 0.62, 0)
  cesto.castShadow = true
  g.add(cesto)
  // vergas e velas (giradas um pouco, como braceadas ao vento)
  const vergas = new THREE.Group()
  vergas.position.set(x, base, 0)
  vergas.rotation.y = giro
  const niveis: [number, number, number][] = [
    [alt * 0.55, 5.6, 2.5],
    [alt * 0.82, 4.4, 1.9],
    [alt * 0.98, 3.0, 1.3],
  ]
  for (const [y, larg, altVela] of niveis) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, larg, 8), M.mastro)
    v.rotation.x = Math.PI / 2
    v.position.y = y
    v.castShadow = true
    vergas.add(v)
    if (est.velasAbertas) {
      const vela = velaQuadrada(est.vela, larg * 0.94, altVela)
      vela.position.set(0.12, y - altVela / 2 - 0.05, 0)
      vergas.add(vela)
    } else {
      // vela recolhida: rolo de pano em cima da verga
      const rolo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, larg * 0.9, 8), new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }))
      rolo.rotation.x = Math.PI / 2
      rolo.position.set(0.1, y - 0.12, 0)
      vergas.add(rolo)
    }
  }
  g.add(vergas)
  return new THREE.Vector3(x, base + alt, 0)
}

function montarNavio(cima: boolean, M: Materiais, luzes: THREE.PointLight[], panos: THREE.Mesh[]) {
  const g = new THREE.Group()
  const est: Estilo = cima
    ? {
        casco: lambert(texturaMadeira(64, 64, 5, 64 / 6, 12), 0xffffff, { side: THREE.DoubleSide }),
        espelho: lambert(texturaMadeira(64, 64, 6, 64 / 6, 21)),
        faixa: lambert(null, 0x1e140e),
        faixa2: lambert(null, 0x6b1d1a),
        vela: texturaVela([168, 36, 40], [238, 226, 206], 31),
        velasAbertas: true,
        bandeira: texturaVela([30, 26, 26], [236, 232, 220], 51),
      }
    : {
        casco: lambert(texturaMadeira(64, 64, 3, 64 / 6, 13), 0xffffff, { side: THREE.DoubleSide }),
        espelho: lambert(texturaMadeira(64, 64, 3, 64 / 6, 22)),
        faixa: lambert(null, 0x2c4f9e),
        faixa2: lambert(null, 0xe8e4d8),
        vela: texturaVelaLisa([238, 234, 224], [44, 72, 160]),
        velasAbertas: true,
        bandeira: texturaBandeiraMarinha(),
      }
  const sombra = (m: THREE.Mesh) => {
    m.castShadow = true
    m.receiveShadow = true
    return m
  }

  // casco, espelho de popa, cintas
  g.add(sombra(new THREE.Mesh(cascoGeo(), est.casco)))
  g.add(sombra(new THREE.Mesh(espelhoGeo(), est.espelho)))
  g.add(new THREE.Mesh(faixaGeo(-0.12, 0.12), est.faixa))
  g.add(new THREE.Mesh(faixaGeo(-0.62, 0.1), est.faixa))
  g.add(new THREE.Mesh(faixaGeo(0.46, 0.08, POPA, 10.5), est.faixa2))
  corrimao(M, g)
  portinholas(M, g, est)

  // convés principal (em volta do tabuleiro) e os dois elevados
  const piso = new THREE.Mesh(pisoGeo(POPA + 0.1, PROA - 1.2, -0.003), M.convesMargem)
  piso.receiveShadow = true
  g.add(piso)
  const proa = sombra(new THREE.Mesh(pisoGeo(FIM_TAB, PROA - 1.6, ALT_PROA), M.convesMargem))
  const popa = sombra(new THREE.Mesh(pisoGeo(POPA + 0.1, -FIM_TAB, ALT_POPA), M.convesMargem))
  g.add(proa, popa)
  // paredes de frente para o tabuleiro
  const paredeProa = caixa(0.14, ALT_PROA, boca(FIM_TAB) * 2 - 0.2, est.espelho)
  paredeProa.position.set(FIM_TAB, ALT_PROA / 2, 0)
  const paredePopa = caixa(0.14, ALT_POPA, boca(-FIM_TAB) * 2 - 0.2, est.espelho)
  paredePopa.position.set(-FIM_TAB, ALT_POPA / 2, 0)
  g.add(paredeProa, paredePopa)
  // porta e janelas da câmara do capitão (parede do tombadilho)
  const brilho = new THREE.MeshBasicMaterial({ color: 0xffcf6a })
  const escuro = new THREE.MeshLambertMaterial({ color: 0x24160c })
  const porta = caixa(0.06, 0.95, 0.7, escuro)
  porta.position.set(-FIM_TAB + 0.09, 0.48, 0)
  g.add(porta)
  for (const z of [-1.6, -0.9, 0.9, 1.6]) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.36), brilho)
    j.position.set(-FIM_TAB + 0.09, 0.78, z)
    g.add(j)
  }
  // balaustradas na frente dos elevados
  g.add(amurada(M, FIM_TAB + 0.1, -boca(FIM_TAB) + 0.25, FIM_TAB + 0.1, boca(FIM_TAB) - 0.25, 0.55).translateY(ALT_PROA))
  g.add(amurada(M, -FIM_TAB - 0.1, -boca(-FIM_TAB) + 0.25, -FIM_TAB - 0.1, boca(-FIM_TAB) - 0.25, 0.6).translateY(ALT_POPA))
  // escadas encostadas nas paredes, nas laterais (fora do tabuleiro)
  for (const z of [-2.85, 2.85]) {
    for (let i = 0; i < 4; i++) {
      const d = caixa(0.22, 0.08, 0.5, M.amurada)
      d.position.set(FIM_TAB - 0.62 + i * 0.18, (ALT_PROA * (i + 1)) / 4 - 0.04, z)
      g.add(d)
    }
    for (let i = 0; i < 6; i++) {
      const d = caixa(0.2, 0.08, 0.5, M.amurada)
      d.position.set(-FIM_TAB + 0.62 - i * 0.12, (ALT_POPA * (i + 1)) / 6 - 0.04, z)
      g.add(d)
    }
  }

  // popa: janelas da galeria no espelho, lanternas grandes
  for (const z of [-1.7, -0.85, 0, 0.85, 1.7]) {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.5), brilho)
    j.position.set(POPA - 0.02, 1.0, z)
    g.add(j)
    const mold = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.6), est.faixa)
    mold.position.set(POPA - 0.005, 1.0, z)
    g.add(mold)
  }
  const galeria = caixa(0.3, 0.1, boca(POPA) * 2 + 0.2, M.amurada)
  galeria.position.set(POPA - 0.12, 0.62, 0)
  g.add(galeria)
  g.add(lanterna(M, POPA + 0.4, -boca(POPA) + 0.35, ALT_POPA + 0.9, luzes), lanterna(M, POPA + 0.4, boca(POPA) - 0.35, ALT_POPA + 0.9, luzes))
  g.add(lanterna(M, PROA - 2.6, 0, ALT_PROA + 0.7, luzes))

  // tombadilho: leme, baús; castelo de proa: cabrestante, barris, âncoras
  const timao = new THREE.Group()
  const roda = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 18), M.poste)
  timao.add(roda)
  for (let i = 0; i < 8; i++) {
    const r = caixa(0.05, 1.05, 0.05, M.poste, 32)
    r.rotation.z = (i * Math.PI) / 8
    timao.add(r)
  }
  const pe = caixa(0.18, 0.7, 0.18, M.poste, 32)
  pe.position.y = -0.55
  timao.add(pe)
  timao.rotation.y = Math.PI / 2
  timao.position.set(-11.6, ALT_POPA + 0.92, 0)
  g.add(timao)
  g.add(caixote(M, -12.8, -1.6, 0.55, ALT_POPA), caixote(M, -12.8, 1.5, 0.5, ALT_POPA, 0.3), barril(M, -12.1, 1.9, ALT_POPA))
  const cabrestante = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.6, 10), M.poste)
  cabrestante.position.set(12.0, ALT_PROA + 0.3, 0)
  cabrestante.castShadow = true
  g.add(cabrestante)
  for (let i = 0; i < 4; i++) {
    const barra = caixa(1.2, 0.06, 0.06, M.amurada)
    barra.rotation.y = (i * Math.PI) / 4
    barra.position.set(12.0, ALT_PROA + 0.55, 0)
    g.add(barra)
  }
  g.add(barril(M, 11.3, -1.8, ALT_PROA), barril(M, 11.3, 1.8, ALT_PROA), rolo(M, 13.2, -1.0))
  ;(g.children[g.children.length - 1] as THREE.Object3D).position.y = ALT_PROA
  // canhões de caça na proa e na popa
  for (const z of [-1.3, 1.3]) {
    const cp = canhao(M, 14.6, z * 0.7, -Math.PI / 2)
    cp.position.y = ALT_PROA
    const cr = canhao(M, -13.0, z, Math.PI / 2)
    cr.position.y = ALT_POPA
    g.add(cp, cr)
  }
  // no convés principal: só nas beiradas, fora das casas
  g.add(rolo(M, -10.25, -2.85), rolo(M, 10.25, 2.85))

  // âncoras penduradas na proa
  for (const lado of [-1, 1]) {
    const x = 14.2
    const ancora = new THREE.Group()
    const haste = caixa(0.1, 1.3, 0.1, M.ferro)
    ancora.add(haste)
    const braco = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 12, Math.PI), M.ferro)
    braco.rotation.z = Math.PI
    braco.position.y = -0.45
    ancora.add(braco)
    const cepo = caixa(0.7, 0.1, 0.12, M.poste, 32)
    cepo.position.y = 0.6
    ancora.add(cepo)
    ancora.position.set(x, 0.1, lado * (boca(x) + 0.12))
    ancora.rotation.x = lado * 0.15
    g.add(ancora)
  }

  // gurupés e figura de proa
  const gurupes = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 6.5, 10), M.mastro)
  const incl = THREE.MathUtils.degToRad(70)
  gurupes.rotation.z = -incl
  const pontaBase = new THREE.Vector3(PROA - 0.9, borda(PROA - 0.9) - 0.1, 0)
  const dirG = new THREE.Vector3(Math.sin(incl), Math.cos(incl), 0)
  gurupes.position.copy(pontaBase).addScaledVector(dirG, 3.0)
  gurupes.castShadow = true
  g.add(gurupes)
  const pontaG = pontaBase.clone().addScaledVector(dirG, 6.0)
  const figura = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 10), lambert(null, cima ? 0xc9a24a : 0xe8e4d8))
  figura.rotation.z = -Math.PI / 2 - 0.4
  figura.position.set(PROA - 0.2, borda(PROA) - 0.75, 0)
  g.add(figura)

  // mastros (no castelo de proa e no tombadilho, fora das casas)
  const topoProa = mastroNavio(M, g, 13.0, ALT_PROA, 10.5, est, cima ? 0.55 : 0.3)
  const topoPopa = mastroNavio(M, g, -12.6, ALT_POPA, 9.0, est, cima ? 0.5 : 0.3)
  // giba (do gurupés ao mastro) e vela latina (atrás do mastro de ré): de frente para a câmera
  const altGiba = ALT_PROA + 10.5 * 0.7
  g.add(cabo(M, pontaG, new THREE.Vector3(13.0, altGiba, 0), 0.03))
  if (est.velasAbertas) {
    const giba = velaPlana(est.vela, [
      [13.25, ALT_PROA + 1.4],
      [pontaG.x - 0.3, pontaG.y - 0.25],
      [13.25, altGiba - 0.2],
    ])
    g.add(giba)
    const latina = velaPlana(est.vela, [
      [-12.85, ALT_POPA + 1.0],
      [-16.6, ALT_POPA + 1.4],
      [-15.6, ALT_POPA + 5.4],
      [-12.85, ALT_POPA + 6.6],
    ])
    g.add(latina)
  }
  // retranca da latina
  const retranca = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8), M.mastro)
  retranca.rotation.z = Math.PI / 2 - 0.08
  retranca.position.set(-14.8, ALT_POPA + 1.15, 0)
  g.add(retranca)

  // cordame: enxárcias dos mastros até as bordas, estais entre mastros e o gurupés
  for (const [xm, topo, base] of [[13.0, topoProa, ALT_PROA], [-12.6, topoPopa, ALT_POPA]] as const) {
    void base
    for (const lado of [-1, 1]) {
      const alto = new THREE.Vector3(xm, topo.y * 0.62 + 0.1, lado * 0.35)
      const xa = xm - 1.1
      const xb = xm + 0.2
      g.add(enxarcia(M, new THREE.Vector3(xa, borda(xa) + 0.08, lado * (boca(xa) - 0.05)), new THREE.Vector3(xb, borda(xb) + 0.08, lado * (boca(xb) - 0.05)), alto))
      g.add(cabo(M, new THREE.Vector3(xm - 0.6, borda(xm - 0.6) + 0.1, lado * (boca(xm - 0.6) - 0.05)), topo.clone().setZ(lado * 0.1), 0.022))
    }
  }
  g.add(cabo(M, topoProa.clone().setY(topoProa.y - 0.3), pontaG, 0.03))

  // bandeiras no topo dos mastros
  for (const [xm, topo] of [[13.0, topoProa], [-12.6, topoPopa]] as const) {
    const b = bandeira(M, xm, 0, est.bandeira)
    b.g.position.set(xm + 1.0, topo.y - 2.4, 0)
    b.g.scale.setScalar(0.75)
    g.add(b.g)
    panos.push(b.pano)
  }
  return g
}

export function montarNavios(): Navios {
  const M = new Materiais()
  const grupo = new THREE.Group()
  const luzes: THREE.PointLight[] = []
  const panos: THREE.Mesh[] = []
  const cascos: THREE.Vector4[] = []
  for (const cima of [true, false]) {
    const zc = cima ? -VAO / 2 - METADE / 2 : VAO / 2 + METADE / 2
    const navio = montarNavio(cima, M, luzes, panos)
    navio.position.set(0, 0, zc)
    // piratas com a proa para a direita; a Marinha, para a esquerda
    if (!cima) navio.rotation.y = Math.PI
    grupo.add(navio)
    // tabuleiro (fixo no mundo, por cima do convés)
    const tipos = tiposMetade(cima)
    const tex = texturaTabuleiro(COLUNAS, METADE, tipos, TEXELS, cima ? 101 : 202)
    pisoPintado(tex, tipos, cima ? 101 : 202)
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(COLUNAS, METADE), new THREE.MeshLambertMaterial({ map: tex }))
    tab.rotation.x = -Math.PI / 2
    tab.position.set(0, 0.001, zc)
    tab.receiveShadow = true
    grupo.add(tab)
    // a espuma acompanha o casco (a ponta da proa é mais fina que a curva)
    const x0 = cima ? POPA : -PROA + 1.8
    const x1 = cima ? PROA - 1.8 : -POPA
    cascos.push(new THREE.Vector4(x0, zc - MEIA, x1, zc + MEIA))
  }
  // pranchas de abordagem sobre o vão
  const r = rng(5)
  for (const c of [3.5, 14.5]) {
    const p = caixa(0.8, 0.08, VAO + 0.2, M.amurada)
    p.position.set(c - COLUNAS / 2, 0.6 + r() * 0.01, 0)
    p.rotation.z = (r() - 0.5) * 0.05
    grupo.add(p)
  }
  return { grupo, luzes, panos, cascos }
}
