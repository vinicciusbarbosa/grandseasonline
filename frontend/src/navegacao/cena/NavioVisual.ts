import Phaser from 'phaser'
import type { EstadoViagem } from '../sim/navegacao'
import type { FisicaNavio, TipoNavio } from '../sim/navios'
import type { Balanco } from '../sim/ondas'
import { diferencaAngular, ruidoSuave } from '../sim/ruido'
import type { EstadoVento } from '../sim/vento'
import { ACHATAMENTO, ELEVACAO } from './projecao'

/**
 * O navio em 3D de verdade, desenhado a cada quadro num Graphics.
 *
 * O modelo mora em coordenadas locais (x = proa, y = boreste, z = cima). Cada
 * ponto passa por rolagem → arfagem → rumo → subida da onda → projeção
 * inclinada. Com isso a mesma geometria serve para qualquer rumo, e o balanço
 * vem das ondas reais sob o casco (sim/ondas.ts), não de uma animação.
 *
 * É arte provisória feita por código; o dia que houver modelo ou sprites de
 * verdade, só esta classe muda.
 */

type Paleta = {
  cascoBaixo: number
  casco: number
  faixa: number
  deck: number
  tabuas: number
  contorno: number
  friso: number
  cabine: number
  mastro: number
  vela: number
  velaDetalhe: number
  bandeira: number
  bandeiraDetalhe: number
}

export type Projeto = {
  comprimento: number
  meiaLargura: number
  alturaDeck: number
  alturaMastro: number
  /** Posição dos mastros ao longo do casco (0 = popa, 1 = proa). */
  mastros: number[]
  larguraVela: number
  paleta: Paleta
}

export const PROJETOS: Record<TipoNavio, Projeto> = {
  pirata: {
    comprimento: 78,
    meiaLargura: 14,
    alturaDeck: 9,
    alturaMastro: 62,
    mastros: [0.52],
    larguraVela: 50,
    paleta: {
      cascoBaixo: 0x5a3519,
      casco: 0x9a6232,
      faixa: 0x7a4722,
      deck: 0xd1a46a,
      tabuas: 0xb3864f,
      contorno: 0x3a2212,
      friso: 0xe0b04a,
      cabine: 0x6b4022,
      mastro: 0x4a2c17,
      vela: 0xf4e8cc,
      velaDetalhe: 0xb23a36,
      bandeira: 0x1b1b1f,
      bandeiraDetalhe: 0xf4f0e6,
    },
  },
  marinha: {
    comprimento: 92,
    meiaLargura: 16,
    alturaDeck: 12,
    alturaMastro: 70,
    mastros: [0.34, 0.66],
    larguraVela: 50,
    paleta: {
      cascoBaixo: 0x14264a,
      casco: 0x1e3a6b,
      faixa: 0xeef2f7,
      deck: 0xc9b089,
      tabuas: 0xae9570,
      contorno: 0x0e1a33,
      friso: 0xc9a227,
      cabine: 0xeef2f7,
      mastro: 0x3b2a1c,
      vela: 0xf8fafc,
      velaDetalhe: 0x2c5aa0,
      bandeira: 0x2c5aa0,
      bandeiraDetalhe: 0xf8fafc,
    },
  },
}

type P3 = { x: number; y: number; z: number }
type P2 = { x: number; y: number; profundidade: number }

/** Meia-largura do casco em `s` (0 popa, 1 proa): bojudo no meio, afinando na proa. */
function meiaLarguraEm(projeto: Projeto, s: number) {
  const w = projeto.meiaLargura
  if (s < 0.62) return w * (0.78 + 0.22 * Math.sin((s / 0.62) * (Math.PI / 2)))
  return w * Math.pow(Math.cos(((s - 0.62) / 0.38) * (Math.PI / 2)), 0.75)
}

const PASSOS_CASCO = 18

