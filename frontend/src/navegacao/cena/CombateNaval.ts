import Phaser from 'phaser'
import type { Mundo, Vetor } from '../mundo/Mundo'
import {
  aplicarDano,
  ARTILHARIA_MARINHA,
  ARTILHARIA_PIRATA,
  criarEstadoCombate,
  dispararSalva,
  fatorVelas,
  podeAbordar,
  recarregar,
  situacaoDaBateria,
  type Disparo,
  type EstadoCombate,
  type Lado,
} from '../sim/combateNaval'
import { criarIA, naZonaSegura, pensar, type EstadoIA } from '../sim/iaPatrulha'
import { criarEstadoViagem, passoNavegacao, type EstadoViagem } from '../sim/navegacao'
import { fisicaDoNavio, NAVIOS, type FisicaNavio, type TipoNavio } from '../sim/navios'
import type { Balanco } from '../sim/ondas'
import type { EstadoVento } from '../sim/vento'
import { CHAVE_PONTO, type Esteira } from './Esteira'
import { desenharFita } from './fita'
import { NavioVisual } from './NavioVisual'
import { projetar } from './projecao'

/**
 * O combate na cena: o navio de patrulha (estado, IA e visual), as balas
 * voando, fumaça, respingos, acertos e as barras de vida. As REGRAS estão em
 * sim/combateNaval.ts e sim/iaPatrulha.ts; aqui é só o que se vê.
 */

type Bala = Disparo & { idade: number; deJogador: boolean; altura: number }
type Fumaca = { img: Phaser.GameObjects.Image; idade: number; duracao: number; x: number; y: number; z: number; vx: number; vy: number; tamanho: number; cor: number }
type Lasca = { x: number; y: number; z: number; vx: number; vy: number; vz: number; idade: number; giro: number; angulo: number; cor: number }
type Coluna = { x: number; y: number; idade: number; altura: number }

const PASSO = 1 / 60

export type InfoCombate = {
  casco: number
  cascoMax: number
  velas: number
  velasMax: number
  baterias: Record<Lado, { situacao: ReturnType<typeof situacaoDaBateria> | 'sem-alvo'; recarga: number; recargaMax: number }>
  alvo: { nome: string; casco: number; cascoMax: number; velas: number; velasMax: number; distancia: number } | null
  inimigoPerto: boolean
  podeAbordar: boolean
}

export class CombateNaval {
  private readonly cena: Phaser.Scene
  private readonly mundo: Mundo
  readonly combateJogador: EstadoCombate
  npc: EstadoViagem | null = null
  private npcVisual: NavioVisual | null = null
  private npcTipo: TipoNavio = 'marinha'
  private npcFisica!: FisicaNavio
  npcCombate: EstadoCombate | null = null
  private ia: EstadoIA
  private reaparecer = 0
  alvoSelecionado = false
  private balas: Bala[] = []
  private fumacas: Fumaca[] = []
  private readonly fumacaLivre: Phaser.GameObjects.Image[] = []
  private lascas: Lasca[] = []
  private colunas: Coluna[] = []
  private readonly g: Phaser.GameObjects.Graphics
  private readonly gPlano: Phaser.GameObjects.Graphics
  private readonly nome: Phaser.GameObjects.Text
  private acumulador = 0
  private readonly centroPatrulha: Vetor

