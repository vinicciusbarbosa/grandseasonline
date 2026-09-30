import * as THREE from 'three'
import { COR } from './paleta'
import { aleatorio, escolher, lugar, tom, type Pecas } from './pecas'
import type { Bloqueio, MapaIlha, ObjetoIlha } from './terreno'

/**
 * Os marcos de cada ilha do East Blue — o que faz a ilha ser reconhecível:
 * a base da Marinha de Shells Town com a estátua do Morgan, o navio-circo do
 * Buggy, a mansão da Kaya e o Going Merry, o Baratie, o Arlong Park, o
 * cadafalso de Loguetown...
 *
 * Referencial local: origem no chão, +X = direção `r` (a "frente").
 */

type Construtor = (p: Pecas, o: ObjetoIlha, mapa: MapaIlha, rng: () => number) => Bloqueio

const num = (v: unknown, padrao: number) => (typeof v === 'number' ? v : padrao)

// ---- peças compartilhadas ------------------------------------------------------------------

/** Contorno de casco visto de cima (proa em +X), extrudado para cima. */
function formaCasco(comp: number, larg: number, proa = 0.32) {
  const L = comp / 2
  const W = larg / 2
  const s = new THREE.Shape()
  s.moveTo(-L, -W * 0.82)
  s.quadraticCurveTo(-L * 0.1, -W * 1.06, L * (1 - proa * 2), -W)
  s.quadraticCurveTo(L * 0.92, -W * 0.7, L, 0)
  s.quadraticCurveTo(L * 0.92, W * 0.7, L * (1 - proa * 2), W)
  s.quadraticCurveTo(-L * 0.1, W * 1.06, -L, W * 0.82)
  s.lineTo(-L, -W * 0.82)
  return s
}

/** Casco com convés e amurada. A água (plano y = 0) corta a parte de baixo. */
export function casco(p: Pecas, comp: number, larg: number, alto: number, cor: number, corFaixa: number, convés = 0x9a6a3a) {
  const base = -alto * 0.45
  const g = new THREE.ExtrudeGeometry(formaCasco(comp, larg), { depth: alto, bevelEnabled: false, curveSegments: 10 })
  g.rotateX(-Math.PI / 2)
  p.add(g, cor, false, lugar(0, base, 0, 0))
  // faixa colorida no alto do costado
  const faixa = new THREE.ExtrudeGeometry(formaCasco(comp * 1.005, larg * 1.02), { depth: alto * 0.14, bevelEnabled: false, curveSegments: 10 })
  faixa.rotateX(-Math.PI / 2)
  p.add(faixa, corFaixa, false, lugar(0, base + alto * 0.8, 0, 0))
  const deck = new THREE.ShapeGeometry(formaCasco(comp * 0.94, larg * 0.9), 10)
  deck.rotateX(-Math.PI / 2)
  p.add(deck, convés, false, lugar(-comp * 0.01, base + alto - 0.6, 0, 0))
  return base + alto - 0.6
}

/** Mastro com vela quadrada virada para o lado (+Z) e bandeira opcional. */
function mastro(p: Pecas, x: number, y: number, altura: number, vela: number, larguraVela: number, bandeira?: { cor: number; simbolo: number }) {
  p.cilindro(1.1, 1.4, altura, COR.madeiraEscura, x, y, 0, 6)
  if (larguraVela > 0) {
    // Vergas braceadas (~40°): vela de pano redondo de frente para o vento — e
    // para a câmera, que de outro jeito a veria de perfil.
    p.em(x, y, 0, 0.7, () => {
      p.caixa(1, altura * 0.42, larguraVela, vela, 1.4, altura * 0.3, 0)
      p.caixa(0.8, altura * 0.24, larguraVela * 0.7, vela, 1.2, altura * 0.76, 0)
      p.caixa(1.2, 1, larguraVela + 4, COR.madeiraEscura, 0.4, altura * 0.72, 0)
      p.caixa(1.2, 1, larguraVela + 2, COR.madeiraEscura, 0.4, altura * 0.99, 0)
    })
  }
  if (bandeira) {
    p.caixa(0.4, 5.5, 9, bandeira.cor, x, y + altura + 0.2, 4.6)
    p.esfera(1.3, bandeira.simbolo, x + 0.35, y + altura + 3.2, 4.6, 1, 0)
  }
}

/** Bandeira num mastro fincado no chão (ou num telhado). */
function bandeiraEmPe(p: Pecas, x: number, y: number, z: number, altura: number, cor: number, simbolo: number, largura = 12) {
  p.cilindro(0.5, 0.6, altura, 0x5e3a20, x, y, z, 6)
  p.caixa(0.4, largura * 0.62, largura, cor, x, y + altura - largura * 0.62, z + largura / 2 + 0.4)
  p.esfera(largura * 0.14, simbolo, x + 0.4, y + altura - largura * 0.3, z + largura / 2 + 0.4, 1, 0)
}