function contorno(projeto: Projeto, z: number, escalaLargura: number, encolher = 0): P3[] {
  const pts: P3[] = []
  const meio = projeto.comprimento / 2
  for (let i = 0; i <= PASSOS_CASCO; i++) {
    const s = i / PASSOS_CASCO
    pts.push({ x: -meio + s * projeto.comprimento, y: -Math.max(0, meiaLarguraEm(projeto, s) * escalaLargura - encolher), z })
  }
  for (let i = PASSOS_CASCO; i >= 0; i--) {
    const s = i / PASSOS_CASCO
    pts.push({ x: -meio + s * projeto.comprimento, y: Math.max(0, meiaLarguraEm(projeto, s) * escalaLargura - encolher), z })
  }
  return pts
}

function misturar(a: number, b: number, t: number) {
  const ca = Phaser.Display.Color.IntegerToColor(a)
  const cb = Phaser.Display.Color.IntegerToColor(b)
  return Phaser.Display.Color.GetColor(
    ca.red + (cb.red - ca.red) * t,
    ca.green + (cb.green - ca.green) * t,
    ca.blue + (cb.blue - ca.blue) * t,
  )
}

export class NavioVisual {
  private readonly g: Phaser.GameObjects.Graphics
  private readonly projeto: Projeto
  readonly tipo: TipoNavio
  readonly meioComprimento: number
  readonly meiaLargura: number
  private readonly camadas: { pontos: P3[]; cor: number }[] = []
  private readonly sombra: P3[]
  private readonly linhaDagua: P3[]
  private readonly conves: P3[]
  private readonly friso: P3[]
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

