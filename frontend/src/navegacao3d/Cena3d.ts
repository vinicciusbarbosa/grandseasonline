import * as THREE from 'three'
import { Mundo, type Vetor } from '../navegacao/mundo/Mundo'
import { fisicaDoNavio, NAVIOS, type TipoNavio } from '../navegacao/sim/navios'
import { alturaDoMar, componentes } from '../navegacao/sim/ondas'
import { fatorDoVento, ventoEm, type EstadoVento } from '../navegacao/sim/vento'
import { montarIlhas } from './ilhasEmPe'
import { ALTURA_ONDAS, Mar3d } from './mar3d'
import { COMPRIMENTO_NAVIO, criarNavio, LARGURA_NAVIO } from './navio3d'

/**
 * Teste da navegação em 3ª pessoa: o mar 3D pintado com o pincel do mar 2D,
 * as ilhas modeladas, um navio provisório e uma câmera que segue o navio.
 * Controles: W/S sobem e baixam as velas, A/D o leme; arrastar gira a câmera,
 * a roda aproxima; 1/2/3 trocam o ângulo.
 */

export type Angulo = 'alto' | 'terceira' | 'cima'
const ANGULOS: Record<Angulo, { inclinacao: number; distancia: number }> = {
  alto: { inclinacao: 0.8, distancia: 430 },
  terceira: { inclinacao: 0.22, distancia: 240 },
  cima: { inclinacao: 1.25, distancia: 900 },
}
const VELAS = [0, 0.35, 0.7, 1]
const NOMES_VELAS = ['Velas recolhidas', 'Meia vela', 'Vela de cruzeiro', 'Todo o pano']

export type Painel = { velocidade: number; velas: string; vento: number; rumoVento: number; angulo: Angulo; alturaOndas: number; fps: number }