/** Seção de cilindro (listras de lona, gomos de tenda). */
function gomos(p: Pecas, raio: number, altura: number, cores: number[], n: number, x: number, y: number, z: number, topo?: number) {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2
    const da = (Math.PI * 2) / n
    const cor = cores[k % cores.length]
    p.add(new THREE.CylinderGeometry(raio, raio, altura, 2, 1, true, a0, da), cor, false, lugar(x, y + altura / 2, z, 0))
    if (topo) p.add(new THREE.ConeGeometry(raio * 1.08, topo, 2, 1, true, a0, da), cor, false, lugar(x, y + altura + topo / 2, z, 0))
  }
}

function muroCircular(p: Pecas, mapa: MapaIlha, cx: number, cy: number, raio: number, altura: number, cor: number, abertura?: { angulo: number; largura: number }) {
  const n = Math.max(16, Math.round(raio / 6))
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2
    const a1 = ((k + 1) / n) * Math.PI * 2
    const meio = (a0 + a1) / 2
    if (abertura) {
      const d = Math.abs(Math.atan2(Math.sin(meio - abertura.angulo), Math.cos(meio - abertura.angulo)))
      if (d < abertura.largura / raio / 2) continue
    }
    const x0 = cx + Math.cos(a0) * raio
    const y0 = cy + Math.sin(a0) * raio
    const x1 = cx + Math.cos(a1) * raio
    const y1 = cy + Math.sin(a1) * raio
    const chao = Math.min(mapa.altura(x0, y0), mapa.altura(x1, y1)) - 3
    p.em((x0 + x1) / 2, chao, (y0 + y1) / 2, Math.atan2(y1 - y0, x1 - x0), () => {
      const comp = Math.hypot(x1 - x0, y1 - y0) + 0.6
      p.caixa(comp, altura + 3, 5, cor, 0, 0, 0)
      p.caixa(comp, 1, 6.2, tom(cor, -0.15), 0, altura + 2.4, 0)
      for (let x = -comp / 2 + 1.4; x < comp / 2; x += 3.2) p.caixa(1.5, 2, 5.6, cor, x, altura + 3.2, 0)
    })
  }
}

/** Gaivota da Marinha: um "V" azul largo com o corpo no meio (visto de frente). */
function gaivota(p: Pecas, x: number, y: number, z: number, escala: number, cor = COR.marinhaAzul) {
  p.em(x, y, z, 0, () => {
    for (const s of [-1, 1]) {
      p.add(new THREE.BoxGeometry(0.6, 1.4 * escala, 7 * escala), cor, false, lugar(0, 0, s * 3.2 * escala, 0).multiply(new THREE.Matrix4().makeRotationX(s * 0.45)))
    }
    p.esfera(1.3 * escala, cor, 0.3, -0.8 * escala, 0, 1, 0)
  })
}

// ---- Shells Town ------------------------------------------------------------------------------

/**
 * Base da Marinha 153: muralha redonda, pátio com o poste do Zoro, prédio
 * branco com faixa azul, a gaivota e o letreiro, torre de vigia e a estátua
 * gigante do Morgan (com o machado no lugar da mão) no terraço.
 */
