import * as THREE from 'three'

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

type Raio = { pts: [number, number][]; larg: number }
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; t: number; tam: number; tipo: 'lasca' | 'faisca'; giro: number }

function envelope(t: number) {
  // cresce rápido, segura, some devagar
  if (t < 0.12) return (t / 0.12) ** 2
  if (t < 0.62) return 1
  return Math.max(0, 1 - (t - 0.62) / 0.38) ** 1.5
}

function camada() {
  const c = document.createElement('canvas')
  c.width = c.height = PX
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { c, g: c.getContext('2d')!, t }
}

export class HakiRei {
  readonly objetos: THREE.Object3D[]
  vivo = true
  private t = 0
  private readonly altura: number
  private readonly tras = camada()
  private readonly frente = camada()
  private readonly spriteTras: THREE.Sprite
  private readonly spriteFrente: THREE.Sprite
  private readonly chao: THREE.Mesh
  private readonly matChao: THREE.ShaderMaterial
  private raios: Raio[] = []
  private ultimoRaio = -1
  private readonly particulas: Particula[] = []
  private emitidas = 0

  constructor(pe: THREE.Vector3, alturaPersonagem: number) {
    this.altura = alturaPersonagem
    const centro = pe.clone().setY(pe.y + alturaPersonagem * 0.42)
    const mk = (tex: THREE.Texture, ordem: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
      s.scale.set(TAM, TAM, 1)
      s.position.copy(centro)
      s.renderOrder = ordem
      return s
    }
    this.spriteTras = mk(this.tras.t, 1)
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
    this.objetos = [this.chao, this.spriteTras, this.spriteFrente]
  }

  /** 0–1: quanto a cena deve tremer e escurecer agora. */
  forca() {
    return envelope(this.t / DURACAO)
  }

  atualizar(dt: number) {
    this.t += dt
    const f = this.t / DURACAO
    if (f >= 1) {
      this.vivo = false
      return
    }
    const e = envelope(f)
    this.matChao.uniforms.t.value = f
    this.matChao.uniforms.forca.value = e

    // raios: refeitos a cada ~3 quadros, para piscarem como eletricidade
    const passo = Math.floor(this.t * 20)
    if (passo !== this.ultimoRaio) {
      this.ultimoRaio = passo
      this.raios = this.gerarRaios(e, f)
    }
    this.desenharTras(e, f)
    this.emitir(f, dt)
    this.desenharFrente(dt)
  }

  // ---------------------------------------------------------------- raios
  private gerarRaios(e: number, f: number): Raio[] {
    const n = Math.round(6 + 12 * e)
    const raios: Raio[] = []
    const alcance = (0.14 + 0.3 * Math.min(1, f * 5)) * PX
    for (let i = 0; i < n; i++) {
      // mais para cima e para os lados, como nas referências
      let ang = Math.random() * Math.PI * 2
      if (Math.sin(ang) > 0.3 && Math.random() < 0.6) ang = -ang
      const comp = alcance * (0.45 + Math.random() * 0.55)
      const r0 = PX * (0.035 + Math.random() * 0.06)
      const seg = 7 + Math.floor(Math.random() * 5)
      const pts: [number, number][] = []
      for (let k = 0; k <= seg; k++) {
        const u = k / seg
        const r = r0 + comp * u
        const desvio = (Math.random() - 0.5) * 0.16 * (0.3 + u)
        const a = ang + desvio
        pts.push([PX / 2 + Math.cos(a) * r, PX / 2 + Math.sin(a) * r * 0.92])
      }
      raios.push({ pts, larg: 7 + Math.random() * 14 * e })
      // galho
      if (Math.random() < 0.3 && pts.length > 4) {
        const b = pts[2 + Math.floor(Math.random() * (pts.length - 4))]
        const ga = ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6)
        const gp: [number, number][] = [b]
        let [x, y] = b
        for (let k = 0; k < 4; k++) {
          x += Math.cos(ga + (Math.random() - 0.5) * 0.8) * comp * 0.09
          y += Math.sin(ga + (Math.random() - 0.5) * 0.8) * comp * 0.09
          gp.push([x, y])
        }
        raios.push({ pts: gp, larg: 4 + Math.random() * 6 })
      }
    }
    return raios
  }

  private desenharTras(e: number, f: number) {
    const { g, t } = this.tras
    g.clearRect(0, 0, PX, PX)
    // névoa vermelha em volta do corpo
    const neb = g.createRadialGradient(PX / 2, PX / 2, 0, PX / 2, PX / 2, PX * (0.2 + 0.25 * e))
    neb.addColorStop(0, `rgba(255,40,60,${0.55 * e})`)
    neb.addColorStop(0.4, `rgba(200,10,40,${0.3 * e})`)
    neb.addColorStop(1, 'rgba(120,0,20,0)')
    g.fillStyle = neb
    g.fillRect(0, 0, PX, PX)
    // raios: halo vermelho, miolo preto, fio claro
    const tracar = (r: Raio) => {
      g.beginPath()
      g.moveTo(r.pts[0][0], r.pts[0][1])
      for (const [x, y] of r.pts.slice(1)) g.lineTo(x, y)
      g.stroke()
    }
    g.lineJoin = 'miter'
    g.lineCap = 'round'
    const alfa = Math.min(1, e * 1.3)
    g.shadowColor = 'rgba(255,20,50,0.9)'
    g.shadowBlur = 24
    for (const r of this.raios) {
      g.strokeStyle = `rgba(255,30,60,${0.7 * alfa})`
      g.lineWidth = r.larg + 16
      tracar(r)
    }
    g.shadowBlur = 0
    for (const r of this.raios) {
      g.strokeStyle = `rgba(10,0,4,${alfa})`
      g.lineWidth = r.larg
      tracar(r)
    }
    for (const r of this.raios) {
      g.strokeStyle = `rgba(255,190,200,${0.8 * alfa})`
      g.lineWidth = Math.max(1, r.larg * 0.18)
      tracar(r)
    }
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

  // ---------------------------------------------------------------- partículas
  private emitir(f: number, dt: number) {
    // rajada no começo e fluxo menor enquanto dura
    const alvo = f < 0.15 ? 90 * (f / 0.15) : 90 + 60 * Math.min(1, (f - 0.15) / 0.45)
    const pe = PX / 2 + (this.altura * 0.42 * PX) / TAM // pés no quadro
    while (this.emitidas < alvo && f < 0.7) {
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
    this.tras.t.dispose()
    this.frente.t.dispose()
    this.matChao.dispose()
    this.chao.geometry.dispose()
  }
}
