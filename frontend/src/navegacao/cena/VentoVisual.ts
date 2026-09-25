import Phaser from 'phaser'
import type { EstadoVento } from '../sim/vento'
import { ACHATAMENTO } from './projecao'

/**
 * Fios de vento: poucos traços brancos, finos, que correm a favor do vento
 * ondulando e, de vez em quando, dão uma volta completa (o "caracol" dos
 * jogos). Cada fio tem cauda que afina e some, e nasce e morre com fade.
 */

type Fio = {
  x: number
  y: number
  angulo: number
  idade: number
  duracao: number
  velocidade: number
  fase: number
  /** Momento (0–1 da vida) em que o fio faz a volta; > 1 = não faz. */
  volta: number
  sentido: number
  rastro: { x: number; y: number }[]
}

const PONTOS_CAUDA = 28

export class VentoVisual {
  private readonly g: Phaser.GameObjects.Graphics
  private fios: Fio[] = []

  constructor(cena: Phaser.Scene, plano: Phaser.GameObjects.Container) {
    this.g = cena.add.graphics()
    plano.add(this.g)
  }

  atualizar(dt: number, vento: EstadoVento, tempestade: number, vista: Phaser.Geom.Rectangle) {
    const alvo = Math.round(1 + 4 * vento.intensidade + 7 * tempestade)
    if (this.fios.length < alvo && Math.random() < dt * (1.2 + tempestade * 3)) {
      this.fios.push(this.nascer(vento, tempestade, vista))
    }

    for (const f of this.fios) {
      f.idade += dt
      const vida = f.idade / f.duracao
      const naVolta = (vida - f.volta) / 0.14
      if (naVolta > 0 && naVolta < 1) {
        // Num trecho curto da vida, o fio dá uma volta inteira.
        f.angulo += (f.sentido * Math.PI * 2 * dt) / (0.14 * f.duracao)
      } else {
        // No resto, ondula em volta da direção do vento.
        const alvo = vento.direcao + Math.sin(f.idade * 2.2 + f.fase) * (0.35 + 0.25 * vento.turbulencia)
        f.angulo += Phaser.Math.Angle.Wrap(alvo - f.angulo) * Math.min(1, dt * 3)
      }
      f.x += Math.cos(f.angulo) * f.velocidade * dt
      f.y += Math.sin(f.angulo) * f.velocidade * dt
      f.rastro.push({ x: f.x, y: f.y })
      if (f.rastro.length > PONTOS_CAUDA) f.rastro.shift()
    }
    this.fios = this.fios.filter((f) => f.idade < f.duracao)
    this.desenhar()
  }

  private nascer(vento: EstadoVento, tempestade: number, vista: Phaser.Geom.Rectangle): Fio {
    // Vista em coordenadas projetadas → mundo.
    const x = vista.x + Math.random() * vista.width
    const y = (vista.y + Math.random() * vista.height) / ACHATAMENTO
    return {
      x,
      y,
      angulo: vento.direcao,
      idade: 0,
      duracao: 2.4 + Math.random() * 1.8,
      velocidade: 70 + 110 * vento.intensidade + 90 * tempestade,
      fase: Math.random() * Math.PI * 2,
      volta: Math.random() < 0.45 ? 0.3 + Math.random() * 0.4 : 2,
      sentido: Math.random() < 0.5 ? -1 : 1,
      rastro: [{ x, y }],
    }
  }

  private desenhar() {
    const g = this.g
    g.clear()
    for (const f of this.fios) {
      const vida = f.idade / f.duracao
      const surge = Math.min(1, vida * 4) * Math.min(1, (1 - vida) * 3)
      const n = f.rastro.length
      for (let i = 1; i < n; i++) {
        const t = i / n
        g.lineStyle(0.6 + 1.6 * t, 0xffffff, 0.55 * surge * t * t)
        g.lineBetween(f.rastro[i - 1].x, f.rastro[i - 1].y, f.rastro[i].x, f.rastro[i].y)
      }
    }
  }
}
