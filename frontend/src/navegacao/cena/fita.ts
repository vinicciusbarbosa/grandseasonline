import type Phaser from 'phaser'

type Ponto = { x: number; y: number }

/**
 * Fita suave e afilada: a curva passa por Catmull-Rom (sem quinas) e é
 * preenchida como UM polígono, com largura variando ao longo do caminho.
 * Traços feitos com lineBetween mostram as emendas entre segmentos — é o
 * "quadrado" que aparecia no vento e nas partículas.
 *
 * `largura(t)` recebe 0 no início (cauda) e 1 no fim (cabeça).
 */
export function desenharFita(
  g: Phaser.GameObjects.Graphics,
  pontos: Ponto[],
  largura: (t: number) => number,
  cor: number,
  alfa: number,
  subdivisoes = 3,
) {
  if (pontos.length < 2 || alfa <= 0.01) return
  const curva = suavizar(pontos, subdivisoes)
  const n = curva.length
  const esquerda: Ponto[] = []
  const direita: Ponto[] = []
  for (let i = 0; i < n; i++) {
    const a = curva[Math.max(0, i - 1)]
    const b = curva[Math.min(n - 1, i + 1)]
    let dx = b.x - a.x
    let dy = b.y - a.y
    const d = Math.hypot(dx, dy) || 1
    dx /= d
    dy /= d
    const w = largura(i / (n - 1)) / 2
    esquerda.push({ x: curva[i].x - dy * w, y: curva[i].y + dx * w })
    direita.push({ x: curva[i].x + dy * w, y: curva[i].y - dx * w })
  }
  g.fillStyle(cor, alfa)
  g.beginPath()
  g.moveTo(esquerda[0].x, esquerda[0].y)
  for (let i = 1; i < n; i++) g.lineTo(esquerda[i].x, esquerda[i].y)
  for (let i = n - 1; i >= 0; i--) g.lineTo(direita[i].x, direita[i].y)
  g.closePath()
  g.fillPath()
}

/** Catmull-Rom: passa por todos os pontos, com curva contínua entre eles. */
export function suavizar(pontos: Ponto[], subdivisoes: number): Ponto[] {
  if (pontos.length < 3) return pontos
  const saida: Ponto[] = []
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[Math.max(0, i - 1)]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[Math.min(pontos.length - 1, i + 2)]
    for (let s = 0; s < subdivisoes; s++) {
      const t = s / subdivisoes
      const t2 = t * t
      const t3 = t2 * t
      saida.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  saida.push(pontos[pontos.length - 1])
  return saida
}
