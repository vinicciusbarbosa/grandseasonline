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
      bandeira: 0xf6f7f9,
      janela: 0xf2d24a,
    },
  },
}

type P3 = { x: number; y: number; z: number }
type Destroco = P3 & { vx: number; vy: number; vz: number; giro: number; angulo: number; comprimento: number; cor: number }
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
  /** Transformação extra aplicada antes de tudo (pedaços do naufrágio). */
  private preTransformar: ((l: P3) => P3) | null = null
  private destrocos: Destroco[] = []
  /** Água que entrou pela amurada e ainda está escorrendo (0–1). */
  private aguaConves = 0
  private enchimento = 0
  private panejo = 0
  private tempoAtual = 0

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
  private projetar(entrada: P3, semOnda = false): P2 {
    const l = this.preTransformar ? this.preTransformar(entrada) : entrada
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

  /**
   * `alturaMar(x, y)` devolve a altura da água num ponto do mundo agora — a
   * mesma função que move o casco e que o shader desenha.
   */
  atualizar(
    estado: EstadoViagem,
    fisica: FisicaNavio,
    vento: EstadoVento,
    balanco: Balanco,
    tempo: number,
    dt: number,
    alturaMar: (x: number, y: number) => number,
  ) {
    const p = this.projeto
    this.g.clear()

    const razao = Math.min(1, estado.velocidade / fisica.velocidadeMax)
    // Nas curvas o navio aderna para fora; mais solto, mais aderna.
    const adernar = -estado.giroAtual * (0.12 + fisica.sensibilidadeOnda * 0.08) * (0.3 + razao)
    // Alagado, ele fica pesado e jogado de um lado para o outro.
    const agua = estado.alagamento
    const rolagem = balanco.rolagem + adernar + Math.sin(tempo * 2.3) * 0.12 * agua + estado.adernaRedemoinho
    const arfagem = balanco.arfagem + razao * 0.03

    this.cx = estado.posicao.x
    this.cy = estado.posicao.y
    this.cosR = Math.cos(estado.rumo)
    this.sinR = Math.sin(estado.rumo)
    this.cosRol = Math.cos(rolagem)
    this.sinRol = Math.sin(rolagem)
    this.cosArf = Math.cos(arfagem)
    this.sinArf = Math.sin(arfagem)
    // Alagado ele assenta; no funil do redemoinho ele desce com a água.
    this.altura = balanco.altura - agua * 7 - estado.funil * 26
    this.g.setDepth(3 + this.cy * 1e-5)
    this.tempoAtual = tempo

    if (estado.naufragio !== null) {
      this.desenharNaufragio(estado.naufragio, dt)
      return
    }

    this.desenharSombra()
    this.desenharCasco(() => this.desenharLaminaDagua(razao, dt, alturaMar))
    // O castelo faz parte do casco: sempre antes dos mastros, senão o mastro
    // de mezena (que nasce nele) some dentro dele conforme o rumo.
    this.desenharCastelo()
    const aguaNoConves = Math.max(agua, this.aguaConves)
    if (aguaNoConves > 0.02) this.desenharAguaNoConves(aguaNoConves, tempo)

    // Velas: os marinheiros bracejam as vergas para pegar o vento; a pressão
    // é o vento projetado na normal do pano. A favor, o pano enche para a
    // frente; de proa, vai "para trás"; paralelo ao pano, ele paneja.
    const relativo = diferencaAngular(estado.rumo, vento.direcao)
    const regulagem = Phaser.Math.Clamp(relativo * 0.6, -0.9, 0.9)
    const pressao = Math.cos(relativo - regulagem)
    const alvoEnchimento = vento.intensidade * pressao
    this.enchimento += (alvoEnchimento - this.enchimento) * (1 - Math.exp(-dt / 0.6))
    const panejo = (1 - Math.abs(pressao)) * vento.intensidade + (1 - vento.intensidade) * 0.25
    this.panejo += (panejo - this.panejo) * (1 - Math.exp(-dt / 0.4))

    // Mastros do fundo para a frente.
    const mastros = p.mastros
      .map((m) => ({ m, x: xDe(p, m.s) }))
      .sort((a, b) => this.profundidadeDe(a.x, 0) - this.profundidadeDe(b.x, 0))
    for (const { m, x } of mastros) this.desenharMastro(m, x, regulagem, this.enchimento * 17, vento, estado.rumo, tempo)

    this.desenharCordame()
  }

  /** Sombra do casco na água (o resto da água em volta é do shader). */
  private desenharSombra() {
    this.preencher(contorno(this.projeto, 0, 1.05).map((l) => ({ ...l, x: l.x + 3, y: l.y + 5 })), 0x001018, 0.25, true)
  }

  /** Altura (no mundo) de um ponto local do navio, com o balanço atual. */
  private mundoDe(l: P3) {
    const y1 = l.y * this.cosRol - l.z * this.sinRol
    const z1 = l.y * this.sinRol + l.z * this.cosRol
    const x2 = l.x * this.cosArf - z1 * this.sinArf
    const z2 = l.x * this.sinArf + z1 * this.cosArf
    return { x: this.cx + x2 * this.cosR - y1 * this.sinR, y: this.cy + x2 * this.sinR + y1 * this.cosR, z: z2 + this.altura }
  }

  /**
   * A água batendo no casco. Em volta do costado, a superfície do mar fica
   * onde as ondas estão de verdade: quando o navio desce ou aderna, a água
   * sobe pelo casco; quando ele sobe, ela escorre. Na proa, em movimento, a
   * água se acumula (é o casco cortando o mar). Se a água passa da amurada,
   * entra no convés — e depois escorre de volta.
   */
  private desenharLaminaDagua(razao: number, dt: number, alturaMar: (x: number, y: number) => number) {
    const p = this.projeto
    const topoAmurada = p.alturaDeck + 3
    const n = 24
    const topo: P3[][] = [[], []]
    const base: P3[][] = [[], []]
    let transborda = 0

    for (const [k, lado] of [[0, -1], [1, 1]] as const) {
      for (let i = 0; i <= n; i++) {
        const s = i / n
        const w = meiaLarguraEm(p, s) * 0.82
        const casco = { x: xDe(p, s), y: lado * w, z: 0 }
        const mundo = this.mundoDe(casco)
        // A proa empurra a água para cima; o meio do casco fica num leve cavado.
        const empurrao = razao * (7 * Math.exp(-Math.pow((1 - s) / 0.13, 2)) - 1.2 * Math.exp(-Math.pow((s - 0.55) / 0.2, 2)))
        const agua = alturaMar(mundo.x, mundo.y) - mundo.z + empurrao + 1.2
        base[k].push({ x: casco.x, y: lado * (w + 0.4), z: -1 })
        topo[k].push({ x: casco.x, y: lado * (w + 0.9), z: Math.max(0.2, Math.min(topoAmurada + 1, agua)) })

        const amurada = this.mundoDe({ x: casco.x, y: lado * meiaLarguraEm(p, s), z: topoAmurada })
        transborda = Math.max(transborda, alturaMar(amurada.x, amurada.y) + empurrao - amurada.z)
      }
    }

    // Água no costado virado para a câmera: faixa translúcida com a borda de espuma.
    for (const [k, lado] of [[0, -1], [1, 1]] as const) {
      if (this.voltadoParaCamera(0, lado) < -0.35) continue
      for (let i = 0; i < n; i++) {
        this.preencher([base[k][i], base[k][i + 1], topo[k][i + 1], topo[k][i]], 0x3fb3c4, 0.72)
      }
      this.tracar(topo[k], 2.2, 0xe8fbff, 0.8, false)
      this.tracar(topo[k].map((l) => ({ ...l, z: l.z - 1.2 })), 1, 0xffffff, 0.35, false)
    }
    // Proa: a crista de água que o casco levanta, unindo os dois lados.
    this.tracar([topo[0][n - 2], topo[0][n], topo[1][n], topo[1][n - 2]], 2.6, 0xffffff, 0.55 + 0.35 * razao, false)

    // Água passando por cima da amurada: enche o convés; depois escorre.
    if (transborda > 0) this.aguaConves = Math.min(1, this.aguaConves + transborda * dt * 0.25)
    this.aguaConves = Math.max(0, this.aguaConves - dt * 0.35)
  }

  /** Água no convés: sobe com o alagamento e escorre para o lado que aderna. */
  private desenharAguaNoConves(agua: number, tempo: number) {
    const p = this.projeto
    const nivel = p.alturaDeck + 0.6 + agua * 2
    const balanco = Math.sin(tempo * 2.3) * 4 * agua
    const lamina = contorno(p, nivel, 1, 3.4, p.castelo * 0.9, 1).map((l) => ({ ...l, y: l.y * (0.75 + 0.25 * agua) + balanco }))
    this.preencher(lamina, 0x3a8fb0, 0.25 + 0.45 * agua)
    this.tracar(lamina, 1.2, 0xd9f4ff, 0.35 * agua)
  }

  /**
   * O navio se parte: as duas metades se afastam, adernam e afundam; os
   * mastros tombam e as tábuas voam e ficam boiando.
   */
  private desenharNaufragio(t: number, dt: number) {
    const p = this.projeto
    const pal = p.paleta
    if (this.destrocos.length === 0) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 20 + Math.random() * 50
        this.destrocos.push({
          x: (Math.random() - 0.5) * p.comprimento * 0.5,
          y: (Math.random() - 0.5) * p.meiaLargura,
          z: p.alturaDeck,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          vz: 30 + Math.random() * 60,
          giro: (Math.random() - 0.5) * 10,
          angulo: Math.random() * Math.PI,
          comprimento: 5 + Math.random() * 9,
          cor: Math.random() < 0.5 ? pal.amurada : pal.casco,
        })
      }
    }
    const afunda = Math.min(1, t / 3.5)
    const alfa = 1 - Math.max(0, (t - 2.5) / 1.5)
    if (alfa <= 0) return

    for (const [s0, s1, lado] of [[0, 0.52, -1], [0.48, 1, 1]] as const) {
      const pivo = xDe(p, (s0 + s1) / 2)
      const inclina = lado * afunda * 0.9
      this.preTransformar = (l) => {
        const x = l.x - pivo
        // A metade gira em torno do corte e desce.
        const z = l.z * Math.cos(inclina) - x * Math.sin(inclina) * 0.6
        return { x: l.x + lado * afunda * 14, y: l.y * (1 - afunda * 0.1), z: z - afunda * 22 }
      }
      for (let i = 0; i <= 6; i++) {
        const f = i / 6
        this.preencher(contorno(p, f * (p.alturaDeck + 3), 0.8 + 0.2 * f, 0, s0, s1), misturar(pal.cascoBaixo, pal.casco, f), alfa)
      }
      this.preencher(contorno(p, p.alturaDeck + 0.3, 1, 3.2, s0, s1), pal.deck, alfa)
      // Mastro tombando para fora.
      const m = p.mastros[lado < 0 ? 2 : 0]
      const xm = xDe(p, m.s)
      const queda = Math.min(1.3, afunda * 1.8)
      this.linha({ x: xm, y: 0, z: p.alturaDeck }, { x: xm + lado * Math.sin(queda) * m.altura * 0.8, y: 0, z: p.alturaDeck + Math.cos(queda) * m.altura * 0.8 }, 3, pal.mastro, alfa)
    }
    this.preTransformar = null

    // Destroços voando e depois boiando.
    const g = this.g
    for (const d of this.destrocos) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.z = Math.max(0, d.z + d.vz * dt)
      d.vz -= 120 * dt
      if (d.z === 0) {
        d.vx *= Math.exp(-2 * dt)
        d.vy *= Math.exp(-2 * dt)
        d.giro *= Math.exp(-2 * dt)
      }
      d.angulo += d.giro * dt
      const c = Math.cos(d.angulo) * d.comprimento * 0.5
      const s = Math.sin(d.angulo) * d.comprimento * 0.5
      const a = this.projetar({ x: d.x - c, y: d.y - s, z: d.z })
      const b = this.projetar({ x: d.x + c, y: d.y + s, z: d.z })
      g.lineStyle(2.4, d.cor, alfa)
      g.lineBetween(a.x, a.y, b.x, b.y)
    }
  }

  /** `aguaNoCostado` desenha a água batendo no casco, antes do convés. */
  private desenharCasco(aguaNoCostado: () => void) {
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

    // Portinholas com canhões, embutidas no costado: cada uma fica no plano
    // do casco naquele ponto (acompanha a curva), com a tampa aberta por cima
    // e o cano de bronze saindo na direção da normal.
    for (const s of p.canhoes) this.desenharCanhao(s, 1)
    for (const s of p.canhoes) this.desenharCanhao(s, -1)
    aguaNoCostado()

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

  private desenharCanhao(s: number, lado: number) {
    const p = this.projeto
    const pal = p.paleta
    const topoAmurada = p.alturaDeck + 3
    const z = p.alturaDeck - 3.5
    // Largura do costado nessa altura (as camadas estreitam para baixo).
    const f = z / topoAmurada
    const escala = 0.8 + 0.2 * Math.min(1, f * 1.3)
    const w = meiaLarguraEm(p, s) * escala
    const ds = 0.01
    const inclinacao = ((meiaLarguraEm(p, s + ds) - meiaLarguraEm(p, s - ds)) * escala) / (2 * ds * p.comprimento)
    // Tangente (ao longo do casco) e normal para fora, no plano.
    const tl = Math.hypot(1, inclinacao)
    const T = { x: 1 / tl, y: (lado * inclinacao) / tl }
    const N = { x: (-lado * inclinacao) / tl, y: lado / tl }
    if (this.voltadoParaCamera(N.x, N.y) < 0.08) return

    const c = { x: xDe(p, s), y: lado * w, z }
    const em = (dt: number, dz: number, dn = 0.2): P3 => ({ x: c.x + T.x * dt + N.x * dn, y: c.y + T.y * dt + N.y * dn, z: c.z + dz })

    // Batente e buraco da portinhola.
    const batente = [em(-3.4, -3), em(3.4, -3), em(3.4, 3), em(-3.4, 3)]
    this.preencher(batente, escurecer(pal.casco, 0.35))
    const buraco = [em(-2.5, -2.2, 0.3), em(2.5, -2.2, 0.3), em(2.5, 2.2, 0.3), em(-2.5, 2.2, 0.3)]
    this.preencher(buraco, 0x120905)
    // Tampa aberta, presa em cima e levantada para fora.
    const tampa = [em(-3.2, 3, 0.3), em(3.2, 3, 0.3), em(3.2, 5.2, 3.2), em(-3.2, 5.2, 3.2)]
    this.preencher(tampa, pal.amurada)
    this.tracar(tampa, 0.7, pal.contorno, 0.8)

    // Cano: cilindro curto ao longo da normal, com boca em anel.
    const aro = (dn: number, r: number) => {
      const pts: P3[] = []
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        pts.push(em(Math.cos(a) * r, Math.sin(a) * r, dn))
      }
      return pts
    }
    const tras = this.projetar(em(0, 0, 0.3))
    const frente = this.projetar(em(0, 0, 4.5))
    this.g.lineStyle(3.6, 0x6b4a16, 1)
    this.g.lineBetween(tras.x, tras.y, frente.x, frente.y)
    this.g.lineStyle(1.4, 0xe0b25a, 0.9)
    this.g.lineBetween(tras.x, tras.y - 0.8, frente.x, frente.y - 0.8)
    this.preencher(aro(4.6, 2), 0xb8862e)
    this.preencher(aro(4.7, 1.1), 0x120905)
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
      // Barriga do pano + ondulação de panejo (pano batendo quando o vento
      // corre paralelo a ele), que anda de uma ponta à outra.
      const onda = this.panejo * 3.4 * Math.sin(u * 9 - this.tempoAtual * 15 + v * 2.5) * Math.sin(Math.PI * u)
      const b = barriga * Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin(Math.PI * v)) + onda
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
        // Pano cheio brilha no meio (esticado); frouxo fica opaco.
        const brilho = meio * (0.25 + 0.6 * Math.min(1, Math.abs(this.enchimento)))
        this.preencher([ponto(u0, v0), ponto(u1, v0), ponto(u1, v1), ponto(u0, v1)], misturar(pal.vela, pal.velaBrilho, brilho))
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
      this.g.lineStyle(2, AZUL_MARINHA, 0.9)
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

  /**
   * Bandeira a favor do vento: a preta com a Jolly Roger de chapéu de palha,
   * ou a branca da Marinha, com a gaivota azul e o "MARINE".
   */
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
    this.tracar([ponto(0, 0), ponto(1, 0), ponto(1, 1), ponto(0, 1)], 0.7, this.tipo === 'pirata' ? 0x000000 : 0x5b6675, 0.6)

    // O emblema é pintado NO pano: cada forma é mapeada para (u, v) da
    // bandeira e passa pela mesma ondulação e perspectiva que ela.
    const k = 0.8
    const noPano = (forma: [number, number][], cor: number) =>
      this.preencher(forma.map(([dx, dy]) => ponto(0.5 + (dx * k) / comprimento, 0.5 + (dy * k) / altura)), cor)
    for (const [forma, cor] of this.tipo === 'pirata' ? JOLLY_ROGER : MARINHA) noPano(forma, cor)
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

  /** Como está o pano agora, para o HUD. */
  get estadoVelas(): 'cheias' | 'a-re' | 'panejando' | 'frouxas' {
    if (this.panejo > 0.45) return 'panejando'
    if (this.enchimento > 0.35) return 'cheias'
    if (this.enchimento < -0.15) return 'a-re'
    return 'frouxas'
  }

  destruir() {
    this.g.destroy()
  }
}