  constructor(cena: Phaser.Scene, mundo: Mundo, plano: Phaser.GameObjects.Container, tipoJogador: TipoNavio) {
    this.cena = cena
    this.mundo = mundo
    this.combateJogador = criarEstadoCombate(tipoJogador === 'pirata' ? ARTILHARIA_PIRATA : ARTILHARIA_MARINHA, 1000, 600)
    this.g = cena.add.graphics().setDepth(6)
    this.gPlano = cena.add.graphics()
    plano.add(this.gPlano)
    this.nome = cena.add
      .text(0, 0, '', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '14px', fontStyle: 'bold', color: '#ffd9d2', stroke: '#1b0b09', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setDepth(6)
      .setResolution(2)
    for (let i = 0; i < 90; i++) this.fumacaLivre.push(cena.add.image(0, 0, CHAVE_PONTO).setVisible(false).setDepth(5))
    // Área de patrulha: entre a Ilha Dawn e Shells Town, em mar aberto.
    this.centroPatrulha = { x: 172 * mundo.celula, y: 42 * mundo.celula }
    this.ia = criarIA(this.centroPatrulha, 14 * mundo.celula)
    this.definirTipoJogador(tipoJogador)
    this.criarNpc()
  }

  /** O inimigo é sempre do outro lado: pirata caça marinha e vice-versa. */
  definirTipoJogador(tipo: TipoNavio) {
    this.combateJogador.artilharia = tipo === 'pirata' ? ARTILHARIA_PIRATA : ARTILHARIA_MARINHA
    const tipoNpc: TipoNavio = tipo === 'pirata' ? 'marinha' : 'pirata'
    if (tipoNpc !== this.npcTipo && this.npc) {
      this.npcTipo = tipoNpc
      this.npcVisual?.destruir()
      this.npcVisual = new NavioVisual(this.cena, tipoNpc, 21)
    }
    this.npcTipo = tipoNpc
  }

  private criarNpc() {
    let ponto = this.centroPatrulha
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 10 * this.mundo.celula
      const p = { x: this.centroPatrulha.x + Math.cos(a) * r, y: this.centroPatrulha.y + Math.sin(a) * r }
      if (this.mundo.navegavel(p) && this.mundo.folgaEm(p) > 2) {
        ponto = p
        break
      }
    }
    this.npc = criarEstadoViagem(ponto, Math.random() * Math.PI * 2)
    this.npcFisica = fisicaDoNavio(NAVIOS[this.npcTipo].atributos)
    this.npcCombate = criarEstadoCombate(this.npcTipo === 'marinha' ? ARTILHARIA_MARINHA : ARTILHARIA_PIRATA, 900, 550)
    this.npcVisual?.destruir()
    this.npcVisual = new NavioVisual(this.cena, this.npcTipo, 21)
    this.ia = criarIA(this.centroPatrulha, 14 * this.mundo.celula)
    this.alvoSelecionado = false
  }

  get nomeNpc() {
    return this.npcTipo === 'marinha' ? 'Patrulha da Marinha' : 'Piratas Saqueadores'
  }

  /**
   * Clique no navio inimigo liga/desliga a exibição da área de ataque (arcos
   * e alcance das baterias). Não é preciso para atirar: Q/E miram sozinhos.
   */
  tentarSelecionar(p: Vetor) {
    if (!this.npc || this.npc.naufragio !== null) return false
    if (Math.hypot(p.x - this.npc.posicao.x, p.y - this.npc.posicao.y) > 70) return false
    this.alvoSelecionado = !this.alvoSelecionado
    return true
  }

  /** Disparo do jogador. Devolve o motivo se não saiu. */
  disparar(jogador: EstadoViagem, lado: Lado, meioComprimento: number, tempestade: number) {
    if (!this.npc || this.npc.naufragio !== null || jogador.naufragio !== null) return 'sem-alvo'
    if (naZonaSegura(this.mundo, jogador.posicao) || naZonaSegura(this.mundo, this.npc.posicao)) return 'zona-segura'
    const situacao = situacaoDaBateria(jogador, this.combateJogador, lado, this.npc.posicao)
    if (situacao !== 'pronta') return situacao
    this.lancar(dispararSalva(jogador, this.combateJogador, lado, this.npc, meioComprimento, tempestade), true, lado, jogador)
    return 'ok'
  }

  private lancar(disparos: Disparo[], deJogador: boolean, lado: Lado, atirador: EstadoViagem) {
    for (const d of disparos) {
      const distancia = Math.hypot(d.destino.x - d.origem.x, d.destino.y - d.origem.y)
      this.balas.push({ ...d, idade: -d.atraso, deJogador, altura: 30 + distancia * 0.12 })
    }
    // Fumaça saindo do costado inteiro, empurrada para fora.
    const saida = atirador.rumo + (lado === 'boreste' ? Math.PI / 2 : -Math.PI / 2)
    for (const d of disparos) {
      for (let i = 0; i < 3; i++) {
        this.fumaca(d.origem.x, d.origem.y, 10, Math.cos(saida) * (25 + Math.random() * 30), Math.sin(saida) * (25 + Math.random() * 30), 1.4 + Math.random() * 0.8, 0.9 + Math.random() * 0.6, 0xd8d8d4)
      }
      this.fumaca(d.origem.x, d.origem.y, 10, Math.cos(saida) * 60, Math.sin(saida) * 60, 0.15, 0.6, 0xffc861)
    }
    this.cena.cameras.main.shake(160, deJogador ? 0.0015 : 0.001)
  }

