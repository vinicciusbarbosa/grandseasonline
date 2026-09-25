import type { Mundo, Vetor } from '../mundo/Mundo'

/**
 * Planejamento de rota. O jogador clica num ponto; o A* acha um caminho pela
 * grade lógica e o "string pulling" corta os degraus, deixando poucos pontos
 * ligados por retas. É essa lista curta que o navio persegue com curvas suaves
 * — a grade existe, mas o jogador não enxerga os quadrados.
 */

const FOLGA_CONFORTAVEL = 2.5

export function planejarRota(mundo: Mundo, origem: Vetor, destino: Vetor): Vetor[] | null {
  const inicio = celulaLivreProxima(mundo, origem)
  const fim = celulaLivreProxima(mundo, destino)
  if (!inicio || !fim) return null

  const celulas = aEstrela(mundo, inicio, fim)
  if (!celulas) return null

  const pontos = celulas.map(([cx, cy]) => mundo.centroDa(cx, cy))
  // Ponta exata: o navio sai de onde está e chega onde o jogador clicou.
  pontos[0] = { ...origem }
  if (mundo.navegavel(destino)) pontos[pontos.length - 1] = { ...destino }

  return suavizar(mundo, pontos)
}

function celulaLivreProxima(mundo: Mundo, p: Vetor): [number, number] | null {
  const { cx, cy } = mundo.celulaDe(p)
  if (mundo.navegavelCelula(cx, cy)) return [cx, cy]
  for (let raio = 1; raio <= 8; raio++) {
    let melhor: [number, number] | null = null
    let melhorD = Infinity
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue
        if (!mundo.navegavelCelula(cx + dx, cy + dy)) continue
        const d = dx * dx + dy * dy
        if (d < melhorD) {
          melhorD = d
          melhor = [cx + dx, cy + dy]
        }
      }
    }
    if (melhor) return melhor
  }
  return null
}

function aEstrela(mundo: Mundo, [sx, sy]: [number, number], [ex, ey]: [number, number]) {
  const { largura, altura } = mundo
  const total = largura * altura
  const custo = new Float32Array(total).fill(Infinity)
  const veioDe = new Int32Array(total).fill(-1)
  const fechado = new Uint8Array(total)
  const heap = new HeapMinimo()

  const inicio = sy * largura + sx
  const alvo = ey * largura + ex
  custo[inicio] = 0
  heap.inserir(inicio, heuristica(sx, sy, ex, ey))

  const vizinhos = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ] as const

  while (heap.tamanho > 0) {
    const atual = heap.remover()
    if (atual === alvo) break
    if (fechado[atual]) continue
    fechado[atual] = 1
    const x = atual % largura
    const y = (atual - x) / largura

    for (const [dx, dy, passo] of vizinhos) {
      const nx = x + dx
      const ny = y + dy
      if (!mundo.navegavelCelula(nx, ny)) continue
      // Diagonal não corta quina de terra.
      if (dx !== 0 && dy !== 0 && (!mundo.navegavelCelula(x + dx, y) || !mundo.navegavelCelula(x, y + dy))) continue
      const n = ny * largura + nx
      if (fechado[n]) continue
      // Prefere mar aberto: colar na costa custa mais, então a rota não raspa as ilhas.
      const folga = mundo.folga[n]
      const penalidade = folga < FOLGA_CONFORTAVEL ? (FOLGA_CONFORTAVEL - folga) * 1.2 : 0
      const novo = custo[atual] + passo * (1 + penalidade)
      if (novo < custo[n]) {
        custo[n] = novo
        veioDe[n] = atual
        heap.inserir(n, novo + heuristica(nx, ny, ex, ey))
      }
    }
  }

  if (veioDe[alvo] === -1 && alvo !== inicio) return null
  const caminho: [number, number][] = []
  for (let i = alvo; i !== -1; i = veioDe[i]) {
    caminho.push([i % largura, Math.floor(i / largura)])
  }
  return caminho.reverse()
}

function heuristica(x: number, y: number, ex: number, ey: number) {
  const dx = Math.abs(x - ex)
  const dy = Math.abs(y - ey)
  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)
}

/** Mantém só os pontos necessários: de cada âncora, pula até o ponto mais distante ainda visível. */
function suavizar(mundo: Mundo, pontos: Vetor[]): Vetor[] {
  if (pontos.length <= 2) return pontos
  const resultado = [pontos[0]]
  let ancora = 0
  while (ancora < pontos.length - 1) {
    let proximo = ancora + 1
    for (let j = pontos.length - 1; j > ancora + 1; j--) {
      if (linhaLivre(mundo, pontos[ancora], pontos[j])) {
        proximo = j
        break
      }
    }
    resultado.push(pontos[proximo])
    ancora = proximo
  }
  return resultado
}

export function linhaLivre(mundo: Mundo, a: Vetor, b: Vetor) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const passos = Math.ceil(dist / (mundo.celula * 0.25))
  const margem = mundo.celula * 0.45
  for (let i = 0; i <= passos; i++) {
    const t = i / passos
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    // Testa o ponto e uma "largura de casco" para os lados.
    if (!mundo.navegavel({ x, y })) return false
    if (!mundo.navegavel({ x: x + margem, y }) || !mundo.navegavel({ x: x - margem, y })) return false
    if (!mundo.navegavel({ x, y: y + margem }) || !mundo.navegavel({ x, y: y - margem })) return false
  }
  return true
}

export function comprimentoRestante(pontos: Vetor[], desde: number, posicao: Vetor) {
  if (desde >= pontos.length) return 0
  let total = Math.hypot(pontos[desde].x - posicao.x, pontos[desde].y - posicao.y)
  for (let i = desde; i < pontos.length - 1; i++) {
    total += Math.hypot(pontos[i + 1].x - pontos[i].x, pontos[i + 1].y - pontos[i].y)
  }
  return total
}

class HeapMinimo {
  private itens: number[] = []
  private prioridades: number[] = []

  get tamanho() {
    return this.itens.length
  }

  inserir(item: number, prioridade: number) {
    this.itens.push(item)
    this.prioridades.push(prioridade)
    let i = this.itens.length - 1
    while (i > 0) {
      const pai = (i - 1) >> 1
      if (this.prioridades[pai] <= this.prioridades[i]) break
      this.trocar(i, pai)
      i = pai
    }
  }

  remover() {
    const topo = this.itens[0]
    const ultimoItem = this.itens.pop()!
    const ultimaPrioridade = this.prioridades.pop()!
    if (this.itens.length > 0) {
      this.itens[0] = ultimoItem
      this.prioridades[0] = ultimaPrioridade
      let i = 0
      for (;;) {
        const e = i * 2 + 1
        const d = e + 1
        let menor = i
        if (e < this.itens.length && this.prioridades[e] < this.prioridades[menor]) menor = e
        if (d < this.itens.length && this.prioridades[d] < this.prioridades[menor]) menor = d
        if (menor === i) break
        this.trocar(i, menor)
        i = menor
      }
    }
    return topo
  }

  private trocar(a: number, b: number) {
    ;[this.itens[a], this.itens[b]] = [this.itens[b], this.itens[a]]
    ;[this.prioridades[a], this.prioridades[b]] = [this.prioridades[b], this.prioridades[a]]
  }
}
