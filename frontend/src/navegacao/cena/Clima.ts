import Phaser from 'phaser'
import type { EstadoVento } from '../sim/vento'
import { ACHATAMENTO } from './projecao'

/**
 * Chuva, raios, clarão e trovão. Tudo cresce com a intensidade da tempestade
 * no centro da vista, então entrar nela é gradual: primeiro o céu fecha,
 * depois começa a chuva, e no núcleo os raios ficam frequentes.
 *
 * O som é sintetizado (Web Audio: ruído filtrado), sem arquivo nenhum. O
 * navegador só libera áudio depois de um clique — por isso `desbloquearSom`.
 */

type Gota = { x: number; y: number; velocidade: number; comprimento: number }
type Raio = { pontos: { x: number; y: number }[][]; idade: number }

const DURACAO_RAIO = 0.42

export class Clima {
  private readonly cena: Phaser.Scene
  private readonly chuva: Phaser.GameObjects.Graphics
  private readonly raios: Phaser.GameObjects.Graphics
  private gotas: Gota[] = []
  private raiosAtivos: Raio[] = []
  private proximoRaio = 3
  /** 0–1: clarão atual, lido pelo shader. */
  relampago = 0
  private audio: AudioContext | null = null
  private somChuva: { ganho: GainNode } | null = null
  somLigado = true

  constructor(cena: Phaser.Scene) {
    this.cena = cena
    this.chuva = cena.add.graphics().setScrollFactor(0).setDepth(20)
    this.raios = cena.add.graphics().setDepth(15)
  }

  desbloquearSom() {
    if (this.audio) return
    try {
      this.audio = new AudioContext()
      this.somChuva = this.criarSomChuva(this.audio)
    } catch {
      this.audio = null
    }
  }

  atualizar(dt: number, tempestade: number, vento: EstadoVento, pontoTempestade: (x: number, y: number) => number) {
    const camera = this.cena.cameras.main
    this.atualizarChuva(dt, tempestade, vento, camera)

    // --- Raios -----------------------------------------------------------------
    this.proximoRaio -= dt
    if (tempestade > 0.25 && this.proximoRaio <= 0) {
      this.proximoRaio = (0.9 + Math.random() * 3.5) / (0.4 + tempestade)
      this.cairRaio(camera, pontoTempestade)
    }
    for (const r of this.raiosAtivos) r.idade += dt
    this.raiosAtivos = this.raiosAtivos.filter((r) => r.idade < DURACAO_RAIO)
    this.relampago *= Math.exp(-7 * dt)
    this.desenharRaios()

    if (this.somChuva && this.audio) {
      const alvo = this.somLigado ? tempestade * 0.18 : 0
      this.somChuva.ganho.gain.setTargetAtTime(alvo, this.audio.currentTime, 0.5)
    }
  }

  private atualizarChuva(dt: number, tempestade: number, vento: EstadoVento, camera: Phaser.Cameras.Scene2D.Camera) {
    const alvo = Math.round(320 * Math.max(0, tempestade - 0.1))
    const w = camera.width
    const h = camera.height
    while (this.gotas.length < alvo) {
      this.gotas.push({ x: Math.random() * w, y: Math.random() * h, velocidade: 700 + Math.random() * 400, comprimento: 10 + Math.random() * 12 })
    }
    if (this.gotas.length > alvo) this.gotas.length = alvo

    // A chuva cai inclinada pelo vento.
    const inclinacao = Math.cos(vento.direcao) * 0.35 * vento.intensidade
    const g = this.chuva
    g.clear()
    if (!this.gotas.length) return
    g.lineStyle(1.2, 0xcfe0ee, 0.35 + 0.25 * tempestade)
    for (const gota of this.gotas) {
      gota.y += gota.velocidade * dt
      gota.x += gota.velocidade * inclinacao * dt
      if (gota.y > h) {
        gota.y = -20
        gota.x = Math.random() * w
      }
      if (gota.x > w) gota.x -= w
      if (gota.x < 0) gota.x += w
      g.lineBetween(gota.x, gota.y, gota.x - gota.comprimento * inclinacao, gota.y - gota.comprimento)
    }
  }

