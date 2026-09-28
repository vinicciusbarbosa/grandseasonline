import * as THREE from 'three'
import type { Direcao, EstadoVisual, InfoAnim, NomeAnim, Visual } from './personagem'
import { posicionarPixel } from './pixel'
import { texturaSombra } from './texturas'

/**
 * Visual com as folhas desenhadas (pixel art estilo Ragnarok), importadas por
 * scripts/sprites/importar_folha.py para public/sprites/<personagem>/.
 *
 * Cada animação/direção é uma tira de quadros 128×128 com o pé em (64, 112).
 * Direções desenhadas: S, SE, E, NE, N; SW, W e NW são o espelho.
 * Enquanto uma animação não existe, usa a pose parada com um movimento
 * simples (balanço ao andar, investida no ataque, recuo no dano).
 */

type Manifesto = {
  quadro: [number, number]
  pe: [number, number]
  anims: Partial<Record<NomeAnim, Partial<Record<Direcao, { arquivo: string; quadros: number }>>>>
}

const ESPELHO: Partial<Record<Direcao, Direcao>> = { SW: 'SE', W: 'E', NW: 'NE' }

/** Tempo de cada animação no jogo (12 quadros nas folhas completas). */
const TEMPO: Record<NomeAnim, { fps: number; laco: boolean; impacto?: number; poeira?: number[] }> = {
  parado: { fps: 8, laco: true },
  andar: { fps: 15, laco: true },
  correr: { fps: 24, laco: true },
  frear: { fps: 16, laco: false, poeira: [0, 3] },
  atacar: { fps: 15, laco: false, impacto: 6 },
  dano: { fps: 16, laco: false },
}
const QUADROS_PADRAO = 12

let texSombra: THREE.Texture | null = null
const carregador = new THREE.TextureLoader()

/**
 * Arquivos embutidos na própria página (versão publicada para o celular):
 * caminho → data URI. Sem eles, busca normal pela URL.
 */
function recurso(url: string) {
  const embutidos = (window as unknown as { __embutidos?: Record<string, string> }).__embutidos
  const chave = url.replace(/^.*?sprites\//, 'sprites/')
  return embutidos?.[chave] ?? url
}

function textura(url: string) {
  const t = carregador.load(recurso(url))
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class VisualFolhas implements Visual {
  readonly info = {} as Record<NomeAnim, InfoAnim>
  readonly objetos: THREE.Object3D[]
  readonly altura: number
  readonly alturaPx = 106
  private readonly man: Manifesto
  private readonly base: string
  private readonly texturas = new Map<string, THREE.Texture>()
  private readonly sprite: THREE.Sprite
  private readonly sombra: THREE.Mesh

  private constructor(base: string, man: Manifesto) {
    this.base = base
    this.man = man
    this.altura = (man.pe[1] / 48) * 0.95 // ~px de altura / px por casa
    for (const [nome, t] of Object.entries(TEMPO) as [NomeAnim, (typeof TEMPO)[NomeAnim]][]) {
      const q = Object.values(man.anims[nome] ?? {})[0]?.quadros ?? QUADROS_PADRAO
      const poeira: InfoAnim['poeira'] = Array.from({ length: q }, (_, i) => (t.poeira?.includes(i) ? 'E' : undefined))
      this.info[nome] = { quadros: q, fps: t.fps, laco: t.laco, impacto: t.impacto, poeira }
    }
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.5 }))
    texSombra ??= texturaSombra()
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.38), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }))
    this.sombra.rotation.x = -Math.PI / 2
    this.objetos = [this.sprite, this.sombra]
  }

  static async carregar(personagem: string) {
    const base = `${import.meta.env.BASE_URL}sprites/${personagem}/`
    const url = recurso(`${base}manifesto.json`)
    // embutido na página: lê direto (algumas páginas bloqueiam fetch de data:)
    if (url.startsWith('data:')) {
      const texto = new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))
      return new VisualFolhas(base, JSON.parse(texto) as Manifesto)
    }
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`sem manifesto de ${personagem}`)
    return new VisualFolhas(base, (await resp.json()) as Manifesto)
  }

  /** Tira de quadros de uma animação numa direção (ou a pose parada). */
  private tira(anim: NomeAnim, dir: Direcao) {
    const a = this.man.anims[anim]?.[dir] ?? this.man.anims.parado?.[dir] ?? this.man.anims.parado?.S
    if (!a) return null
    let t = this.texturas.get(a.arquivo)
    if (!t) {
      t = textura(this.base + a.arquivo)
      t.repeat.set(1 / a.quadros, 1)
      this.texturas.set(a.arquivo, t)
    }
    return { t, quadros: a.quadros, propria: !!this.man.anims[anim]?.[dir] }
  }

  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    const espelha = e.dir in ESPELHO
    const dir = ESPELHO[e.dir] ?? e.dir
    const tira = this.tira(e.anim, dir)
    if (!tira) return
    const info = this.info[e.anim]
    const dur = info.quadros / info.fps
    const fase = info.laco ? (e.tAnim / dur) % 1 : Math.min(1, e.tAnim / dur)
    const q = tira.quadros > 1 ? Math.min(tira.quadros - 1, Math.floor(fase * tira.quadros)) : 0
    const mat = this.sprite.material
    if (mat.map !== tira.t) {
      mat.map = tira.t
      mat.needsUpdate = true
    }
    tira.t.offset.set(q / tira.quadros, 0)
    const [L, A] = this.man.quadro
    const cx = this.man.pe[0] / L
    this.sprite.center.set(espelha ? 1 - cx : cx, 1 - this.man.pe[1] / A)
    const k = e.clarao > 0 ? 3.2 : 1
    mat.color.setRGB(k, k, k)
    const desvio = tira.propria ? ([0, 0] as [number, number]) : this.movimentoProvisorio(e, fase)
    posicionarPixel(this.sprite, e.pos, L, A, camera, telaL, telaA, espelha, 0.45, desvio)
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
