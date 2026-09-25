import Phaser from 'phaser'
import type { Vetor } from '../mundo/Mundo'

/**
 * Água mexida pelo navio: esteira em "V" na popa, rastro que se dissolve,
 * espuma nas laterais e borrifo na proa. Tudo proporcional à velocidade —
 * parado, quase nada; a toda vela, o mar abre.
 *
 * É um sistema de partículas próprio desenhado num único Graphics: são poucas
 * centenas de círculos, e assim o comportamento (abrir para os lados, crescer
 * enquanto some) fica explícito aqui em vez de espalhado em configs.
 */

type Particula = {
  x: number
  y: number
  vx: number
  vy: number
  vida: number
  duracao: number
  tamanhoInicial: number
  tamanhoFinal: number
  opacidade: number
}

type PontoRastro = { x: number; y: number; idade: number; intensidade: number }

const MAX_PARTICULAS = 900
const DURACAO_RASTRO = 3.2

export type EntradaEsteira = {
  popa: Vetor
  proa: Vetor
  centro: Vetor
  rumo: number
  /** 0–1: velocidade em relação à máxima. */
  razao: number
  velocidade: number
  meiaLargura: number
}

export class Esteira {
  private readonly rastro: Phaser.GameObjects.Graphics
  private readonly espuma: Phaser.GameObjects.Graphics
  private readonly borrifo: Phaser.GameObjects.Graphics
  private particulas: Particula[] = []
  private respingos: Particula[] = []
  private pontos: PontoRastro[] = []
  private acumulado = { popa: 0, centro: 0, lado: 0, proa: 0, rastro: 0 }

  constructor(cena: Phaser.Scene) {
    this.rastro = cena.add.graphics().setDepth(1)
    this.espuma = cena.add.graphics().setDepth(1.2)
    this.borrifo = cena.add.graphics().setDepth(4)
  }

  atualizar(dt: number, e: EntradaEsteira | null) {
    if (e) this.emitir(dt, e)
    this.simular(dt)
    this.desenhar()
  }

  private emitir(dt: number, e: EntradaEsteira) {
    const r = e.razao
    const frente = { x: Math.cos(e.rumo), y: Math.sin(e.rumo) }
    const lado = { x: -frente.y, y: frente.x }

    // Rastro contínuo: um ponto a cada 60 ms enquanto houver movimento.
    this.acumulado.rastro += dt
    if (this.acumulado.rastro > 0.06 && r > 0.03) {
      this.acumulado.rastro = 0
      this.pontos.push({ x: e.popa.x, y: e.popa.y, idade: 0, intensidade: r })
    }

    // Esteira em V: pares que abrem para os dois lados.
    this.acumulado.popa += dt * 46 * r
    while (this.acumulado.popa >= 1) {
      this.acumulado.popa -= 1
      for (const sinal of [-1, 1]) {
        const abertura = 10 + 22 * r + Math.random() * 6
        this.adicionar(this.particulas, {
          x: e.popa.x + lado.x * sinal * e.meiaLargura * 0.6,
          y: e.popa.y + lado.y * sinal * e.meiaLargura * 0.6,
          vx: lado.x * sinal * abertura - frente.x * 6,
          vy: lado.y * sinal * abertura - frente.y * 6,
          vida: 0,
          duracao: 2.2 + Math.random() * 1.2,
          tamanhoInicial: 2 + Math.random() * 1.5,
          tamanhoFinal: 7 + Math.random() * 4 + r * 4,
          opacidade: 0.25 + 0.45 * r,
        })
      }
    }

    // Turbulência no meio da esteira.
    this.acumulado.centro += dt * 30 * r
    while (this.acumulado.centro >= 1) {
      this.acumulado.centro -= 1
      this.adicionar(this.particulas, {
        x: e.popa.x + (Math.random() - 0.5) * e.meiaLargura,
        y: e.popa.y + (Math.random() - 0.5) * e.meiaLargura,
        vx: -frente.x * (8 + Math.random() * 10) + (Math.random() - 0.5) * 8,
        vy: -frente.y * (8 + Math.random() * 10) + (Math.random() - 0.5) * 8,
        vida: 0,
        duracao: 1 + Math.random() * 0.8,
        tamanhoInicial: 3,
        tamanhoFinal: 7,
        opacidade: 0.35 + 0.35 * r,
      })
    }

    // Espuma correndo pelo costado.
    this.acumulado.lado += dt * 26 * r
    while (this.acumulado.lado >= 1) {
      this.acumulado.lado -= 1
      const sinal = Math.random() < 0.5 ? -1 : 1
      const aoLongo = (Math.random() - 0.3) * 0.9
      const px = e.centro.x + frente.x * aoLongo * e.meiaLargura * 2.4 + lado.x * sinal * e.meiaLargura
      const py = e.centro.y + frente.y * aoLongo * e.meiaLargura * 2.4 + lado.y * sinal * e.meiaLargura
      this.adicionar(this.particulas, {
        x: px,
        y: py,
        vx: lado.x * sinal * 12 - frente.x * 4,
        vy: lado.y * sinal * 12 - frente.y * 4,
        vida: 0,
        duracao: 0.7 + Math.random() * 0.5,
        tamanhoInicial: 1.5,
        tamanhoFinal: 4,
        opacidade: 0.5 * r,
      })
    }

    // Borrifo de proa: só a partir de meia velocidade, e cresce rápido.
    const borrifo = Math.max(0, r - 0.45) / 0.55
    this.acumulado.proa += dt * 70 * borrifo * borrifo
    while (this.acumulado.proa >= 1) {
      this.acumulado.proa -= 1
      const sinal = Math.random() < 0.5 ? -1 : 1
      const forca = 25 + Math.random() * 40
      this.adicionar(this.respingos, {
        x: e.proa.x,
        y: e.proa.y,
        vx: lado.x * sinal * forca + frente.x * e.velocidade * 0.35,
        vy: lado.y * sinal * forca + frente.y * e.velocidade * 0.35,
        vida: 0,
        duracao: 0.3 + Math.random() * 0.35,
        tamanhoInicial: 1.2 + Math.random() * 1.2,
        tamanhoFinal: 2.5,
        opacidade: 0.9,
      })
    }
  }

