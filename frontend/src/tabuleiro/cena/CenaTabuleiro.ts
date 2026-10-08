import * as THREE from 'three'
import { casaEm, centroCasa, mesmaCasa, COLUNAS, METADE, type Casa } from '../tabuleiro'
import { criarMar } from './mar'
import { faixaLinhaDagua, montarNavios } from './navio'
import { Assador } from '../boneco/assador'
import { CAPITAES } from '../boneco/boneco'
import { Personagem } from './personagem'
import { ControleBatalha, type LightKick, type Marca, type RetratoBatalha } from '../batalha/controle'
import { TRIPULACOES } from '../batalha/elenco'
import { VisualSprite } from './visualSprite'
import { VisualFolhas } from './visualFolhas'
import { VisualComForma } from './visualForma'
import { EfeitoEfk, carregarEfk, type DadosEfk } from './efk'

/** altura de quem lança no efeito do Effekseer (unidades do editor): o efeito escala por ela */
const ALTURA_EFK = 5
/** o corte básico (Sword Slash) toca mais rápido que no editor */
const VELOCIDADE_CORTE = 2.5
/** escala do gelo do Ice Time (aplicar e congelado) */
const ESCALA_GELO = 0.5
/** s até o gelo do Ice Time terminar de crescer (aí entram os cristais do congelado) */
const GELO_CRESCER = 1.2
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
/** mais afastado: os dois navios inteiros, de proa a popa */
const ZOOM_MIN = 0.36
const NIVEIS = [ZOOM_MIN, ZOOM_TUDO, 1, 2, 3, 4]
const GIRO = THREE.MathUtils.degToRad(-8)
const FOV = 22


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
  private efeitos: (Efeito | EfeitoFolha | Entei | EfeitoEfk)[] = []
  /**
   * silhuetas invisíveis dos personagens na camada de efeitos: só escrevem
   * profundidade, para o efeito que passa por trás de alguém ficar escondido
   * (o anel e as labaredas do Entei atrás do corpo)
   */
  private readonly silhuetas = new Map<THREE.Sprite, THREE.Sprite>()
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
    this.mar = criarMar(this.navios.contornos, this.dirSol)
    this.cena.add(this.mar.mar)
    for (const n of this.navios.navios) n.add(this.mar.espumaCasco(faixaLinhaDagua()))

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
        return new Personagem(t.id, t.nome, t.casa, c.hpMax, await this.visualCom(t.id, c.akuma?.fruta), t.dir)
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
      // raios, ondas e poeira: o efeito do Effekseer; o chão explodindo (raios
      // que descem e racham o convés): o Haki em código, só nessa parte
      void carregarEfk('haki-rei').then((d) => {
        const h = new HakiRei(p.pos, p.visual.altura, !!d)
        h.dono = p
        this.hakis.push(h)
        this.cena.add(...h.objetos)
        window.setTimeout(() => h.desligar(), 1400 / this.velocidade)
        // o efeito foi feito para um personagem de ~2 unidades de altura
        if (d) this.tocarEfk('haki-rei', d, p.pos.clone().setY(0.02), p.visual.altura / 2)
      })
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
    efeitoFolha: async (nome: string, dir: DirEfeito, de: THREE.Vector3, op: { para?: THREE.Vector3; largura?: number; voo?: [number, number]; aoChegar?: () => void; chao?: boolean; escala?: number; aoQuadro?: [number, () => void] } = {}) => {
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
    /**
     * Entei: o efeito feito no Effekseer (public/sprites/efk/entei); sem ele,
     * a cena em código (cena/entei.ts). Resolve no impacto.
     */
    corte: (p: Personagem, ate: THREE.Vector3) => carregarEfk('corte-ciano').then((d) => (d ? this.corteEfk(p, ate, d) : false)),
    iceTime: (p: Personagem, alvo: Personagem | null, ate: THREE.Vector3) =>
      carregarEfk('ice-time-contato').then((contato) => (contato ? this.iceTimeEfk(p, alvo, ate, contato) : false)),
    partisan: (p: Personagem, ate: THREE.Vector3) =>
      Promise.all([carregarEfk('partisan'), carregarEfk('partisan-formacao'), carregarEfk('partisan-impacto')]).then(([l, f, i]) => (l && f && i ? this.partisanEfk(p, ate, l, f, i) : false)),
    pheasant: (p: Personagem, ate: THREE.Vector3) =>
      Promise.all([carregarEfk('pheasant-beak'), carregarEfk('pheasant-beak-impacto')]).then(([ave, imp]) => (ave && imp ? this.pheasantEfk(p, ate, ave, imp) : false)),
    iceAge: (p: Personagem) =>
      carregarEfk('ice-age').then((d) => {
        if (!d) return false
        // raio de ~10 unidades no editor: ~10 do mundo, cobre boa parte dos dois conveses
        const ef = new EfeitoEfk('ice-age', d, { origem: p.pos.clone().setY(0.02), escala: 1, camera: this.camera })
        this.efeitos.push(ef)
        this.cenaFx.add(ef.sprite)
        return new Promise<boolean>((r) => setTimeout(() => r(true), 800))
      }),
    hiken: (p: Personagem, ate: THREE.Vector3) =>
      Promise.all([carregarEfk('hiken'), carregarEfk('hiken-impacto')]).then(([c, i]) => (c && i ? this.hikenEfk(p, ate, c, i) : false)),
    higan: (p: Personagem, ate: THREE.Vector3) =>
      Promise.all([carregarEfk('higan'), carregarEfk('higan-disparo'), carregarEfk('higan-impacto')]).then(([b, d, i]) => (b && d && i ? this.higanEfk(p, ate, b, d, i) : false)),
    rajadaLuz: (p: Personagem, ate: THREE.Vector3, tiros: number) => this.rajadaLuz(p, ate, tiros),
    laser: (p: Personagem, fim: THREE.Vector3, contatos: THREE.Vector3[]) =>
      Promise.all(['laser-carga', 'laser-continuo', 'laser-disparo', 'laser-contato'].map((n) => carregarEfk(n))).then(([c, l, d, x]) =>
        c && l && d && x ? this.laser(p, fim, contatos, c, l, d, x) : false,
      ),
    yata: (p: Personagem, ate: THREE.Vector3) =>
      Promise.all(['yata-feixe', 'yata-reflexo', 'yata-explosao'].map((n) => carregarEfk(n))).then(([f, r, x]) => (f && r && x ? this.yata(p, ate, f, r, x) : false)),
    lightKick: (p: Personagem) =>
      Promise.all(['light-kick-carga', 'light-kick-rastro', 'light-kick-arco', 'light-kick-impacto'].map((n) => carregarEfk(n))).then(([c, r, a, i]) =>
        c && r && a && i ? this.lightKick(p, c, r, a, i) : null,
      ),
    yasakani: (p: Personagem, pontos: THREE.Vector3[]) =>
      Promise.all(['yasakani-carga', 'yasakani-projetil', 'yasakani-disparo', 'yasakani-impacto'].map((n) => carregarEfk(n))).then(([c, b, d, i]) =>
        c && b && d && i ? this.yasakaniEfk(p, pontos, c, b, d, i) : false,
      ),
    hotarubi: (p: Personagem, ate: THREE.Vector3) =>
      Promise.all([carregarEfk('hotarubi-bolinha'), carregarEfk('hidaruma')]).then(([bol, hid]) => (bol && hid ? this.hotarubiEfk(p, ate, bol, hid) : false)),
    entei: (p: Personagem, ate: THREE.Vector3, k: number) =>
      new Promise<void>((r) => {
        void carregarEfk('entei').then((dados) => {
          if (dados) this.enteiEfk(p, ate, k, dados, r)
          else this.enteiCodigo(p, ate, k, r)
        })
      }),
    deslizar: (p: Personagem, para: THREE.Vector3 | null, dur: number) => {
      const de = p.deslize.clone()
      const alvo = para ? para.clone().setY(0).sub(p.pos.clone().setY(0)) : new THREE.Vector3()
      return this.animarPor(dur, (f) => p.deslize.lerpVectors(de, alvo, f))
    },
    congelar: (p: Personagem) => {
      // o gelo do Ice Time cresce nos pés; os cristais formados (status 'gelo')
      // entram quando ele termina de crescer
      this.geloDesde.set(p, performance.now() + GELO_CRESCER * 1000)
      void carregarEfk('ice-time').then((d) => {
        if (d) this.tocarEfk('ice-time', d, p.pos.clone().setY(0.02), ESCALA_GELO)
      })
    },
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

  /** Entei feito no Effekseer: o corpo de quem lança segue as fases do efeito */
  private enteiEfk(p: Personagem, ate: THREE.Vector3, k: number, dados: DadosEfk, aoImpacto: () => void) {
    let feito = false
    let poseAnt: number | null | undefined
    const ef: EfeitoEfk = new EfeitoEfk('entei', dados, {
      origem: p.pos.clone().setY(0),
      alvo: ate,
      escala: (p.visual.altura / ALTURA_EFK) * Math.sqrt(k),
      camera: this.camera,
      aoQuadro: (q) => {
        // prepara nos anéis, ergue o braço na espiral, mão no alto enquanto a
        // bola cresce, arremessa no lançamento e volta
        const imp = ef.quadroImpacto
        const pose = q < 30 ? 0 : q < 60 ? 1 : q < 90 ? 2 : q < imp - 48 ? 3 : q < imp ? 4 : q < imp + 24 ? 5 : null
        if (pose !== poseAnt) {
          poseAnt = pose
          if (pose === null) p.soltarPose()
          else p.posar('conjurar', pose)
        }
        if (!feito && q >= imp) {
          feito = true
          this.tremorGolpe = Math.max(this.tremorGolpe, 0.6)
          this.lampejoAtual = { tipo: 'branco', t: 0, dur: 0.25 }
          aoImpacto()
        }
      },
    })
    this.efeitos.push(ef)
    this.cenaFx.add(ef.sprite)
  }

  /** efeito do Effekseer tocando num ponto (opcionalmente virado para outro) */
  private tocarEfk(nome: string, dados: DadosEfk, onde: THREE.Vector3, escala: number, alvo?: THREE.Vector3, velocidade = 1) {
    const ef = new EfeitoEfk(nome, dados, { origem: onde.clone(), alvo, escala, camera: this.camera, velocidade })
    ef.sprite.position.copy(onde)
    if (alvo) ef.sprite.lookAt(alvo)
    this.efeitos.push(ef)
    this.cenaFx.add(ef.sprite)
    return ef
  }

  /**
   * Corte básico (Effekseer): o arco (~4 unidades de largura no editor, plano
   * XY) no peito do alvo, virado para a câmera e inclinado na diagonal, como
   * um golpe de cima para baixo.
   */
  private corteEfk(p: Personagem, ate: THREE.Vector3, dados: DadosEfk) {
    // no editor o corte leva 0,6 s; um golpe de espada é bem mais seco (~0,25 s)
    const ef = this.tocarEfk('corte-ciano', dados, ate, 0.3, undefined, VELOCIDADE_CORTE)
    ef.sprite.quaternion.copy(this.camera.quaternion)
    // espelha conforme o lado de onde vem o golpe (na tela)
    const de = p.pos.clone().project(this.camera)
    const para = ate.clone().project(this.camera)
    ef.sprite.rotateZ(para.x < de.x ? 0.5 : -0.5)
    if (para.x < de.x) ef.sprite.scale.x *= -1
    return new Promise<boolean>((r) => setTimeout(() => r(true), 120))
  }

  /**
   * Ice Time (Effekseer): clarão de contato na mão de quem toca. Os cristais
   * crescem no alvo quando ele congela (palco.congelar, evento 'congelou').
   */
  private iceTimeEfk(p: Personagem, alvo: Personagem | null, ate: THREE.Vector3, contato: DadosEfk) {
    const pe = (alvo?.pos ?? ate).clone().setY(0.02)
    const mao = p.pos.clone().lerp(pe, 0.45).setY(p.visual.altura * 0.5)
    this.tocarEfk('ice-time-contato', contato, mao, 0.3)
    return new Promise<boolean>((r) => setTimeout(() => r(true), 450))
  }

  /**
   * estrelinhas na cabeça (atordoado e congelado) e, no congelado, os cristais
   * do Ice Time nos pés; presos ao personagem até a vez dele acabar
   */
  private readonly statusFx = new Map<Personagem, { tipo: 'stun' | 'gelo'; fx: { nome: string; ef: EfeitoEfk | null; carregando: boolean }[] }>()
  /** quando os cristais do congelado entram (ms): depois do gelo crescer */
  private readonly geloDesde = new Map<Personagem, number>()

  private atualizarStatus() {
    const agora = performance.now()
    for (const p of this.personagens) {
      const atual = this.statusFx.get(p)
      if (atual && atual.tipo !== p.status) {
        for (const f of atual.fx) f.ef?.encerrar()
        this.statusFx.delete(p)
      }
      if (!p.status) continue
      let s = this.statusFx.get(p)
      if (!s) {
        const fx = [{ nome: 'stun', ef: null, carregando: false }]
        if (p.status === 'gelo') fx.push({ nome: 'ice-time-congelado', ef: null, carregando: false })
        s = { tipo: p.status, fx }
        this.statusFx.set(p, s)
      }
      for (const f of s.fx) {
        const cabeca = f.nome === 'stun'
        // os efeitos acabam no editor (o congelado dura 10 s): recomeça enquanto durar
        if ((!f.ef || !f.ef.vivo) && !f.carregando && (cabeca || agora >= (this.geloDesde.get(p) ?? 0))) {
          f.carregando = true
          const reg = s
          void carregarEfk(f.nome).then((d) => {
            f.carregando = false
            if (!d || this.statusFx.get(p) !== reg) return
            f.ef = this.tocarEfk(f.nome, d, p.pos, cabeca ? 0.35 : ESCALA_GELO)
            // as estrelinhas não somem atrás da cabeça (a silhueta escondia a
            // bolinha de repente a cada volta e o giro parecia dar um tranco)
            if (cabeca) {
              f.ef.sprite.traverse((o) => {
                if (o instanceof THREE.Mesh) (o.material as THREE.Material).depthTest = false
              })
            }
          })
        }
        if (f.ef) f.ef.sprite.position.copy(cabeca ? p.pos.clone().setY(p.visual.altura * 0.83) : p.pos.clone().setY(0.02))
      }
    }
    for (const [p, s] of this.statusFx) {
      if (!this.personagens.includes(p)) {
        for (const f of s.fx) f.ef?.encerrar()
        this.statusFx.delete(p)
      }
    }
  }

  /**
   * Partisan (efeitos do Effekseer): a formação de cinco lanças (~4,7 de
   * comprimento no editor, ponta em +Z) surge em arco sobre quem lança,
   * apontada para o alvo; depois some e cada lança é disparada das mesmas
   * posições até o alvo, com estilhaços onde bate.
   */
  private partisanEfk(p: Personagem, ate: THREE.Vector3, lanca: DadosEfk, formacao: DadosEfk, impacto: DadosEfk) {
    const escala = 0.17
    const VELOCIDADE = 14 // mundo/s
    const FORMAR = 650 // ms com a formação parada antes de disparar
    const alto = p.visual.altura * 0.75
    const centro = p.pos.clone().setY(alto)
    const mira = ate.clone().setY(p.visual.altura * 0.5)
    const toca = (dados: DadosEfk, nome: string, onde: THREE.Vector3, esc: number, alvo?: THREE.Vector3) => {
      const ef = new EfeitoEfk(nome, dados, { origem: onde.clone(), alvo, escala: esc, camera: this.camera })
      ef.sprite.position.copy(onde)
      if (alvo) ef.sprite.lookAt(alvo)
      this.efeitos.push(ef)
      this.cenaFx.add(ef.sprite)
      return ef
    }
    p.posar('empurrar', 2)
    const form = toca(formacao, 'partisan-formacao', centro, escala, mira)
    // posições das lanças na formação (do LEIA-ME), no espaço do efeito
    const locais: [number, number, number][] = [[-2.2, 0, -0.4], [-1.1, 0.65, 0], [0, 0.95, 0.35], [1.1, 0.65, 0], [2.2, 0, -0.4]]
    return new Promise<boolean>((r) => {
      setTimeout(() => {
        form.sprite.updateMatrixWorld()
        const pontos = locais.map((l) => new THREE.Vector3(...l).applyMatrix4(form.sprite.matrixWorld))
        form.encerrar()
        p.posar('empurrar', 3)
        let acertos = 0
        pontos.forEach((de, i) => {
          setTimeout(() => {
            const alvo = mira.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4))
            const l = toca(lanca, 'partisan', de, escala, alvo)
            void this.animarPor(Math.max(0.12, de.distanceTo(alvo) / VELOCIDADE), (f) => l.sprite.position.lerpVectors(de, alvo, f)).then(() => {
              l.encerrar()
              toca(impacto, 'partisan-impacto', alvo, escala * 1.2)
              if (++acertos === 3) r(true)
            })
          }, i * 70)
        })
      }, FORMAR)
    })
  }

  /**
   * Pheasant Beak (efeitos do Effekseer): a ave de gelo (~8,8 de envergadura
   * no editor, bico em +Z) sai de quem lança e voa até o alvo; lá some e toca
   * a explosão de cristais.
   */
  private pheasantEfk(p: Personagem, ate: THREE.Vector3, ave: DadosEfk, impacto: DadosEfk) {
    const escala = 0.2
    const VELOCIDADE = 7 // mundo/s
    const alto = p.visual.altura * 0.6
    const dir = ate.clone().setY(0).sub(p.pos.clone().setY(0)).normalize()
    const de = p.pos.clone().setY(alto).addScaledVector(dir, 0.4)
    const para = ate.clone().setY(alto)
    const a = new EfeitoEfk('pheasant-beak', ave, { origem: de.clone(), alvo: para, escala, camera: this.camera })
    a.sprite.position.copy(de)
    a.sprite.lookAt(para)
    this.efeitos.push(a)
    this.cenaFx.add(a.sprite)
    return new Promise<boolean>((r) => {
      void this.animarPor(Math.max(0.3, de.distanceTo(para) / VELOCIDADE), (f) => {
        a.sprite.position.lerpVectors(de, para, f)
        a.sprite.position.y += Math.sin(Math.PI * f) * 0.4 // sobe um pouco no meio do voo
      }).then(() => {
        a.encerrar()
        const i = new EfeitoEfk('pheasant-beak-impacto', impacto, { origem: para.clone(), escala: escala * 1.3, camera: this.camera })
        i.sprite.position.copy(para)
        this.efeitos.push(i)
        this.cenaFx.add(i.sprite)
        r(true)
      })
    })
  }

  /**
   * Hiken (efeitos do Effekseer): o corpo de fogo (~11 unidades no editor,
   * eixo +Z) sai do punho e voa até o alvo; lá some e toca o impacto.
   */
  private hikenEfk(p: Personagem, ate: THREE.Vector3, corpo: DadosEfk, impacto: DadosEfk) {
    const escala = 0.16
    const VELOCIDADE = 9 // mundo/s
    const alto = p.visual.altura * 0.55
    const dir = ate.clone().setY(0).sub(p.pos.clone().setY(0)).normalize()
    const de = p.pos.clone().setY(alto).addScaledVector(dir, 0.5)
    const para = ate.clone().setY(alto)
    const toca = (dados: DadosEfk, nome: string, onde: THREE.Vector3, esc: number, alvo?: THREE.Vector3) => {
      const ef = new EfeitoEfk(nome, dados, { origem: onde.clone(), alvo, escala: esc, camera: this.camera })
      ef.sprite.position.copy(onde)
      this.efeitos.push(ef)
      this.cenaFx.add(ef.sprite)
      return ef
    }
    const c = toca(corpo, 'hiken', de, escala, para)
    c.sprite.lookAt(para)
    return new Promise<boolean>((r) => {
      void this.animarPor(Math.max(0.15, de.distanceTo(para) / VELOCIDADE), (f) => c.sprite.position.lerpVectors(de, para, f)).then(() => {
        c.encerrar()
        toca(impacto, 'hiken-impacto', para, escala * 1.4)
        r(true)
      })
    })
  }

  /**
   * Higan (efeitos do Effekseer): rajada de balas pequenas e rápidas saindo
   * do dedo; clarão no dedo a cada tiro e impacto pequeno onde cada bala bate.
   * Resolve true quando metade da rajada acertou.
   */
  private higanEfk(p: Personagem, ate: THREE.Vector3, bala: DadosEfk, disparo: DadosEfk, impacto: DadosEfk) {
    const TIROS = 8
    const INTERVALO = 70 // ms entre tiros
    const VELOCIDADE = 22 // mundo/s
    // a bala tem ~3 unidades no editor: fica com ~0,35 do mundo
    const escala = 0.12
    const dedo = p.pos.clone().setY(p.visual.altura * 0.62)
    const dir = ate.clone().setY(0).sub(p.pos.clone().setY(0)).normalize()
    dedo.addScaledVector(dir, 0.3)
    let acertos = 0
    const toca = (dados: DadosEfk, nome: string, onde: THREE.Vector3, esc: number, alvo?: THREE.Vector3) => {
      const ef = new EfeitoEfk(nome, dados, { origem: onde.clone(), alvo, escala: esc, camera: this.camera })
      ef.sprite.position.copy(onde)
      this.efeitos.push(ef)
      this.cenaFx.add(ef.sprite)
      return ef
    }
    return new Promise<boolean>((r) => {
      for (let i = 0; i < TIROS; i++) {
        setTimeout(() => {
          const alvo = ate.clone().setY(p.visual.altura * (0.35 + Math.random() * 0.4)).add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.35))
          toca(disparo, 'higan-disparo', dedo, escala * 1.5)
          const b = toca(bala, 'higan', dedo, escala, alvo)
          // aponta a bala (+Z) para o alvo, inclusive na altura
          b.sprite.lookAt(alvo)
          const de = dedo.clone()
          void this.animarPor(de.distanceTo(alvo) / VELOCIDADE, (f) => b.sprite.position.lerpVectors(de, alvo, f)).then(() => {
            b.encerrar()
            toca(impacto, 'higan-impacto', alvo, escala * 1.6)
            if (++acertos === Math.ceil(TIROS / 2)) r(true)
          })
        }, i * INTERVALO)
      }
    })
  }

  /** Arma de Luz ligada: espadas de luz (ou cargas nos punhos) de cada personagem */
  private readonly armasLuz = new Map<Personagem, EfeitoEfk[]>()
  private dadosLuz: { espada: DadosEfk | null; carga: DadosEfk | null } | null = null

  /**
   * Arma de Luz (Pika Pika): a espada de luz do Kizaru (Effekseer) presa em
   * cada marca do quadro mostrado agora — a empunhadura na mão, a lâmina no
   * ângulo da pose —, ou a carga de luz do Yasakani nos punhos do lutador.
   */
  private atualizarArmasLuz() {
    if (!this.dadosLuz) {
      this.dadosLuz = { espada: null, carga: null }
      const d = this.dadosLuz
      void carregarEfk('espada-luz').then((x) => (d.espada = x))
      void carregarEfk('yasakani-carga').then((x) => (d.carga = x))
    }
    const giro = new THREE.Quaternion()
    const eixoZ = new THREE.Vector3(0, 0, 1)
    for (const p of this.personagens) {
      const marcas = p.forma === 'sabre' && !p.oculto ? p.visual.pontosLuz?.() : null
      let efs = this.armasLuz.get(p)
      if (!marcas) {
        if (efs) {
          for (const ef of efs) ef.encerrar()
          this.armasLuz.delete(p)
        }
        continue
      }
      const dados = marcas.tipo === 'espada' ? this.dadosLuz.espada : this.dadosLuz.carga
      if (!dados) continue
      if (!efs) this.armasLuz.set(p, (efs = []))
      while (efs.length < marcas.pontos.length) {
        const ef = this.tocarEfk(marcas.tipo === 'espada' ? 'espada-luz' : 'yasakani-carga', dados, p.pos, 0.1)
        // pequena no tabuleiro: o halo do efeito mais forte para a lâmina aparecer
        if (marcas.tipo === 'espada') ef.brilho = 3
        efs.push(ef)
      }
      efs.forEach((ef, i) => {
        const pt = marcas.pontos[i]
        ef.sprite.visible = !!pt
        if (!pt) return
        ef.sprite.position.copy(pt.pos)
        if (marcas.tipo === 'espada') {
          // a lâmina (+Y do efeito, 3,16 de comprimento) no plano da tela, girada como na pose
          ef.sprite.quaternion.copy(this.camera.quaternion).multiply(giro.setFromAxisAngle(eixoZ, THREE.MathUtils.degToRad(-pt.angulo)))
          ef.sprite.scale.setScalar(pt.comprimento / 3.16)
        } else ef.sprite.scale.setScalar(p.visual.altura * 0.035)
      })
    }
    for (const [p, efs] of this.armasLuz) {
      if (!this.personagens.includes(p)) {
        for (const ef of efs) ef.encerrar()
        this.armasLuz.delete(p)
      }
    }
  }

  /**
   * Tiros da Arma de Luz (atirador): rajada de joias de luz do Yasakani até o
   * alvo, com clarão na boca do cano e impacto em cada uma. Resolve quando a
   * última acerta; false sem os efeitos.
   */
  private async rajadaLuz(p: Personagem, ate: THREE.Vector3, tiros: number) {
    const [bola, disparo, impacto] = await Promise.all(['yasakani-projetil', 'yasakani-disparo', 'yasakani-impacto'].map((n) => carregarEfk(n)))
    if (!bola || !disparo || !impacto) return false
    const k = p.visual.altura / 2
    const dir = ate.clone().sub(p.pos).setY(0).normalize()
    const boca = p.pos.clone().setY(p.visual.altura * 0.55).addScaledVector(dir, p.visual.altura * 0.35)
    const n = 5 * tiros
    await Promise.all(
      Array.from({ length: n }, (_, i) => new Promise<void>((r) => setTimeout(() => {
        const alvo = ate.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4))
        this.tocarEfk('yasakani-disparo', disparo, boca, k * 0.3)
        const b = this.tocarEfk('yasakani-projetil', bola, boca, k * 0.3, alvo)
        const de = boca.clone()
        void this.animarPor(de.distanceTo(alvo) / 16, (f) => b.sprite.position.lerpVectors(de, alvo, f)).then(() => {
          b.encerrar()
          this.tocarEfk('yasakani-impacto', impacto, alvo, k * 0.35)
          r()
        })
      }, i * 60))),
    )
    return true
  }

  /**
   * Laser de Luz (efeitos do Effekseer, feitos para um personagem de ~2
   * unidades): a carga fica na ponta do dedo por 0,9 s; no disparo, clarão no
   * dedo e o laser contínuo (+Z, 8 de comprimento no editor) esticado até o
   * fim da linha, com o brilho de contato em cada alvo atingido. O laser fica
   * aceso ~1 s e apaga.
   */
  private laser(p: Personagem, fim: THREE.Vector3, contatos: THREE.Vector3[], carga: DadosEfk, laser: DadosEfk, disparo: DadosEfk, contato: DadosEfk) {
    const k = p.visual.altura / 2
    const dir = fim.clone().sub(p.pos).setY(0).normalize()
    const dedo = p.pos.clone().setY(p.visual.altura * 0.6).addScaledVector(dir, p.visual.altura * 0.3)
    const c = this.tocarEfk('laser-carga', carga, dedo, k * 0.45)
    return new Promise<boolean>((r) => {
      setTimeout(() => {
        c.encerrar()
        this.tocarEfk('laser-disparo', disparo, dedo, k * 0.5)
        const l = this.tocarEfk('laser-continuo', laser, dedo, 1)
        l.sprite.lookAt(fim)
        const larg = k * 0.45
        l.sprite.scale.set(larg, larg, dedo.distanceTo(fim) / 8)
        const brilhos = contatos.map((pt) => {
          const ef = this.tocarEfk('laser-contato', contato, pt, k * 0.45)
          ef.sprite.lookAt(pt.clone().add(pt.clone().sub(dedo)))
          return ef
        })
        r(true)
        setTimeout(() => {
          l.encerrar()
          for (const b of brilhos) b.encerrar()
        }, 1000)
      }, 900)
    })
  }

  /**
   * Yata no Kagami (peças do Effekseer, como o yata-controlador.js do pacote):
   * seis pontos — a mão de quem lança, quatro reflexões em zigue-zague acima
   * do alvo (no plano da tela, alturas do efeito para um personagem de ~2
   * unidades) e o impacto no chão. Cada trecho de feixe cresce de um ponto ao
   * outro (quadros 10–22, 22–34, 34–46, 46–58 e o mergulho 66–72), com um
   * clarão em cada reflexão e a explosão no quadro 72. Quem lança fica amarelo
   * e some enquanto é raio; volta quando a explosão se apaga.
   */
  private yata(p: Personagem, ate: THREE.Vector3, feixe: DadosEfk, reflexo: DadosEfk, explosao: DadosEfk) {
    const k = p.visual.altura / 2
    const lado = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize()
    const acima = (x: number, y: number) => ate.clone().addScaledVector(lado, x * k).setY(ate.y + y * k)
    const pontos = [p.pos.clone().setY(p.visual.altura * 0.6), acima(2.1, 2.15), acima(-2.15, 3.65), acima(2.05, 5.15), acima(0, 6.65), ate.clone()]
    const trechos: [number, number][] = [[10, 22], [22, 34], [34, 46], [46, 58], [66, 72]]
    const ms = (q: number) => (q / 60) * 1000
    // vira luz: amarelo forte, e some quando o raio sai
    p.tinta = new THREE.Color(2.4, 2.1, 0.9)
    setTimeout(() => (p.oculto = true), ms(10))
    this.tocarEfk('yata-reflexo', reflexo, pontos[0], k)
    trechos.forEach(([ini, fim], i) => {
      setTimeout(() => {
        const a = pontos[i]
        const b = pontos[i + 1]
        const dist = a.distanceTo(b)
        const larg = k * (i === 4 ? 1.5 : 1)
        const ef = this.tocarEfk('yata-feixe', feixe, a, 1)
        ef.sprite.lookAt(b)
        ef.sprite.scale.set(larg, larg, 0.001)
        void this.animarPor((fim - ini) / 60, (f) => ef.sprite.scale.setZ(Math.max(0.001, dist * f)))
        setTimeout(() => ef.encerrar(), ms((i < 4 ? 72 : 80) - ini))
      }, ms(ini))
    })
    ;[22, 34, 46, 58].forEach((q, i) => setTimeout(() => this.tocarEfk('yata-reflexo', reflexo, pontos[i + 1], k), ms(q)))
    return new Promise<boolean>((r) => {
      setTimeout(() => {
        this.tocarEfk('yata-explosao', explosao, ate, k)
        r(true)
      }, ms(72))
      // volta ao normal quando a explosão se apaga
      setTimeout(() => {
        p.oculto = false
        p.tinta = null
      }, ms(130))
    })
  }

  /** efeitos presos a um ponto que anda (o pé no Light Kick): reposicionados a cada quadro */
  private presos: { ef: EfeitoEfk; onde: () => THREE.Vector3 }[] = []

  /**
   * Light Kick (efeitos do Effekseer, feitos para um personagem de ~2
   * unidades): a carga fica no pé (dobrado no começo, esticado no chute), o
   * rastro (+Z para onde vai) acompanha o corpo no avanço, o arco sai no
   * centro da varredura virado para o alvo e o clarão no ponto do contato.
   */
  private lightKick(p: Personagem, carga: DadosEfk, rastro: DadosEfk, arco: DadosEfk, impacto: DadosEfk): LightKick {
    const k = p.visual.altura / 2
    const h = p.visual.altura
    let frente = new THREE.Vector3(0, 0, 1)
    let esticado = false
    const pe = () => p.pos.clone().addScaledVector(frente, h * (esticado ? 0.42 : 0.12)).setY(h * (esticado ? 0.45 : 0.3))
    const prender = (ef: EfeitoEfk, onde: () => THREE.Vector3) => {
      ef.sprite.position.copy(onde())
      this.presos.push({ ef, onde })
      return ef
    }
    const luz = prender(this.tocarEfk('light-kick-carga', carga, pe(), k * 0.55), pe)
    let r: EfeitoEfk | null = null
    return {
      avancar: (para) => {
        r?.encerrar()
        const dir = para.clone().sub(p.pos).setY(0)
        if (dir.lengthSq() < 1e-6) return
        frente = dir.normalize()
        const corpo = () => p.pos.clone().setY(h * 0.45)
        r = prender(this.tocarEfk('light-kick-rastro', rastro, corpo(), k * 0.6), corpo)
        r.sprite.lookAt(corpo().add(frente))
      },
      parar: () => {
        r?.encerrar()
        r = null
      },
      arco: (alvo) => {
        esticado = true
        const centro = p.pos.clone().setY(h * 0.55)
        const a = this.tocarEfk('light-kick-arco', arco, centro, k * 0.7)
        a.sprite.lookAt(alvo.clone().setY(centro.y))
      },
      impacto: (onde) => {
        this.tocarEfk('light-kick-impacto', impacto, onde, k * 0.6)
      },
      apagar: () => luz.encerrar(),
    }
  }

  /**
   * Yasakani no Magatama (efeitos do Effekseer, feitos para um personagem de
   * ~2 unidades): com os braços cruzados, a luz carrega em cada mão (~0,6 s);
   * depois as mãos se alternam disparando bolas de luz (+Z para o alvo) até
   * pontos sorteados na área, com clarão na palma e impacto onde cai.
   * Resolve true quando metade acertou.
   */
  private yasakaniEfk(p: Personagem, pontos: THREE.Vector3[], carga: DadosEfk, bola: DadosEfk, disparo: DadosEfk, impacto: DadosEfk) {
    const TIROS = 24
    const INTERVALO = 55 // ms entre tiros (as mãos se alternam)
    const CARGA = 600 // ms carregando antes da rajada
    const VELOCIDADE = 14 // mundo/s
    const k = p.visual.altura / 2
    const centro = pontos.reduce((m, c) => m.add(c), new THREE.Vector3()).multiplyScalar(1 / pontos.length)
    // mãos cruzadas na frente do peito: de frente/costas ficam nos ombros (bem
    // separadas na tela); de lado, quase juntas, um pouco à frente do corpo
    const frente = centro.clone().sub(p.pos).setY(0).normalize()
    const olhar = new THREE.Vector3()
    this.camera.getWorldDirection(olhar)
    olhar.setY(0).normalize()
    const lado = new THREE.Vector3(0, 1, 0).cross(olhar).normalize().negate()
    const abre = p.visual.altura * (0.05 + 0.11 * Math.abs(frente.dot(olhar)))
    const peito = p.pos.clone().setY(p.visual.altura * 0.62).addScaledVector(frente, p.visual.altura * 0.08)
    const maos = [peito.clone().addScaledVector(lado, -abre), peito.clone().addScaledVector(lado, abre)]
    const cargas = maos.map((m) => this.tocarEfk('yasakani-carga', carga, m, k * 0.35))
    let acertos = 0
    return new Promise<boolean>((r) => {
      for (let i = 0; i < TIROS; i++) {
        setTimeout(() => {
          const mao = maos[i % 2]
          const pt = pontos[Math.floor(Math.random() * pontos.length)]
          const alvo = pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.15 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8))
          this.tocarEfk('yasakani-disparo', disparo, mao, k * 0.4)
          const b = this.tocarEfk('yasakani-projetil', bola, mao, k * 0.4, alvo)
          const de = mao.clone()
          void this.animarPor(de.distanceTo(alvo) / VELOCIDADE, (f) => b.sprite.position.lerpVectors(de, alvo, f)).then(() => {
            b.encerrar()
            this.tocarEfk('yasakani-impacto', impacto, alvo, k * 0.45)
            if (++acertos === Math.ceil(TIROS / 2)) r(true)
            if (acertos === TIROS) for (const c of cargas) c.encerrar()
          })
        }, CARGA + i * INTERVALO)
      }
    })
  }

  /**
   * Hotarubi (efeitos do Effekseer): bolinhas verdes saem da mão de quem lança
   * e voam até o alvo; lá o Hidaruma deixa 38 bolinhas pairando em volta e
   * detona no quadro 150. Resolve true na detonação.
   */
  private hotarubiEfk(p: Personagem, ate: THREE.Vector3, bol: DadosEfk, hid: DadosEfk) {
    const escala = p.visual.altura / ALTURA_EFK
    const mao = p.pos.clone().setY(p.visual.altura * 0.6)
    const voo = 0.75
    const n = 12
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const ef = new EfeitoEfk('hotarubi-bolinha', bol, { origem: mao.clone(), escala: escala * (0.7 + Math.random() * 0.5), camera: this.camera })
        ef.sprite.position.copy(mao).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, 0))
        const de = ef.sprite.position.clone()
        const para = ate.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2))
        // arco suave até perto do alvo; no fim some (o Hidaruma assume)
        const alto = 0.4 + Math.random() * 0.6
        void this.animarPor(voo * (0.85 + Math.random() * 0.3), (f) => {
          const k = 1 - (1 - f) ** 2
          ef.sprite.position.lerpVectors(de, para, k)
          ef.sprite.position.y += Math.sin(Math.PI * k) * alto
        }).then(() => ef.encerrar())
        this.efeitos.push(ef)
        this.cenaFx.add(ef.sprite)
      }, i * 50)
    }
    return new Promise<boolean>((r) => {
      setTimeout(() => {
        let feito = false
        const ef = new EfeitoEfk('hidaruma', hid, {
          origem: ate.clone(),
          escala,
          camera: this.camera,
          aoQuadro: (q) => {
            if (!feito && q >= 150) {
              feito = true
              r(true)
            }
          },
        })
        this.efeitos.push(ef)
        this.cenaFx.add(ef.sprite)
      }, voo * 1000 * 0.8)
    })
  }

  /** Entei em código (fases em cena/entei.ts) */
  private enteiCodigo(p: Personagem, ate: THREE.Vector3, k: number, aoImpacto: () => void) {
    const ef = new Entei(p.pos, ate, p.visual.alturaPx / (PX_CASA * 0.88), k, {
      tremer: (f) => (this.tremorGolpe = Math.max(this.tremorGolpe, f)),
      lampejo: (tipo, dur) => (this.lampejoAtual = { tipo, t: 0, dur }),
      focar: (pts, z) => this.focar(pts, z),
      congelar: (dur) => (this.congelado = Math.max(this.congelado, dur)),
      pose: (q) => (q === null ? p.soltarPose() : p.posar('conjurar', q)),
    }, aoImpacto)
    this.efeitos.push(ef)
    this.cenaFx.add(ef.sprite)
  }

  /** visual do personagem, com o corpo transformado da Arma de Luz (no Corpo de Chamas o corpo é o mesmo, pegando fogo) */
  private async visualCom(id: string, fruta?: string) {
    const base = await VisualFolhas.carregar(id)
    const formas: Record<string, VisualFolhas> = {}
    // a fruta pode mudar na preparação: todos já carregam as duas formas
    void fruta
    for (const [forma, folha] of [['sabre', `${id}-luz`]] as const) {
      try {
        formas[forma] = await VisualFolhas.carregar(folha)
      } catch {
        /* sem a folha: transforma só com a cor */
      }
    }
    return Object.keys(formas).length ? new VisualComForma(base, formas) : base
  }

  /**
   * Corpo de Chamas: o fogo que envolve o alvo no Hidaruma, gerando sem parar
   * nos pés do personagem enquanto a skill durar; no fim, as chamas que já
   * nasceram terminam e o fogo apaga
   */
  private readonly emChamas = new Map<Personagem, EfeitoEfk | null>()

  private atualizarEmChamas() {
    for (const p of this.personagens) {
      const ef = this.emChamas.get(p)
      if (p.forma === 'agni') {
        if (ef === undefined) {
          this.emChamas.set(p, null)
          void carregarEfk('em-chamas').then((d) => {
            if (!d || this.emChamas.get(p) !== null) return
            if (p.forma !== 'agni') return void this.emChamas.delete(p)
            this.emChamas.set(p, this.tocarEfk('em-chamas', d, p.pos.clone().setY(0.02), p.visual.altura / ALTURA_EFK))
          })
        }
      } else if (ef !== undefined) {
        ef?.soltar()
        this.emChamas.delete(p)
      }
    }
    for (const [p, ef] of this.emChamas) {
      if (!this.personagens.includes(p)) {
        ef?.soltar()
        this.emChamas.delete(p)
      } else if (ef) ef.sprite.position.copy(p.pos).setY(0.02)
    }
  }

  private atualizarFormas(dt: number) {
    this.atualizarHakiLigado(dt)
    this.atualizarEmChamas()
    this.tForma += dt
    const soltar = this.tForma > 0.2
    if (soltar) this.tForma = 0
    for (const p of this.personagens) {
      if (p.visual instanceof VisualComForma) p.visual.forma = p.forma
      if (p.forma === 'lobo') {
        p.escala = 1
        p.tinta = null
        if (soltar && Math.random() < 0.25) void this.palco.efeito('poeira', 'normal', p.pos.clone().setY(0.25), { dur: 0.7, escala: 0.7 })
      } else if (p.forma === 'agni') {
        p.escala = 1
        p.tinta = null
      } else if (p.forma === 'zoan') {
        p.escala = 1.3
        p.tinta = TINTA.zoan
        if (soltar && Math.random() < 0.35) void this.palco.efeito('poeira', 'normal', p.pos.clone().setY(0.25), { dur: 0.7, escala: 0.7 })
      } else if (p.forma === 'gear') {
        p.escala = 1
        p.tinta = TINTA.gear
        if (soltar) void this.palco.efeito('vapor', 'normal', p.pos.clone().setY(p.visual.altura * (0.4 + Math.random() * 0.5)).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, 0)), { dur: 0.8, escala: 0.6 })
      } else if (p.forma === 'sabre' && p.visual.pontosLuz?.()) {
        // Arma de Luz com marcas: a luz vai na arma/punho (atualizarArmasLuz)
        p.escala = 1
        p.tinta = null
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
    const t = Math.max(0, (this.zoom - ZOOM_TUDO) / (ZOOM_MAX - ZOOM_TUDO))
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
    novo = THREE.MathUtils.clamp(novo, ZOOM_MIN, ZOOM_MAX)
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
    i = passo === -99 ? 1 : THREE.MathUtils.clamp(i + passo, 0, NIVEIS.length - 1)
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

  /** Copia cada sprite de personagem para a camada de efeitos, só como profundidade. */
  private atualizarSilhuetas() {
    const vivos = new Set<THREE.Sprite>()
    for (const p of this.personagens)
      for (const o of p.visual.objetos) {
        const sp = o as THREE.Sprite
        if (!sp.isSprite) continue
        vivos.add(sp)
        let s = this.silhuetas.get(sp)
        if (!s) {
          s = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.5, colorWrite: false, depthWrite: true }))
          s.renderOrder = -10
          this.silhuetas.set(sp, s)
          this.cenaFx.add(s)
        }
        const m = s.material
        if (m.map !== sp.material.map) {
          m.map = sp.material.map
          m.needsUpdate = true
        }
        m.rotation = sp.material.rotation
        s.position.copy(sp.position)
        s.scale.copy(sp.scale)
        s.center.copy(sp.center)
        s.visible = sp.visible
      }
    for (const [sp, s] of this.silhuetas)
      if (!vivos.has(sp)) {
        this.cenaFx.remove(s)
        s.material.dispose()
        this.silhuetas.delete(sp)
      }
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
    this.atualizarStatus()
    this.presos = this.presos.filter((x) => x.ef.vivo)
    for (const x of this.presos) x.ef.sprite.position.copy(x.onde())
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
    this.atualizarArmasLuz()
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
      ef.atualizar(ef instanceof Entei || ef instanceof EfeitoEfk ? (parado ? 0 : dtReal) : dt)
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
    if (this.efeitos.length) this.atualizarSilhuetas()
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
