import type { Rng } from './texturas'

/**
 * Jolly Roger de um pirata inventado, sorteada a cada partida: caveira (de
 * maxilar fino ou largo, dentes ou não), um acessório (chapéu de três bicos,
 * bandana, chifres, coroa), uma marca (tapa-olho, cicatriz, olhos acesos) e o
 * que cruza atrás (ossos, sabres ou âncora), nas cores do pano e do símbolo.
 */

type Cor = [number, number, number]

export type JollyRoger = {
  /** cor do pano das velas */
  pano: Cor
  /** cor da bandeira (o mesmo tom, mais escuro) */
  bandeira: Cor
  /** cor do símbolo */
  simbolo: Cor
  /** cor do acessório (chapéu, bandana...) */
  acessorioCor: Cor
  maxilar: 'fino' | 'largo'
  dentes: boolean
  acessorio: 'nenhum' | 'chapeu' | 'bandana' | 'chifres' | 'coroa'
  marca: 'nenhuma' | 'tapaolho' | 'cicatriz' | 'olhosAcesos'
  cruzados: 'ossos' | 'sabres' | 'ancora'
}

const PANOS: Cor[] = [
  [36, 32, 32],
  [150, 30, 36],
  [34, 48, 92],
  [30, 74, 50],
  [86, 44, 104],
  [120, 86, 48],
  [196, 180, 150],
]
const SIMBOLOS: Cor[] = [
  [238, 232, 216],
  [236, 196, 84],
  [214, 54, 48],
  [240, 240, 240],
]

const um = <T>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
const escurecer = (c: Cor, k: number): Cor => [c[0] * k, c[1] * k, c[2] * k]
const luz = (c: Cor) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
const dist = (a: Cor, b: Cor) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** sorteia uma bandeira; `evitar` é o pano do outro navio (para não repetir) */
export function sortearJollyRoger(r: Rng, evitar?: Cor): JollyRoger {
  const pano = um(
    r,
    PANOS.filter((p) => !evitar || dist(p, evitar) > 1),
  )
  // o símbolo tem de aparecer no pano (claro no escuro, escuro no claro)
  const simbolo = luz(pano) > 150 ? ([30, 26, 26] as Cor) : um(r, SIMBOLOS.filter((s) => dist(s, pano) > 120))
  const acessorioCor: Cor = dist(pano, [150, 30, 36]) < 60 ? [24, 22, 22] : um(r, [[24, 22, 22], [160, 30, 34], [70, 40, 22]] as Cor[])
  return {
    pano,
    bandeira: luz(pano) > 150 ? pano : escurecer(pano, 0.55),
    simbolo,
    acessorioCor,
    maxilar: r() < 0.5 ? 'fino' : 'largo',
    dentes: r() < 0.7,
    acessorio: um(r, ['nenhum', 'chapeu', 'bandana', 'chifres', 'coroa'] as const),
    marca: um(r, ['nenhuma', 'tapaolho', 'cicatriz', 'olhosAcesos'] as const),
    cruzados: um(r, ['ossos', 'ossos', 'sabres', 'ancora'] as const),
  }
}

