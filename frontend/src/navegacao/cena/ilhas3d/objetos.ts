import * as THREE from 'three'
import { MARCOS } from './marcos'
import { COR, ESTILOS } from './paleta'
import { aleatorio, escolher, lugar, tom, type Pecas } from './pecas'
import type { Bloqueio, MapaIlha, ObjetoIlha } from './terreno'

/**
 * Construtores dos objetos das ilhas. Cada um recebe o objeto (posição e
 * parâmetros vindos de scripts/ilhas), monta as peças no lugar e devolve a
 * área que ocupa (para não nascer árvore em cima).
 *
 * Referencial local de cada objeto: origem no chão, +X = direção `r`.
 */

type Construtor = (p: Pecas, o: ObjetoIlha, mapa: MapaIlha, rng: () => number) => Bloqueio

const num = (v: unknown, padrao: number) => (typeof v === 'number' ? v : padrao)
const pts = (v: unknown) => (Array.isArray(v) ? (v as [number, number][]) : [])

// ---- genéricos -----------------------------------------------------------------------------

/** Janelas numa face (±X), por andar, com peitoril claro. */
function janelas(p: Pecas, d: number, w: number, h: number, lado: 1 | -1, cor = COR.janela, portaNoMeio = false) {
  const andares = Math.max(1, Math.round(h / 8.5))
  const n = Math.max(1, Math.floor(w / 6.5))
  const x = (d / 2 + 0.15) * lado
  for (let f = 0; f < andares; f++) {
    for (let k = 0; k < n; k++) {
      const z = -w / 2 + (k + 0.5) * (w / n)
      if (portaNoMeio && f === 0 && k === Math.floor(n / 2)) {
        p.caixa(0.5, 5.2, 2.6, COR.porta, x, 0, z)
        continue
      }
      const y = f * 8.5 + 3.2
      p.caixa(0.45, 3.2, 2.1, cor, x, y, z)
      p.caixa(0.6, 0.45, 2.7, 0xfaf6ea, x, y - 0.45, z)
    }
  }
}

/** Casa: paredes, janelas, porta, telhado de duas ou quatro águas, chaminé. */
export function casaSimples(p: Pecas, rng: () => number, w: number, d: number, h: number, parede: number, telha: number, opcoes: { torre?: boolean; enxaimel?: number } = {}) {
  p.caixa(d, h + 3, w, parede, 0, -3, 0)
  // rodapé mais escuro
  p.caixa(d + 0.4, 1.4, w + 0.4, tom(parede, -0.25), 0, -0.5, 0)
  if (opcoes.enxaimel !== undefined) {
    // vigas de madeira aparentes nos cantos e entre andares
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      p.caixa(1, h, 1, opcoes.enxaimel, (sx * d) / 2, 0, (sz * w) / 2)
    for (let y = 8.5; y < h - 1; y += 8.5) p.caixa(d + 0.5, 0.8, w + 0.5, opcoes.enxaimel, 0, y - 0.4, 0)
  }
  janelas(p, d, w, h, -1, COR.janela, true)
  janelas(p, d, w, h, 1)
  const alturaTelhado = d * (0.42 + rng() * 0.18)
  p.telhado(w, d, alturaTelhado, telha, h, 1.3, rng() < 0.3)
  if (rng() < 0.45) p.caixa(2, alturaTelhado * 0.8 + 2.5, 2, tom(parede, -0.3), d * 0.22, h, w * (rng() < 0.5 ? 0.28 : -0.28))
  if (opcoes.torre) {
    p.cilindro(4, 4, h + 8, parede, 0, 0, w / 2 + 2, 10)
    p.cone(5, 8, telha, 0, h + 8, w / 2 + 2, 10)
  }
}