const baseMarinha153: Construtor = (p, o, mapa) => {
  const cx = o.x
  const cy = o.y
  const r = num(o.r, 0)
  muroCircular(p, mapa, cx, cy, 124, 22, 0xf2f0ea, { angulo: r, largura: 30 })
  const chao = mapa.alturaMinima(cx, cy, 60) - 2
  const branco = 0xf8f8f4
  const azul = COR.marinhaAzul
  p.em(cx, chao, cy, r, () => {
    // portão (na frente, +X)
    for (const s of [-1, 1]) {
      p.cilindro(6, 6.5, 32, branco, 122, 0, s * 20, 12)
      p.cone(7.4, 10, azul, 122, 32, s * 20, 12)
    }
    p.caixa(6, 4, 34, azul, 122, 24, 0)
    // prédio principal (mais para o fundo, -X)
    p.caixa(46, 46, 96, branco, -40, 0, 0)
    p.caixa(46.6, 3.5, 96.6, azul, -40, 30, 0)
    p.caixa(46.8, 2.4, 96.8, 0xdfe6ef, -40, 46, 0)
    for (let y = 6; y < 44; y += 9)
      for (let z = -42; z <= 42; z += 7) {
        if (y > 28 && y < 36) continue
        p.caixa(0.6, 5, 3, 0x33496a, -16.8, y, z)
      }
    p.caixa(0.8, 12, 12, 0x4a3524, -16.6, 0, 0)
    // letreiro MARINE e a gaivota
    p.caixa(1, 7, 44, 0xffffff, -16.4, 36.5, 0)
    for (let k = 0; k < 6; k++) p.caixa(1.1, 4.5, 4.2, azul, -16.1, 37.8, -15 + k * 6)
    gaivota(p, -16, 18, 0, 2.2)
    // alas laterais baixas
    for (const s of [-1, 1]) {
      p.caixa(40, 26, 30, branco, -20, 0, s * 60)
      p.telhado(30, 40, 10, azul, 26, 1.2, true)
    }
    // torre de vigia com a bandeira
    p.cilindro(9, 10, 78, branco, -54, 0, -34, 16)
    p.caixa(22, 2, 22, 0xdfe6ef, -54, 78, -34)
    p.cone(12, 10, azul, -54, 80, -34, 4)
    bandeiraEmPe(p, -54, 90, -34, 22, 0xffffff, azul, 14)
    // estátua do Morgan no terraço: capa, cabeça quadrada, o machado erguido
    const ex = -36
    const ey = 48.4
    p.caixa(18, 4, 18, 0xd8d2c4, ex, ey, 18)
    p.cilindro(6.5, 9, 26, 0xe9e2d0, ex, ey + 4, 18, 10)
    p.caixa(12, 10, 16, 0xe9e2d0, ex, ey + 22, 18)
    p.caixa(8, 9, 8, 0xf1eadb, ex, ey + 32, 18)
    p.caixa(9, 2, 9, 0xd8cfbb, ex, ey + 40, 18)
    p.em(ex, ey + 30, 18 + 10, 0, () => {
      p.add(new THREE.BoxGeometry(3.2, 20, 3.2), 0xe9e2d0, false, lugar(0, 8, 0, 0).multiply(new THREE.Matrix4().makeRotationX(-0.5)))
      p.add(new THREE.BoxGeometry(1.4, 10, 12), 0xcfd4dc, false, lugar(0, 19, 7, 0).multiply(new THREE.Matrix4().makeRotationX(-0.5)))
    })
    // pátio: o poste com a trave onde o Zoro ficou amarrado
    p.cilindro(1.1, 1.3, 16, COR.madeiraEscura, 60, 0, 10, 6)
    p.caixa(1.6, 1.6, 18, COR.madeiraEscura, 60, 12, 10)
    p.caixa(3, 6, 3.4, 0x2d6b3a, 61.2, 7, 10)
    // mastro de bandeira no pátio
    bandeiraEmPe(p, 70, 0, -30, 30, 0xffffff, azul, 12)
  })
  return [{ x: cx, y: cy, r: 128 }]
}

const farol: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 8) - 1
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.cilindro(6, 8, 6, 0xd6d0c2, 0, 0, 0, 10)
    for (let k = 0; k < 6; k++) p.cilindro(5.6 - k * 0.3, 5.9 - k * 0.3, 6.5, k % 2 ? 0xc93a2e : 0xfaf6ee, 0, 6 + k * 6.5, 0, 14)
    p.cilindro(6.4, 6.4, 1, 0x3a3a40, 0, 45, 0, 14)
    p.cilindro(3.6, 3.6, 6, 0xffe9a0, 0, 46, 0, 12)
    p.cone(4.8, 5, 0xc93a2e, 0, 52, 0, 12)
  })
  return [{ x: o.x, y: o.y, r: 10 }]
}

// ---- Orange Town ----------------------------------------------------------------------------

/** Escombros da Bala Buggy: pedaços de parede de tijolo e entulho espalhado. */
const escombros: Construtor = (p, o, mapa) => {
  const r2 = aleatorio(num(o.v, 1) * 97 + 5)
  const chao = mapa.altura(o.x, o.y)
  const tijolo = [0xd98a54, 0xc97a46, 0xe7a870, 0x9a8a78, 0xb5623a]
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.esfera(8 + r2() * 4, 0x9a8878, 0, -2, 0, 0.35, 1)
    for (let k = 0; k < 14; k++) {
      const x = (r2() - 0.5) * 22
      const z = (r2() - 0.5) * 18
      p.em(x, 0.5, z, r2() * 6, () => p.add(new THREE.BoxGeometry(1.5 + r2() * 4, 1 + r2() * 2, 1 + r2() * 3), escolher(tijolo, r2), false, new THREE.Matrix4().makeRotationZ((r2() - 0.5) * 0.9)))
    }
    // restos de parede em pé, com o topo quebrado em degraus
    for (let k = 0; k < 2; k++) {
      const z = (k - 0.5) * 12
      for (let s = 0; s < 5; s++) p.caixa(3, 2 + r2() * 10 * (1 - s / 6), 1.4, escolher(tijolo, r2), -6 + s * 3, 0, z)
    }
  })
  return [{ x: o.x, y: o.y, r: 14 }]
}

