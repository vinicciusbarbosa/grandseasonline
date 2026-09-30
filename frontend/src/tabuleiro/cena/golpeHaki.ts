import * as THREE from 'three'
import { rng } from './texturas'
import { posicionarPixel, texturaPixel } from './pixel'

/**
 * Impacto de um golpe com Haki de armamento: clarão negro de contorno
 * roxo no ponto do golpe e raiozinhos pretos/roxos estalando para
 * fora. 8 quadros em pixel art, desenhados uma vez só.
 */

const L = 128
const QUADROS = 8
const FPS = 20

let folha: THREE.Texture | null = null

function raio(g: CanvasRenderingContext2D, r: () => number, x0: number, y0: number, ang: number, comp: number) {
  const pts: [number, number][] = [[x0, y0]]
  let x = x0
  let y = y0
  const passos = 4 + Math.floor(r() * 3)
  for (let i = 0; i < passos; i++) {
    ang += (r() - 0.5) * 1.4
    x += Math.cos(ang) * (comp / passos)
    y += Math.sin(ang) * (comp / passos)
    pts.push([x, y])
  }
  const linha = (cor: string, larg: number) => {
    g.strokeStyle = cor
    g.lineWidth = larg
    g.beginPath()
    g.moveTo(pts[0][0], pts[0][1])
    for (const [px, py] of pts.slice(1)) g.lineTo(px, py)
    g.stroke()
  }
  linha('#8a3ae6', 4)
  linha('#12060a', 2)
}

function desenhar() {
  const c = document.createElement('canvas')
  c.width = L * QUADROS
  c.height = L
  const g = c.getContext('2d')!
  g.lineJoin = g.lineCap = 'round'
  const r = rng(17)
  for (let q = 0; q < QUADROS; q++) {
    const t = q / (QUADROS - 1)
    g.save()
    g.beginPath()
    g.rect(q * L, 0, L, L)
    g.clip()
    const cx = q * L + L / 2
    const cy = L / 2
    // clarão: estrela negra com borda vermelha, estoura e encolhe
    const tam = (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75) * 34 + 4
    if (q < QUADROS - 2) {
      const pontas = 8
      const estrela = (esc: number) => {
        g.beginPath()
        for (let i = 0; i < pontas * 2; i++) {
          const a = (i / (pontas * 2)) * Math.PI * 2 + q * 0.2
          const rr = (i % 2 ? 0.38 : 1) * tam * esc * (0.8 + ((i * 7 + q) % 5) * 0.08)
          g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8)
        }
        g.closePath()
      }
      estrela(1.25)
      g.fillStyle = '#9b4df0'
      g.fill()
      estrela(1)
      g.fillStyle = '#0c0408'
      g.fill()
      g.fillStyle = '#e2c4ff'
      g.fillRect(Math.round(cx - 2), Math.round(cy - 2), 4, 4)
    }
    // raios: nascem no centro e vão se afastando
    if (q >= 1) {
      const n = q < 5 ? 5 : 3
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const d0 = 6 + t * 30
        raio(g, r, cx + Math.cos(a) * d0, cy + Math.sin(a) * d0 * 0.8, a, 14 + r() * 14 * (1 - t * 0.5))
      }
    }
    g.restore()
  }
  return texturaPixel(c)
}

export class GolpeHaki {
  readonly sprite: THREE.Sprite
  private t = 0
  private readonly pos: THREE.Vector3
  vivo = true

  constructor(pos: THREE.Vector3) {
    folha ??= desenhar()
    const tex = folha.clone()
    tex.needsUpdate = true
    tex.repeat.set(1 / QUADROS, 1)
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, depthTest: false }))
    this.sprite.center.set(0.5, 0.5)
    this.sprite.renderOrder = 10
    this.pos = pos.clone()
  }

  atualizar(dt: number, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    this.t += dt
    const q = Math.floor(this.t * FPS)
    if (q >= QUADROS) {
      this.vivo = false
      return
    }
    this.sprite.material.map!.offset.set(q / QUADROS, 0)
    posicionarPixel(this.sprite, this.pos, L, L, camera, telaL, telaA, false, 0.9)
  }

  descartar() {
    this.sprite.material.map?.dispose()
    this.sprite.material.dispose()
  }
}