  private fumaca(x: number, y: number, z: number, vx: number, vy: number, duracao: number, tamanho: number, cor: number) {
    const img = this.fumacaLivre.pop()
    if (!img) return
    img.setVisible(true).setTint(cor).setBlendMode(cor === 0xffc861 ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
    this.fumacas.push({ img, idade: 0, duracao, x, y, z, vx, vy, tamanho, cor })
  }

  /** Um passo do combate (IA, balas, dano). */
  atualizar(
    dt: number,
    jogador: EstadoViagem,
    vento: EstadoVento,
    tempestade: number,
    esteira: Esteira,
  ): { jogadorAfundou: boolean; inimigoAfundou: boolean } {
    recarregar(this.combateJogador, dt)
    let jogadorAfundou = false
    let inimigoAfundou = false

    if (!this.npc) {
      this.reaparecer -= dt
      if (this.reaparecer <= 0) this.criarNpc()
    } else if (this.npcCombate) {
      const npc = this.npc
      const combate = this.npcCombate
      recarregar(combate, dt)
      if (npc.naufragio === null) {
        pensar(this.mundo, this.ia, npc, combate, jogador, dt)
        // Dispara sempre que o jogador entra no arco de um dos lados.
        if (this.ia.modo === 'combate' && jogador.naufragio === null && !naZonaSegura(this.mundo, jogador.posicao)) {
          for (const lado of ['bombordo', 'boreste'] as Lado[]) {
            if (situacaoDaBateria(npc, combate, lado, jogador.posicao) === 'pronta') {
              this.lancar(dispararSalva(npc, combate, lado, jogador, this.npcVisual!.meioComprimento, tempestade), false, lado, npc)
              break
            }
          }
        }
      }
      // Física no mesmo passo fixo do jogador, com velas rasgadas freando.
      const fisica = { ...this.npcFisica, velocidadeMax: this.npcFisica.velocidadeMax * fatorVelas(combate) }
      this.acumulador += dt
      while (this.acumulador >= PASSO) {
        this.acumulador -= PASSO
        passoNavegacao(this.mundo, npc, fisica, vento, PASSO)
      }
      if (npc.naufragio !== null && npc.naufragio > 5.5) {
        this.removerNpc(40)
      }
    }

    // --- Balas -------------------------------------------------------------------
    for (const b of this.balas) b.idade += dt
    const chegaram = this.balas.filter((b) => b.idade >= b.voo)
    for (const b of chegaram) {
      if (b.acerta) {
        const alvo = b.deJogador ? this.npcCombate : this.combateJogador
        const estadoAlvo = b.deJogador ? this.npc : jogador
        if (alvo && estadoAlvo && estadoAlvo.naufragio === null) {
          aplicarDano(alvo, b.dano)
          this.acerto(b.destino)
          if (alvo.casco <= 0) {
            estadoAlvo.naufragio = 0
            estadoAlvo.rota = null
            if (b.deJogador) inimigoAfundou = true
            else jogadorAfundou = true
          }
        }
      } else {
        this.colunas.push({ x: b.destino.x, y: b.destino.y, idade: 0, altura: 26 + Math.random() * 14 })
        esteira.respingo(b.destino, 16, 0.9)
      }
    }
    this.balas = this.balas.filter((b) => b.idade < b.voo)

    this.atualizarEfeitos(dt)
    this.desenhar(jogador)
    return { jogadorAfundou, inimigoAfundou }
  }

  private acerto(p: Vetor) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 30 + Math.random() * 60
      this.lascas.push({ x: p.x, y: p.y, z: 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 40 + Math.random() * 60, idade: 0, giro: (Math.random() - 0.5) * 16, angulo: a, cor: Math.random() < 0.5 ? 0x9a6232 : 0x6e4222 })
    }
    for (let i = 0; i < 4; i++) this.fumaca(p.x, p.y, 12, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 1.8, 1.1, 0x4a4540)
    this.fumaca(p.x, p.y, 12, 0, 0, 0.25, 1.4, 0xff9a3c)
  }

  private atualizarEfeitos(dt: number) {
    for (const f of this.fumacas) {
      f.idade += dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.z += 14 * dt
      f.vx *= Math.exp(-1.5 * dt)
      f.vy *= Math.exp(-1.5 * dt)
      const t = f.idade / f.duracao
      const p = projetar(f.x, f.y, f.z)
      const escala = f.tamanho * (0.4 + t * 1.3)
      f.img.setPosition(p.x, p.y).setScale(escala, escala * 0.8).setAlpha((f.cor === 0xffc861 || f.cor === 0xff9a3c ? 0.9 : 0.55) * (1 - t))
    }
    const acabou = this.fumacas.filter((f) => f.idade >= f.duracao)
    for (const f of acabou) {
      f.img.setVisible(false)
      this.fumacaLivre.push(f.img)
    }
    this.fumacas = this.fumacas.filter((f) => f.idade < f.duracao)

    for (const l of this.lascas) {
      l.idade += dt
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.z = Math.max(0, l.z + l.vz * dt)
      l.vz -= 150 * dt
      if (l.z === 0) {
        l.vx *= Math.exp(-3 * dt)
        l.vy *= Math.exp(-3 * dt)
      }
      l.angulo += l.giro * dt
    }
    this.lascas = this.lascas.filter((l) => l.idade < 3)
    for (const c of this.colunas) c.idade += dt
    this.colunas = this.colunas.filter((c) => c.idade < 1.1)
  }

  private desenhar(jogador: EstadoViagem) {
    const g = this.g
    const gp = this.gPlano
    g.clear()
    gp.clear()

    // Balas: bola escura em arco, com sombra na água.
    for (const b of this.balas) {
      if (b.idade < 0) continue
      const t = b.idade / b.voo
      const x = b.origem.x + (b.destino.x - b.origem.x) * t
      const y = b.origem.y + (b.destino.y - b.origem.y) * t
      const z = 12 + 4 * b.altura * t * (1 - t)
      gp.fillStyle(0x000000, 0.25)
      gp.fillCircle(x, y, 2.4)
      const p = projetar(x, y, z)
      g.fillStyle(0x1b1b1f, 1)
      g.fillCircle(p.x, p.y, 2.8)
      g.fillStyle(0x6b6b70, 1)
      g.fillCircle(p.x - 0.8, p.y - 0.8, 1)
    }

    // Colunas d'água das balas que erraram: sobem, abrem e desabam.
    for (const c of this.colunas) {
      const t = c.idade / 1.1
      const sobe = Math.sin(Math.PI * Math.min(1, t * 1.4))
      const base = projetar(c.x, c.y)
      for (const [dx, largura] of [[-4, 5], [0, 7], [4, 5]] as const) {
        const topo = { x: base.x + dx * (1 + t * 2), y: base.y - c.altura * sobe * (dx === 0 ? 1 : 0.7) }
        desenharFita(g, [base, { x: (base.x + topo.x) / 2 + dx * 0.5, y: (base.y + topo.y) / 2 }, topo], (s) => largura * (1 - s * 0.7), 0xeaf8ff, 0.75 * (1 - t))
      }
      gp.lineStyle(1.5, 0xffffff, 0.6 * (1 - t))
      gp.strokeEllipse(c.x, c.y, 10 + t * 40, 10 + t * 40)
    }

    // Lascas de madeira.
    for (const l of this.lascas) {
      const a = projetar(l.x - Math.cos(l.angulo) * 3, l.y - Math.sin(l.angulo) * 3, l.z)
      const b = projetar(l.x + Math.cos(l.angulo) * 3, l.y + Math.sin(l.angulo) * 3, l.z)
      g.lineStyle(2, l.cor, Math.min(1, (3 - l.idade) * 2))
      g.lineBetween(a.x, a.y, b.x, b.y)
    }

    // Navio inimigo: anel de alvo, barra de vida e nome.
    const npc = this.npc
    if (npc && this.npcCombate && npc.naufragio === null) {
      if (this.alvoSelecionado) {
        const pulso = 1 + Math.sin(this.cena.time.now * 0.006) * 0.06
        gp.lineStyle(2, 0xff5a4a, 0.85)
        gp.strokeEllipse(npc.posicao.x, npc.posicao.y, 130 * pulso, 130 * pulso)
        gp.lineStyle(1, 0xff5a4a, 0.4)
        gp.strokeEllipse(npc.posicao.x, npc.posicao.y, 150 * pulso, 150 * pulso)
      }
      const topo = projetar(npc.posicao.x, npc.posicao.y, 105)
      const w = 70
      const casco = this.npcCombate.casco / this.npcCombate.cascoMax
      const velas = this.npcCombate.velas / this.npcCombate.velasMax
      g.fillStyle(0x0b0f16, 0.75)
      g.fillRect(topo.x - w / 2 - 2, topo.y - 2, w + 4, 11)
      g.fillStyle(0xc1453f, 1)
      g.fillRect(topo.x - w / 2, topo.y, w * casco, 5)
      g.fillStyle(0xe9e0c8, 0.9)
      g.fillRect(topo.x - w / 2, topo.y + 6, w * velas, 2)
      this.nome.setText(this.nomeNpc).setPosition(topo.x, topo.y - 3).setVisible(true)
    } else {
      this.nome.setVisible(false)
    }

    // Arcos de tiro do jogador (leves), quando há alvo selecionado.
    if (this.alvoSelecionado && npc && npc.naufragio === null && jogador.naufragio === null) {
      const art = this.combateJogador.artilharia
      for (const lado of ['bombordo', 'boreste'] as Lado[]) {
        const pronto = situacaoDaBateria(jogador, this.combateJogador, lado, npc.posicao) === 'pronta'
        const dir = jogador.rumo + (lado === 'boreste' ? Math.PI / 2 : -Math.PI / 2)
        gp.fillStyle(pronto ? 0xffd66b : 0xffffff, pronto ? 0.12 : 0.04)
        gp.slice(jogador.posicao.x, jogador.posicao.y, art.alcance, dir - art.arco, dir + art.arco, false)
        gp.fillPath()
      }
    }
  }

  /** Visual do navio inimigo (chamado junto com o do jogador). */
  atualizarVisualNpc(vento: EstadoVento, balanco: (e: EstadoViagem, meioC: number, meiaL: number) => Balanco, tempo: number, dt: number, alturaMar: (x: number, y: number) => number) {
    if (!this.npc || !this.npcVisual) return
    const v = this.npcVisual
    v.atualizar(this.npc, this.npcFisica, vento, balanco(this.npc, v.meioComprimento, v.meiaLargura), tempo, dt, alturaMar)
  }

  entradaEsteiraNpc() {
    const npc = this.npc
    const v = this.npcVisual
    if (!npc || !v || npc.naufragio !== null) return null
    return {
      popa: v.pontoDaPopa(npc),
      proa: v.pontoDaProa(npc),
      centro: npc.posicao,
      rumo: npc.rumo,
      razao: Math.min(1, npc.velocidade / this.npcFisica.velocidadeMax),
      meiaLargura: v.meiaLargura,
      meioComprimento: v.meioComprimento,
    }
  }

  removerNpc(reaparecerEm: number) {
    this.npcVisual?.destruir()
    this.npcVisual = null
    this.npc = null
    this.npcCombate = null
    this.alvoSelecionado = false
    this.reaparecer = reaparecerEm
  }

  info(jogador: EstadoViagem): InfoCombate {
    const npc = this.npc
    const baterias = {} as InfoCombate['baterias']
    for (const lado of ['bombordo', 'boreste'] as Lado[]) {
      baterias[lado] = {
        situacao: npc && npc.naufragio === null ? situacaoDaBateria(jogador, this.combateJogador, lado, npc.posicao) : 'sem-alvo',
        recarga: this.combateJogador.recarga[lado],
        recargaMax: this.combateJogador.artilharia.recarga,
      }
    }
    const distancia = npc ? Math.hypot(npc.posicao.x - jogador.posicao.x, npc.posicao.y - jogador.posicao.y) : Infinity
    return {
      casco: this.combateJogador.casco,
      cascoMax: this.combateJogador.cascoMax,
      velas: this.combateJogador.velas,
      velasMax: this.combateJogador.velasMax,
      baterias,
      alvo:
        npc && this.npcCombate && npc.naufragio === null && (this.alvoSelecionado || distancia < 700)
          ? { nome: this.nomeNpc, casco: this.npcCombate.casco, cascoMax: this.npcCombate.cascoMax, velas: this.npcCombate.velas, velasMax: this.npcCombate.velasMax, distancia }
          : null,
      inimigoPerto: distancia < 700,
      podeAbordar: !!(npc && this.npcCombate && npc.naufragio === null && jogador.naufragio === null && podeAbordar(jogador, npc, this.npcCombate)),
    }
  }

  /** Depois de afundar ou reaparecer, o jogador volta com o navio reparado. */
  repararJogador() {
    this.combateJogador.casco = this.combateJogador.cascoMax
    this.combateJogador.velas = this.combateJogador.velasMax
  }
}

