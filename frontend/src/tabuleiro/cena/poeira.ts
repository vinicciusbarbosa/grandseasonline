import * as THREE from 'three'
import { rng } from './texturas'
import { posicionarPixel, texturaPixel } from './pixel'

/**
 * Fumacinha de poeira no pé (freada, pouso do pulo): 7 quadros em pixel art,
 * bolinhas que incham, sobem um pouco e somem.
 */

const L = 40
const A = 24
const QUADROS = 7
const FPS = 16

let folha: THREE.Texture | null = null

function desenhar() {
  const c = document.createElement('canvas')
  c.width = L * QUADROS
  c.height = A
  const g = c.getContext('2d')!
  const r = rng(9)
  const bolas = Array.from({ length: 7 }, (_, i) => ({
    x: (i - 3) * 4 + (r() - 0.5) * 3,
    y: -r() * 3,
    raio: 2.5 + r() * 2.5,
    vx: (i - 3) * 1.6 + (r() - 0.5),
    vy: -0.6 - r() * 0.8,
  }))
  for (let q = 0; q < QUADROS; q++) {
    const t = q / (QUADROS - 1)
    for (const b of bolas) {
      const rr = b.raio * (0.6 + t * 1.1) * (1 - t * t * 0.9)
      if (rr < 0.8) continue
      const cx = L / 2 + b.x + b.vx * q
      const cy = A - 5 + b.y + b.vy * q
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++)
        for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rr
          if (d > 1) continue
          // luz de cima, sombra embaixo, contorno na borda
          const k = d > 0.82 ? 0 : y + 0.5 < cy - rr * 0.2 ? 2 : 1
          g.fillStyle = ['#8a6a4a', '#c8ab88', '#eadcc4'][k]
          if (t > 0.7 && (x + y + q) % 2 === 0) continue // desfaz no fim
          g.fillRect(q * L + x, y, 1, 1)
        }
    }
  }
  return texturaPixel(c)
}

export class Poeira {
  readonly sprite: THREE.Sprite
  private t = 0
  private readonly pos: THREE.Vector3
  vivo = true

  constructor(pos: THREE.Vector3) {
    folha ??= desenhar()
    const tex = folha.clone()
    tex.needsUpdate = true
    tex.repeat.set(1 / QUADROS, 1)
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 }))
    this.sprite.center.set(0.5, 0.2)
    this.pos = pos.clone()
  }

  atualizar(dt: number, camera: THREE.PerspectiveCamera, telaL: number, telaA: number, escala = 1) {
    this.t += dt
    const q = Math.floor(this.t * FPS)
    if (q >= QUADROS) {
      this.vivo = false
      return
    }
    this.sprite.material.map!.offset.set(q / QUADROS, 0)
    posicionarPixel(this.sprite, this.pos, L * escala, A * escala, camera, telaL, telaA, false, 0.7)
  }
}
