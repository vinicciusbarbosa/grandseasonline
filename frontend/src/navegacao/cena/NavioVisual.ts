import Phaser from 'phaser'
import type { EstadoViagem } from '../sim/navegacao'
import type { FisicaNavio, TipoNavio } from '../sim/navios'
import type { Balanco } from '../sim/ondas'
import { diferencaAngular, ruidoSuave } from '../sim/ruido'
import type { EstadoVento } from '../sim/vento'
import { ACHATAMENTO, ELEVACAO } from './projecao'

/**
 * O navio em 3D, desenhado a cada quadro num Graphics, no estilo cartum da
 * referência: casco de madeira com amurada grossa, castelo de popa com leme,
 * canhões de bronze nas portinholas, caixotes e barris no convés, três
 * mastros com cesto de gávea, velas entre vergas e cordame.
 *
 * O modelo mora em coordenadas locais (x = proa, y = boreste, z = cima). Cada
 * ponto passa por rolagem → arfagem → rumo → subida da onda → projeção
 * inclinada. Os objetos do convés são desenhados do fundo para a frente
 * (ordenados pela profundidade na tela), então a mesma geometria funciona
 * em qualquer rumo.
 */

type Paleta = {
  cascoBaixo: number
  casco: number
  faixa: number | null
  amurada: number
  deck: number
  tabuas: number
  contorno: number
  friso: number
  mastro: number
  vela: number
  velaBrilho: number
  bandeira: number
  janela: number
}

type Mastro = {
  /** Posição ao longo do casco (0 = popa, 1 = proa). */
  s: number
  altura: number
  cesto: number | null
  /** Velas: [largura, z de baixo, z de cima]. */
  velas: [number, number, number][]
  bandeira: boolean
}

type Projeto = {
  comprimento: number
  meiaLargura: number
  alturaDeck: number
  /** Onde termina o castelo de popa (0–1 do comprimento). */
  castelo: number
  alturaCastelo: number
  canhoes: number[]
  mastros: Mastro[]
  paleta: Paleta
}

const D = 11
const Q = 9

export const PROJETOS: Record<TipoNavio, Projeto> = {
  pirata: {
    comprimento: 100,
    meiaLargura: 20,
    alturaDeck: D,
    castelo: 0.27,
    alturaCastelo: Q,
    canhoes: [0.36, 0.47, 0.58, 0.69],
    mastros: [
      { s: 0.74, altura: 74, cesto: 52, velas: [[42, D + 15, 49]], bandeira: true },
      { s: 0.5, altura: 96, cesto: 64, velas: [[54, D + 14, 61], [38, 71, 91]], bandeira: false },
      { s: 0.15, altura: 78, cesto: null, velas: [[40, D + Q + 12, 72]], bandeira: false },
    ],
    paleta: {
      cascoBaixo: 0x3f2413,
      casco: 0x6e4222,
      faixa: null,
      amurada: 0xb0703a,
      deck: 0xd99a4e,
      tabuas: 0xa8682d,
      contorno: 0x2a170b,
      friso: 0xd9a441,
      mastro: 0x4a2c17,
      vela: 0x1f2428,
      velaBrilho: 0x4a5359,
      bandeira: 0x121416,
      janela: 0xf2d24a,
    },
  },
  marinha: {
    comprimento: 110,
    meiaLargura: 21,
    alturaDeck: D + 1,
    castelo: 0.27,
    alturaCastelo: Q,
    canhoes: [0.32, 0.42, 0.52, 0.62, 0.72],
    mastros: [
      { s: 0.74, altura: 78, cesto: 54, velas: [[44, D + 16, 51]], bandeira: true },
      { s: 0.5, altura: 100, cesto: 66, velas: [[56, D + 15, 63], [40, 73, 95]], bandeira: false },
      { s: 0.15, altura: 80, cesto: null, velas: [[42, D + Q + 13, 74]], bandeira: false },
    ],
    paleta: {
      cascoBaixo: 0x14264a,
      casco: 0x1e3a6b,
      faixa: 0xeef2f7,
      amurada: 0xeef2f7,
      deck: 0xd2b184,
      tabuas: 0xa98553,
      contorno: 0x0e1a33,
      friso: 0xc9a227,
      mastro: 0x3b2a1c,
      vela: 0xf1f4f7,
      velaBrilho: 0xffffff,
      bandeira: 0x2c5aa0,
      janela: 0xf2d24a,
    },
  },
}

type P3 = { x: number; y: number; z: number }
type P2 = { x: number; y: number; profundidade: number }

const PASSOS_CASCO = 22

/** Meia-largura do casco em `s` (0 popa, 1 proa): popa larga, bojo no meio, proa redonda. */
function meiaLarguraEm(projeto: Projeto, s: number) {
  const w = projeto.meiaLargura
  if (s < 0.55) return w * (0.74 + 0.26 * Math.sin((s / 0.55) * (Math.PI / 2)))
  return w * Math.pow(Math.max(0, Math.cos(((s - 0.55) / 0.45) * (Math.PI / 2))), 0.6)
}

function xDe(projeto: Projeto, s: number) {
  return -projeto.comprimento / 2 + s * projeto.comprimento
}

