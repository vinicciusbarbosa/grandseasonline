import Phaser from 'phaser'
import { REDEMOINHOS } from '../sim/redemoinho'
import { CHAVE_PONTO } from './Esteira'
import { desenharFita } from './fita'
import { ACHATAMENTO, ELEVACAO } from './projecao'

/**
 * Efeitos do redemoinho, por cima do que o shader desenha:
 *
 * - lâminas d'água: fitas que sobem da garganta e se curvam com o giro,
 *   largas embaixo e finas na ponta, subindo e caindo (como na referência);
 * - correntezas: fitas finas na superfície, descendo pela espiral;
 * - névoa e brilho: manchas grandes e suaves em volta da garganta;
 * - gotas: poucas, esticadas na direção em que voam (nada de bolinhas).
 *
 * Tudo com mistura aditiva em tons de ciano, e só quando está na vista.
 */

type Lamina = { angulo: number; altura: number; vida: number; duracao: number; abertura: number }
type Corrente = { angulo: number; raio: number; vida: number; duracao: number }
type Gota = { img: Phaser.GameObjects.Image; x: number; y: number; z: number; vx: number; vy: number; vz: number; vida: number }
type Nevoa = { img: Phaser.GameObjects.Image; angulo: number; raio: number; fase: number }

const GIRO = -1 // anti-horário na tela, como a água

export class VisualRedemoinho {
  private readonly fitas: Phaser.GameObjects.Graphics
  private readonly brilho: Phaser.GameObjects.Image
  private readonly nevoas: Nevoa[] = []
  private readonly gotasLivres: Phaser.GameObjects.Image[] = []
  private gotas: Gota[] = []
  private laminas: Lamina[] = []
  private correntes: Corrente[] = []
  private readonly celula: number
  private tempo = 0

  constructor(cena: Phaser.Scene, celula: number) {
    this.celula = celula
    this.fitas = cena.add.graphics().setDepth(2.6).setBlendMode(Phaser.BlendModes.ADD)
    this.brilho = cena.add.image(0, 0, CHAVE_PONTO).setDepth(2.5).setBlendMode(Phaser.BlendModes.ADD).setTint(0x5fd8ff)
    for (let i = 0; i < 12; i++) {
      const img = cena.add.image(0, 0, CHAVE_PONTO).setDepth(2.55).setBlendMode(Phaser.BlendModes.ADD).setTint(0xbdefff)
      this.nevoas.push({ img, angulo: (i / 12) * Math.PI * 2, raio: 0.12 + Math.random() * 0.12, fase: Math.random() * 10 })
    }
    for (let i = 0; i < 60; i++) {
      this.gotasLivres.push(cena.add.image(0, 0, CHAVE_PONTO).setDepth(2.7).setVisible(false).setBlendMode(Phaser.BlendModes.ADD).setTint(0xe8faff))
    }
  }

