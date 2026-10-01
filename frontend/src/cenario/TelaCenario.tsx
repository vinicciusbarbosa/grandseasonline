import { useEffect, useRef, useState } from 'react'

/**
 * Teste do cenário estilo Wakfu (/teste-cenario): convés de navio em grade
 * isométrica 2:1 (losangos), câmera fixa sem perspectiva, desenhado em 2D.
 *
 * - chão: textura quadrada vista de cima (public/cenario/chao-*.webp),
 *   deformada para o losango; enquanto não existe, tábuas provisórias;
 * - amurada nas duas bordas do fundo, casco nas duas da frente;
 * - objetos (public/cenario/*.webp, recortados por scripts/sprites/cenario.py)
 *   em casas, ordenados pela profundidade.
 */

const BASE = `${import.meta.env.BASE_URL}cenario/`
/** casa: losango de TW × TH (2:1) */
const TW = 96
const TH = 48
/** grade do convés (colunas × linhas) */
const COLS = 14
const LINS = 9
/** altura do casco abaixo do convés (px) */
const CASCO = 70

type InfoObj = { l: number; a: number; pe: [number, number] }
type Manifesto = { objetos: Record<string, InfoObj>; texturas: Record<string, { l: number; a: number }> }
/** objeto numa casa; `largura` em casas (quanto do losango ele ocupa na largura) */
type Colocado = { obj: string; c: number; l: number; largura: number; espelho?: boolean }

const MAPA: Colocado[] = [
  { obj: 'mastro', c: 7, l: 4, largura: 1.3 },
  { obj: 'timao', c: 1, l: 4, largura: 1.1 },
  { obj: 'canhao-esq', c: 3, l: 0, largura: 1.7 },
  { obj: 'canhao-esq', c: 9, l: 0, largura: 1.7 },
  { obj: 'canhao-dir', c: 4, l: 8, largura: 1.7 },
  { obj: 'canhao-dir', c: 10, l: 8, largura: 1.7 },
  { obj: 'balas', c: 5, l: 1, largura: 0.8 },
  { obj: 'barril-polvora', c: 11, l: 1, largura: 0.7 },
  { obj: 'escada', c: 12, l: 4, largura: 1.3 },
  { obj: 'lanterna', c: 0, l: 0, largura: 0.9 },
  { obj: 'lanterna', c: 13, l: 8, largura: 0.9, espelho: true },
  { obj: 'bau', c: 10, l: 5, largura: 1 },
  { obj: 'moedas', c: 11, l: 6, largura: 0.6 },
  { obj: 'ancora', c: 2, l: 7, largura: 1.2 },
  { obj: 'mapa', c: 6, l: 6, largura: 0.6 },
]

function carregar(url: string) {
  return new Promise<HTMLImageElement | null>((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ok(null)
    i.src = url
  })
}

/** Tábuas provisórias (vistas de cima), até chegar a textura gerada. */
function tabuasProvisorias() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const cores = ['#b07a45', '#a8713f', '#b98350', '#a06a3a']
  for (let i = 0; i < 8; i++) {
    g.fillStyle = cores[i % cores.length]
    g.fillRect(0, i * 32, 256, 32)
    g.fillStyle = '#5a3a1e'
    g.fillRect(0, i * 32 + 30, 256, 2)
    const corte = ((i * 97) % 200) + 20
    g.fillRect(corte, i * 32, 2, 32)
    g.fillStyle = '#3d2914'
    g.fillRect(corte - 6, i * 32 + 6, 3, 3)
    g.fillRect(corte - 6, i * 32 + 22, 3, 3)
  }
  return c
}

