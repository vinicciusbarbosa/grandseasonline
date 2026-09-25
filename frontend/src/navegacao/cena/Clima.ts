import Phaser from 'phaser'
import type { EstadoVento } from '../sim/vento'
import { ACHATAMENTO } from './projecao'

/**
 * Chuva, raios, clarão e trovão. Tudo cresce com a intensidade da tempestade
 * no centro da vista: primeiro o céu fecha, depois começa a chuva, e no
 * núcleo os raios ficam frequentes.
 *
 * Gotas e respingos são sprites suaves (gradiente, pontas arredondadas),
 * desenhados em lote. O raio é fractal (deslocamento de ponto médio), desce
 * em ~90 ms como um "líder", explode em brilho, pisca e deixa um resto que
 * apaga devagar. O som é sintetizado (Web Audio), sem arquivo nenhum.
 */

type Gota = { img: Phaser.GameObjects.Image; x: number; y: number; velocidade: number; escala: number }
type Respingo = { img: Phaser.GameObjects.Image; idade: number; duracao: number }
type Ponto = { x: number; y: number }
type Raio = { galhos: { pontos: Ponto[]; forca: number }[]; idade: number; pulsos: number[] }

const DURACAO_RAIO = 0.9
const DESCIDA = 0.09
const MAX_GOTAS = 360
const MAX_RESPINGOS = 90

export class Clima {
  private readonly cena: Phaser.Scene
  private readonly raios: Phaser.GameObjects.Graphics
  private readonly gotas: Gota[] = []
  private readonly respingos: Respingo[] = []
  private raiosAtivos: Raio[] = []
  private proximoRaio = 2
  private proximoClarao = 1
  /** 0–1: clarão atual e onde caiu (mundo), lidos pelo shader. */
  relampago = 0
  posicaoRelampago = { x: 0, y: 0 }
  private audio: AudioContext | null = null
  private somChuva: { ganho: GainNode } | null = null
  somLigado = true

  constructor(cena: Phaser.Scene) {
    this.cena = cena
    criarTexturas(cena)
    this.raios = cena.add.graphics().setDepth(15).setBlendMode(Phaser.BlendModes.ADD)
    for (let i = 0; i < MAX_GOTAS; i++) {
      const img = cena.add.image(0, 0, 'gota').setScrollFactor(0).setDepth(20).setVisible(false)
      this.gotas.push({ img, x: 0, y: 0, velocidade: 0, escala: 1 })
    }
    for (let i = 0; i < MAX_RESPINGOS; i++) {
      const img = cena.add.image(0, 0, 'respingo-chuva').setScrollFactor(0).setDepth(19).setVisible(false)
      this.respingos.push({ img, idade: 1, duracao: 1 })
    }
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

    this.proximoRaio -= dt
    if (tempestade > 0.25 && this.proximoRaio <= 0) {
      this.proximoRaio = (1.2 + Math.random() * 3.5) / (0.4 + tempestade)
      this.cairRaio(camera, pontoTempestade)
    }
    // Relâmpagos dentro das nuvens, sem raio visível: o céu pisca ao longe.
    this.proximoClarao -= dt
    if (tempestade > 0.2 && this.proximoClarao <= 0) {
      this.proximoClarao = 0.8 + Math.random() * 2.5
      const v = camera.worldView
      this.posicaoRelampago = { x: v.x + Math.random() * v.width, y: (v.y + Math.random() * v.height) / ACHATAMENTO }
      this.relampago = Math.max(this.relampago, 0.25 + Math.random() * 0.25)
      if (Math.random() < 0.5) this.trovao(0.25, 3.5, false)
    }

    for (const r of this.raiosAtivos) r.idade += dt
    this.raiosAtivos = this.raiosAtivos.filter((r) => r.idade < DURACAO_RAIO)
    // Clarão: soma dos pulsos dos raios ativos, com queda suave.
    let alvo = 0
    for (const r of this.raiosAtivos) alvo = Math.max(alvo, brilhoDoRaio(r))
    this.relampago = Math.max(alvo, this.relampago * Math.exp(-5 * dt))
    this.desenharRaios()

    if (this.somChuva && this.audio) {
      const volume = this.somLigado ? tempestade * 0.16 : 0
      this.somChuva.ganho.gain.setTargetAtTime(volume, this.audio.currentTime, 0.5)
    }
  }