/** O bar que o Buggy ocupou: sobrado alaranjado com a bandeira dele e a lona listrada no terraço. */
const barBuggy: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 18)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(28, 30, 36, 0xf0b27a, 0, -3, 0)
    p.caixa(28.6, 1.2, 36.6, 0xc9824a, 0, 27, 0)
    for (let y = 3; y < 26; y += 8.5)
      for (let z = -14; z <= 14; z += 7) p.caixa(0.6, 4, 3, 0x2f4058, 14.2, y, z)
    p.caixa(0.7, 7, 8, 0x5a3a22, 14.3, 0, 0)
    p.caixa(1, 4, 20, 0x3a2414, 14.6, 9.5, 0)
    p.caixa(1.1, 2.6, 17, 0xe8c070, 14.8, 10.2, 0)
    // terraço: parapeito, lona listrada vermelha e branca, o "trono"
    for (const s of [-1, 1]) p.caixa(28, 2.4, 1, 0xe0a068, 0, 28, s * 18)
    for (let k = 0; k < 6; k++) p.caixa(4.4, 0.6, 24, k % 2 ? 0xffffff : 0xd8342c, -10 + k * 4.4, 36, 0)
    for (const [x, z] of [[-12, -11], [12, -11], [-12, 11], [12, 11]]) p.cilindro(0.5, 0.5, 9, 0x6b4a2a, x, 27, z, 5)
    p.caixa(4, 5, 5, 0x7a2a26, 2, 28, 0)
    // a bandeira do Buggy: caveira de nariz vermelho
    p.cilindro(0.6, 0.7, 30, 0x5e3a20, -10, 27, -14, 6)
    p.caixa(0.5, 11, 18, 0x18181c, -10, 44, -4.6)
    p.esfera(2.8, 0xf4f0e6, -9.6, 50, -4.6, 1, 0)
    p.esfera(1.1, 0xe02a24, -8, 49.5, -4.6, 1, 0)
  })
  return [{ x: o.x, y: o.y, r: 24 }]
}

/** Loja de ração do seu Boodle... e o Chouchou de guarda na porta. */
const lojaRacao: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 12)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(18, 10, 20, 0xf6dcb6, 0, -2, 0)
    p.telhado(20, 18, 8, 0xb8442c, 8, 1.2)
    p.caixa(0.6, 5, 4, 0x6b4226, 9.2, 0, 3)
    p.caixa(0.6, 3.4, 5, 0x2f4058, 9.2, 3, -5)
    p.caixa(0.8, 3, 12, 0x3f7fbf, 9.6, 7, 0)
    // Chouchou: cachorrinho branco sentado
    p.esfera(1.8, 0xf6f4ee, 13, 1.6, 3, 1.1, 1)
    p.esfera(1.3, 0xf6f4ee, 14, 3.8, 3, 1, 1)
    p.esfera(0.5, 0x2a2a2a, 15.2, 3.8, 3, 1, 0)
    p.cilindro(1.2, 1, 0.6, 0x9a4a3a, 15.4, 0, 5.6, 8)
  })
  return [{ x: o.x, y: o.y, r: 16 }]
}

/** O Big Top: navio do Buggy com a tenda de circo listrada no convés. */
const navioBuggy: Construtor = (p, o) => {
  p.em(o.x, 0, o.y, num(o.r, 0), () => {
    const deck = casco(p, 150, 46, 24, 0x7a2a26, 0xf1d27a, 0x9a6a3a)
    gomos(p, 22, 16, [0xd8342c, 0xffffff], 12, -8, deck, 0, 18)
    p.esfera(2.2, 0xf1d27a, -8, deck + 35, 0, 1, 0)
    mastro(p, 42, deck, 58, 0xf4efe2, 30, { cor: 0x18181c, simbolo: 0xf4f0e6 })
    mastro(p, -52, deck, 44, 0xf4efe2, 22)
    // carranca de palhaço na proa
    p.esfera(4.5, 0xf4efe2, 76, deck - 2, 0, 1, 1)
    p.esfera(1.8, 0xe02a24, 80, deck - 2, 0, 1, 0)
  })
  return [{ x: o.x, y: o.y, r: 80 }]
}

// ---- Vila Syrup -------------------------------------------------------------------------------

