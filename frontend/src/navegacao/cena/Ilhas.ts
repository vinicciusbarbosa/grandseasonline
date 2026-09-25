import Phaser from 'phaser'
import { RAIO_ZONA_SEGURA, type Ilha, type Mundo, type Vetor } from '../mundo/Mundo'
import ilhasAssadas from '../mundo/ilhas-assadas.json'
import ilhasModeladas from '../mundo/ilhas.json'
import type { Descoberta } from '../sim/descoberta'
import type { FaixaAssada } from './ilhas3d/Assador'
import { ESCALA_ASSADA } from './ilhas3d/escala'
import type { MetaIlha } from './ilhas3d/terreno'
import { projetar } from './projecao'

const MODELADAS = ilhasModeladas as unknown as MetaIlha[]
/** Faixas já assadas (scripts/assar_ilhas.mjs): o jogo só carrega as imagens. */
const ASSADAS = ilhasAssadas as unknown as { id: number; faixas: (FaixaAssada & { arquivo: string })[] }[]
/** `?assar-ilhas` na URL força assar na hora (é o que o script de assar usa). */
const ASSAR_NA_HORA = ASSADAS.length === 0 || (typeof location !== 'undefined' && location.search.includes('assar-ilhas'))

type IlhaEm3d = { meta: MetaIlha; faixas: FaixaAssada[]; imagens: Phaser.GameObjects.Image[]; baseY: number[]; vista: number }

type IlhaNaTela = {
  ilha: Ilha
  doca: Vetor
  marcador: Phaser.GameObjects.Graphics
  nome: Phaser.GameObjects.Text
  zona: Phaser.GameObjects.Graphics
}

/**
 * Ilhas como instâncias no mundo: as modeladas em 3D (cena/ilhas3d) são
 * assadas em imagens na criação da cena; as outras continuam sendo só a
 * terra do shader. Aqui também entram a doca, o nome e a zona segura.
 */
export class Ilhas {
  private readonly itens: IlhaNaTela[] = []
  private readonly em3d: IlhaEm3d[] = []
  /** Todas as ilhas modeladas já estão na cena (o script de assar espera por isso). */
  prontas = false
  private ultimaVarredura = -1

  /** Chamado no preload: as faixas assadas ou, sem elas, os mapas de altura para assar agora. */
  static carregar(cena: Phaser.Scene) {
    const base = import.meta.env.BASE_URL
    if (ASSAR_NA_HORA) {
      for (const m of MODELADAS) cena.load.image(`ilha-dados-${m.id}`, `${base}mundo/ilhas/${m.id}.png`)
      return
    }
    for (const ilha of ASSADAS) for (const f of ilha.faixas) cena.load.image(f.chave, `${base}mundo/ilhas/assadas/${f.arquivo}`)
  }
  private readonly mundo: Mundo
  private readonly descoberta: Descoberta