const casa: Construtor = (p, o, mapa, rng) => {
  const est = ESTILOS[String(o.e)] ?? ESTILOS.foosha
  const r2 = aleatorio(num(o.v, 1) * 131 + 7)
  const w = num(o.w, 20)
  const d = num(o.d, 18)
  const h = num(o.h, 9)
  const chao = mapa.alturaMinima(o.x, o.y, Math.max(w, d) * 0.45)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    casaSimples(p, r2, w, d, h, escolher(est.paredes, r2), escolher(est.telhados, r2), {
      enxaimel: o.e === 'foosha' && r2() < 0.35 ? escolher(est.madeira ?? [COR.madeira], r2) : undefined,
    })
  })
  void rng
  return [{ x: o.x, y: o.y, r: Math.max(w, d) * 0.62 }]
}

const cerca: Construtor = (p, o, mapa) => {
  const chao = mapa.altura(o.x, o.y)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    for (let k = -2; k <= 2; k++) p.caixa(0.8, 4, 0.8, COR.madeira, 0, 0, k * 4)
    p.caixa(0.5, 0.6, 17, COR.madeiraClara, 0, 1.6, 0)
    p.caixa(0.5, 0.6, 17, COR.madeiraClara, 0, 3.2, 0)
  })
  return [{ x: o.x, y: o.y, r: 9 }]
}

const fardo: Construtor = (p, o, mapa) => {
  const chao = mapa.altura(o.x, o.y)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.add(new THREE.CylinderGeometry(2.2, 2.2, 3.6, 10), COR.palha, true, lugar(0, 2.1, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)))
  })
  return [{ x: o.x, y: o.y, r: 3 }]
}

/** Cais de madeira ao longo de uma linha, com estacas descendo na água. */
const cais: Construtor = (p, o, mapa) => {
  const linha = pts(o.pontos)
  const largura = num(o.largura, 10)
  const bloq: Bloqueio = []
  for (let k = 0; k < linha.length - 1; k++) {
    const [ax, ay] = linha[k]
    const [bx, by] = linha[k + 1]
    const comp = Math.hypot(bx - ax, by - ay)
    const r = Math.atan2(by - ay, bx - ax)
    const altura = Math.max(2.2, mapa.altura(ax, ay) + 0.6)
    p.em((ax + bx) / 2, 0, (ay + by) / 2, r, () => {
      const tabuas = Math.floor(comp / 2.4)
      for (let t = 0; t < tabuas; t++) {
        const x = -comp / 2 + (t + 0.5) * (comp / tabuas)
        p.caixa(2.1, 0.8, largura, t % 2 ? COR.madeiraClara : tom(COR.madeiraClara, -0.1), x, altura - 0.8, 0)
      }
      for (let x = -comp / 2 + 2; x <= comp / 2; x += 9) {
        for (const s of [-1, 1]) p.cilindro(0.8, 0.8, altura + 6, COR.madeiraEscura, x, -6, (s * largura) / 2, 6)
      }
    })
    bloq.push({ x: (ax + bx) / 2, y: (ay + by) / 2, r: comp / 2 + 4 })
  }
  return bloq
}

/** Barquinho de pesca: o casco é metade de um elipsoide — a água corta o resto. */
const barco: Construtor = (p, o) => {
  p.em(o.x, 0, o.y, num(o.r, 0), () => {
    p.add(new THREE.IcosahedronGeometry(1, 2), 0x9a6232, true, lugar(0, 0.8, 0, 0).multiply(new THREE.Matrix4().makeScale(9, 3.4, 3.6)))
    p.caixa(12, 0.5, 5.2, 0xc9955a, 0, 1.9, 0)
    p.cilindro(0.35, 0.35, 11, COR.madeiraEscura, 1.5, 1.9, 0, 5)
  })
  return [{ x: o.x, y: o.y, r: 10 }]
}

// ---- muralhas e portões -------------------------------------------------------------------

