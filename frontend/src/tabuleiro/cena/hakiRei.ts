import * as THREE from 'three'
import { ImpactoHaki } from './impactoHaki'

/**
 * Haki do Rei (Haoshoku): explosão de vontade a partir do personagem.
 *
 * Desenhado a cada quadro (60 fps), em três camadas:
 * - chão: anéis vermelhos que se expandem pelo convés e um brilho sob os pés;
 * - atrás do personagem: raios pretos com contorno vermelho saindo do corpo,
 *   refeitos a cada poucos quadros (eletricidade), e névoa vermelha;
 * - na frente: faíscas e lascas do convés voando para fora.
 *
 * `forca()` (0–1) serve para a cena tremer a câmera e escurecer a tela.
 */

const DURACAO = 2.2 // s
const TAM = 7 // lado (em casas) do quadro dos raios
const PX = 1024 // resolução das camadas desenhadas
/** camada dos raios gigantes: cobre boa parte do tabuleiro */
const TAM_LONGE = 20

type Raio = { pts: [number, number][]; larg: number; nasce: number }
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; t: number; tam: number; tipo: 'lasca' | 'faisca'; giro: number }

function envelope(t: number) {
  // cresce rápido, segura, some devagar
  if (t < 0.12) return (t / 0.12) ** 2
  if (t < 0.62) return 1
  return Math.max(0, 1 - (t - 0.62) / 0.38) ** 1.5
}

/**
 * Qualidade das camadas (fração de PX). Começa cheia; se o desenho passar do
 * limite (PC mais fraco), cai para a metade — 4× menos pixels e brilho — e
 * fica assim nas próximas vezes que o Haki for ligado.
 */
let qualidade = 1
const LIMITE_MS = 9

type Camada = { c: HTMLCanvasElement; g: CanvasRenderingContext2D; t: THREE.CanvasTexture }

function dimensionar(k: Camada) {
  k.c.width = k.c.height = Math.round(PX * qualidade)
  // desenho continua em coordenadas de PX
  k.g.setTransform(qualidade, 0, 0, qualidade, 0, 0)
}

function camada(): Camada {
  const c = document.createElement('canvas')
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const k = { c, g: c.getContext('2d')!, t }
  dimensionar(k)
  return k
}

export class HakiRei {
  readonly objetos: THREE.Object3D[]
  vivo = true
  private t = 0
  private readonly altura: number
  private readonly tras = camada()
  private readonly frente = camada()
  private readonly longe = camada()
  // raios que vêm para a frente do personagem (na direção da câmera)
  private readonly raiosFrente = camada()
  private readonly longeFrente = camada()
  private readonly spriteRaiosFrente: THREE.Sprite
  private readonly spriteLongeFrente: THREE.Sprite
  private readonly spriteLonge: THREE.Sprite
  private gigantes: Raio[] = []
  private readonly spriteTras: THREE.Sprite
  private readonly spriteFrente: THREE.Sprite
  private readonly chao: THREE.Mesh
  private readonly matChao: THREE.ShaderMaterial
  private raios: Raio[] = []
  private ultimoRaio = -1
  private readonly particulas: Particula[] = []
  private emitidas = 0
  /** raios que acertam o chão: ficam alguns relâmpagos seguidos */
  private fixos: { raio: Raio; ciclos: number; longe: boolean }[] = []
  private readonly impactos: ImpactoHaki[] = []
  private readonly grupoImpactos = new THREE.Group()
  private readonly centro: THREE.Vector3
  private readonly pe: THREE.Vector3
  private golpes = 0
  /** ligado (toggle): segura o Haki até desligar */
  private ativo = true
  private tDesligou = 0
  private proxGolpe = 0.3
  private acumDesenho = 1
  /** personagem de quem sai (para ligar/desligar o certo) */
  dono: unknown = null