  private atualizarChuva(dt: number, tempestade: number, vento: EstadoVento, camera: Phaser.Cameras.Scene2D.Camera) {
    const ativas = Math.round(MAX_GOTAS * Math.max(0, (tempestade - 0.08) / 0.92))
    const w = camera.width
    const h = camera.height
    const inclinacao = Math.cos(vento.direcao) * 0.4 * vento.intensidade
    const angulo = Math.atan(inclinacao)

    for (let i = 0; i < this.gotas.length; i++) {
      const gota = this.gotas[i]
      if (i >= ativas) {
        if (gota.img.visible) gota.img.setVisible(false)
        continue
      }
      if (!gota.img.visible) {
        gota.x = Math.random() * w
        gota.y = Math.random() * h
        // Três "camadas": gotas perto (grandes, rápidas) e longe (finas).
        gota.escala = [0.5, 0.75, 1.05][i % 3]
        gota.velocidade = (650 + Math.random() * 250) * (0.7 + gota.escala * 0.5)
        gota.img.setVisible(true)
      }
      gota.y += gota.velocidade * dt
      gota.x += gota.velocidade * inclinacao * dt
      if (gota.y > h + 30) {
        // Ao chegar embaixo, vira respingo na água num ponto qualquer da tela.
        if (Math.random() < 0.35) this.respingar(Math.random() * w, h * (0.25 + Math.random() * 0.75), gota.escala)
        gota.y = -30 - Math.random() * 60
        gota.x = Math.random() * w
      }
      if (gota.x > w + 20) gota.x -= w + 40
      if (gota.x < -20) gota.x += w + 40
      gota.img
        .setPosition(gota.x, gota.y)
        .setRotation(-angulo)
        .setScale(gota.escala * 0.9, gota.escala * (0.8 + 0.4 * tempestade))
        .setAlpha((0.25 + 0.35 * gota.escala) * Math.min(1, tempestade * 1.5))
    }

    for (const r of this.respingos) {
      if (!r.img.visible) continue
      r.idade += dt
      const f = r.idade / r.duracao
      if (f >= 1) {
        r.img.setVisible(false)
        continue
      }
      r.img.setScale(0.3 + f * 0.9, (0.3 + f * 0.9) * ACHATAMENTO * 0.6).setAlpha((1 - f) * 0.6)
    }
  }

  private respingar(x: number, y: number, escala: number) {
    const livre = this.respingos.find((r) => !r.img.visible)
    if (!livre) return
    livre.idade = 0
    livre.duracao = 0.35 + escala * 0.25
    livre.img.setVisible(true).setPosition(x, y)
  }