const muralha: Construtor = (p, o, mapa) => {
  const linha = pts(o.pontos)
  const altura = num(o.altura, 16)
  const esp = num(o.espessura, 6)
  const cor = o.cor === 'clara' ? 0xf1ece0 : 0xd4cab4
  const corTopo = tom(cor, -0.12)
  const cadaTorre = Math.max(1, Math.round((linha.length - 1) / num(o.torres, 8)))
  const bloq: Bloqueio = []
  for (let k = 0; k < linha.length - 1; k++) {
    const [ax, ay] = linha[k]
    const [bx, by] = linha[k + 1]
    const comp = Math.hypot(bx - ax, by - ay)
    const r = Math.atan2(by - ay, bx - ax)
    const chao = Math.min(mapa.altura(ax, ay), mapa.altura(bx, by)) - 3
    p.em((ax + bx) / 2, chao, (ay + by) / 2, r, () => {
      p.caixa(comp + 0.6, altura + 3, esp, cor, 0, 0, 0)
      p.caixa(comp + 0.6, 1.2, esp + 1.2, corTopo, 0, altura + 2.4, 0)
      // ameias dos dois lados
      for (let x = -comp / 2 + 1.5; x < comp / 2; x += 3.2) {
        for (const s of [-1, 1]) p.caixa(1.6, 2.2, 1.1, cor, x, altura + 3.6, (s * (esp + 0.2)) / 2)
      }
    })
    if (k % cadaTorre === 0) {
      const chaoT = mapa.altura(ax, ay) - 3
      p.em(ax, chaoT, ay, 0, () => {
        p.cilindro(esp * 0.95, esp * 1.05, altura * 1.45 + 3, cor, 0, 0, 0, 12)
        p.cilindro(esp * 1.1, esp * 1.1, 1.4, corTopo, 0, altura * 1.45 + 3, 0, 12)
        p.cone(esp * 1.15, esp * 1.6, 0xb4482f, 0, altura * 1.45 + 4.4, 0, 12)
        p.caixa(0.5, 2.8, 1.6, COR.janela, esp * 0.97, altura, 0)
      })
    }
    bloq.push({ x: (ax + bx) / 2, y: (ay + by) / 2, r: comp / 2 + esp })
  }
  return bloq
}

const portao: Construtor = (p, o, mapa) => {
  const l = num(o.largura, 24)
  const h = num(o.altura, 24)
  const chao = mapa.alturaMinima(o.x, o.y, l * 0.6) - 3
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    for (const s of [-1, 1]) {
      p.caixa(12, h + 6, 11, 0xd8cfba, 0, 0, s * (l / 2 + 5))
      p.cone(8.6, 10, 0xb4482f, 0, h + 6, s * (l / 2 + 5), 4)
    }
    p.caixa(10, 6, l, 0xd8cfba, 0, h - 3, 0)
    p.caixa(10.4, h - 6, l * 0.6, 0x3a2a1c, 0, 3, 0) // arco escuro
    p.caixa(1, h - 8, l * 0.55, COR.madeiraEscura, 5.3, 3, 0) // portão de madeira
  })
  return [{ x: o.x, y: o.y, r: l }]
}

// ---- Ilha Dawn --------------------------------------------------------------------------------

/**
 * Palácio de Goa: pedra branca no alto do morro, a fachada virada para o sul
 * (+X local), alas laterais, torre de menagem redonda com cúpula vermelha
 * (como na arte do Sugoi) e torrinhas pontudas.
 */
