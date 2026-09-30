import * as THREE from 'three'

/**
 * Efeitos das skills em pixel art, desenhados por código (uma folha de
 * quadros por tipo × paleta, feita uma vez e guardada):
 *   corte, bala, adaga, punho, fogo, luz, gelo, fumaca, impacto, onda,
 *   tornado, aura, raio (Haki do Rei).
 * Paletas: normal (cor própria do efeito), armamento (negro e roxo) e rei
 * (negro e vermelho, com raios).
 *
 * Projéteis voam de um ponto a outro; estouros ficam num ponto e somem.
 */

export type TipoEfeito = 'corte' | 'bala' | 'adaga' | 'punho' | 'fogo' | 'luz' | 'gelo' | 'fumaca' | 'impacto' | 'onda' | 'tornado' | 'aura' | 'raio'
export type Paleta = 'normal' | 'armamento' | 'rei'

type Cores = [string, string, string] // claro, médio, escuro

const CORES: Record<TipoEfeito, Cores> = {
  corte: ['#ffffff', '#bfe4ff', '#5a8ac8'],
  bala: ['#fff6c0', '#ffc83a', '#a05a10'],
  adaga: ['#ffffff', '#c8ccd6', '#5a5e6a'],
  punho: ['#ffd9b0', '#e8a878', '#8a4a2a'],
  fogo: ['#fff3a0', '#ff9a2a', '#c8280e'],
  luz: ['#ffffff', '#fff27a', '#ffb81a'],
  gelo: ['#ffffff', '#a8ecff', '#3a8ad8'],
  fumaca: ['#f2f2f2', '#b8bcc4', '#6a6e78'],
  impacto: ['#ffffff', '#ffe27a', '#ff8a2a'],
  onda: ['#ffffff', '#e8d6b0', '#8a6a44'],
  tornado: ['#ffffff', '#c8e4ff', '#6a9ac8'],
  aura: ['#fff6d0', '#ffcf6a', '#c8781a'],
  raio: ['#ff8a8a', '#d0101e', '#050003'],
}
const HAKI: Record<Exclude<Paleta, 'normal'>, Cores> = {
  armamento: ['#d0a0ff', '#7a30d0', '#0c0410'],
  rei: ['#ff7a7a', '#c0101e', '#050003'],
}

const QUADROS = 8
const L = 48

function rng(s: number) {
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/** Desenha um quadro (t de 0 a 1) do efeito no canvas de L×L. */
function pintar(g: CanvasRenderingContext2D, tipo: TipoEfeito, t: number, [claro, medio, escuro]: Cores, rei: boolean) {
  const c = L / 2
  const r = rng(7 + Math.floor(t * QUADROS) * 13)
  const px = (x: number, y: number, w = 2, h = 2, cor = claro) => {
    g.fillStyle = cor
    g.fillRect(Math.round(x), Math.round(y), w, h)
  }
  const disco = (x: number, y: number, raio: number, cor: string) => {
    g.fillStyle = cor
    g.beginPath()
    g.arc(x, y, Math.max(0.5, raio), 0, Math.PI * 2)
    g.fill()
  }
  const raios = (n: number, comp: number) => {
    // raiozinhos negros com borda da cor (Haki)
    for (let i = 0; i < n; i++) {
      let a = r() * Math.PI * 2
      let x = c + Math.cos(a) * 4
      let y = c + Math.sin(a) * 4
      g.lineWidth = 3
      g.strokeStyle = medio
      g.beginPath()
      g.moveTo(x, y)
      for (let k = 0; k < 4; k++) {
        a += (r() - 0.5) * 1.6
        x += Math.cos(a) * comp / 4
        y += Math.sin(a) * comp / 4
        g.lineTo(x, y)
      }
      g.stroke()
      g.lineWidth = 1
      g.strokeStyle = escuro
      g.stroke()
    }
  }
  switch (tipo) {
    case 'corte': {
      // lua crescente
      const a0 = -1.1 + t * 0.3
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = [escuro, medio, claro][k]
        g.lineWidth = [7, 5, 2][k]
        g.beginPath()
        g.arc(c - 6, c, 16, a0, a0 + 2.2)
        g.stroke()
      }
      if (rei) raios(2, 14)
      break
    }
    case 'bala':
    case 'adaga': {
      g.fillStyle = escuro
      g.fillRect(c - 14, c - 2, 22, 4)
      g.fillStyle = medio
      g.fillRect(c - 12, c - 1, 20, 2)
      g.fillStyle = claro
      g.fillRect(c + 4, c - 2, 6, 4)
      if (tipo === 'adaga') {
        g.fillStyle = '#6a4a2a'
        g.fillRect(c - 16, c - 3, 5, 6)
      }
      break
    }
    case 'punho': {
      disco(c + 6, c, 8, escuro)
      disco(c + 6, c, 6.5, medio)
      disco(c + 8, c - 2, 3, claro)
      g.fillStyle = medio
      g.fillRect(c - 22, c - 3, 26, 6) // braço esticado
      g.fillStyle = escuro
      g.fillRect(c - 22, c + 2, 26, 1)
      break
    }
    case 'fogo':
    case 'luz':
    case 'gelo':
    case 'fumaca': {
      // nuvem/estouro elemental que cresce e some
      const n = tipo === 'fumaca' ? 9 : 12
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const d = r() * 14 * (0.4 + t)
        const raio = (3 + r() * 5) * (1 - t * 0.6)
        const cor = [escuro, medio, claro][Math.floor(r() * 3)]
        if (tipo === 'gelo') {
          g.fillStyle = cor
          g.beginPath()
          const x = c + Math.cos(a) * d
          const y = c + Math.sin(a) * d
          g.moveTo(x, y - raio * 1.6)
          g.lineTo(x + raio * 0.6, y)
          g.lineTo(x, y + raio * 1.6)
          g.lineTo(x - raio * 0.6, y)
          g.fill()
        } else disco(c + Math.cos(a) * d, c + Math.sin(a) * d - (tipo === 'fogo' ? t * 8 : 0), raio, cor)
      }
      if (tipo === 'luz') for (let i = 0; i < 6; i++) px(c + (r() - 0.5) * 36, c + (r() - 0.5) * 36, 2, 2, claro)
      break
    }
    case 'impacto': {
      const R = 6 + t * 16
      const pontas = 8
      g.fillStyle = medio
      g.beginPath()
      for (let i = 0; i < pontas * 2; i++) {
        const a = (i / (pontas * 2)) * Math.PI * 2 + t
        const rr = i % 2 ? R * 0.35 : R
        g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr)
      }
      g.closePath()
      g.fill()
      disco(c, c, R * 0.3, claro)
      if (rei || escuro === HAKI.armamento[2]) raios(rei ? 5 : 3, 14 + t * 8)
      break
    }
    case 'onda': {
      g.strokeStyle = medio
      g.lineWidth = 3
      g.beginPath()
      g.ellipse(c, c, 4 + t * 20, (4 + t * 20) * 0.5, 0, 0, Math.PI * 2)
      g.stroke()
      g.strokeStyle = claro
      g.lineWidth = 1
      g.stroke()
      for (let i = 0; i < 6; i++) px(c + (r() - 0.5) * 40 * t, c + (r() - 0.5) * 20 * t, 3, 3, escuro)
      break
    }
    case 'tornado': {
      for (let k = 0; k < 4; k++) {
        const a0 = t * 8 + k * 1.6
        g.strokeStyle = [escuro, medio, claro, medio][k]
        g.lineWidth = 2
        g.beginPath()
        g.ellipse(c, c + 4 - k * 4, 18 - k * 2, 6, 0, a0, a0 + 2.5)
        g.stroke()
      }
      if (rei) raios(2, 12)
      break
    }
    case 'aura': {
      for (let i = 0; i < 14; i++) {
        const x = c + (r() - 0.5) * 30
        const y = c + 16 - ((r() + t) % 1) * 36
        px(x, y, 2, 4, [claro, medio][i % 2])
      }
      break
    }
    case 'raio': {
      raios(7, 22)
      disco(c, c, 5 * (1 - t), escuro)
      break
    }
  }
}

