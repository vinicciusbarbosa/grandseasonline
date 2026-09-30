import * as THREE from 'three'

/**
 * Efeitos das skills no estilo do anime: desenho vetorial liso (sem pixel),
 * redesenhado a cada quadro num canvas próprio — contorno forte, 2–3 tons,
 * brilho, linhas de velocidade e faíscas.
 *
 *   corte, bala, adaga, punho, fogo, luz, gelo, fumaca, impacto, onda,
 *   tornado, aura, raio (Haki do Rei) e choque (dois Haki do Rei se chocando).
 *
 * Paletas: normal (cor do próprio efeito), armamento (tinta negra com borda
 * e brilho roxos) e rei (negro com vermelho vivo e raios negros e vermelhos).
 * Projéteis voam de um ponto a outro; estouros ficam num ponto e somem.
 */

export type TipoEfeito =
  | 'corte'
  | 'bala'
  | 'adaga'
  | 'punho'
  | 'fogo'
  | 'luz'
  | 'gelo'
  | 'fumaca'
  | 'impacto'
  | 'onda'
  | 'tornado'
  | 'aura'
  | 'raio'
  | 'choque'
  | 'chama'
  | 'bolaFogo'
  | 'explosaoFogo'
  | 'pilarFogo'
  | 'vagalume'
  | 'orbeLuz'
  | 'feixeLuz'
  | 'sabreLuz'
  | 'espinhoGelo'
  | 'vapor'
  | 'poeira'
  | 'faisca'
export type Paleta = 'normal' | 'armamento' | 'rei'

/** claro (miolo), cor (corpo), escuro (contorno), brilho (glow) */
type Cores = { claro: string; cor: string; escuro: string; brilho: string }

const CORES: Record<TipoEfeito, Cores> = {
  corte: { claro: '#ffffff', cor: '#bfe6ff', escuro: '#2f6fb8', brilho: '#8fd0ff' },
  bala: { claro: '#fffbe0', cor: '#ffd04a', escuro: '#a0480c', brilho: '#ffb030' },
  adaga: { claro: '#ffffff', cor: '#d6dbe6', escuro: '#3c4250', brilho: '#c8e0ff' },
  punho: { claro: '#fff2e0', cor: '#f0b080', escuro: '#6a3418', brilho: '#ffd0a0' },
  fogo: { claro: '#fffbd0', cor: '#ff9a1a', escuro: '#c0200a', brilho: '#ff6a00' },
  luz: { claro: '#ffffff', cor: '#fff27a', escuro: '#ffae00', brilho: '#fff0a0' },
  gelo: { claro: '#ffffff', cor: '#a8ecff', escuro: '#2a78c8', brilho: '#b8f4ff' },
  fumaca: { claro: '#ffffff', cor: '#d8dce4', escuro: '#6a7080', brilho: '#e8ecf4' },
  impacto: { claro: '#ffffff', cor: '#ffe27a', escuro: '#ff6a1a', brilho: '#ffcc40' },
  onda: { claro: '#ffffff', cor: '#f0dcb0', escuro: '#7a5a34', brilho: '#fff0d0' },
  tornado: { claro: '#ffffff', cor: '#d0ecff', escuro: '#4a86c0', brilho: '#c0e8ff' },
  aura: { claro: '#fff8d8', cor: '#ffcf5a', escuro: '#c8741a', brilho: '#ffd870' },
  raio: { claro: '#ff9a9a', cor: '#e0102a', escuro: '#050003', brilho: '#ff1030' },
  choque: { claro: '#ffb0b0', cor: '#e0102a', escuro: '#050003', brilho: '#ff1030' },
  chama: { claro: '#fff8c8', cor: '#ff9a1a', escuro: '#d0300a', brilho: '#ff6a00' },
  bolaFogo: { claro: '#fffbe0', cor: '#ffa020', escuro: '#c8200a', brilho: '#ff5a00' },
  explosaoFogo: { claro: '#fffbe0', cor: '#ff9a1a', escuro: '#b0200a', brilho: '#ff5a00' },
  pilarFogo: { claro: '#fff8c8', cor: '#ff8a1a', escuro: '#c0200a', brilho: '#ff5a00' },
  vagalume: { claro: '#f0ffe0', cor: '#6aff5a', escuro: '#1a9a2a', brilho: '#5aff6a' },
  orbeLuz: { claro: '#ffffff', cor: '#fff27a', escuro: '#ffb000', brilho: '#fff0a0' },
  feixeLuz: { claro: '#ffffff', cor: '#fff27a', escuro: '#ffb000', brilho: '#fff0a0' },
  sabreLuz: { claro: '#ffffff', cor: '#fff27a', escuro: '#ffb000', brilho: '#ffe860' },
  espinhoGelo: { claro: '#ffffff', cor: '#a8ecff', escuro: '#2a78c8', brilho: '#b8f4ff' },
  vapor: { claro: '#ffffff', cor: '#e8ecf2', escuro: '#9aa2b0', brilho: '#ffffff' },
  poeira: { claro: '#e8d0a0', cor: '#b08a5a', escuro: '#6a4a2a', brilho: '#d0b080' },
  faisca: { claro: '#ff9a9a', cor: '#e0102a', escuro: '#050003', brilho: '#ff1030' },
}
const HAKI: Record<Exclude<Paleta, 'normal'>, Cores> = {
  armamento: { claro: '#e8c8ff', cor: '#8a3ae0', escuro: '#07020c', brilho: '#a050ff' },
  rei: { claro: '#ffb0b0', cor: '#e0102a', escuro: '#050003', brilho: '#ff1030' },
}
/** efeitos de elemento brilham somando luz; os de Haki (tinta negra) não */
const SOMA = new Set<TipoEfeito>(['fogo', 'luz', 'gelo', 'aura', 'bala', 'chama', 'bolaFogo', 'explosaoFogo', 'pilarFogo', 'vagalume', 'orbeLuz', 'feixeLuz', 'sabreLuz'])

