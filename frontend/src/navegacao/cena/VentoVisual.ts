import Phaser from 'phaser'
import type { EstadoVento } from '../sim/vento'
import { desempenho } from './desempenho'
import { desenharFita } from './fita'
import { ACHATAMENTO } from './projecao'

/**
 * Fios de vento: traços brancos finos que correm a favor do vento ondulando
 * e, de vez em quando, dão uma volta completa (o "caracol" dos jogos).
 * Em volta do redemoinho, a ventania gira junto com a água: fios longos e
 * rápidos, em órbita, fechando para o centro.
 *
 * Cada fio é uma fita afilada e suavizada (cena/fita.ts), sem emendas.
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
  /** Fio de ventania em órbita do redemoinho. */
  orbita: { cx: number; cy: number; raio: number; angulo: number } | null
  largura: number
}

export type CentroVendaval = { x: number; y: number; raio: number }

export class VentoVisual {
  private readonly g: Phaser.GameObjects.Graphics
  private fios: Fio[] = []

  constructor(cena: Phaser.Scene, plano: Phaser.GameObjects.Container) {
    this.g = cena.add.graphics()
    plano.add(this.g)
  }

  atualizar(dt: number, vento: EstadoVento, tempestade: number, vista: Phaser.Geom.Rectangle, vendaval: CentroVendaval | null) {
    const comuns = this.fios.filter((f) => !f.orbita).length
    const alvo = Math.round((1 + 4 * vento.intensidade + 7 * tempestade) * desempenho.efeitos)
    if (comuns < alvo && Math.random() < dt * (1.2 + tempestade * 3)) this.fios.push(this.nascer(vento, tempestade, vista))

    if (vendaval && this.naVista(vendaval, vista)) {
      const orbitando = this.fios.length - comuns
      if (orbitando < 22 * desempenho.efeitos && Math.random() < dt * 16) this.fios.push(this.nascerNaOrbita(vendaval))
    }

    for (const f of this.fios) {
      f.idade += dt
      if (f.orbita) {
        // Gira em volta do olho, mais rápido perto dele, e vai fechando.
        const o = f.orbita
        const perto = 1 - Math.min(1, o.raio / (vendaval?.raio ?? o.raio) / 1.8)
        o.angulo -= (f.velocidade / Math.max(o.raio, 40)) * dt
        o.raio = Math.max(30, o.raio - (8 + 30 * perto) * dt)
        f.x = o.cx + Math.cos(o.angulo) * o.raio
        f.y = o.cy + Math.sin(o.angulo) * o.raio
      } else {
        const vida = f.idade / f.duracao
        const naVolta = (vida - f.volta) / 0.14
        if (naVolta > 0 && naVolta < 1) {
          f.angulo += (f.sentido * Math.PI * 2 * dt) / (0.14 * f.duracao)
        } else {
          const alvoAngulo = vento.direcao + Math.sin(f.idade * 2.2 + f.fase) * (0.35 + 0.25 * vento.turbulencia)
          f.angulo += Phaser.Math.Angle.Wrap(alvoAngulo - f.angulo) * Math.min(1, dt * 3)
        }
        f.x += Math.cos(f.angulo) * f.velocidade * dt
        f.y += Math.sin(f.angulo) * f.velocidade * dt
      }
      f.rastro.push({ x: f.x, y: f.y })
      if (f.rastro.length > (f.orbita ? 34 : 26)) f.rastro.shift()
    }
    this.fios = this.fios.filter((f) => f.idade < f.duracao)
    this.desenhar()
  }

  private naVista(v: CentroVendaval, vista: Phaser.Geom.Rectangle) {
    const r = v.raio * 2
    return v.x + r > vista.x && v.x - r < vista.right && v.y * ACHATAMENTO + r > vista.y && v.y * ACHATAMENTO - r < vista.bottom
  }

  private nascer(vento: EstadoVento, tempestade: number, vista: Phaser.Geom.Rectangle): Fio {
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
      orbita: null,
      largura: 2.2 + tempestade * 1.2,
    }
  }

  private nascerNaOrbita(v: CentroVendaval): Fio {
    const angulo = Math.random() * Math.PI * 2
    const raio = v.raio * (0.5 + Math.random() * 1.3)
    const x = v.x + Math.cos(angulo) * raio
    const y = v.y + Math.sin(angulo) * raio
    return {
      x,
      y,
      angulo: 0,
      idade: 0,
      duracao: 1.4 + Math.random() * 1.2,
      velocidade: 220 + Math.random() * 160,
      fase: 0,
      volta: 2,
      sentido: -1,
      rastro: [{ x, y }],
      orbita: { cx: v.x, cy: v.y, raio, angulo },
      largura: 2.6 + Math.random() * 2,
    }
  }

  private desenhar() {
    const g = this.g
    g.clear()
    for (const f of this.fios) {
      if (f.rastro.length < 3) continue
      const vida = f.idade / f.duracao
      const surge = Math.min(1, vida * 4) * Math.min(1, (1 - vida) * 3)
      // Cauda fina que engrossa até a cabeça e afina de novo na ponta.
      const largura = (t: number) => f.largura * Math.pow(t, 1.4) * (1 - Math.pow(t, 8) * 0.6) + 0.2
      desenharFita(g, f.rastro, largura, 0xffffff, (f.orbita ? 0.45 : 0.5) * surge, 2)
    }
  }
}
