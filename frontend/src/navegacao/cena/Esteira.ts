import Phaser from 'phaser'
import type { Vetor } from '../mundo/Mundo'

/**
 * Água mexida pelo navio, desenhada PELO SHADER DO MAR — não por cima dele.
 *
 * Mantemos uma "memória" da água em volta do navio: uma textura 512×512
 * (3 px do mundo por texel) onde carimbamos espuma na popa, nas duas faixas
 * do "V" e na onda de proa. A cada quadro ela é copiada para a outra textura
 * do par, um pouco mais apagada e deslocada conforme o navio anda (a janela
 * acompanha o navio). O shader lê essa textura e pinta água mais clara e
 * espuma com o mesmo ruído da arrebentação — por isso o rastro tem a cara do
 * resto do mar.
 */

export const TEXEL = 3
export const TAMANHO = 512
const LADO_MUNDO = TEXEL * TAMANHO
export const CHAVE_PONTO = 'ponto-suave'
const CHAVES = ['rastro-a', 'rastro-b'] as const

/** Quanto tempo a espuma leva para sumir (constante de tempo, em s). */
const MEMORIA = 2.6

type Braco = { x: number; y: number; vx: number; vy: number; vida: number; duracao: number; forca: number }

export type EntradaEsteira = {
  popa: Vetor
  proa: Vetor
  centro: Vetor
  rumo: number
  /** 0–1: velocidade em relação à máxima. */
  razao: number
  meiaLargura: number
  meioComprimento: number
}

/** Ponto branco com borda suave, 32×32. */
export function criarTexturaPonto(cena: Phaser.Scene) {
  if (cena.textures.exists(CHAVE_PONTO)) return
  const textura = cena.textures.createCanvas(CHAVE_PONTO, 32, 32)!
  const ctx = textura.getContext()
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 32)
  textura.refresh()
}

export class Esteira {
  private readonly texturas: Phaser.Textures.DynamicTexture[]
  private atual = 0
  /** Canto da janela no mundo (alinhado à grade de texels). */
  readonly janela = { x: 0, y: 0, lado: LADO_MUNDO }
  private bracos: Braco[] = []
  private acumulados: number[] = []
  private respingosPendentes: { p: Vetor; raio: number; forca: number }[] = []
  private esperaApagar = 0
  private iniciada = false

  constructor(cena: Phaser.Scene) {
    criarTexturaPonto(cena)
    this.texturas = CHAVES.map((chave) => {
      const t = cena.textures.addDynamicTexture(chave, TAMANHO, TAMANHO)!
      t.fill(0x000000, 1)
      t.render()
      return t
    })
  }

  /** Chave da textura com o estado mais recente (a que o shader deve ler). */
  get chave() {
    return CHAVES[this.atual]
  }

  /** Marca um respingo (bala caindo na água, destroços...) no próximo quadro. */
  respingo(p: Vetor, raio: number, forca: number) {
    this.respingosPendentes.push({ p, raio, forca })
  }

  /** `centroNavio` é quem a janela acompanha; `entradas`, todos os navios a desenhar. */
  atualizar(dt: number, centroNavio: Vetor, entradas: EntradaEsteira[]) {
    // Janela centrada no navio, andando de texel em texel (sem borrar).
    const nx = Math.floor((centroNavio.x - LADO_MUNDO / 2) / TEXEL) * TEXEL
    const ny = Math.floor((centroNavio.y - LADO_MUNDO / 2) / TEXEL) * TEXEL
    if (!this.iniciada) {
      this.janela.x = nx
      this.janela.y = ny
      this.iniciada = true
    }
    const desloca = { x: (this.janela.x - nx) / TEXEL, y: (this.janela.y - ny) / TEXEL }
    this.janela.x = nx
    this.janela.y = ny

    const destino = this.texturas[1 - this.atual]
    destino.clear()
    destino.fill(0x000000, 1)
    // Copia o quadro anterior, deslocado. O esmaecimento vai em passos de
    // 0,1 s: em 8 bits, um passo minúsculo por quadro arredonda para zero e a
    // espuma nunca some.
    this.esperaApagar += dt
    let alpha = 1
    if (this.esperaApagar >= 0.1) {
      alpha = Math.exp(-this.esperaApagar / MEMORIA)
      this.esperaApagar = 0
    }
    destino.stamp(CHAVES[this.atual], undefined, TAMANHO / 2 + desloca.x, TAMANHO / 2 + desloca.y, { alpha })

    this.dt = dt
    entradas.forEach((e, i) => this.carimbar(destino, dt, e, i))
    // Respingos são instantâneos: força inteira, sem multiplicar por dt.
    for (const r of this.respingosPendentes) this.ponto(destino, r.p, r.raio, r.forca / Math.max(dt, 1e-3))
    this.respingosPendentes = []
    this.simularBracos(destino, dt)
    destino.render()
    this.atual = 1 - this.atual
  }

