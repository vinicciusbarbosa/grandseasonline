/**
 * Animação recortada (como no Wakfu/Flash): o personagem é um conjunto de
 * ENCAIXES (tronco, cabeça, braço…) em hierarquia; em cada quadro-chave cada
 * encaixe mostra uma PEÇA (um desenho recortado da folha — trocar a peça é
 * trocar o desenho, ex.: braço reto → braço dobrado com machado) numa
 * posição, giro e escala relativos ao encaixe pai.
 *
 * Usado pelo editor (src/editor) e pelo jogo (visualAnimado.ts). O projeto é
 * um JSON em public/sprites/<id>/animacao.json; as peças são retângulos das
 * folhas (fundo magenta), recortados na hora de carregar.
 */

export type Peca = {
  /** arquivo da folha, em public/sprites/<id>/folhas/ */
  folha: string
  /** retângulo na folha (px) */
  x: number
  y: number
  l: number
  a: number
  /** só o maior pedaço dentro do retângulo (tira vizinhos que entraram no corte) */
  maior: boolean
  /** pivô (onde gira), em px dentro do retângulo */
  pivo: [number, number]
}

export type Encaixe = { id: string; pai: string | null }

/** estado de um encaixe num quadro-chave (relativo ao pai) */
export type EstadoEncaixe = { peca: string | null; x: number; y: number; rot: number; sx: number; sy: number }
export type Pose = Record<string, EstadoEncaixe>
export type Chave = { t: number; pose: Pose }

export type Animacao = {
  /** segundos */
  duracao: number
  laco: boolean
  /** instante do golpe (0 a 1), só nos ataques */
  impacto?: number
  chaves: Chave[]
}

export type NomeVista = 'frente' | 'costas'
export const VISTAS: NomeVista[] = ['frente', 'costas']
export const NOMES_ANIM = ['parado', 'andar', 'correr', 'frear', 'parar', 'atacar', 'dano'] as const
export type NomeAnimacao = (typeof NOMES_ANIM)[number]

export type Projeto = {
  versao: 1
  /** altura do personagem em px da folha (do pé ao topo da cabeça), para a escala no jogo */
  altura: number
  /** para que lado da tela cada vista olha (-1 esquerda, 1 direita); o jogo espelha o resto */
  olha: Record<NomeVista, 1 | -1>
  /** folhas disponíveis (public/sprites/<id>/folhas/) */
  folhas: string[]
  pecas: Record<string, Peca>
  /** ordem = ordem de desenho (o primeiro fica atrás) */
  encaixes: Encaixe[]
  animacoes: Record<NomeVista, Partial<Record<NomeAnimacao, Animacao>>>
  /** figura de referência atrás do palco (só no editor) */
  referencia?: Partial<Record<NomeVista, { folha: string; x: number; y: number; l: number; a: number; dx: number; dy: number; opacidade: number }>>
}

/** Esqueleto padrão: de trás para a frente, quem está longe da câmera primeiro. */
export const ENCAIXES_PADRAO: Encaixe[] = [
  { id: 'arma_longe', pai: 'mao_longe' },
  { id: 'braco_longe', pai: 'tronco' },
  { id: 'antebraco_longe', pai: 'braco_longe' },
  { id: 'mao_longe', pai: 'antebraco_longe' },
  { id: 'coxa_longe', pai: 'quadril' },
  { id: 'canela_longe', pai: 'coxa_longe' },
  { id: 'pe_longe', pai: 'canela_longe' },
  { id: 'quadril', pai: null },
  { id: 'coxa_perto', pai: 'quadril' },
  { id: 'canela_perto', pai: 'coxa_perto' },
  { id: 'pe_perto', pai: 'canela_perto' },
  { id: 'tronco', pai: 'quadril' },
  { id: 'cabeca', pai: 'tronco' },
  { id: 'braco_perto', pai: 'tronco' },
  { id: 'antebraco_perto', pai: 'braco_perto' },
  { id: 'mao_perto', pai: 'antebraco_perto' },
  { id: 'arma_perto', pai: 'mao_perto' },
]

export const estadoVazio = (): EstadoEncaixe => ({ peca: null, x: 0, y: 0, rot: 0, sx: 1, sy: 1 })

export function projetoNovo(): Projeto {
  return {
    versao: 1,
    altura: 470,
    olha: { frente: -1, costas: 1 },
    folhas: ['corpo.webp', 'partes.webp', 'machados.webp'],
    pecas: {},
    encaixes: ENCAIXES_PADRAO.map((e) => ({ ...e })),
    animacoes: { frente: {}, costas: {} },
  }
}

// ---------------------------------------------------------------- tempo

const suave = (k: number) => k * k * (3 - 2 * k)

/** Pose no instante `fase` (0 a 1): interpola posição/giro/escala; a peça troca seca. */
export function poseEm(anim: Animacao, fase: number): Pose {
  const cs = anim.chaves
  if (!cs.length) return {}
  let i = cs.length - 1
  while (i > 0 && cs[i].t > fase) i--
  const a = cs[i]
  const b = i + 1 < cs.length ? cs[i + 1] : anim.laco ? { t: 1, pose: cs[0].pose } : a
  const k = b === a || b.t <= a.t ? 0 : suave(Math.min(1, Math.max(0, (fase - a.t) / (b.t - a.t))))
  const pose: Pose = {}
  for (const id of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
    const ea = a.pose[id] ?? b.pose[id]
    const eb = b.pose[id] ?? ea
    // giro pelo caminho mais curto
    let dr = eb.rot - ea.rot
    if (dr > 180) dr -= 360
    if (dr < -180) dr += 360
    pose[id] = {
      peca: ea.peca,
      x: ea.x + (eb.x - ea.x) * k,
      y: ea.y + (eb.y - ea.y) * k,
      rot: ea.rot + dr * k,
      sx: ea.sx + (eb.sx - ea.sx) * k,
      sy: ea.sy + (eb.sy - ea.sy) * k,
    }
  }
  return pose
}

