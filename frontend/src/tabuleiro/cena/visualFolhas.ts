import * as THREE from 'three'
import type { Direcao, EstadoVisual, Haki, InfoAnim, NomeAnim, PontoLuz, Visual } from './personagem'
import { atualizarLuz, materialIluminado } from './luzSprite'
import { posicionarPixel } from './pixel'
import { texturaSombra } from './texturas'

/**
 * Visual com as folhas desenhadas (pixel art estilo Ragnarok), importadas por
 * scripts/sprites/importar_folha.py para public/sprites/<personagem>/.
 *
 * Cada animação/direção é uma tira de quadros (224×224, pé em 112,200 — ver o
 * manifesto), desenhada na resolução nativa da arte.
 * Direções: S, SE, E, NE, N e, se existirem, SW, W, NW desenhadas; sem
 * elas, SW, W e NW são o espelho de SE, E e NE.
 * Enquanto uma animação não existe, usa a pose parada com um movimento
 * simples (balanço ao andar, investida no ataque, recuo no dano).
 */

/** `quadro`/`pe`: tamanho e pé próprios desta tira (golpes largos da LPC têm quadro maior) */
type Folha = { arquivo: string; quadros: number; quadro?: [number, number]; pe?: [number, number] }

/** marcas da Arma de Luz (luz.json, scripts/sprites/arma_luz.py): px do quadro */
type MarcaLuz = { x: number; y: number; a?: number; c?: number; atras?: boolean }
type DadosLuz = { tipo: 'espada' | 'punho'; anims: Partial<Record<NomeAnim, Partial<Record<Direcao, MarcaLuz[][]>>>> }

async function lerJsonOpcional<T>(url: string): Promise<T | null> {
  const u = recurso(url)
  try {
    if (u.startsWith('data:')) return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(u.split(',')[1]), (c) => c.charCodeAt(0)))) as T
    const r = await fetch(u)
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

type Manifesto = {
  quadro: [number, number]
  pe: [number, number]
  altura?: number
  /** texels por pixel de arte do tabuleiro (2 = arte em HD) */
  densidade?: number
  anims: Partial<Record<NomeAnim, Partial<Record<Direcao, Folha & { variantes?: Record<string, Folha> }>>>>
  /** folhas com só 4 direções (LPC): diagonal → direção desenhada mais próxima */
  apelidos?: Partial<Record<Direcao, Direcao>>
  /** ajustes de tempo por animação (folhas com outro número de quadros) */
  tempos?: Partial<Record<NomeAnim, { fps?: number; impacto?: number }>>
}

const ESPELHO: Partial<Record<Direcao, Direcao>> = { SW: 'SE', W: 'E', NW: 'NE' }

/** Tempo de cada animação no jogo (12 quadros nas folhas completas). */
// `ciclo` (s): duração fixa do laço, qualquer que seja o número de quadros —
// o andar dá um ciclo de passos por casa (8 ou 12 quadros, os pés não deslizam)
const TEMPO: Record<NomeAnim, { fps: number; ciclo?: number; laco: boolean; impacto?: number; poeira?: number[] }> = {
  parado: { fps: 8, laco: true },
  andar: { fps: 15, ciclo: 0.8, laco: true },
  correr: { fps: 15, ciclo: 0.64, laco: true },
  frear: { fps: 12, laco: false, poeira: [2, 4] }, // pé arrastando (derrapagem)
  parar: { fps: 14, laco: false }, // parada brusca (corrida curta, 2 casas)
  atacar: { fps: 15, laco: false, impacto: 6 },
  dano: { fps: 16, laco: false },
  // skills de akuma (o efeito pode segurar quadros: Personagem.posar)
  conjurar: { fps: 9, laco: false },
  empurrar: { fps: 9, laco: false },
  cruzar: { fps: 9, laco: false },
  chutar: { fps: 12, laco: false },
}
const QUADROS_PADRAO = 12

let texSombra: THREE.Texture | null = null
const carregador = new THREE.TextureLoader()

/**
 * Arquivos embutidos na própria página (versão publicada para o celular):
 * caminho → data URI. Sem eles, busca normal pela URL.
 */