const palacioGoa: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 34) - 2
  const branco = 0xf8f5ee
  const sombra = 0xe4ddcf
  const telha = 0xc4482f
  const vidro = 0x39506e
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    // plataforma
    p.caixa(84, 3, 100, sombra, 0, 0, 0)
    // salão principal
    p.caixa(46, 34, 64, branco, -6, 3, 0)
    p.telhado(64, 46, 18, 0xa53c2a, 37, 1.5, true)
    for (let y = 9; y < 34; y += 9)
      for (let z = -27; z <= 27; z += 6) p.caixa(0.6, 5, 2.4, vidro, 17.2, y, z)
    // alas avançando para a frente
    for (const s of [-1, 1]) {
      p.caixa(40, 42, 20, branco, 12, 3, s * 36)
      p.telhado(20, 40, 14, telha, 45, 1.2, true)
      for (let y = 10; y < 42; y += 9) {
        p.caixa(0.6, 5, 2.4, vidro, 32.2, y, s * 36)
        for (const dz of [-5, 5]) p.caixa(0.6, 5, 2.2, vidro, 32.2, y, s * 36 + dz)
      }
      // torrinha na ponta de cada ala
      p.cilindro(6.5, 7, 54, branco, 30, 3, s * 44, 14)
      p.cilindro(7.6, 7.6, 1.6, sombra, 30, 57, s * 44, 14)
      p.cone(8, 20, telha, 30, 58.6, s * 44, 14)
    }
    // torre de menagem com cúpula
    p.cilindro(15, 16, 78, branco, -14, 3, 0, 24)
    p.cilindro(17, 17, 2.4, sombra, -14, 81, 0, 24)
    for (let a = 0; a < 18; a++) {
      const ang = (a / 18) * Math.PI * 2
      p.caixa(2.8, 3.4, 2.8, branco, -14 + Math.cos(ang) * 16, 83.4, Math.sin(ang) * 16)
    }
    p.add(new THREE.SphereGeometry(14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), telha, true, lugar(-14, 84, 0, 0).multiply(new THREE.Matrix4().makeScale(1, 1.3, 1)))
    p.cone(2.2, 8, 0xe8c24a, -14, 101, 0, 8)
    p.cilindro(0.5, 0.5, 14, 0x6b5a3a, -14, 106, 0, 5)
    p.caixa(0.3, 5, 9, 0x2f64a8, -14, 114, 4.5)
    for (let y = 16; y < 78; y += 11)
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + y * 0.1
        p.caixa(2, 4.4, 2, vidro, -14 + Math.cos(ang) * 15.3, y, Math.sin(ang) * 15.3)
      }
    // torrinhas de trás
    for (const z of [-26, 26]) {
      p.cilindro(5.5, 6, 46, branco, -26, 3, z, 12)
      p.cone(7, 16, telha, -26, 49, z, 12)
    }
    // entrada: pórtico, escadaria e sacada
    p.caixa(10, 22, 22, branco, 21, 3, 0)
    p.telhado(22, 10, 7, telha, 25, 1, false)
    p.caixa(0.6, 13, 9, 0x5a3a22, 26.2, 3, 0)
    p.caixa(0.8, 1, 24, sombra, 26.4, 16, 0)
    for (let k = 0; k < 6; k++) p.caixa(4, 3 + 1.1 * (5 - k), 26 - k * 0.8, sombra, 28 + k * 3.6, -2.4, 0)
    // estandartes azuis na fachada
    for (const z of [-17, 17]) p.caixa(0.4, 14, 5, 0x2f64a8, 17.4, 14, z)
  })
  return [{ x: o.x, y: o.y, r: 58 }]
}

/** Igreja com campanário: marca a silhueta da cidade. */
const igreja: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 14)
  const telha = num(o.v, 1) === 2 ? 0x3f6fa8 : 0x8f3e2e
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(30, 16, 16, 0xf1ebdc, 0, -2, 0)
    // telhado corre em Z por padrão; a nave corre em X, então gira 90°
    p.em(0, 0, 0, Math.PI / 2, () => p.telhado(30, 16, 11, telha, 14, 1.2, false))
    p.caixa(9, 32, 9, 0xf6f1e4, 14, -2, 0)
    p.cone(7.2, 18, telha, 14, 30, 0, 4)
    p.caixa(0.5, 5, 3, 0x39506e, 18.7, 18, 0)
    p.esfera(1.6, 0xe8c24a, 14, 22, 4.7, 1, 0)
    p.caixa(0.6, 7, 4, 0x5a3a22, 18.7, 0, 0)
    for (const z of [-8.3, 8.3]) for (let x = -10; x <= 6; x += 5.5) p.caixa(2, 6, 0.5, 0x39506e, x, 4, z)
  })
  return [{ x: o.x, y: o.y, r: 20 }]
}