// ---- Emblemas: formas em unidades do desenho, pintadas no pano ------------------

type Forma = [number, number][]

function elipse(cx: number, cy: number, rx: number, ry: number, n = 16): Forma {
  const pts: Forma = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return pts
}

function retangulo(x0: number, y0: number, x1: number, y1: number): Forma {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
}

/** Barra grossa entre dois pontos (um osso). */
function barra(ax: number, ay: number, bx: number, by: number, largura: number): Forma {
  const d = Math.hypot(bx - ax, by - ay)
  const nx = (-(by - ay) / d) * (largura / 2)
  const ny = ((bx - ax) / d) * (largura / 2)
  return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]]
}

const OSSO = 0xf4f0e6

/** Jolly Roger dos Chapéus de Palha: ossos cruzados, caveira e chapéu com fita. */
const JOLLY_ROGER: [Forma, number][] = [
  [barra(-8, -4, 8, 7, 2.4), OSSO],
  [barra(8, -4, -8, 7, 2.4), OSSO],
  ...([[-8, -4], [8, 7], [8, -4], [-8, 7]] as const).flatMap(([x, y]): [Forma, number][] => [
    [elipse(x - 1, y - 0.7, 1.5, 1.5, 10), OSSO],
    [elipse(x + 1, y + 0.7, 1.5, 1.5, 10), OSSO],
  ]),
  [elipse(0, 0.5, 5.5, 5), OSSO],
  [retangulo(-3, 3.5, 3, 7), OSSO],
  [elipse(-2.3, 1, 1.5, 1.7, 10), 0x111111],
  [elipse(2.3, 1, 1.5, 1.7, 10), 0x111111],
  [[[0, 2.6], [-0.9, 3.9], [0.9, 3.9]], 0x111111],
  [retangulo(-1.6, 5.4, 1.6, 5.9), 0x111111],
  [elipse(0, -3.6, 8.5, 2.1), 0xf0c24b],
  [elipse(0, -6, 4.6, 3.1), 0xf0c24b],
  [retangulo(-4.4, -5.1, 4.4, -3.6), 0xc4322c],
]

