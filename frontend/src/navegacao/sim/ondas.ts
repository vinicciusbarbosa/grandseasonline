import type { Vetor } from '../mundo/Mundo'
import { intensidadeTempestade } from './tempestade'

/**
 * O mar como um campo de ondas de verdade: a soma de algumas ondas
 * senoidais com direções, comprimentos e velocidades diferentes. A soma
 * nunca se repete de forma reconhecível, e é a MESMA função que o shader
 * usa para desenhar o relevo da água — o navio sobe na crista que o jogador
 * está vendo passar embaixo dele.
 *
 * A altura é só visual: mexe no desenho do navio, nunca na posição lógica.
 */

export type OndaComponente = {
  /** Direção de propagação, em radianos. */
  direcao: number
  /** Comprimento de onda, em px do mundo. */
  comprimento: number
  /** Amplitude base, em px de altura. */
  amplitude: number
  /** Velocidade de fase, em px/s. */
  velocidade: number
  fase: number
}

/**
 * Ondulação do mar. As direções são fixas de propósito: a fase depende de
 * direção × posição, e girar as ondas com o vento faria o desenho "nadar"
 * longe da origem do mapa.
 */
const ONDAS: OndaComponente[] = [
  { direcao: -0.15, comprimento: 520, amplitude: 3.2, velocidade: 42, fase: 0.0 },
  { direcao: 0.45, comprimento: 310, amplitude: 2.0, velocidade: 33, fase: 1.7 },
  { direcao: -0.85, comprimento: 190, amplitude: 1.3, velocidade: 26, fase: 4.1 },
  { direcao: 1.75, comprimento: 740, amplitude: 1.8, velocidade: 50, fase: 2.6 },
]

export const QUANTIDADE_ONDAS = ONDAS.length

export function componentes(): readonly OndaComponente[] {
  return ONDAS
}

/** Quanto a tempestade multiplica as ondas no núcleo (o shader usa o mesmo número). */
export const AGITACAO_TEMPESTADE = 2.6

/** Agitação do mar num ponto: 1 no mar normal, até 3,6× no núcleo da tempestade. */
export function agitacaoEm(p: Vetor, celula: number) {
  return 1 + AGITACAO_TEMPESTADE * intensidadeTempestade(p, celula)
}

export function alturaDoMar(ondas: readonly OndaComponente[], p: Vetor, t: number, agitacao: number) {
  let h = 0
  for (const o of ondas) {
    const k = (Math.PI * 2) / o.comprimento
    const d = Math.cos(o.direcao) * p.x + Math.sin(o.direcao) * p.y
    h += o.amplitude * Math.sin(k * (d - o.velocidade * t) + o.fase)
  }
  return h * agitacao
}

export type Balanco = {
  /** Subida/descida do casco, em px. */
  altura: number
  /** Rolagem, em radianos (positivo: aderna para boreste). */
  rolagem: number
  /** Arfagem, em radianos (positivo: proa sobe). */
  arfagem: number
}

/**
 * Amostra o mar em quatro pontos do casco (proa, popa, bombordo, boreste):
 * a média vira a altura, as diferenças viram arfagem e rolagem. Um navio
 * mais estável "sente" menos cada onda.
 */
export function balancoNoMar(
  ondas: readonly OndaComponente[],
  centro: Vetor,
  rumo: number,
  meioComprimento: number,
  meiaLargura: number,
  t: number,
  agitacao: number,
  sensibilidade: number,
): Balanco {
  const fx = Math.cos(rumo)
  const fy = Math.sin(rumo)
  const amostra = (frente: number, lado: number) =>
    alturaDoMar(
      ondas,
      { x: centro.x + fx * frente - fy * lado, y: centro.y + fy * frente + fx * lado },
      t,
      agitacao,
    )

  const proa = amostra(meioComprimento, 0)
  const popa = amostra(-meioComprimento, 0)
  const bombordo = amostra(0, -meiaLargura * 1.6)
  const boreste = amostra(0, meiaLargura * 1.6)

  const altura = ((proa + popa + bombordo + boreste) / 4) * sensibilidade
  const arfagem = Math.atan2(proa - popa, meioComprimento * 2) * 1.6 * sensibilidade
  const rolagem = Math.atan2(bombordo - boreste, meiaLargura * 3.2) * 1.3 * sensibilidade
  return { altura, rolagem, arfagem }
}
