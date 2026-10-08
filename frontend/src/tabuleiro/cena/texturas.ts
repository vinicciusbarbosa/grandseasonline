import * as THREE from 'three'
import { desenharJollyRoger, type JollyRoger } from './jollyRoger'

/**
 * Texturas em pixel art desenhadas à mão (no canvas, pixel a pixel) para o
 * convés do teste de tabuleiro. Tudo com filtro "vizinho mais próximo", então
 * cada texel vira um bloquinho nítido na tela, como na arte de referência.
 */

export type Rng = () => number

export function rng(semente: number): Rng {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function tela(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return { c, g }
}

export function textura(c: HTMLCanvasElement, repetir = false) {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

const hex = (r: number, g: number, b: number) =>
  `rgb(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))})`

/** Tons de madeira do convés (claro → escuro), tirados da referência. */
export const MADEIRA = [
  [214, 150, 92],
  [196, 134, 82],
  [178, 118, 72],
  [158, 102, 64],
  [134, 86, 56],
  [108, 68, 46],
  [80, 50, 36],
  [52, 32, 26],
]

function tom(i: number, d = 0) {
  const k = Math.max(0, Math.min(MADEIRA.length - 1, i))
  const [r, g, b] = MADEIRA[k]
  return hex(r + d, g + d * 0.8, b + d * 0.6)
}

/** Pinta tábuas horizontais num retângulo (x, y, w, h), com veios e pregos. */
export function tabuas(g: CanvasRenderingContext2D, r: Rng, x: number, y: number, w: number, h: number, base: number, alturaTabua: number, vertical = false) {
  const n = Math.max(1, Math.round((vertical ? w : h) / alturaTabua))
  const passo = (vertical ? w : h) / n
  for (let i = 0; i < n; i++) {
    const v = base + (r() < 0.3 ? 1 : 0) - (r() < 0.2 ? 1 : 0)
    const a0 = Math.round(i * passo)
    const a1 = Math.round((i + 1) * passo)
    // corte da tábua em algum ponto do comprimento
    const comp = vertical ? h : w
    const corte = r() < 0.6 ? Math.round(comp * (0.25 + r() * 0.5)) : -1
    const segs = corte > 0 ? [[0, corte], [corte, comp]] : [[0, comp]]
    for (const [s0, s1] of segs) {
      const vv = v + (r() < 0.35 ? (r() < 0.5 ? 1 : -1) : 0)
      g.fillStyle = tom(vv)
      if (vertical) g.fillRect(x + a0, y + s0, a1 - a0, s1 - s0)
      else g.fillRect(x + s0, y + a0, s1 - s0, a1 - a0)
      // veios
      const veios = Math.round(((s1 - s0) * (a1 - a0)) / 26)
      for (let k = 0; k < veios; k++) {
        const len = 2 + Math.floor(r() * 7)
        const px = s0 + Math.floor(r() * Math.max(1, s1 - s0 - len))
        const py = a0 + 1 + Math.floor(r() * Math.max(1, a1 - a0 - 2))
        g.fillStyle = r() < 0.7 ? tom(vv + 1) : tom(vv - 1)
        if (vertical) g.fillRect(x + py, y + px, 1, len)
        else g.fillRect(x + px, y + py, len, 1)
      }
      // luz em cima, sombra embaixo de cada tábua
      g.fillStyle = tom(vv - 1)
      if (vertical) g.fillRect(x + a0, y + s0, 1, s1 - s0)
      else g.fillRect(x + s0, y + a0, s1 - s0, 1)
      g.fillStyle = tom(vv + 2)
      if (vertical) g.fillRect(x + a1 - 1, y + s0, 1, s1 - s0)
      else g.fillRect(x + s0, y + a1 - 1, s1 - s0, 1)
      // emenda e pregos
      g.fillStyle = tom(vv + 3)
      if (vertical) g.fillRect(x + a0, y + s1 - 1, a1 - a0, 1)
      else g.fillRect(x + s1 - 1, y + a0, 1, a1 - a0)
      g.fillStyle = tom(6)
      const meio = Math.round((a0 + a1) / 2) - 1
      for (const p of [s0 + 2, s1 - 4]) {
        if (s1 - s0 < 8) continue
        if (vertical) g.fillRect(x + meio, y + p, 1, 1)
        else g.fillRect(x + p, y + meio, 1, 1)
      }
    }
  }
}

export type TipoCasa = 'madeira' | 'amarela' | 'grade'

/** Textura do tabuleiro inteiro: `colunas`×`linhas` casas de `px` texels. */
export function texturaTabuleiro(colunas: number, linhas: number, tipos: TipoCasa[][], px: number, semente: number) {
  const { c, g } = tela(colunas * px, linhas * px)
  const r = rng(semente)
  for (let l = 0; l < linhas; l++) {
    for (let k = 0; k < colunas; k++) {
      const x = k * px
      const y = l * px
      const tipo = tipos[l][k]
      const base = [1, 1, 2, 2, 2, 3, 3, 4][Math.floor(r() * 8)]
      tabuas(g, r, x + 3, y + 3, px - 6, px - 6, base, px / 4.5)
      if (tipo === 'grade') grade(g, x + 6, y + 6, px - 12)
      if (tipo === 'amarela') {
        g.fillStyle = 'rgba(226,206,110,0.62)'
        g.fillRect(x + 3, y + 3, px - 6, px - 6)
        g.fillStyle = 'rgba(255,240,160,0.35)'
        g.fillRect(x + 3, y + 3, px - 6, 1)
        g.fillRect(x + 3, y + 3, 1, px - 6)
        // tufinhos de musgo, como na referência
        for (let i = 0; i < 3; i++) {
          g.fillStyle = 'rgba(120,140,60,0.7)'
          g.fillRect(x + 8 + Math.floor(r() * (px - 18)), y + 8 + Math.floor(r() * (px - 18)), 1, 2 + Math.floor(r() * 3))
        }
      }
      // rejunte: borda clara com sombra por dentro
      g.fillStyle = tom(0, 22)
      g.fillRect(x, y, px, 1)
      g.fillRect(x, y, 1, px)
      g.fillStyle = tom(1, 8)
      g.fillRect(x + 1, y + 1, px - 1, 1)
      g.fillRect(x + 1, y + 1, 1, px - 1)
      g.fillStyle = tom(6)
      g.fillRect(x + 2, y + 2, px - 3, 1)
      g.fillRect(x + 2, y + 2, 1, px - 3)
      g.fillStyle = tom(5)
      g.fillRect(x + px - 1, y, 1, px)
      g.fillRect(x, y + px - 1, px, 1)
      g.fillStyle = tom(3)
      g.fillRect(x + px - 2, y + 2, 1, px - 3)
      g.fillRect(x + 2, y + px - 2, px - 3, 1)
      // cantos com cravo de ferro
      g.fillStyle = 'rgb(70,62,58)'
      for (const [cx, cy] of [[x + 1, y + 1], [x + px - 3, y + 1], [x + 1, y + px - 3], [x + px - 3, y + px - 3]]) g.fillRect(cx, cy, 2, 2)
    }
  }
  return textura(c)
}

function grade(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = 'rgb(20,14,12)'
  g.fillRect(x, y, s, s)
  // porão escuro com um pouco de madeira lá embaixo
  g.fillStyle = 'rgb(58,36,24)'
  g.fillRect(x + 3, y + 3, s - 6, s - 6)
  const n = 5
  const passo = s / n
  for (let i = 0; i <= n; i++) {
    const p = Math.round(i * passo)
    for (const [cor, d] of [['rgb(96,90,88)', 0], ['rgb(150,142,136)', 0], ['rgb(52,48,48)', 2]] as const) {
      g.fillStyle = cor
      const off = cor === 'rgb(150,142,136)' ? 0 : d
      g.fillRect(x + Math.min(s - 3, p) + off, y, cor === 'rgb(150,142,136)' ? 1 : 2, s)
      g.fillRect(x, y + Math.min(s - 3, p) + off, s, cor === 'rgb(150,142,136)' ? 1 : 2)
    }
  }
  g.strokeStyle = 'rgb(40,34,34)'
  g.lineWidth = 1
  g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
}

/** Madeira genérica (tábuas) para casco, beirada, caixotes. */
export function texturaMadeira(w: number, h: number, base: number, alturaTabua: number, semente: number, vertical = false) {
  const { c, g } = tela(w, h)
  tabuas(g, rng(semente), 0, 0, w, h, base, alturaTabua, vertical)
  return textura(c, true)
}

export function texturaCaixote(semente: number) {
  const s = 32
  const { c, g } = tela(s, s)
  const r = rng(semente)
  tabuas(g, r, 0, 0, s, s, 2, 8)
  g.fillStyle = tom(5)
  g.fillRect(0, 0, s, 3)
  g.fillRect(0, s - 3, s, 3)
  g.fillRect(0, 0, 3, s)
  g.fillRect(s - 3, 0, 3, s)
  g.fillStyle = tom(1)
  g.fillRect(1, 1, s - 2, 1)
  g.fillRect(1, 1, 1, s - 2)
  // travessa em X
  for (let i = 3; i < s - 3; i++) {
    g.fillStyle = tom(4)
    g.fillRect(i, i, 3, 2)
    g.fillRect(s - i - 3, i, 3, 2)
    g.fillStyle = tom(1)
    g.fillRect(i, i - 1, 2, 1)
  }
  g.fillStyle = 'rgb(60,56,54)'
  for (const [x, y] of [[2, 2], [s - 4, 2], [2, s - 4], [s - 4, s - 4]]) g.fillRect(x, y, 2, 2)
  return textura(c)
}

export function texturaBarril(semente: number) {
  const w = 48
  const h = 32
  const { c, g } = tela(w, h)
  tabuas(g, rng(semente), 0, 0, w, h, 2, 6, true)
  for (const y of [4, 13, h - 14, h - 5]) {
    g.fillStyle = 'rgb(54,50,52)'
    g.fillRect(0, y, w, 3)
    g.fillStyle = 'rgb(120,114,110)'
    g.fillRect(0, y, w, 1)
    g.fillStyle = 'rgb(160,150,140)'
    for (let x = 3; x < w; x += 8) g.fillRect(x, y + 1, 1, 1)
  }
  return textura(c, true)
}

export function texturaTampa(semente: number) {
  const s = 24
  const { c, g } = tela(s, s)
  tabuas(g, rng(semente), 0, 0, s, s, 1, 6, true)
  g.strokeStyle = 'rgb(54,50,52)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2)
  g.stroke()
  return textura(c)
}

export function texturaFerro() {
  const { c, g } = tela(16, 16)
  const r = rng(7)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = 44 + Math.floor(r() * 14)
      g.fillStyle = hex(v, v - 2, v + 2)
      g.fillRect(x, y, 1, 1)
    }
  g.fillStyle = 'rgb(110,106,108)'
  g.fillRect(0, 2, 16, 1)
  return textura(c, true)
}

export function texturaCorda() {
  const { c, g } = tela(16, 8)
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 8; y++) {
      const f = (x + y * 2) % 6
      g.fillStyle = f < 2 ? 'rgb(196,160,104)' : f < 4 ? 'rgb(158,122,76)' : 'rgb(110,82,52)'
      g.fillRect(x, y, 1, 1)
    }
  return textura(c, true)
}

