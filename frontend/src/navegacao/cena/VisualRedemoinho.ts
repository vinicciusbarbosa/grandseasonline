import Phaser from 'phaser'
import { REDEMOINHOS } from '../sim/redemoinho'
import { CHAVE_PONTO } from './Esteira'
import { ACHATAMENTO, ELEVACAO } from './projecao'

/**
 * Partículas do redemoinho, em cima do que o shader desenha:
 * - gotas que saltam da garganta em arco, girando junto com a água;
 * - flocos de espuma orbitando e descendo pela espiral.
 * Sprites suaves com brilho aditivo ciano, só quando o redemoinho está na vista.
 */

type Particula = {
  img: Phaser.GameObjects.Image
  angulo: number
  raio: number
  z: number
  vz: number
  vida: number
  duracao: number
  gota: boolean
}

const MAX = 180

export class VisualRedemoinho {
  private readonly livres: Phaser.GameObjects.Image[] = []
  private ativas: Particula[] = []
  private readonly celula: number

  constructor(cena: Phaser.Scene, celula: number) {
    this.celula = celula
    for (let i = 0; i < MAX; i++) {
      const img = cena.add.image(0, 0, CHAVE_PONTO).setVisible(false).setDepth(2.6).setBlendMode(Phaser.BlendModes.ADD)
      this.livres.push(img)
    }
  }

  atualizar(dt: number, vista: Phaser.Geom.Rectangle) {
    const r = REDEMOINHOS[0]
    const cx = r.cx * this.celula
    const cy = r.cy * this.celula
    const raio = r.raio * this.celula
    const naVista =
      cx + raio > vista.x && cx - raio < vista.right && cy * ACHATAMENTO + raio > vista.y && cy * ACHATAMENTO - raio < vista.bottom

    if (naVista) {
      // Gotas saltando da garganta.
      for (let i = 0; i < Math.round(dt * 90); i++) {
        this.nascer({ angulo: Math.random() * Math.PI * 2, raio: raio * (0.11 + Math.random() * 0.06), z: 2, vz: 50 + Math.random() * 70, duracao: 0.7 + Math.random() * 0.5, gota: true })
      }
      // Espuma orbitando.
      for (let i = 0; i < Math.round(dt * 40); i++) {
        this.nascer({ angulo: Math.random() * Math.PI * 2, raio: raio * (0.3 + Math.random() * 0.6), z: 0, vz: 0, duracao: 1.8 + Math.random() * 1.5, gota: false })
      }
    }

    for (const p of this.ativas) {
      p.vida += dt
      const perto = 1 - Math.min(1, p.raio / raio)
      // Giro anti-horário (igual à água), mais rápido perto do centro.
      p.angulo -= (0.6 + 3.2 * perto * perto) * dt
      if (p.gota) {
        p.raio += 18 * dt
        p.z += p.vz * dt
        p.vz -= 150 * dt
      } else {
        p.raio -= (10 + 40 * perto) * dt
      }
      const x = cx + Math.cos(p.angulo) * p.raio
      const y = cy + Math.sin(p.angulo) * p.raio
      const f = p.vida / p.duracao
      const surge = Math.min(1, f * 5) * (1 - f)
      p.img
        .setPosition(x, y * ACHATAMENTO - p.z * ELEVACAO)
        .setScale(p.gota ? 0.12 + 0.08 * (1 - f) : 0.2 + 0.25 * f, p.gota ? 0.16 : (0.2 + 0.25 * f) * 0.6)
        .setAlpha((p.gota ? 0.9 : 0.35) * surge)
        .setTint(p.gota ? 0xd8f6ff : 0x9fe6ff)
    }
    const mortas = this.ativas.filter((p) => p.vida >= p.duracao || (p.gota && p.z < 0) || p.raio < raio * 0.08)
    for (const p of mortas) {
      p.img.setVisible(false)
      this.livres.push(p.img)
    }
    this.ativas = this.ativas.filter((p) => !mortas.includes(p))
  }

  private nascer(p: Omit<Particula, 'img' | 'vida'>) {
    const img = this.livres.pop()
    if (!img) return
    img.setVisible(true)
    this.ativas.push({ ...p, img, vida: 0 })
  }
}