/** Contorno do casco em `z`, entre s0 e s1, com `escala` na largura e recuo `encolher`. */
function contorno(projeto: Projeto, z: number, escala = 1, encolher = 0, s0 = 0, s1 = 1): P3[] {
  const pts: P3[] = []
  const n = Math.max(2, Math.round(PASSOS_CASCO * (s1 - s0)))
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n
    pts.push({ x: xDe(projeto, s), y: -Math.max(0, meiaLarguraEm(projeto, s) * escala - encolher), z })
  }
  for (let i = n; i >= 0; i--) {
    const s = s0 + ((s1 - s0) * i) / n
    pts.push({ x: xDe(projeto, s), y: Math.max(0, meiaLarguraEm(projeto, s) * escala - encolher), z })
  }
  return pts
}

function misturar(a: number, b: number, t: number) {
  const ca = Phaser.Display.Color.IntegerToColor(a)
  const cb = Phaser.Display.Color.IntegerToColor(b)
  const k = Math.max(0, Math.min(1, t))
  return Phaser.Display.Color.GetColor(
    ca.red + (cb.red - ca.red) * k,
    ca.green + (cb.green - ca.green) * k,
    ca.blue + (cb.blue - ca.blue) * k,
  )
}

const escurecer = (c: number, t: number) => misturar(c, 0x000000, t)
const clarear = (c: number, t: number) => misturar(c, 0xffffff, t)

export class NavioVisual {
  private readonly g: Phaser.GameObjects.Graphics
  private readonly projeto: Projeto
  readonly tipo: TipoNavio
  readonly meioComprimento: number
  readonly meiaLargura: number
  private readonly semente: number

  // Transformação do quadro atual.
  private cx = 0
  private cy = 0
  private cosR = 1
  private sinR = 0
  private cosRol = 1
  private sinRol = 0
  private cosArf = 1
  private sinArf = 0
  private altura = 0

  constructor(cena: Phaser.Scene, tipo: TipoNavio, semente: number) {
    this.tipo = tipo
    this.semente = semente
    this.projeto = PROJETOS[tipo]
    this.meioComprimento = this.projeto.comprimento / 2
    this.meiaLargura = this.projeto.meiaLargura
    this.g = cena.add.graphics().setDepth(3)
  }

  // ---- Geometria -----------------------------------------------------------------

  /** Local → tela, com o balanço e o rumo do quadro atual. */
  private projetar(l: P3, semOnda = false): P2 {
    const y1 = l.y * this.cosRol - l.z * this.sinRol
    const z1 = l.y * this.sinRol + l.z * this.cosRol
    const x2 = l.x * this.cosArf - z1 * this.sinArf
    const z2 = l.x * this.sinArf + z1 * this.cosArf
    const wx = this.cx + x2 * this.cosR - y1 * this.sinR
    const wy = this.cy + x2 * this.sinR + y1 * this.cosR
    const z = semOnda ? 0 : z2 + this.altura
    return { x: wx, y: wy * ACHATAMENTO - z * ELEVACAO, profundidade: wy }
  }

  /** Profundidade (y do mundo) de um ponto local no plano do convés. */
  private profundidadeDe(x: number, y: number) {
    return this.cy + x * this.sinR + y * this.cosR
  }

  /** Uma direção local (no plano) vista pela câmera: quanto aponta para ela (y+ do mundo). */
  private voltadoParaCamera(nx: number, ny: number) {
    return nx * this.sinR + ny * this.cosR
  }

  private caminho(pontos: P3[], semOnda = false) {
    this.g.beginPath()
    pontos.forEach((l, i) => {
      const s = this.projetar(l, semOnda)
      if (i === 0) this.g.moveTo(s.x, s.y)
      else this.g.lineTo(s.x, s.y)
    })
  }

  private preencher(pontos: P3[], cor: number, alfa = 1, semOnda = false) {
    this.g.fillStyle(cor, alfa)
    this.caminho(pontos, semOnda)
    this.g.closePath()
    this.g.fillPath()
  }

  private tracar(pontos: P3[], largura: number, cor: number, alfa = 1, fechar = true, semOnda = false) {
    this.g.lineStyle(largura, cor, alfa)
    this.caminho(pontos, semOnda)
    if (fechar) this.g.closePath()
    this.g.strokePath()
  }

  private linha(a: P3, b: P3, largura: number, cor: number, alfa = 1) {
    const pa = this.projetar(a)
    const pb = this.projetar(b)
    this.g.lineStyle(largura, cor, alfa)
    this.g.lineBetween(pa.x, pa.y, pb.x, pb.y)
  }

  /** Caixa (caixote, castelo): faces viradas para a câmera e o tampo. */
  private caixa(x: number, y: number, z: number, cx: number, cy: number, altura: number, cor: number, contorno: number) {
    const c = [
      { x: x - cx, y: y - cy },
      { x: x + cx, y: y - cy },
      { x: x + cx, y: y + cy },
      { x: x - cx, y: y + cy },
    ]
    const faces = [
      { a: 0, b: 1, n: [0, -1] },
      { a: 1, b: 2, n: [1, 0] },
      { a: 2, b: 3, n: [0, 1] },
      { a: 3, b: 0, n: [-1, 0] },
    ]
    for (const f of faces) {
      const frente = this.voltadoParaCamera(f.n[0], f.n[1])
      if (frente <= 0) continue
      const pa = c[f.a]
      const pb = c[f.b]
      const face = [
        { ...pa, z },
        { ...pb, z },
        { ...pb, z: z + altura },
        { ...pa, z: z + altura },
      ]
      // Face de frente mais clara, lateral mais escura.
      const luz = 0.62 + 0.3 * frente + 0.08 * this.voltadoParaCamera(f.n[1], -f.n[0])
      this.preencher(face, escurecer(cor, 1 - luz))
      this.tracar(face, 0.8, contorno, 0.7)
    }
    const tampo = c.map((p) => ({ ...p, z: z + altura }))
    this.preencher(tampo, clarear(cor, 0.12))
    this.tracar(tampo, 0.8, contorno, 0.8)
  }