// ---------------------------------------------------------------- desenho

/** Matriz de mundo de cada encaixe (a partir de `base`, a origem = entre os pés). */
export function matrizes(projeto: Projeto, pose: Pose, base: DOMMatrix) {
  const m = new Map<string, DOMMatrix>()
  const pais = new Map(projeto.encaixes.map((e) => [e.id, e.pai]))
  const de = (id: string, pilha = 0): DOMMatrix => {
    const pronta = m.get(id)
    if (pronta) return pronta
    const e = pose[id] ?? estadoVazio()
    const pai = pais.get(id)
    const mp = pai && pilha < 32 ? de(pai, pilha + 1) : base
    const r = mp.translate(e.x, e.y).rotate(e.rot).scale(e.sx, e.sy)
    m.set(id, r)
    return r
  }
  for (const e of projeto.encaixes) de(e.id)
  return m
}

/** Desenha a pose: cada encaixe com a sua peça, pivô na origem do encaixe. */
export function desenharPose(
  c: CanvasRenderingContext2D,
  projeto: Projeto,
  pose: Pose,
  base: DOMMatrix,
  imagens: Map<string, HTMLCanvasElement>,
  destaque?: (id: string) => number | null,
) {
  const ms = matrizes(projeto, pose, base)
  for (const enc of projeto.encaixes) {
    const e = pose[enc.id]
    if (!e?.peca) continue
    const p = projeto.pecas[e.peca]
    const img = imagens.get(e.peca)
    if (!p || !img) continue
    c.setTransform(ms.get(enc.id)!)
    const alfa = destaque?.(enc.id)
    if (alfa != null) c.globalAlpha = alfa
    c.drawImage(img, -p.pivo[0], -p.pivo[1])
    c.globalAlpha = 1
  }
  return ms
}

// ---------------------------------------------------------------- recorte

/**
 * Recorta a peça da folha: o magenta vira transparente, a borda rosada é
 * limpa e (com `maior`) só fica o maior pedaço.
 */
export function recortarPeca(folha: HTMLImageElement, p: Pick<Peca, 'x' | 'y' | 'l' | 'a' | 'maior'>) {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(p.l))
  cv.height = Math.max(1, Math.round(p.a))
  const c = cv.getContext('2d', { willReadFrequently: true })!
  c.drawImage(folha, -Math.round(p.x), -Math.round(p.y))
  const dados = c.getImageData(0, 0, cv.width, cv.height)
  const d = dados.data
  const L = cv.width
  const A = cv.height
  const corpo = new Uint8Array(L * A)
  for (let i = 0; i < L * A; i++) {
    const r = d[i * 4]
    const g = d[i * 4 + 1]
    const b = d[i * 4 + 2]
    corpo[i] = r - g > 90 && b - g > 90 ? 0 : 1
  }
  let manter = corpo
  if (p.maior) {
    // maior pedaço ligado (4 vizinhos)
    const rot = new Int32Array(L * A).fill(-1)
    let melhor = -1
    let tamMelhor = 0
    const fila = new Int32Array(L * A)
    let n = 0
    for (let i = 0; i < L * A; i++) {
      if (!corpo[i] || rot[i] >= 0) continue
      let ini = 0
      let fim = 0
      fila[fim++] = i
      rot[i] = n
      while (ini < fim) {
        const q = fila[ini++]
        const x = q % L
        const vs = [x > 0 ? q - 1 : -1, x < L - 1 ? q + 1 : -1, q - L, q + L]
        for (const v of vs) {
          if (v < 0 || v >= L * A || !corpo[v] || rot[v] >= 0) continue
          rot[v] = n
          fila[fim++] = v
        }
      }
      if (fim > tamMelhor) {
        tamMelhor = fim
        melhor = n
      }
      n++
    }
    manter = new Uint8Array(L * A)
    for (let i = 0; i < L * A; i++) manter[i] = rot[i] === melhor ? 1 : 0
  }
  for (let i = 0; i < L * A; i++) {
    if (!manter[i]) {
      d[i * 4 + 3] = 0
      continue
    }
    // borda rosada (mistura com o fundo): tira o magenta da cor
    const r = d[i * 4]
    const g = d[i * 4 + 1]
    const b = d[i * 4 + 2]
    if (r - g > 25 && b - g > 25) {
      const x = i % L
      const borda = (x > 0 && !manter[i - 1]) || (x < L - 1 && !manter[i + 1]) || (i >= L && !manter[i - L]) || (i < L * (A - 1) && !manter[i + L])
      if (borda) d[i * 4 + 3] = 0
      else {
        const m = Math.min(r, b)
        const k = Math.max(0, m - g) * 0.8
        d[i * 4] = r - k
        d[i * 4 + 2] = b - k
      }
    }
  }
  c.putImageData(dados, 0, 0)
  return cv
}

/** Carrega uma imagem (folha). */
export function carregarImagem(url: string) {
  return new Promise<HTMLImageElement>((ok, erro) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => erro(new Error(`imagem ${url}`))
    img.src = url
  })
}