  private dt = 1 / 60

  private emTexel(p: Vetor) {
    return { x: (p.x - this.janela.x) / TEXEL, y: (p.y - this.janela.y) / TEXEL }
  }

  /** `taxa` é por segundo: o carimbo do quadro leva taxa × dt. */
  private ponto(t: Phaser.Textures.DynamicTexture, p: Vetor, raioMundo: number, taxa: number, alongar = 1, rotacao = 0) {
    const forca = taxa * this.dt
    if (forca < 0.004) return
    const q = this.emTexel(p)
    const escala = (raioMundo * 2) / TEXEL / 32
    t.stamp(CHAVE_PONTO, undefined, q.x, q.y, {
      alpha: Math.min(1, forca),
      scaleX: escala * alongar,
      scaleY: escala,
      rotation: rotacao,
      blendMode: Phaser.BlendModes.ADD,
    })
  }

  private carimbar(t: Phaser.Textures.DynamicTexture, dt: number, e: EntradaEsteira, indice: number) {
    const r = e.razao
    const frente = { x: Math.cos(e.rumo), y: Math.sin(e.rumo) }
    const lado = { x: -frente.y, y: frente.x }

    // Água sempre batendo no casco, mesmo parado: um halo leve em volta.
    for (const f of [-0.7, -0.2, 0.3, 0.75]) {
      const c = { x: e.centro.x + frente.x * f * e.meioComprimento, y: e.centro.y + frente.y * f * e.meioComprimento }
      this.ponto(t, c, e.meiaLargura * 1.6, 0.35, 1.6, e.rumo)
    }
    if (r < 0.02) return

    // Esteira da popa: larga e clara.
    this.ponto(t, e.popa, e.meiaLargura * (1.1 + 0.6 * r), 0.3 + 0.8 * r, 1.4, e.rumo)

    // Onda de proa: o casco cortando a água, espuma dos dois lados da proa.
    for (const s of [-1, 1]) {
      const b = { x: e.proa.x - frente.x * 6 + lado.x * s * e.meiaLargura * 0.55, y: e.proa.y - frente.y * 6 + lado.y * s * e.meiaLargura * 0.55 }
      this.ponto(t, b, 6 + 7 * r, 0.6 + 1.6 * r, 2, e.rumo + s * 0.5)
      const m = { x: e.centro.x + lado.x * s * e.meiaLargura * 1.05, y: e.centro.y + lado.y * s * e.meiaLargura * 1.05 }
      this.ponto(t, m, 5 + 4 * r, 0.3 + 0.9 * r, 2.2, e.rumo)
    }

    // Os braços do "V" nascem na popa e se abrem para os lados.
    this.acumulados[indice] = (this.acumulados[indice] ?? 0) + dt * 26 * r
    while (this.acumulados[indice] >= 1) {
      this.acumulados[indice] -= 1
      for (const s of [-1, 1]) {
        const abre = 10 + 14 * r
        this.bracos.push({
          x: e.popa.x + lado.x * s * e.meiaLargura * 0.7,
          y: e.popa.y + lado.y * s * e.meiaLargura * 0.7,
          vx: lado.x * s * abre - frente.x * 3,
          vy: lado.y * s * abre - frente.y * 3,
          vida: 0,
          duracao: 1.6 + Math.random() * 0.6,
          forca: 0.25 + 0.4 * r,
        })
      }
    }
  }

  private simularBracos(t: Phaser.Textures.DynamicTexture, dt: number) {
    const atrito = Math.exp(-1.2 * dt)
    for (const b of this.bracos) {
      b.vida += dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vx *= atrito
      b.vy *= atrito
      const f = 1 - b.vida / b.duracao
      this.ponto(t, b, 5 + b.vida * 5, b.forca * f)
    }
    this.bracos = this.bracos.filter((b) => b.vida < b.duracao)
  }
}