const folhas = new Map<string, THREE.Texture>()

function folha(tipo: TipoEfeito, paleta: Paleta) {
  const chave = `${tipo}:${paleta}`
  let t = folhas.get(chave)
  if (t) return t
  const cv = document.createElement('canvas')
  cv.width = L * QUADROS
  cv.height = L
  const g = cv.getContext('2d')!
  g.imageSmoothingEnabled = false
  const cores = paleta === 'normal' ? CORES[tipo] : HAKI[paleta]
  for (let q = 0; q < QUADROS; q++) {
    g.save()
    g.beginPath()
    g.rect(q * L, 0, L, L)
    g.clip()
    g.translate(q * L, 0)
    pintar(g, tipo, q / (QUADROS - 1), cores, paleta === 'rei')
    g.restore()
  }
  t = new THREE.CanvasTexture(cv)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.repeat.set(1 / QUADROS, 1)
  folhas.set(chave, t)
  return t
}

export class Efeito {
  readonly sprite: THREE.Sprite
  vivo = true
  private t = 0
  private readonly dur: number
  private readonly de: THREE.Vector3
  private readonly para: THREE.Vector3 | null
  private readonly aoChegar?: () => void
  private readonly laco: boolean

  constructor(tipo: TipoEfeito, paleta: Paleta, de: THREE.Vector3, opcoes: { para?: THREE.Vector3; dur?: number; escala?: number; aoChegar?: () => void; laco?: boolean } = {}) {
    const tex = folha(tipo, paleta).clone()
    tex.needsUpdate = true
    tex.repeat.set(1 / QUADROS, 1)
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
    const e = opcoes.escala ?? 1
    this.sprite.scale.set(e, e, 1)
    this.sprite.renderOrder = 6
    this.de = de.clone()
    this.para = opcoes.para?.clone() ?? null
    this.dur = opcoes.dur ?? 0.5
    this.aoChegar = opcoes.aoChegar
    this.laco = !!opcoes.laco
    this.sprite.position.copy(de)
    if (this.para) {
      // gira o desenho para a direção do voo (na tela, aproximado pelo X/Z)
      const d = this.para.clone().sub(this.de)
      this.sprite.material.rotation = Math.atan2(-d.z * 0.75 + d.y, d.x)
    }
  }

  atualizar(dt: number) {
    this.t += dt
    const f = Math.min(1, this.t / this.dur)
    const q = this.laco ? Math.floor(this.t * 16) % QUADROS : Math.min(QUADROS - 1, Math.floor(f * QUADROS))
    this.sprite.material.map!.offset.set(q / QUADROS, 0)
    if (this.para) this.sprite.position.lerpVectors(this.de, this.para, f)
    if (f >= 1) {
      this.vivo = false
      this.aoChegar?.()
    }
  }

  descartar() {
    this.sprite.material.map?.dispose()
    this.sprite.material.dispose()
  }
}
