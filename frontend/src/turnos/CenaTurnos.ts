import * as THREE from 'three'
import { EfeitoFolha, manifestoEfeito, type DirEfeito } from '../tabuleiro/cena/efeitoFolha'
import type { Lado } from './regras'

/**
 * Cena do combate por turnos (estilo Honkai, em "2D com profundidade"):
 * os personagens são recortes planos (os sprites de sempre) num convés 3D,
 * com a câmera atrás da tripulação — os nossos de costas, a Marinha de frente.
 *
 * Nada de animação desenhada além do que os sprites já têm: o resto é
 * movimento (avanço, recuo, tremor, clarão) e as folhas de efeito.
 */

type Folha = { arquivo: string; quadros: number; quadro?: [number, number]; pe?: [number, number] }
type Manifesto = { quadro: [number, number]; pe: [number, number]; anims: Record<string, Record<string, Folha>> }
type Anim = 'parado' | 'andar' | 'atacar'

/** px do sprite → mundo (o personagem LPC fica com ~1,8 de altura) */
const K = 2.3 / 128
const FPS: Record<Anim, number> = { parado: 1, andar: 10, atacar: 12 }
const IMPACTO = 3 / 12

const texturas = new Map<string, THREE.Texture>()
function textura(url: string) {
  let t = texturas.get(url)
  if (!t) {
    t = new THREE.TextureLoader().load(url)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearFilter
    t.colorSpace = THREE.SRGBColorSpace
    texturas.set(url, t)
  }
  return t
}

class Boneco {
  readonly sprite: THREE.Sprite
  readonly sombra: THREE.Mesh
  readonly casa: THREE.Vector3
  readonly pos: THREE.Vector3
  anim: Anim = 'parado'
  t = 0
  clarao = 0
  tremor = 0
  opacidade = 1
  respira = Math.random() * 6
  private readonly mapas = new Map<string, THREE.Texture>()

  private readonly base: string
  private readonly man: Manifesto
  readonly lado: Lado
  readonly escala: number

  constructor(base: string, man: Manifesto, lado: Lado, casa: THREE.Vector3, escala: number) {
    this.base = base
    this.man = man
    this.lado = lado
    this.escala = escala
    this.casa = casa.clone()
    this.pos = casa.clone()
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.05 }))
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.55 * escala, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }))
    s.rotation.x = -Math.PI / 2
    s.scale.y = 0.45
    this.sombra = s
  }

  /** costas para a câmera (N) nos nossos; de frente (S) na Marinha */
  private get dir() {
    return this.lado === 'tripulacao' ? 'N' : 'S'
  }

  atualizar(dt: number) {
    this.t += dt
    this.respira += dt
    this.clarao = Math.max(0, this.clarao - dt * 4)
    this.tremor = Math.max(0, this.tremor - dt * 3)
    const f = this.man.anims[this.anim]?.[this.dir] ?? this.man.anims.parado[this.dir]
    let m = this.mapas.get(f.arquivo)
    if (!m) {
      m = textura(this.base + f.arquivo).clone()
      m.repeat.set(1 / f.quadros, 1)
      this.mapas.set(f.arquivo, m)
    }
    const mat = this.sprite.material
    if (mat.map !== m) {
      mat.map = m
      mat.needsUpdate = true
    }
    const q = this.anim === 'atacar' ? Math.min(f.quadros - 1, Math.floor(this.t * FPS.atacar)) : Math.floor(this.t * FPS[this.anim]) % f.quadros
    m.offset.set(q / f.quadros, 0)
    const [L, A] = f.quadro ?? this.man.quadro
    const pe = f.pe ?? this.man.pe
    this.sprite.center.set(pe[0] / L, 1 - pe[1] / A)
    // respiração: um leve sobe-desce de escala quando parado
    const r = this.anim === 'parado' ? 1 + Math.sin(this.respira * 2.2) * 0.012 : 1
    this.sprite.scale.set(L * K * this.escala, A * K * this.escala * r, 1)
    const tr = this.tremor > 0 ? (Math.random() - 0.5) * 0.25 * this.tremor : 0
    this.sprite.position.set(this.pos.x + tr, this.pos.y, this.pos.z)
    const k = 1 + this.clarao * 2.5
    mat.color.setRGB(k, k, k)
    mat.opacity = this.opacidade
    this.sombra.position.set(this.pos.x, 0.01, this.pos.z)
    ;(this.sombra.material as THREE.MeshBasicMaterial).opacity = 0.32 * this.opacidade
  }
}

type Tween = { t: number; dur: number; fn: (k: number) => void; fim: () => void }
const suave = (k: number) => k * k * (3 - 2 * k)