/** Mansão da Kaya: casarão branco de telhado vermelho, pórtico, jardim cercado, portão e chafariz. */
const mansaoKaya: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 40) - 1
  const branco = 0xfbf8ef
  const telha = 0xa4432e
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(40, 28, 84, branco, -8, 0, 0)
    p.telhado(84, 40, 16, telha, 28, 1.6, true)
    for (const s of [-1, 1]) {
      p.caixa(30, 22, 22, branco, 10, 0, s * 38)
      p.telhado(22, 30, 11, telha, 22, 1.2, true)
      for (let y = 5; y < 20; y += 9) for (const dz of [-6, 0, 6]) p.caixa(0.6, 5, 2.6, 0x33496a, 25.3, y, s * 38 + dz)
    }
    for (let y = 5; y < 27; y += 9) for (let z = -24; z <= 24; z += 6) p.caixa(0.6, 5, 2.6, 0x33496a, 12.3, y, z)
    // pórtico com colunas e frontão
    for (let z = -9; z <= 9; z += 6) p.cilindro(1.2, 1.2, 18, 0xffffff, 18, 0, z, 8)
    p.caixa(9, 2, 24, 0xf1ece0, 16, 18, 0)
    p.em(16, 20, 0, 0, () => p.telhado(24, 9, 5, telha, 0, 0.6))
    p.caixa(0.6, 10, 6, 0x5a3a22, 12.4, 0, 0)
    // chafariz, sebes e cerca com portão
    p.cilindro(6, 6.5, 2, 0xe2dccd, 44, 0, 0, 14)
    p.cilindro(4.8, 4.8, 0.6, 0x5fb8e0, 44, 1.8, 0, 14)
    p.cilindro(1, 1.2, 6, 0xe2dccd, 44, 0, 0, 8)
    for (const s of [-1, 1]) p.caixa(26, 3, 4, 0x3f8a3a, 36, 0, s * 18)
    const raio = 72
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * Math.PI * 2
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.12) continue
      const x = Math.cos(a) * raio
      const z = Math.sin(a) * raio * 0.9
      const h = mapa.altura(o.x + x * Math.cos(num(o.r, 0)) - z * Math.sin(num(o.r, 0)), o.y + x * Math.sin(num(o.r, 0)) + z * Math.cos(num(o.r, 0))) - chao
      p.caixa(1.2, 7, 1.2, 0x2f2f33, x, h - 1, z)
      p.caixa(1, 0.6, 10.5, 0x2f2f33, x, h + 4.5, z, -a + Math.PI / 2)
    }
    for (const s of [-1, 1]) {
      p.caixa(4, 12, 4, 0xe2dccd, raio, mapa.altura(o.x, o.y + raio) - chao - 1, s * 7)
      p.esfera(2.2, 0xe2dccd, raio, mapa.altura(o.x, o.y + raio) - chao + 12, s * 7, 1, 0)
    }
  })
  return [{ x: o.x, y: o.y, r: 50 }]
}

const casaUsopp: Construtor = (p, o, mapa, rng) => {
  const chao = mapa.alturaMinima(o.x, o.y, 12)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(16, 9, 20, 0xf1e2c2, 0, -2, 0)
    p.telhado(20, 16, 8, 0x3f73b0, 9, 1.2)
    p.caixa(0.6, 5, 3, 0x6b4226, 8.2, 0, 0)
    p.caixa(0.6, 3, 3, 0x2f4058, 8.2, 3, 5)
    // estilingue gigante encostado na casa (o "Usopp Pirates")
    p.cilindro(0.5, 0.6, 9, COR.madeira, 11, 0, -8, 5)
    for (const s of [-1, 1]) p.add(new THREE.CylinderGeometry(0.4, 0.4, 5, 5), COR.madeira, true, lugar(11, 10.5, -8 + s * 1.6, 0).multiply(new THREE.Matrix4().makeRotationX(s * 0.4)))
    void rng
  })
  return [{ x: o.x, y: o.y, r: 14 }]
}

/** Going Merry: caravela de casco claro, carranca de carneiro, vela branca (ainda sem Jolly Roger). */
const goingMerry: Construtor = (p, o) => {
  p.em(o.x, 0, o.y, num(o.r, 0), () => {
    const deck = casco(p, 96, 32, 18, 0xf5edd8, 0x8a5a34, 0xa8763f)
    mastro(p, 4, deck, 62, 0xfffdf6, 34)
    // cabine de popa com telhado laranja
    p.caixa(22, 10, 24, 0xf5edd8, -34, deck, 0)
    p.telhado(24, 22, 6, 0xe0873a, deck + 10, 0.8)
    for (const z of [-6, 6]) p.caixa(0.5, 3, 3, 0x2f4058, -22.8, deck + 3.5, z)
    // carranca de carneiro com os chifres enrolados
    p.esfera(5.6, 0xfbf7ea, 50, deck + 2, 0, 1, 1)
    p.esfera(2.6, 0xfbf7ea, 55, deck + 1, 0, 1, 1)
    for (const s of [-1, 1]) p.add(new THREE.TorusGeometry(2.4, 1, 6, 12), 0xd9a441, true, lugar(50, deck + 4, s * 5.2, 0))
    // mastro da proa inclinado (gurupés)
    p.add(new THREE.CylinderGeometry(0.6, 0.8, 20, 6), COR.madeiraEscura, true, lugar(58, deck + 6, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(-1.2)))
  })
  return [{ x: o.x, y: o.y, r: 52 }]
}

// ---- Baratie ----------------------------------------------------------------------------------

/**
 * O Baratie: casco dourado em forma de peixe (cabeça com olhos e boca na
 * proa, cauda na popa, barbatanas dos lados), o restaurante de dois andares
 * no convés com o letreiro, dois mastros e a bandeira do chapéu de cozinheiro.
 */
