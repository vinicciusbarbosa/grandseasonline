import type { Mundo, Vetor } from '../mundo/Mundo'

/**
 * Névoa de descoberta: cada célula é desconhecida, avistada ou visitada.
 * Fica no navegador por enquanto; com servidor, vira dado da tripulação.
 */
export const DESCONHECIDA = 0
export const AVISTADA = 1
export const VISITADA = 2

const CHAVE = 'sugoi.navegacao.descoberta.v1'

const RAIO_VISAO = 12
const RAIO_VISITA = 1.5

export class Descoberta {
  readonly estado: Uint8Array
  /** Incrementa a cada mudança, para quem desenha saber quando atualizar. */
  versao = 0
  private ultimaCelula = -1
  private ultimoSalvamento = 0

  private readonly mundo: Mundo

  constructor(mundo: Mundo) {
    this.mundo = mundo
    this.estado = new Uint8Array(mundo.largura * mundo.altura)
    this.carregar()
  }

  revelar(p: Vetor) {
    const { cx, cy } = this.mundo.celulaDe(p)
    const indice = this.mundo.indice(cx, cy)
    if (indice === this.ultimaCelula) return false
    this.ultimaCelula = indice

    let mudou = false
    const r = Math.ceil(RAIO_VISAO)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (!this.mundo.dentro(x, y)) continue
        const d = Math.hypot(dx, dy)
        const alvo = d <= RAIO_VISITA ? VISITADA : d <= RAIO_VISAO ? AVISTADA : DESCONHECIDA
        const i = this.mundo.indice(x, y)
        if (alvo > this.estado[i]) {
          this.estado[i] = alvo
          mudou = true
        }
      }
    }
    if (mudou) {
      this.versao++
      // Grava no máximo a cada 2 s: o navio cruza várias células por segundo.
      const agora = performance.now()
      if (agora - this.ultimoSalvamento > 2000) {
        this.ultimoSalvamento = agora
        this.salvar()
      }
    }
    return mudou
  }

  porcentagem() {
    let vistas = 0
    for (const v of this.estado) if (v !== DESCONHECIDA) vistas++
    return vistas / this.estado.length
  }

  esquecer() {
    this.estado.fill(DESCONHECIDA)
    this.ultimaCelula = -1
    this.versao++
    try {
      localStorage.removeItem(CHAVE)
    } catch {
      // Sem armazenamento: o progresso só vive nesta aba.
    }
  }

  private salvar() {
    try {
      let texto = ''
      for (const v of this.estado) texto += String(v)
      localStorage.setItem(CHAVE, texto)
    } catch {
      // Idem.
    }
  }

  private carregar() {
    try {
      const texto = localStorage.getItem(CHAVE)
      if (!texto || texto.length !== this.estado.length) return
      for (let i = 0; i < texto.length; i++) this.estado[i] = texto.charCodeAt(i) - 48
    } catch {
      // Idem.
    }
  }
}
