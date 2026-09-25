import Phaser from 'phaser'
import { Mundo, RAIO_ZONA_SEGURA, type Ilha, type Vetor } from '../mundo/Mundo'
import { painelNavegacao, type ControleNavegacao, type SituacaoNavio } from '../painel'
import { Descoberta } from '../sim/descoberta'
import {
  criarEstadoViagem,
  navegarPara,
  passoNavegacao,
  type EstadoViagem,
} from '../sim/navegacao'
import { fisicaDoNavio, NAVIOS, type FisicaNavio, type TipoNavio } from '../sim/navios'
import { MAR_CALMO, type EstadoMar } from '../sim/ondas'
import { ventoEm, type EstadoVento } from '../sim/vento'
import { gerarArtesNavios } from './artesNavio'
import { Correntes } from './Correntes'
import { Esteira } from './Esteira'
import { Ilhas } from './Ilhas'
import { NavioVisual } from './NavioVisual'
import { FRAGMENTO_OCEANO } from './shaderOceano'

const PASSO_FIXO = 1 / 60
const PX_POR_NO = 12
const ILHA_INICIAL = 'Ilha Dawn'

export class CenaOceano extends Phaser.Scene implements ControleNavegacao {
  mundo!: Mundo
  private descoberta!: Descoberta
  estado!: EstadoViagem
  private fisica!: FisicaNavio
  private tipo: TipoNavio = 'pirata'
  private navio!: NavioVisual
  private esteira!: Esteira
  private correntes!: Correntes
  private ilhas!: Ilhas
  private oceano!: Phaser.GameObjects.Shader
  private texDescoberta!: Phaser.Textures.CanvasTexture
  private rota!: Phaser.GameObjects.Graphics

  private tempo = 0
  private acumulador = 0
  private escalaTempo = 1
  private grade = false
  private zoomUsuario = 1
  private vento: EstadoVento = { direcao: 0, intensidade: 0.5, turbulencia: 0 }
  private versaoPintada = -1
  private ultimaPintura = 0
  private ultimoRetrato = 0
  private aviso: { texto: string; ate: number } | null = null
  private toque: { x: number; y: number } | null = null
  private olharAdiante = { x: 0, y: 0 }

  constructor() {
    super('oceano')
  }

  preload() {
    this.load.image('terra', `${import.meta.env.BASE_URL}mundo/terra.png`)
  }

