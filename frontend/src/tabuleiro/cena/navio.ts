import * as THREE from 'three'
import { COLUNAS, METADE, VAO, tiposMetade } from '../tabuleiro'
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

function mastro(M: Materiais, x: number, z: number, alt: number, vela: THREE.Texture | null) {
  const g = new THREE.Group()
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, alt, 12), M.mastro)
  m.position.y = alt / 2
  m.castShadow = true
  g.add(m)
  // amarras de corda e cintas de ferro
  for (const y of [0.9, 1.05, 1.2, 3.2, 3.35]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.06, 6, 14), M.corda)
    t.rotation.x = Math.PI / 2
    t.position.y = y
    g.add(t)
  }
  for (const y of [0.25, 2.2]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), M.ferro)
    b.position.y = y
    g.add(b)
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.3, 12), M.ferro)
  base.position.y = 0.15
  g.add(base)
  if (vela) {
    // pano um pouco inflado pelo vento
    const geo = new THREE.PlaneGeometry(4.2, 4.6, 12, 12)
    const p = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / 2.1
      const v = p.getY(i) / 2.3
      p.setZ(i, (1 - u * u) * 0.5 * (0.6 + 0.4 * (1 - v)))
    }
    geo.computeVertexNormals()
    const pano = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: vela, alphaTest: 0.5, side: THREE.DoubleSide }))
    pano.position.set(0, alt - 2.6, 0.45)
    pano.castShadow = true
    g.add(pano)
    const verga = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), M.mastro)
    verga.rotation.z = Math.PI / 2
    verga.position.set(0, alt - 0.25, 0.4)
    g.add(verga)
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