  /** Cilindro vertical (barril, cesto, base de mastro). */
  private cilindro(x: number, y: number, z: number, raio: number, altura: number, cor: number, aros: number, raioTopo = raio) {
    const base = this.projetar({ x, y, z })
    const topo = this.projetar({ x, y, z: z + altura })
    const g = this.g
    const achatado = ACHATAMENTO * 0.55
    g.fillStyle(escurecer(cor, 0.25), 1)
    g.fillEllipse(base.x, base.y, raio * 2, raio * 2 * achatado)
    g.fillStyle(cor, 1)
    g.beginPath()
    g.moveTo(base.x - raio, base.y)
    g.lineTo(topo.x - raioTopo, topo.y)
    g.lineTo(topo.x + raioTopo, topo.y)
    g.lineTo(base.x + raio, base.y)
    g.closePath()
    g.fillPath()
    // Brilho vertical à esquerda (luz do noroeste).
    g.lineStyle(raio * 0.5, clarear(cor, 0.25), 0.55)
    g.lineBetween(base.x - raio * 0.45, base.y, topo.x - raioTopo * 0.45, topo.y)
    // Aros.
    for (let i = 1; i <= aros; i++) {
      const t = i / (aros + 1)
      const yy = base.y + (topo.y - base.y) * t
      const r = raio + (raioTopo - raio) * t
      g.lineStyle(1, escurecer(cor, 0.55), 0.9)
      g.beginPath()
      g.arc(base.x + (topo.x - base.x) * t, yy, r, 0.05 * Math.PI, 0.95 * Math.PI, false)
      g.strokePath()
    }
    g.fillStyle(clarear(cor, 0.1), 1)
    g.fillEllipse(topo.x, topo.y, raioTopo * 2, raioTopo * 2 * achatado)
    g.lineStyle(1, escurecer(cor, 0.5), 0.9)
    g.strokeEllipse(topo.x, topo.y, raioTopo * 2, raioTopo * 2 * achatado)
  }

  // ---- Quadro ----------------------------------------------------------------------

  atualizar(estado: EstadoViagem, fisica: FisicaNavio, vento: EstadoVento, balanco: Balanco, tempo: number) {
    const p = this.projeto
    this.g.clear()

    const razao = Math.min(1, estado.velocidade / fisica.velocidadeMax)
    // Nas curvas o navio aderna para fora; mais solto, mais aderna.
    const adernar = -estado.giroAtual * (0.12 + fisica.sensibilidadeOnda * 0.08) * (0.3 + razao)
    const rolagem = balanco.rolagem + adernar
    const arfagem = balanco.arfagem + razao * 0.03

    this.cx = estado.posicao.x
    this.cy = estado.posicao.y
    this.cosR = Math.cos(estado.rumo)
    this.sinR = Math.sin(estado.rumo)
    this.cosRol = Math.cos(rolagem)
    this.sinRol = Math.sin(rolagem)
    this.cosArf = Math.cos(arfagem)
    this.sinArf = Math.sin(arfagem)
    this.altura = balanco.altura
    this.g.setDepth(3 + this.cy * 1e-5)

    this.desenharAguaEmVolta(razao, tempo)
    this.desenharCasco()

    // Objetos sobre o convés, do fundo para a frente.
    const objetos: { profundidade: number; desenhar: () => void }[] = []
    const xCastelo = xDe(p, p.castelo / 2)
    objetos.push({ profundidade: this.profundidadeDe(xCastelo, 0), desenhar: () => this.desenharCastelo() })

    for (const item of this.itensDoConves()) objetos.push(item)

    const relativo = diferencaAngular(estado.rumo, vento.direcao)
    const alinhamento = Math.cos(relativo)
    const regulagem = Phaser.Math.Clamp(relativo * 0.45, -0.6, 0.6)
    let enchimento = (0.35 + 0.65 * vento.intensidade) * (0.45 + 0.55 * Math.abs(alinhamento))
    // Vento de proa: pano panejando, barriga para trás.
    if (alinhamento < -0.3) enchimento *= -0.55
    const tremor = ruidoSuave(tempo * 7, this.semente) * 0.12 * (1.2 - vento.intensidade)

    for (const m of p.mastros) {
      const x = xDe(p, m.s)
      objetos.push({
        profundidade: this.profundidadeDe(x, 0),
        desenhar: () => this.desenharMastro(m, x, regulagem, (enchimento + tremor) * 7, vento, estado.rumo, tempo),
      })
    }

    objetos.sort((a, b) => a.profundidade - b.profundidade)
    for (const o of objetos) o.desenhar()

    this.desenharCordame()
  }

