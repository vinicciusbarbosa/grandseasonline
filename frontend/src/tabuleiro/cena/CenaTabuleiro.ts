import * as THREE from 'three'
import { casaEm, centroCasa, mesmaCasa, COLUNAS, LINHAS, METADE, type Casa } from '../tabuleiro'
import { criarMar } from './mar'
import { montarNavios } from './navio'
import { Assador } from '../boneco/assador'
import { CAPITAES } from '../boneco/boneco'
import { Personagem } from './personagem'
import { ControleBatalha, type Marca, type RetratoBatalha } from '../batalha/controle'
import { TRIPULACOES } from '../batalha/elenco'
import { VisualSprite } from './visualSprite'
import { VisualFolhas } from './visualFolhas'
import { Poeira } from './poeira'
import { GolpeHaki } from './golpeHaki'
import { HakiRei } from './hakiRei'
import { Efeito, type Paleta, type TipoEfeito } from './efeitos'
import { ChoqueTela } from './choqueTela'
import { EfeitoFolha, manifestoEfeito, type DirEfeito } from './efeitoFolha'
import { ImpactoHaki } from './impactoHaki'
import { Entei } from './entei'
import type { LuzPersonagem } from './luzSprite'
import { ESCALA_ARTE_ANTIGA, PX_CASA, escalaPixel } from './pixel'
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
  /** 0–1: tela escurecendo em vermelho (Haki do Rei) */
  aura: number
  /** quadro de impacto (anime): a tela pisca; t de 0 a 1 some */
  lampejo: { tipo: 'rei' | 'branco'; forca: number; fase: number } | null
  /** o personagem do botão B está com Haki de armamento */
  hakiArmamento: boolean
  velocidade: number
  escala: number
  dica: string
  /** batalha em andamento (null enquanto os personagens carregam) */
  batalha: RetratoBatalha | null
}

const INCLINACAO = Math.asin(0.75) // casa de 64×48 px
/** com zoom máximo a câmera desce até este ângulo, mais rente aos personagens */
const INCLINACAO_PERTO = THREE.MathUtils.degToRad(28)
/** zoom que mostra o tabuleiro inteiro (a casa com 64 px na tela) */
const ZOOM_TUDO = 64 / PX_CASA
/** zoom máximo: cada pixel da arte vira um bloco de 4×4 (como a arte original) */
const ZOOM_MAX = 4
/** níveis onde o zoom para: inteiros deixam todo pixel da arte do mesmo tamanho */
const NIVEIS = [ZOOM_TUDO, 1, 2, 3, 4]
const GIRO = THREE.MathUtils.degToRad(-8)
const FOV = 22


const entre01 = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)))
/** cor das formas (multiplica o sprite) */
const TINTA = {
  zoan: new THREE.Color(0.95, 0.72, 0.52),
  gear: new THREE.Color(1.45, 0.62, 0.55),
  sabre: new THREE.Color(1.25, 1.18, 0.8),
}

