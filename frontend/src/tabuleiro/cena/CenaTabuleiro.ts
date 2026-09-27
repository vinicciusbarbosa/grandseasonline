import * as THREE from 'three'
import { alcance, casaEm, centroCasa, mesmaCasa, vizinhos, COLUNAS, METADE, VAO, type Casa } from '../tabuleiro'
import { criarMar } from './mar'
import { montarNavios } from './navio'
import { Assador } from '../boneco/assador'
import { CAPITAES } from '../boneco/boneco'
import { Personagem } from './personagem'
import { Poeira } from './poeira'
import { texturaMoldura } from './texturas'

/**
 * Cena do teste de tabuleiro: os dois navios, o mar e os personagens em
 * pixel art. A imagem é renderizada numa resolução baixa e ampliada sem
 * filtro (cada pixel da cena vira um bloco nítido na tela).
 */

export type Flutuante = { id: number; texto: string; x: number; y: number; t: number; cor: string }

export type EstadoTela = {
  personagens: { id: string; nome: string; vida: number; vidaMax: number; x: number; y: number; selecionado: boolean }[]
  flutuantes: Flutuante[]
  velocidade: number
  escala: number
  dica: string
}

const PASSOS = 4
const DANO = [14, 22]

export class CenaTabuleiro {
  readonly renderer: THREE.WebGLRenderer
  private readonly cena = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 200)
  private readonly personagens: Personagem[] = []
  private poeiras: Poeira[] = []
  private readonly marcas = new THREE.Group()
  private readonly moldura: THREE.Mesh
  private readonly hover: THREE.Mesh
  private readonly matAlcance: THREE.MeshBasicMaterial
  private readonly matAlvo: THREE.MeshBasicMaterial
  private readonly geoCasa = new THREE.PlaneGeometry(0.94, 0.94)
  private selecionado: Personagem | null = null
  private alvosAlcance: { casas: Casa[]; caminho: (c: Casa) => Casa[] | null } | null = null
  private readonly mar: ReturnType<typeof criarMar>
  private readonly navios: ReturnType<typeof montarNavios>
  private tempo = 0
  private anterior = performance.now()
  private quadro = 0
  private largura = 1
  private altura = 1
  private escala = 1
  private velocidade = 1
  private flutuantes: Flutuante[] = []
  private idFlut = 0
  private dica = 'Clique num capitão para selecionar.'
  private readonly ouvintes = new Set<() => void>()
  private estado: EstadoTela
  private readonly ray = new THREE.Raycaster()
  private readonly plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  private readonly hospedeiro: HTMLElement

  constructor(hospedeiro: HTMLElement) {
    this.hospedeiro = hospedeiro
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.BasicShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    const cv = this.renderer.domElement
    cv.style.width = '100%'
    cv.style.height = '100%'
    cv.style.imageRendering = 'pixelated'
    cv.style.display = 'block'
    hospedeiro.appendChild(cv)

    this.cena.background = new THREE.Color(0x0b2a66)
    // sol da tarde vindo do fundo à esquerda (sombras para a frente/direita)
    const sol = new THREE.DirectionalLight(0xfff0d8, 2.4)
    sol.position.set(-14, 22, -12)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    const s = sol.shadow.camera as THREE.OrthographicCamera
    s.left = -18
    s.right = 18
    s.top = 16
    s.bottom = -16
    s.near = 1
    s.far = 70
    sol.shadow.bias = -0.0015
    this.cena.add(sol, sol.target)
    this.cena.add(new THREE.HemisphereLight(0x9cc4ff, 0x5a3a20, 1.15))

    this.navios = montarNavios()
    this.cena.add(this.navios.grupo)
    this.mar = criarMar(this.navios.cascos)
    this.cena.add(this.mar.mar)

    this.matAlcance = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(160,230,255,0.95)', 'rgba(90,170,230,0.28)'), transparent: true, depthWrite: false })
    this.matAlvo = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,110,90,1)', 'rgba(230,60,40,0.30)'), transparent: true, depthWrite: false })
    this.moldura = new THREE.Mesh(
      this.geoCasa,
      new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,248,190,1)', 'rgba(255,230,120,0.30)'), transparent: true, depthWrite: false }),
    )
    this.hover = new THREE.Mesh(
      this.geoCasa,
      new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,255,255,0.8)', 'rgba(255,255,255,0.08)'), transparent: true, depthWrite: false }),
    )
    for (const m of [this.moldura, this.hover]) {
      m.rotation.x = -Math.PI / 2
      m.visible = false
      this.cena.add(m)
    }
    this.cena.add(this.marcas)

    // os dois capitães da arte de referência, um em cada navio
    // os bonecos são "fotografados" em pixel art aqui mesmo, na placa de vídeo
    const assador = new Assador(this.renderer)
    this.adicionar(new Personagem('capitao-vermelho', 'Capitão Vermelho', { l: 2, c: 6 }, 120, assador.assar(CAPITAES['capitao-vermelho']), 'SE'))
    this.adicionar(new Personagem('capitao-negro', 'Capitão Negro', { l: 7, c: 13 }, 120, assador.assar(CAPITAES['capitao-negro']), 'NW'))

    this.estado = this.montarEstado()
    this.redimensionar()
    window.addEventListener('resize', this.redimensionar)
    cv.addEventListener('pointermove', this.aoMover)
    cv.addEventListener('pointerdown', this.aoClicar)
    cv.addEventListener('contextmenu', this.aoDireito)
    window.addEventListener('keydown', this.aoTecla)
    this.quadro = requestAnimationFrame(this.laco)
    ;(window as unknown as { cenaTabuleiro?: CenaTabuleiro }).cenaTabuleiro = this
  }

  private adicionar(p: Personagem) {
    this.personagens.push(p)
    this.cena.add(p.sprite, p.sombra)
  }

  destruir() {
    cancelAnimationFrame(this.quadro)
    window.removeEventListener('resize', this.redimensionar)
    window.removeEventListener('keydown', this.aoTecla)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------ estado p/ React
  inscrever = (f: () => void) => {
    this.ouvintes.add(f)
    return () => this.ouvintes.delete(f)
  }
  retrato = () => this.estado

  setVelocidade(v: number) {
    this.velocidade = v
  }

  private montarEstado(): EstadoTela {
    return {
      personagens: this.personagens.map((p) => {
        const s = this.naTela(p.pos, p.alturaPx + 10)
        return { id: p.id, nome: p.nome, vida: p.vida, vidaMax: p.vidaMax, x: s.x, y: s.y, selecionado: p === this.selecionado }
      }),
      flutuantes: this.flutuantes,
      velocidade: this.velocidade,
      escala: this.escala,
      dica: this.dica,
    }
  }

  /** Posição em pixels CSS de um ponto do mundo, subindo `acimaPx` pixels da cena. */
  private naTela(p: THREE.Vector3, acimaPx = 0) {
    const n = p.clone().project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return {
      x: ((n.x + 1) / 2) * r.width,
      y: ((1 - n.y) / 2) * r.height - (acimaPx * r.height) / this.altura,
    }
  }

  /** Centro de uma casa em pixels CSS (usado pelos testes automáticos). */
  telaDaCasa(l: number, c: number) {
    const p = centroCasa(l, c)
    return this.naTela(new THREE.Vector3(p.x, 0, p.z))
  }

  // ------------------------------------------------------------ tamanho/câmera
  private redimensionar = () => {
    const r = this.hospedeiro.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    // um pixel da cena = `escala` pixels do aparelho (inteiro sempre que dá)
    this.escala = Math.max(1, Math.round((r.height * dpr) / 900))
    this.largura = Math.max(320, Math.floor((r.width * dpr) / this.escala))
    this.altura = Math.max(180, Math.floor((r.height * dpr) / this.escala))
    this.renderer.setSize(this.largura, this.altura, false)
    this.camera.aspect = this.largura / this.altura
    this.enquadrar()
  }

  /** Câmera como na referência: de cima, inclinada ~50°, girada um pouco. */
  private enquadrar() {
    const cam = this.camera
    cam.updateProjectionMatrix()
    const inclinacao = THREE.MathUtils.degToRad(52)
    const giro = THREE.MathUtils.degToRad(-8)
    const dir = new THREE.Vector3(Math.sin(giro) * Math.cos(inclinacao), Math.sin(inclinacao), Math.cos(giro) * Math.cos(inclinacao))
    const pontos: THREE.Vector3[] = []
    for (const x of [-COLUNAS / 2 - 1.4, COLUNAS / 2 + 1.4])
      for (const z of [-VAO / 2 - METADE - 1.2, VAO / 2 + METADE + 1.1]) for (const y of [0, 0.9]) pontos.push(new THREE.Vector3(x, y, z))
    const alvo = new THREE.Vector3(0, 0, 0.2)
    let dist = 20
    for (let volta = 0; volta < 3; volta++) {
      for (dist = 12; dist < 120; dist += 0.25) {
        cam.position.copy(alvo).addScaledVector(dir, dist)
        cam.lookAt(alvo)
        cam.updateMatrixWorld()
        if (pontos.every((p) => {
          const n = p.clone().project(cam)
          return Math.abs(n.x) < 0.97 && n.y < 0.84 && n.y > -0.96
        }))
          break
      }
      // centraliza horizontalmente o que sobrou
      let minX = Infinity
      let maxX = -Infinity
      for (const p of pontos) {
        const n = p.clone().project(cam)
        minX = Math.min(minX, n.x)
        maxX = Math.max(maxX, n.x)
      }
      const desvio = (minX + maxX) / 2
      const direita = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
      alvo.addScaledVector(direita, desvio * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect)
    }
  }

  // ------------------------------------------------------------ laço
  private laco = (agora: number) => {
    this.quadro = requestAnimationFrame(this.laco)
    const dtReal = Math.min(0.05, (agora - this.anterior) / 1000)
    this.anterior = agora
    const dt = dtReal * this.velocidade
    this.tempo += dt
    this.mar.mat.uniforms.tempo.value = this.tempo
    for (const p of this.personagens) p.atualizar(dt)
    for (const l of this.navios.luzes) l.intensity = 2.6 + Math.sin(this.tempo * 9 + l.id) * 0.25 + Math.sin(this.tempo * 23 + l.id * 3) * 0.15
    for (const pano of this.navios.panos) this.ondular(pano)
    // molduras
    if (this.selecionado) {
      const c = centroCasa(this.selecionado.casa.l, this.selecionado.casa.c)
      const p = this.selecionado.pos
      this.moldura.position.set(this.selecionado.ocupado ? p.x : c.x, 0.006, this.selecionado.ocupado ? p.z : c.z)
      this.moldura.visible = true
      ;(this.moldura.material as THREE.MeshBasicMaterial).opacity = 0.75 + 0.25 * Math.sin(this.tempo * 5)
    } else this.moldura.visible = false
    this.camera.updateMatrixWorld()
    for (const p of this.personagens) {
      p.posicionar(this.camera, this.largura, this.altura)
      for (const pos of p.poeiras.splice(0)) {
        const po = new Poeira(pos)
        this.poeiras.push(po)
        this.cena.add(po.sprite)
      }
    }
    for (const po of this.poeiras) {
      po.atualizar(dt, this.camera, this.largura, this.altura)
      if (!po.vivo) this.cena.remove(po.sprite)
    }
    this.poeiras = this.poeiras.filter((po) => po.vivo)
    this.flutuantes = this.flutuantes.map((f) => ({ ...f, t: f.t + dtReal })).filter((f) => f.t < 1.2)
    this.renderer.render(this.cena, this.camera)
    this.estado = this.montarEstado()
    for (const f of this.ouvintes) f()
  }

  private ondular(pano: THREE.Mesh) {
    const geo = pano.geometry as THREE.PlaneGeometry
    const p = geo.getAttribute('position') as THREE.BufferAttribute
    if (!pano.userData.base) pano.userData.base = Float32Array.from(p.array as Float32Array)
    const b = pano.userData.base as Float32Array
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3]
      const solto = (1 - x) / 2 // 0 na haste, 1 na ponta
      p.setZ(i, Math.sin(this.tempo * 4 - x * 2.2) * 0.22 * solto + Math.sin(this.tempo * 7.3 - x * 3.1 + b[i * 3 + 1]) * 0.06 * solto)
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  }

  // ------------------------------------------------------------ entrada
  private pegar(ev: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    // primeiro o corpo dos personagens (clicar na figura, não só no pé)
    for (const p of [...this.personagens].sort((a, b) => b.pos.z - a.pos.z)) {
      const ret = this.retanguloSprite(p)
      const px = ((ndc.x + 1) / 2) * this.largura
      const py = ((1 - ndc.y) / 2) * this.altura
      if (px >= ret.x0 && px <= ret.x1 && py >= ret.y0 && py <= ret.y1) return { casa: p.casa, personagem: p }
    }
    const ponto = new THREE.Vector3()
    if (!this.ray.ray.intersectPlane(this.plano, ponto)) return null
    const casa = casaEm(ponto.x, ponto.z)
    if (!casa) return null
    return { casa, personagem: this.personagens.find((p) => mesmaCasa(p.casa, casa)) ?? null }
  }

  /** Retângulo (em pixels da cena) do corpo do personagem, só a parte "cheia". */
  private retanguloSprite(p: Personagem) {
    const n = p.pos.clone().project(this.camera)
    const x = ((n.x + 1) / 2) * this.largura
    const y = ((1 - n.y) / 2) * this.altura
    return { x0: x - 28, x1: x + 28, y0: y - p.alturaPx + 8, y1: y + 2 }
  }

  private aoMover = (ev: PointerEvent) => {
    const alvo = this.pegar(ev)
    if (!alvo) {
      this.hover.visible = false
      this.renderer.domElement.style.cursor = 'default'
      return
    }
    const c = centroCasa(alvo.casa.l, alvo.casa.c)
    this.hover.position.set(c.x, 0.004, c.z)
    this.hover.visible = true
    this.renderer.domElement.style.cursor = alvo.personagem || this.alvosAlcance?.caminho(alvo.casa) ? 'pointer' : 'default'
  }

  private aoDireito = (ev: Event) => {
    ev.preventDefault()
    this.selecionar(null)
  }

  private aoTecla = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') this.selecionar(null)
  }

  private aoClicar = (ev: PointerEvent) => {
    if (ev.button !== 0) return
    const alvo = this.pegar(ev)
    if (!alvo) return this.selecionar(null)
    const sel = this.selecionado
    if (alvo.personagem && alvo.personagem !== sel) {
      if (sel && !sel.ocupado) {
        this.investir(sel, alvo.personagem)
        return
      }
      if (!alvo.personagem.ocupado) this.selecionar(alvo.personagem)
      return
    }
    if (alvo.personagem === sel) return this.selecionar(null)
    if (sel && !sel.ocupado && this.alvosAlcance) {
      const cam = this.alvosAlcance.caminho(alvo.casa)
      if (cam) {
        this.limparMarcas()
        this.dica = 'Andando…'
        sel.andar(cam, () => this.selecionar(sel))
      }
    }
  }

  /** Vai até o lado do inimigo (se precisar) e ataca. */
  private investir(atacante: Personagem, alvo: Personagem) {
    const ocupada = (c: Casa) => this.personagens.some((p) => p !== atacante && mesmaCasa(p.casa, c))
    const adjacente = vizinhos(atacante.casa).some((v) => mesmaCasa(v, alvo.casa))
    const golpe = () => {
      this.dica = `${atacante.nome} ataca!`
      atacante.atacar(alvo, () => {
        const dano = DANO[0] + Math.floor(Math.random() * (DANO[1] - DANO[0] + 1))
        alvo.sofrer(dano, atacante)
        if (alvo.vida <= 0) alvo.vida = alvo.vidaMax // teste: volta a vida cheia
        const s = this.naTela(alvo.pos, alvo.alturaPx * 0.7)
        this.flutuantes = [...this.flutuantes, { id: ++this.idFlut, texto: `-${dano}`, x: s.x, y: s.y, t: 0, cor: '#ffe27a' }]
      })
      this.selecionar(null)
    }
    if (adjacente) return golpe()
    // procura a casa vizinha do alvo mais perto dentro do alcance
    const a = alcance(atacante.casa, PASSOS, ocupada)
    let melhor: Casa[] | null = null
    for (const v of vizinhos(alvo.casa)) {
      if (ocupada(v)) continue
      const cam = a.caminho(v)
      if (cam && (!melhor || cam.length < melhor.length)) melhor = cam
    }
    if (!melhor) {
      this.dica = 'Longe demais para atacar neste turno.'
      return
    }
    this.limparMarcas()
    atacante.andar(melhor, golpe)
  }

  private selecionar(p: Personagem | null) {
    this.selecionado = p
    this.limparMarcas()
    this.alvosAlcance = null
    if (!p) {
      this.dica = 'Clique num capitão para selecionar.'
      return
    }
    const ocupada = (c: Casa) => this.personagens.some((o) => o !== p && mesmaCasa(o.casa, c))
    const a = alcance(p.casa, PASSOS, ocupada)
    this.alvosAlcance = a
    for (const c of a.casas) this.marcar(c, this.matAlcance)
    for (const o of this.personagens) {
      if (o === p) continue
      const perto = vizinhos(o.casa).some((v) => mesmaCasa(v, p.casa) || a.caminho(v))
      if (perto) this.marcar(o.casa, this.matAlvo)
    }
    this.dica = `${p.nome}: clique numa casa azul para andar ou no inimigo para atacar.`
  }

  private marcar(c: Casa, mat: THREE.Material) {
    const m = new THREE.Mesh(this.geoCasa, mat)
    const p = centroCasa(c.l, c.c)
    m.rotation.x = -Math.PI / 2
    m.position.set(p.x, 0.003, p.z)
    this.marcas.add(m)
  }

  private limparMarcas() {
    this.marcas.clear()
  }
}