/** Montes do Gray Terminal: lixo, tábuas, trapos e ferro velho. */
const lixo: Construtor = (p, o, mapa) => {
  const r2 = aleatorio(num(o.v, 1) * 17 + 3)
  const chao = mapa.altura(o.x, o.y)
  const tam = 6 + r2() * 6
  p.em(o.x, chao - 1, o.y, num(o.r, 0), () => {
    p.esfera(tam, escolher([0x6f604e, 0x7a6a55, 0x5d5244], r2), 0, 0, 0, 0.5, 1)
    p.esfera(tam * 0.6, escolher([0x8a7a62, 0x6a5b48], r2), tam * 0.4, tam * 0.25, tam * 0.3, 0.55, 1)
    const cores = [0x9a6a3a, 0x7c7f86, 0xb0472e, 0xd9cfb8, 0x4f6a7a, 0x8a5a34, 0x5a5a5a]
    for (let k = 0; k < 9; k++) {
      const a = r2() * Math.PI * 2
      const d = r2() * tam * 0.8
      p.em(Math.cos(a) * d, tam * 0.3 * (1 - d / tam) + 1, Math.sin(a) * d, r2() * 6, () => {
        p.add(new THREE.BoxGeometry(1 + r2() * 5, 0.6 + r2() * 1.4, 0.8 + r2() * 2), escolher(cores, r2), false, new THREE.Matrix4().makeRotationZ((r2() - 0.5) * 1.2))
      })
    }
  })
  return [{ x: o.x, y: o.y, r: tam + 2 }]
}

const barraco: Construtor = (p, o, mapa) => {
  const r2 = aleatorio(num(o.v, 1) * 29 + 1)
  const chao = mapa.altura(o.x, o.y)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.caixa(10, 7, 12, escolher([0x8a6a48, 0x7a5a3a, 0x9a7a52], r2), 0, 0, 0)
    for (let z = -5; z <= 5; z += 2.5) p.caixa(10.3, 7, 0.4, 0x5e4630, 0, 0, z)
    p.meiaAgua(12, 10, 9, 6.5, escolher([0x8a8f96, 0x9a6a4a, 0x6f7680], r2), 0, 1.2)
  })
  return [{ x: o.x, y: o.y, r: 9 }]
}

/** Casa da Dadan: casarão de toras no meio do Colubo, telhado de palha e alpendre. */
const casaDadan: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 22)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    // toras empilhadas
    for (let y = 0; y < 13; y += 2.1) {
      p.add(new THREE.CylinderGeometry(1.1, 1.1, 42, 6), y % 4.2 < 2 ? 0x8a5a34 : 0x7a4e2c, true, lugar(0, y + 1, -12, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)))
      p.add(new THREE.CylinderGeometry(1.1, 1.1, 42, 6), y % 4.2 < 2 ? 0x7a4e2c : 0x8a5a34, true, lugar(0, y + 1, 12, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)))
      p.add(new THREE.CylinderGeometry(1.1, 1.1, 24, 6), 0x845530, true, lugar(-20, y + 1, 0, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)))
      p.add(new THREE.CylinderGeometry(1.1, 1.1, 24, 6), 0x845530, true, lugar(20, y + 1, 0, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)))
    }
    p.caixa(39, 13, 23, 0x6f4526, 0, 0, 0)
    p.telhado(44, 30, 13, COR.palha, 13, 2.4)
    p.telhado(44.5, 30.5, 13, tom(COR.palha, -0.15), 12.4, 2.6)
    // porta, janelas, alpendre
    p.caixa(0.6, 7, 5, 0x3a2414, -12.6, 0, 0)
    for (const z of [-12, 12]) p.caixa(0.6, 3.4, 3.4, 0x2a3040, -12.6, 5, z)
    p.caixa(8, 0.8, 30, COR.madeiraClara, -16, 0.4, 0)
    for (const z of [-14, 14]) p.cilindro(0.7, 0.7, 9, COR.madeiraEscura, -19.5, 0, z, 6)
    p.em(-16, 0, 0, 0, () => p.meiaAgua(30, 8, 9.5, 7.5, tom(COR.palha, -0.1), 0, 0.5))
    // lenha empilhada e barris
    for (let k = 0; k < 6; k++) p.add(new THREE.CylinderGeometry(0.9, 0.9, 7, 6), 0x9a6a3a, true, lugar(14 + (k % 3) * 1.9, 0.9 + Math.floor(k / 3) * 1.7, 15, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)))
    for (const z of [-17, -13.5]) p.cilindro(2, 2, 4.5, 0x8a5a34, -18, 0, z, 10)
  })
  return [{ x: o.x, y: o.y, r: 40 }]
}