const AZUL_MARINHA = 0x2a5fb0

/** Traço de letra (uma barra fina). */
const traco = (ax: number, ay: number, bx: number, by: number): [Forma, number] => [barra(ax, ay, bx, by, 0.75), AZUL_MARINHA]

/** Letras de "MARINE" em traços, a partir do canto (x, topo), com 2,2 × 3 de tamanho. */
function letra(l: string, x: number, t: number): [Forma, number][] {
  const w = 2.2
  const b = t + 3
  const m = t + 1.5
  switch (l) {
    case 'M':
      return [traco(x, b, x, t), traco(x, t, x + w / 2, m + 0.4), traco(x + w / 2, m + 0.4, x + w, t), traco(x + w, t, x + w, b)]
    case 'A':
      return [traco(x, b, x + w / 2, t), traco(x + w / 2, t, x + w, b), traco(x + 0.45, m + 0.4, x + w - 0.45, m + 0.4)]
    case 'R':
      return [traco(x, b, x, t), traco(x, t, x + w - 0.3, t), traco(x + w - 0.3, t, x + w - 0.3, m), traco(x + w - 0.3, m, x, m), traco(x + 0.5, m, x + w, b)]
    case 'I':
      return [traco(x + w / 2, t, x + w / 2, b)]
    case 'N':
      return [traco(x, b, x, t), traco(x, t, x + w, b), traco(x + w, b, x + w, t)]
    default: // E
      return [traco(x, t, x, b), traco(x, t, x + w, t), traco(x, m, x + w - 0.4, m), traco(x, b, x + w, b)]
  }
}