const baratieNavio: Construtor = (p, o) => {
  p.em(o.x, 0, o.y, num(o.r, 0), () => {
    const deck = casco(p, 230, 92, 30, 0xc9772e, 0x7a3a1e, 0xb98a55)
    // cabeça de peixe na proa
    p.add(new THREE.IcosahedronGeometry(1, 3), 0xe6a940, true, lugar(112, deck - 6, 0, 0).multiply(new THREE.Matrix4().makeScale(34, 22, 40)))
    p.add(new THREE.IcosahedronGeometry(1, 2), 0xb8322a, true, lugar(140, deck - 12, 0, 0).multiply(new THREE.Matrix4().makeScale(8, 6, 22)))
    for (const s of [-1, 1]) {
      p.esfera(7.5, 0xffffff, 124, deck + 6, s * 26, 1, 1)
      p.esfera(3.8, 0x1c1c22, 127, deck + 7, s * 30.5, 1, 1)
      // barbatanas laterais (plataformas)
      p.add(new THREE.BoxGeometry(46, 2.4, 26), 0xd98a3a, false, lugar(-6, deck - 8, s * 54, 0).multiply(new THREE.Matrix4().makeRotationX(s * 0.25)))
    }
    // barbatana dorsal na cabeça
    p.add(new THREE.BoxGeometry(26, 14, 2), 0xd98a3a, false, lugar(104, deck + 18, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(-0.3)))
    // cauda em V na popa
    for (const s of [-1, 1]) p.add(new THREE.BoxGeometry(36, 3, 22), 0xd98a3a, false, lugar(-128, deck + 4, s * 14, 0).multiply(new THREE.Matrix4().makeRotationX(s * 0.5)).multiply(new THREE.Matrix4().makeRotationY(s * 0.35)))
    // o restaurante
    const parede = 0xfbf1dc
    const telha = 0x4f9a8a
    p.caixa(120, 26, 64, parede, -12, deck, 0)
    p.caixa(121, 2, 65, 0xc9772e, -12, deck + 12, 0)
    p.telhado(64, 120, 10, telha, deck + 26, 1.6, true)
    p.caixa(78, 20, 44, parede, -16, deck + 30, 0)
    p.telhado(44, 78, 11, telha, deck + 50, 1.4, true)
    for (let x = -66; x <= 42; x += 9) {
      p.caixa(4, 6, 0.6, 0x2f4058, x, deck + 4, 32.2)
      p.caixa(4, 5, 0.6, 0x2f4058, x, deck + 16, 32.2)
    }
    for (let x = -50; x <= 18; x += 9) p.caixa(4, 6, 0.6, 0x2f4058, x, deck + 36, 22.2)
    p.caixa(12, 10, 0.8, 0x5a3a22, 10, deck, 32.4)
    // letreiro BARATIE na frente (lado da câmera)
    p.caixa(56, 11, 1.2, 0x3a2414, -14, deck + 52, 18)
    p.caixa(52, 8, 1.4, 0xf2c94a, -14, deck + 53.5, 18.3)
    for (let k = 0; k < 7; k++) p.caixa(4.5, 5, 1.5, 0x8a2a20, -32 + k * 6, deck + 55, 18.6)
    // mastros e a bandeira (caveira com chapéu de cozinheiro)
    mastro(p, 58, deck, 70, 0xfbf7ea, 36)
    mastro(p, -84, deck, 58, 0xfbf7ea, 30)
    p.cilindro(0.6, 0.6, 24, COR.madeiraEscura, -16, deck + 61, 0, 6)
    p.caixa(0.5, 9, 15, 0x18181c, -16, deck + 75, 7.8)
    p.esfera(2.4, 0xf4f0e6, -15.6, deck + 79, 7.8, 1, 0)
    p.cilindro(2, 2.2, 3.5, 0xffffff, -15.6, deck + 81.2, 7.8, 8)
    // lanternas vermelhas na amurada
    for (let x = -90; x <= 80; x += 22) for (const s of [-1, 1]) p.esfera(1.8, 0xe24a3a, x, deck + 3, s * 44, 1, 0)
  })
  return [{ x: o.x, y: o.y, r: 150 }]
}

// ---- Cocoyashi --------------------------------------------------------------------------------

/**
 * Arlong Park: a torre em andares com telhados de pagode, a muralha em volta,
 * a piscina de água do mar ligada ao oceano, o portão com o letreiro e a
 * bandeira do tubarão.
 */