export class CenaTabuleiro {
  readonly renderer: THREE.WebGLRenderer
  /** efeitos das skills em resolução cheia, por cima da cena em pixel art */
  private readonly rendererFx: THREE.WebGLRenderer
  private readonly cenaFx = new THREE.Scene()
  /** choques de Haki do Rei, desenhados direto na tela (2D, resolução cheia) */
  private readonly tela2d = document.createElement('canvas')
  private choques: ChoqueTela[] = []
  private tela2dSuja = false
  private readonly cena = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 200)
  private readonly personagens: Personagem[] = []
  private poeiras: Poeira[] = []
  private golpes: GolpeHaki[] = []
  /** tremor curto da câmera no impacto de um golpe com Haki (s) */
  private tremorGolpe = 0
  private hakis: HakiRei[] = []
  private efeitos: (Efeito | EfeitoFolha | Entei)[] = []
  /** hit-stop: tempo (s, real) em que o jogo fica congelado no impacto */
  private congelado = 0
  /** animações curtas por tempo (esquiva, Logia), f de 0 a 1 */
  private tweens: { t: number; dur: number; passo: (f: number) => void; fim: () => void }[] = []
  private readonly marcas = new THREE.Group()
  private readonly moldura: THREE.Mesh
  private readonly hover: THREE.Mesh
  private readonly matAlcance: THREE.MeshBasicMaterial
  private readonly matAlvo: THREE.MeshBasicMaterial
  private readonly geoCasa = new THREE.PlaneGeometry(0.94, 0.94)
  private selecionado: Personagem | null = null
  private batalha: ControleBatalha | null = null
  private retratoBatalha: RetratoBatalha | null = null
  /** personagens que caíram, desaparecendo (s restantes) */
  private sumindo: { p: Personagem; t: number }[] = []
  private readonly matCura: THREE.MeshBasicMaterial
  private readonly matDestino: THREE.MeshBasicMaterial
  private readonly matArea: THREE.MeshBasicMaterial
  private readonly matMira: THREE.MeshBasicMaterial
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
  private dica = 'Escolha um capitão.'
  private readonly ouvintes = new Set<() => void>()
  private estado: EstadoTela
  private readonly pan = new THREE.Vector3()
  /** direção para o sol (para saber quem está na sombra das velas/mastro) */
  private readonly dirSol = new THREE.Vector3()
  private readonly luzes = new Map<Personagem, LuzPersonagem>()
  private readonly raioSol = new THREE.Raycaster()
  /** ZOOM_TUDO = tabuleiro inteiro; 1 = arte 1:1; até ZOOM_MAX */
  private zoom = ZOOM_TUDO
  /** para onde o zoom está indo (anima suave até lá) e o ponto da tela que fica parado */
  private zoomAlvo = ZOOM_TUDO
  private zoomAncora: [number, number] | undefined
  private ultimaRoda = 0
  private readonly toques = new Map<number, { x: number; y: number }>()
  private pinca: { dist: number; zoom: number } | null = null
  private pincaCentro: [number, number] | undefined
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
    this.rendererFx = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.rendererFx.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.rendererFx.setClearColor(0x000000, 0)
    this.rendererFx.outputColorSpace = THREE.SRGBColorSpace
    const fx = this.rendererFx.domElement
    Object.assign(fx.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    hospedeiro.appendChild(fx)
    Object.assign(this.tela2d.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    hospedeiro.appendChild(this.tela2d)

    this.cena.background = new THREE.Color(0x0b2a66)
    // sol da tarde vindo do fundo à esquerda (sombras para a frente/direita)
    const sol = new THREE.DirectionalLight(0xfff0d8, 2.4)
    this.dirSol.copy(new THREE.Vector3(-14, 22, -12)).normalize()
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
    this.matAlvo = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,90,70,1)', 'rgba(240,50,30,0.55)'), transparent: true, depthWrite: false })
    this.matCura = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(120,255,140,1)', 'rgba(60,220,90,0.28)'), transparent: true, depthWrite: false })
    this.matDestino = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,220,90,1)', 'rgba(255,200,60,0.22)'), transparent: true, depthWrite: false })
    this.matMira = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,110,90,0.45)', 'rgba(230,60,40,0.10)'), transparent: true, depthWrite: false })
    this.matArea = new THREE.MeshBasicMaterial({ map: texturaMoldura('rgba(255,160,40,1)', 'rgba(255,120,30,0.45)'), transparent: true, depthWrite: false })
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

    // as duas tripulações (arte provisória da LPC, ampliada 2×): piratas no
    // navio de cima, Marinha no de baixo. Se as folhas não carregarem, os
    // capitães em boneco 3D "fotografado" em pixel art entram no lugar.
    const assador = new Assador(this.renderer)
    const vir = (id: string, nome: string, casa: Casa, dir: 'SE' | 'NW') =>
      this.adicionar(new Personagem(id, nome, casa, 120, new VisualSprite(assador.assar(CAPITAES[id])), dir))
    const batalha = new ControleBatalha(this.palco)
    void Promise.all(
      TRIPULACOES.map(async (t) => {
        const c = batalha.combatentes.find((x) => x.id === t.id)!
        return new Personagem(t.id, t.nome, t.casa, c.hpMax, await VisualFolhas.carregar(t.id), t.dir)
      }),
    )
      .then((ps) => {
        ps.forEach((p) => this.adicionar(p))
        this.batalha = batalha
        batalha.comecarTreino()
        this.palco.avisar()
      })
      .catch((e) => {
        console.error('tripulações não carregaram', e)
        vir('capitao-vermelho', 'Capitão Vermelho', { l: 2, c: 6 }, 'SE')
        vir('capitao-negro', 'Capitão Negro', { l: 7, c: 13 }, 'NW')
      })

    this.estado = this.montarEstado()
    this.redimensionar()
    window.addEventListener('resize', this.redimensionar)
    // toque ou mouse: tocar/clicar escolhe; arrastar move a câmera
    cv.style.touchAction = 'none'
    cv.addEventListener('pointermove', this.aoMover)
    cv.addEventListener('pointerdown', this.aoApertar)
    cv.addEventListener('pointerup', this.aoSoltar)
    cv.addEventListener('pointercancel', this.aoSoltar)
    cv.addEventListener('wheel', this.aoRolar, { passive: false })
    cv.addEventListener('contextmenu', this.aoDireito)
    window.addEventListener('keydown', this.aoTecla)
    this.quadro = requestAnimationFrame(this.laco)
    ;(window as unknown as { cenaTabuleiro?: CenaTabuleiro }).cenaTabuleiro = this
  }

  private adicionar(p: Personagem) {
    this.personagens.push(p)
    this.cena.add(...p.visual.objetos)
    // personagem por cima dos efeitos de trás, por baixo dos da frente
    for (const o of p.visual.objetos) if ((o as THREE.Sprite).isSprite) o.renderOrder = 2
  }

  /** O que o controle da batalha pode pedir à cena. */
  private readonly palco = {
    personagem: (id: string) => this.personagens.find((p) => p.id === id),
    marcar: (c: Casa, tipo: Marca) =>
      this.marcar(c, { mover: this.matAlcance, alcance: this.matMira, alvo: this.matAlvo, cura: this.matCura, destino: this.matDestino, area: this.matArea }[tipo]),
    limparMarcas: () => this.limparMarcas(),
    flutuar: (p: Personagem, texto: string, cor: string, linha = 0) => {
      const s = this.acimaDe(p, 0.75 + linha * 0.3)
      this.flutuantes = [...this.flutuantes, { id: ++this.idFlut, texto, x: s.x, y: s.y, t: 0, cor }]
    },
    sumir: (p: Personagem) => this.sumindo.push({ p, t: 0.8 }),
    efeito: (tipo: TipoEfeito, paleta: Paleta, de: THREE.Vector3, op: { para?: THREE.Vector3; dur?: number; escala?: number; alongar?: number; direcao?: THREE.Vector3 } = {}) =>
      new Promise<void>((r) => {
        const ef = new Efeito(tipo, paleta, de, { ...op, aoChegar: r })
        this.efeitos.push(ef)
        this.cenaFx.add(ef.sprite)
      }),
    peito: (p: Personagem) => p.pos.clone().setY(p.pos.y + p.visual.altura * 0.5),
    centro: (c: Casa) => {
      const p = centroCasa(c.l, c.c)
      return new THREE.Vector3(p.x, 0.7, p.z)
    },
    hakiDoRei: (p: Personagem) => {
      const h = new HakiRei(p.pos, p.visual.altura)
      h.dono = p
      this.hakis.push(h)
      this.cena.add(...h.objetos)
      window.setTimeout(() => h.desligar(), 1400 / this.velocidade)
    },
    tremer: (s: number) => {
      this.tremorGolpe = Math.max(this.tremorGolpe, s)
    },
    esquivar: (p: Personagem, de: Personagem) => this.esquivar(p, de),
    atravessar: (p: Personagem, elemento: string) => this.atravessar(p, elemento),
    focar: (pontos: THREE.Vector3[] | null) => this.focar(pontos),
    lampejo: (tipo: 'rei' | 'branco', dur: number) => {
      this.lampejoAtual = { tipo, t: 0, dur }
    },
    /** efeito desenhado (spritesheet); false se a folha não existe */
    efeitoFolha: async (nome: string, dir: DirEfeito, de: THREE.Vector3, op: { para?: THREE.Vector3; largura?: number; voo?: [number, number]; aoChegar?: () => void; chao?: boolean; escala?: number } = {}) => {
      const man = await manifestoEfeito(nome)
      if (!man) return false
      await new Promise<void>((r) => {
        // com destino, termina ao chegar; sem, quando o último quadro acaba
        const ef = new EfeitoFolha(nome, man, dir, de, op.para ? { ...op, aoChegar: () => (op.aoChegar?.(), r()) } : { ...op, aoAcabar: r })
        this.efeitos.push(ef)
        this.cenaFx.add(ef.sprite)
      })
      return true
    },
    /** Entei em fases (círculo, espiral, bola crescendo, voo, explosão); resolve no impacto */
    entei: (p: Personagem, ate: THREE.Vector3, k: number) =>
      new Promise<void>((r) => {
        const ef = new Entei(p.pos, ate, p.visual.alturaPx / (PX_CASA * 0.88), k, {
          tremer: (f) => (this.tremorGolpe = Math.max(this.tremorGolpe, f)),
          lampejo: (tipo, dur) => (this.lampejoAtual = { tipo, t: 0, dur }),
          focar: (pts, z) => this.focar(pts, z),
          congelar: (dur) => (this.congelado = Math.max(this.congelado, dur)),
        }, r)
        this.efeitos.push(ef)
        this.cenaFx.add(ef.sprite)
      }),
    deslizar: (p: Personagem, para: THREE.Vector3 | null, dur: number) => {
      const de = p.deslize.clone()
      const alvo = para ? para.clone().setY(0).sub(p.pos.clone().setY(0)) : new THREE.Vector3()
      return this.animarPor(dur, (f) => p.deslize.lerpVectors(de, alvo, f))
    },
    congelarMapa: (dur: number) => this.congelarMapa(dur),
    choqueTela: (ponto: THREE.Vector3) => {
      this.choques.push(new ChoqueTela(ponto.clone()))
    },
    choqueRei: (ponto: THREE.Vector3) => {
      const h = new HakiRei(ponto, 1.4)
      this.hakis.push(h)
      this.cena.add(...h.objetos)
      window.setTimeout(() => h.desligar(), 1100 / this.velocidade)
    },
    avisar: () => {
      this.retratoBatalha = this.batalha?.retrato() ?? null
      const id = this.retratoBatalha?.selecionado?.id
      this.selecionado = id ? (this.personagens.find((p) => p.id === id) ?? null) : null
    },
  }

  /**
   * Ice Age: o tabuleiro inteiro vira gelo (camada azul com rachaduras que
   * aparece, fica e derrete).
   */
  private congelarMapa(dur: number) {
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = 512
    const g = cv.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 1024, 512)
    gr.addColorStop(0, 'rgba(200,240,255,0.85)')
    gr.addColorStop(0.5, 'rgba(150,215,255,0.8)')
    gr.addColorStop(1, 'rgba(210,245,255,0.85)')
    g.fillStyle = gr
    g.fillRect(0, 0, 1024, 512)
    // rachaduras e brilhos
    g.strokeStyle = 'rgba(255,255,255,0.9)'
    for (let i = 0; i < 60; i++) {
      let x = Math.random() * 1024
      let y = Math.random() * 512
      g.lineWidth = 1 + Math.random() * 2
      g.beginPath()
      g.moveTo(x, y)
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 90
        y += (Math.random() - 0.5) * 60
        g.lineTo(x, y)
      }
      g.stroke()
    }
    g.fillStyle = 'rgba(40,120,200,0.25)'
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 1024, Math.random() * 512, 30 + Math.random() * 80, 3)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const a = centroCasa(0, 0)
    const b = centroCasa(LINHAS - 1, COLUNAS - 1)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.abs(b.x - a.x) + 1.4, Math.abs(b.z - a.z) + 1.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }),
    )
    m.rotation.x = -Math.PI / 2
    m.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2)
    m.renderOrder = 1
    this.cena.add(m)
    void this.animarPor(dur, (f) => {
      ;(m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, f * 6) * (1 - entre01(f, 0.75, 1))
      if (f >= 1) {
        this.cena.remove(m)
        tex.dispose()
        ;(m.material as THREE.Material).dispose()
        m.geometry.dispose()
      }
    })
  }

  /** partículas das formas (vapor do Gear Second, poeira da Zoan, brilho da luz) */
  private tForma = 0
  /** próximo raio de Haki de cada personagem com Haki ligado (s) */
  private readonly proxRaio = new Map<Personagem, number>()

  /**
   * Haki do Rei imbuído ligado: raios negros e vermelhos saem do corpo de
   * tempos em tempos (aleatório). O armamento só deixa a arma negra.
   */
  private atualizarHakiLigado(dt: number) {
    for (const p of this.personagens) {
      if (p.haki !== 'rei' || p.ocupado) continue
      const t = (this.proxRaio.get(p) ?? Math.random() * 0.8) - dt
      if (t > 0) {
        this.proxRaio.set(p, t)
        continue
      }
      this.proxRaio.set(p, 0.5 + Math.random() * 1.3)
      const pt = p.pos.clone().setY(p.visual.altura * (0.25 + Math.random() * 0.7)).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0, (Math.random() - 0.5) * 0.3))
      void this.palco.efeito('faisca', 'rei', pt, { dur: 0.22 + Math.random() * 0.15, escala: 0.5 + Math.random() * 0.35 })
      // às vezes um estalo maior, com a câmera tremendo de leve
      if (Math.random() < 0.1) {
        void this.palco.efeito('faisca', 'rei', p.pos.clone().setY(p.visual.altura * 0.5), { dur: 0.3, escala: 1.1 })
        this.tremorGolpe = Math.max(this.tremorGolpe, 0.06)
      }
    }
  }

  private atualizarFormas(dt: number) {
    this.atualizarHakiLigado(dt)
    this.tForma += dt
    const soltar = this.tForma > 0.2
    if (soltar) this.tForma = 0
    for (const p of this.personagens) {
      if (p.forma === 'zoan') {
        p.escala = 1.3
        p.tinta = TINTA.zoan
        if (soltar && Math.random() < 0.35) void this.palco.efeito('poeira', 'normal', p.pos.clone().setY(0.25), { dur: 0.7, escala: 0.7 })
      } else if (p.forma === 'gear') {
        p.escala = 1
        p.tinta = TINTA.gear
        if (soltar) void this.palco.efeito('vapor', 'normal', p.pos.clone().setY(p.visual.altura * (0.4 + Math.random() * 0.5)).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, 0)), { dur: 0.8, escala: 0.6 })
      } else if (p.forma === 'sabre') {
        p.escala = 1
        p.tinta = TINTA.sabre
        if (soltar && Math.random() < 0.6) void this.palco.efeito('orbeLuz', 'normal', p.pos.clone().setY(p.visual.altura * (0.3 + Math.random() * 0.6)).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, 0)), { dur: 0.4, escala: 0.25 })
      } else if (p.escala !== 1 || (p.tinta && Object.values(TINTA).includes(p.tinta))) {
        p.escala = 1
        p.tinta = null
      }
    }
  }

  /** câmera de antes do foco (choque de Haki) */
  private lampejoAtual: { tipo: 'rei' | 'branco'; t: number; dur: number } | null = null
  private semFoco: { zoom: number; pan: THREE.Vector3 } | null = null

  /** Aproxima a câmera no meio dos pontos; null volta para onde estava. */
  private focar(pontos: THREE.Vector3[] | null, zoom = 2) {
    if (pontos && !this.semFoco) this.semFoco = { zoom: this.zoomAlvo, pan: this.pan.clone() }
    const volta = this.semFoco
    if (!pontos && !volta) return
    const de = this.pan.clone()
    let para: THREE.Vector3
    if (pontos) {
      const m = pontos.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / pontos.length)
      para = new THREE.Vector3(m.x, 0, m.z - 0.3)
      this.zoomAlvo = zoom
    } else {
      para = volta!.pan
      this.zoomAlvo = volta!.zoom
      this.semFoco = null
    }
    this.zoomAncora = undefined
    void this.animarPor(0.45, (f) => {
      const k = 1 - (1 - f) ** 2
      this.pan.lerpVectors(de, para, k)
      this.enquadrar()
    })
  }

  private animarPor(dur: number, passo: (f: number) => void) {
    return new Promise<void>((fim) => this.tweens.push({ t: 0, dur, passo, fim }))
  }

  /**
   * Esquiva da observação: sai de lado num passo rápido, deixando uma
   * imagem azulada no lugar (o golpe passa por ela), e volta.
   */
  private async esquivar(p: Personagem, de: Personagem) {
    const sprite = p.visual.objetos.find((o) => (o as THREE.Sprite).isSprite) as THREE.Sprite | undefined
    // de lado em relação a quem ataca
    const ida = new THREE.Vector3(p.pos.x - de.pos.x, 0, p.pos.z - de.pos.z).normalize()
    const lado = new THREE.Vector3(-ida.z, 0, ida.x).multiplyScalar(0.55)
    if (sprite) {
      const m = sprite.material
      const fantasma = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: m.map!.clone(), color: 0x9fe0ff, transparent: true, opacity: 0.7, depthWrite: false }),
      )
      fantasma.material.map!.needsUpdate = true
      fantasma.position.copy(sprite.position)
      fantasma.scale.copy(sprite.scale)
      fantasma.center.copy(sprite.center)
      fantasma.renderOrder = 1
      this.cena.add(fantasma)
      void this.animarPor(0.6, (f) => {
        fantasma.material.opacity = 0.7 * (1 - f)
        if (f >= 1) {
          this.cena.remove(fantasma)
          fantasma.material.map!.dispose()
          fantasma.material.dispose()
        }
      })
    }
    void this.palco.efeito('corte', 'normal', this.palco.peito(p), { dur: 0.25, escala: 0.9 })
    await this.animarPor(0.18, (f) => p.deslize.copy(lado).multiplyScalar(Math.sin((f * Math.PI) / 2)))
    await this.animarPor(0.25, () => undefined)
    await this.animarPor(0.2, (f) => p.deslize.copy(lado).multiplyScalar(1 - f))
    p.deslize.set(0, 0, 0)
  }

  /**
   * Logia: o golpe atravessa — o corpo vira o elemento (cor e pisca), solta
   * partículas pelo buraco e se refaz.
   */
  private async atravessar(p: Personagem, elemento: string) {
    const cor = { fumaca: 0xe8ecf2, fogo: 0xffa040, luz: 0xfff27a, gelo: 0x9fe8ff }[elemento] ?? 0xe8ecf2
    const tipo: TipoEfeito = (['fumaca', 'fogo', 'luz', 'gelo'].includes(elemento) ? elemento : 'fumaca') as TipoEfeito
    const peito = this.palco.peito(p)
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.3) * 0.8, (Math.random() - 0.5) * 0.4)
      window.setTimeout(() => void this.palco.efeito(tipo, 'normal', peito.clone().add(d), { dur: 0.55, escala: 0.8 + Math.random() * 0.5 }), i * 90)
    }
    const tinta = new THREE.Color(cor).multiplyScalar(1.6)
    await this.animarPor(0.9, (f) => {
      p.tinta = tinta
      // pisca (corpo desfeito) no meio, se refaz no fim
      p.oculto = f > 0.15 && f < 0.7 && Math.floor(f * 30) % 2 === 0
    })
    p.tinta = null
    p.oculto = false
  }

  /** Botões do HUD da batalha. */
  get controle() {
    return this.batalha
  }

  destruir() {
    this.batalha?.destruir()
    cancelAnimationFrame(this.quadro)
    window.removeEventListener('resize', this.redimensionar)
    window.removeEventListener('keydown', this.aoTecla)
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.rendererFx.dispose()
    this.rendererFx.domElement.remove()
  }

  // ------------------------------------------------------------ estado p/ React
  inscrever = (f: () => void) => {
    this.ouvintes.add(f)
    return () => this.ouvintes.delete(f)
  }
  retrato = () => this.estado

  /**
   * Haki do Rei do personagem selecionado (ou do almirante): explosão de
   * raios e ondas de choque; quem estiver até 4 casas cambaleia.
   */
  hakiDoRei() {
    const p = this.selecionado ?? this.personagens.find((x) => x.id === 'marinha-almirante') ?? this.personagens[0]
    if (!p) return
    // liga/desliga: se já está soltando Haki, desliga
    const ligado = this.hakis.find((h) => h.dono === p && h.ligado)
    if (ligado) {
      ligado.desligar()
      return
    }
    const h = new HakiRei(p.pos, p.visual.altura)
    h.dono = p
    this.hakis.push(h)
    this.cena.add(...h.objetos)
    window.setTimeout(() => {
      for (const o of this.personagens) {
        if (o === p || o.pos.distanceTo(p.pos) > 4.5) continue
        o.sofrer(0, p)
        const s = this.naTela(o.topo(-0.35))
        this.flutuantes = [...this.flutuantes, { id: ++this.idFlut, texto: 'Intimidado!', x: s.x, y: s.y, t: 0, cor: '#ff5a6e' }]
      }
    }, 250)
  }

  /**
   * Haki de armamento (Busoshoku) do selecionado (ou do almirante): liga e
   * desliga. Ligado, a espada fica negra e o golpe estala raios vermelhos.
   */
  hakiArmamento() {
    const p = this.selecionado ?? this.personagens.find((x) => x.id === 'marinha-almirante') ?? this.personagens[0]
    if (!p) return
    p.haki = p.haki ? false : 'armamento'
    const s = this.acimaDe(p, 1.25)
    this.flutuantes = [
      ...this.flutuantes,
      { id: ++this.idFlut, texto: p.haki ? 'Busoshoku!' : 'Haki desligado', x: s.x, y: s.y, t: 0, cor: p.haki ? '#b36bff' : '#c9c9c9' },
    ]
  }

  /** Teste: madeira do convés arrebentando numa casa (sem o Haki). */
  quebrarConves(l: number, c: number) {
    const p = centroCasa(l, c)
    const im = new ImpactoHaki(new THREE.Vector3(p.x, 0, p.z), 1.3)
    this.cena.add(...im.objetos)
    const passo = () => {
      im.atualizar(1 / 60 * this.velocidade)
      if (im.vivo) requestAnimationFrame(passo)
      else {
        this.cena.remove(...im.objetos)
        im.descartar()
      }
    }
    requestAnimationFrame(passo)
  }

  /** Botões de zoom da tela. */
  zoomPasso(fator: number) {
    this.irParaNivel(fator === 0 ? -99 : fator > 1 ? 1 : -1)
  }

  setVelocidade(v: number) {
    this.velocidade = v
  }

  private montarEstado(): EstadoTela {
    return {
      personagens: this.personagens.map((p) => {
        const s = this.acimaDe(p, 1.1)
        return { id: p.id, nome: p.nome, vida: p.vida, vidaMax: p.vidaMax, x: s.x, y: s.y, selecionado: p === this.selecionado }
      }),
      flutuantes: this.flutuantes,
      hakiArmamento: !!(this.selecionado ?? this.personagens.find((x) => x.id === 'marinha-almirante'))?.haki,
      aura: this.hakis.reduce((m, h) => Math.max(m, h.forca()), 0),
      lampejo: this.lampejoAtual
        ? { tipo: this.lampejoAtual.tipo, forca: 1 - this.lampejoAtual.t / this.lampejoAtual.dur, fase: Math.floor(this.lampejoAtual.t * 20) % 2 }
        : null,
      velocidade: this.velocidade,
      escala: this.escala,
      dica: this.retratoBatalha?.dica ?? this.dica,
      batalha: this.retratoBatalha,
    }
  }

  /** Posição em pixels CSS de um ponto do mundo, subindo `acimaPx` pixels da cena. */
  /** Ponto na tela (px CSS) a uma fração da altura do sprite acima do pé. */
  private acimaDe(p: Personagem, fracao: number) {
    const s = this.naTela(p.pos)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: s.x, y: s.y - p.visual.alturaPx * fracao * this.zoom * (r.height / this.altura) }
  }

  private naTela(p: THREE.Vector3) {
    const n = p.clone().project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: ((n.x + 1) / 2) * r.width, y: ((1 - n.y) / 2) * r.height }
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
    // um pixel da cena = `escala` pixels do aparelho (sempre inteiro, para a
    // pixel art não deformar); a cena tem pelo menos ~1500×820 pixels
    const cabe = Math.min((r.width * dpr) / 1500, (r.height * dpr) / 820)
    // telas pequenas (celular): a cena fica com ~1500 px e o navegador reduz
    this.escala = cabe >= 1 ? Math.floor(cabe) : cabe
    this.largura = Math.max(320, Math.floor((r.width * dpr) / this.escala))
    this.altura = Math.max(180, Math.floor((r.height * dpr) / this.escala))
    this.renderer.setSize(this.largura, this.altura, false)
    this.rendererFx.setSize(r.width, r.height, false)
    this.tela2d.width = Math.round(r.width * Math.min(2, dpr))
    this.tela2d.height = Math.round(r.height * Math.min(2, dpr))
    this.camera.aspect = this.largura / this.altura
    this.enquadrar()
  }

  /**
   * Câmera isométrica com perspectiva suave: inclinada ~49°, girada um pouco,
   * lente fechada (a casa do fundo quase do tamanho da da frente) e à
   * distância certa para a casa do meio medir PX_CASA pixels de largura —
   * o tamanho para o qual os sprites dos personagens são desenhados.
   */
  private enquadrar() {
    const cam = this.camera
    cam.fov = FOV
    cam.updateProjectionMatrix()
    // quanto mais perto, mais rente: a inclinação desce suavemente com o zoom
    const t = (this.zoom - ZOOM_TUDO) / (ZOOM_MAX - ZOOM_TUDO)
    const inc = THREE.MathUtils.lerp(INCLINACAO, INCLINACAO_PERTO, Math.sqrt(t))
    const dir = new THREE.Vector3(Math.sin(GIRO) * Math.cos(inc), Math.sin(inc), Math.cos(GIRO) * Math.cos(inc))
    const dist = this.altura / (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * PX_CASA * this.zoom)
    // de perto, mira na altura do peito dos personagens
    const alvo = new THREE.Vector3(0, 0.9 * t, 0.3).add(this.pan)
    cam.position.copy(alvo).addScaledVector(dir, dist)
    cam.lookAt(alvo)
    cam.updateMatrixWorld()
    escalaPixel.zoom = this.zoom
  }

  /** Aproxima/afasta mantendo parado o ponto do convés sob (px, py) em pixels CSS. */
  private aplicarZoom(novo: number, px?: number, py?: number) {
    novo = THREE.MathUtils.clamp(novo, ZOOM_TUDO, ZOOM_MAX)
    if (Math.abs(novo - this.zoom) < 1e-4) return
    const antes = px !== undefined && py !== undefined ? this.noConves(px, py) : null
    this.zoom = novo
    this.enquadrar()
    if (antes) {
      const depois = this.noConves(px!, py!)
      if (depois) this.moverCamera(antes.x - depois.x, antes.z - depois.z)
    }
  }

  /** Ponto do convés (y = 0) sob uma posição da tela em pixels CSS. */
  private noConves(px: number, py: number) {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const p = new THREE.Vector3()
    return this.ray.ray.intersectPlane(this.plano, p) ? p : null
  }

  /** Vai para o nível de zoom vizinho (passo +1/-1; -99 = tabuleiro inteiro). */
  private irParaNivel(passo: number, px?: number, py?: number) {
    let i = NIVEIS.findIndex((n) => n >= this.zoomAlvo - 1e-3)
    if (i < 0) i = NIVEIS.length - 1
    i = passo === -99 ? 0 : THREE.MathUtils.clamp(i + passo, 0, NIVEIS.length - 1)
    this.zoomAlvo = NIVEIS[i]
    this.zoomAncora = px !== undefined && py !== undefined ? [px, py] : undefined
  }

  /** Nível mais próximo (ao soltar a pinça). */
  private assentarZoom(px?: number, py?: number) {
    let melhor = NIVEIS[0]
    for (const n of NIVEIS) if (Math.abs(Math.log(n / this.zoom)) < Math.abs(Math.log(melhor / this.zoom))) melhor = n
    this.zoomAlvo = melhor
    this.zoomAncora = px !== undefined && py !== undefined ? [px, py] : undefined
  }

  private aoRolar = (ev: WheelEvent) => {
    ev.preventDefault()
    // um nível por "clique" da roda (touchpads mandam muitos eventos seguidos)
    const agora = performance.now()
    if (agora - this.ultimaRoda < 140 || Math.abs(ev.deltaY) < 2) return
    this.ultimaRoda = agora
    this.irParaNivel(ev.deltaY < 0 ? 1 : -1, ev.clientX, ev.clientY)
  }

  /** Arrasta a câmera (setas/WASD), sem sair de perto do tabuleiro. */
  private moverCamera(dx: number, dz: number) {
    this.pan.x = THREE.MathUtils.clamp(this.pan.x + dx, -COLUNAS / 2, COLUNAS / 2)
    this.pan.z = THREE.MathUtils.clamp(this.pan.z + dz, -METADE - 1, METADE + 1)
    this.enquadrar()
  }

  // ------------------------------------------------------------ laço
  private laco = (agora: number) => {
    this.quadro = requestAnimationFrame(this.laco)
    const dtReal = Math.min(0.05, (agora - this.anterior) / 1000)
    this.anterior = agora
    // hit-stop: tudo que anda pelo tempo do jogo para por um instante
    const parado = this.congelado > 0
    if (parado) this.congelado -= dtReal
    const dt = parado ? 0 : dtReal * this.velocidade
    this.tempo += dt
    this.mar.mat.uniforms.tempo.value = this.tempo
    if (!this.pinca && Math.abs(this.zoomAlvo - this.zoom) > 1e-4) {
      // aproxima suave (em escala log) e encaixa exato no nível
      const k = 1 - Math.exp(-dtReal * 14)
      let z = Math.exp(THREE.MathUtils.lerp(Math.log(this.zoom), Math.log(this.zoomAlvo), k))
      if (Math.abs(Math.log(z / this.zoomAlvo)) < 0.004) z = this.zoomAlvo
      const a = this.zoomAncora
      this.aplicarZoom(z, a?.[0], a?.[1])
    }
    for (const p of this.personagens) p.atualizar(dt)
    this.atualizarFormas(dt)
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
      p.posicionar(this.camera, this.largura, this.altura, this.luzDe(p, dtReal))
      for (const pos of p.poeiras.splice(0)) {
        const po = new Poeira(pos)
        this.poeiras.push(po)
        this.cena.add(po.sprite)
      }
    }
    for (const po of this.poeiras) {
      po.atualizar(dt, this.camera, this.largura, this.altura, ESCALA_ARTE_ANTIGA)
      if (!po.vivo) this.cena.remove(po.sprite)
    }
    this.poeiras = this.poeiras.filter((po) => po.vivo)
    for (const g of this.golpes) {
      g.atualizar(dt, this.camera, this.largura, this.altura)
      if (!g.vivo) {
        this.cena.remove(g.sprite)
        g.descartar()
      }
    }
    this.golpes = this.golpes.filter((g) => g.vivo)
    for (const ef of this.efeitos) {
      // as cenas cinemáticas (Entei) não aceleram no 2×
      ef.atualizar(ef instanceof Entei ? (parado ? 0 : dtReal) : dt)
      if (!ef.vivo) {
        this.cenaFx.remove(ef.sprite)
        ef.descartar()
      }
    }
    this.efeitos = this.efeitos.filter((ef) => ef.vivo)
    for (const tw of this.tweens) {
      tw.t += dt
      tw.passo(Math.min(1, tw.t / tw.dur))
      if (tw.t >= tw.dur) tw.fim()
    }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur)
    this.tremorGolpe = Math.max(0, this.tremorGolpe - dtReal)
    if (this.lampejoAtual && (this.lampejoAtual.t += dtReal) >= this.lampejoAtual.dur) this.lampejoAtual = null
    for (const s of this.sumindo) {
      s.t -= dtReal
      for (const o of s.p.visual.objetos) {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m) {
          m.transparent = true
          m.opacity = Math.max(0, s.t / 0.8)
        }
      }
      if (s.t <= 0) {
        this.cena.remove(...s.p.visual.objetos)
        this.personagens.splice(this.personagens.indexOf(s.p), 1)
      }
    }
    this.sumindo = this.sumindo.filter((s) => s.t > 0)
    this.flutuantes = this.flutuantes.map((f) => ({ ...f, t: f.t + dtReal })).filter((f) => f.t < 1.2)
    for (const h of this.hakis) {
      h.atualizar(dt, this.camera)
      if (!h.vivo) {
        this.cena.remove(...h.objetos)
        h.descartar()
      }
    }
    this.hakis = this.hakis.filter((h) => h.vivo)
    // tremor da câmera durante o Haki
    const tremor = Math.max(this.hakis.reduce((m, h) => Math.max(m, h.forca()), 0), this.tremorGolpe * 2.5)
    const salva = this.camera.position.clone()
    if (tremor > 0) {
      const a = 0.06 * tremor * (1 / this.zoom + 0.3)
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a))
    }
    this.renderer.render(this.cena, this.camera)
    if (this.efeitos.length || this.rendererFx.info.render.calls) this.rendererFx.render(this.cenaFx, this.camera)
    this.camera.position.copy(salva)
    // choques de Haki do Rei na tela
    if (this.choques.length || this.tela2dSuja) {
      const g = this.tela2d.getContext('2d')!
      g.clearRect(0, 0, this.tela2d.width, this.tela2d.height)
      const k = this.tela2d.width / Math.max(1, this.renderer.domElement.getBoundingClientRect().width)
      for (const ch of this.choques) {
        const p = this.naTela(new THREE.Vector3(ch.ponto.x, ch.ponto.y, ch.ponto.z))
        ch.desenhar(g, dt, { x: p.x * k, y: p.y * k }, this.tela2d.width, this.tela2d.height)
      }
      this.choques = this.choques.filter((ch) => ch.vivo)
      this.tela2dSuja = this.choques.length > 0
    }
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

  /** Sombra da cena (raios até o sol) e luz das lanternas próximas, suavizadas. */
  private luzDe(p: Personagem, dt: number): LuzPersonagem {
    let luz = this.luzes.get(p)
    if (!luz) {
      luz = { sombra: 0, quente: new THREE.Color(0, 0, 0) }
      this.luzes.set(p, luz)
    }
    // pés, cintura e cabeça: fração dos três que está coberta
    let cobertos = 0
    for (const h of [0.25, 0.9, 1.6]) {
      this.raioSol.set(p.pos.clone().setY(p.pos.y + h), this.dirSol)
      this.raioSol.far = 40
      if (this.raioSol.intersectObject(this.navios.grupo, true).length) cobertos++
    }
    luz.sombra = THREE.MathUtils.lerp(luz.sombra, cobertos / 3, 1 - Math.exp(-dt * 10))
    const q = new THREE.Color(0, 0, 0)
    const pos = new THREE.Vector3()
    for (const l of this.navios.luzes) {
      l.getWorldPosition(pos)
      const d = pos.distanceTo(p.pos.clone().setY(p.pos.y + 1))
      const k = Math.max(0, 1 - d / 3.5) ** 2 * l.intensity * 0.09
      if (k > 0) q.add(l.color.clone().multiplyScalar(k))
    }
    luz.quente.copy(q)
    return luz
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
    const topo = y - p.visual.alturaPx * this.zoom
    const meia = (y - topo) * 0.28
    return { x0: x - meia, x1: x + meia, y0: topo, y1: y + 2 }
  }

  private arrasto: { x: number; y: number; moveu: boolean } | null = null

  private aoApertar = (ev: PointerEvent) => {
    this.toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    this.renderer.domElement.setPointerCapture(ev.pointerId)
    if (this.toques.size === 2) {
      // dois dedos: pinça de zoom (cancela o toque/arrasto)
      const [a, b] = [...this.toques.values()]
      this.pinca = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom }
      if (this.arrasto) this.arrasto.moveu = true
      return
    }
    if (ev.button !== 0) return
    this.arrasto = { x: ev.clientX, y: ev.clientY, moveu: false }
  }

  private aoSoltar = (ev: PointerEvent) => {
    this.toques.delete(ev.pointerId)
    if (this.toques.size < 2 && this.pinca) {
      this.pinca = null
      this.assentarZoom(...(this.pincaCentro ?? []))
    }
    const a = this.arrasto
    if (this.toques.size > 0) return
    this.arrasto = null
    if (a && !a.moveu && ev.type === 'pointerup') this.aoClicar(ev)
  }

  private aoMover = (ev: PointerEvent) => {
    if (this.toques.has(ev.pointerId)) this.toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (this.pinca && this.toques.size === 2) {
      const [p1, p2] = [...this.toques.values()]
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      this.aplicarZoom(this.pinca.zoom * (d / Math.max(1, this.pinca.dist)), (p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
      this.zoomAlvo = this.zoom
      this.pincaCentro = [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2]
      return
    }
    const a = this.arrasto
    if (a) {
      const dx = ev.clientX - a.x
      const dy = ev.clientY - a.y
      if (!a.moveu && Math.hypot(dx, dy) > 8) a.moveu = true
      if (a.moveu) {
        // pixels da tela → casas: a casa do meio mede PX_CASA pixels da cena
        const r = this.renderer.domElement.getBoundingClientRect()
        const k = this.largura / r.width / (PX_CASA * this.zoom)
        this.moverCamera(-dx * k, -dy * k * (64 / 48))
        a.x = ev.clientX
        a.y = ev.clientY
      }
      return
    }
    const alvo = this.pegar(ev)
    this.batalha?.sobre(alvo?.casa ?? null)
    if (!alvo) {
      this.hover.visible = false
      this.renderer.domElement.style.cursor = 'default'
      return
    }
    const c = centroCasa(alvo.casa.l, alvo.casa.c)
    this.hover.position.set(c.x, 0.004, c.z)
    this.hover.visible = true
    this.renderer.domElement.style.cursor = alvo.personagem ? 'pointer' : 'default'
  }

  private aoDireito = (ev: Event) => {
    ev.preventDefault()
    this.batalha?.selecionar(null)
  }

  private aoTecla = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') this.batalha?.selecionar(null)
    const passo = (0.6 * ZOOM_TUDO) / this.zoom
    const k = ev.key.toLowerCase()
    if (k === 'arrowleft' || k === 'a') this.moverCamera(-passo, 0)
    if (k === 'arrowright' || k === 'd') this.moverCamera(passo, 0)
    if (k === 'arrowup' || k === 'w') this.moverCamera(0, -passo)
    if (k === 'arrowdown' || k === 's') this.moverCamera(0, passo)
    if (k === '+' || k === '=') this.irParaNivel(1)
    if (k === '-') this.irParaNivel(-1)
    if (k === '0') this.irParaNivel(-99)
    // Haki do Rei (H) e de armamento (B) desligados por enquanto
  }

  private aoClicar = (ev: PointerEvent) => {
    if (ev.button !== 0) return
    this.batalha?.clique(this.pegar(ev))
  }

  private marcar(c: Casa, mat: THREE.Material) {
    const m = new THREE.Mesh(this.geoCasa, mat)
    // de baixo para cima: alcance, movimento, alvo/cura, área
    m.renderOrder = mat === this.matMira ? 0.1 : mat === this.matAlcance ? 0.2 : mat === this.matArea ? 0.4 : 0.3
    const p = centroCasa(c.l, c.c)
    m.rotation.x = -Math.PI / 2
    m.position.set(p.x, 0.003, p.z)
    this.marcas.add(m)
  }

  private limparMarcas() {
    this.marcas.clear()
  }
}