export class Cena3d {
  private readonly renderizador: THREE.WebGLRenderer
  private readonly cena = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 2, 14000)
  private readonly mundo = new Mundo()
  private readonly mar: Mar3d
  private readonly navio: THREE.Group
  private readonly fis = fisicaDoNavio(NAVIOS.pirata.atributos)
  private readonly teclas = new Set<string>()
  private pos: Vetor
  private rumo = 0
  private vel = 0
  private velas = 0
  private t = 0
  private vento: EstadoVento = { direcao: 0, intensidade: 0.5, turbulencia: 0 }
  private angulo: Angulo = 'alto'
  private inclinacao = ANGULOS.alto.inclinacao
  private distancia = ANGULOS.alto.distancia
  private giroCamera = 0
  private arrastando: { x: number; y: number } | null = null
  private readonly alvoCamera = new THREE.Vector3()
  private balanco = { y: 0, arfagem: 0, rolagem: 0 }
  private quadro = 0
  private ultimo = performance.now()
  private fps = 60
  private contaFps = { n: 0, t: 0 }
  private vivo = true
  private alturaOndas = ALTURA_ONDAS
  aoAtualizar?: (p: Painel) => void

  private readonly tela: HTMLCanvasElement

  constructor(tela: HTMLCanvasElement, tipo: TipoNavio = 'pirata') {
    this.tela = tela
    this.renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true })
    this.renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

    const horizonte = new THREE.Color(0.78, 0.87, 0.93)
    const sol = new THREE.Vector3(-0.45, 0.55, -0.75).normalize()
    this.cena.fog = new THREE.Fog(horizonte, 1600, 3900)
    this.cena.add(this.ceu(horizonte, sol))

    this.cena.add(new THREE.HemisphereLight(0xe4f1ff, 0x5d6b3f, 1.7))
    const luz = new THREE.DirectionalLight(0xfff0d8, 2.7)
    luz.position.copy(sol).multiplyScalar(1000)
    this.cena.add(luz)

    const terra = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}mundo/terra.png`)
    terra.generateMipmaps = false
    terra.minFilter = terra.magFilter = THREE.LinearFilter
    this.mar = new Mar3d(terra, { x: this.mundo.larguraPx, y: this.mundo.alturaPx }, horizonte, sol)
    this.cena.add(this.mar.malha)
    void montarIlhas(this.cena)

    this.navio = criarNavio(tipo)
    this.cena.add(this.navio)

    // Começa ao lado da doca da Ilha Dawn, apontando para o mar aberto.
    const dawn = this.mundo.ilhas.find((i) => i.nome === 'Ilha Dawn') ?? this.mundo.ilhas[0]
    const doca = this.mundo.posicaoDaDoca(dawn)
    this.pos = this.aguaAberta(doca)
    this.rumo = Math.atan2(this.pos.y - doca.y, this.pos.x - doca.x)
    this.giroCamera = 0

    window.addEventListener('keydown', this.tecla)
    window.addEventListener('keyup', this.solta)
    window.addEventListener('resize', this.redimensionar)
    tela.addEventListener('pointerdown', this.aperta)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.larga)
    tela.addEventListener('wheel', this.roda, { passive: false })
    this.redimensionar()
    requestAnimationFrame(this.passo)
  }

  destruir() {
    this.vivo = false
    window.removeEventListener('keydown', this.tecla)
    window.removeEventListener('keyup', this.solta)
    window.removeEventListener('resize', this.redimensionar)
    this.tela.removeEventListener('pointerdown', this.aperta)
    window.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.larga)
    this.tela.removeEventListener('wheel', this.roda)
    this.renderizador.dispose()
  }

  /** Ponto de mar aberto mais perto da doca (a doca fica colada na costa). */
  private aguaAberta(doca: Vetor): Vetor {
    const c = this.mundo.celula
    let melhor = doca
    let nota = -Infinity
    for (let dy = -8; dy <= 8; dy++)
      for (let dx = -8; dx <= 8; dx++) {
        const p = { x: doca.x + dx * c, y: doca.y + dy * c }
        if (!this.mundo.navegavel(p)) continue
        const n = Math.min(this.mundo.folgaEm(p), 4) * 10 - Math.hypot(dx, dy)
        if (n > nota) {
          nota = n
          melhor = p
        }
      }
    return melhor
  }

  mudarAngulo(a: Angulo) {
    this.angulo = a
    this.giroCamera = 0
  }

  mudarAlturaOndas(v: number) {
    this.alturaOndas = v
    this.mar.altura = v
  }

  mudarVelas(d: number) {
    this.velas = Math.max(0, Math.min(VELAS.length - 1, this.velas + d))
  }

  /** Céu: degradê do horizonte ao azul, com o brilho do sol. */
  private ceu(horizonte: THREE.Color, sol: THREE.Vector3) {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uHorizonte: { value: horizonte }, uSol: { value: sol } },
      vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uHorizonte; uniform vec3 uSol; varying vec3 vDir;
        void main() {
          float a = clamp(vDir.y, 0.0, 1.0);
          vec3 zenite = vec3(0.33, 0.6, 0.9);
          vec3 cor = mix(uHorizonte, zenite, pow(a, 0.55));
          float s = max(dot(normalize(vDir), uSol), 0.0);
          cor += vec3(1.0, 0.93, 0.75) * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18);
          gl_FragColor = vec4(cor, 1.0);
        }`,
    })
    const ceu = new THREE.Mesh(new THREE.SphereGeometry(10000, 32, 16), m)
    ceu.frustumCulled = false
    ceu.renderOrder = -1
    this.ceuMalha = ceu
    return ceu
  }
  private ceuMalha!: THREE.Mesh

  private readonly tecla = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') this.mudarVelas(1)
    if (k === 's' || k === 'arrowdown') this.mudarVelas(-1)
    if (k === '1') this.mudarAngulo('alto')
    if (k === '2') this.mudarAngulo('terceira')
    if (k === '3') this.mudarAngulo('cima')
    this.teclas.add(k)
  }
  private readonly solta = (e: KeyboardEvent) => this.teclas.delete(e.key.toLowerCase())
  private readonly aperta = (e: PointerEvent) => (this.arrastando = { x: e.clientX, y: e.clientY })
  private readonly larga = () => (this.arrastando = null)
  private readonly move = (e: PointerEvent) => {
    if (!this.arrastando) return
    this.giroCamera += (e.clientX - this.arrastando.x) * 0.006
    this.inclinacao = Math.max(0.05, Math.min(1.45, this.inclinacao + (e.clientY - this.arrastando.y) * 0.004))
    this.arrastando = { x: e.clientX, y: e.clientY }
  }
  private readonly roda = (e: WheelEvent) => {
    e.preventDefault()
    this.distancia = Math.max(120, Math.min(1600, this.distancia * (1 + Math.sign(e.deltaY) * 0.1)))
  }
  private readonly redimensionar = () => {
    const w = this.tela.clientWidth
    const h = this.tela.clientHeight
    this.renderizador.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private simular(dt: number) {
    this.vento = ventoEm(1, this.pos, this.t, this.mundo.celula)
    const leme = (this.teclas.has('a') || this.teclas.has('arrowleft') ? -1 : 0) + (this.teclas.has('d') || this.teclas.has('arrowright') ? 1 : 0)
    const f = this.fis
    const alvo = f.velocidadeMax * VELAS[this.velas] * fatorDoVento(this.rumo, this.vento, f.aproveitamentoVento)
    this.vel += Math.max(-f.desaceleracao * dt, Math.min(f.aceleracao * dt, alvo - this.vel))
    // leme responde mais com o navio andando (parado ainda gira devagar)
    this.rumo += leme * f.giro * dt * (0.3 + 0.7 * Math.min(1, this.vel / f.velocidadeMax))
    const prox = { x: this.pos.x + Math.cos(this.rumo) * this.vel * dt, y: this.pos.y + Math.sin(this.rumo) * this.vel * dt }
    // encostou em terra: desliza ao longo da costa em vez de travar
    const soX = { x: prox.x, y: this.pos.y }
    const soY = { x: this.pos.x, y: prox.y }
    if (this.mundo.navegavel(prox)) this.pos = prox
    else if (this.mundo.navegavel(soX) || this.mundo.navegavel(soY)) {
      this.pos = this.mundo.navegavel(soX) ? soX : soY
      this.vel *= 0.97
    } else this.vel = 0
  }

  /** O navio assenta na água que se vê: proa/popa e bordos amostrados na mesma onda do shader. */
  private assentar(dt: number) {
    const ondas = componentes()
    const fx = Math.cos(this.rumo)
    const fy = Math.sin(this.rumo)
    const L = COMPRIMENTO_NAVIO * 0.45
    const W = LARGURA_NAVIO * 0.7
    const h = (a: number, b: number) => alturaDoMar(ondas, { x: this.pos.x + fx * a - fy * b, y: this.pos.y + fy * a + fx * b }, this.t, 1) * this.alturaOndas
    const proa = h(L, 0)
    const popa = h(-L, 0)
    const bb = h(0, -W)
    const be = h(0, W)
    const alvo = { y: (proa + popa + bb + be) / 4, arfagem: Math.atan2(proa - popa, 2 * L), rolagem: Math.atan2(bb - be, 2 * W) * 0.8 }
    const k = 1 - Math.exp(-dt * 6)
    this.balanco.y += (alvo.y - this.balanco.y) * k
    this.balanco.arfagem += (alvo.arfagem - this.balanco.arfagem) * k
    this.balanco.rolagem += (alvo.rolagem - this.balanco.rolagem) * k
    this.navio.position.set(this.pos.x, this.balanco.y, this.pos.y)
    this.navio.rotation.set(0, 0, 0)
    this.navio.rotateY(-this.rumo)
    this.navio.rotateZ(this.balanco.arfagem)
    this.navio.rotateX(this.balanco.rolagem)
  }

  private posicionarCamera(dt: number) {
    const a = ANGULOS[this.angulo]
    if (!this.arrastando) {
      // volta devagar para trás do navio e para o ângulo escolhido
      this.giroCamera *= Math.exp(-dt * 0.6)
      this.inclinacao += (a.inclinacao - this.inclinacao) * (1 - Math.exp(-dt * 1.5))
    }
    this.distancia += (a.distancia - this.distancia) * (1 - Math.exp(-dt * 0.8)) * (this.arrastando ? 0 : 0.2)
    const yaw = this.rumo + this.giroCamera
    const alvo = new THREE.Vector3(this.pos.x, this.balanco.y * 0.5 + 24, this.pos.y)
    this.alvoCamera.lerp(alvo, this.quadro === 0 ? 1 : 1 - Math.exp(-dt * 5))
    const d = this.distancia
    const c = this.alvoCamera.clone().add(new THREE.Vector3(-Math.cos(yaw) * Math.cos(this.inclinacao) * d, Math.sin(this.inclinacao) * d, -Math.sin(yaw) * Math.cos(this.inclinacao) * d))
    // nunca abaixo da água
    c.y = Math.max(c.y, 14)
    this.camera.position.copy(c)
    this.camera.lookAt(this.alvoCamera)
    this.ceuMalha.position.copy(c)
  }

  private readonly passo = () => {
    if (!this.vivo) return
    const agora = performance.now()
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000)
    this.ultimo = agora
    this.t += dt
    this.simular(dt)
    this.assentar(dt)
    this.posicionarCamera(dt)
    this.mar.atualizar(this.t, this.camera.position, this.vento)
    this.renderizador.render(this.cena, this.camera)
    this.quadro++
    this.contaFps.n++
    this.contaFps.t += dt
    if (this.contaFps.t > 0.5) {
      this.fps = Math.round(this.contaFps.n / this.contaFps.t)
      this.contaFps = { n: 0, t: 0 }
    }
    if (this.quadro % 6 === 0)
      this.aoAtualizar?.({
        velocidade: this.vel,
        velas: NOMES_VELAS[this.velas],
        vento: this.vento.intensidade,
        rumoVento: this.vento.direcao - this.rumo,
        angulo: this.angulo,
        alturaOndas: this.alturaOndas,
        fps: this.fps,
      })
    requestAnimationFrame(this.passo)
  }
}