  atualizar(dt: number, vista: Phaser.Geom.Rectangle) {
    this.tempo += dt
    const r = REDEMOINHOS[0]
    const cx = r.cx * this.celula
    const cy = r.cy * this.celula
    const R = r.raio * this.celula
    const naVista = cx + R > vista.x && cx - R < vista.right && cy * ACHATAMENTO + R > vista.y && cy * ACHATAMENTO - R < vista.bottom

    this.fitas.clear()
    this.brilho.setVisible(naVista)
    for (const n of this.nevoas) n.img.setVisible(naVista)
    if (!naVista) return

    const garganta = R * 0.13
    const tela = (x: number, y: number, z = 0) => ({ x, y: y * ACHATAMENTO - z * ELEVACAO })

    // Brilho pulsando na garganta.
    const c = tela(cx, cy)
    this.brilho.setPosition(c.x, c.y).setScale((R * 0.9) / 16, (R * 0.9 * ACHATAMENTO) / 16).setAlpha(0.22 + 0.06 * Math.sin(this.tempo * 3))

    // Névoa girando em volta da garganta.
    for (const n of this.nevoas) {
      n.angulo += GIRO * 1.3 * dt
      const raio = R * n.raio
      const p = tela(cx + Math.cos(n.angulo) * raio, cy + Math.sin(n.angulo) * raio, 6 + 4 * Math.sin(this.tempo + n.fase))
      n.img.setPosition(p.x, p.y).setScale(2.4 + 0.6 * Math.sin(this.tempo * 0.7 + n.fase), 1.3).setAlpha(0.1)
    }

    // --- Lâminas d'água subindo da garganta -------------------------------------------
    if (this.laminas.length < 9 && Math.random() < dt * 6) {
      this.laminas.push({ angulo: Math.random() * Math.PI * 2, altura: 30 + Math.random() * 40, vida: 0, duracao: 1.1 + Math.random() * 0.7, abertura: 0.8 + Math.random() * 0.8 })
    }
    for (const l of this.laminas) {
      l.vida += dt
      l.angulo += GIRO * 2.2 * dt
      const f = l.vida / l.duracao
      // Cresce, fica no alto e desaba: a altura segue uma parábola no tempo.
      const subida = Math.sin(Math.PI * Math.min(1, f * 1.1))
      const pontos = []
      for (let k = 0; k <= 8; k++) {
        const s = k / 8
        const raio = garganta * (1 + l.abertura * s)
        const ang = l.angulo + GIRO * s * 1.3
        pontos.push(tela(cx + Math.cos(ang) * raio, cy + Math.sin(ang) * raio, l.altura * subida * Math.sin(Math.PI * s * 0.85)))
      }
      const alfa = 0.35 * Math.sin(Math.PI * f)
      desenharFita(this.fitas, pontos, (t) => 11 * (1 - t) + 1.5, 0x7fd9ff, alfa * 0.6)
      desenharFita(this.fitas, pontos, (t) => 4 * (1 - t) + 0.8, 0xeafcff, alfa)
      // Na queda, a ponta solta gotas.
      if (f > 0.55 && Math.random() < dt * 14) {
        const ponta = pontos[pontos.length - 2]
        this.soltarGota(ponta.x, (ponta.y + l.altura * subida * 0.5 * ELEVACAO) / ACHATAMENTO, l.altura * subida * 0.5, l.angulo)
      }
    }
    this.laminas = this.laminas.filter((l) => l.vida < l.duracao)

    // --- Correntezas na superfície, descendo pela espiral ---------------------------------------
    if (this.correntes.length < 16 && Math.random() < dt * 10) {
      this.correntes.push({ angulo: Math.random() * Math.PI * 2, raio: R * (0.45 + Math.random() * 0.5), vida: 0, duracao: 1.6 + Math.random() * 1.2 })
    }
    for (const co of this.correntes) {
      co.vida += dt
      const perto = 1 - co.raio / R
      co.angulo += (GIRO * (0.5 + 3 * perto * perto) * dt)
      co.raio = Math.max(garganta, co.raio - (15 + 60 * perto) * dt)
      const pontos = []
      for (let k = 0; k <= 7; k++) {
        const ang = co.angulo - GIRO * k * 0.12
        const raio = co.raio * Math.exp(k * 0.05)
        pontos.unshift(tela(cx + Math.cos(ang) * raio, cy + Math.sin(ang) * raio))
      }
      const f = co.vida / co.duracao
      desenharFita(this.fitas, pontos, (t) => 0.6 + 3.2 * Math.sin(Math.PI * t), 0xd6f6ff, 0.3 * Math.sin(Math.PI * f))
    }
    this.correntes = this.correntes.filter((co) => co.vida < co.duracao && co.raio > garganta * 1.05)

    // --- Gotas ---------------------------------------------------------------------------------
    for (const g of this.gotas) {
      g.vida += dt
      g.x += g.vx * dt
      g.y += g.vy * dt
      g.z += g.vz * dt
      g.vz -= 160 * dt
      const p = tela(g.x, g.y, g.z)
      const vTela = { x: g.vx, y: g.vy * ACHATAMENTO - g.vz * ELEVACAO }
      g.img
        .setPosition(p.x, p.y)
        .setRotation(Math.atan2(vTela.y, vTela.x))
        .setScale(0.12 + Math.hypot(vTela.x, vTela.y) * 0.004, 0.07)
        .setAlpha(0.75 * Math.min(1, (0.9 - g.vida) * 3))
    }
    const caiu = this.gotas.filter((g) => g.z < 0 || g.vida > 0.9)
    for (const g of caiu) {
      g.img.setVisible(false)
      this.gotasLivres.push(g.img)
    }
    this.gotas = this.gotas.filter((g) => !caiu.includes(g))
  }

  private soltarGota(x: number, y: number, z: number, angulo: number) {
    const img = this.gotasLivres.pop()
    if (!img) return
    img.setVisible(true)
    const tangente = angulo + (GIRO * Math.PI) / 2
    this.gotas.push({
      img,
      x,
      y,
      z,
      vx: Math.cos(tangente) * 60 + Math.cos(angulo) * 30,
      vy: Math.sin(tangente) * 60 + Math.sin(angulo) * 30,
      vz: 20 + Math.random() * 30,
      vida: 0,
    })
  }
}