/** Língua de fogo subindo (base em x,y; altura h; largura w). */
function linguaFogo(g: G, x: number, y: number, w: number, h: number, curva: number) {
  g.beginPath()
  g.moveTo(x - w, y)
  g.bezierCurveTo(x - w * 1.1, y - h * 0.5, x + curva - w * 0.3, y - h * 0.8, x + curva, y - h)
  g.bezierCurveTo(x + curva + w * 0.3, y - h * 0.75, x + w * 1.1, y - h * 0.45, x + w, y)
  g.closePath()
  g.fill()
}

const S = 512 // resolução do canvas de cada efeito
const C = S / 2

function rng(s: number) {
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}
const suave = (x: number) => x * x * (3 - 2 * x)
const entre = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)))

type G = CanvasRenderingContext2D

/** Raio quebrado de (x,y) na direção `a`, com `n` segmentos de `passo`. */
function caminhoRaio(r: () => number, x: number, y: number, a: number, n: number, passo: number) {
  const pts: [number, number][] = [[x, y]]
  for (let k = 0; k < n; k++) {
    a += (r() - 0.5) * 1.3
    x += Math.cos(a) * passo * (0.6 + r() * 0.8)
    y += Math.sin(a) * passo * (0.6 + r() * 0.8)
    pts.push([x, y])
  }
  return pts
}

/** Raio de Haki: brilho, borda colorida e miolo negro (como no anime). */
function desenharRaio(g: G, pts: [number, number][], larg: number, k: Cores, alfa = 1) {
  g.save()
  g.globalAlpha = alfa
  g.lineJoin = 'miter'
  g.lineCap = 'round'
  const traco = (w: number, cor: string, blur = 0) => {
    g.shadowBlur = blur
    g.shadowColor = k.brilho
    g.strokeStyle = cor
    g.lineWidth = w
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
  }
  traco(larg + 7, k.cor, 24)
  traco(larg + 3, k.claro)
  traco(larg, k.escuro)
  g.restore()
}

/**
 * Raio de Haki afilado e com galhos (como no anime): grosso perto da origem,
 * fino na ponta; brilho vermelho, borda vermelha e miolo negro.
 */
function raioAfilado(g: G, r: () => number, x: number, y: number, a: number, comp: number, w0: number, k: Cores, alfa: number, galhos = 2) {
  const n = 9
  const pts: [number, number][] = [[x, y]]
  for (let i = 0; i < n; i++) {
    a += (r() - 0.5) * 0.9
    const passo = (comp / n) * (0.7 + r() * 0.6)
    x += Math.cos(a) * passo
    y += Math.sin(a) * passo
    pts.push([x, y])
  }
  g.save()
  g.globalAlpha = alfa
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const passe = (extra: number, cor: string, blur: number) => {
    g.shadowBlur = blur
    g.shadowColor = k.brilho
    g.strokeStyle = cor
    for (let i = 0; i < n; i++) {
      g.lineWidth = w0 * (1 - i / n) + 1 + extra
      g.beginPath()
      g.moveTo(pts[i][0], pts[i][1])
      g.lineTo(pts[i + 1][0], pts[i + 1][1])
      g.stroke()
    }
  }
  passe(7, k.cor, 26)
  passe(2.5, k.claro, 0)
  passe(0, k.escuro, 0)
  g.restore()
  for (let b = 0; b < galhos; b++) {
    const i = 2 + Math.floor(r() * (n - 4))
    const [bx, by] = pts[i]
    raioAfilado(g, r, bx, by, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), comp * 0.4, w0 * (1 - i / n) * 0.6, k, alfa, 0)
  }
}

/** Estrela de pontas (faísca de golpe de mangá). */
function estrela(g: G, x: number, y: number, pontas: number, R: number, r: number, giro: number, r0: () => number) {
  g.beginPath()
  for (let i = 0; i < pontas * 2; i++) {
    const a = giro + (i / (pontas * 2)) * Math.PI * 2
    const rr = i % 2 ? r : R * (0.7 + r0() * 0.5)
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
}

/** Linhas de velocidade saindo do centro. */
function linhasVelocidade(g: G, n: number, r1: number, r2: number, cor: string, larg: number, r: () => number) {
  g.save()
  g.strokeStyle = cor
  g.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const a1 = r1 * (0.8 + r() * 0.4)
    const a2 = r2 * (0.7 + r() * 0.5)
    g.lineWidth = larg * (0.4 + r())
    g.beginPath()
    g.moveTo(C + Math.cos(a) * a1, C + Math.sin(a) * a1)
    g.lineTo(C + Math.cos(a) * a2, C + Math.sin(a) * a2)
    g.stroke()
  }
  g.restore()
}