/** A casa na árvore do Luffy, Ace e Sabo: árvore enorme, plataforma e cabana lá no alto. */
const casaNaArvore: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 8)
  p.em(o.x, chao, o.y, num(o.r, 0), () => {
    p.cilindro(3.2, 5.5, 44, 0x6e4a2c, 0, -2, 0, 10)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4
      p.add(new THREE.CylinderGeometry(1, 1.6, 14, 6), 0x6e4a2c, true, lugar(Math.cos(a) * 4, 34, Math.sin(a) * 4, 0).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), 0.7)))
    }
    for (const [x, y, z, r] of [[0, 50, 0, 14], [-10, 46, 6, 10], [10, 47, -5, 10], [4, 58, 3, 9], [-6, 55, -7, 8], [8, 52, 9, 8]] as const) {
      p.esfera(r, r > 10 ? 0x3d8f36 : 0x4ea43e, x, y, z, 0.85, 1)
    }
    // plataforma e cabana (na frente da copa, virada para a câmera)
    p.add(new THREE.CylinderGeometry(10, 10, 1, 12), COR.madeiraClara, false, lugar(3, 31, 8, 0))
    p.caixa(10, 8, 11, 0x9a6a3a, 3, 32, 9)
    for (let y = 32; y < 40; y += 1.6) p.caixa(10.3, 0.35, 11.3, 0x7a4e2c, 3, y, 9)
    p.em(3, 0, 9, 0, () => p.meiaAgua(12, 12, 43, 39.5, 0x7a8a4a, 0, 0.5))
    p.caixa(0.5, 4, 3, 0x2a1a10, -2.2, 32, 9)
    // escada de corda
    for (let y = 2; y < 31; y += 2.5) p.caixa(0.5, 0.5, 4, COR.madeiraClara, -3.5, y, 8)
    p.caixa(0.4, 30, 0.4, 0x9a8a6a, -3.5, 1, 6)
    p.caixa(0.4, 30, 0.4, 0x9a8a6a, -3.5, 1, 10)
    // mastro com a bandeira do trio
    p.cilindro(0.35, 0.35, 16, 0x5e3a20, 7, 40, 13, 5)
    p.caixa(0.3, 4.5, 7, 0x1d1d22, 7, 51, 16.6)
    p.caixa(0.35, 1.2, 1.2, 0xf4f0e6, 7, 52.6, 16.2)
  })
  return [{ x: o.x, y: o.y, r: 22 }]
}

/**
 * Moinho de Foosha: torre branca afunilada, capuz marrom e quatro pás de
 * treliça viradas para o sul (para a câmera).
 */
const moinho: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 10) - 1
  const frente = Math.PI / 2 + num(o.r, 0)
  const escala = new THREE.Matrix4().makeScale(1.4, 1.4, 1.4)
  p.em(o.x, chao, o.y, frente, () => p.com(escala, () => {
    p.cilindro(5, 7.2, 26, 0xf6f0e2, 0, 0, 0, 8, false)
    p.cilindro(7.6, 7.6, 1.2, 0xc9bda2, 0, 8.5, 0, 8, false)
    p.caixa(0.5, 5.5, 3, COR.porta, 6.9, 0, 0)
    p.caixa(0.5, 2.6, 2, COR.janela, 6.4, 12, 0)
    p.caixa(0.5, 2.6, 2, COR.janela, 5.6, 19, 0)
    p.cone(6.6, 8, 0x8a4a2e, 0, 26, 0, 8)
    p.caixa(3, 3, 3, 0x6b3a22, 5, 26.5, 0)
    // pás
    const angulo0 = num(o.v, 0) * 0.37
    for (let k = 0; k < 4; k++) {
      const a = angulo0 + (k * Math.PI) / 2
      const m = lugar(7.2, 28, 0, 0).multiply(new THREE.Matrix4().makeRotationX(a))
      p.com(m, () => {
        p.caixa(0.7, 18, 0.9, 0x5e3a20, 0, 0, 0)
        p.caixa(0.35, 14, 4.8, 0xf1e8d2, 0.2, 4, 2.6)
        for (let y = 4; y <= 18; y += 3.5) p.caixa(0.5, 0.45, 5.2, 0x7a5232, 0.4, y, 2.6)
      })
    }
    p.cilindro(1.2, 1.2, 1.2, 0x3a2414, 7.6, 27.4, 0, 8)
  }))
  return [{ x: o.x, y: o.y, r: 18 }]
}