  create() {
    this.mundo = new Mundo()
    this.descoberta = new Descoberta(this.mundo)

    this.texDescoberta = this.textures.createCanvas('descoberta', this.mundo.largura, this.mundo.altura)!
    this.pintarDescoberta()

    this.oceano = this.add
      .shader(
        {
          name: 'oceano',
          fragmentSource: FRAGMENTO_OCEANO,
          initialUniforms: { uTerra: 0, uDescoberta: 1 },
          setupUniforms: (definir: (nome: string, valor: unknown) => void) => this.uniformesOceano(definir),
        },
        0,
        0,
        16,
        16,
        ['terra', 'descoberta'],
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(0)

    gerarArtesNavios(this)
    this.correntes = new Correntes(this, this.mundo)
    this.ilhas = new Ilhas(this, this.mundo, this.descoberta)
    this.rota = this.add.graphics().setDepth(1.5)
    this.esteira = new Esteira(this)

    // Começa atracado na primeira ilha do East Blue, com a proa para o mar aberto.
    const inicial = this.mundo.ilhas.find((i) => i.nome === ILHA_INICIAL) ?? this.mundo.ilhas[0]
    this.estado = criarEstadoViagem(this.mundo.posicaoDaDoca(inicial), Math.PI * 0.85)
    this.estado.atracadoEm = inicial
    this.criarNavio(this.tipo)

    // Em desenvolvimento, a cena fica acessível no console (e nos testes de navegador).
    if (import.meta.env.DEV) (window as unknown as { cenaOceano: CenaOceano }).cenaOceano = this

    painelNavegacao.fontes = {
      mundo: this.mundo,
      descoberta: this.descoberta,
      rota: () => (this.estado.rota ? this.estado.rota.slice(this.estado.pontoAtual) : null),
    }

    const camera = this.cameras.main
    camera.setBackgroundColor(0x0b1220)
    camera.setBounds(-400, -400, this.mundo.larguraPx + 800, this.mundo.alturaPx + 800)
    camera.centerOn(this.estado.posicao.x, this.estado.posicao.y)

    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.toque = { x: p.x, y: p.y }
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.toque || p.button !== 0) return
      const moveu = Math.hypot(p.x - this.toque.x, p.y - this.toque.y)
      this.toque = null
      if (moveu < 10) {
        const ponto = this.cameras.main.getWorldPoint(p.x, p.y)
        this.clicar({ x: ponto.x, y: ponto.y })
      }
    })
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomUsuario = Phaser.Math.Clamp(this.zoomUsuario * (dy > 0 ? 0.9 : 1.1), 0.35, 2)
    })
  }

  // ---- Comandos (HUD) -----------------------------------------------------------

  trocarNavio(tipo: TipoNavio) {
    if (tipo === this.tipo) return
    this.tipo = tipo
    this.navio.destruir()
    this.criarNavio(tipo)
  }

  alternarGrade() {
    this.grade = !this.grade
  }

  definirEscalaTempo(escala: number) {
    this.escalaTempo = escala
  }

  navegarPara(x: number, y: number) {
    this.clicar({ x, y })
  }

  esquecerDescoberta() {
    this.descoberta.esquecer()
  }

  // ---- Laço ------------------------------------------------------------------------

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000 * this.escalaTempo
    this.tempo += dt

    // Passo fixo: a simulação dá o mesmo resultado em 30 ou 144 fps — e é o
    // mesmo passo que um servidor autoritativo usaria.
    this.acumulador += dt
    while (this.acumulador >= PASSO_FIXO) {
      this.acumulador -= PASSO_FIXO
      const mar = this.mundo.marEm(this.estado.posicao)
      this.vento = ventoEm(mar, this.estado.posicao, this.tempo)
      passoNavegacao(this.mundo, this.estado, this.fisica, this.vento, PASSO_FIXO)
    }

    const estadoMar = this.estadoDoMar()
    this.navio.atualizar(this.estado, this.fisica, this.vento, estadoMar, this.tempo)

    const razao = Math.min(1, this.estado.velocidade / this.fisica.velocidadeMax)
    const deriva = Math.hypot(this.estado.correnteAtual.x, this.estado.correnteAtual.y)
    this.esteira.atualizar(
      dt,
      razao > 0.01 || deriva > 1
        ? {
            popa: this.navio.pontoDaPopa(this.estado),
            proa: this.navio.pontoDaProa(this.estado),
            centro: this.estado.posicao,
            rumo: this.estado.rumo,
            razao: Math.max(razao, Math.min(0.25, deriva / 120)),
            velocidade: this.estado.velocidade,
            meiaLargura: this.navio.meiaLargura,
          }
        : null,
    )

    this.descoberta.revelar(this.estado.posicao)
    const agora = performance.now()
    if (this.descoberta.versao !== this.versaoPintada && agora - this.ultimaPintura > 120) {
      this.pintarDescoberta()
      this.ultimaPintura = agora
    }

    this.atualizarCamera(dt, razao)
    this.correntes.atualizar(dt, this.cameras.main.worldView)
    this.ilhas.atualizar(this.estado.posicao, this.tempo)
    this.desenharRota()

    if (agora - this.ultimoRetrato > 100) {
      this.ultimoRetrato = agora
      this.publicarRetrato()
    }
  }

  // ---- Internos --------------------------------------------------------------------

  private criarNavio(tipo: TipoNavio) {
    this.fisica = fisicaDoNavio(NAVIOS[tipo].atributos)
    this.navio = new NavioVisual(this, tipo, tipo === 'pirata' ? 7 : 13)
    this.cameras.main.startFollow(this.navio.raiz, false, 0.08, 0.08)
  }

  private clicar(p: Vetor) {
    // Clique em terra (ou colado numa doca) é pedido para atracar na ilha mais próxima.
    const emTerra = !this.mundo.navegavel(p)
    const ilha: Ilha | null = this.mundo.ilhaProxima(p, emTerra ? 7 : 1.2) ?? null
    if (emTerra && !ilha) {
      this.avisar('Não dá para navegar em terra.')
      return
    }
    if (navegarPara(this.mundo, this.estado, p, ilha) === 'sem-rota') {
      this.avisar('Não há passagem até lá.')
    }
  }

  private avisar(texto: string) {
    this.aviso = { texto, ate: performance.now() + 2500 }
  }

  /** Amplitude das ondas: calmaria no Calm Belt, e acompanha o vento no resto. */
  private estadoDoMar(): EstadoMar {
    const mar = this.mundo.marEm(this.estado.posicao)
    if (mar === 7) return MAR_CALMO
    const agitacao = mar === 5 || mar === 6 ? 1.4 : 1
    return {
      amplitude: (0.45 + 0.75 * this.vento.intensidade) * agitacao,
      irregularidade: 0.3 + this.vento.turbulencia * 0.7,
    }
  }

  private atualizarCamera(dt: number, razao: number) {
    const camera = this.cameras.main
    // Olhar adiante: a câmera se adianta na direção do movimento.
    const alvo = { x: this.estado.movimento.x * 0.9, y: this.estado.movimento.y * 0.9 }
    const suave = 1 - Math.exp(-1.8 * dt)
    this.olharAdiante.x += (alvo.x - this.olharAdiante.x) * suave
    this.olharAdiante.y += (alvo.y - this.olharAdiante.y) * suave
    camera.setFollowOffset(-this.olharAdiante.x, -this.olharAdiante.y)

    // Abre um pouco em alta velocidade; aproxima ao atracar.
    const atracado = this.estado.atracadoEm ? 1.22 : 1
    const zoomAlvo = this.zoomUsuario * (1 - 0.14 * razao) * atracado
    camera.setZoom(camera.zoom + (zoomAlvo - camera.zoom) * (1 - Math.exp(-2 * dt)))

    // O oceano é preso à tela (scrollFactor 0) e cobre exatamente a vista: o
    // zoom da câmera escala em torno do centro, então o tamanho é tela / zoom.
    // O pedaço do mundo que ele pinta vem da worldView no momento do render.
    this.oceano.setPosition(camera.width / 2, camera.height / 2)
    // setSize não recalcula a origem de exibição; setOrigin sim.
    this.oceano.setSize(camera.width / camera.zoom + 4, camera.height / camera.zoom + 4).setOrigin(0.5)
  }

  private uniformesOceano(definir: (nome: string, valor: unknown) => void) {
    const camera = this.cameras.main
    const v = camera.worldView
    // O quad tem 2 unidades de sobra de cada lado além da vista (ver atualizarCamera).
    const folga = 2
    definir('uRet', [v.x - folga, v.y - folga, v.width + folga * 2, v.height + folga * 2])
    definir('uVista', [v.x, v.y, Math.max(1, v.width), Math.max(1, v.height)])
    definir('uMundo', [this.mundo.larguraPx, this.mundo.alturaPx])
    definir('uTempo', this.tempo)
    definir('uVento', [Math.cos(this.vento.direcao), Math.sin(this.vento.direcao), this.vento.intensidade])
    definir('uGrade', this.grade ? 1 : 0)
    definir('uCelula', this.mundo.celula)
  }

  private pintarDescoberta() {
    const ctx = this.texDescoberta.getContext()
    const { largura, altura } = this.mundo
    const imagem = ctx.createImageData(largura, altura)
    const estado = this.descoberta.estado
    for (let i = 0; i < estado.length; i++) {
      const v = estado[i] * 127
      imagem.data[i * 4] = v
      imagem.data[i * 4 + 1] = v
      imagem.data[i * 4 + 2] = v
      imagem.data[i * 4 + 3] = 255
    }
    ctx.putImageData(imagem, 0, 0)
    this.texDescoberta.refresh()
    this.versaoPintada = this.descoberta.versao
  }

  private desenharRota() {
    const g = this.rota
    g.clear()
    const rota = this.estado.rota
    if (!rota) return

    // Pontilhado do navio até o destino.
    const pontos = [this.estado.posicao, ...rota.slice(this.estado.pontoAtual)]
    let sobra = 0
    g.fillStyle(0xfff3c4, 0.55)
    for (let i = 1; i < pontos.length; i++) {
      const a = pontos[i - 1]
      const b = pontos[i]
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      for (let d = sobra; d < dist; d += 22) {
        const t = d / dist
        g.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.2)
      }
      sobra = (sobra - dist) % 22
      if (sobra < 0) sobra += 22
    }

    const fim = rota[rota.length - 1]
    const pulso = 11 + Math.sin(this.tempo * 4) * 3
    g.lineStyle(2, 0xfff3c4, 0.8)
    g.strokeCircle(fim.x, fim.y, pulso)
    g.lineStyle(1.5, 0xfff3c4, 0.4)
    g.strokeCircle(fim.x, fim.y, pulso + 8)
  }

  private publicarRetrato() {
    const e = this.estado
    const mar = this.mundo.marEm(e.posicao)
    let situacao: SituacaoNavio = 'parado'
    if (e.atracadoEm) situacao = 'atracado'
    else if (e.rota && e.indoPara) situacao = 'indo-atracar'
    else if (e.rota || e.velocidade > 3) situacao = 'navegando'

    const zonaSegura = this.mundo.ilhas.some((i) => {
      const doca = this.mundo.posicaoDaDoca(i)
      return Math.hypot(doca.x - e.posicao.x, doca.y - e.posicao.y) <= RAIO_ZONA_SEGURA * this.mundo.celula
    })

    const agora = performance.now()
    if (this.aviso && agora > this.aviso.ate) this.aviso = null

    painelNavegacao.publicar({
      navio: this.tipo,
      situacao,
      ilhaAtual: e.atracadoEm?.nome ?? null,
      destino: e.indoPara?.nome ?? null,
      mar: this.mundo.nomeDoMar(mar),
      coordenada: this.mundo.coordenadaLegada(e.posicao),
      velocidade: e.velocidade / PX_POR_NO,
      velocidadeMax: this.fisica.velocidadeMax / PX_POR_NO,
      rumo: e.rumo,
      ventoDirecao: this.vento.direcao,
      ventoIntensidade: this.vento.intensidade,
      fatorVento: e.fatorVento,
      naCorrente: Math.hypot(e.correnteAtual.x, e.correnteAtual.y) > 5,
      zonaSegura,
      descoberto: this.descoberta.porcentagem(),
      escalaTempo: this.escalaTempo,
      grade: this.grade,
      posicao: { x: e.posicao.x, y: e.posicao.y },
      aviso: this.aviso?.texto ?? null,
    })
  }
}