export function montarNavios(): Navios {
  const M = new Materiais()
  const grupo = new THREE.Group()
  const luzes: THREE.PointLight[] = []
  const panos: THREE.Mesh[] = []
  const cascos: THREE.Vector4[] = []
  const meiaLarg = COLUNAS / 2
  const lados = 1.5 // beirada além do tabuleiro nas pontas

  for (const cima of [true, false]) {
    const zTab0 = cima ? -VAO / 2 - METADE : VAO / 2
    const zTab1 = zTab0 + METADE
    const zLonge = cima ? zTab0 - 1.5 : zTab0 - 0.25
    const zPerto = cima ? zTab1 + 0.25 : zTab1 + 1.2
    const x0 = -meiaLarg - lados
    const x1 = meiaLarg + lados
    const larg = x1 - x0
    const prof = zPerto - zLonge
    const navio = new THREE.Group()

    // convés (beirada) e casco
    const conves = caixa(larg, 0.3, prof, M.convesMargem)
    conves.position.set(0, -0.15 - 0.002, (zLonge + zPerto) / 2)
    navio.add(conves)
    const casco = caixa(larg + 0.3, 1.8, prof + 0.3, [M.casco, M.casco, M.casco, M.casco, M.casco, M.casco])
    casco.position.set(0, -1.2, (zLonge + zPerto) / 2)
    navio.add(casco)
    // friso claro e faixa (azul no navio de baixo)
    const friso = caixa(larg + 0.36, 0.14, prof + 0.36, cima ? M.cascoClaro : M.azul)
    friso.position.set(0, -0.36, (zLonge + zPerto) / 2)
    navio.add(friso)
    cascos.push(new THREE.Vector4(x0 - 0.15, zLonge - 0.15, x1 + 0.15, zPerto + 0.15))

    // tabuleiro
    const tex = texturaTabuleiro(COLUNAS, METADE, tiposMetade(cima), TEXELS, cima ? 101 : 202)
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(COLUNAS, METADE), new THREE.MeshLambertMaterial({ map: tex }))
    tab.rotation.x = -Math.PI / 2
    tab.position.set(0, 0.001, (zTab0 + zTab1) / 2)
    tab.receiveShadow = true
    navio.add(tab)

    // amuradas: pontas sempre; o lado de fora de cada navio
    navio.add(amurada(M, x0 + 0.15, zLonge + 0.15, x0 + 0.15, zPerto - 0.15))
    navio.add(amurada(M, x1 - 0.15, zLonge + 0.15, x1 - 0.15, zPerto - 0.15))
    if (cima) navio.add(amurada(M, x0 + 0.15, zLonge + 0.15, x1 - 0.15, zLonge + 0.15, 0.85))
    else navio.add(amurada(M, x0 + 0.15, zPerto - 0.15, x1 - 0.15, zPerto - 0.15, 0.72))
    // borda baixa do lado do vão
    const zBorda = cima ? zPerto - 0.1 : zLonge + 0.1
    const borda = caixa(larg, 0.16, 0.2, cima ? M.amurada : M.azul)
    borda.position.set(0, 0.08, zBorda)
    navio.add(borda)
    for (let x = x0 + 0.8; x < x1; x += 2.2) {
      const cunho = caixa(0.2, 0.26, 0.24, M.poste, 32)
      cunho.position.set(x, 0.13, zBorda)
      navio.add(cunho)
    }

    if (cima) {
      // castelo de popa ao fundo, à esquerda, com escada e carga
      const plat = caixa(7, 1.5, 3, M.casco)
      plat.position.set(-7.6, 0.75 - 0.02, zLonge - 1.5)
      navio.add(plat)
      const piso = caixa(7, 0.1, 3, M.convesMargem)
      piso.position.set(-7.6, 1.5, zLonge - 1.5)
      navio.add(piso)
      for (let i = 0; i < 6; i++) {
        const d = caixa(1.6, 0.12, 0.3, M.amurada)
        d.position.set(-4.0, 0.25 * (i + 1) - 0.06, zLonge - 0.1 - i * 0.28)
        navio.add(d)
      }
      navio.add(amurada(M, -11.1, zLonge - 2.9, -4.2, zLonge - 2.9, 0.7).translateY(1.5))
      for (const [bx, bz] of [[-9.6, -2.3], [-9.0, -2.3], [-8.4, -2.4], [-9.3, -1.7], [-8.7, -1.7]])
        navio.add(barril(M, bx, zLonge + bz, 1.55))
      navio.add(caixote(M, -6.6, zLonge - 2.1, 0.66, 1.55, 0.1))
      navio.add(caixote(M, -5.9, zLonge - 2.2, 0.5, 1.55, -0.2))
      navio.add(caixote(M, -6.4, zLonge - 2.1, 0.46, 2.21, 0.3))
      // no convés: barris, caixotes e cordas encostados na amurada do fundo
      navio.add(barril(M, 1.8, zLonge + 0.55), barril(M, 2.4, zLonge + 0.5), barril(M, 2.1, zLonge + 0.95, 0, true))
      navio.add(caixote(M, -1.9, zLonge + 0.6, 0.66, 0, 0.15), caixote(M, 9.2, zLonge + 0.6, 0.6))
      navio.add(rolo(M, 4.0, zLonge + 0.6), rolo(M, -2.9, zLonge + 0.7))
      // mastro com a vela vermelha
      navio.add(mastro(M, 7.0, zLonge - 0.3, 6.5, texturaVela([168, 36, 40], [238, 226, 206], 31)))
      navio.add(mastro(M, -1.0, zLonge - 3.4, 7.2, texturaVela([160, 34, 38], [238, 226, 206], 32)))
      // canhões nas pontas
      navio.add(canhao(M, x0 + 0.75, zTab0 + 1.2, Math.PI / 2), canhao(M, x1 - 0.75, zTab0 + 1.2, -Math.PI / 2))
      navio.add(canhao(M, x1 - 0.75, zTab0 + 3.6, -Math.PI / 2))
      navio.add(lanterna(M, x0 + 0.15, zLonge + 0.15, 0.95, luzes), lanterna(M, x1 - 0.15, zLonge + 0.15, 0.95, luzes))
      // enxárcias subindo da amurada do fundo
      navio.add(enxarcia(M, new THREE.Vector3(-10.5, 0.85, zLonge + 0.15), new THREE.Vector3(-9.1, 0.85, zLonge + 0.15), new THREE.Vector3(-8.2, 8.5, zLonge - 3)))
      navio.add(enxarcia(M, new THREE.Vector3(10.2, 0.85, zLonge + 0.15), new THREE.Vector3(11.4, 0.85, zLonge + 0.15), new THREE.Vector3(9.5, 8.5, zLonge - 3)))
    } else {
      // amurada da frente com lanternas, canhão e escada descendo
      navio.add(lanterna(M, x0 + 0.15, zPerto - 0.15, 0.84, luzes), lanterna(M, 0.2, zPerto - 0.15, 0.84, luzes), lanterna(M, x1 - 0.15, zPerto - 0.15, 0.84, luzes))
      navio.add(canhao(M, 6.5, zPerto - 0.6, Math.PI), canhao(M, x0 + 0.75, zTab0 + 2.5, Math.PI / 2), canhao(M, x1 - 0.75, zTab0 + 2.5, -Math.PI / 2))
      navio.add(barril(M, x1 - 0.75, zTab0 + 0.5), caixote(M, x1 - 0.8, zTab0 + 4.4, 0.55))
      navio.add(barril(M, x0 + 0.7, zTab0 + 4.4), rolo(M, x0 + 0.75, zTab0 + 1.1))
      navio.add(caixote(M, -3.0, zPerto - 0.6, 0.55), rolo(M, 2.5, zPerto - 0.6))
      const band = bandeira(M, x1 + 0.35, zPerto - 0.3, texturaVela([44, 72, 160], [236, 236, 240], 41))
      navio.add(band.g)
      panos.push(band.pano)
      // cabos grossos no primeiro plano, subindo para fora da tela
      navio.add(enxarcia(M, new THREE.Vector3(-11.2, 0.8, zPerto - 0.15), new THREE.Vector3(-9.8, 0.8, zPerto - 0.15), new THREE.Vector3(-13, 8, zPerto + 3)))
      navio.add(enxarcia(M, new THREE.Vector3(9.8, 0.8, zPerto - 0.15), new THREE.Vector3(11.2, 0.8, zPerto - 0.15), new THREE.Vector3(13, 8, zPerto + 3)))
    }
    grupo.add(navio)
  }

  // pranchas de abordagem sobre o vão
  const r = rng(5)
  for (const c of [3.5, 14.5]) {
    const p = caixa(0.8, 0.08, VAO + 0.12, M.amurada)
    p.position.set(c - COLUNAS / 2, 0.05 + r() * 0.01, 0)
    grupo.add(p)
  }
  return { grupo, luzes, panos, cascos }
}