export class CenaTurnos {
  private readonly renderizador: THREE.WebGLRenderer
  private readonly cena = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
  private readonly bonecos = new Map<string, Boneco>()
  private readonly tweens: Tween[] = []
  private readonly efeitos: EfeitoFolha[] = []
  private readonly anel: THREE.Mesh
  private readonly camPos = new THREE.Vector3(0, 3.5, 10.4)
  private readonly camOlha = new THREE.Vector3(0, 1.2, -2.2)
  private readonly camPosAlvo = this.camPos.clone()
  private readonly camOlhaAlvo = this.camOlha.clone()
  private tremorTela = 0
  private ultimo = performance.now()
  private vivo = true
  private readonly tela: HTMLCanvasElement
  /** camada HTML por cima (números de dano e o que segue os personagens) */
  private readonly camada: HTMLDivElement

  constructor(tela: HTMLCanvasElement, camada: HTMLDivElement) {
    this.tela = tela
    this.camada = camada
    this.renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true })
    this.renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.cenario()
    this.anel = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 40), new THREE.MeshBasicMaterial({ color: 0xf0c76a, transparent: true, opacity: 0.85, depthWrite: false }))
    this.anel.rotation.x = -Math.PI / 2
    this.anel.scale.y = 0.45
    this.anel.visible = false
    this.cena.add(this.anel)
    window.addEventListener('resize', this.redimensionar)
    this.redimensionar()
    requestAnimationFrame(this.passo)
  }

  destruir() {
    this.vivo = false
    window.removeEventListener('resize', this.redimensionar)
    this.renderizador.dispose()
  }

  /** Céu, mar, convés, mastros, amurada e barris. */
  private cenario() {
    const ceu = document.createElement('canvas')
    ceu.width = 2
    ceu.height = 256
    const c = ceu.getContext('2d')!
    const gr = c.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#3f7fc4')
    gr.addColorStop(0.55, '#9cc7e6')
    gr.addColorStop(1, '#e8f1f4')
    c.fillStyle = gr
    c.fillRect(0, 0, 2, 256)
    const tc = new THREE.CanvasTexture(ceu)
    tc.colorSpace = THREE.SRGBColorSpace
    this.cena.background = tc
    this.cena.fog = new THREE.Fog(0xcfe2ee, 16, 60)

    this.cena.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b5136, 1.6))
    const sol = new THREE.DirectionalLight(0xfff1d6, 1.6)
    sol.position.set(-4, 8, 3)
    this.cena.add(sol)

    // mar
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x1f6fa8 }))
    mar.rotation.x = -Math.PI / 2
    mar.position.y = -1.6
    this.cena.add(mar)

    // convés: tábuas correndo para o fundo (dá a leitura de profundidade)
    const tab = document.createElement('canvas')
    tab.width = 256
    tab.height = 256
    const t = tab.getContext('2d')!
    const larg = 32
    for (let i = 0; i < 8; i++) {
      const tom = 120 + Math.floor(Math.random() * 30)
      t.fillStyle = `rgb(${tom + 40},${tom},${tom - 45})`
      t.fillRect(i * larg, 0, larg, 256)
      t.fillStyle = 'rgba(60,35,15,0.55)'
      t.fillRect(i * larg, 0, 2, 256)
      const corte = Math.floor(Math.random() * 256)
      t.fillRect(i * larg, corte, larg, 2)
      t.fillStyle = 'rgba(255,240,210,0.08)'
      for (let k = 0; k < 6; k++) t.fillRect(i * larg + 4 + Math.random() * 24, Math.random() * 256, 1, 30 + Math.random() * 40)
    }
    const tt = new THREE.CanvasTexture(tab)
    tt.wrapS = tt.wrapT = THREE.RepeatWrapping
    tt.repeat.set(4, 6)
    tt.colorSpace = THREE.SRGBColorSpace
    tt.anisotropy = 8
    const conves = new THREE.Mesh(new THREE.PlaneGeometry(16, 30), new THREE.MeshLambertMaterial({ map: tt }))
    conves.rotation.x = -Math.PI / 2
    conves.position.z = -6
    this.cena.add(conves)

    const madeira = new THREE.MeshLambertMaterial({ color: 0x6b4426 })
    const escura = new THREE.MeshLambertMaterial({ color: 0x4a2e19 })
    // amurada dos dois lados
    for (const x of [-8, 8]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 30), madeira)
      a.position.set(x, 0.55, -6)
      this.cena.add(a)
      for (let z = 8; z > -21; z -= 1.6) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.3, 0.25), escura)
        p.position.set(x, 0.65, z)
        this.cena.add(p)
      }
    }
    // mastros e velas
    const vela = new THREE.MeshLambertMaterial({ color: 0xf2ead6, side: THREE.DoubleSide })
    for (const [x, z, h] of [
      [-5.2, -8, 14],
      [5.6, -13, 16],
    ]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 10), escura)
      m.position.set(x, h / 2, z)
      this.cena.add(m)
      const v = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.2, 8, 4), vela)
      const pos = v.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.cos(pos.getX(i) / 2.75) * 0.6)
      v.position.set(x, h * 0.62, z + 0.35)
      this.cena.add(v)
    }
    // barris e caixotes nas bordas
    const barril = new THREE.MeshLambertMaterial({ color: 0x8a5a2e })
    for (const [x, z] of [
      [-6.8, 1.5],
      [-6.6, 0.4],
      [6.7, -1],
      [6.4, -6.5],
      [-6.9, -11],
    ]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 14), barril)
      b.position.set(x, 0.48, z)
      this.cena.add(b)
    }
    for (const [x, z] of [
      [6.6, 2.2],
      [-6.5, -4.2],
    ]) {
      const cx = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1), madeira)
      cx.position.set(x, 0.45, z)
      cx.rotation.y = 0.3
      this.cena.add(cx)
    }
  }

  async carregar(lista: { id: string; sprite: string; lado: Lado; chefe?: boolean }[]) {
    const nossos = lista.filter((u) => u.lado === 'tripulacao')
    const eles = lista.filter((u) => u.lado === 'inimigos')
    const lugar = (i: number, n: number, z: number, passo: number) => new THREE.Vector3((i - (n - 1) / 2) * passo, 0, z)
    await Promise.all(
      lista.map(async (u) => {
        const base = `${import.meta.env.BASE_URL}sprites/${u.sprite}/`
        const man = (await (await fetch(`${base}manifesto.json`)).json()) as Manifesto
        const nosso = u.lado === 'tripulacao'
        const casa = nosso ? lugar(nossos.indexOf(u), nossos.length, 2.6, 2.1) : lugar(eles.indexOf(u), eles.length, -3.2, 2.1)
        if (u.chefe) casa.z -= 0.6
        const b = new Boneco(base, man, u.lado, casa, u.chefe ? 1.3 : 1)
        this.bonecos.set(u.id, b)
        this.cena.add(b.sprite, b.sombra)
      }),
    )
  }

  /** Posição na tela (px) de um ponto do personagem: 0 = pé, 1 = topo da cabeça. */
  telaDe(id: string, altura = 1) {
    const b = this.bonecos.get(id)
    if (!b) return null
    const p = b.pos.clone()
    p.y += 1.85 * b.escala * altura
    p.project(this.camera)
    return { x: ((p.x + 1) / 2) * this.tela.clientWidth, y: ((1 - p.y) / 2) * this.tela.clientHeight }
  }

  /** Anel dourado no pé de quem está agindo. */
  marcarAtual(id: string | null) {
    const b = id ? this.bonecos.get(id) : null
    this.anel.visible = !!b
    if (b) this.anel.position.set(b.casa.x, 0.02, b.casa.z)
  }

  private animar(dur: number, fn: (k: number) => void) {
    return new Promise<void>((fim) => this.tweens.push({ t: 0, dur, fn, fim }))
  }
  private esperar(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }

  /** Câmera: aproxima de um ponto (ou volta para trás da tripulação). */
  focar(alvo: THREE.Vector3 | null, perto = 0.35) {
    if (!alvo) {
      this.camPosAlvo.set(0, 3.5, 10.4)
      this.camOlhaAlvo.set(0, 1.2, -2.2)
      return
    }
    this.camOlhaAlvo.copy(alvo).setY(1.1)
    this.camPosAlvo.set(0, 3.5, 10.4).lerp(new THREE.Vector3(alvo.x * 0.6, 2.4, alvo.z + 6), perto)
  }

  tremer(f: number) {
    this.tremorTela = Math.max(this.tremorTela, f)
  }

  /** Número de dano subindo (e "Quebra!" quando o escudo cai). */
  numero(id: string, texto: string, cor: string, grande = false) {
    const p = this.telaDe(id, 0.75)
    if (!p) return
    const el = document.createElement('div')
    el.textContent = texto
    el.className = 'turnos-numero'
    el.style.cssText = `position:absolute;left:${p.x + (Math.random() - 0.5) * 40}px;top:${p.y}px;transform:translate(-50%,-50%);color:${cor};font:900 ${grande ? 34 : 24}px Georgia,serif;text-shadow:0 2px 0 #000,0 0 6px #000;pointer-events:none;transition:transform 0.9s ease-out,opacity 0.9s ease-in;`
    this.camada.appendChild(el)
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%,-160%) scale(1.1)'
      el.style.opacity = '0'
    })
    setTimeout(() => el.remove(), 950)
  }

  /** Recebe o golpe: clarão, tremor e um passo para trás. */
  apanhar(id: string, forte = false) {
    const b = this.bonecos.get(id)
    if (!b) return
    b.clarao = 1
    b.tremor = forte ? 1.4 : 1
    const recuo = b.lado === 'tripulacao' ? 0.25 : -0.25
    void this.animar(0.28, (k) => (b.pos.z = b.casa.z + Math.sin(k * Math.PI) * recuo))
  }

  async cair(id: string) {
    const b = this.bonecos.get(id)
    if (!b) return
    await this.animar(0.6, (k) => {
      b.opacidade = 1 - k
      b.pos.y = -k * 0.4
    })
    b.sprite.visible = false
    b.sombra.visible = false
  }

  /** Efeito simples de impacto (anel claro que se abre). */
  private anelImpacto(pos: THREE.Vector3, cor: number, tam = 1) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 32), new THREE.MeshBasicMaterial({ color: cor, transparent: true, depthTest: false, side: THREE.DoubleSide }))
    m.position.copy(pos).setY(1)
    m.lookAt(this.camera.position)
    m.renderOrder = 8
    this.cena.add(m)
    void this.animar(0.32, (k) => {
      m.scale.setScalar(1 + k * 3.5 * tam)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 1 - k
    }).then(() => this.cena.remove(m))
  }

  /** Corte: um risco claro e rápido atravessando o alvo. */
  private risco(pos: THREE.Vector3, cor = 0xffffff) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.09), new THREE.MeshBasicMaterial({ color: cor, transparent: true, depthTest: false }))
    m.position.copy(pos).setY(1.1)
    m.lookAt(this.camera.position)
    m.rotateZ(Math.random() * 1.2 - 0.6 + 0.5)
    m.renderOrder = 8
    this.cena.add(m)
    void this.animar(0.22, (k) => {
      m.scale.set(0.3 + k * 1.2, 1 - k * 0.6, 1)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 1 - k
    }).then(() => this.cena.remove(m))
  }

  /** Rastro de bala do atirador até o alvo. */
  private tiro(de: THREE.Vector3, ate: THREE.Vector3) {
    const a = de.clone().setY(1.2)
    const b = ate.clone().setY(1.1)
    const g = new THREE.BufferGeometry().setFromPoints([a, b])
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true }))
    this.cena.add(l)
    void this.animar(0.18, (k) => ((l.material as THREE.LineBasicMaterial).opacity = 1 - k)).then(() => this.cena.remove(l))
  }

  private async folha(nome: string, dir: DirEfeito, de: THREE.Vector3, op: ConstructorParameters<typeof EfeitoFolha>[4] = {}) {
    const man = await manifestoEfeito(nome)
    if (!man) return false
    await new Promise<void>((r) => {
      const ef = new EfeitoFolha(nome, man, dir, de, op.para ? { ...op, aoChegar: () => (op.aoChegar?.(), r()) } : { ...op, aoAcabar: r })
      ef.sprite.renderOrder = 9
      this.efeitos.push(ef)
      this.cena.add(ef.sprite)
    })
    return true
  }

  /**
   * Um golpe completo: o ator avança (corpo a corpo) ou fica no lugar
   * (tiro, área), toca o ataque, e no impacto chama `aoImpacto` (que mostra
   * os números). `estilo` escolhe o efeito.
   */
  async golpe(atorId: string, alvos: string[], estilo: 'corte' | 'impacto' | 'tiro' | 'haki' | 'fogo', modo: 'basico' | 'habilidade' | 'ultimate' | 'inimigo', efeito: string | undefined, aoImpacto: () => void) {
    const a = this.bonecos.get(atorId)!
    const bs = alvos.map((id) => this.bonecos.get(id)!).filter(Boolean)
    const principal = bs[0]
    const centro = bs.reduce((s, b) => s.add(b.casa), new THREE.Vector3()).divideScalar(Math.max(1, bs.length))
    const corpo = estilo !== 'tiro' && modo !== 'ultimate' && bs.length > 0 && efeito !== 'hiken-perto'
    this.focar(modo === 'inimigo' ? null : centro, modo === 'ultimate' ? 0.55 : 0.3)

    if (modo === 'ultimate' && efeito === 'entei') {
      // Entei: carga sobre o lutador, a bola voa até o meio dos inimigos e explode
      this.focar(a.casa, 0.5)
      await this.folha('entei-carga', 'S', a.casa.clone().setY(0.02), { escala: 1.4 })
      this.focar(centro, 0.45)
      await this.folha('entei-bola', 'S', a.casa.clone().setY(0.02), { para: centro.clone().setY(0.02), escala: 1.4 })
      const exp = this.folha('entei-explosao', 'S', centro.clone().setY(0.02), { escala: 2.2 })
      await this.esperar(160)
      for (const b of bs) this.apanhar(alvos[bs.indexOf(b)], true)
      this.tremer(1)
      aoImpacto()
      await exp
      this.focar(null)
      return
    }

    let ida = a.casa.clone()
    if (corpo) {
      // corpo a corpo: corre até a frente do alvo
      const dz = a.lado === 'tripulacao' ? 1.25 : -1.25
      ida = principal.casa.clone().add(new THREE.Vector3(0, 0, dz))
      a.anim = 'andar'
      a.t = 0
      const de = a.pos.clone()
      await this.animar(0.3, (k) => a.pos.lerpVectors(de, ida, suave(k)))
    }
    a.anim = 'atacar'
    a.t = 0
    await this.esperar(IMPACTO * 1000)
    // efeito por estilo
    if (efeito === 'hiken-perto') {
      for (const b of bs) void this.folha('hiken-perto', 'N', b.casa.clone().setY(0.9), { largura: 2.4 })
      await this.esperar(120)
    }
    for (const b of bs) {
      if (estilo === 'tiro') this.tiro(a.pos, b.casa)
      else if (estilo === 'corte') this.risco(b.casa)
      else if (estilo === 'haki') {
        this.risco(b.casa, 0xd04cff)
        this.anelImpacto(b.casa, 0x8a2bff, 1.2)
      } else if (efeito !== 'hiken-perto') this.anelImpacto(b.casa, estilo === 'fogo' ? 0xff8a3a : 0xffffff)
    }
    for (const id of alvos) this.apanhar(id, modo === 'ultimate')
    this.tremer(modo === 'ultimate' ? 0.8 : modo === 'habilidade' ? 0.45 : 0.25)
    aoImpacto()
    await this.esperar(380)
    if (corpo) {
      a.anim = 'andar'
      a.t = 0
      const de = a.pos.clone()
      await this.animar(0.3, (k) => a.pos.lerpVectors(de, a.casa, suave(k)))
    }
    a.anim = 'parado'
    a.t = 0
    this.focar(null)
    await this.esperar(150)
  }

  private readonly redimensionar = () => {
    const w = this.tela.clientWidth
    const h = this.tela.clientHeight
    this.renderizador.setSize(w, h, false)
    this.camera.aspect = w / h
    // tela estreita: abre um pouco o campo de visão para caber os dois lados
    this.camera.fov = w / h < 1.2 ? 58 : 42
    this.camera.updateProjectionMatrix()
  }

  private readonly passo = () => {
    if (!this.vivo) return
    const agora = performance.now()
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000)
    this.ultimo = agora
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]
      tw.t += dt
      const k = Math.min(1, tw.t / tw.dur)
      tw.fn(k)
      if (k >= 1) {
        this.tweens.splice(i, 1)
        tw.fim()
      }
    }
    for (const b of this.bonecos.values()) b.atualizar(dt)
    for (let i = this.efeitos.length - 1; i >= 0; i--) {
      const ef = this.efeitos[i]
      ef.atualizar(dt)
      if (!ef.vivo) {
        this.cena.remove(ef.sprite)
        ef.descartar()
        this.efeitos.splice(i, 1)
      }
    }
    const kc = 1 - Math.exp(-dt * 4)
    this.camPos.lerp(this.camPosAlvo, kc)
    this.camOlha.lerp(this.camOlhaAlvo, kc)
    this.tremorTela = Math.max(0, this.tremorTela - dt * 2.5)
    const tr = this.tremorTela * 0.12
    this.camera.position.copy(this.camPos).add(new THREE.Vector3((Math.random() - 0.5) * tr, (Math.random() - 0.5) * tr, 0))
    this.camera.lookAt(this.camOlha)
    // o que segue os personagens na camada HTML (barras, mira)
    for (const el of this.camada.querySelectorAll<HTMLElement>('[data-segue]')) {
      const p = this.telaDe(el.dataset.segue!, Number(el.dataset.altura ?? 1))
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`
    }
    this.renderizador.render(this.cena, this.camera)
    requestAnimationFrame(this.passo)
  }
}
