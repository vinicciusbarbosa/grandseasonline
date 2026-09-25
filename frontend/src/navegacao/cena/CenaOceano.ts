import Phaser from 'phaser'
import { Mundo, RAIO_ZONA_SEGURA, type Ilha, type Vetor } from '../mundo/Mundo'
import { painelNavegacao, type ControleNavegacao, type SituacaoNavio } from '../painel'
import { batalhaDeAbordagem, type Batalha } from '../sim/abordagem'
import { fatorVelas, type Lado } from '../sim/combateNaval'
import { Descoberta } from '../sim/descoberta'
import { criarEstadoViagem, navegarPara, passoNavegacao, type EstadoViagem } from '../sim/navegacao'
import { fisicaDoNavio, NAVIOS, type FisicaNavio, type TipoNavio } from '../sim/navios'
import { agitacaoEm, alturaDoMar, balancoNoMar, componentes, componentesTempestade } from '../sim/ondas'
import { REDEMOINHOS } from '../sim/redemoinho'
import { intensidadeTempestade, TEMPESTADES } from '../sim/tempestade'
import { ventoEm, type EstadoVento } from '../sim/vento'
import { Clima } from './Clima'
import { CombateNaval } from './CombateNaval'
import { Correntes } from './Correntes'
import { Esteira, type EntradaEsteira } from './Esteira'
import { Ilhas } from './Ilhas'
import { NavioVisual } from './NavioVisual'
import { ACHATAMENTO, ELEVACAO } from './projecao'
import { FRAGMENTO_OCEANO } from './shaderOceano'
import { criarTexturaRuido } from './texturaRuido'
import { VentoVisual } from './VentoVisual'
import { VisualRedemoinho } from './VisualRedemoinho'

const PASSO_FIXO = 1 / 60
const PX_POR_NO = 9
const ILHA_INICIAL = 'Ilha Dawn'
/** Saque de berries: capturar o navio rende tudo; afundar, só o que boia. */
const SAQUE_CAPTURA = 12000
const SAQUE_AFUNDADO = 1500

type Naufragio = 'redemoinho' | 'combate' | 'abordagem'

export class CenaOceano extends Phaser.Scene implements ControleNavegacao {
  mundo!: Mundo
  estado!: EstadoViagem
  private descoberta!: Descoberta
  private fisica!: FisicaNavio
  private tipo: TipoNavio = 'pirata'
  private navio!: NavioVisual
  private esteira!: Esteira
  private correntes!: Correntes
  private ilhas!: Ilhas
  private ventoVisual!: VentoVisual
  private clima!: Clima
  private visualRedemoinho!: VisualRedemoinho
  private combate!: CombateNaval
  /** Abordagem em andamento: a cena congela e o React conduz a luta. */
  private abordagem: Batalha | null = null
  private motivoNaufragio: Naufragio = 'redemoinho'
  private berries = 0
  private oceano!: Phaser.GameObjects.Shader
  private texDescoberta!: Phaser.Textures.CanvasTexture
  private rascunhoDescoberta: HTMLCanvasElement | null = null
  private rota!: Phaser.GameObjects.Graphics
  /** Tudo que fica deitado no mar: achatado pela câmera inclinada. */
  private plano!: Phaser.GameObjects.Container
  /** O que a câmera segue: a posição do navio já projetada. */
  private readonly alvoCamera = { x: 0, y: 0 }

  tempo = 0
  private acumulador = 0
  private escalaTempo = 1
  private grade = false
  private zoomUsuario = 1
  private vento: EstadoVento = { direcao: 0, intensidade: 0.5, turbulencia: 0 }
  private tempestadeNaVista = 0
  private versaoPintada = -1
  ultimaPintura = 0
  private ultimoRetrato = 0
  private aviso: { texto: string; ate: number } | null = null
  private toque: { x: number; y: number } | null = null
  private olharAdiante = { x: 0, y: 0 }
  /** Onde o navio volta depois de naufragar: a última ilha em que atracou. */
  private ultimaIlha: Ilha | null = null