/** Vela de pano com a Jolly Roger; `cor` é o tom do pano. Bordas rasgadas em alfa. */
export function texturaVela(cor: [number, number, number], bandeira: JollyRoger, semente: number) {
  const w = 96
  const h = 112
  const { c, g } = tela(w, h)
  const r = rng(semente)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // dobras verticais e sombra nas bordas
      const dobra = Math.sin((x / w) * Math.PI * 3.2 + Math.sin(y * 0.05)) * 0.12
      const borda = 1 - Math.pow(Math.abs(x / w - 0.5) * 2, 3) * 0.25
      const ruido = (r() - 0.5) * 0.05
      const k = (0.82 + dobra + ruido) * borda
      const q = Math.round(k * 6) / 6
      g.fillStyle = hex(cor[0] * q, cor[1] * q, cor[2] * q)
      g.fillRect(x, y, 1, 1)
    }
  }
  // costuras horizontais
  for (let y = 18; y < h; y += 22) {
    g.fillStyle = hex(cor[0] * 0.6, cor[1] * 0.6, cor[2] * 0.6)
    g.fillRect(0, y, w, 1)
  }
  // a Jolly Roger do bando
  desenharJollyRoger(g, bandeira, w / 2, h * 0.4, 12, cor)
  // rasgos na barra de baixo e furinhos
  g.globalCompositeOperation = 'destination-out'
  for (let x = 0; x < w; x++) {
    const corte = Math.max(0, Math.round(3 + Math.sin(x * 0.7) * 2 + r() * 5 + (r() < 0.08 ? 10 : 0)))
    g.fillRect(x, h - corte, 1, corte)
  }
  for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * w), Math.floor(r() * h * 0.8), 2 + Math.floor(r() * 3), 2)
  g.globalCompositeOperation = 'source-over'
  return textura(c)
}

/** Quadradinho de seleção (a moldura amarela brilhante da referência). */
export function texturaMoldura(cor: string, preenchimento: string) {
  const s = 32
  const { c, g } = tela(s, s)
  g.fillStyle = preenchimento
  g.fillRect(2, 2, s - 4, s - 4)
  g.fillStyle = cor
  g.fillRect(1, 1, s - 2, 2)
  g.fillRect(1, s - 3, s - 2, 2)
  g.fillRect(1, 1, 2, s - 2)
  g.fillRect(s - 3, 1, 2, s - 2)
  return textura(c)
}

/** Sombra de contato redonda, em degraus (pixel art). */
export function texturaSombra() {
  const w = 32
  const h = 16
  const { c, g } = tela(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2))
      if (d > 1) continue
      g.fillStyle = d < 0.45 ? 'rgba(15,8,4,0.78)' : d < 0.75 ? 'rgba(15,8,4,0.55)' : 'rgba(15,8,4,0.28)'
      g.fillRect(x, y, 1, 1)
    }
  return textura(c)
}
