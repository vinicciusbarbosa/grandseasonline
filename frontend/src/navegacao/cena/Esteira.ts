import Phaser from 'phaser'
import type { Vetor } from '../mundo/Mundo'

/**
 * Água mexida pelo navio: esteira em "V" na popa, rastro que se dissolve,
 * espuma nas laterais e borrifo na proa. Tudo proporcional à velocidade —
 * parado, quase nada; a toda vela, o mar abre.
 *
 * Cada partícula é uma Image de um ponto suave, reaproveitada de um pool:
 * imagens da mesma textura saem num único lote de GPU. (A primeira versão
 * redesenhava centenas de círculos num Graphics a cada quadro — era um dos
 * motivos do lag.)
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

const MAX_PARTICULAS = 420
const DURACAO_RASTRO = 3.2
export const CHAVE_PONTO = 'ponto-suave'

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

/** Ponto branco com borda suave, 32×32. */
export function criarTexturaPonto(cena: Phaser.Scene) {
  if (cena.textures.exists(CHAVE_PONTO)) return
  const textura = cena.textures.createCanvas(CHAVE_PONTO, 32, 32)!
  const ctx = textura.getContext()
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.75)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 32)
  textura.refresh()
}

export class Esteira {
  private readonly rastro: Phaser.GameObjects.Graphics
  private readonly pool: Phaser.GameObjects.Image[] = []
  private particulas: Particula[] = []
  private pontos: PontoRastro[] = []
  private acumulado = { popa: 0, centro: 0, lado: 0, proa: 0, rastro: 0 }

  /** `plano` é o container do mar (já achatado pela câmera inclinada). */
  constructor(cena: Phaser.Scene, plano: Phaser.GameObjects.Container) {
    criarTexturaPonto(cena)
    this.rastro = cena.add.graphics()
    plano.add(this.rastro)
    for (let i = 0; i < MAX_PARTICULAS; i++) {
      const img = cena.add.image(0, 0, CHAVE_PONTO).setVisible(false)
      plano.add(img)
      this.pool.push(img)
    }
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

    this.acumulado.rastro += dt
    if (this.acumulado.rastro > 0.08 && r > 0.03) {
      this.acumulado.rastro = 0
      this.pontos.push({ x: e.popa.x, y: e.popa.y, idade: 0, intensidade: r })
    }

    // Esteira em V: pares que abrem para os dois lados.
    this.acumulado.popa += dt * 22 * r
    while (this.acumulado.popa >= 1) {
      this.acumulado.popa -= 1
      for (const sinal of [-1, 1]) {
        const abertura = 7 + 14 * r + Math.random() * 4
        this.adicionar({
          x: e.popa.x + lado.x * sinal * e.meiaLargura * 0.6,
          y: e.popa.y + lado.y * sinal * e.meiaLargura * 0.6,
          vx: lado.x * sinal * abertura - frente.x * 4,
          vy: lado.y * sinal * abertura - frente.y * 4,
          vida: 0,
          duracao: 2.4 + Math.random() * 1.2,
          tamanhoInicial: 3 + Math.random() * 2,
          tamanhoFinal: 11 + Math.random() * 5 + r * 5,
          opacidade: 0.22 + 0.4 * r,
        })
      }
    }

    // Turbulência no meio da esteira.
    this.acumulado.centro += dt * 14 * r
    while (this.acumulado.centro >= 1) {
      this.acumulado.centro -= 1
      this.adicionar({
        x: e.popa.x + (Math.random() - 0.5) * e.meiaLargura,
        y: e.popa.y + (Math.random() - 0.5) * e.meiaLargura,
        vx: -frente.x * (5 + Math.random() * 6) + (Math.random() - 0.5) * 6,
        vy: -frente.y * (5 + Math.random() * 6) + (Math.random() - 0.5) * 6,
        vida: 0,
        duracao: 1.2 + Math.random() * 0.8,
        tamanhoInicial: 5,
        tamanhoFinal: 11,
        opacidade: 0.3 + 0.3 * r,
      })
    }

    // Espuma correndo pelo costado.
    this.acumulado.lado += dt * 14 * r
    while (this.acumulado.lado >= 1) {
      this.acumulado.lado -= 1
      const sinal = Math.random() < 0.5 ? -1 : 1
      const aoLongo = (Math.random() - 0.3) * 0.9
      this.adicionar({
        x: e.centro.x + frente.x * aoLongo * e.meiaLargura * 2.4 + lado.x * sinal * e.meiaLargura,
        y: e.centro.y + frente.y * aoLongo * e.meiaLargura * 2.4 + lado.y * sinal * e.meiaLargura,
        vx: lado.x * sinal * 9 - frente.x * 3,
        vy: lado.y * sinal * 9 - frente.y * 3,
        vida: 0,
        duracao: 0.8 + Math.random() * 0.5,
        tamanhoInicial: 3,
        tamanhoFinal: 7,
        opacidade: 0.45 * r,
      })
    }

    // Borrifo de proa: só a partir de meia velocidade.
    const borrifo = Math.max(0, r - 0.45) / 0.55
    this.acumulado.proa += dt * 30 * borrifo * borrifo
    while (this.acumulado.proa >= 1) {
      this.acumulado.proa -= 1
      const sinal = Math.random() < 0.5 ? -1 : 1
      const forca = 18 + Math.random() * 26
      this.adicionar({
        x: e.proa.x,
        y: e.proa.y,
        vx: lado.x * sinal * forca + frente.x * e.velocidade * 0.35,
        vy: lado.y * sinal * forca + frente.y * e.velocidade * 0.35,
        vida: 0,
        duracao: 0.35 + Math.random() * 0.35,
        tamanhoInicial: 2.5,
        tamanhoFinal: 5,
        opacidade: 0.85,
      })
    }
  }

  private adicionar(p: Particula) {
    if (this.particulas.length < MAX_PARTICULAS) this.particulas.push(p)
  }

  private simular(dt: number) {
    const atrito = Math.exp(-1.6 * dt)
    for (const p of this.particulas) {
      p.vida += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= atrito
      p.vy *= atrito
    }
    this.particulas = this.particulas.filter((p) => p.vida < p.duracao)
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
      this.rastro.lineStyle(7 + f * 22, 0xdff4ff, (1 - f) * 0.18 * b.intensidade + 0.02 * (1 - f))
      this.rastro.lineBetween(a.x, a.y, b.x, b.y)
    }

    for (let i = 0; i < this.pool.length; i++) {
      const img = this.pool[i]
      const p = this.particulas[i]
      if (!p) {
        if (img.visible) img.setVisible(false)
        continue
      }
      const f = p.vida / p.duracao
      const tamanho = p.tamanhoInicial + (p.tamanhoFinal - p.tamanhoInicial) * f
      img
        .setVisible(true)
        .setPosition(p.x, p.y)
        .setScale(tamanho / 16)
        .setAlpha(p.opacidade * (1 - f) * (1 - f))
    }
  }
}