const arlongPark: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 50) - 1
  const coral = 0xd9674e
  const creme = 0xf6e7cf
  const telha = 0x2f6f73
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    // muralha em U aberta para o mar (+X)
    const muro = 0xe9c9a4
    const lados: [number, number, number, number][] = [
      [-88, -82, 60, -82],
      [-88, 82, 60, 82],
      [-88, -82, -88, -16],
      [-88, 16, -88, 82],
    ]
    for (const [x0, z0, x1, z1] of lados) {
      p.muro(x0, z0, x1, z1, 22, 6, muro, -2)
      const comp = Math.hypot(x1 - x0, z1 - z0)
      const ang = Math.atan2(z1 - z0, x1 - x0)
      for (let t = 2; t < comp; t += 4) p.caixa(2, 2.4, 6.6, muro, x0 + Math.cos(ang) * t, 20, z0 + Math.sin(ang) * t)
    }
    for (const [x, z] of [[-88, -82], [-88, 82], [60, -82], [60, 82]]) {
      p.cilindro(8, 9, 32, coral, x, -2, z, 8)
      p.telhado(20, 20, 9, telha, 30, 2, true)
    }
    // portão com o letreiro ARLONG PARK (lado da vila, −X)
    for (const s of [-1, 1]) p.caixa(10, 30, 8, coral, -90, -2, s * 18)
    p.caixa(12, 8, 44, creme, -92, 22, 0)
    p.caixa(1, 5, 36, 0x1d3a5a, -98.2, 23.4, 0)
    // piscina ligada ao mar
    p.caixa(90, 1.2, 70, 0x2f9ad0, 20, 0.2, 0)
    p.caixa(92, 2.4, 3, 0xe2d6c0, 20, 0, -36)
    p.caixa(92, 2.4, 3, 0xe2d6c0, 20, 0, 36)
    // a torre em andares com telhados de pagode
    const andares: [number, number, number][] = [
      [62, 34, 58],
      [50, 30, 46],
      [40, 26, 36],
      [30, 22, 26],
    ]
    let y = 0
    for (const [dx, h, dz] of andares) {
      p.caixa(dx, h, dz, coral, -46, y, 0)
      p.caixa(dx + 0.6, 2, dz + 0.6, creme, -46, y + h - 6, 0)
      for (let zz = -dz / 2 + 5; zz <= dz / 2 - 5; zz += 7) p.caixa(0.6, 5, 3, 0x2a2e3a, -46 + dx / 2 + 0.2, y + 8, zz)
      p.em(-46, 0, 0, 0, () => p.telhado(dz + 10, dx + 10, 9, telha, y + h, 3, true))
      y += h + 5
    }
    p.cone(4, 12, telha, -46, y - 2, 0, 8)
    // bandeira: tubarão serra (branco no preto)
    p.cilindro(0.7, 0.8, 30, 0x4a3a2a, -46, y + 6, 0, 6)
    p.caixa(0.5, 12, 20, 0x18181c, -46, y + 22, 10.4)
    p.caixa(0.6, 3, 12, 0xf4f0e6, -45.6, y + 27, 10.4)
    p.esfera(2.4, 0xf4f0e6, -45.6, y + 27, 4, 1, 0)
  })
  return [{ x: o.x, y: o.y, r: 110 }]
}

const casaBellemere: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 12)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(16, 10, 22, 0xfff0d6, 0, -2, 0)
    p.telhado(22, 16, 9, 0xe07a36, 10, 1.4)
    p.caixa(0.6, 5.5, 3, 0x6b4226, 8.2, 0, 2)
    for (const z of [-6, 7]) p.caixa(0.6, 3.2, 3, 0x2f4058, 8.2, 3.5, z)
    p.caixa(2, 8, 2, 0xe6d6ba, -3, 10, 7)
  })
  return [{ x: o.x, y: o.y, r: 14 }]
}

/** Tangerineira do pomar da Bellemere. */
const tangerineira: Construtor = (p, o, mapa) => {
  const r2 = aleatorio(num(o.v, 1) * 41 + 9)
  const chao = mapa.altura(o.x, o.y)
  const s = 1.45 + r2() * 0.4
  p.em(o.x, chao, o.y, r2() * 6, () => {
    p.cilindro(0.5 * s, 0.7 * s, 3 * s, 0x7a5232, 0, 0, 0, 6)
    p.esfera(3.8 * s, 0x3f8f3a, 0, 5.4 * s, 0, 0.85, 1)
    p.esfera(2.6 * s, 0x4ea43e, 0.8, 7 * s, -0.6, 0.85, 1)
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4 + r2()
      const y = (3.8 + (k % 3) * 1.3) * s
      p.esfera(0.75 * s, 0xf28a1e, Math.cos(a) * 3.4 * s, y, Math.sin(a) * 3.4 * s, 1, 0)
    }
  })
  return [{ x: o.x, y: o.y, r: 5 }]
}

// ---- Loguetown --------------------------------------------------------------------------------

/**
 * O cadafalso da praça de Loguetown, onde Gold Roger foi executado: base de
 * pedra, a torre de madeira escura, a plataforma com a trave e a escadaria.
 */