  /** Halo turquesa, espuma no costado e onda de proa. */
  private desenharAguaEmVolta(razao: number, tempo: number) {
    const p = this.projeto
    // Halo: a água clareia em volta do casco, como na referência.
    this.preencher(contorno(p, 0, 1.55).map((l) => ({ ...l, x: l.x * 1.12 })), 0x7fe7e0, 0.14, true)
    // Sombra do casco na água.
    this.preencher(contorno(p, 0, 1.05).map((l) => ({ ...l, x: l.x + 3, y: l.y + 5 })), 0x001018, 0.25, true)

    // Colar de espuma na linha d'água, que pulsa com a água batendo.
    const pulso = 0.5 + 0.5 * Math.sin(tempo * 3.1 + this.semente)
    this.tracar(contorno(p, 0.5, 1.07), 2.2 + pulso, 0xffffff, 0.35 + 0.35 * razao)

    // Onda de proa: dois bigodes brancos que abrem para trás com a velocidade.
    if (razao > 0.05) {
      for (const lado of [-1, 1]) {
        const pts: P3[] = []
        for (let i = 0; i <= 10; i++) {
          const s = 1 - i * 0.05
          const abre = 1.5 + (1 - s) * (4 + 14 * razao)
          pts.push({ x: xDe(p, s) + 2, y: lado * (meiaLarguraEm(p, s) + abre), z: 0 })
        }
        this.tracar(pts, 2.6 * razao + 1, 0xffffff, 0.3 + 0.5 * razao, false)
      }
    }
  }