export default function TelaCenario() {
  const tela = useRef<HTMLCanvasElement>(null)
  const [info, setInfo] = useState('')

  useEffect(() => {
    let vivo = true
    const cv = tela.current!
    const g = cv.getContext('2d')!
    let man: Manifesto | null = null
    const imgs = new Map<string, HTMLImageElement>()
    let chao: CanvasImageSource = tabuasProvisorias()
    let fundo: HTMLImageElement | null = null
    let amurada: HTMLImageElement | null = null
    let hover: [number, number] | null = null
    // origem (topo do losango da casa 0,0) e zoom, recalculados ao redimensionar
    let ox = 0
    let oy = 0
    let k = 1

    const casaParaTela = (c: number, l: number) => [ox + ((c - l) * TW) / 2, oy + ((c + l) * TH) / 2] as const
    const telaParaCasa = (x: number, y: number) => {
      const u = (x - ox) / (TW / 2)
      const v = (y - oy) / (TH / 2)
      return [Math.floor((u + v) / 2), Math.floor((v - u) / 2)] as const
    }

    const desenhar = () => {
      if (!vivo) return
      const dpr = window.devicePixelRatio || 1
      const W = cv.clientWidth
      const H = cv.clientHeight
      if (cv.width !== Math.round(W * dpr)) {
        cv.width = Math.round(W * dpr)
        cv.height = Math.round(H * dpr)
      }
      // cabe o convés inteiro (com casco e objetos) na tela
      const larg = ((COLS + LINS) * TW) / 2
      const alt = ((COLS + LINS) * TH) / 2 + CASCO + 160
      k = Math.min(W / (larg + 80), H / (alt + 40))
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      // fundo: cobre a tela
      if (fundo) {
        const s = Math.max(W / fundo.width, H / fundo.height)
        g.drawImage(fundo, (W - fundo.width * s) / 2, (H - fundo.height * s) / 2, fundo.width * s, fundo.height * s)
      } else {
        g.fillStyle = '#5fb7e5'
        g.fillRect(0, 0, W, H)
      }
      // origem: centraliza
      ox = (W / k - larg) / 2 + (LINS * TW) / 2
      oy = (H / k - alt) / 2 + 150
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0)

      const canto = (c: number, l: number) => casaParaTela(c, l)
      const [tx, ty] = canto(0, 0)
      const [rx, ry] = canto(COLS, 0)
      const [bx, by] = canto(COLS, LINS)
      const [lx, ly] = canto(0, LINS)

      // casco (as duas faces da frente)
      const face = (ax: number, ay: number, bx2: number, by2: number, cor: string, linha: string) => {
        g.beginPath()
        g.moveTo(ax, ay)
        g.lineTo(bx2, by2)
        g.lineTo(bx2, by2 + CASCO)
        g.lineTo(ax, ay + CASCO * 0.8)
        g.closePath()
        g.fillStyle = cor
        g.fill()
        g.strokeStyle = linha
        g.lineWidth = 2
        for (let i = 1; i < 4; i++) {
          const f = i / 4
          g.beginPath()
          g.moveTo(ax, ay + CASCO * 0.8 * f)
          g.lineTo(bx2, by2 + CASCO * f)
          g.stroke()
        }
        g.strokeStyle = '#2a1608'
        g.lineWidth = 3
        g.stroke()
      }
      face(lx, ly, bx, by, '#5b3416', '#3e220c')
      face(bx, by, rx, ry, '#6e4120', '#4a2a10')

      // chão: textura quadrada deformada no losango do convés inteiro
      g.save()
      g.beginPath()
      g.moveTo(tx, ty)
      g.lineTo(rx, ry)
      g.lineTo(bx, by)
      g.lineTo(lx, ly)
      g.closePath()
      g.clip()
      const S = (chao as HTMLCanvasElement).width
      // uma textura a cada 2 casas
      const r = 2
      g.transform(TW / 2 / (S / r), TH / 2 / (S / r), -TW / 2 / (S / r), TH / 2 / (S / r), tx, ty)
      g.fillStyle = g.createPattern(chao, 'repeat')!
      g.fillRect(0, 0, (COLS * S) / r, (LINS * S) / r)
      g.restore()
      // contorno do convés
      g.strokeStyle = '#2a1608'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(tx, ty)
      g.lineTo(rx, ry)
      g.lineTo(bx, by)
      g.lineTo(lx, ly)
      g.closePath()
      g.stroke()

      // grade (bem leve) e casa sob o mouse
      g.strokeStyle = 'rgba(40,20,5,0.18)'
      g.lineWidth = 1
      for (let c = 1; c < COLS; c++) {
        const [a1, a2] = casaParaTela(c, 0)
        const [b1, b2] = casaParaTela(c, LINS)
        g.beginPath()
        g.moveTo(a1, a2)
        g.lineTo(b1, b2)
        g.stroke()
      }
      for (let l = 1; l < LINS; l++) {
        const [a1, a2] = casaParaTela(0, l)
        const [b1, b2] = casaParaTela(COLS, l)
        g.beginPath()
        g.moveTo(a1, a2)
        g.lineTo(b1, b2)
        g.stroke()
      }
      if (hover) {
        const [c, l] = hover
        const p = [casaParaTela(c, l), casaParaTela(c + 1, l), casaParaTela(c + 1, l + 1), casaParaTela(c, l + 1)]
        g.beginPath()
        g.moveTo(...p[0])
        for (const q of p.slice(1)) g.lineTo(...q)
        g.closePath()
        g.fillStyle = 'rgba(255,240,170,0.35)'
        g.fill()
        g.strokeStyle = 'rgba(255,240,170,0.9)'
        g.lineWidth = 2
        g.stroke()
      }

      // amurada nas duas bordas do fundo (faixa cisalhada ao longo da borda)
      if (amurada) {
        const altA = 46
        const faixa = (ax: number, ay: number, bx2: number, by2: number) => {
          const len = Math.hypot(bx2 - ax, by2 - ay)
          const vezes = Math.max(1, Math.round(len / (altA * (amurada!.width / amurada!.height) * 0.5)))
          g.save()
          // x ao longo da borda, y para cima
          g.transform((bx2 - ax) / vezes / amurada!.width, (by2 - ay) / vezes / amurada!.width, 0, altA / amurada!.height, ax, ay - altA)
          for (let i = 0; i < vezes; i++) g.drawImage(amurada!, i * amurada!.width, 0)
          g.restore()
        }
        faixa(lx, ly, tx, ty)
        faixa(tx, ty, rx, ry)
      }

      // objetos, do fundo para a frente
      if (man) {
        const lista = [...MAPA].sort((a, b) => a.c + a.l - (b.c + b.l) || a.c - b.c)
        for (const o of lista) {
          const im = imgs.get(o.obj)
          const inf = man.objetos[o.obj]
          if (!im || !inf) continue
          const [cx, cy] = casaParaTela(o.c + 0.5, o.l + 0.5)
          const s = (o.largura * TW) / inf.l
          // sombra no chão
          g.fillStyle = 'rgba(0,0,0,0.22)'
          g.beginPath()
          g.ellipse(cx, cy + 2, (o.largura * TW) / 2.4, (o.largura * TH) / 2.6, 0, 0, Math.PI * 2)
          g.fill()
          g.save()
          g.translate(cx, cy + TH * 0.18)
          if (o.espelho) g.scale(-1, 1)
          g.drawImage(im, -inf.pe[0] * s, -inf.pe[1] * s, inf.l * s, inf.a * s)
          g.restore()
        }
      }
    }

    void (async () => {
      man = (await (await fetch(`${BASE}manifesto.json`)).json()) as Manifesto
      fundo = await carregar(`${BASE}fundo.webp`)
      amurada = await carregar(`${BASE}amurada.webp`)
      const tex = Object.keys(man.texturas).find((t) => t.startsWith('chao-'))
      if (tex) {
        const t = await carregar(`${BASE}${tex}.webp`)
        if (t) chao = t
      }
      await Promise.all(
        Object.keys(man.objetos).map(async (n) => {
          const i = await carregar(`${BASE}${n}.webp`)
          if (i) imgs.set(n, i)
        }),
      )
      desenhar()
    })()

    const mover = (ev: MouseEvent) => {
      const r = cv.getBoundingClientRect()
      const [c, l] = telaParaCasa((ev.clientX - r.left) / k, (ev.clientY - r.top) / k)
      const dentro = c >= 0 && l >= 0 && c < COLS && l < LINS
      const novo: [number, number] | null = dentro ? [c, l] : null
      if (novo?.[0] !== hover?.[0] || novo?.[1] !== hover?.[1]) {
        hover = novo
        setInfo(novo ? `casa ${novo[0]}, ${novo[1]}` : '')
        desenhar()
      }
    }
    cv.addEventListener('mousemove', mover)
    window.addEventListener('resize', desenhar)
    return () => {
      vivo = false
      cv.removeEventListener('mousemove', mover)
      window.removeEventListener('resize', desenhar)
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#5fb7e5' }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block' }} />
      {info && <div style={{ position: 'absolute', left: 12, bottom: 10, color: '#fff', font: '600 14px system-ui', textShadow: '0 1px 2px #000' }}>{info}</div>}
    </div>
  )
}