export function recurso(url: string) {
  const embutidos = (window as unknown as { __embutidos?: Record<string, string> }).__embutidos
  const chave = url.replace(/^.*?sprites\//, 'sprites/')
  return embutidos?.[chave] ?? url
}

function textura(url: string) {
  const t = carregador.load(recurso(url))
  t.magFilter = THREE.NearestFilter
  // reduzido (tabuleiro inteiro): mipmaps suavizam sem serrilhar;
  // ampliado (zoom): pixel nítido
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class VisualFolhas implements Visual {
  readonly info = {} as Record<NomeAnim, InfoAnim>
  readonly objetos: THREE.Object3D[]
  readonly altura: number
  readonly alturaPx: number
  private readonly densidade: number
  private readonly man: Manifesto
  private readonly base: string
  private readonly texturas = new Map<string, THREE.Texture>()
  private readonly sprite: THREE.Sprite
  private readonly sombra: THREE.Mesh
  private luz: DadosLuz | null = null
  /** o que foi mostrado no último quadro (para achar as marcas da Arma de Luz) */
  private atual: { anim: NomeAnim; dir: Direcao; q: number; espelha: boolean; L: number; A: number; pe: [number, number]; camera: THREE.Camera } | null = null

  private constructor(base: string, man: Manifesto) {
    this.base = base
    this.man = man
    this.densidade = man.densidade ?? 1
    this.alturaPx = (man.altura ?? 104) / this.densidade + 2
    this.altura = this.alturaPx / 60
    for (const [nome, t] of Object.entries(TEMPO) as [NomeAnim, (typeof TEMPO)[NomeAnim]][]) {
      const q = Object.values(man.anims[nome] ?? {})[0]?.quadros ?? QUADROS_PADRAO
      const poeira: InfoAnim['poeira'] = Array.from({ length: q }, (_, i) => (t.poeira?.includes(i) ? 'E' : undefined))
      const aj = man.tempos?.[nome]
      this.info[nome] = { quadros: q, fps: aj?.fps ?? (t.ciclo ? q / t.ciclo : t.fps), laco: t.laco, impacto: aj?.impacto ?? t.impacto, poeira }
    }
    this.sprite = new THREE.Sprite(materialIluminado())
    texSombra ??= texturaSombra()
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }))
    this.sombra.rotation.x = -Math.PI / 2
    this.objetos = [this.sprite, this.sombra]
  }

  static async carregar(personagem: string) {
    const base = `${import.meta.env.BASE_URL}sprites/${personagem}/`
    const url = recurso(`${base}manifesto.json`)
    // embutido na página: lê direto (algumas páginas bloqueiam fetch de data:)
    if (url.startsWith('data:')) {
      const texto = new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))
      const v = new VisualFolhas(base, JSON.parse(texto) as Manifesto)
      v.luz = await lerJsonOpcional<DadosLuz>(`${base}luz.json`)
      return v
    }
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`sem manifesto de ${personagem}`)
    const v = new VisualFolhas(base, (await resp.json()) as Manifesto)
    v.luz = await lerJsonOpcional<DadosLuz>(`${base}luz.json`)
    return v
  }

  /** Arma de Luz: as marcas do quadro mostrado agora, no mundo */
  pontosLuz() {
    const at = this.atual
    if (!this.luz || !at) return null
    const lista = (this.luz.anims[at.anim] ?? this.luz.anims.parado)?.[at.dir]
    const marcas = lista?.[Math.min(at.q, lista.length - 1)] ?? []
    const sp = this.sprite
    const m = at.camera.matrixWorld
    const dir = new THREE.Vector3().setFromMatrixColumn(m, 0).normalize()
    const cima = new THREE.Vector3().setFromMatrixColumn(m, 1).normalize()
    const paraCamera = new THREE.Vector3().setFromMatrixColumn(m, 2).normalize()
    const sx = Math.abs(sp.scale.x) / at.L
    const sy = sp.scale.y / at.A
    const pontos: PontoLuz[] = marcas.map((mk) => {
      const x = at.espelha ? at.L - mk.x : mk.x
      const pos = sp.position.clone().addScaledVector(dir, (x - at.pe[0]) * sx).addScaledVector(cima, (at.pe[1] - mk.y) * sy)
      pos.addScaledVector(paraCamera, mk.atras ? -0.12 : 0.06)
      return { pos, angulo: (at.espelha ? -1 : 1) * (mk.a ?? 0), comprimento: (mk.c ?? 0) * sy, atras: !!mk.atras }
    })
    return { tipo: this.luz.tipo, pontos }
  }

  /** chance de, a cada volta do parado, tocar uma variação (vento etc.) */
  private static readonly CHANCE_VARIACAO = 0.08
  private ciclo = -1
  private voltas = 0
  private faseAnterior = 0
  private animAnterior = ''
  private variacao: Folha | null = null

  /** Tira de quadros de uma animação numa direção (ou a pose parada). */
  private tira(anim: NomeAnim, dir: Direcao, ciclo: number, haki: Haki = false) {
    const base = this.man.anims[anim]?.[dir] ?? this.man.anims.parado?.[dir] ?? this.man.anims.parado?.S
    // parado em laço: a cada volta sorteia se toca a normal ou uma variação
    if (ciclo !== this.ciclo) {
      this.ciclo = ciclo
      const vs = anim === 'parado' ? Object.entries(base?.variantes ?? {}).filter(([k]) => k !== 'haki' && k !== 'rei').map(([, v]) => v) : []
      this.variacao = vs.length && this.variacao === null && Math.random() < VisualFolhas.CHANCE_VARIACAO ? vs[Math.floor(Math.random() * vs.length)] : null
    }
    // Haki: o ataque troca pela versão com a lâmina negra (ou a do Rei, com raios)
    const comHaki = haki === 'rei' ? (base?.variantes?.rei ?? base?.variantes?.haki) : haki ? base?.variantes?.haki : undefined
    const a = comHaki || (anim === 'parado' && this.variacao) || base
    if (!a) return null
    let t = this.texturas.get(a.arquivo)
    if (!t) {
      t = textura(this.base + a.arquivo)
      t.repeat.set(1 / a.quadros, 1)
      this.texturas.set(a.arquivo, t)
    }
    return { t, quadros: a.quadros, propria: !!this.man.anims[anim]?.[dir], quadro: a.quadro ?? this.man.quadro, pe: a.pe ?? this.man.pe }
  }

  tem(anim: NomeAnim, dir: Direcao) {
    dir = this.man.apelidos?.[dir] ?? dir
    return !!this.man.anims[anim]?.[dir] || (dir in ESPELHO && !!this.man.anims[anim]?.[ESPELHO[dir]!])
  }

  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    // direção da esquerda desenhada de verdade (texto do quepe certo) tem
    // prioridade; sem ela, usa o espelho da direita
    // (só espelha se a direita tiver essa animação; senão cai no parado da
    // própria direção, que já existe nas 8)
    const tem = (d: Direcao) => !!this.man.anims[e.anim]?.[d]
    const eDir = this.man.apelidos?.[e.dir] ?? e.dir
    const espelha = !tem(eDir) && eDir in ESPELHO && tem(ESPELHO[eDir]!)
    const dir = espelha ? ESPELHO[eDir]! : eDir
    const info = this.info[e.anim]
    const dur = info.quadros / info.fps
    const fase = info.laco ? (e.tAnim / dur) % 1 : Math.min(1, e.tAnim / dur)
    // nova volta do laço (a fase recomeçou) ou outra animação: novo ciclo
    if (e.anim !== this.animAnterior || fase < this.faseAnterior - 0.5) this.voltas++
    this.animAnterior = e.anim
    this.faseAnterior = fase
    const ciclo = this.voltas
    const tira = this.tira(e.anim, dir, ciclo, e.haki)
    if (!tira) return
    const q = tira.quadros > 1 ? Math.min(tira.quadros - 1, Math.floor(fase * tira.quadros)) : 0
    const animMostrada = this.man.anims[e.anim]?.[dir] ? e.anim : 'parado'
    const mat = this.sprite.material
    if (mat.map !== tira.t) {
      mat.map = tira.t
      mat.needsUpdate = true
    }
    // espelho pela textura (o shader de sprite ignora escala negativa)
    tira.t.repeat.set((espelha ? -1 : 1) / tira.quadros, 1)
    tira.t.offset.set((q + (espelha ? 1 : 0)) / tira.quadros, 0)
    const [L, A] = tira.quadro
    const cx = tira.pe[0] / L
    this.sprite.center.set(espelha ? 1 - cx : cx, 1 - tira.pe[1] / A)
    const k = e.clarao > 0 ? 3.2 : 1
    mat.color.setRGB(k, k, k)
    if (e.tinta) mat.color.multiply(e.tinta)
    this.sprite.visible = !e.oculto
    const desvio = tira.propria ? ([0, 0] as [number, number]) : this.movimentoProvisorio(e, fase)
    const peY = 1 - tira.pe[1] / A
    atualizarLuz(mat, tira.t, espelha, peY, peY + (this.man.altura ?? 104) / A, e.luz)
    posicionarPixel(this.sprite, e.pos, L / this.densidade, A / this.densidade, camera, telaL, telaA, false, 0.45, desvio)
    if (e.escala && e.escala !== 1) this.sprite.scale.multiplyScalar(e.escala)
    this.atual = { anim: animMostrada, dir, q: animMostrada === e.anim ? q : 0, espelha, L, A, pe: tira.pe, camera }
    this.sombra.position.set(e.pos.x, 0.012, e.pos.z)
    const s = 1 - Math.min(0.5, e.pos.y * 0.6)
    this.sombra.scale.set(s, s, 1)
  }

  /** Enquanto a animação não foi desenhada: movimento simples da pose parada. */
  private movimentoProvisorio(e: EstadoVisual, fase: number): [number, number] {
    const frente = { S: [0, 1], SE: [1, 1], E: [1, 0], NE: [1, -1], N: [0, -1], NW: [-1, -1], W: [-1, 0], SW: [-1, 1] }[e.dir]
    switch (e.anim) {
      case 'andar':
        return [0, -Math.abs(Math.sin(fase * Math.PI * 2)) * 3]
      case 'correr':
        return [0, -Math.abs(Math.sin(fase * Math.PI * 2)) * 5]
      case 'atacar': {
        const k = Math.sin(Math.PI * Math.min(1, fase * 1.6)) * 12
        return [frente[0] * k, frente[1] * k * 0.6]
      }
      case 'dano': {
        const k = -Math.sin(Math.PI * fase) * 6
        return [frente[0] * k, frente[1] * k * 0.6]
      }
      default:
        return [0, 0]
    }
  }
}
