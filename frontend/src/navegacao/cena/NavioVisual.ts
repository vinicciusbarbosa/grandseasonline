import Phaser from 'phaser'
import type { EstadoViagem } from '../sim/navegacao'
import { NAVIOS, type FisicaNavio, type TipoNavio } from '../sim/navios'
import { balanco, criarPerfilOnda, type EstadoMar, type PerfilOnda } from '../sim/ondas'
import { diferencaAngular, ruidoSuave } from '../sim/ruido'
import type { EstadoVento } from '../sim/vento'
import { chaves, ESCALA_ARTE, PROJETOS } from './artesNavio'

const GRAUS = Math.PI / 180

/**
 * O navio na tela, em duas camadas como no dossiê:
 *
 *   raiz   (ShipRoot)   — posição e rumo lógicos, exatamente o EstadoViagem
 *   visual (ShipVisual) — balanço, rolagem, arfagem, vela e bandeira
 *
 * A sombra fica fora das duas: ela não balança, só se afasta quando o casco sobe.
 */
export class NavioVisual {
  readonly raiz: Phaser.GameObjects.Container
  private readonly visual: Phaser.GameObjects.Container
  private readonly sombra: Phaser.GameObjects.Image
  private readonly casco: Phaser.GameObjects.Image
  private readonly velas: Phaser.GameObjects.Image[] = []
  private readonly bandeira: Phaser.GameObjects.Image
  private readonly posicaoMastros: number[]
  private readonly perfil: PerfilOnda
  readonly tipo: TipoNavio
  /** Distância do centro até a popa e até a proa, em px do mundo. */
  readonly meioComprimento: number
  readonly meiaLargura: number

  constructor(cena: Phaser.Scene, tipo: TipoNavio, semente: number) {
    this.tipo = tipo
    const projeto = PROJETOS[tipo]
    const k = chaves(tipo)
    this.perfil = criarPerfilOnda(semente)
    this.meioComprimento = (projeto.comprimento / 2) * ESCALA_ARTE
    this.meiaLargura = projeto.meiaLargura * ESCALA_ARTE

    this.sombra = cena.add.image(0, 0, k.sombra).setScale(ESCALA_ARTE).setAlpha(0.28).setDepth(2)
    this.casco = cena.add.image(0, 0, k.casco).setScale(ESCALA_ARTE)

    this.posicaoMastros = projeto.mastros.map((s) => (s - 0.5) * projeto.comprimento * ESCALA_ARTE)
    for (const x of this.posicaoMastros) {
      // Origem na verga (x=10 de 44 na textura), para a vela girar em torno do mastro.
      this.velas.push(cena.add.image(x, 0, k.vela).setOrigin(10 / 44, 0.5).setScale(ESCALA_ARTE))
    }
    this.bandeira = cena.add.image(this.posicaoMastros[0], 0, k.bandeira).setOrigin(0, 0.5).setScale(ESCALA_ARTE)

    this.visual = cena.add.container(0, 0, [this.casco, ...this.velas, this.bandeira])
    this.raiz = cena.add.container(0, 0, [this.visual]).setDepth(3)
  }

  get nome() {
    return NAVIOS[this.tipo].nome
  }

  atualizar(estado: EstadoViagem, fisica: FisicaNavio, vento: EstadoVento, mar: EstadoMar, tempo: number) {
    const { posicao, rumo } = estado
    this.raiz.setPosition(posicao.x, posicao.y).setRotation(rumo)

    const b = balanco(this.perfil, tempo, mar, fisica.sensibilidadeOnda)
    const razao = Math.min(1, estado.velocidade / fisica.velocidadeMax)

    // Nas curvas o navio aderna para fora; quanto mais solto, mais aderna.
    const adernar = -estado.giroAtual * (7 + fisica.sensibilidadeOnda * 4) * (0.3 + razao)
    const rolagem = b.rolagem + adernar
    // Em velocidade, a proa sobe um pouco e o casco "assenta".
    const arfagem = b.arfagem + razao * 1.2

    this.visual.setRotation(rolagem * 0.18 * GRAUS)
    this.visual.setScale(1 + b.altura * 0.018 + arfagem * 0.004, (1 + b.altura * 0.018) * (1 - Math.abs(rolagem) * 0.012))

    // Mastros são altos: a rolagem leva o topo (velas e bandeira) para o lado.
    const inclinacao = rolagem * 0.95
    for (let i = 0; i < this.velas.length; i++) {
      this.velas[i].setPosition(this.posicaoMastros[i] + arfagem * 0.6, inclinacao)
    }

    // --- Vela: gira a verga para pegar o vento e enche conforme a força ---------------
    const relativo = diferencaAngular(rumo, vento.direcao)
    const alinhamento = Math.cos(relativo)
    const regulagem = Phaser.Math.Clamp(relativo * 0.45, -0.6, 0.6)
    let enchimento = (0.35 + 0.65 * vento.intensidade) * (0.45 + 0.55 * Math.abs(alinhamento))
    // Vento de proa: o pano panejando, cheio "para trás".
    if (alinhamento < -0.3) enchimento *= -0.55
    // Pano tremula mais com vento fraco ou de través.
    const tremor = ruidoSuave(tempo * 7, this.perfil.fase[0]) * 0.08 * (1.2 - vento.intensidade)
    for (const vela of this.velas) {
      vela.setRotation(regulagem)
      vela.setScale(ESCALA_ARTE * (enchimento + tremor), ESCALA_ARTE)
    }

    // --- Bandeira: sempre a favor do vento, tremulando ---------------------------------
    const tremular = ruidoSuave(tempo * 5.5, this.perfil.fase[3]) * (0.35 - vento.intensidade * 0.2)
    this.bandeira.setPosition(this.posicaoMastros[0] + arfagem * 0.6, inclinacao)
    this.bandeira.setRotation(vento.direcao - rumo - this.visual.rotation + tremular)
    this.bandeira.setScale(ESCALA_ARTE * (0.8 + 0.2 * vento.intensidade), ESCALA_ARTE * (1 + ruidoSuave(tempo * 9, 4) * 0.25))

    // --- Sombra: cai para sudeste e se afasta quando o casco sobe ----------------------
    const altura = 1 + b.altura * 0.35
    this.sombra.setPosition(posicao.x + 5 * altura, posicao.y + 8 * altura).setRotation(rumo)
    this.sombra.setScale(ESCALA_ARTE * (1 + b.altura * 0.01))
  }

  pontoDaPopa(estado: EstadoViagem) {
    return {
      x: estado.posicao.x - Math.cos(estado.rumo) * this.meioComprimento * 0.92,
      y: estado.posicao.y - Math.sin(estado.rumo) * this.meioComprimento * 0.92,
    }
  }

  pontoDaProa(estado: EstadoViagem) {
    return {
      x: estado.posicao.x + Math.cos(estado.rumo) * this.meioComprimento,
      y: estado.posicao.y + Math.sin(estado.rumo) * this.meioComprimento,
    }
  }

  destruir() {
    this.raiz.destroy()
    this.sombra.destroy()
  }
}