  constructor(pe: THREE.Vector3, alturaPersonagem: number) {
    this.altura = alturaPersonagem
    const centro = pe.clone().setY(pe.y + alturaPersonagem * 0.42)
    this.centro = centro
    this.pe = pe.clone()
    const mk = (tex: THREE.Texture, ordem: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
      s.scale.set(TAM, TAM, 1)
      s.position.copy(centro)
      s.renderOrder = ordem
      return s
    }
    this.spriteTras = mk(this.tras.t, 1)
    this.spriteLonge = mk(this.longe.t, 1)
    this.spriteLonge.scale.set(TAM_LONGE, TAM_LONGE, 1)
    this.spriteRaiosFrente = mk(this.raiosFrente.t, 3)
    this.spriteLongeFrente = mk(this.longeFrente.t, 3)
    this.spriteLongeFrente.scale.set(TAM_LONGE, TAM_LONGE, 1)
    this.spriteFrente = mk(this.frente.t, 3)

    this.matChao = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { t: { value: 0 }, forca: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float t;
        uniform float forca;
        varying vec2 vUv;
        float anel(float r, float raio, float larg) {
          float d = abs(r - raio);
          return smoothstep(larg, 0.0, d);
        }
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          // ondas de choque saindo em sequência
          float soma = 0.0, nucleo = 0.0;
          for (int i = 0; i < 4; i++) {
            float t0 = 0.08 + float(i) * 0.13;
            float k = clamp((t - t0) / 0.7, 0.0, 1.0);
            if (k <= 0.0) continue;
            float raio = pow(k, 0.6) * 0.95;
            float fade = (1.0 - k);
            float serr = 0.012 * sin(a * 23.0 + float(i) * 5.0 + t * 30.0);
            float larg = 0.03 + 0.06 * k;
            soma += anel(r, raio + serr, larg) * fade;
            nucleo += anel(r, raio + serr, larg * 0.3) * fade;
          }
          // brilho vermelho embaixo do personagem
          float disco = smoothstep(0.35, 0.0, r) * forca * (0.75 + 0.25 * sin(t * 40.0));
          vec3 cor = vec3(0.95, 0.08, 0.14) * (soma + disco) + vec3(1.0, 0.85, 0.85) * nucleo;
          float alfa = clamp(soma * 1.2 + nucleo * 1.5 + disco, 0.0, 1.0);
          // degraus (casa com a pixel art)
          alfa = floor(alfa * 6.0 + 0.5) / 6.0;
          gl_FragColor = vec4(cor, alfa);
          #include <colorspace_fragment>
        }
      `,
    })
    this.chao = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), this.matChao)
    this.chao.rotation.x = -Math.PI / 2
    this.chao.position.set(pe.x, 0.02, pe.z)
    this.chao.renderOrder = 0
    this.objetos = [this.chao, this.spriteLonge, this.spriteTras, this.spriteRaiosFrente, this.spriteLongeFrente, this.spriteFrente, this.grupoImpactos]
  }

  /**
   * Fase do efeito (0–1): sobe até o platô e fica nele enquanto ligado;
   * ao desligar, segue para o fim (some em ~0,8 s).
   */
  private fase() {
    if (this.ativo) return Math.min(this.t / DURACAO, 0.5)
    return 0.62 + (this.t - this.tDesligou) / DURACAO
  }

  desligar() {
    if (!this.ativo) return
    this.ativo = false
    this.tDesligou = this.t
  }

  get ligado() {
    return this.ativo
  }

  /** 0–1: quanto a cena deve tremer e escurecer agora. */
  forca() {
    return envelope(this.fase()) * (this.ativo && this.t > 1.2 ? 0.45 : 1)
  }

  atualizar(dt: number, camera: THREE.Camera) {
    this.t += dt
    for (const im of this.impactos) im.atualizar(dt)
    for (const im of this.impactos.filter((i) => !i.vivo)) {
      this.grupoImpactos.remove(...im.objetos)
      im.descartar()
    }
    this.impactos.splice(0, this.impactos.length, ...this.impactos.filter((i) => i.vivo))
    const f = this.fase()
    if (f >= 1) {
      // só termina depois das rachaduras sumirem
      if (!this.impactos.length) this.vivo = false
      for (const o of [this.spriteTras, this.spriteFrente, this.spriteLonge, this.spriteRaiosFrente, this.spriteLongeFrente, this.chao]) o.visible = false
      return
    }
    const e = envelope(f)
    // ondas de choque: enquanto ligado, pulsam de novo a cada 1,4 s
    this.matChao.uniforms.t.value = this.ativo && this.t > 1.1 ? ((this.t - 1.1) % 1.4) / 1.4 * 0.9 : f
    this.matChao.uniforms.forca.value = e

    // raios: refeitos a cada ~3 quadros, para piscarem como eletricidade
    const passo = Math.floor(this.t * 20)
    if (passo !== this.ultimoRaio) {
      this.ultimoRaio = passo
      this.raios = this.gerarRaios(e, f)
      this.gigantes = f > 0.08 && f < 0.75 ? this.gerarGigantes(e) : []
      // de vez em quando um raio desce e acerta o convés
      // de vez em quando um raio acerta o convés; no máximo 3 ao mesmo tempo
      if (f > 0.1 && f < 0.7 && this.t > this.proxGolpe && this.impactos.length < 3 && Math.random() < 0.35) {
        this.golpear(camera, Math.random() < 0.4)
        this.proxGolpe = this.t + 0.7 + Math.random() * 1.1
      }
      for (const fx of this.fixos) {
        ;(fx.longe ? this.gigantes : this.raios).push(fx.raio)
        fx.ciclos--
      }
      this.fixos = this.fixos.filter((fx) => fx.ciclos > 0)
    }
    this.emitir(f, dt)
    // redesenha as camadas a no máximo 30 quadros/s (o desenho é o mais pesado)
    this.acumDesenho += dt
    if (this.acumDesenho >= 1 / 30) {
      this.acumDesenho = 0
      const t0 = performance.now()
      this.desenharTras(e, f)
      this.desenharFrente(dt)
      this.medirDesenho(performance.now() - t0)
    }
  }

  // ---------------------------------------------------------------- raios
  /**
   * Raios do Haoshoku como no anime: grossos na base e afinando até a ponta,
   * em zigue-zague de ângulos bem marcados (quebras retas, sem curva), pretos
   * com contorno vermelho e um brilho vermelho em volta. Poucos e fortes,
   * mais alguns galhos finos.
   */
  private gerarRaios(e: number, f: number): Raio[] {
    const n = Math.round(5 + 9 * e)
    const raios: Raio[] = []
    const alcance = (0.2 + 0.28 * Math.min(1, f * 5)) * PX
    for (let i = 0; i < n; i++) {
      // espalhados em volta, mais para cima e para os lados
      let ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.9
      // tamanhos bem diferentes: alguns curtos, a maioria média, poucos enormes
      const sorte = Math.random()
      const tam = sorte < 0.3 ? 0.3 + Math.random() * 0.25 : sorte < 0.85 ? 0.6 + Math.random() * 0.35 : 1.1 + Math.random() * 0.45
      const comp = Math.min(alcance * tam, PX * 0.44) // não passa da borda do quadro
      const r0 = PX * (0.02 + Math.random() * 0.05)
      // formato: cada raio com seu jeito de quebrar
      const estilo = Math.random()
      const seg = estilo < 0.3 ? 3 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 5)
      const quebraMax = estilo < 0.3 ? 0.35 : estilo < 0.7 ? 0.75 : 1.15
      const pts: [number, number][] = [[PX / 2 + Math.cos(ang) * r0, PX / 2 + Math.sin(ang) * r0 * 0.92]]
      let x = pts[0][0]
      let y = pts[0][1]
      let lado = Math.random() < 0.5 ? 1 : -1
      let rumo = ang
      for (let k = 1; k <= seg; k++) {
        // passos desiguais e quebras de tamanho variado; às vezes repete o lado
        const passo = (comp / seg) * (0.35 + Math.random() * 1.3)
        const quebra = lado * quebraMax * (0.3 + Math.random() * 0.7)
        if (Math.random() < 0.75) lado = -lado
        rumo = ang + quebra + (rumo - ang) * 0.25
        x += Math.cos(rumo) * passo
        y += Math.sin(rumo) * passo * 0.92
        pts.push([x, y])
      }
      raios.push({ pts, larg: (8 + Math.random() * 26) * (0.5 + 0.5 * tam) * (0.6 + 0.4 * e), nasce: Math.random() * 0.25 })
      // galho fino saindo de uma quebra
      if (pts.length > 3 && Math.random() < 0.6) {
        const j = 1 + Math.floor(Math.random() * (pts.length - 2))
        const ga = ang + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5)
        const gp: [number, number][] = [pts[j]]
        let [gx, gy] = pts[j]
        let gl = Math.random() < 0.5 ? 1 : -1
        for (let k = 0; k < 3; k++) {
          const a = ga + gl * 0.5
          gl = -gl
          const gpasso = comp * (0.06 + Math.random() * 0.12)
          gx += Math.cos(a) * gpasso
          gy += Math.sin(a) * gpasso * 0.92
          gp.push([gx, gy])
        }
        raios.push({ pts: gp, larg: 7 + Math.random() * 5, nasce: 0.15 + Math.random() * 0.2 })
      }
    }
    return raios
  }

  /** Contorno de um raio que afina da base (larg) até a ponta (0). */
  private forma(r: Raio, extra: number, cresce: number, g = this.tras.g) {
    // só a parte já "crescida" do raio (ele avança do corpo para fora)
    const n = r.pts.length
    const ate = Math.max(1, Math.min(n - 1, (n - 1) * cresce))
    const pts: [number, number][] = []
    for (let i = 0; i <= Math.floor(ate); i++) pts.push(r.pts[i])
    const fr = ate - Math.floor(ate)
    if (fr > 0 && Math.floor(ate) < n - 1) {
      const [ax, ay] = r.pts[Math.floor(ate)]
      const [bx, by] = r.pts[Math.floor(ate) + 1]
      pts.push([ax + (bx - ax) * fr, ay + (by - ay) * fr])
    }
    const esq: [number, number][] = []
    const dir: [number, number][] = []
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i]
      const [ax, ay] = pts[Math.max(0, i - 1)]
      const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]
      let nx = -(by - ay)
      let ny = bx - ax
      const l = Math.hypot(nx, ny) || 1
      nx /= l
      ny /= l
      const u = i / Math.max(1, pts.length - 1)
      const w = (r.larg * (1 - u) ** 0.85 + extra * (1 - u * 0.6)) / 2
      esq.push([px + nx * w, py + ny * w])
      dir.push([px - nx * w, py - ny * w])
    }
    g.beginPath()
    g.moveTo(esq[0][0], esq[0][1])
    for (const [x, y] of esq.slice(1)) g.lineTo(x, y)
    // ponta afiada
    const [tx, ty] = pts[pts.length - 1]
    g.lineTo(tx, ty)
    for (const [x, y] of dir.reverse()) g.lineTo(x, y)
    g.closePath()
  }

  private desenharTras(e: number, f: number) {
    this.desenharLonge(e)
    const { g, t } = this.tras
    g.clearRect(0, 0, PX, PX)
    // névoa vermelha em volta do corpo
    const neb = g.createRadialGradient(PX / 2, PX / 2, 0, PX / 2, PX / 2, PX * (0.2 + 0.25 * e))
    neb.addColorStop(0, `rgba(255,40,60,${0.55 * e})`)
    neb.addColorStop(0.4, `rgba(200,10,40,${0.3 * e})`)
    neb.addColorStop(1, 'rgba(120,0,20,0)')
    g.fillStyle = neb
    g.fillRect(0, 0, PX, PX)
    // raios: os que apontam para cima/para trás ficam atrás do personagem;
    // os que vêm para baixo (na direção da câmera) passam pela frente dele
    const idade = (this.t * 20) % 1 // fração desde o último "relâmpago"
    const gf = this.raiosFrente.g
    gf.clearRect(0, 0, PX, PX)
    for (const r of this.raios) {
      const cresce = r.nasce < 0 ? 1 : Math.min(1, Math.max(0, (idade * 3 - r.nasce) / 0.6) + (f > 0.15 ? 0.5 : 0))
      this.pintarRaio(HakiRei.naFrente(r) ? gf : g, r, cresce, e, 12, 30)
    }
    this.abrirCorpo(gf, TAM)
    this.raiosFrente.t.needsUpdate = true
    // clarão inicial: brilho vermelho-claro que some rápido
    if (f < 0.1) {
      const k = 1 - f / 0.1
      const cl = g.createRadialGradient(PX / 2, PX / 2, 0, PX / 2, PX / 2, PX * 0.16)
      cl.addColorStop(0, `rgba(255,235,240,${k})`)
      cl.addColorStop(0.35, `rgba(255,80,110,${0.8 * k})`)
      cl.addColorStop(1, 'rgba(255,0,40,0)')
      g.fillStyle = cl
      g.fillRect(0, 0, PX, PX)
    }
    t.needsUpdate = true
  }

  /** 1 a 3 raios enormes, que atravessam boa parte do tabuleiro. */
  private gerarGigantes(e: number): Raio[] {
    const r: Raio[] = []
    const n = e > 0.6 ? 1 + Math.floor(Math.random() * 3) : Math.random() < 0.5 ? 1 : 0
    for (let i = 0; i < n; i++) {
      let ang = Math.random() * Math.PI * 2
      const comp = PX * (0.28 + Math.random() * 0.19)
      const seg = 6 + Math.floor(Math.random() * 5)
      const pts: [number, number][] = [[PX / 2, PX / 2]]
      let [x, y] = pts[0]
      let lado = Math.random() < 0.5 ? 1 : -1
      let rumo = ang
      for (let k = 1; k <= seg; k++) {
        const passo = (comp / seg) * (0.4 + Math.random() * 1.2)
        const quebra = lado * (0.25 + Math.random() * 0.7)
        if (Math.random() < 0.75) lado = -lado
        rumo = ang + quebra + (rumo - ang) * 0.25
        x += Math.cos(rumo) * passo
        y += Math.sin(rumo) * passo * 0.92
        pts.push([x, y])
      }
      r.push({ pts, larg: 12 + Math.random() * 10, nasce: -1 })
      // galhos no meio do caminho
      for (let b = 0; b < 2; b++) {
        if (Math.random() < 0.4) continue
        const j = 2 + Math.floor(Math.random() * (pts.length - 3))
        const ga = ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6)
        const gp: [number, number][] = [pts[j]]
        let [gx, gy] = pts[j]
        for (let k = 0; k < 3; k++) {
          const a = ga + (k % 2 ? 0.4 : -0.4)
          const p = comp * (0.05 + Math.random() * 0.07)
          gx += Math.cos(a) * p
          gy += Math.sin(a) * p * 0.92
          gp.push([gx, gy])
        }
        r.push({ pts: gp, larg: 5 + Math.random() * 4, nasce: -1 })
      }
    }
    return r
  }

  private desenharLonge(e: number) {
    const { g, t } = this.longe
    const gf = this.longeFrente.g
    g.clearRect(0, 0, PX, PX)
    gf.clearRect(0, 0, PX, PX)
    for (const r of this.gigantes) this.pintarRaio(HakiRei.naFrente(r) ? gf : g, r, 1, e, 6, 18)
    this.abrirCorpo(gf, TAM_LONGE)
    t.needsUpdate = true
    this.longeFrente.t.needsUpdate = true
  }

  /**
   * Os raios da frente saem "de dentro" do corpo: apaga quase tudo deles em
   * cima do personagem, para ele continuar visível (como no anime).
   */
  private abrirCorpo(g: CanvasRenderingContext2D, tam: number) {
    const pu = PX / tam // pixels por unidade do mundo
    const cy = PX / 2 - this.altura * 0.08 * pu
    const rx = 0.42 * pu
    const ry = this.altura * 0.52 * pu
    g.save()
    g.globalCompositeOperation = 'destination-out'
    g.translate(PX / 2, cy)
    g.scale(1, ry / rx)
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx)
    gr.addColorStop(0, 'rgba(0,0,0,0.9)')
    gr.addColorStop(0.7, 'rgba(0,0,0,0.75)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.beginPath()
    g.arc(0, 0, rx, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  /** O raio termina abaixo do centro (para a câmera): vai na frente do corpo. */
  private static naFrente(r: Raio) {
    const [x0, y0] = r.pts[0]
    const y1 = r.pts[r.pts.length - 1][1]
    // galhos herdam o lado pelo ponto de onde saem
    const dy = Math.abs(x0 - PX / 2) + Math.abs(y0 - PX / 2) > 30 ? y0 - PX / 2 : y1 - y0
    return dy > PX * 0.015
  }

  private tempoDesenho = 0
  private desenhos = 0

  /** Média do tempo de desenho; acima do limite, cai para meia resolução. */
  private medirDesenho(ms: number) {
    this.desenhos++
    this.tempoDesenho = this.desenhos === 1 ? ms : this.tempoDesenho * 0.85 + ms * 0.15
    if (qualidade === 1 && this.desenhos > 8 && this.tempoDesenho > LIMITE_MS) {
      qualidade = 0.5
      for (const k of [this.tras, this.frente, this.longe, this.raiosFrente, this.longeFrente]) {
        dimensionar(k)
        k.t.dispose() // textura com o tamanho novo
        k.t.needsUpdate = true
      }
    }
  }

  private pintarRaio(g: CanvasRenderingContext2D, r: Raio, cresce: number, e: number, extra: number, brilho: number) {
    const alfa = Math.min(1, e * 1.3)
    g.lineJoin = 'miter'
    g.shadowColor = 'rgba(255,20,50,1)'
    g.shadowBlur = brilho * qualidade // o borrão é em pixels reais do canvas
    g.fillStyle = `rgba(255,35,70,${alfa})`
    this.forma(r, extra, cresce, g)
    g.fill()
    g.shadowBlur = 0
    g.fillStyle = `rgba(8,0,3,${alfa})`
    this.forma(r, 0, cresce, g)
    g.fill()
  }

  /** Ponto do mundo → coordenada no quadro dos raios (que encara a câmera). */
  private noQuadro(q: THREE.Vector3, camera: THREE.Camera, tam = TAM): [number, number] {
    const o = camera.getWorldPosition(new THREE.Vector3())
    const fwd = camera.getWorldDirection(new THREE.Vector3())
    const dir = q.clone().sub(o)
    const k = this.centro.clone().sub(o).dot(fwd) / dir.dot(fwd)
    const p = o.add(dir.multiplyScalar(k)).sub(this.centro)
    const dirX = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const dirY = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    return [PX / 2 + (p.dot(dirX) / tam) * PX, PX / 2 - (p.dot(dirY) / tam) * PX]
  }

  /** Um raio desce do corpo até um ponto do convés e explode lá. */
  private golpear(camera: THREE.Camera, longe: boolean) {
    const a = Math.random() * Math.PI * 2
    const d = longe ? 3.5 + Math.random() * 4.5 : 1.2 + Math.random() * 1.8
    const alvo = new THREE.Vector3(this.pe.x + Math.cos(a) * d, 0, this.pe.z + Math.sin(a) * d)
    const [tx, ty] = this.noQuadro(alvo, camera, longe ? TAM_LONGE : TAM)
    if (tx < 20 || tx > PX - 20 || ty < 20 || ty > PX - 20) return
    // zigue-zague do centro até o ponto
    const x0 = PX / 2
    const y0 = PX / 2
    const seg = 5 + Math.floor(Math.random() * 3)
    const len = Math.hypot(tx - x0, ty - y0)
    const nx = -(ty - y0) / len
    const ny = (tx - x0) / len
    const pts: [number, number][] = [[x0, y0]]
    let lado = Math.random() < 0.5 ? 1 : -1
    for (let k = 1; k < seg; k++) {
      const u = k / seg
      const desvio = lado * len * (0.05 + Math.random() * 0.1) * Math.sin(Math.PI * u)
      lado = -lado
      pts.push([x0 + (tx - x0) * u + nx * desvio, y0 + (ty - y0) * u + ny * desvio])
    }
    pts.push([tx, ty])
    this.fixos.push({ raio: { pts, larg: longe ? 14 + Math.random() * 6 : 22 + Math.random() * 12, nasce: -1 }, ciclos: 5, longe })
    this.golpes++
    const im = new ImpactoHaki(alvo, longe ? 1.3 + Math.random() * 0.5 : 1 + Math.random() * 0.4)
    this.impactos.push(im)
    this.grupoImpactos.add(...im.objetos)
  }

  // ---------------------------------------------------------------- partículas
  private emitir(f: number, dt: number) {
    // rajada no começo e fluxo menor enquanto dura
    // rajada no começo; ligado, continua soltando aos poucos (até ~120 no ar)
    const alvo = f < 0.15 ? 90 * (f / 0.15) : this.ativo ? Math.max(this.emitidas, 90 + this.t * 25) : 90 + 60 * Math.min(1, (f - 0.15) / 0.45)
    const pe = PX / 2 + (this.altura * 0.42 * PX) / TAM // pés no quadro
    while (this.emitidas < alvo && f < 0.7 && this.particulas.length < 120) {
      this.emitidas++
      const lasca = Math.random() < 0.45
      const a = Math.random() * Math.PI * 2
      const v = (lasca ? 180 : 320) * (0.5 + Math.random())
      this.particulas.push({
        x: PX / 2 + Math.cos(a) * 20,
        y: lasca ? pe + Math.sin(a) * 8 : PX / 2 + Math.sin(a) * 30,
        vx: Math.cos(a) * v,
        vy: lasca ? Math.sin(a) * v * 0.45 - 260 * Math.random() : Math.sin(a) * v,
        vida: lasca ? 1.1 + Math.random() * 0.6 : 0.4 + Math.random() * 0.5,
        t: 0,
        tam: lasca ? 5 + Math.random() * 9 : 2 + Math.random() * 3,
        tipo: lasca ? 'lasca' : 'faisca',
        giro: Math.random() * 6,
      })
    }
    for (const p of this.particulas) {
      p.t += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.tipo === 'lasca') {
        p.vy += 900 * dt // gravidade
        if (p.y > pe + 60 && p.vy > 0) {
          p.vy *= -0.35
          p.vx *= 0.6
        }
      } else {
        p.vx *= 1 - 1.5 * dt
        p.vy *= 1 - 1.5 * dt
      }
    }
    for (let i = this.particulas.length - 1; i >= 0; i--) if (this.particulas[i].t > this.particulas[i].vida) this.particulas.splice(i, 1)
  }

  private desenharFrente(dt: number) {
    void dt
    const { g, t } = this.frente
    g.clearRect(0, 0, PX, PX)
    for (const p of this.particulas) {
      const k = 1 - p.t / p.vida
      if (p.tipo === 'faisca') {
        g.strokeStyle = `rgba(255,${120 + 100 * k},${140 + 80 * k},${k})`
        g.lineWidth = p.tam
        g.beginPath()
        g.moveTo(p.x, p.y)
        g.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05)
        g.stroke()
      } else {
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.giro + p.t * 8)
        g.fillStyle = `rgba(40,24,20,${Math.min(1, k * 2)})`
        g.fillRect(-p.tam / 2, -p.tam / 3, p.tam, p.tam * 0.66)
        g.fillStyle = `rgba(150,60,60,${Math.min(1, k * 2) * 0.8})`
        g.fillRect(-p.tam / 2, -p.tam / 3, p.tam, 2)
        g.restore()
      }
    }
    t.needsUpdate = true
  }

  descartar() {
    for (const im of this.impactos) im.descartar()
    this.longe.t.dispose()
    this.raiosFrente.t.dispose()
    this.longeFrente.t.dispose()
    this.tras.t.dispose()
    this.frente.t.dispose()
    this.matChao.dispose()
    this.chao.geometry.dispose()
  }
}