  private cairRaio(camera: Phaser.Cameras.Scene2D.Camera, pontoTempestade: (x: number, y: number) => number) {
    const v = camera.worldView
    // Procura um ponto da vista que esteja dentro da tempestade.
    let alvo: { x: number; y: number } | null = null
    for (let i = 0; i < 12 && !alvo; i++) {
      const x = v.x + v.width * (0.1 + Math.random() * 0.8)
      const yProj = v.y + v.height * (0.25 + Math.random() * 0.7)
      if (pontoTempestade(x, yProj / ACHATAMENTO) > 0.3) alvo = { x, y: yProj }
    }
    if (!alvo) return

    // Raio em zigue-zague descendo do céu, com um ou dois galhos.
    const topo = alvo.y - 650 - Math.random() * 250
    const principal = zigueZague(alvo.x + (Math.random() - 0.5) * 200, topo, alvo.x, alvo.y, 16, 26)
    const caminhos = [principal]
    const galhos = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < galhos; i++) {
      const inicio = principal[3 + Math.floor(Math.random() * 8)]
      caminhos.push(zigueZague(inicio.x, inicio.y, inicio.x + (Math.random() - 0.5) * 220, inicio.y + 120 + Math.random() * 160, 7, 18))
    }
    this.raiosAtivos.push({ pontos: caminhos, idade: 0 })
    this.relampago = 1

    // Trovão: o som chega depois, conforme a distância até o centro da tela.
    const distancia = Math.hypot(alvo.x - v.centerX, alvo.y - v.centerY) / Math.max(v.width, 1)
    const atraso = 0.15 + distancia * 1.6
    this.cena.time.delayedCall(atraso * 1000, () => {
      camera.shake(450, 0.0025 + 0.004 * (1 - Math.min(1, distancia)))
      this.trovao(1 - Math.min(0.8, distancia))
    })
  }

  private desenharRaios() {
    const g = this.raios
    g.clear()
    for (const r of this.raiosAtivos) {
      // Pisca: aceso, apaga, acende de novo e some.
      const f = r.idade / DURACAO_RAIO
      const aceso = f < 0.18 || (f > 0.32 && f < 0.55)
      if (!aceso) continue
      const alfa = f < 0.18 ? 1 : 0.7
      for (const [i, caminho] of r.pontos.entries()) {
        const largura = i === 0 ? 1 : 0.55
        g.lineStyle(22 * largura, 0x7fa8ff, 0.12 * alfa)
        tracar(g, caminho)
        g.lineStyle(9 * largura, 0xb7d0ff, 0.3 * alfa)
        tracar(g, caminho)
        g.lineStyle(3 * largura, 0xffffff, alfa)
        tracar(g, caminho)
      }
    }
  }

  private trovao(forca: number) {
    const ctx = this.audio
    if (!ctx || !this.somLigado) return
    const duracao = 2.8
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruidoMarrom(ctx, duracao)
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.setValueAtTime(900, ctx.currentTime)
    filtro.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.6)
    const ganho = ctx.createGain()
    const agora = ctx.currentTime
    ganho.gain.setValueAtTime(0, agora)
    ganho.gain.linearRampToValueAtTime(0.9 * forca, agora + 0.03)
    ganho.gain.exponentialRampToValueAtTime(0.35 * forca, agora + 0.4)
    ganho.gain.exponentialRampToValueAtTime(0.001, agora + duracao)
    fonte.connect(filtro).connect(ganho).connect(ctx.destination)
    fonte.start()
  }

  private criarSomChuva(ctx: AudioContext) {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruidoBranco(ctx, 3)
    fonte.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'bandpass'
    filtro.frequency.value = 1800
    filtro.Q.value = 0.5
    const ganho = ctx.createGain()
    ganho.gain.value = 0
    fonte.connect(filtro).connect(ganho).connect(ctx.destination)
    fonte.start()
    return { ganho }
  }
}

function zigueZague(x0: number, y0: number, x1: number, y1: number, passos: number, desvio: number) {
  const pontos = [{ x: x0, y: y0 }]
  for (let i = 1; i < passos; i++) {
    const t = i / passos
    pontos.push({ x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * desvio * 2, y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * desvio * 0.5 })
  }
  pontos.push({ x: x1, y: y1 })
  return pontos
}

function tracar(g: Phaser.GameObjects.Graphics, pontos: { x: number; y: number }[]) {
  g.beginPath()
  pontos.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
  g.strokePath()
}

function ruidoBranco(ctx: AudioContext, segundos: number) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * segundos, ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
  return buffer
}

/** Ruído "marrom" (grave), a base do ronco do trovão. */
function ruidoMarrom(ctx: AudioContext, segundos: number) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * segundos, ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  let ultimo = 0
  for (let i = 0; i < dados.length; i++) {
    ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02
    dados[i] = ultimo * 3.5
  }
  return buffer
}
