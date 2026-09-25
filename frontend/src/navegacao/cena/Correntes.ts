import Phaser from 'phaser'
import type { Mundo } from '../mundo/Mundo'

type Risco = { x: number; y: number; dx: number; dy: number; vida: number }

/** Riscos claros que correm no sentido da corrente, só nas células visíveis. */
export class Correntes {
  private readonly grafico: Phaser.GameObjects.Graphics
  private readonly mundo: Mundo
  private readonly celulas: { x: number; y: number; dx: number; dy: number }[] = []
  private riscos: Risco[] = []

  constructor(cena: Phaser.Scene, mundo: Mundo) {
    this.mundo = mundo
    this.grafico = cena.add.graphics().setDepth(0.5)
    for (let cy = 0; cy < mundo.altura; cy++) {
      for (let cx = 0; cx < mundo.largura; cx++) {
        const centro = mundo.centroDa(cx, cy)
        const c = mundo.correnteEm(centro)
        if (c) this.celulas.push({ x: centro.x, y: centro.y, dx: c.dx * c.forca, dy: c.dy * c.forca })
      }
    }
  }

  atualizar(dt: number, vista: Phaser.Geom.Rectangle) {
    const margem = this.mundo.celula
    for (const c of this.celulas) {
      if (c.x < vista.x - margem || c.x > vista.right + margem || c.y < vista.y - margem || c.y > vista.bottom + margem) continue
      if (Math.random() < dt * 1.6) {
        this.riscos.push({
          x: c.x + (Math.random() - 0.5) * this.mundo.celula,
          y: c.y + (Math.random() - 0.5) * this.mundo.celula,
          dx: c.dx,
          dy: c.dy,
          vida: 0,
        })
      }
    }

    this.grafico.clear()
    for (const r of this.riscos) {
      r.vida += dt
      r.x += r.dx * 55 * dt
      r.y += r.dy * 55 * dt
      const f = r.vida / 1.3
      const alfa = Math.sin(Math.min(1, f) * Math.PI) * 0.45
      this.grafico.lineStyle(2, 0xe8fbff, alfa)
      this.grafico.lineBetween(r.x, r.y, r.x - r.dx * 16, r.y - r.dy * 16)
    }
    this.riscos = this.riscos.filter((r) => r.vida < 1.3)
  }
}
