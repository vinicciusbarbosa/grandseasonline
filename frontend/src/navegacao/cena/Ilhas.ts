import Phaser from 'phaser'
import { RAIO_ZONA_SEGURA, type Ilha, type Mundo, type Vetor } from '../mundo/Mundo'
import type { Descoberta } from '../sim/descoberta'

type IlhaNaTela = {
  ilha: Ilha
  doca: Vetor
  marcador: Phaser.GameObjects.Graphics
  nome: Phaser.GameObjects.Text
  zona: Phaser.GameObjects.Graphics
}

/**
 * Ilhas como instâncias no mundo: a silhueta já vem da terra no shader; aqui
 * entram a doca (o ponto de atracação), o nome e a zona segura.
 */
export class Ilhas {
  private readonly itens: IlhaNaTela[] = []
  private readonly mundo: Mundo
  private readonly descoberta: Descoberta

  constructor(cena: Phaser.Scene, mundo: Mundo, descoberta: Descoberta) {
    this.mundo = mundo
    this.descoberta = descoberta
    const raioZona = RAIO_ZONA_SEGURA * mundo.celula

    for (const ilha of mundo.ilhas) {
      const doca = mundo.posicaoDaDoca(ilha)

      const zona = cena.add.graphics({ x: doca.x, y: doca.y }).setDepth(0.8)
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

      const marcador = cena.add.graphics({ x: doca.x, y: doca.y }).setDepth(5)
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
        .text(doca.x, doca.y - 22, ilha.nome, {
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

  atualizar(posicaoNavio: Vetor, tempo: number) {
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