  private cairRaio(camera: Phaser.Cameras.Scene2D.Camera, pontoTempestade: (x: number, y: number) => number) {
    const v = camera.worldView
    let alvo: Ponto | null = null
    for (let i = 0; i < 12 && !alvo; i++) {
      const x = v.x + v.width * (0.1 + Math.random() * 0.8)
      const yProj = v.y + v.height * (0.3 + Math.random() * 0.65)
      if (pontoTempestade(x, yProj / ACHATAMENTO) > 0.3) alvo = { x, y: yProj }
    }
    if (!alvo) return

    // Tronco fractal, do céu até a água, e galhos que saem dele.
    const topo = { x: alvo.x + (Math.random() - 0.5) * 260, y: alvo.y - 700 - Math.random() * 250 }
    const tronco = fractal(topo, alvo, 90, 6)
    const galhos = [{ pontos: tronco, forca: 1 }]
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const inicio = tronco[Math.floor(tronco.length * (0.15 + Math.random() * 0.5))]
      const fim = { x: inicio.x + (Math.random() - 0.5) * 320, y: inicio.y + 90 + Math.random() * 200 }
      galhos.push({ pontos: fractal(inicio, fim, 45, 5), forca: 0.35 + Math.random() * 0.3 })
    }
    // Pulsos de brilho: o golpe principal e um ou dois repiques.
    const pulsos = [DESCIDA, DESCIDA + 0.12 + Math.random() * 0.08]
    if (Math.random() < 0.6) pulsos.push(DESCIDA + 0.3 + Math.random() * 0.15)
    this.raiosAtivos.push({ galhos, idade: 0, pulsos })
    this.posicaoRelampago = { x: alvo.x, y: alvo.y / ACHATAMENTO }

    // Trovão: estalo seco se foi perto, ronco longo sempre; chega com atraso.
    const distancia = Math.min(1, Math.hypot(alvo.x - v.centerX, alvo.y - v.centerY) / Math.max(v.width, 1))
    this.cena.time.delayedCall((0.12 + distancia * 1.4) * 1000, () => {
      camera.shake(600, 0.002 + 0.0045 * (1 - distancia))
      this.trovao(1 - distancia * 0.7, 3.8 + distancia * 1.5, distancia < 0.45)
    })
  }

  private desenharRaios() {
    const g = this.raios
    g.clear()
    for (const r of this.raiosAtivos) {
      // Enquanto desce, só o trecho já percorrido aparece, fino e fraco.
      const descendo = r.idade < DESCIDA
      const fracao = descendo ? r.idade / DESCIDA : 1
      const brilho = descendo ? 0.45 : brilhoDoRaio(r)
      if (brilho < 0.02) continue
      for (const [i, galho] of r.galhos.entries()) {
        const n = Math.max(2, Math.ceil(galho.pontos.length * (i === 0 ? fracao : Math.max(0, fracao * 1.4 - 0.4))))
        const pontos = galho.pontos.slice(0, n)
        if (pontos.length < 2) continue
        const f = galho.forca * brilho
        g.lineStyle(26 * galho.forca, 0x5f86ff, 0.08 * f)
        tracar(g, pontos)
        g.lineStyle(10 * galho.forca, 0x9fbaff, 0.22 * f)
        tracar(g, pontos)
        g.lineStyle(2.6 * galho.forca + 0.6, 0xffffff, Math.min(1, 1.2 * f))
        tracar(g, pontos)
      }
    }
  }

  /**
   * Trovão sintetizado: um estalo seco (ruído agudo curto) quando é perto e
   * um ronco grave e longo que "rola", com o volume subindo e descendo.
   */
  private trovao(forca: number, duracao: number, estalo: boolean) {
    const ctx = this.audio
    if (!ctx || !this.somLigado) return
    const agora = ctx.currentTime

    if (estalo) {
      const fonte = ctx.createBufferSource()
      fonte.buffer = ruidoBranco(ctx, 0.4)
      const filtro = ctx.createBiquadFilter()
      filtro.type = 'highpass'
      filtro.frequency.value = 900
      const ganho = ctx.createGain()
      ganho.gain.setValueAtTime(0.5 * forca, agora)
      ganho.gain.exponentialRampToValueAtTime(0.001, agora + 0.35)
      fonte.connect(filtro).connect(ganho).connect(ctx.destination)
      fonte.start(agora)
    }

    const fonte = ctx.createBufferSource()
    fonte.buffer = ruidoMarrom(ctx, duracao)
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.setValueAtTime(estalo ? 1400 : 500, agora)
    filtro.frequency.exponentialRampToValueAtTime(90, agora + duracao * 0.7)
    const ganho = ctx.createGain()
    ganho.gain.setValueAtTime(0.0001, agora)
    ganho.gain.exponentialRampToValueAtTime(0.9 * forca, agora + 0.08)
    // O ronco rola: algumas ondas de volume ao longo da duração.
    let t = agora + 0.3
    while (t < agora + duracao - 0.4) {
      ganho.gain.exponentialRampToValueAtTime(0.35 * forca + Math.random() * 0.4 * forca, t)
      t += 0.25 + Math.random() * 0.5
    }
    ganho.gain.exponentialRampToValueAtTime(0.001, agora + duracao)
    fonte.connect(filtro).connect(ganho).connect(ctx.destination)
    fonte.start(agora)
  }

  private criarSomChuva(ctx: AudioContext) {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruidoBranco(ctx, 3)
    fonte.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'bandpass'
    filtro.frequency.value = 1600
    filtro.Q.value = 0.4
    const ganho = ctx.createGain()
    ganho.gain.value = 0
    fonte.connect(filtro).connect(ganho).connect(ctx.destination)
    fonte.start()
    return { ganho }
  }
}