const cadafalso: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 30) - 1
  const madeira = 0x5a3b24
  const escala = new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)
  p.em(o.x, chao, o.y, num(o.r, 0), () => p.com(escala, () => {
    // a praça: piso circular claro com borda
    p.cilindro(70, 70, 1.2, 0xd9d0bd, 0, -0.6, 0, 40)
    p.cilindro(72, 72, 0.8, 0xb8ae9c, 0, -0.8, 0, 40)
    p.caixa(34, 5, 34, 0xa89e8c, 0, 0, 0)
    for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) p.caixa(3.2, 44, 3.2, madeira, x, 5, z)
    for (let y = 14; y < 44; y += 10) {
      for (const s of [-1, 1]) {
        p.caixa(27, 1.4, 1.4, madeira, 0, y, s * 12)
        p.caixa(1.4, 1.4, 27, madeira, s * 12, y, 0)
      }
    }
    p.caixa(32, 2, 32, 0x7a5232, 0, 44, 0)
    for (const s of [-1, 1]) {
      p.caixa(32, 3, 0.8, madeira, 0, 46, s * 15.6)
      p.caixa(0.8, 3, 32, madeira, s * 15.6, 46, 0)
    }
    // a trave no alto
    for (const s of [-1, 1]) p.caixa(2.4, 22, 2.4, madeira, -6, 46, s * 9)
    p.caixa(3, 2.6, 22, madeira, -6, 68, 0)
    // escadaria descendo para a frente (+X)
    for (let k = 0; k < 16; k++) p.caixa(3, 2.8, 10, 0x7a5232, 16 + k * 3, 44 - k * 2.8 - 2.8, 0)
    for (const s of [-1, 1]) p.add(new THREE.BoxGeometry(56, 1.4, 1.4), madeira, false, lugar(40, 25, s * 5.4, 0).multiply(new THREE.Matrix4().makeRotationZ(-0.72)))
    // bandeiras da Marinha nos cantos da praça
    for (const [x, z] of [[-40, -40], [-40, 40]]) bandeiraEmPe(p, x, 0, z, 26, 0xffffff, COR.marinhaAzul, 10)
  }))
  return [{ x: o.x, y: o.y, r: 76 }]
}

/** Base da Marinha de Loguetown (a do Smoker), junto ao porto. */
const baseMarinhaLogue: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 40) - 1
  const branco = 0xf8f8f4
  const azul = COR.marinhaAzul
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(40, 36, 76, branco, 0, 0, 0)
    p.telhado(76, 40, 12, azul, 36, 1.4, true)
    p.caixa(40.6, 2.4, 76.6, azul, 0, 24, 0)
    for (let y = 5; y < 34; y += 9) for (let z = -32; z <= 32; z += 7) p.caixa(0.6, 5, 3, 0x33496a, 20.3, y, z)
    p.caixa(0.8, 10, 10, 0x4a3524, 20.4, 0, 0)
    p.caixa(1, 6, 30, 0xffffff, 20.6, 27.5, 0)
    gaivota(p, 21, 32, 0, 1.6)
    p.caixa(18, 56, 18, branco, -8, 0, -30)
    p.cone(14, 14, azul, -8, 56, -30, 4)
    bandeiraEmPe(p, -8, 70, -30, 20, 0xffffff, azul, 12)
    // muro baixo e portão
    for (const s of [-1, 1]) p.caixa(4, 10, 40, 0xe8e6e0, 36, 0, s * 26)
  })
  return [{ x: o.x, y: o.y, r: 50 }]
}

/** Ponte de pedra em arco sobre o rio. */
const ponte: Construtor = (p, o, mapa) => {
  const comp = num(o.comprimento, 36)
  const chao = Math.max(mapa.altura(o.x - comp / 2, o.y), mapa.altura(o.x + comp / 2, o.y))
  p.em(o.x, 0, o.y, num(o.r, 0), () => {
    const n = 7
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n
      const x = -comp / 2 + t * comp
      const y = chao + Math.sin(t * Math.PI) * 4
      p.caixa(comp / n + 0.4, 2, 12, 0xd6cdb8, x, y - 2, 0)
      for (const s of [-1, 1]) p.caixa(comp / n + 0.4, 2.2, 1, 0xc4baa4, x, y, s * 5.6)
    }
    p.caixa(4, chao + 6, 12, 0xc4baa4, 0, -6, 0)
  })
  return [{ x: o.x, y: o.y, r: comp / 2 + 4 }]
}

export const MARCOS: Record<string, Construtor> = {
  'base-marinha-153': baseMarinha153,
  farol,
  escombros,
  'bar-buggy': barBuggy,
  'loja-racao': lojaRacao,
  'navio-buggy': navioBuggy,
  'mansao-kaya': mansaoKaya,
  'casa-usopp': casaUsopp,
  'going-merry': goingMerry,
  baratie: baratieNavio,
  'arlong-park': arlongPark,
  'casa-bellemere': casaBellemere,
  tangerineira,
  cadafalso,
  'base-marinha-logue': baseMarinhaLogue,
  ponte,
}