  private desenharCasco() {
    const p = this.projeto
    const pal = p.paleta
    const topoAmurada = p.alturaDeck + 3

    // Costado em camadas: madeira escura embaixo, clareando em cima.
    const camadas = 9
    for (let i = 0; i <= camadas; i++) {
      const f = i / camadas
      const z = f * topoAmurada
      let cor = misturar(pal.cascoBaixo, pal.casco, f)
      if (pal.faixa !== null && f > 0.62) cor = pal.faixa
      this.preencher(contorno(p, z, 0.8 + 0.2 * Math.min(1, f * 1.3)), cor)
      // Tábuas do costado: uma linha escura a cada camada.
      if (i > 0 && i < camadas) this.tracar(contorno(p, z, 0.8 + 0.2 * Math.min(1, f * 1.3)), 0.6, pal.contorno, 0.28)
    }

    // Enfeites em espiral no costado (proa e popa), do lado visível.
    const ladoVisivel = this.cosR >= 0 ? 1 : -1
    for (const s of [0.86, 0.2]) {
      const c = this.projetar({ x: xDe(p, s), y: ladoVisivel * (meiaLarguraEm(p, s) + 0.4), z: p.alturaDeck - 1 })
      this.g.lineStyle(2, pal.amurada, 1)
      this.g.strokeEllipse(c.x, c.y, 7, 7 * ACHATAMENTO)
      this.g.lineStyle(1.2, pal.contorno, 0.8)
      this.g.strokeEllipse(c.x, c.y, 3.5, 3.5 * ACHATAMENTO)
    }

    // Portinholas com canhões de bronze no costado visível.
    for (const s of p.canhoes) {
      const x = xDe(p, s)
      const y = ladoVisivel * (meiaLarguraEm(p, s) + 0.3)
      const z = p.alturaDeck - 4
      const quadro = [
        { x: x - 3.2, y, z: z - 2.8 },
        { x: x + 3.2, y, z: z - 2.8 },
        { x: x + 3.2, y, z: z + 2.8 },
        { x: x - 3.2, y, z: z + 2.8 },
      ]
      this.preencher(quadro, 0x1a0e06)
      this.tracar(quadro, 1, pal.amurada, 0.9)
      const boca = this.projetar({ x, y: y + ladoVisivel * 3.5, z })
      this.g.fillStyle(0xb8862e, 1)
      this.g.fillEllipse(boca.x, boca.y, 5.2, 4.6)
      this.g.fillStyle(0xe6c071, 1)
      this.g.fillEllipse(boca.x - 0.8, boca.y - 0.8, 2.2, 1.8)
      this.g.fillStyle(0x120b05, 1)
      this.g.fillEllipse(boca.x, boca.y, 2.4, 2.1)
    }

    // Convés com tábuas.
    const conves = contorno(p, p.alturaDeck + 0.3, 1, 3.2, p.castelo * 0.9, 1)
    this.preencher(conves, pal.deck)
    for (let faixa = -3; faixa <= 3; faixa++) {
      const y = faixa * (p.meiaLargura * 0.24)
      let x0: number | null = null
      let x1 = 0
      for (let i = 0; i <= 40; i++) {
        const s = p.castelo + ((1 - p.castelo) * i) / 40
        if (meiaLarguraEm(p, s) - 4 > Math.abs(y)) {
          if (x0 === null) x0 = xDe(p, s)
          x1 = xDe(p, s)
        }
      }
      if (x0 !== null) this.linha({ x: x0, y, z: p.alturaDeck + 0.35 }, { x: x1, y, z: p.alturaDeck + 0.35 }, 0.9, pal.tabuas, 0.75)
    }
    // Sombra da parede interna da amurada.
    this.tracar(contorno(p, p.alturaDeck + 0.4, 1, 3.2, p.castelo * 0.9, 1), 2, escurecer(pal.deck, 0.45), 0.6)

    // Amurada: borda grossa de madeira clara com contorno.
    this.tracar(contorno(p, topoAmurada, 1, 1.4), 3.6, pal.amurada)
    this.tracar(contorno(p, topoAmurada + 0.3, 1, 1.4), 1, clarear(pal.amurada, 0.35), 0.7)
    this.tracar(contorno(p, topoAmurada, 1, 0), 1.1, pal.contorno, 0.9)

    // Figura de proa: haste subindo e voluta em espiral.
    const proa = xDe(p, 1)
    this.linha({ x: proa - 3, y: 0, z: topoAmurada - 2 }, { x: proa + 4, y: 0, z: topoAmurada + 8 }, 5, pal.casco)
    const voluta: P3[] = []
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI * 1.7 - Math.PI * 0.2
      const r = 7 - i * 0.14
      voluta.push({ x: proa + 2 + Math.cos(a) * r, y: 0, z: topoAmurada + 10 + Math.sin(a) * r })
    }
    this.tracar(voluta, 4.5, pal.amurada, 1, false)
    this.tracar(voluta, 1, pal.contorno, 0.8, false)
    // Gurupés.
    this.linha({ x: proa - 6, y: 0, z: topoAmurada }, { x: proa + 20, y: 0, z: topoAmurada + 9 }, 2.6, pal.mastro)
  }

  /** Castelo de popa: plataforma alta, janela na popa, leme e lanterna. */
  private desenharCastelo() {
    const p = this.projeto
    const pal = p.paleta
    const z0 = p.alturaDeck + 3
    const z1 = p.alturaDeck + p.alturaCastelo
    const fim = p.castelo

    for (let i = 0; i <= 5; i++) {
      const z = z0 + ((z1 - z0) * i) / 5
      this.preencher(contorno(p, z, 1, 0.8, 0, fim), misturar(pal.casco, pal.amurada, 0.15 + i * 0.06))
    }
    // Parede da frente (virada para a proa) com porta.
    const xf = xDe(p, fim)
    const wf = meiaLarguraEm(p, fim) - 0.8
    if (this.voltadoParaCamera(1, 0) > -0.2) {
      const parede = [
        { x: xf, y: -wf, z: p.alturaDeck },
        { x: xf, y: wf, z: p.alturaDeck },
        { x: xf, y: wf, z: z1 },
        { x: xf, y: -wf, z: z1 },
      ]
      this.preencher(parede, escurecer(pal.casco, 0.1))
      this.tracar(parede, 0.8, pal.contorno, 0.7)
      const porta = [
        { x: xf + 0.2, y: -3, z: p.alturaDeck },
        { x: xf + 0.2, y: 3, z: p.alturaDeck },
        { x: xf + 0.2, y: 3, z: p.alturaDeck + 7 },
        { x: xf + 0.2, y: -3, z: p.alturaDeck + 7 },
      ]
      this.preencher(porta, 0x2a1709)
      this.tracar(porta, 0.8, pal.friso, 0.8)
    }
    // Janela da popa, quando a popa está virada para a câmera.
    if (this.voltadoParaCamera(-1, 0) > 0) {
      const xp = xDe(p, 0) - 0.3
      const janela = [
        { x: xp, y: -4, z: p.alturaDeck + 1 },
        { x: xp, y: 4, z: p.alturaDeck + 1 },
        { x: xp, y: 4, z: p.alturaDeck + 5 },
        { x: xp, y: -4, z: p.alturaDeck + 5 },
      ]
      this.preencher(janela, pal.janela)
      this.tracar(janela, 1.2, pal.contorno, 0.9)
    }

    // Piso do castelo e amurada dele.
    const piso = contorno(p, z1 + 0.2, 1, 2.6, 0, fim)
    this.preencher(piso, clarear(pal.deck, 0.06))
    for (let faixa = -2; faixa <= 2; faixa++) {
      const y = faixa * p.meiaLargura * 0.26
      this.linha({ x: xDe(p, 0.02), y, z: z1 + 0.25 }, { x: xf - 1, y, z: z1 + 0.25 }, 0.8, pal.tabuas, 0.7)
    }
    this.tracar(contorno(p, z1 + 2.5, 1, 1.2, 0, fim), 2.4, pal.amurada)
    // Balaústres da amurada do castelo.
    for (let i = 0; i <= 6; i++) {
      const s = (fim * i) / 6
      for (const lado of [-1, 1]) {
        const y = lado * (meiaLarguraEm(p, s) - 1.2)
        this.linha({ x: xDe(p, s), y, z: z1 }, { x: xDe(p, s), y, z: z1 + 2.5 }, 1, pal.contorno, 0.7)
      }
    }

    // Leme: poste e roda no plano transversal.
    const xl = xDe(p, fim * 0.55)
    this.linha({ x: xl, y: 0, z: z1 }, { x: xl, y: 0, z: z1 + 6 }, 2.2, pal.mastro)
    const roda: P3[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2
      roda.push({ x: xl + 1.2, y: Math.cos(a) * 4.2, z: z1 + 7 + Math.sin(a) * 4.2 })
    }
    this.tracar(roda, 1.5, pal.friso, 1)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      this.linha(
        { x: xl + 1.2, y: Math.cos(a) * 5.4, z: z1 + 7 + Math.sin(a) * 5.4 },
        { x: xl + 1.2, y: -Math.cos(a) * 5.4, z: z1 + 7 - Math.sin(a) * 5.4 },
        0.9,
        pal.friso,
        1,
      )
    }

    // Lanterna na popa.
    const lanterna = this.projetar({ x: xDe(p, 0.02), y: 0, z: z1 + 6 })
    this.g.fillStyle(0xffd66b, 0.35)
    this.g.fillCircle(lanterna.x, lanterna.y, 4.5)
    this.g.fillStyle(0xffe9a6, 1)
    this.g.fillCircle(lanterna.x, lanterna.y, 1.8)
  }

  /** Caixotes, barris, escotilha e sacos: a carga que dá vida ao convés. */
  private itensDoConves() {
    const p = this.projeto
    const pal = p.paleta
    const z = p.alturaDeck + 0.4
    const L = p.comprimento
    const W = p.meiaLargura
    const itens: { profundidade: number; desenhar: () => void }[] = []
    const add = (x: number, y: number, desenhar: () => void) => itens.push({ profundidade: this.profundidadeDe(x, y), desenhar })

    // Escotilha com grade.
    add(L * 0.06, 0, () => {
      const x = L * 0.06
      const quad = [
        { x: x - 5, y: -4.5, z },
        { x: x + 5, y: -4.5, z },
        { x: x + 5, y: 4.5, z },
        { x: x - 5, y: 4.5, z },
      ]
      this.preencher(quad, escurecer(pal.deck, 0.55))
      this.tracar(quad, 1.2, escurecer(pal.deck, 0.3))
      for (let i = -1; i <= 1; i++) this.linha({ x: x + i * 2.5, y: -4.5, z }, { x: x + i * 2.5, y: 4.5, z }, 0.7, pal.tabuas, 0.8)
    })

    // Pilha de caixotes perto do mastro de proa.
    add(L * 0.2, -W * 0.45, () => {
      this.caixa(L * 0.2, -W * 0.45, z, 4, 4, 7, 0x9b6a35, pal.contorno)
      this.caixa(L * 0.2 + 0.5, -W * 0.45 + 0.4, z + 7, 3, 3, 5, 0xb07d42, pal.contorno)
    })
    add(L * 0.27, -W * 0.2, () => this.caixa(L * 0.27, -W * 0.2, z, 3.2, 3.2, 5, 0xa87038, pal.contorno))

    // Barris.
    add(-L * 0.02, W * 0.5, () => this.cilindro(-L * 0.02, W * 0.5, z, 3.2, 7, 0x8c5a2b, 2, 3))
    add(L * 0.04, W * 0.55, () => this.cilindro(L * 0.04, W * 0.55, z, 3, 6.5, 0x7d4f25, 2, 2.8))

    // Sacos de lona.
    add(-L * 0.12, -W * 0.45, () => {
      const c = this.projetar({ x: -L * 0.12, y: -W * 0.45, z: z + 2 })
      this.g.fillStyle(0xcdb996, 1)
      this.g.fillEllipse(c.x, c.y, 9, 6)
      this.g.fillStyle(0xe3d3b3, 1)
      this.g.fillEllipse(c.x - 1, c.y - 1.5, 5, 3)
    })
    return itens
  }

  private desenharMastro(m: Mastro, x: number, regulagem: number, barriga: number, vento: EstadoVento, rumo: number, tempo: number) {
    const p = this.projeto
    const pal = p.paleta
    const base = m.s < p.castelo ? p.alturaDeck + p.alturaCastelo : p.alturaDeck

    // Base metálica e mastro.
    this.cilindro(x, 0, base, 2.8, 3, 0x9aa1a8, 0)
    const pe = this.projetar({ x, y: 0, z: base })
    const topo = this.projetar({ x, y: 0, z: m.altura })
    this.g.lineStyle(3.4, pal.mastro, 1)
    this.g.lineBetween(pe.x, pe.y, topo.x, topo.y)
    this.g.lineStyle(1.1, clarear(pal.mastro, 0.35), 0.8)
    this.g.lineBetween(pe.x - 0.8, pe.y, topo.x - 0.8, topo.y)

    // Velas: as de baixo primeiro (o cesto fica entre elas).
    const velas = [...m.velas].sort((a, b) => a[1] - b[1])
    velas.forEach(([largura, z0, z1], i) => {
      if (i === 1 && m.cesto) this.cilindro(x, 0, m.cesto, 5.2, 6, 0x7a4a24, 1, 6.2)
      this.desenharVela(x, largura, z0, z1, regulagem, barriga)
    })
    if (m.cesto && velas.length < 2) this.cilindro(x, 0, m.cesto, 5.2, 6, 0x7a4a24, 1, 6.2)

    // Pinha no topo.
    this.g.fillStyle(0x8a5a2b, 1)
    this.g.fillCircle(topo.x, topo.y - 2, 3)
    this.g.fillStyle(0xc28a52, 1)
    this.g.fillCircle(topo.x - 1, topo.y - 3, 1.2)

    if (m.bandeira) this.desenharBandeira(x, m.altura - 3, vento, rumo, tempo)
  }

  /**
   * Vela redonda entre duas vergas, girada pela regulagem e com barriga. A
   * grade 4×4 clareia no meio, como o brilho do pano na referência.
   */
  private desenharVela(xm: number, largura: number, z0: number, z1: number, regulagem: number, barriga: number) {
    const pal = this.projeto.paleta
    const eixo = { x: -Math.sin(regulagem), y: Math.cos(regulagem) }
    const normal = { x: Math.cos(regulagem), y: Math.sin(regulagem) }
    const colunas = 4
    const linhas = 4

    const ponto = (u: number, v: number): P3 => {
      const b = barriga * Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin(Math.PI * v))
      const a = (u - 0.5) * largura * (1 - v * 0.08)
      return { x: xm + 1.5 + eixo.x * a + normal.x * b, y: eixo.y * a + normal.y * b, z: z0 + v * (z1 - z0) }
    }

    for (let j = 0; j < linhas; j++) {
      for (let i = 0; i < colunas; i++) {
        const u0 = i / colunas
        const u1 = (i + 1) / colunas
        const v0 = j / linhas
        const v1 = (j + 1) / linhas
        const meio = Math.sin(Math.PI * (u0 + u1) * 0.5) * Math.sin(Math.PI * (v0 + v1) * 0.5)
        this.preencher([ponto(u0, v0), ponto(u1, v0), ponto(u1, v1), ponto(u0, v1)], misturar(pal.vela, pal.velaBrilho, meio * 0.55))
      }
    }
    // Borda escura do pano.
    const borda: P3[] = []
    for (let i = 0; i <= 8; i++) borda.push(ponto(i / 8, 0))
    for (let j = 0; j <= 6; j++) borda.push(ponto(1, j / 6))
    for (let i = 8; i >= 0; i--) borda.push(ponto(i / 8, 1))
    for (let j = 6; j >= 0; j--) borda.push(ponto(0, j / 6))
    this.tracar(borda, 1.1, 0x000000, 0.55)

    // Emblema da Marinha no pano (gaivota).
    if (this.tipo === 'marinha') {
      const c = this.projetar(ponto(0.5, 0.55))
      const k = Math.abs(this.cosR * eixo.x - this.sinR * eixo.y) * 0.9 + 0.1
      this.g.lineStyle(2, pal.bandeira, 0.9)
      this.g.beginPath()
      this.g.moveTo(c.x - 7 * k, c.y - 2)
      this.g.lineTo(c.x - 2 * k, c.y - 4)
      this.g.lineTo(c.x, c.y)
      this.g.lineTo(c.x + 2 * k, c.y - 4)
      this.g.lineTo(c.x + 7 * k, c.y - 2)
      this.g.strokePath()
    }

    // Vergas em cima e embaixo, com amarras brancas.
    for (const v of [0, 1]) {
      const a = { ...ponto(0, v), z: ponto(0, v).z + (v ? 1 : -1) }
      const b = { ...ponto(1, v), z: ponto(1, v).z + (v ? 1 : -1) }
      const extA = { x: a.x - eixo.x * 3, y: a.y - eixo.y * 3, z: a.z }
      const extB = { x: b.x + eixo.x * 3, y: b.y + eixo.y * 3, z: b.z }
      this.linha(extA, extB, 2.6, pal.mastro)
      this.linha(extA, extB, 0.8, clarear(pal.mastro, 0.4), 0.8)
      for (const u of [0.15, 0.4, 0.6, 0.85]) {
        const n = this.projetar({ ...ponto(u, v), z: a.z })
        this.g.fillStyle(0xe8e0cc, 0.9)
        this.g.fillRect(n.x - 0.6, n.y - 1.2, 1.2, 2.4)
      }
    }
  }

  /** Bandeira preta a favor do vento, com a Jolly Roger de chapéu de palha. */
  private desenharBandeira(xm: number, z: number, vento: EstadoVento, rumo: number, tempo: number) {
    const pal = this.projeto.paleta
    const angulo = vento.direcao - rumo + ruidoSuave(tempo * 4, this.semente + 3) * 0.25
    const dir = { x: Math.cos(angulo), y: Math.sin(angulo) }
    const lado = { x: -dir.y, y: dir.x }
    const comprimento = 26
    const altura = 17
    const ponto = (u: number, v: number): P3 => {
      const onda = Math.sin(u * 5 - tempo * 9 + this.semente) * 2.2 * u * (0.4 + vento.intensidade)
      return { x: xm + dir.x * u * comprimento + lado.x * onda, y: dir.y * u * comprimento + lado.y * onda, z: z - v * altura - u * 1.5 }
    }
    for (let i = 0; i < 5; i++) {
      const u0 = i / 5
      const u1 = (i + 1) / 5
      const sombra = 0.85 + 0.15 * Math.sin(u0 * 5 - tempo * 9 + this.semente)
      this.preencher([ponto(u0, 0), ponto(u1, 0), ponto(u1, 1), ponto(u0, 1)], misturar(0x000000, pal.bandeira, sombra))
    }
    this.tracar([ponto(0, 0), ponto(1, 0), ponto(1, 1), ponto(0, 1)], 0.7, 0x000000, 0.6)

    // O desenho fica "colado" na bandeira: achata conforme o ângulo em que é vista.
    const c = this.projetar(ponto(0.5, 0.5))
    const a = this.projetar(ponto(0, 0.5))
    const b = this.projetar(ponto(1, 0.5))
    const esticar = (b.x - a.x) / comprimento
    if (Math.abs(esticar) < 0.15) return
    if (this.tipo === 'pirata') jollyRoger(this.g, c.x, c.y, esticar, 0.8)
    else gaivota(this.g, c.x, c.y, esticar, 0.8)
  }

  /** Estais e ovéns: do topo dos mastros ao gurupés e às amuradas. */
  private desenharCordame() {
    const p = this.projeto
    const cor = 0xd8c49a
    const proa = xDe(p, 1)
    const topoAmurada = p.alturaDeck + 3
    const [vante, grande, mezena] = p.mastros
    const xv = xDe(p, vante.s)
    const xg = xDe(p, grande.s)
    const xz = xDe(p, mezena.s)
    this.linha({ x: xv, y: 0, z: vante.altura - 4 }, { x: proa + 20, y: 0, z: topoAmurada + 9 }, 0.9, cor, 0.85)
    this.linha({ x: xg, y: 0, z: grande.altura - 6 }, { x: xv, y: 0, z: vante.altura - 10 }, 0.9, cor, 0.8)
    this.linha({ x: xz, y: 0, z: mezena.altura - 6 }, { x: xg, y: 0, z: grande.cesto ?? grande.altura - 20 }, 0.9, cor, 0.8)
    // Ovéns do mastro grande até a amurada, dos dois lados.
    for (const lado of [-1, 1]) {
      for (const dx of [-5, 0, 5]) {
        const s = grande.s + dx / p.comprimento
        this.linha(
          { x: xg, y: 0, z: (grande.cesto ?? 60) - 1 },
          { x: xg + dx, y: lado * (meiaLarguraEm(p, s) - 1), z: topoAmurada },
          0.7,
          cor,
          0.55,
        )
      }
    }
  }

  pontoDaPopa(estado: EstadoViagem) {
    return {
      x: estado.posicao.x - Math.cos(estado.rumo) * this.meioComprimento * 0.95,
      y: estado.posicao.y - Math.sin(estado.rumo) * this.meioComprimento * 0.95,
    }
  }

  pontoDaProa(estado: EstadoViagem) {
    return {
      x: estado.posicao.x + Math.cos(estado.rumo) * this.meioComprimento,
      y: estado.posicao.y + Math.sin(estado.rumo) * this.meioComprimento,
    }
  }

  destruir() {
    this.g.destroy()
  }
}

