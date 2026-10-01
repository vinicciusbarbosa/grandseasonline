import * as THREE from 'three'
import { manifestoEfeito } from './efeitoFolha'
import { recurso } from './visualFolhas'

/**
 * Entei como cena cinemática, em fases com tempo próprio (a duração não
 * depende do número de quadros das folhas: as folhas tocam em laço e o
 * tamanho, giro, brilho e movimento são calculados a cada quadro):
 *
 *  1. círculo de fogo se desenhando no chão em volta de quem lança;
 *  2. o fogo sobe do círculo em espiral até acima da cabeça;
 *  3. a bola nasce e cresce até ficar gigante, girando, sugando brasas;
 *  4. antecipação: encolhe um pouco e clareia, tudo para por um instante;
 *  5. é arremessada em arco até o alvo, deixando rastro;
 *  6. impacto: congela, clarão, tremor (aqui o golpe "acerta");
 *  7. explosão com onda de choque, brasas e fumaça;
 *  8. fogo que fica no chão, sumindo devagar.
 *
 * Os tempos de cada fase ficam em FASES (segundos) — é só mudar os números.
 */

export const FASES = {
  circulo: 1.3,
  espiral: 1.2,
  crescer: 2.4,
  antecipar: 0.45,
  voo: 0.85,
  explosao: 1.5,
  resto: 1.6,
}

export type Cena = {
  tremer(s: number): void
  lampejo(tipo: 'rei' | 'branco', dur: number): void
  /** aproxima a câmera (zoom: quanto; null volta) */
  focar(pontos: THREE.Vector3[] | null, zoom?: number): void
  /** congela o jogo por um instante (hit-stop) */
  congelar(dur: number): void
}

const ini = (() => {
  let t = 0
  const r: Record<keyof typeof FASES, number> = {} as never
  for (const k of Object.keys(FASES) as (keyof typeof FASES)[]) {
    r[k] = t
    t += FASES[k]
  }
  return r
})()
const TOTAL = Object.values(FASES).reduce((a, b) => a + b, 0)

const suave = (k: number) => k * k * (3 - 2 * k)
const saida = (k: number) => 1 - (1 - k) ** 3
const entre = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d))

// ---------------------------------------------------------------- texturas