const rgb = (c: Cor) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`

/**
 * Desenha o símbolo com centro em (cx, cy); `s` é o raio do crânio em pixels.
 * `fundo` é a cor do pano onde ele vai (os buracos dos olhos são dela).
 */
export function desenharJollyRoger(g: CanvasRenderingContext2D, d: JollyRoger, cx: number, cy: number, s: number, fundo: Cor) {
  const sim = rgb(d.simbolo)
  const buraco = rgb(escurecer(fundo, 0.55))
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'

  // ---- o que cruza atrás da caveira
  g.fillStyle = sim
  g.strokeStyle = sim
  if (d.cruzados === 'ossos') {
    for (const lado of [-1, 1]) {
      const ax = cx - 1.75 * s
      const ay = cy + (0.55 - lado * 0.9) * s
      const bx = cx + 1.75 * s
      const by = cy + (0.55 + lado * 0.9) * s
      g.lineWidth = s * 0.32
      g.beginPath()
      g.moveTo(ax, ay)
      g.lineTo(bx, by)
      g.stroke()
      for (const [x, y] of [
        [ax, ay],
        [bx, by],
      ]) {
        const nx = -(by - ay)
        const ny = bx - ax
        const n = Math.hypot(nx, ny)
        for (const k of [-1, 1]) {
          g.beginPath()
          g.arc(x + (nx / n) * k * s * 0.17, y + (ny / n) * k * s * 0.17, s * 0.22, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
  } else if (d.cruzados === 'sabres') {
    for (const lado of [-1, 1]) {
      // lâmina curva de cima até embaixo do lado oposto, guarda e punho
      const px = cx + lado * 1.5 * s
      const py = cy + 1.45 * s
      const tx = cx - lado * 1.6 * s
      const ty = cy - 1.25 * s
      g.lineWidth = s * 0.26
      g.beginPath()
      g.moveTo(px - lado * 0.25 * s, py - 0.25 * s)
      g.quadraticCurveTo(cx + lado * 0.4 * s, cy - 0.9 * s, tx, ty)
      g.stroke()
      g.lineWidth = s * 0.16
      g.beginPath()
      g.moveTo(px - lado * 0.55 * s, py - 0.05 * s)
      g.lineTo(px + lado * 0.05 * s, py - 0.55 * s)
      g.stroke()
      g.lineWidth = s * 0.2
      g.beginPath()
      g.moveTo(px - lado * 0.2 * s, py - 0.2 * s)
      g.lineTo(px + lado * 0.15 * s, py + 0.15 * s)
      g.stroke()
    }
  } else {
    // âncora em pé atrás da caveira
    g.lineWidth = s * 0.26
    g.beginPath()
    g.moveTo(cx, cy - 1.8 * s)
    g.lineTo(cx, cy + 1.7 * s)
    g.stroke()
    g.beginPath()
    g.moveTo(cx - 0.8 * s, cy - 1.2 * s)
    g.lineTo(cx + 0.8 * s, cy - 1.2 * s)
    g.stroke()
    g.beginPath()
    g.arc(cx, cy + 0.6 * s, 1.15 * s, Math.PI * 0.15, Math.PI * 0.85)
    g.stroke()
    g.lineWidth = s * 0.14
    g.beginPath()
    g.arc(cx, cy - 2.0 * s, 0.25 * s, 0, Math.PI * 2)
    g.stroke()
  }

  // ---- crânio e maxilar (com um contorno do pano para separar do que cruza)
  const largo = d.maxilar === 'largo' ? 1.15 : 0.95
  const cranio = () => {
    g.beginPath()
    g.ellipse(cx, cy - 0.25 * s, s, s * 0.95, 0, 0, Math.PI * 2)
    g.moveTo(cx - largo * 0.62 * s, cy + 0.35 * s)
    g.roundRect(cx - largo * 0.62 * s, cy + 0.2 * s, largo * 1.24 * s, 0.7 * s, 0.22 * s)
  }
  g.fillStyle = rgb(fundo)
  g.save()
  g.translate(cx, cy)
  g.scale(1.1, 1.08)
  g.translate(-cx, -cy)
  cranio()
  g.fill()
  g.restore()
  g.fillStyle = sim
  cranio()
  g.fill()

  // ---- olhos, nariz, dentes
  g.fillStyle = buraco
  for (const lado of [-1, 1]) {
    g.beginPath()
    g.ellipse(cx + lado * 0.38 * s, cy - 0.2 * s, 0.25 * s, 0.28 * s, lado * 0.25, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.moveTo(cx, cy + 0.08 * s)
  g.lineTo(cx - 0.13 * s, cy + 0.32 * s)
  g.lineTo(cx + 0.13 * s, cy + 0.32 * s)
  g.closePath()
  g.fill()
  if (d.dentes) {
    g.strokeStyle = buraco
    g.lineWidth = Math.max(1, s * 0.07)
    for (let i = -2; i <= 2; i++) {
      g.beginPath()
      g.moveTo(cx + i * 0.2 * s * largo, cy + 0.55 * s)
      g.lineTo(cx + i * 0.2 * s * largo, cy + 0.85 * s)
      g.stroke()
    }
  }

  // ---- marca
  if (d.marca === 'tapaolho') {
    g.strokeStyle = rgb(d.acessorioCor)
    g.lineWidth = Math.max(1, s * 0.08)
    g.beginPath()
    g.moveTo(cx - 1.0 * s, cy - 0.65 * s)
    g.lineTo(cx + 0.95 * s, cy + 0.05 * s)
    g.stroke()
    g.fillStyle = rgb(d.acessorioCor)
    g.beginPath()
    g.ellipse(cx + 0.38 * s, cy - 0.2 * s, 0.32 * s, 0.3 * s, 0.25, 0, Math.PI * 2)
    g.fill()
  } else if (d.marca === 'cicatriz') {
    g.strokeStyle = buraco
    g.lineWidth = Math.max(1, s * 0.09)
    g.beginPath()
    g.moveTo(cx - 0.75 * s, cy - 0.85 * s)
    g.lineTo(cx - 0.05 * s, cy + 0.2 * s)
    g.stroke()
    for (let i = 0; i < 3; i++) {
      const k = 0.25 + i * 0.25
      const x = cx - 0.75 * s + 0.7 * s * k
      const y = cy - 0.85 * s + 1.05 * s * k
      g.beginPath()
      g.moveTo(x - 0.12 * s, y + 0.08 * s)
      g.lineTo(x + 0.12 * s, y - 0.08 * s)
      g.stroke()
    }
  } else if (d.marca === 'olhosAcesos') {
    g.fillStyle = 'rgb(255,70,40)'
    for (const lado of [-1, 1]) {
      g.beginPath()
      g.arc(cx + lado * 0.38 * s, cy - 0.18 * s, 0.1 * s, 0, Math.PI * 2)
      g.fill()
    }
  }

  // ---- acessório
  const ac = rgb(d.acessorioCor)
  if (d.acessorio === 'chapeu') {
    // chapéu de três bicos com a faixa na aba
    g.fillStyle = ac
    g.beginPath()
    g.moveTo(cx - 1.55 * s, cy - 0.75 * s)
    g.quadraticCurveTo(cx - 0.9 * s, cy - 1.0 * s, cx - 0.75 * s, cy - 1.75 * s)
    g.quadraticCurveTo(cx, cy - 2.25 * s, cx + 0.75 * s, cy - 1.75 * s)
    g.quadraticCurveTo(cx + 0.9 * s, cy - 1.0 * s, cx + 1.55 * s, cy - 0.75 * s)
    g.quadraticCurveTo(cx, cy - 1.2 * s, cx - 1.55 * s, cy - 0.75 * s)
    g.fill()
    g.strokeStyle = sim
    g.lineWidth = Math.max(1, s * 0.08)
    g.beginPath()
    g.moveTo(cx - 1.25 * s, cy - 0.9 * s)
    g.quadraticCurveTo(cx, cy - 1.32 * s, cx + 1.25 * s, cy - 0.9 * s)
    g.stroke()
  } else if (d.acessorio === 'bandana') {
    g.fillStyle = ac
    g.beginPath()
    g.ellipse(cx, cy - 0.55 * s, 1.05 * s, 0.75 * s, 0, Math.PI, Math.PI * 2)
    g.fill()
    g.fillRect(cx - 1.05 * s, cy - 0.62 * s, 2.1 * s, 0.2 * s)
    // nó e as duas pontas soltas
    g.beginPath()
    g.arc(cx + 1.05 * s, cy - 0.55 * s, 0.18 * s, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(cx + 1.1 * s, cy - 0.55 * s)
    g.lineTo(cx + 1.75 * s, cy - 0.15 * s)
    g.lineTo(cx + 1.55 * s, cy - 0.0 * s)
    g.closePath()
    g.moveTo(cx + 1.1 * s, cy - 0.5 * s)
    g.lineTo(cx + 1.6 * s, cy + 0.35 * s)
    g.lineTo(cx + 1.35 * s, cy + 0.4 * s)
    g.closePath()
    g.fill()
    g.fillStyle = sim
    for (const [x, y] of [
      [-0.5, -0.9],
      [0.1, -1.05],
      [0.6, -0.85],
    ]) {
      g.beginPath()
      g.arc(cx + x * s, cy + y * s, 0.08 * s, 0, Math.PI * 2)
      g.fill()
    }
  } else if (d.acessorio === 'chifres') {
    g.fillStyle = sim
    for (const lado of [-1, 1]) {
      g.beginPath()
      g.moveTo(cx + lado * 0.55 * s, cy - 0.95 * s)
      g.quadraticCurveTo(cx + lado * 1.5 * s, cy - 1.2 * s, cx + lado * 1.35 * s, cy - 2.05 * s)
      g.quadraticCurveTo(cx + lado * 1.15 * s, cy - 1.45 * s, cx + lado * 0.85 * s, cy - 0.75 * s)
      g.closePath()
      g.fill()
    }
  } else if (d.acessorio === 'coroa') {
    g.fillStyle = 'rgb(236,196,84)'
    g.beginPath()
    g.moveTo(cx - 0.8 * s, cy - 0.95 * s)
    g.lineTo(cx - 0.85 * s, cy - 1.75 * s)
    g.lineTo(cx - 0.4 * s, cy - 1.3 * s)
    g.lineTo(cx, cy - 1.95 * s)
    g.lineTo(cx + 0.4 * s, cy - 1.3 * s)
    g.lineTo(cx + 0.85 * s, cy - 1.75 * s)
    g.lineTo(cx + 0.8 * s, cy - 0.95 * s)
    g.closePath()
    g.fill()
    g.fillStyle = 'rgb(200,40,48)'
    g.beginPath()
    g.arc(cx, cy - 1.15 * s, 0.13 * s, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}
