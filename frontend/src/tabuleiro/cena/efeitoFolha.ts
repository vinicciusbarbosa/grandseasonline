import * as THREE from 'three'
import { recurso } from './visualFolhas'

/**
 * Efeito desenhado à mão (spritesheet), importado por
 * scripts/sprites/importar_efeito.py para public/sprites/efeitos/<nome>/:
 * uma tira por direção (as que o artista desenhou) + manifesto. As outras
 * saem espelhando o lado oposto (E↔W, SE↔SW, NE↔NW) ou da mais parecida.
 *
 * Toca os quadros num ponto (golpe de perto) ou voando de um ponto a outro
 * entre dois quadros (projétil), em pixel art nítido.
 */

export type DirEfeito = 'E' | 'SE' | 'NE' | 'S' | 'N' | 'W' | 'SW' | 'NW'
type Manifesto = { quadro: [number, number]; quadros: number; fps: number; direcoes: string[] }

/** par espelhado de cada direção (a folha pode trazer qualquer lado) */
const PAR: Record<DirEfeito, DirEfeito> = { E: 'W', W: 'E', SE: 'SW', SW: 'SE', NE: 'NW', NW: 'NE', S: 'S', N: 'N' }
/** vizinhas, da mais parecida para a menos (quando a folha não tem a direção nem o espelho) */
const VIZINHAS: Record<DirEfeito, DirEfeito[]> = {
  E: ['SE', 'NE', 'S', 'N'], W: ['SW', 'NW', 'S', 'N'], S: ['SE', 'SW', 'E', 'W'], N: ['NE', 'NW', 'E', 'W'],
  SE: ['S', 'E', 'SW', 'NE'], SW: ['S', 'W', 'SE', 'NW'], NE: ['N', 'E', 'NW', 'SE'], NW: ['N', 'W', 'NE', 'SW'],
}

/** Qual tira usar para a direção pedida, e se é espelhada. */
function escolher(tem: string[], dir: DirEfeito): [DirEfeito, boolean] {
  for (const d of [dir, ...VIZINHAS[dir]]) {
    if (tem.includes(d)) return [d, false]
    if (tem.includes(PAR[d])) return [PAR[d], true]
  }
  return [tem[0] as DirEfeito, false]
}
const manifestos = new Map<string, Promise<Manifesto | null>>()
const texturas = new Map<string, THREE.Texture>()
const carregador = new THREE.TextureLoader()

function base(nome: string) {
  return `${import.meta.env.BASE_URL}sprites/efeitos/${nome}/`
}

/** Manifesto do efeito (null se a folha ainda não existe). */
export function manifestoEfeito(nome: string) {
  let m = manifestos.get(nome)
  if (!m) {
    const url = recurso(`${base(nome)}manifesto.json`)
    m = (url.startsWith('data:')
      ? Promise.resolve(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))) as Manifesto)
      : fetch(url).then((r) => (r.ok ? (r.json() as Promise<Manifesto>) : null))
    ).catch(() => null)
    manifestos.set(nome, m)
  }
  return m
}

/** Direção do efeito a partir do deslocamento no tabuleiro (linhas, colunas). */
export function direcaoEfeito(dl: number, dc: number): DirEfeito {
  if (!dl && !dc) return 'S'
  const a = Math.atan2(dl, dc) // 0 = direita (E), +90° = para a câmera (S)
  const s = Math.round(a / (Math.PI / 4))
  return ({ 0: 'E', 1: 'SE', 2: 'S', 3: 'SW', 4: 'W', [-4]: 'W', [-3]: 'NW', [-2]: 'N', [-1]: 'NE' } as Record<number, DirEfeito>)[s]
}

export class EfeitoFolha {
  readonly sprite: THREE.Sprite
  vivo = true
  private t = 0
  private readonly man: Manifesto
  private readonly espelha: boolean
  private readonly de: THREE.Vector3
  private readonly para: THREE.Vector3 | null
  private readonly voo: [number, number]
  private readonly aoChegar?: () => void
  private chegou = false

  /**
   * @param largura largura no mundo (casas)
   * @param voo quadros entre os quais o efeito voa de `de` até `para`
   */
  constructor(nome: string, man: Manifesto, dir: DirEfeito, de: THREE.Vector3, op: { para?: THREE.Vector3; largura?: number; voo?: [number, number]; aoChegar?: () => void } = {}) {
    this.man = man
    const [d, espelha] = escolher(man.direcoes, dir)
    this.espelha = espelha
    const chave = `${nome}/${d}`
    let tex = texturas.get(chave)
    if (!tex) {
      tex = carregador.load(recurso(`${base(nome)}${d}.png`))
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.LinearFilter
      tex.colorSpace = THREE.SRGBColorSpace
      texturas.set(chave, tex)
    }
    const t = tex.clone()
    t.needsUpdate = true
    t.repeat.set((this.espelha ? -1 : 1) / man.quadros, 1)
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }))
    const L = op.largura ?? 2
    this.sprite.scale.set(L, (L * man.quadro[1]) / man.quadro[0], 1)
    this.sprite.renderOrder = 7
    this.de = de.clone()
    this.para = op.para?.clone() ?? null
    this.voo = op.voo ?? [0, man.quadros - 1]
    this.aoChegar = op.aoChegar
    this.sprite.position.copy(de)
    this.mostrar(0)
  }

  private mostrar(q: number) {
    const m = this.sprite.material.map!
    m.offset.set((q + (this.espelha ? 1 : 0)) / this.man.quadros, 0)
  }

  /** duração total (s) */
  get duracao() {
    return this.man.quadros / this.man.fps
  }

  atualizar(dt: number) {
    this.t += dt
    const q = Math.min(this.man.quadros - 1, Math.floor(this.t * this.man.fps))
    this.mostrar(q)
    if (this.para) {
      const [a, b] = this.voo
      const f = Math.max(0, Math.min(1, (this.t * this.man.fps - a) / Math.max(1, b - a)))
      this.sprite.position.lerpVectors(this.de, this.para, f)
      if (f >= 1 && !this.chegou) {
        this.chegou = true
        this.aoChegar?.()
      }
    }
    if (this.t >= this.duracao) {
      this.vivo = false
      if (!this.chegou) {
        this.chegou = true
        this.aoChegar?.()
      }
    }
  }

  descartar() {
    this.sprite.material.map?.dispose()
    this.sprite.material.dispose()
  }
}
