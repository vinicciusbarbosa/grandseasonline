/**
 * Choque de dois Haki do Rei, desenhado direto na tela (canvas 2D por cima de
 * tudo, em resolução cheia) — como no anime:
 *   - a tela inteira tinge de vermelho e magenta, bordas escurecendo;
 *   - no ponto do choque, um impacto BRANCO com raios finos de luz;
 *   - poucos raios NEGROS enormes, em zigue-zague anguloso (como rachaduras
 *     no céu), com borda e brilho vermelhos, cruzando até as bordas da tela;
 *   - grandes anéis brancos translúcidos se abrindo;
 *   - faíscas e lascas de madeira voando.
 * Tudo em proporção da altura da tela (H).
 */

type Pt = [number, number]
type Raio = { pts: Pt[]; larg: number; galhos: { pts: Pt[]; larg: number }[] }
type Lasca = { a: number; v: number; giro: number; tam: number; madeira: boolean }

const DUR = 1.9

function rng(s: number) {
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}
const entre = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)))

export class ChoqueTela {
  vivo = true
  private t = 0
  private raios: Raio[] = []
  private proxRaio = 0
  private readonly r = rng(Math.floor(Math.random() * 1e9) + 1)
  private readonly direcoes: number[]
  private readonly lascas: Lasca[]
  /** ponto do choque no mundo (a cena projeta na tela a cada quadro) */
  readonly ponto: { x: number; y: number; z: number }

  constructor(ponto: { x: number; y: number; z: number }) {
    this.ponto = ponto
    const r = this.r
    // direções dos raios principais: espalhadas, com folga entre elas
    const n = 7
    const base = r() * Math.PI * 2
    this.direcoes = Array.from({ length: n }, (_, i) => base + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5)
    this.lascas = Array.from({ length: 26 }, () => ({ a: r() * Math.PI * 2, v: 0.4 + r() * 0.9, giro: (r() - 0.5) * 14, tam: 0.008 + r() * 0.018, madeira: r() < 0.5 }))
  }

  /** zigue-zague anguloso de (x,y) na direção `a`, até `comp` */
  private zigue(x: number, y: number, a: number, comp: number, passo: number): Pt[] {
    const r = this.r
    const pts: Pt[] = [[x, y]]
    let feito = 0
    let lado = 1
    while (feito < comp) {
      const p = passo * (0.6 + r() * 0.9)
      const desvio = (0.35 + r() * 0.55) * lado
      lado = -lado
      x += Math.cos(a + desvio) * p
      y += Math.sin(a + desvio) * p
      a += (r() - 0.5) * 0.25
      feito += p
      pts.push([x, y])
    }
    return pts
  }