/**
 * Emblema da Marinha (One Piece): a gaivota azul em perfil — bico para a
 * esquerda, as duas asas erguidas em penas, cauda em leque — e, embaixo,
 * "MARINE" em letras de forma. Tudo sobre o pano branco.
 */
const MARINHA: [Forma, number][] = [
  // asa de trás (mais clara, por trás do corpo)
  [[[0.6, -1.6], [1.8, -6.6], [2.8, -5.5], [3.9, -7.6], [4.5, -5.3], [6.6, -6.4], [5.2, -3.6], [3.4, -1.4]], 0x4f86cf],
  // corpo, cabeça, bico e cauda
  [elipse(0.3, -0.6, 5.2, 1.7), AZUL_MARINHA],
  [elipse(-4.9, -1.5, 1.8, 1.6, 12), AZUL_MARINHA],
  [[[-6.4, -1.9], [-8.9, -1.0], [-6.3, -0.8]], 0xe8b340],
  [[[4.8, -0.9], [8.6, -2.6], [7.8, -0.6], [8.8, 0.9], [4.6, 0.3]], AZUL_MARINHA],
  // asa da frente, com as pontas das penas
  [[[-3.2, -1.9], [-6.6, -6.9], [-4.9, -6.3], [-4.6, -7.9], [-2.9, -6.1], [-2.0, -7.2], [-0.7, -4.3], [-0.2, -1.8]], AZUL_MARINHA],
  // olho
  [elipse(-5.3, -1.8, 0.45, 0.45, 8), 0xf6f7f9],
  // MARINE
  ...[...'MARINE'].flatMap((l, i) => letra(l, -8.4 + i * 2.9, 2.6)),
]