  constructor() {
    super('oceano')
  }

  preload() {
    this.load.image('terra', `${import.meta.env.BASE_URL}mundo/terra.png`)
    Ilhas.carregar(this)
  }

  create() {
    this.mundo = new Mundo()
    this.descoberta = new Descoberta(this.mundo)

    this.texDescoberta = this.textures.createCanvas('descoberta', this.mundo.largura, this.mundo.altura)!
    this.pintarDescoberta()
    criarTexturaRuido(this, 'ruido')
    this.esteira = new Esteira(this)

    this.oceano = this.add
      .shader(
        {
          name: 'oceano',
          fragmentSource: FRAGMENTO_OCEANO,
          initialUniforms: { uTerra: 0, uDescoberta: 1, uRuido: 2, uRastro: 3 },
          setupUniforms: (definir: (nome: string, valor: unknown) => void) => this.uniformesOceano(definir),
        },
        0,
        0,
        16,
        16,
        ['terra', 'descoberta', 'ruido', 'rastro-a'],
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(0)

    this.plano = this.add.container(0, 0).setScale(1, ACHATAMENTO).setDepth(1)
    this.correntes = new Correntes(this, this.mundo, this.plano)
    this.ilhas = new Ilhas(this, this.mundo, this.descoberta, this.plano)
    this.rota = this.add.graphics()
    this.plano.add(this.rota)
    this.ventoVisual = new VentoVisual(this, this.plano)
    this.clima = new Clima(this)
    this.visualRedemoinho = new VisualRedemoinho(this, this.mundo.celula)
    this.combate = new CombateNaval(this, this.mundo, this.plano, this.tipo)

    // Começa atracado na primeira ilha do East Blue, com a proa para o mar aberto.
    const inicial = this.mundo.ilhas.find((i) => i.nome === ILHA_INICIAL) ?? this.mundo.ilhas[0]
    this.ultimaIlha = inicial
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
    camera.setBounds(-400, -400 * ACHATAMENTO, this.mundo.larguraPx + 800, (this.mundo.alturaPx + 800) * ACHATAMENTO)
    this.atualizarAlvoCamera()
    camera.centerOn(this.alvoCamera.x, this.alvoCamera.y)
    camera.startFollow(this.alvoCamera, false, 0.08, 0.08)

    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.toque = { x: p.x, y: p.y }
      this.clima.desbloquearSom()
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.toque || p.button !== 0) return
      const moveu = Math.hypot(p.x - this.toque.x, p.y - this.toque.y)
      this.toque = null
      if (moveu < 10) {
        // Tela → mundo: a câmera dá o ponto projetado; desfaz o achatamento.
        const ponto = this.cameras.main.getWorldPoint(p.x, p.y)
        const mundo = { x: ponto.x, y: ponto.y / ACHATAMENTO }
        // Clique no navio inimigo marca o alvo; em qualquer outro lugar, navega.
        if (!this.abordagem && !this.combate.tentarSelecionar(mundo)) this.clicar(mundo)
      }
    })
    this.input.keyboard?.on('keydown-Q', () => this.disparar('bombordo'))
    this.input.keyboard?.on('keydown-E', () => this.disparar('boreste'))
    this.input.keyboard?.on('keydown-ESC', () => {
      this.combate.sairModoAtaque()
      this.publicarRetrato()
    })
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomUsuario = Phaser.Math.Clamp(this.zoomUsuario * (dy > 0 ? 0.9 : 1.1), 0.4, 2)
    })
  }

  // ---- Comandos (HUD) -----------------------------------------------------------

  trocarNavio(tipo: TipoNavio) {
    if (tipo === this.tipo) return
    this.tipo = tipo
    this.navio.destruir()
    this.criarNavio(tipo)
    this.combate.definirTipoJogador(tipo)
  }

  alternarGrade() {
    this.grade = !this.grade
  }

  alternarSom() {
    this.clima.desbloquearSom()
    this.clima.somLigado = !this.clima.somLigado
  }

  definirEscalaTempo(escala: number) {
    this.escalaTempo = escala
  }

  navegarPara(x: number, y: number) {
    this.clicar({ x, y })
  }

  /** Atalho do HUD: rota até a borda do redemoinho (o resto é com a água). */
  irParaRedemoinho() {
    const r = REDEMOINHOS[0]
    const c = this.mundo.celula
    this.clicar({ x: (r.cx - r.raio * 0.8) * c, y: (r.cy - r.raio * 0.2) * c })
  }

  /** Atalho do HUD: traça rota até o centro da tempestade. */
  irParaTempestade() {
    const t = TEMPESTADES[0]
    this.clicar({ x: t.cx * this.mundo.celula, y: t.cy * this.mundo.celula })
  }

  esquecerDescoberta() {
    this.descoberta.esquecer()
  }

  disparar(lado: Lado) {
    if (this.abordagem) return
    const tormenta = intensidadeTempestade(this.estado.posicao, this.mundo.celula)
    const r = this.combate.disparar(this.estado, lado, this.navio.meioComprimento, tormenta)
    const nome = lado === 'bombordo' ? 'Bombordo' : 'Boreste'
    if (r === 'fora-do-arco') this.avisar(`${nome}: o inimigo não está desse lado. Vire o costado para ele.`)
    else if (r === 'fora-de-alcance') this.avisar(`${nome}: fora de alcance.`)
    else if (r === 'recarregando') this.avisar(`${nome}: recarregando…`)
    else if (r === 'zona-segura') this.avisar('Não se dispara canhões na zona segura de uma ilha.')
    else if (r === 'sem-alvo') this.avisar('Nenhum navio inimigo à vista.')
  }

  alternarModoAtaque() {
    this.combate.alternarModoAtaque(this.estado)
    this.publicarRetrato()
  }

  /** Encosta no inimigo avariado: a cena congela e começa a luta de tripulações. */
  abordar(): Batalha | null {
    const npc = this.combate.npc
    const deles = this.combate.npcCombate
    if (this.abordagem || !npc || !deles || !this.combate.info(this.estado).podeAbordar) return null
    const nosso = this.combate.combateJogador
    this.abordagem = batalhaDeAbordagem(this.tipo, deles.casco / deles.cascoMax, nosso.casco / nosso.cascoMax)
    for (const e of [this.estado, npc]) {
      e.rota = null
      e.indoPara = null
      e.velocidade = 0
      e.movimento = { x: 0, y: 0 }
    }
    this.publicarRetrato()
    return this.abordagem
  }

  terminarAbordagem() {
    const b = this.abordagem
    if (!b) return
    this.abordagem = null
    if (b.fim === 'vitoria') {
      this.berries += SAQUE_CAPTURA
      this.combate.removerNpc(40)
      this.avisar(`Navio capturado! Saque completo: ${SAQUE_CAPTURA.toLocaleString('pt-BR')} berries.`, 5000)
    } else {
      this.motivoNaufragio = 'abordagem'
      this.voltarAoPorto()
    }
    this.publicarRetrato()
  }

  // ---- Laço ------------------------------------------------------------------------

  update(_time: number, deltaMs: number) {
    // Durante a abordagem o mar congela (dt = 0) e só o React anda.
    const dt = this.abordagem ? 0 : (Math.min(deltaMs, 50) / 1000) * this.escalaTempo
    this.tempo += dt

    // Passo fixo: a simulação dá o mesmo resultado em 30 ou 144 fps — e é o
    // mesmo passo que um servidor autoritativo usaria.
    // Velas rasgadas pelos canhões tiram velocidade.
    const fisica = { ...this.fisica, velocidadeMax: this.fisica.velocidadeMax * fatorVelas(this.combate.combateJogador) }
    this.acumulador += dt
    while (this.acumulador >= PASSO_FIXO) {
      this.acumulador -= PASSO_FIXO
      const mar = this.mundo.marEm(this.estado.posicao)
      this.vento = ventoEm(mar, this.estado.posicao, this.tempo, this.mundo.celula)
      passoNavegacao(this.mundo, this.estado, fisica, this.vento, PASSO_FIXO)
    }

    const celula = this.mundo.celula
    const tormentaNavio = intensidadeTempestade(this.estado.posicao, celula)
    const balanco = balancoNoMar(
      componentes(),
      this.estado.posicao,
      this.estado.rumo,
      this.navio.meioComprimento,
      this.navio.meiaLargura,
      this.tempo,
      agitacaoEm(this.estado.posicao, celula),
      this.fisica.sensibilidadeOnda,
      tormentaNavio,
    )
    const alturaMar = (x: number, y: number) => {
      const ponto = { x, y }
      return alturaDoMar(componentes(), ponto, this.tempo, agitacaoEm(ponto, celula), intensidadeTempestade(ponto, celula))
    }
    this.navio.atualizar(this.estado, this.fisica, this.vento, balanco, this.tempo, dt, alturaMar)
    if (this.estado.atracadoEm) this.ultimaIlha = this.estado.atracadoEm

    const combate = this.combate.atualizar(dt, this.estado, this.vento, tormentaNavio, this.esteira)
    if (combate.jogadorAfundou) this.motivoNaufragio = 'combate'
    if (combate.inimigoAfundou) {
      this.berries += SAQUE_AFUNDADO
      this.avisar(`${this.combate.nomeNpc} foi a pique. Só deu para pescar ${SAQUE_AFUNDADO.toLocaleString('pt-BR')} berries dos destroços.`, 5000)
    }
    this.combate.atualizarVisualNpc(
      this.vento,
      (e, meioC, meiaL) =>
        balancoNoMar(
          componentes(),
          e.posicao,
          e.rumo,
          meioC,
          meiaL,
          this.tempo,
          agitacaoEm(e.posicao, celula),
          this.fisica.sensibilidadeOnda,
          intensidadeTempestade(e.posicao, celula),
        ),
      this.tempo,
      dt,
      alturaMar,
    )
    if (this.estado.naufragio !== null && this.estado.naufragio > 5) this.voltarAoPorto()

    const razao = Math.min(1, this.estado.velocidade / this.fisica.velocidadeMax)
    const esteiras: EntradaEsteira[] = []
    if (this.estado.naufragio === null) {
      esteiras.push({
        popa: this.navio.pontoDaPopa(this.estado),
        proa: this.navio.pontoDaProa(this.estado),
        centro: this.estado.posicao,
        rumo: this.estado.rumo,
        razao,
        meiaLargura: this.navio.meiaLargura,
        meioComprimento: this.navio.meioComprimento,
      })
    }
    const esteiraNpc = this.combate.entradaEsteiraNpc()
    if (esteiraNpc) esteiras.push(esteiraNpc)
    this.esteira.atualizar(dt, this.estado.posicao, esteiras)
    this.oceano.setTextures(['terra', 'descoberta', 'ruido', this.esteira.chave])

    this.descoberta.revelar(this.estado.posicao)
    const agora = performance.now()
    if (this.descoberta.versao !== this.versaoPintada && agora - this.ultimaPintura > 150) {
      this.pintarDescoberta()
      this.ultimaPintura = agora
    }

    this.atualizarCamera(dt, razao)
    const camera = this.cameras.main
    const centro = { x: camera.midPoint.x, y: camera.midPoint.y / ACHATAMENTO }
    const alvoTempestade = intensidadeTempestade(centro, celula)
    this.tempestadeNaVista += (alvoTempestade - this.tempestadeNaVista) * Math.min(1, dt * 1.5)

    this.correntes.atualizar(dt, camera.worldView)
    this.visualRedemoinho.atualizar(dt, camera.worldView)
    const rd = REDEMOINHOS[0]
    this.ventoVisual.atualizar(dt, this.vento, this.tempestadeNaVista, camera.worldView, {
      x: rd.cx * celula,
      y: rd.cy * celula,
      raio: rd.raio * celula,
    })
    this.clima.atualizar(dt, this.tempestadeNaVista, this.vento, (x, y) => intensidadeTempestade({ x, y }, celula))
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
  }

  /** Depois do naufrágio: um navio novo espera na última ilha visitada. */
  private voltarAoPorto() {
    const ilha = this.ultimaIlha ?? this.mundo.ilhas[0]
    this.estado = criarEstadoViagem(this.mundo.posicaoDaDoca(ilha), Math.PI * 0.85)
    this.estado.atracadoEm = ilha
    this.navio.destruir()
    this.criarNavio(this.tipo)
    this.combate.repararJogador()
    const causa: Record<Naufragio, string> = {
      redemoinho: 'O redemoinho partiu o navio.',
      combate: 'Afundado em combate.',
      abordagem: 'A tripulação foi derrotada na abordagem e o navio, tomado.',
    }
    this.avisar(`${causa[this.motivoNaufragio]} A tripulação recomeça em ${ilha.nome}, com o navio reparado.`, 5000)
    this.motivoNaufragio = 'redemoinho'
  }

  private clicar(p: Vetor) {
    // Clique em terra (ou colado numa doca) é pedido para atracar na ilha mais próxima.
    const emTerra = !this.mundo.navegavel(p)
    const ilha: Ilha | null = this.mundo.ilhaProxima(p, emTerra ? 7 : 1.2) ?? null
    if (emTerra && !ilha) {
      this.avisar('Não dá para navegar em terra.')
      return
    }
    const resultado = navegarPara(this.mundo, this.estado, p, ilha)
    if (resultado === 'sem-rota') this.avisar('Não há passagem até lá.')
    if (resultado === 'sem-controle') this.avisar('O redemoinho arrancou o leme das suas mãos!')
  }

  private avisar(texto: string, duracao = 2500) {
    this.aviso = { texto, ate: performance.now() + duracao }
  }

  private atualizarAlvoCamera() {
    this.alvoCamera.x = this.estado.posicao.x + this.olharAdiante.x
    this.alvoCamera.y = (this.estado.posicao.y + this.olharAdiante.y) * ACHATAMENTO
  }

  private atualizarCamera(dt: number, razao: number) {
    const camera = this.cameras.main
    // Olhar adiante: a câmera se adianta na direção do movimento.
    const alvo = { x: this.estado.movimento.x * 1.1, y: this.estado.movimento.y * 1.1 }
    const suave = 1 - Math.exp(-1.5 * dt)
    this.olharAdiante.x += (alvo.x - this.olharAdiante.x) * suave
    this.olharAdiante.y += (alvo.y - this.olharAdiante.y) * suave
    this.atualizarAlvoCamera()

    // Abre um pouco em alta velocidade; aproxima ao atracar.
    const atracado = this.estado.atracadoEm ? 1.2 : 1
    const zoomAlvo = this.zoomUsuario * 1.15 * (1 - 0.12 * razao) * atracado
    camera.setZoom(camera.zoom + (zoomAlvo - camera.zoom) * (1 - Math.exp(-2 * dt)))

    // O oceano é preso à tela (scrollFactor 0) e cobre exatamente a vista: o
    // zoom da câmera escala em torno do centro, então o tamanho é tela / zoom.
    this.oceano.setPosition(camera.width / 2, camera.height / 2)
    // setSize não recalcula a origem de exibição; setOrigin sim.
    // A sobra cobre o tremor de tela dos trovões.
    this.oceano.setSize(camera.width / camera.zoom + 80, camera.height / camera.zoom + 80).setOrigin(0.5)
  }

  private uniformesOceano(definir: (nome: string, valor: unknown) => void) {
    const camera = this.cameras.main
    const v = camera.worldView
    const celula = this.mundo.celula
    // O quad tem 40 unidades de sobra de cada lado além da vista (ver atualizarCamera).
    const folga = 40
    definir('uRet', [v.x - folga, v.y - folga, v.width + folga * 2, v.height + folga * 2])
    definir('uVista', [v.x, v.y, Math.max(1, v.width), Math.max(1, v.height)])
    definir('uMundo', [this.mundo.larguraPx, this.mundo.alturaPx])
    definir('uTempo', this.tempo)
    definir('uVento', [Math.cos(this.vento.direcao), Math.sin(this.vento.direcao), this.vento.intensidade])
    definir('uGrade', this.grade ? 1 : 0)
    definir('uCelula', celula)
    definir('uAchatamento', ACHATAMENTO)
    definir('uElevacao', ELEVACAO)

    const ondas = componentes()
    ondas.forEach((o, i) => {
      const k = (Math.PI * 2) / o.comprimento
      definir(`uOnda${i}`, [Math.cos(o.direcao), Math.sin(o.direcao), k, k * o.velocidade])
    })
    definir('uAmplitudes', ondas.map((o) => o.amplitude))
    definir('uFases', ondas.map((o) => o.fase))

    const vagas = componentesTempestade()
    vagas.forEach((o, i) => {
      const k = (Math.PI * 2) / o.comprimento
      definir(`uVaga${i}`, [Math.cos(o.direcao), Math.sin(o.direcao), k, k * o.velocidade])
    })
    definir('uVagaAmp', vagas.map((o) => o.amplitude))
    definir('uVagaFase', vagas.map((o) => o.fase))

    const t = TEMPESTADES[0]
    definir('uTempestade', [t.cx * celula, t.cy * celula, t.raio * celula, t.nucleo * celula])
    definir('uTempestadeNaVista', this.tempestadeNaVista)
    definir('uRelampago', this.clima.relampago)
    definir('uRelampagoPos', [this.clima.posicaoRelampago.x, this.clima.posicaoRelampago.y])

    const r = REDEMOINHOS[0]
    definir('uRedemoinho', [r.cx * celula, r.cy * celula, r.raio * celula, r.captura * celula])
    definir('uJanelaRastro', [this.esteira.janela.x, this.esteira.janela.y, this.esteira.janela.lado, 0])
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
    // Borra de leve: a grade de células vira uma borda arredondada, não um degrau.
    const rascunho = (this.rascunhoDescoberta ??= Object.assign(document.createElement('canvas'), { width: largura, height: altura }))
    rascunho.getContext('2d')!.putImageData(imagem, 0, 0)
    ctx.clearRect(0, 0, largura, altura)
    ctx.filter = 'blur(1.4px)'
    ctx.drawImage(rascunho, 0, 0)
    ctx.filter = 'none'
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
    if (e.naufragio !== null) situacao = 'naufragado'
    else if (e.capturado) situacao = 'capturado'
    else if (e.zonaRedemoinho !== 'fora' && !e.atracadoEm) situacao = 'redemoinho'
    else if (e.atracadoEm) situacao = 'atracado'
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
      velas: this.navio.estadoVelas,
      tempestade: intensidadeTempestade(e.posicao, this.mundo.celula),
      som: this.clima.somLigado,
      zonaSegura,
      descoberto: this.descoberta.porcentagem(),
      escalaTempo: this.escalaTempo,
      grade: this.grade,
      posicao: { x: e.posicao.x, y: e.posicao.y },
      aviso: this.aviso?.texto ?? null,
      combate: this.combate.info(this.estado),
      emAbordagem: this.abordagem !== null,
      berries: this.berries,
    })
  }
}