  private adicionar(lista: Particula[], p: Particula) {
    if (lista.length < MAX_PARTICULAS) lista.push(p)
  }

  private simular(dt: number) {
    for (const lista of [this.particulas, this.respingos]) {
      for (const p of lista) {
        p.vida += dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        // A água freia a espuma.
        const atrito = Math.exp(-1.6 * dt)
        p.vx *= atrito
        p.vy *= atrito
      }
    }
    this.particulas = this.particulas.filter((p) => p.vida < p.duracao)
    this.respingos = this.respingos.filter((p) => p.vida < p.duracao)
    for (const ponto of this.pontos) ponto.idade += dt
    this.pontos = this.pontos.filter((ponto) => ponto.idade < DURACAO_RASTRO)
  }

  private desenhar() {
    this.rastro.clear()
    for (let i = 1; i < this.pontos.length; i++) {
      const a = this.pontos[i - 1]
      const b = this.pontos[i]
      if (Math.hypot(b.x - a.x, b.y - a.y) > 60) continue
      const f = b.idade / DURACAO_RASTRO
      this.rastro.lineStyle(8 + f * 26, 0xdff4ff, (1 - f) * 0.2 * b.intensidade + 0.02 * (1 - f))
      this.rastro.lineBetween(a.x, a.y, b.x, b.y)
    }

    this.espuma.clear()
    for (const p of this.particulas) {
      const f = p.vida / p.duracao
      this.espuma.fillStyle(0xffffff, p.opacidade * (1 - f) * (1 - f))
      this.espuma.fillCircle(p.x, p.y, p.tamanhoInicial + (p.tamanhoFinal - p.tamanhoInicial) * f)
    }

    this.borrifo.clear()
    for (const p of this.respingos) {
      const f = p.vida / p.duracao
      this.borrifo.fillStyle(0xffffff, p.opacidade * (1 - f))
      this.borrifo.fillCircle(p.x, p.y, p.tamanhoInicial + (p.tamanhoFinal - p.tamanhoInicial) * f)
    }
  }

  limpar() {
    this.particulas = []
    this.respingos = []
    this.pontos = []
  }
}