/** Partys Bar, o bar da Makino: sobrado de madeira com varanda, placa e barris. */
const partysBar: Construtor = (p, o, mapa) => {
  const chao = mapa.alturaMinima(o.x, o.y, 16)
  p.em(o.x, chao, o.y, num(o.r, 0) + Math.PI / 2, () => {
    p.caixa(24, 20, 34, 0xd9b27a, 0, -2, 0)
    for (let y = 1; y < 18; y += 2.2) p.caixa(24.3, 0.3, 34.3, 0xc49a62, 0, y, 0)
    for (const [x, z] of [[-12, -17], [12, -17], [-12, 17], [12, 17]]) p.caixa(1.4, 20, 1.4, COR.madeiraEscura, x, -2, z)
    p.caixa(24.6, 1, 34.6, COR.madeiraEscura, 0, 8, 0)
    p.telhado(38, 28, 12, 0x3f7a5e, 18, 0.6)
    // frente (+X → sul): portas duplas, janelas, placa
    p.caixa(0.6, 7, 6, 0x5e3a20, 12.2, 0, 0)
    p.caixa(0.7, 0.6, 7, 0xe8c070, 12.3, 7, 0)
    for (const z of [-11, 11]) {
      p.caixa(0.5, 4, 5, 0x2f4058, 12.2, 2.5, z)
      p.caixa(0.5, 4, 3, 0x2f4058, 12.2, 11, z)
    }
    p.caixa(0.8, 4, 14, 0x3a2414, 12.8, 13, 0)
    p.caixa(0.9, 3, 12, 0xf2d27a, 12.9, 13.5, 0)
    // varanda do andar de cima
    p.caixa(4, 0.8, 30, COR.madeiraClara, 14, 9, 0)
    for (let z = -14; z <= 14; z += 2.4) p.caixa(0.5, 3, 0.5, COR.madeiraEscura, 15.6, 9.8, z)
    p.caixa(0.5, 0.5, 30, COR.madeiraEscura, 15.6, 12.8, 0)
    // barris e mesa na frente
    for (const [x, z] of [[16, -13], [17.5, -10], [16, 13]]) p.cilindro(1.8, 1.8, 4, 0x8a5a34, x, 0, z, 10)
    p.cilindro(3, 3, 0.6, COR.madeiraClara, 18, 3, 6, 10)
    p.cilindro(0.6, 0.6, 3, COR.madeiraEscura, 18, 0, 6, 6)
    // lampião
    p.esfera(1, 0xffd27a, 13.5, 8.6, 4.5, 1, 0)
  })
  return [{ x: o.x, y: o.y, r: 26 }]
}

const prefeitura: Construtor = (p, o, mapa, rng) => {
  const chao = mapa.alturaMinima(o.x, o.y, 16)
  p.em(o.x, chao, o.y, num(o.r, 0) + Math.PI / 2, () => {
    casaSimples(p, rng, 28, 20, 17, 0xf6efdf, 0x9a4a32, { torre: true })
    p.cilindro(0.35, 0.35, 12, 0x5e3a20, 11, 17, -12, 5)
    p.caixa(0.3, 3.5, 6, 0x3f7fbf, 11, 25, -9)
  })
  return [{ x: o.x, y: o.y, r: 24 }]
}

export const CONSTRUTORES: Record<string, Construtor> = {
  casa,
  cerca,
  fardo,
  cais,
  barco,
  muralha,
  portao,
  'palacio-goa': palacioGoa,
  igreja,
  lixo,
  barraco,
  'casa-dadan': casaDadan,
  'casa-na-arvore': casaNaArvore,
  moinho,
  'partys-bar': partysBar,
  prefeitura,
  ...MARCOS,
}