    const p = this.projeto
    const n = 6
    for (let i = 0; i <= n; i++) {
      const f = i / n
      // A marinha tem faixa branca no alto do costado.
      const cor = tipo === 'marinha' && f > 0.6 ? p.paleta.faixa : misturar(p.paleta.cascoBaixo, p.paleta.casco, f)
      this.camadas.push({ pontos: contorno(p, f * p.alturaDeck, 0.8 + 0.2 * f), cor })
    }
    this.sombra = contorno(p, 0, 1.05)
    this.linhaDagua = contorno(p, 0, 0.92)
    this.conves = contorno(p, p.alturaDeck, 1, 2.2)
    this.friso = contorno(p, p.alturaDeck + 0.5, 1, 1)
  }

  /** Local → tela, com o balanço e o rumo do quadro atual. */
  private projetar(l: P3, semOnda = false): P2 {
    // Rolagem (em torno do eixo proa-popa).
    const y1 = l.y * this.cosRol - l.z * this.sinRol
    const z1 = l.y * this.sinRol + l.z * this.cosRol
    // Arfagem (proa sobe com ângulo positivo).
    const x2 = l.x * this.cosArf - z1 * this.sinArf
    const z2 = l.x * this.sinArf + z1 * this.cosArf
    // Rumo.
    const wx = this.cx + x2 * this.cosR - y1 * this.sinR
    const wy = this.cy + x2 * this.sinR + y1 * this.cosR
    const z = semOnda ? 0 : z2 + this.altura
    return { x: wx, y: wy * ACHATAMENTO - z * ELEVACAO, profundidade: wy }
  }

  private poligono(pontos: P3[], cor: number, alfa = 1, semOnda = false) {
    this.g.fillStyle(cor, alfa)
    this.g.beginPath()
    pontos.forEach((l, i) => {
      const s = this.projetar(l, semOnda)
      if (i === 0) this.g.moveTo(s.x, s.y)
      else this.g.lineTo(s.x, s.y)
    })
    this.g.closePath()
    this.g.fillPath()
  }

  private contornoLinha(pontos: P3[], largura: number, cor: number, alfa = 1, fechar = true, semOnda = false) {
    this.g.lineStyle(largura, cor, alfa)
    this.g.beginPath()
    pontos.forEach((l, i) => {
      const s = this.projetar(l, semOnda)
      if (i === 0) this.g.moveTo(s.x, s.y)
      else this.g.lineTo(s.x, s.y)
    })
    if (fechar) this.g.closePath()
    this.g.strokePath()
  }

  private linha(a: P3, b: P3, largura: number, cor: number, alfa = 1) {
    const pa = this.projetar(a)
    const pb = this.projetar(b)
    this.g.lineStyle(largura, cor, alfa)
    this.g.lineBetween(pa.x, pa.y, pb.x, pb.y)
  }

  /** Profundidade na tela (maior = mais perto da câmera). */
  get profundidade() {
    return this.cy
  }

  atualizar(estado: EstadoViagem, fisica: FisicaNavio, vento: EstadoVento, balanco: Balanco, tempo: number) {
    const p = this.projeto
    const pal = p.paleta
    const g = this.g
    g.clear()

    const razao = Math.min(1, estado.velocidade / fisica.velocidadeMax)
    // Nas curvas o navio aderna para fora; mais solto, mais aderna.
    const adernar = -estado.giroAtual * (0.12 + fisica.sensibilidadeOnda * 0.08) * (0.3 + razao)
    const rolagem = balanco.rolagem + adernar
    // Em velocidade, a proa sobe um pouco.
    const arfagem = balanco.arfagem + razao * 0.035

    this.cx = estado.posicao.x
    this.cy = estado.posicao.y
    this.cosR = Math.cos(estado.rumo)
    this.sinR = Math.sin(estado.rumo)
    this.cosRol = Math.cos(rolagem)
    this.sinRol = Math.sin(rolagem)
    this.cosArf = Math.cos(arfagem)
    this.sinArf = Math.sin(arfagem)
    this.altura = balanco.altura
    g.setDepth(3 + this.cy * 1e-5)

    // --- Sombra na água e espuma batendo no casco ------------------------------------
    const sombra = this.sombra.map((l) => ({ ...l, x: l.x + 3, y: l.y + 5 }))
    this.poligono(sombra, 0x000000, 0.22, true)
    this.contornoLinha(this.linhaDagua.map((l) => ({ ...l, x: l.x * 1.06, y: l.y * 1.35 })), 2.5, 0xffffff, 0.25 + 0.45 * razao, true, false)

    // --- Casco em camadas ------------------------------------------------------------
    for (const camada of this.camadas) this.poligono(camada.pontos, camada.cor)

    // Canhões no costado virado para a câmera.
    const ladoVisivel = this.cosR >= 0 ? 1 : -1
    const canhoes = this.tipo === 'pirata' ? [0.3, 0.45] : [0.22, 0.38, 0.54]
    for (const s of canhoes) {
      const x = -p.comprimento / 2 + s * p.comprimento
      const c = this.projetar({ x, y: ladoVisivel * (meiaLarguraEm(p, s) + 0.5), z: p.alturaDeck - 3 })
      g.fillStyle(0x16171b, 1)
      g.fillCircle(c.x, c.y, 1.8)
    }

    // --- Convés, tábuas e friso ------------------------------------------------------------
    this.poligono(this.conves, pal.deck)
    g.lineStyle(0.8, pal.tabuas, 0.8)
    for (let faixa = -2; faixa <= 2; faixa++) {
      const y = faixa * (p.meiaLargura * 0.3)
      const xs: number[] = []
      for (let i = 0; i <= 40; i++) {
        const s = i / 40
        if (meiaLarguraEm(p, s) - 3 > Math.abs(y)) xs.push(-p.comprimento / 2 + s * p.comprimento)
      }
      if (xs.length > 1) this.linha({ x: xs[0], y, z: p.alturaDeck + 0.1 }, { x: xs[xs.length - 1], y, z: p.alturaDeck + 0.1 }, 0.8, pal.tabuas, 0.8)
    }
    this.contornoLinha(this.friso, 1.3, pal.friso, 0.95)
    this.contornoLinha(this.camadas[this.camadas.length - 1].pontos, 1.2, pal.contorno, 0.9)

    // --- Cabine de popa (uma caixa) --------------------------------------------------------
    const popa = -p.comprimento / 2
    const cab = { x0: popa + 5, x1: popa + 5 + p.comprimento * 0.17, y: p.meiaLargura * 0.55 }
    for (let i = 0; i <= 4; i++) {
      const z = p.alturaDeck + (i / 4) * 8
      this.poligono(
        [
          { x: cab.x0, y: -cab.y, z },
          { x: cab.x1, y: -cab.y, z },
          { x: cab.x1, y: cab.y, z },
          { x: cab.x0, y: cab.y, z },
        ],
        i === 4 ? pal.cabine : misturar(pal.cabine, 0x000000, 0.35),
      )
    }
    this.contornoLinha(
      [
        { x: cab.x0, y: -cab.y, z: p.alturaDeck + 8 },
        { x: cab.x1, y: -cab.y, z: p.alturaDeck + 8 },
        { x: cab.x1, y: cab.y, z: p.alturaDeck + 8 },
        { x: cab.x0, y: cab.y, z: p.alturaDeck + 8 },
      ],
      1.2,
      pal.friso,
    )

    // --- Gurupés e figura de proa ------------------------------------------------------------
    const proaX = p.comprimento / 2
    this.linha({ x: proaX - 6, y: 0, z: p.alturaDeck }, { x: proaX + 12, y: 0, z: p.alturaDeck + 7 }, 2.5, pal.mastro)
    const figura = this.projetar({ x: proaX + 1, y: 0, z: p.alturaDeck + 2 })
    if (this.tipo === 'pirata') {
      g.fillStyle(0xf4ecd6, 1)
      g.fillCircle(figura.x, figura.y, 4)
      g.fillStyle(pal.friso, 1)
      g.fillCircle(figura.x - 2, figura.y - 2, 2)
    } else {
      g.fillStyle(pal.friso, 1)
      g.fillTriangle(figura.x - 4, figura.y - 3, figura.x + 3, figura.y, figura.x - 4, figura.y + 3)
    }

    // --- Mastros e velas, do fundo para a frente ------------------------------------------------
    const relativo = diferencaAngular(estado.rumo, vento.direcao)
    const alinhamento = Math.cos(relativo)
    const regulagem = Phaser.Math.Clamp(relativo * 0.45, -0.6, 0.6)
    let enchimento = (0.35 + 0.65 * vento.intensidade) * (0.45 + 0.55 * Math.abs(alinhamento))
    // Vento de proa: o pano panejando, com a barriga para trás.
    if (alinhamento < -0.3) enchimento *= -0.55
    const tremor = ruidoSuave(tempo * 7, this.semente) * 0.12 * (1.2 - vento.intensidade)

    const ordem = p.mastros
      .map((s, i) => ({ s, i, x: -p.comprimento / 2 + s * p.comprimento }))
      .sort((a, b) => this.projetar({ x: a.x, y: 0, z: 0 }).profundidade - this.projetar({ x: b.x, y: 0, z: 0 }).profundidade)

    for (const m of ordem) {
      this.linha({ x: m.x, y: 0, z: p.alturaDeck }, { x: m.x, y: 0, z: p.alturaMastro }, 2.6, pal.mastro)
      this.desenharVela(m.x, regulagem, (enchimento + tremor) * 9)
      // Cesto da gávea.
      const topo = this.projetar({ x: m.x, y: 0, z: p.alturaMastro - 6 })
      g.fillStyle(pal.mastro, 1)
      g.fillEllipse(topo.x, topo.y, 7, 4)
    }

    // --- Bandeira no topo do primeiro mastro, a favor do vento ---------------------------------------
    const xm = -p.comprimento / 2 + p.mastros[p.mastros.length - 1] * p.comprimento
    const localVento = vento.direcao - estado.rumo + ruidoSuave(tempo * 5.5, this.semente + 3) * 0.3
    const comprimentoBandeira = 12 + 6 * vento.intensidade
    const onda = ruidoSuave(tempo * 9, this.semente + 5) * 2
    const base0 = { x: xm, y: 0, z: p.alturaMastro }
    const base1 = { x: xm, y: 0, z: p.alturaMastro - 7 }
    const ponta = {
      x: xm + Math.cos(localVento) * comprimentoBandeira,
      y: Math.sin(localVento) * comprimentoBandeira,
      z: p.alturaMastro - 3.5 + onda,
    }
    this.poligono([base0, ponta, base1], pal.bandeira)
    const marca = this.projetar({ x: xm + Math.cos(localVento) * 4, y: Math.sin(localVento) * 4, z: p.alturaMastro - 3.5 })
    g.fillStyle(pal.bandeiraDetalhe, 1)
    g.fillCircle(marca.x, marca.y, 1.6)
  }

  /**
   * Vela: superfície vertical presa à verga, girada pela regulagem e com
   * barriga para a frente. Uma grade 5×4 de quadriláteros; a segunda fileira
   * leva a faixa colorida.
   */
  private desenharVela(xm: number, regulagem: number, barriga: number) {
    const p = this.projeto
    const pal = p.paleta
    const z0 = p.alturaDeck + 12
    const z1 = p.alturaMastro - 8
    const eixo = { x: -Math.sin(regulagem), y: Math.cos(regulagem) }
    const normal = { x: Math.cos(regulagem), y: Math.sin(regulagem) }
    const colunas = 5
    const linhas = 4

    const ponto = (u: number, v: number): P3 => {
      const b = barriga * Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(Math.PI * (0.25 + v * 0.75)))
      const a = (u - 0.5) * p.larguraVela * (1 - v * 0.12)
      return { x: xm + eixo.x * a + normal.x * b, y: eixo.y * a + normal.y * b, z: z0 + v * (z1 - z0) }
    }

    // Luz: a vela voltada para o sol fica mais clara.
    const normalMundo = this.cosR * normal.x - this.sinR * normal.y
    const luz = 0.86 + 0.14 * Math.sign(barriga || 1) * normalMundo

    for (let j = 0; j < linhas; j++) {
      for (let i = 0; i < colunas; i++) {
        const u0 = i / colunas
        const u1 = (i + 1) / colunas
        const v0 = j / linhas
        const v1 = (j + 1) / linhas
        const base = j === 1 ? pal.velaDetalhe : pal.vela
        const sombra = 0.92 + 0.08 * Math.sin(Math.PI * (u0 + u1) * 0.5)
        this.poligono([ponto(u0, v0), ponto(u1, v0), ponto(u1, v1), ponto(u0, v1)], misturar(0x000000, base, Math.min(1, luz * sombra)))
      }
    }
    this.contornoLinha([ponto(0, 0), ponto(1, 0), ponto(1, 1), ponto(0, 1)], 1, 0x000000, 0.25)
    // Verga no topo.
    this.linha(ponto(0, 1), ponto(1, 1), 2, pal.mastro)

    // Emblema no meio da vela, achatado conforme o ângulo em que é visto.
    const centro = this.projetar(ponto(0.5, 0.62))
    const largura = Math.abs(this.cosR * eixo.x - this.sinR * eixo.y) * 11 + 1.5
    const g = this.g
    g.fillStyle(this.tipo === 'pirata' ? 0x1b1b1f : pal.velaDetalhe, 0.9)
    g.fillEllipse(centro.x, centro.y, largura, 10)
    g.fillStyle(0xf4f0e6, 0.95)
    g.fillEllipse(centro.x, centro.y - 1, largura * 0.45, 4.5)
  }

  pontoDaPopa(estado: EstadoViagem) {
    return {
      x: estado.posicao.x - Math.cos(estado.rumo) * this.meioComprimento * 0.92,
      y: estado.posicao.y - Math.sin(estado.rumo) * this.meioComprimento * 0.92,
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