  /** A zona segura fica deitada no mar (`plano`); doca e nome ficam de pé. */
  constructor(cena: Phaser.Scene, mundo: Mundo, descoberta: Descoberta, plano: Phaser.GameObjects.Container) {
    this.mundo = mundo
    this.descoberta = descoberta
    const raioZona = RAIO_ZONA_SEGURA * mundo.celula
    this.assar(cena)

    for (const ilha of mundo.ilhas) {
      const doca = mundo.posicaoDaDoca(ilha)

      const zona = cena.add.graphics({ x: doca.x, y: doca.y })
      plano.add(zona)
      const segmentos = 36
      zona.lineStyle(2, 0xf0d68e, 1)
      for (let i = 0; i < segmentos; i += 2) {
        const a0 = (i / segmentos) * Math.PI * 2
        const a1 = ((i + 1) / segmentos) * Math.PI * 2
        zona.beginPath()
        zona.arc(0, 0, raioZona, a0, a1, false)
        zona.strokePath()
      }
      zona.fillStyle(0xf0d68e, 0.05)
      zona.fillCircle(0, 0, raioZona)

      const naTela = projetar(doca.x, doca.y)
      const marcador = cena.add.graphics({ x: naTela.x, y: naTela.y }).setDepth(5)
      marcador.fillStyle(0x1b1409, 0.55)
      marcador.fillCircle(0, 0, 10)
      marcador.lineStyle(2.5, 0xf0d68e, 1)
      marcador.strokeCircle(0, 0, 8)
      // Âncora estilizada.
      marcador.lineStyle(2, 0xf0d68e, 1)
      marcador.lineBetween(0, -4, 0, 4)
      marcador.lineBetween(-3, -2, 3, -2)
      marcador.beginPath()
      marcador.arc(0, 1, 4, 0.15 * Math.PI, 0.85 * Math.PI, false)
      marcador.strokePath()

      const nome = cena.add
        .text(naTela.x, naTela.y - 22, ilha.nome, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#f6ead0',
          stroke: '#1b1409',
          strokeThickness: 5,
        })
        .setOrigin(0.5, 1)
        .setDepth(5)
        .setResolution(2)

      this.itens.push({ ilha, doca, marcador, nome, zona })
    }
  }

  private assar(cena: Phaser.Scene) {
    if (MODELADAS.length === 0) {
      this.prontas = true
      return
    }
    if (!ASSAR_NA_HORA) {
      for (const ilha of ASSADAS) {
        const meta = MODELADAS.find((m) => m.id === ilha.id)
        if (meta) this.colocar(cena, meta, ilha.faixas)
      }
      this.prontas = true
      return
    }
    // Sem as imagens prontas: monta em 3D agora (o Three.js só é baixado neste caso).
    void import('./ilhas3d/Assador').then(({ Assador }) => {
      const inicio = performance.now()
      const assador = new Assador()
      for (const meta of MODELADAS) {
        const fonte = cena.textures.get(`ilha-dados-${meta.id}`).getSourceImage() as HTMLImageElement
        const tela = document.createElement('canvas')
        tela.width = meta.colunas
        tela.height = meta.linhas
        const ctx = tela.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(fonte, 0, 0)
        this.colocar(cena, meta, assador.assar(cena, meta, ctx.getImageData(0, 0, meta.colunas, meta.linhas)).faixas)
      }
      assador.destruir()
      this.prontas = true
      if (import.meta.env.DEV) console.info(`ilhas 3D assadas em ${Math.round(performance.now() - inicio)} ms`)
    })
  }

  private colocar(cena: Phaser.Scene, meta: MetaIlha, faixas: FaixaAssada[]) {
    const imagens = faixas.map((f) =>
      cena.add
        .image(f.x, f.y, f.chave)
        .setOrigin(0, 0)
        .setScale(1 / ESCALA_ASSADA)
        // Mesma régua do navio (3 + y·1e-5): o que está mais ao sul fica na frente.
        .setDepth(3 + f.sul * 1e-5 - 1e-7)
        .setAlpha(0),
    )
    this.em3d.push({ meta, faixas, imagens, baseY: imagens.map((i) => i.y), vista: 0 })
  }

  atualizar(posicaoNavio: Vetor, tempo: number) {
    // O Baratie (flutuante) sobe e desce devagar com o mar.
    for (const ilha of this.em3d) {
      if (!ilha.meta.flutuante) continue
      const dy = Math.sin(tempo * 0.9) * 1.6 + Math.sin(tempo * 1.7 + 1) * 0.6
      ilha.imagens.forEach((img, k) => img.setY(ilha.baseY[k] + dy))
    }
    // Ilha modelada aparece inteira (com um fade) quando alguma parte dela é
    // avistada. A varredura da descoberta roda 4× por segundo, não por quadro.
    const varrer = tempo - this.ultimaVarredura > 0.25
    if (varrer) this.ultimaVarredura = tempo
    for (const ilha of this.em3d) {
      if (ilha.vista > 0 && ilha.vista < 1) {
        ilha.vista = Math.min(1, ilha.vista + 0.04)
        for (const img of ilha.imagens) img.setAlpha(ilha.vista)
      } else if (ilha.vista === 0 && varrer) {
        const m = ilha.meta
        let avistada = false
        for (let y = m.y; y < m.y + m.linhas * m.passo && !avistada; y += this.mundo.celula) {
          for (let x = m.x; x < m.x + m.colunas * m.passo; x += this.mundo.celula) {
            const { cx, cy } = this.mundo.celulaDe({ x, y })
            if (this.mundo.dentro(cx, cy) && this.mundo.bloqueio[this.mundo.indice(cx, cy)] && this.descoberta.estado[this.mundo.indice(cx, cy)] > 0) {
              avistada = true
              break
            }
          }
        }
        if (avistada) ilha.vista = 0.04
      }
    }

    for (const item of this.itens) {
      const { cx, cy } = this.mundo.celulaDe(item.doca)
      const conhecida = this.descoberta.estado[this.mundo.indice(cx, cy)] > 0
      const dist = Math.hypot(item.doca.x - posicaoNavio.x, item.doca.y - posicaoNavio.y) / this.mundo.celula

      item.nome.setVisible(conhecida)
      item.marcador.setVisible(conhecida)
      // A zona segura só aparece quando o navio se aproxima, e pulsa de leve.
      const perto = 1 - Phaser.Math.Clamp((dist - RAIO_ZONA_SEGURA) / 6, 0, 1)
      item.zona.setVisible(conhecida && perto > 0)
      item.zona.setAlpha(perto * (0.45 + 0.15 * Math.sin(tempo * 2.5)))
      item.zona.setRotation(tempo * 0.05)
    }
  }
}