  private refazerRaios(H: number) {
    const r = this.r
    this.raios = this.direcoes.map((a) => {
      const d0 = H * (0.03 + r() * 0.04)
      const pts = this.zigue(Math.cos(a) * d0, Math.sin(a) * d0, a + (r() - 0.5) * 0.2, H * (1.1 + r() * 0.5), H * 0.07)
      const galhos = Array.from({ length: 2 + Math.floor(r() * 2) }, () => {
        const i = 1 + Math.floor(r() * (pts.length - 2))
        const [gx, gy] = pts[i]
        const ga = a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6)
        return { pts: this.zigue(gx, gy, ga, H * (0.12 + r() * 0.2), H * 0.045), larg: 1 - i / pts.length }
      })
      return { pts, larg: H * (0.022 + r() * 0.012), galhos }
    })
  }

  /** Desenha um raio afilado: brilho vermelho, borda vermelha, miolo negro. */
  private raio(g: CanvasRenderingContext2D, pts: Pt[], larg: number, H: number) {
    const n = pts.length - 1
    const passe = (extra: number, cor: string, blur: number) => {
      g.shadowBlur = blur
      g.shadowColor = 'rgba(255,20,50,1)'
      g.strokeStyle = cor
      for (let i = 0; i < n; i++) {
        g.lineWidth = Math.max(1, larg * (1 - (i / n) * 0.85) + extra)
        g.beginPath()
        g.moveTo(pts[i][0], pts[i][1])
        g.lineTo(pts[i + 1][0], pts[i + 1][1])
        g.stroke()
      }
    }
    passe(H * 0.014, 'rgba(255,30,60,0.85)', H * 0.04)
    passe(H * 0.005, '#ff5a70', 0)
    passe(0, '#070003', 0)
  }

  /** Um quadro. `c` = centro na tela (px), W×H = tamanho do canvas. */
  desenhar(g: CanvasRenderingContext2D, dt: number, c: { x: number; y: number }, W: number, H: number) {
    this.t += dt
    const t = this.t
    const f = t / DUR
    if (f >= 1) {
      this.vivo = false
      return
    }
    const forca = entre(f, 0, 0.04) * (1 - entre(f, 0.7, 1))
    g.save()
    g.lineCap = 'round'
    g.lineJoin = 'miter'

    // tela tingida de vermelho/magenta, bordas escuras
    const tinta = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.hypot(W, H) * 0.75)
    tinta.addColorStop(0, 'rgba(255,90,150,0.35)')
    tinta.addColorStop(0.3, 'rgba(200,20,70,0.35)')
    tinta.addColorStop(1, 'rgba(40,0,20,0.6)')
    g.globalAlpha = forca
    g.fillStyle = tinta
    g.fillRect(0, 0, W, H)

    // anéis brancos translúcidos (grandes, se abrindo)
    for (const t0 of [0, 0.08, 0.2, 0.36]) {
      const q = entre(f, t0, t0 + 0.55)
      if (q <= 0 || q >= 1) continue
      const R = H * (0.05 + (1 - (1 - q) ** 2.2) * 0.85)
      g.globalAlpha = (1 - q) * 0.55 * (1 - entre(f, 0.75, 1))
      g.strokeStyle = '#ffffff'
      g.shadowBlur = H * 0.01
      g.shadowColor = '#ffd0e0'
      g.lineWidth = H * (0.006 + 0.012 * (1 - q))
      g.beginPath()
      g.arc(c.x, c.y, R, 0, Math.PI * 2)
      g.stroke()
      // faixa clara por dentro do anel
      g.globalAlpha *= 0.25
      g.lineWidth = H * 0.05 * (1 - q)
      g.stroke()
    }
    g.shadowBlur = 0

    // raios negros e vermelhos (refeitos ~14 vezes por segundo)
    if (t >= this.proxRaio) {
      this.refazerRaios(H)
      this.proxRaio = t + 0.07
    }
    g.save()
    g.translate(c.x, c.y)
    g.globalAlpha = forca
    for (const r of this.raios) {
      this.raio(g, r.pts, r.larg, H)
      for (const gl of r.galhos) this.raio(g, gl.pts, r.larg * gl.larg * 0.6, H)
    }
    g.restore()

    // raios finos de luz saindo do impacto
    g.globalAlpha = forca
    const rr = rng(Math.floor(t * 30) + 7)
    for (let i = 0; i < 70; i++) {
      const a = rr() * Math.PI * 2
      const L = H * (0.08 + rr() ** 2 * 0.5)
      const w = H * (0.002 + rr() * 0.006)
      g.fillStyle = i % 4 ? 'rgba(255,255,255,0.9)' : 'rgba(255,170,210,0.9)'
      g.beginPath()
      g.moveTo(c.x + Math.cos(a + 1.57) * w, c.y + Math.sin(a + 1.57) * w)
      g.lineTo(c.x + Math.cos(a) * L, c.y + Math.sin(a) * L)
      g.lineTo(c.x + Math.cos(a - 1.57) * w, c.y + Math.sin(a - 1.57) * w)
      g.fill()
    }
    // traço horizontal do clarão (lens flare)
    const fl = g.createLinearGradient(c.x - H * 0.6, 0, c.x + H * 0.6, 0)
    fl.addColorStop(0, 'rgba(255,200,230,0)')
    fl.addColorStop(0.5, 'rgba(255,255,255,0.95)')
    fl.addColorStop(1, 'rgba(255,200,230,0)')
    g.fillStyle = fl
    g.fillRect(c.x - H * 0.6, c.y - H * 0.004, H * 1.2, H * 0.008)

    // miolo branco pulsando
    const pul = 1 + Math.sin(t * 45) * 0.1
    const R0 = H * 0.13 * pul * (1 + entre(f, 0, 0.05) * 0.4)
    const nuc = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, R0)
    nuc.addColorStop(0, 'rgba(255,255,255,1)')
    nuc.addColorStop(0.3, 'rgba(255,250,252,0.95)')
    nuc.addColorStop(0.6, 'rgba(255,150,200,0.45)')
    nuc.addColorStop(1, 'rgba(255,40,100,0)')
    g.fillStyle = nuc
    g.beginPath()
    g.arc(c.x, c.y, R0, 0, Math.PI * 2)
    g.fill()

    // faíscas e lascas de madeira
    for (const l of this.lascas) {
      const d = H * (0.05 + f * 0.7 * l.v)
      const x = c.x + Math.cos(l.a) * d
      const y = c.y + Math.sin(l.a) * d + H * 0.35 * f * f
      const s = H * l.tam
      g.save()
      g.translate(x, y)
      g.rotate(t * l.giro)
      if (l.madeira) {
        g.fillStyle = '#6a3f1e'
        g.strokeStyle = '#1a0c04'
        g.lineWidth = Math.max(1, s * 0.15)
        g.fillRect(-s, -s * 0.35, s * 2, s * 0.7)
        g.strokeRect(-s, -s * 0.35, s * 2, s * 0.7)
      } else {
        g.fillStyle = '#ffd0dc'
        g.shadowBlur = s * 2
        g.shadowColor = '#ff1a40'
        g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6)
      }
      g.restore()
    }
    g.restore()
  }
}
