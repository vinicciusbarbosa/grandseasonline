import dados from './mundo.json'

/**
 * Camada lógica do oceano: o que é navegável, onde ficam as ilhas e as
 * correntes. Nada aqui sabe de Phaser ou de React — é o pedaço que um dia vai
 * para o servidor (C#) e é o mesmo que a Unity consumiria.
 *
 * Unidade: pixels do mundo. Uma célula lógica tem `celula` px (40, como o
 * SQUARE_SIZE do legado). Os dados são gerados por `scripts/gerar_mundo.py`.
 */

export type Vetor = { x: number; y: number }

export type Ilha = {
  id: number
  nome: string
  mar: number
  /** Célula da doca, em coordenadas locais do recorte. */
  x: number
  y: number
}

export type Corrente = { dx: number; dy: number; forca: number }

export type Redemoinho = { x: number; y: number; raio: number }

/** Raio da zona segura em volta da doca, em células. */
export const RAIO_ZONA_SEGURA = 3

export class Mundo {
  readonly largura = dados.largura
  readonly altura = dados.altura
  readonly celula = dados.celula
  /** Canto do recorte no mundo legado, para exibir as coordenadas originais. */
  readonly origem = { x: dados.origem[0], y: dados.origem[1] }
  readonly larguraPx = dados.largura * dados.celula
  readonly alturaPx = dados.altura * dados.celula
  readonly ilhas: readonly Ilha[] = dados.ilhas
  readonly redemoinhos: readonly Redemoinho[] = (dados.redemoinhos as number[][]).map(([x, y, raio]) => ({ x, y, raio }))

  /** 1 = bloqueada (terra, rocha, recife). */
  readonly bloqueio: Uint8Array
  /** Distância, em células, até a célula bloqueada mais próxima. */
  readonly folga: Float32Array
  private readonly correntes = new Map<number, Corrente>()

  constructor() {
    this.bloqueio = new Uint8Array(this.largura * this.altura)
    let i = 0
    let valor = 0
    for (const tamanho of dados.bloqueioRle) {
      this.bloqueio.fill(valor, i, i + tamanho)
      i += tamanho
      valor = 1 - valor
    }

    for (const [x, y, direcao, intensidade] of dados.correntes) {
      // Mesma convenção do legado: rotação de direcao/8 volta, fluxo "para cima" no sprite.
      const angulo = (direcao / 8) * Math.PI * 2
      this.correntes.set(this.indice(x, y), {
        dx: Math.sin(angulo),
        dy: -Math.cos(angulo),
        forca: intensidade,
      })
    }

    this.folga = calcularFolga(this.bloqueio, this.largura, this.altura)
  }

  indice(cx: number, cy: number) {
    return cy * this.largura + cx
  }

  dentro(cx: number, cy: number) {
    return cx >= 0 && cy >= 0 && cx < this.largura && cy < this.altura
  }

  celulaDe(p: Vetor) {
    return { cx: Math.floor(p.x / this.celula), cy: Math.floor(p.y / this.celula) }
  }

  centroDa(cx: number, cy: number): Vetor {
    return { x: (cx + 0.5) * this.celula, y: (cy + 0.5) * this.celula }
  }

  navegavelCelula(cx: number, cy: number) {
    return this.dentro(cx, cy) && this.bloqueio[this.indice(cx, cy)] === 0
  }

  navegavel(p: Vetor) {
    const { cx, cy } = this.celulaDe(p)
    return this.navegavelCelula(cx, cy)
  }

  folgaEm(p: Vetor) {
    const { cx, cy } = this.celulaDe(p)
    return this.dentro(cx, cy) ? this.folga[this.indice(cx, cy)] : 0
  }

  correnteEm(p: Vetor): Corrente | undefined {
    const { cx, cy } = this.celulaDe(p)
    return this.dentro(cx, cy) ? this.correntes.get(this.indice(cx, cy)) : undefined
  }

  posicaoDaDoca(ilha: Ilha): Vetor {
    return this.centroDa(ilha.x, ilha.y)
  }

  /** Ilha cuja doca está mais perto de `p`, se estiver a até `raioCelulas`. */
  ilhaProxima(p: Vetor, raioCelulas: number): Ilha | undefined {
    let melhor: Ilha | undefined
    let melhorDist = raioCelulas * this.celula
    for (const ilha of this.ilhas) {
      const doca = this.posicaoDaDoca(ilha)
      const d = Math.hypot(doca.x - p.x, doca.y - p.y)
      if (d <= melhorDist) {
        melhor = ilha
        melhorDist = d
      }
    }
    return melhor
  }

  /**
   * Mar do legado (`get_mar` em Funcoes/ilhas.php), a partir da coordenada
   * global. As faixas entre os mares são o Calm Belt.
   */
  marEm(p: Vetor): number {
    const x = p.x / this.celula + this.origem.x
    const y = p.y / this.celula + this.origem.y
    if (y <= 95) return x <= 230 ? 2 : 1
    if (y >= 265) return x <= 230 ? 3 : 4
    if (y >= 105 && y <= 255) return x <= 230 ? 6 : 5
    return 7
  }

  nomeDoMar(mar: number) {
    return (dados.mares as Record<string, string>)[String(mar)] ?? 'Mar desconhecido'
  }

  /** Coordenada no formato que o jogo sempre mostrou: "xº L, yº N". */
  coordenadaLegada(p: Vetor) {
    const x = Math.floor(p.x / this.celula) + this.origem.x
    const y = Math.floor(p.y / this.celula) + this.origem.y
    return `${x}º L, ${359 - y}º N`
  }
}

/** Distância chamfer (1, √2) até a célula bloqueada mais próxima. */
function calcularFolga(bloqueio: Uint8Array, largura: number, altura: number) {
  const inf = 1e6
  const d = new Float32Array(largura * altura)
  for (let i = 0; i < d.length; i++) d[i] = bloqueio[i] ? 0 : inf
  const r2 = Math.SQRT2

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = y * largura + x
      if (d[i] === 0) continue
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (y > 0) {
        v = Math.min(v, d[i - largura] + 1)
        if (x > 0) v = Math.min(v, d[i - largura - 1] + r2)
        if (x < largura - 1) v = Math.min(v, d[i - largura + 1] + r2)
      }
      d[i] = v
    }
  }
  for (let y = altura - 1; y >= 0; y--) {
    for (let x = largura - 1; x >= 0; x--) {
      const i = y * largura + x
      if (d[i] === 0) continue
      let v = d[i]
      if (x < largura - 1) v = Math.min(v, d[i + 1] + 1)
      if (y < altura - 1) {
        v = Math.min(v, d[i + largura] + 1)
        if (x < largura - 1) v = Math.min(v, d[i + largura + 1] + r2)
        if (x > 0) v = Math.min(v, d[i + largura - 1] + r2)
      }
      d[i] = v
    }
  }
  return d
}