let texBrilho: THREE.Texture | null = null
/** brilho redondo macio (soma luz) */
function brilho() {
  if (texBrilho) return texBrilho
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(255,255,255,0.7)')
  gr.addColorStop(0.6, 'rgba(255,255,255,0.18)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  texBrilho = new THREE.CanvasTexture(c)
  return texBrilho
}

let texFumaca: THREE.Texture | null = null
function fumaca() {
  if (texFumaca) return texFumaca
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  for (let i = 0; i < 7; i++) {
    const x = 50 + Math.random() * 28
    const y = 50 + Math.random() * 28
    const r = 18 + Math.random() * 14
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
  }
  texFumaca = new THREE.CanvasTexture(c)
  return texFumaca
}

let texChama: THREE.Texture | null = null
/** labareda (gota de fogo, base embaixo), branca: a cor vem do sprite */
function chama() {
  if (texChama) return texChama
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  g.beginPath()
  g.moveTo(32, 2)
  g.bezierCurveTo(40, 40, 60, 70, 56, 98)
  g.bezierCurveTo(52, 122, 12, 122, 8, 98)
  g.bezierCurveTo(4, 70, 24, 40, 32, 2)
  g.closePath()
  const gr = g.createRadialGradient(32, 96, 2, 32, 80, 70)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.45, 'rgba(255,255,255,0.7)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.filter = 'blur(3px)'
  g.fill()
  texChama = new THREE.CanvasTexture(c)
  return texChama
}

/** anel no chão: arco que se desenha (progresso), com cintilação */
function materialAnel(cor: THREE.Color, espessura: number, lado = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    // metade de trás testa profundidade (o personagem a cobre); a da frente fica por cima
    depthTest: lado < 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uProg: { value: 0 }, uForca: { value: 1 }, uTempo: { value: 0 }, uCor: { value: cor }, uEsp: { value: espessura }, uRaio: { value: 0.42 }, uLado: { value: lado }, uGiro: { value: 0 }, uFogo: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      uniform float uProg, uForca, uTempo, uEsp, uRaio, uLado, uGiro, uFogo;
      uniform vec3 uCor;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p);
        float a = fract(atan(p.y, p.x) / 6.28318 + 0.5 + uGiro);
        // y < 0 no plano = lado da câmera (frente)
        float metade = uLado == 0.0 ? 1.0 : (uLado > 0.0 ? smoothstep(0.03, -0.03, p.y) : smoothstep(-0.03, 0.03, p.y));
        // arco já desenhado (com a ponta brilhando)
        float desenhado = step(a, uProg);
        float ponta = exp(-pow((a - uProg) * 40.0, 2.0)) * step(0.001, uProg) * step(uProg, 0.999);
        float n = ruido(vec2(a * 40.0, uTempo * 3.0)) * 0.5 + ruido(vec2(a * 90.0, uTempo * 7.0)) * 0.5;
        // línguas de fogo: o anel se espalha para fora em labaredas que correm
        float lingua = ruido(vec2(a * 28.0 - uTempo * 1.5, (r - uRaio) * 30.0 - uTempo * 6.0));
        float esp = uEsp * (0.8 + n * 0.8) * (1.0 + uFogo * lingua * 1.6 * step(uRaio, r));
        float anel = exp(-pow((r - uRaio) / esp, 2.0));
        float v = anel * (0.7 + n * 0.7) * desenhado + ponta * anel * 3.0;
        v *= metade;
        // cor de fogo: vermelho nas bordas, laranja, amarelo e branco no miolo
        float q = clamp(v * 1.3, 0.0, 1.6);
        vec3 fogo = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.55, 0.08), smoothstep(0.1, 0.6, q));
        fogo = mix(fogo, vec3(1.0, 0.92, 0.55), smoothstep(0.7, 1.3, q));
        vec3 c = mix(uCor, fogo, uFogo);
        gl_FragColor = vec4(c * v * uForca, v * uForca);
      }`,
  })
}

// ---------------------------------------------------------------- partículas

type Particula = { s: THREE.Sprite; vida: number; dur: number; atualizar: (p: Particula, k: number, dt: number) => void }

export class Entei {
  readonly sprite = new THREE.Group()
  vivo = true
  private t = 0
  private readonly de: THREE.Vector3
  private readonly ate: THREE.Vector3
  private readonly alturaMao: number
  /** diâmetro final da bola (mundo) */
  private readonly bolaMax: number
  /** raio do círculo no chão */
  private readonly raio: number
  private readonly k: number
  private readonly cena: Cena
  private readonly aoImpacto: () => void
  private impactou = false
  private congelou = false
  private particulas: Particula[] = []
  private emitir = 0

  /** anéis no chão: cada um em duas metades (trás: o personagem cobre; frente: por cima) */
  private readonly aneis: { meshes: THREE.Mesh[]; atraso: number; sentido: number; giro: number }[] = []
  private readonly luzChao: THREE.Sprite
  private bola: THREE.Sprite | null = null
  private bolaQuadros = 8
  private bolaFps = 12
  private readonly halo: THREE.Sprite
  private explosao: THREE.Sprite | null = null
  private explosaoQuadros = 13
  private readonly onda: THREE.Mesh
  private readonly fogoChao: THREE.Sprite[] = []

  /**
   * @param de pé de quem lança  @param ate ponto do alvo (chão)
   * @param altura altura de quem lança (mundo)  @param k escala do poder
   */
  constructor(de: THREE.Vector3, ate: THREE.Vector3, altura: number, k: number, cena: Cena, aoImpacto: () => void) {
    this.de = de.clone().setY(0.02)
    this.ate = ate.clone().setY(0.02)
    // bola gigante: quase da altura do personagem, flutuando logo acima da cabeça
    this.bolaMax = Math.max(1.7, altura * 1.4) * Math.sqrt(k)
    // erguida nas mãos: a base da bola encosta no alto da cabeça
    this.alturaMao = altura * 0.8 + this.bolaMax * 0.42
    this.raio = Math.max(0.8, altura * 0.42) * Math.sqrt(k)
    this.k = k
    this.cena = cena
    this.aoImpacto = aoImpacto

    const plano = (tam: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), mat)
      m.rotation.x = -Math.PI / 2
      m.renderOrder = 5
      return m
    }
    for (const [tam, esp, atraso, sentido] of [[1, 0.022, 0, 1], [0.72, 0.014, 0.35, -1]] as const) {
      const meshes = [-1, 1].map((lado) => {
        const m = plano((this.raio / 0.42) * tam, materialAnel(new THREE.Color(1, 0.5, 0.1), esp, lado))
        m.position.copy(this.de)
        m.renderOrder = lado < 0 ? 4 : 7
        this.sprite.add(m)
        return m
      })
      this.aneis.push({ meshes, atraso, sentido, giro: 0 })
    }
    this.onda = plano(1, materialAnel(new THREE.Color(1.0, 0.55, 0.2), 0.03))
    ;(this.onda.material as THREE.ShaderMaterial).uniforms.uFogo.value = 0.6
    this.onda.position.copy(this.ate)
    this.onda.visible = false
    ;(this.onda.material as THREE.ShaderMaterial).uniforms.uProg.value = 1

    this.luzChao = this.sprAditivo(brilho(), new THREE.Color(1, 0.45, 0.12), 0)
    // luz no chão por trás do personagem (ele a cobre)
    this.luzChao.material.depthTest = true
    this.luzChao.renderOrder = 3
    this.luzChao.position.copy(this.de).setY(0.3)
    this.halo = this.sprAditivo(brilho(), new THREE.Color(1, 0.55, 0.15), 0)
    this.halo.position.copy(this.de).setY(this.alturaMao)
    this.sprite.add(this.onda, this.luzChao, this.halo)
    void this.carregarFolhas()
  }

  private sprAditivo(tex: THREE.Texture, cor: THREE.Color, tam: number, aditivo = true) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: cor, transparent: true, depthTest: false, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending }))
    s.scale.setScalar(tam)
    s.renderOrder = 7
    return s
  }

  /** folha em laço (bola) e folha da explosão */
  private async carregarFolhas() {
    const folha = async (nome: string) => {
      const man = await manifestoEfeito(nome)
      if (!man) return null
      const t = new THREE.TextureLoader().load(recurso(`${import.meta.env.BASE_URL}sprites/efeitos/${nome}/S.png`))
      t.colorSpace = THREE.SRGBColorSpace
      const [gc, gl] = man.grade ?? [man.quadros, 1]
      t.repeat.set(1 / gc, 1 / gl)
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }))
      s.renderOrder = 8
      s.visible = false
      s.userData = { man, gc, gl }
      this.sprite.add(s)
      return s
    }
    this.bola = await folha('entei-bola')
    if (this.bola) {
      this.bolaQuadros = this.bola.userData.man.quadros
      this.bolaFps = this.bola.userData.man.fps
    }
    this.explosao = await folha('entei-explosao')
    if (this.explosao) {
      this.explosaoQuadros = this.explosao.userData.man.quadros
      this.explosao.center.set(0.5, this.explosao.userData.man.centro?.[1] ?? 0.05)
    }
  }

  private quadro(s: THREE.Sprite, q: number) {
    const { gc, gl } = s.userData as { gc: number; gl: number }
    s.material.map!.offset.set((q % gc) / gc, 1 - (Math.floor(q / gc) + 1) / gl)
  }

  private particula(tex: THREE.Texture, cor: THREE.Color, dur: number, atualizar: Particula['atualizar'], aditivo = true, atras = false) {
    const s = this.sprAditivo(tex, cor, 0, aditivo)
    if (atras) {
      // atrás do personagem: testa profundidade (a silhueta dele a cobre)
      s.material.depthTest = true
      s.renderOrder = 5
    }
    this.sprite.add(s)
    this.particulas.push({ s, vida: 0, dur, atualizar })
  }

  /** onde a bola está na fase de crescer (acima da cabeça) */
  private get alto() {
    return this.de.clone().setY(this.alturaMao)
  }

  atualizar(dtJogo: number) {
    // a cena cinemática não acelera no 2×: usa o tempo real do quadro
    const dt = Math.min(0.05, dtJogo)
    this.t += dt
    const t = this.t
    const k = this.k
    const tempo = performance.now() / 1000

    // ---- 1. círculo no chão
    const pc = entre(t, ini.circulo, FASES.circulo)
    const fimCirculo = 1 - entre(t, ini.explosao, 1.2)
    let progFora = 0
    for (const an of this.aneis) {
      an.giro += dt * 0.08 * an.sentido
      const prog = suave(entre(t, ini.circulo + an.atraso, FASES.circulo - an.atraso * 0.5))
      if (an.atraso === 0) progFora = prog
      // pulsa forte enquanto a bola cresce
      const pulso = 1 + 0.25 * Math.sin(tempo * 8) * entre(t, ini.crescer, 0.3)
      for (const m of an.meshes) {
        const u = (m.material as THREE.ShaderMaterial).uniforms
        u.uProg.value = prog
        u.uTempo.value = tempo
        u.uGiro.value = an.giro
        u.uForca.value = fimCirculo * pulso * (1 + entre(t, ini.crescer, FASES.crescer) * 0.6)
      }
    }
    const giroFora = this.aneis[0].giro
    this.luzChao.scale.setScalar(this.raio * 2.4 * suave(pc))
    this.luzChao.material.opacity = 0.35 * pc * fimCirculo
    // labaredas de pé ao longo do arco já desenhado (as de trás o personagem cobre)
    if (fimCirculo > 0 && progFora > 0) {
      this.emitir += dt * 70 * progFora * fimCirculo
      while (this.emitir > 1) {
        this.emitir--
        const aa = Math.random() * progFora
        const th = (aa - 0.5 - giroFora) * Math.PI * 2
        const r = this.raio * (0.97 + Math.random() * 0.08)
        const off = new THREE.Vector3(Math.cos(th) * r, 0.02, -Math.sin(th) * r)
        const base = this.de.clone().add(off)
        const atras = off.z < 0
        const alto = (0.35 + Math.random() * 0.4) * this.raio * (1 + entre(t, ini.crescer, FASES.crescer) * 0.5)
        const miolo = Math.random() < 0.35
        const cor = miolo ? new THREE.Color(1, 0.8, 0.35) : new THREE.Color().setHSL(0.02 + Math.random() * 0.05, 1, 0.5)
        const fase = Math.random() * 6
        this.particula(chama(), cor, 0.45 + Math.random() * 0.35, (p, f) => {
          p.s.position.copy(base).setY(base.y + f * alto * 0.35)
          const tremor = 1 + 0.15 * Math.sin(tempo * 25 + fase)
          const sobe = Math.sin(Math.min(1, f * 1.8) * Math.PI * 0.5) * (1 - f * 0.5)
          p.s.scale.set(alto * 0.45 * (miolo ? 0.6 : 1) * (1 - f * 0.4), alto * sobe * tremor, 1)
          p.s.material.opacity = Math.min(1, f * 6) * (1 - f)
        }, true, atras)
        const ult = this.particulas[this.particulas.length - 1].s
        ult.center.set(0.5, 0.08)
      }
    }

    // ---- 2. espiral subindo do círculo até acima da cabeça
    if (t > ini.espiral && t < ini.crescer + FASES.crescer * 0.6) {
      const n = Math.floor(dt * 40) + (Math.random() < (dt * 40) % 1 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const a0 = Math.random() * Math.PI * 2
        const voltas = 1.6 + Math.random() * 0.6
        const cor = new THREE.Color().setHSL(0.06 + Math.random() * 0.06, 1, 0.6)
        this.particula(brilho(), cor, 1.1 + Math.random() * 0.3, (p, f) => {
          const e = suave(f)
          const ang = a0 + e * voltas * Math.PI * 2
          const r = this.raio * (1 - e) + 0.05
          p.s.position.set(this.de.x + Math.cos(ang) * r, 0.1 + e * (this.alturaMao - 0.1), this.de.z - Math.sin(ang) * r)
          p.s.scale.setScalar(0.26 * k * (0.6 + 0.4 * Math.sin(f * Math.PI)))
          p.s.material.opacity = Math.min(1, f * 4) * (1 - f * 0.4)
        })
      }
    }

    // ---- 3. bola crescendo e girando  /  4. antecipação  /  5. voo
    const pCres = entre(t, ini.crescer, FASES.crescer)
    const pAnt = entre(t, ini.antecipar, FASES.antecipar)
    const pVoo = entre(t, ini.voo, FASES.voo)
    const naBola = t > ini.crescer && t < ini.explosao
    let posBola = this.alto
    if (pVoo > 0) {
      // arco: sobe um pouco e desce no alvo
      const e = pVoo * pVoo * (3 - 2 * pVoo) * 0.4 + pVoo * 0.6
      const alvo = this.ate.clone().setY(0.55 * k)
      posBola = this.alto.lerp(alvo, e)
      posBola.y += Math.sin(e * Math.PI) * 1.2 * k
    }
    let tam = this.bolaMax * (0.06 + 0.94 * saida(pCres))
    tam *= 1 + 0.04 * Math.sin(tempo * 11) // pulsando
    if (pAnt > 0 && pVoo === 0) tam *= 1 - 0.14 * Math.sin(pAnt * Math.PI * 0.5) // encolhe antes de soltar
    if (pVoo > 0) tam *= 0.86 + 0.06 * pVoo
    if (this.bola) {
      this.bola.visible = naBola
      if (naBola) {
        const q = Math.floor((t - ini.crescer) * this.bolaFps * (1 + pCres)) % this.bolaQuadros
        this.quadro(this.bola, q)
        this.bola.position.copy(posBola)
        this.bola.scale.set(tam, tam * 0.94, 1)
        this.bola.material.rotation += dt * (1.2 + pCres * 2.5)
        const claro = 1 + (pAnt > 0 && pVoo === 0 ? Math.sin(pAnt * Math.PI) * 1.5 : 0)
        this.bola.material.color.setRGB(claro, claro, claro)
      }
    }
    this.halo.visible = naBola
    this.halo.position.copy(posBola)
    this.halo.scale.setScalar(tam * 2.1)
    this.halo.material.opacity = 0.55 + 0.15 * Math.sin(tempo * 9)
    // brasas sendo sugadas para a bola
    if (t > ini.crescer && t < ini.antecipar) {
      const n = Math.floor(dt * 50) + (Math.random() < (dt * 50) % 1 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const dirA = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(this.bolaMax * (1 + Math.random() * 0.6))
        const cor = new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 1, 0.65)
        this.particula(brilho(), cor, 0.55 + Math.random() * 0.25, (p, f) => {
          const e = f * f
          p.s.position.copy(this.alto).addScaledVector(dirA, 1 - e)
          p.s.scale.setScalar(0.16 * k * (1 - e * 0.5))
          p.s.material.opacity = Math.min(1, f * 3)
        })
      }
      this.cena.tremer(0.05 + 0.18 * pCres)
    }
    // rastro no voo
    if (pVoo > 0 && pVoo < 1) {
      for (let i = 0; i < 3; i++) {
        const p0 = posBola.clone().add(new THREE.Vector3((Math.random() - 0.5) * tam * 0.4, (Math.random() - 0.5) * tam * 0.4, (Math.random() - 0.5) * tam * 0.4))
        const cor = new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 1, 0.55)
        this.particula(brilho(), cor, 0.5, (p, f) => {
          p.s.position.copy(p0).setY(p0.y + f * 0.3)
          p.s.scale.setScalar(tam * 0.5 * (1 - f))
          p.s.material.opacity = 1 - f
        })
      }
    }

    // ---- câmera
    if (t > ini.circulo * 0.2 && t - dt <= ini.circulo * 0.2) this.cena.focar([this.de.clone().add(new THREE.Vector3(0, 0, -this.alturaMao * 0.4))], 1.4)
    if (t > ini.voo && t - dt <= ini.voo) this.cena.focar([this.de.clone().add(new THREE.Vector3(0, 0, -this.alturaMao * 0.3)), this.ate.clone()], 1.2)
    if (t > ini.explosao + 0.3 && t - dt <= ini.explosao + 0.3) this.cena.focar([this.ate.clone()], 1.4)

    // ---- 6. impacto
    if (t >= ini.explosao && !this.impactou) {
      this.impactou = true
      if (!this.congelou) {
        this.congelou = true
        this.cena.congelar(0.14)
      }
      this.cena.lampejo('branco', 0.22)
      this.cena.tremer(1)
      this.aoImpacto()
      // brasas para todo lado
      for (let i = 0; i < 70; i++) {
        const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar((2 + Math.random() * 3.5) * k)
        const p0 = this.ate.clone().setY(0.5 * k)
        const cor = new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 1, 0.6)
        this.particula(brilho(), cor, 0.9 + Math.random() * 0.8, (p, f, d) => {
          const tt = f * p.dur
          p.s.position.set(p0.x + v.x * tt, p0.y + v.y * tt - 3.2 * tt * tt, p0.z + v.z * tt)
          if (p.s.position.y < 0.03) p.s.position.y = 0.03
          p.s.scale.setScalar(0.18 * k * (1 - f * 0.6))
          p.s.material.opacity = 1 - f
          void d
        })
      }
      // fumaça subindo
      for (let i = 0; i < 14; i++) {
        const off = new THREE.Vector3((Math.random() - 0.5) * 2 * k, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 2 * k)
        this.particula(fumaca(), new THREE.Color(0.35, 0.3, 0.28), 2.2 + Math.random(), (p, f) => {
          p.s.position.copy(this.ate).add(off).setY(off.y * k + f * 1.4 * k)
          p.s.scale.setScalar((1.2 + f * 1.8) * k)
          p.s.material.opacity = 0.55 * Math.sin(Math.min(1, f * 1.4) * Math.PI) * (1 - f)
          p.s.material.rotation += 0.01
        }, false)
      }
      // fogo que fica no chão
      for (let i = 0; i < 9; i++) {
        const s = this.sprAditivo(brilho(), new THREE.Color(1, 0.4, 0.08), 0)
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 1.6 * k
        s.position.copy(this.ate).add(new THREE.Vector3(Math.cos(a) * r, 0.15, Math.sin(a) * r))
        s.userData.fase = Math.random() * 6
        this.fogoChao.push(s)
        this.sprite.add(s)
      }
    }

    // ---- 7. explosão (folha desacelerando) e onda de choque
    const pExp = entre(t, ini.explosao, FASES.explosao)
    if (this.explosao) {
      this.explosao.visible = pExp > 0 && pExp < 1
      if (this.explosao.visible) {
        // começa rápido e desacelera: mais tempo nos quadros finais (fogo e fumaça)
        const q = Math.min(this.explosaoQuadros - 1, Math.floor(saida(pExp) * this.explosaoQuadros))
        this.quadro(this.explosao, q)
        this.explosao.position.copy(this.ate)
        const L = this.bolaMax * 1.7 * (0.85 + 0.25 * saida(pExp))
        this.explosao.scale.set(L, (L * 290) / 319, 1)
        this.explosao.material.opacity = 1 - entre(pExp, 0.75, 0.25)
      }
    }
    this.onda.visible = pExp > 0 && pExp < 1
    if (this.onda.visible) {
      const s = (0.5 + saida(Math.min(1, pExp * 1.6)) * 7) * k
      this.onda.scale.set(s, s, 1)
      const u = (this.onda.material as THREE.ShaderMaterial).uniforms
      u.uForca.value = 1.6 * (1 - Math.min(1, pExp * 1.5))
      u.uTempo.value = tempo
    }

    // ---- 8. fogo residual no chão
    const pResto = entre(t, ini.explosao + 0.2, FASES.explosao + FASES.resto - 0.2)
    for (const s of this.fogoChao) {
      const f = s.userData.fase as number
      s.scale.setScalar((0.7 + 0.25 * Math.sin(tempo * 7 + f)) * k * (1 - pResto * 0.6))
      s.material.opacity = (1 - pResto) * (0.6 + 0.3 * Math.sin(tempo * 11 + f))
      if (Math.random() < dt * 6 * (1 - pResto)) {
        const base = s.position.clone()
        const cor = new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 1, 0.55)
        this.particula(brilho(), cor, 0.7, (p, ff) => {
          p.s.position.copy(base).setY(base.y + ff * 0.7 * k)
          p.s.scale.setScalar(0.25 * k * (1 - ff))
          p.s.material.opacity = 1 - ff
        })
      }
    }

    // partículas
    for (const p of this.particulas) {
      p.vida += dt
      const f = Math.min(1, p.vida / p.dur)
      p.atualizar(p, f, dt)
      if (f >= 1) {
        p.s.parent?.remove(p.s)
        p.s.material.dispose()
      }
    }
    this.particulas = this.particulas.filter((p) => p.vida < p.dur)

    if (t >= TOTAL) {
      this.vivo = false
      this.cena.focar(null)
      if (!this.impactou) {
        this.impactou = true
        this.aoImpacto()
      }
    }
  }

  descartar() {
    this.sprite.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      m?.dispose()
    })
  }
}