function brilhoRadial(g: G, raio: number, cor: string, alfa: number) {
  const gr = g.createRadialGradient(C, C, 0, C, C, raio)
  gr.addColorStop(0, cor)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.save()
  g.globalAlpha = alfa
  g.fillStyle = gr
  g.fillRect(0, 0, S, S)
  g.restore()
}

/** Desenha o efeito no instante f (0–1), olhando para +x (projéteis giram o sprite). */
function pintar(g: G, tipo: TipoEfeito, f: number, k: Cores, paleta: Paleta, semente: number, t: number) {
  // ruído que muda algumas vezes por segundo (eletricidade, chamas)
  const r = rng(semente + Math.floor(t * 24) * 7919)
  const fixo = rng(semente)
  const haki = paleta !== 'normal'
  const some = 1 - entre(f, 0.7, 1)
  switch (tipo) {
    case 'corte': {
      // meia-lua afiada com rastro; com Haki, negra de borda colorida
      const a0 = -1.2
      const arco = 2.4
      g.save()
      g.shadowBlur = 30
      g.shadowColor = k.brilho
      for (let rastro = 3; rastro >= 0; rastro--) {
        const off = rastro * 16
        g.globalAlpha = (rastro ? 0.18 : 1) * some
        g.beginPath()
        g.arc(C - 40 - off, C, 150, a0, a0 + arco)
        g.arc(C - 90 - off, C, 118, a0 + arco - 0.05, a0 + 0.05, true)
        g.closePath()
        g.fillStyle = rastro ? k.cor : haki ? k.escuro : k.cor
        g.fill()
      }
      g.globalAlpha = some
      g.shadowBlur = 0
      g.lineWidth = haki ? 7 : 4
      g.strokeStyle = haki ? k.cor : k.escuro
      g.beginPath()
      g.arc(C - 40, C, 150, a0, a0 + arco)
      g.stroke()
      // fio branco da lâmina
      g.lineWidth = 3
      g.strokeStyle = haki ? k.claro : '#ffffff'
      g.beginPath()
      g.arc(C - 44, C, 144, a0 + 0.2, a0 + arco - 0.2)
      g.stroke()
      g.restore()
      if (paleta === 'rei') for (let i = 0; i < 3; i++) desenharRaio(g, caminhoRaio(r, C + 60, C + (r() - 0.5) * 200, r() * 6.3, 4, 26), 3, k, some)
      break
    }
    case 'bala':
    case 'adaga': {
      g.save()
      // rastro
      const gr = g.createLinearGradient(C - 220, C, C + 40, C)
      gr.addColorStop(0, 'rgba(0,0,0,0)')
      gr.addColorStop(1, haki ? k.cor : k.brilho)
      g.fillStyle = gr
      g.beginPath()
      g.moveTo(C - 220, C)
      g.lineTo(C + 30, C - 14)
      g.lineTo(C + 30, C + 14)
      g.closePath()
      g.fill()
      g.shadowBlur = 26
      g.shadowColor = k.brilho
      if (tipo === 'bala') {
        g.fillStyle = haki ? k.escuro : k.claro
        g.beginPath()
        g.ellipse(C + 30, C, 34, 13, 0, 0, Math.PI * 2)
        g.fill()
        g.lineWidth = 4
        g.strokeStyle = haki ? k.cor : k.cor
        g.stroke()
      } else {
        // adaga girando
        g.translate(C + 20, C)
        g.rotate(t * 30)
        g.fillStyle = haki ? k.escuro : k.cor
        g.beginPath()
        g.moveTo(-40, -8)
        g.lineTo(44, 0)
        g.lineTo(-40, 8)
        g.closePath()
        g.fill()
        g.lineWidth = 3
        g.strokeStyle = haki ? k.cor : k.escuro
        g.stroke()
        g.fillStyle = '#5a3a1a'
        g.fillRect(-60, -7, 22, 14)
      }
      g.restore()
      if (paleta === 'rei') desenharRaio(g, caminhoRaio(r, C + 30, C, Math.PI + (r() - 0.5), 5, 24), 2.5, k)
      break
    }
    case 'punho': {
      g.save()
      linhasVelocidade(g, 14, 90, 240, haki ? k.cor : k.claro, 5, r)
      g.shadowBlur = 24
      g.shadowColor = k.brilho
      g.fillStyle = haki ? k.escuro : k.cor
      g.fillRect(C - 200, C - 22, 200, 44) // braço esticado
      g.beginPath()
      g.ellipse(C + 30, C, 62, 54, 0, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = 6
      g.strokeStyle = haki ? k.cor : k.escuro
      g.stroke()
      g.lineWidth = 4
      for (let i = -1; i <= 1; i++) {
        g.beginPath()
        g.moveTo(C + 50, C + i * 22 - 8)
        g.lineTo(C + 78, C + i * 22 - 8)
        g.stroke()
      }
      g.restore()
      break
    }
    case 'fogo': {
      // línguas de fogo subindo, miolo branco
      const n = 16
      for (let camada = 0; camada < 3; camada++) {
        const cor = [k.escuro, k.cor, k.claro][camada]
        const esc = [1, 0.72, 0.42][camada]
        g.fillStyle = cor
        const rr = rng(semente + camada)
        for (let i = 0; i < n; i++) {
          const x = C + (rr() - 0.5) * 220 * esc * (0.5 + f)
          const sobe = ((rr() + t * 1.8) % 1)
          const y = C + 60 - sobe * 200 * esc
          const R = (40 - sobe * 30) * esc * (0.6 + f * 0.8) * some
          if (R <= 0) continue
          g.beginPath()
          g.moveTo(x - R, y)
          g.quadraticCurveTo(x - R * 0.8, y - R * 1.6, x, y - R * 2.6)
          g.quadraticCurveTo(x + R * 0.8, y - R * 1.6, x + R, y)
          g.arc(x, y, R, 0, Math.PI)
          g.fill()
        }
      }
      break
    }
    case 'luz': {
      brilhoRadial(g, 200 * (0.5 + f), k.brilho, 0.8 * some)
      g.save()
      g.strokeStyle = k.claro
      g.lineCap = 'round'
      for (let i = 0; i < 10; i++) {
        const a = fixo() * Math.PI * 2 + t * 2
        const R = (60 + fixo() * 160) * (0.4 + f)
        g.lineWidth = 3 + fixo() * 5
        g.beginPath()
        g.moveTo(C + Math.cos(a) * R * 0.3, C + Math.sin(a) * R * 0.3)
        g.lineTo(C + Math.cos(a) * R, C + Math.sin(a) * R)
        g.stroke()
      }
      g.fillStyle = '#ffffff'
      for (let i = 0; i < 8; i++) {
        estrela(g, C + (r() - 0.5) * 360, C + (r() - 0.5) * 360, 4, 16, 3, 0, () => 0.5)
        g.fill()
      }
      g.restore()
      break
    }
    case 'gelo': {
      // cristais que nascem do centro, com facetas claras
      g.save()
      g.globalAlpha = some
      for (let i = 0; i < 9; i++) {
        const a = fixo() * Math.PI * 2
        const L = (80 + fixo() * 120) * suave(Math.min(1, f * 3))
        const w = 18 + fixo() * 14
        g.save()
        g.translate(C, C)
        g.rotate(a)
        g.beginPath()
        g.moveTo(0, -w)
        g.lineTo(L, 0)
        g.lineTo(0, w)
        g.closePath()
        g.fillStyle = k.cor
        g.fill()
        g.beginPath()
        g.moveTo(0, -w)
        g.lineTo(L, 0)
        g.lineTo(0, 0)
        g.closePath()
        g.fillStyle = k.claro
        g.fill()
        g.lineWidth = 3
        g.strokeStyle = k.escuro
        g.beginPath()
        g.moveTo(0, -w)
        g.lineTo(L, 0)
        g.lineTo(0, w)
        g.stroke()
        g.restore()
      }
      g.restore()
      brilhoRadial(g, 160, k.brilho, 0.35 * some)
      break
    }
    case 'fumaca': {
      // nuvens redondas de anime: sombra embaixo, claro em cima, contorno
      const n = 12
      const rr = rng(semente)
      const bolas = Array.from({ length: n }, () => {
        const a = rr() * Math.PI * 2
        const d = rr() * 120 * (0.4 + f)
        return { x: C + Math.cos(a) * d, y: C + Math.sin(a) * d * 0.7 - f * 30, R: (40 + rr() * 40) * (0.6 + f * 0.6) }
      })
      g.save()
      g.globalAlpha = some
      g.fillStyle = k.escuro
      for (const b of bolas) {
        g.beginPath()
        g.arc(b.x, b.y, b.R + 5, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = k.cor
      for (const b of bolas) {
        g.beginPath()
        g.arc(b.x, b.y, b.R, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = k.claro
      for (const b of bolas) {
        g.beginPath()
        g.arc(b.x - b.R * 0.25, b.y - b.R * 0.3, b.R * 0.55, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
      break
    }
    case 'impacto': {
      // faísca de golpe de mangá: estrela de pontas, miolo branco, linhas de velocidade
      const cresce = suave(Math.min(1, f * 4))
      const R = 170 * cresce
      g.save()
      g.globalAlpha = some
      linhasVelocidade(g, 22, R * 0.6, R * 1.5, haki ? k.cor : k.claro, 4, r)
      g.shadowBlur = 30
      g.shadowColor = k.brilho
      g.fillStyle = haki ? k.cor : k.escuro
      estrela(g, C, C, 10, R, R * 0.38, f * 0.6, r)
      g.fill()
      g.shadowBlur = 0
      g.fillStyle = haki ? k.escuro : k.cor
      estrela(g, C, C, 10, R * 0.78, R * 0.3, f * 0.6 + 0.2, r)
      g.fill()
      g.fillStyle = haki ? k.claro : '#ffffff'
      g.beginPath()
      g.arc(C, C, R * 0.2 * (1 - f * 0.5), 0, Math.PI * 2)
      g.fill()
      // anel de choque
      g.lineWidth = 6 * (1 - f)
      g.strokeStyle = haki ? k.cor : k.claro
      g.beginPath()
      g.arc(C, C, R * (0.6 + f * 0.8), 0, Math.PI * 2)
      g.stroke()
      g.restore()
      if (paleta === 'rei') for (let i = 0; i < 6; i++) desenharRaio(g, caminhoRaio(r, C, C, r() * 6.3, 5, 34), 4, k, some)
      break
    }
    case 'onda': {
      g.save()
      g.globalAlpha = some
      for (let i = 0; i < 3; i++) {
        const q = Math.max(0, f - i * 0.12)
        const R = 30 + q * 220
        g.lineWidth = 14 * (1 - q)
        g.strokeStyle = [k.escuro, k.cor, k.claro][i]
        g.beginPath()
        g.ellipse(C, C, R, R * 0.5, 0, 0, Math.PI * 2)
        g.stroke()
      }
      // lascas voando
      g.fillStyle = k.escuro
      for (let i = 0; i < 14; i++) {
        const a = fixo() * Math.PI * 2
        const d = 40 + f * (120 + fixo() * 120)
        g.fillRect(C + Math.cos(a) * d, C + Math.sin(a) * d * 0.5 - Math.sin(f * Math.PI) * 60, 10, 6)
      }
      g.restore()
      break
    }
    case 'tornado': {
      g.save()
      g.globalAlpha = some
      g.lineCap = 'round'
      for (let i = 0; i < 7; i++) {
        const a0 = t * 12 + i * 0.9
        const y = C + 90 - i * 30
        const R = 70 + i * 22
        g.lineWidth = 12 - i
        g.strokeStyle = haki ? (i % 2 ? k.cor : k.escuro) : [k.escuro, k.cor, k.claro][i % 3]
        g.shadowBlur = 16
        g.shadowColor = k.brilho
        g.beginPath()
        g.ellipse(C, y, R, R * 0.28, 0, a0, a0 + 3.4)
        g.stroke()
      }
      g.restore()
      if (paleta === 'rei') for (let i = 0; i < 2; i++) desenharRaio(g, caminhoRaio(r, C, C, r() * 6.3, 5, 30), 3, k, some)
      break
    }
    case 'aura': {
      g.save()
      g.globalAlpha = some * 0.9
      for (let i = 0; i < 18; i++) {
        const x = C + (fixo() - 0.5) * 220
        const sobe = (fixo() + t * 1.5) % 1
        const y = C + 120 - sobe * 260
        const h = 40 + fixo() * 40
        g.fillStyle = i % 3 ? k.cor : k.claro
        g.beginPath()
        g.moveTo(x - 8, y)
        g.quadraticCurveTo(x, y - h * 1.4, x + 8, y)
        g.fill()
      }
      g.restore()
      brilhoRadial(g, 180, k.brilho, 0.4 * some)
      break
    }
    case 'raio': {
      // Haki do Rei no golpe: clarão branco e raios negros e vermelhos afilados
      brilhoRadial(g, 200, 'rgba(255,40,90,0.9)', 0.55 * some)
      const rr = rng(semente + Math.floor(t * 12) * 131)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + fixo() * 0.8
        raioAfilado(g, rr, C + Math.cos(a) * 12, C + Math.sin(a) * 12, a, 150 + fixo() * 70, 15 + fixo() * 6, HAKI.rei, some, 1)
      }
      brilhoRadial(g, 70 * (1 - f * 0.5), '#ffffff', some)
      break
    }
    case 'faisca': {
      // estalo de Haki saindo do corpo (Haki ligado): 2–3 raios finos, sem clarão
      brilhoRadial(g, 120, k.brilho, 0.3 * some)
      const rr = rng(semente + Math.floor(t * 14) * 97)
      // 1–2 raios curtos (é pequeno na tela: traço grosso para continuar legível)
      const n = 1 + Math.floor(fixo() * 2)
      for (let i = 0; i < n; i++) {
        const a = fixo() * Math.PI * 2
        raioAfilado(g, rr, C, C, a, 150 + fixo() * 60, 20 + fixo() * 8, k, some, 0)
      }
      break
    }
    case 'chama': {
      // pedaço do jato de fogo (Hiken), apontando para +x
      for (let camada = 0; camada < 3; camada++) {
        g.fillStyle = [k.escuro, k.cor, k.claro][camada]
        const esc = [1, 0.72, 0.4][camada]
        const rr = rng(semente + camada * 17 + Math.floor(t * 20))
        for (let i = 0; i < 9; i++) {
          const x = C - 150 * esc + rr() * 300 * esc
          const y = C + (rr() - 0.5) * 120 * esc
          const R = (30 + rr() * 45) * esc * some
          g.beginPath()
          g.ellipse(x, y, R * 1.6, R, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      break
    }
    case 'bolaFogo': {
      // sol de fogo (Entei): miolo branco, corpo laranja, línguas girando
      const R = 150 * (0.9 + Math.sin(t * 9) * 0.04)
      brilhoRadial(g, 250, k.brilho, 0.7)
      g.save()
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + t * 1.5
        g.save()
        g.translate(C + Math.cos(a) * R * 0.8, C + Math.sin(a) * R * 0.8)
        g.rotate(a + Math.PI / 2)
        g.fillStyle = i % 2 ? k.cor : k.escuro
        linguaFogo(g, 0, 0, 26, 70 + Math.sin(t * 14 + i) * 25, Math.sin(t * 8 + i) * 18)
        g.restore()
      }
      const gr = g.createRadialGradient(C - 30, C - 30, 10, C, C, R)
      gr.addColorStop(0, '#ffffff')
      gr.addColorStop(0.3, k.claro)
      gr.addColorStop(0.7, k.cor)
      gr.addColorStop(1, k.escuro)
      g.fillStyle = gr
      g.beginPath()
      g.arc(C, C, R, 0, Math.PI * 2)
      g.fill()
      g.restore()
      break
    }
    case 'explosaoFogo': {
      // explosão: bola que cresce, clareia e vira fumaça; anel de choque e faíscas
      const q = 1 - (1 - Math.min(1, f * 1.6)) ** 3
      const R = 40 + q * 190
      g.save()
      g.globalAlpha = some
      // fumaça escura na borda (fim)
      const fum = entre(f, 0.35, 1)
      if (fum > 0) {
        g.fillStyle = `rgba(60,40,40,${0.6 * (1 - fum)})`
        for (let i = 0; i < 12; i++) {
          const a = fixo() * Math.PI * 2
          g.beginPath()
          g.arc(C + Math.cos(a) * R * 0.85, C + Math.sin(a) * R * 0.85 - fum * 40, 40 + fixo() * 30, 0, Math.PI * 2)
          g.fill()
        }
      }
      g.restore()
      const gr = g.createRadialGradient(C, C, 0, C, C, R)
      gr.addColorStop(0, f < 0.3 ? '#ffffff' : k.claro)
      gr.addColorStop(0.45, k.cor)
      gr.addColorStop(0.85, k.escuro)
      gr.addColorStop(1, 'rgba(120,20,0,0)')
      g.save()
      g.globalAlpha = some
      g.fillStyle = gr
      g.beginPath()
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2
        const rr = R * (0.85 + 0.15 * Math.sin(a * 7 + t * 20))
        g.lineTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr)
      }
      g.fill()
      g.strokeStyle = '#ffffff'
      g.lineWidth = 6 * (1 - q)
      g.beginPath()
      g.arc(C, C, R * 1.15, 0, Math.PI * 2)
      g.stroke()
      g.restore()
      linhasVelocidade(g, 16, R * 0.8, R * 1.3, k.claro, 4, r)
      break
    }
    case 'pilarFogo': {
      // coluna de fogo subindo do chão (Enjōmō)
      const alt = 470 * suave(Math.min(1, f * 5))
      const base = 490
      g.save()
      g.globalAlpha = some
      for (let camada = 0; camada < 3; camada++) {
        g.fillStyle = [k.escuro, k.cor, k.claro][camada]
        const w = [90, 62, 32][camada]
        const rr = rng(semente + camada * 31 + Math.floor(t * 16))
        g.beginPath()
        g.moveTo(C - w, base)
        for (let y = base; y > base - alt; y -= 30) g.lineTo(C - w * (0.8 + rr() * 0.4) - Math.sin(y * 0.03 + t * 10) * 12, y)
        g.lineTo(C + (rr() - 0.5) * 30, base - alt - 30)
        for (let y = base - alt; y < base; y += 30) g.lineTo(C + w * (0.8 + rr() * 0.4) + Math.sin(y * 0.03 + t * 10) * 12, y)
        g.closePath()
        g.fill()
      }
      // línguas soltas subindo
      g.fillStyle = k.cor
      for (let i = 0; i < 10; i++) {
        const sobe = (fixo() + t * 1.5) % 1
        linguaFogo(g, C + (fixo() - 0.5) * 220, base - sobe * alt, 16, 50, (fixo() - 0.5) * 30)
      }
      g.restore()
      break
    }
    case 'vagalume': {
      // bolinha verde brilhante (Hotarubi), piscando
      const pisca = 0.75 + Math.sin(t * 18 + semente) * 0.25
      brilhoRadial(g, 150, k.brilho, 0.8 * pisca * some)
      g.save()
      g.globalAlpha = some
      g.fillStyle = k.cor
      g.beginPath()
      g.arc(C, C, 42, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = k.claro
      g.beginPath()
      g.arc(C - 8, C - 8, 22, 0, Math.PI * 2)
      g.fill()
      g.restore()
      break
    }
    case 'orbeLuz': {
      // bola de luz (Yasakani), com rastro para trás
      g.save()
      const gr = g.createLinearGradient(C - 230, C, C, C)
      gr.addColorStop(0, 'rgba(255,240,150,0)')
      gr.addColorStop(1, 'rgba(255,250,210,0.9)')
      g.fillStyle = gr
      g.beginPath()
      g.moveTo(C - 230, C)
      g.lineTo(C, C - 36)
      g.lineTo(C, C + 36)
      g.closePath()
      g.fill()
      g.restore()
      brilhoRadial(g, 130, k.brilho, 0.9)
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(C, C, 40, 0, Math.PI * 2)
      g.fill()
      estrela(g, C, C, 4, 110, 8, t * 4, () => 0.5)
      g.fill()
      break
    }
    case 'feixeLuz': {
      // feixe/rastro da luz ao longo do eixo x (alongado pelo sprite)
      g.save()
      g.globalAlpha = some
      const gr = g.createLinearGradient(0, C - 70, 0, C + 70)
      gr.addColorStop(0, 'rgba(255,220,80,0)')
      gr.addColorStop(0.35, k.cor)
      gr.addColorStop(0.5, '#ffffff')
      gr.addColorStop(0.65, k.cor)
      gr.addColorStop(1, 'rgba(255,220,80,0)')
      g.fillStyle = gr
      g.fillRect(0, C - 70 * (1 - f * 0.6), S, 140 * (1 - f * 0.6))
      g.fillStyle = '#ffffff'
      for (let i = 0; i < 20; i++) g.fillRect(r() * S, C + (r() - 0.5) * 160, 18 + r() * 30, 3)
      g.restore()
      break
    }
    case 'sabreLuz': {
      // golpe da espada de luz: arco dourado brilhante
      g.save()
      g.globalAlpha = some
      g.shadowBlur = 40
      g.shadowColor = k.brilho
      g.strokeStyle = k.cor
      g.lineCap = 'round'
      g.lineWidth = 34
      g.beginPath()
      g.arc(C - 60, C, 170, -1.1, 1.1)
      g.stroke()
      g.strokeStyle = '#ffffff'
      g.lineWidth = 12
      g.stroke()
      g.restore()
      linhasVelocidade(g, 10, 60, 220, '#fff8c0', 3, r)
      break
    }
    case 'espinhoGelo': {
      // espinhos de gelo brotando do chão
      const cresce = suave(Math.min(1, f * 4))
      g.save()
      g.globalAlpha = some
      brilhoRadial(g, 200, k.brilho, 0.25)
      const base = 440
      for (let i = 0; i < 9; i++) {
        const x = C + (fixo() - 0.5) * 300
        const h = (180 + fixo() * 220) * cresce
        const w = 26 + fixo() * 26
        const inc = (fixo() - 0.5) * 0.7
        g.save()
        g.translate(x, base)
        g.rotate(inc)
        g.fillStyle = k.cor
        g.beginPath()
        g.moveTo(-w, 0)
        g.lineTo(0, -h)
        g.lineTo(w, 0)
        g.closePath()
        g.fill()
        g.fillStyle = k.claro
        g.beginPath()
        g.moveTo(-w * 0.2, 0)
        g.lineTo(0, -h)
        g.lineTo(w, 0)
        g.closePath()
        g.fill()
        g.lineWidth = 3
        g.strokeStyle = k.escuro
        g.beginPath()
        g.moveTo(-w, 0)
        g.lineTo(0, -h)
        g.lineTo(w, 0)
        g.stroke()
        g.restore()
      }
      // névoa fria na base
      g.fillStyle = 'rgba(230,250,255,0.6)'
      for (let i = 0; i < 8; i++) {
        g.beginPath()
        g.arc(C + (fixo() - 0.5) * 360, base, 30 + fixo() * 30, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
      break
    }
    case 'vapor':
    case 'poeira': {
      // nuvem subindo e se abrindo (vapor do Gear Second, poeira da Zoan)
      const q = suave(f)
      g.save()
      g.globalAlpha = (1 - q) * 0.85
      for (let i = 0; i < 7; i++) {
        const a = fixo() * Math.PI * 2
        const d = q * 90 * fixo()
        const R = (40 + fixo() * 40) * (0.5 + q)
        g.fillStyle = i % 2 ? k.cor : k.claro
        g.beginPath()
        g.arc(C + Math.cos(a) * d, C + Math.sin(a) * d * 0.6 - q * 120, R, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
      break
    }
    case 'choque': {
      // Choque de dois Haki do Rei (referência do anime): impacto BRANCO no
      // meio com raios de luz, anéis de onda de choque translúcidos, raios
      // negros e vermelhos grossos saindo para longe, névoa magenta, faíscas
      // e lascas de madeira voando.
      const k2 = HAKI.rei
      const forca = entre(f, 0, 0.06) * (1 - entre(f, 0.72, 1))
      // névoa vermelha/magenta
      const neb = g.createRadialGradient(C, C, 0, C, C, 250)
      neb.addColorStop(0, 'rgba(255,120,170,0.85)')
      neb.addColorStop(0.35, 'rgba(230,20,70,0.55)')
      neb.addColorStop(1, 'rgba(90,0,30,0)')
      g.save()
      g.globalAlpha = forca
      g.fillStyle = neb
      g.fillRect(0, 0, S, S)
      g.restore()
      // anéis de onda de choque (brancos, translúcidos)
      for (const t0 of [0, 0.1, 0.24, 0.42]) {
        const q = entre(f, t0, t0 + 0.5)
        if (q <= 0 || q >= 1) continue
        const R = 30 + (1 - (1 - q) ** 2) * 240
        g.save()
        g.globalAlpha = (1 - q) * 0.75
        g.strokeStyle = '#ffffff'
        g.shadowBlur = 12
        g.shadowColor = '#ffc0d8'
        g.lineWidth = 7 * (1 - q) + 1.5
        g.beginPath()
        g.arc(C, C, R, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = (1 - q) * 0.18
        g.lineWidth = 26 * (1 - q)
        g.stroke()
        g.restore()
      }
      // raios negros e vermelhos: direções fixas, forma tremendo (~12 por segundo)
      const rr = rng(semente + Math.floor(t * 12) * 131)
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + fixo() * 0.6
        const d0 = 14 + fixo() * 20
        raioAfilado(g, rr, C + Math.cos(a) * d0, C + Math.sin(a) * d0, a, 190 + fixo() * 90, 20 + fixo() * 10, k2, forca, 2)
      }
      // raios de luz saindo do impacto
      g.save()
      g.globalAlpha = forca
      for (let i = 0; i < 44; i++) {
        const a = rr() * Math.PI * 2
        const L = 60 + rr() * 200
        const w = 1.5 + rr() * 4
        g.fillStyle = i % 3 ? '#ffffff' : '#ffb0d0'
        g.beginPath()
        g.moveTo(C + Math.cos(a + 1.57) * w, C + Math.sin(a + 1.57) * w)
        g.lineTo(C + Math.cos(a) * L, C + Math.sin(a) * L)
        g.lineTo(C + Math.cos(a - 1.57) * w, C + Math.sin(a - 1.57) * w)
        g.fill()
      }
      g.restore()
      // miolo branco pulsando
      const pul = 1 + Math.sin(t * 50) * 0.12
      const nucleo = g.createRadialGradient(C, C, 0, C, C, 90 * pul)
      nucleo.addColorStop(0, 'rgba(255,255,255,1)')
      nucleo.addColorStop(0.25, 'rgba(255,245,250,0.95)')
      nucleo.addColorStop(0.55, 'rgba(255,150,200,0.5)')
      nucleo.addColorStop(1, 'rgba(255,60,120,0)')
      g.save()
      g.globalAlpha = forca
      g.fillStyle = nucleo
      g.beginPath()
      g.arc(C, C, 90 * pul, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      estrela(g, C, C, 12, 70 * pul, 12, t * 3, rr)
      g.fill()
      g.restore()
      // lascas de madeira e faíscas voando
      g.save()
      g.globalAlpha = forca
      for (let i = 0; i < 16; i++) {
        const a = fixo() * Math.PI * 2
        const v = 0.5 + fixo()
        const d = 40 + f * 260 * v
        const x = C + Math.cos(a) * d
        const y = C + Math.sin(a) * d + f * f * 80
        g.save()
        g.translate(x, y)
        g.rotate(t * (4 + fixo() * 6))
        if (i % 2) {
          g.fillStyle = '#6a3f1e'
          g.strokeStyle = '#1a0c04'
          g.lineWidth = 2
          g.fillRect(-9, -4, 18, 8)
          g.strokeRect(-9, -4, 18, 8)
        } else {
          g.fillStyle = '#ff5a7a'
          g.shadowBlur = 10
          g.shadowColor = '#ff1030'
          g.fillRect(-2, -2, 4, 4)
        }
        g.restore()
      }
      g.restore()
      break
    }
  }
}

let sementes = 1

export class Efeito {
  readonly sprite: THREE.Sprite
  vivo = true
  private t = 0
  private readonly dur: number
  private readonly de: THREE.Vector3
  private readonly para: THREE.Vector3 | null
  private readonly aoChegar?: () => void
  private readonly laco: boolean
  private readonly canvas = document.createElement('canvas')
  private readonly g: G
  private readonly tex: THREE.CanvasTexture
  private readonly tipo: TipoEfeito
  private readonly paleta: Paleta
  private readonly cores: Cores
  private readonly q: number
  private readonly semente = (sementes = (sementes * 48271) % 2147483647)

  constructor(tipo: TipoEfeito, paleta: Paleta, de: THREE.Vector3, opcoes: { para?: THREE.Vector3; dur?: number; escala?: number; aoChegar?: () => void; laco?: boolean; alongar?: number; direcao?: THREE.Vector3 } = {}) {
    this.tipo = tipo
    this.paleta = paleta
    this.cores = paleta === 'normal' || tipo === 'raio' || tipo === 'choque' ? CORES[tipo] : HAKI[paleta]
    // o choque é grande na tela: desenha em resolução dobrada
    this.q = tipo === 'choque' ? 2 : 1
    this.canvas.width = this.canvas.height = S * this.q
    this.g = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    const soma = SOMA.has(tipo) && paleta === 'normal'
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, blending: soma ? THREE.AdditiveBlending : THREE.NormalBlending }),
    )
    // o desenho ocupa ~70% do quadro (o resto é brilho)
    const e = (opcoes.escala ?? 1) * 1.5
    this.sprite.scale.set(e * (opcoes.alongar ?? 1), e, 1)
    this.sprite.renderOrder = 6
    this.de = de.clone()
    this.para = opcoes.para?.clone() ?? null
    this.dur = opcoes.dur ?? 0.5
    this.aoChegar = opcoes.aoChegar
    this.laco = !!opcoes.laco
    this.sprite.position.copy(de)
    const rumo = this.para ?? (opcoes.direcao ? this.de.clone().add(opcoes.direcao) : null)
    if (rumo) {
      // gira o desenho para a direção do voo (na tela, aproximado pelo X/Z)
      const d = rumo.clone().sub(this.de)
      this.sprite.material.rotation = Math.atan2(-d.z * 0.75 + d.y, d.x)
    }
    this.desenhar(0)
  }

  private desenhar(f: number) {
    this.g.setTransform(this.q, 0, 0, this.q, 0, 0)
    this.g.clearRect(0, 0, S, S)
    pintar(this.g, this.tipo, f, this.cores, this.paleta, this.semente, this.t)
    this.tex.needsUpdate = true
  }

  atualizar(dt: number) {
    this.t += dt
    const f = this.laco ? (this.t / this.dur) % 1 : Math.min(1, this.t / this.dur)
    // projétil: o desenho fica inteiro enquanto voa
    this.desenhar(this.para ? Math.min(0.5, f * 0.5) : f)
    if (this.para) this.sprite.position.lerpVectors(this.de, this.para, f)
    if (!this.laco && this.t >= this.dur) {
      this.vivo = false
      this.aoChegar?.()
    }
  }

  descartar() {
    this.tex.dispose()
    this.sprite.material.dispose()
  }
}