/** Brilho do raio agora: cada pulso acende rápido e apaga em ~80 ms, com resto. */
function brilhoDoRaio(r: Raio) {
  let b = 0
  for (const p of r.pulsos) {
    const d = r.idade - p
    if (d >= 0) b = Math.max(b, Math.exp(-d / 0.08))
  }
  const resto = Math.max(0, 1 - r.idade / DURACAO_RAIO) * 0.25
  return Math.max(b, r.idade > DESCIDA ? resto : 0)
}

/** Deslocamento de ponto médio: a forma quebrada e natural de um raio. */
function fractal(a: Ponto, b: Ponto, desvio: number, niveis: number): Ponto[] {
  let pontos = [a, b]
  let d = desvio
  for (let n = 0; n < niveis; n++) {
    const novos: Ponto[] = [pontos[0]]
    for (let i = 1; i < pontos.length; i++) {
      const p = pontos[i - 1]
      const q = pontos[i]
      novos.push({ x: (p.x + q.x) / 2 + (Math.random() - 0.5) * d, y: (p.y + q.y) / 2 + (Math.random() - 0.5) * d * 0.3 }, q)
    }
    pontos = novos
    d *= 0.55
  }
  return pontos
}

function tracar(g: Phaser.GameObjects.Graphics, pontos: Ponto[]) {
  g.beginPath()
  pontos.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
  g.strokePath()
}

/** Gota: traço fino com gradiente (cauda transparente, ponta clara e redonda). */
function criarTexturas(cena: Phaser.Scene) {
  if (!cena.textures.exists('gota')) {
    const t = cena.textures.createCanvas('gota', 8, 44)!
    const ctx = t.getContext()
    const grad = ctx.createLinearGradient(0, 0, 0, 44)
    grad.addColorStop(0, 'rgba(210,228,245,0)')
    grad.addColorStop(0.75, 'rgba(225,238,250,0.55)')
    grad.addColorStop(1, 'rgba(245,250,255,0.95)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(4, 2)
    ctx.lineTo(4, 41)
    ctx.stroke()
    t.refresh()
  }
  if (!cena.textures.exists('respingo-chuva')) {
    const t = cena.textures.createCanvas('respingo-chuva', 40, 40)!
    const ctx = t.getContext()
    ctx.strokeStyle = 'rgba(235,245,255,0.9)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(20, 20, 16, 0, Math.PI * 2)
    ctx.stroke()
    t.refresh()
  }
}

function ruidoBranco(ctx: AudioContext, segundos: number) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * segundos), ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
  return buffer
}

/** Ruído "marrom" (grave), a base do ronco do trovão. */
function ruidoMarrom(ctx: AudioContext, segundos: number) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * segundos), ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  let ultimo = 0
  for (let i = 0; i < dados.length; i++) {
    ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02
    dados[i] = ultimo * 3.5
  }
  return buffer
}