/**
 * Jolly Roger dos Chapéus de Palha: caveira com ossos cruzados e o chapéu
 * de palha com fita vermelha. Medidas em unidades do desenho; `esticar`
 * achata na horizontal (e espelha, se negativo) e `e` é a escala.
 */
function jollyRoger(g: Phaser.GameObjects.Graphics, x: number, y: number, esticar: number, e: number) {
  const X = (dx: number) => x + dx * esticar * e
  const Y = (dy: number) => y + dy * e
  const W = (w: number) => w * Math.abs(esticar) * e
  const H = (h: number) => h * e
  const osso = 0xf4f0e6

  // Ossos cruzados atrás da caveira, com as pontas arredondadas.
  g.lineStyle(H(2.4), osso, 1)
  g.lineBetween(X(-8), Y(-5), X(8), Y(7))
  g.lineBetween(X(8), Y(-5), X(-8), Y(7))
  g.fillStyle(osso, 1)
  for (const [dx, dy] of [[-8, -5], [8, 7], [8, -5], [-8, 7]]) {
    g.fillCircle(X(dx - 1), Y(dy - 0.6), H(1.5))
    g.fillCircle(X(dx + 1), Y(dy + 0.6), H(1.5))
  }
  // Caveira.
  g.fillEllipse(X(0), Y(0.5), W(11), H(10))
  g.fillRect(X(0) - W(3), Y(4), W(6), H(3))
  g.fillStyle(0x111111, 1)
  g.fillEllipse(X(-2.4), Y(1), W(3), H(3.2))
  g.fillEllipse(X(2.4), Y(1), W(3), H(3.2))
  g.fillTriangle(X(0), Y(2.6), X(-0.8), Y(3.8), X(0.8), Y(3.8))
  // Chapéu de palha: aba larga, copa e fita vermelha.
  g.fillStyle(0xf0c24b, 1)
  g.fillEllipse(X(0), Y(-3.6), W(16), H(4))
  g.fillEllipse(X(0), Y(-6), W(9), H(6))
  g.fillStyle(0xc4322c, 1)
  g.fillRect(X(0) - W(4.4), Y(-5), W(8.8), H(1.6))
}

/** Gaivota da Marinha, para a bandeira azul. */
function gaivota(g: Phaser.GameObjects.Graphics, x: number, y: number, esticar: number, e: number) {
  const X = (dx: number) => x + dx * esticar * e
  const Y = (dy: number) => y + dy * e
  g.lineStyle(2.2 * e, 0xf8fafc, 1)
  g.beginPath()
  g.moveTo(X(-9), Y(-1))
  g.lineTo(X(-3), Y(-4))
  g.lineTo(X(0), Y(1))
  g.lineTo(X(3), Y(-4))
  g.lineTo(X(9), Y(-1))
  g.strokePath()
}
