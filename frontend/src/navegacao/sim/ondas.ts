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
  { direcao: -0.15, comprimento: 520, amplitude: 4.2, velocidade: 42, fase: 0.0 },
  { direcao: 0.45, comprimento: 310, amplitude: 2.8, velocidade: 33, fase: 1.7 },
  { direcao: -0.85, comprimento: 190, amplitude: 1.8, velocidade: 26, fase: 4.1 },
  { direcao: 1.75, comprimento: 740, amplitude: 1.8, velocidade: 50, fase: 2.6 },
]

export const QUANTIDADE_ONDAS = ONDAS.length

export function componentes(): readonly OndaComponente[] {
  return ONDAS
}

/**
 * Ondas de tempestade: duas vagas longas e altas, de crista pontuda, que só
 * existem dentro da tempestade (a amplitude é multiplicada pela intensidade).
 * O shader tem a mesma fórmula.
 */
const ONDAS_TEMPESTADE: OndaComponente[] = [
  // Vaga principal longa e alta, e uma secundária de direção próxima (~35°):
  // somam e se desencontram como mar de tempestade, sem xadrez estranho.
  { direcao: 0.95, comprimento: 470, amplitude: 15, velocidade: 70, fase: 0.8 },
  { direcao: 0.4, comprimento: 310, amplitude: 7, velocidade: 56, fase: 2.9 },
]

export function componentesTempestade(): readonly OndaComponente[] {
  return ONDAS_TEMPESTADE
}

/**
 * Quanto a tempestade multiplica as ondas comuns no núcleo (o shader usa o
 * mesmo número). Baixo de propósito: quem manda no mar bravo são as vagas;
 * as senoides regulares, muito ampliadas, formavam uma grade feia.
 */
export const AGITACAO_TEMPESTADE = 1.1

/** Agitação do mar num ponto: 1 no mar normal, até 3,2× no núcleo da tempestade. */
export function agitacaoEm(p: Vetor, celula: number) {
  return 1 + AGITACAO_TEMPESTADE * intensidadeTempestade(p, celula)
}

/** Crista pontuda e cavado largo: o perfil de uma vaga de verdade. */
export function perfilVaga(seno: number) {
  return 2 * Math.pow((seno + 1) / 2, 2) - 0.7
}

/**
 * Uma vaga de tempestade com forma de onda: a crista CURVA (a fase é torta ao
 * longo dela) e tem COMPRIMENTO FINITO (a altura cresce e some em trechos —
 * as "séries" de ondas), em vez de uma faixa reta infinita. Mesma fórmula no
 * shader (alturaVaga em shaderOceano.ts).
 */
export function alturaVaga(o: OndaComponente, p: Vetor, t: number) {
  const dx = Math.cos(o.direcao)
  const dy = Math.sin(o.direcao)
  const ao = dx * p.x + dy * p.y
  const at = -dy * p.x + dx * p.y
  const k = (Math.PI * 2) / o.comprimento
  const curva = 0.9 * Math.sin(at * 0.0042 + o.fase * 1.3) + 0.45 * Math.sin(at * 0.0097 - o.fase)
  const fase = k * (ao - o.velocidade * t) + o.fase + curva
  const e = Math.sin(at * 0.0052 + ao * 0.0011 + o.fase * 2 - t * 0.12)
  const x = Math.max(0, Math.min(1, (e + 0.5) / 1.3))
  const envelope = 0.3 + 0.7 * x * x * (3 - 2 * x)
  return o.amplitude * envelope * perfilVaga(Math.sin(fase))
}

export function alturaDoMar(ondas: readonly OndaComponente[], p: Vetor, t: number, agitacao: number, tormenta = 0) {
  let h = 0
  for (const o of ondas) {
    const k = (Math.PI * 2) / o.comprimento
    const d = Math.cos(o.direcao) * p.x + Math.sin(o.direcao) * p.y
    h += o.amplitude * Math.sin(k * (d - o.velocidade * t) + o.fase)
  }
  h *= agitacao
  if (tormenta > 0) {
    for (const o of ONDAS_TEMPESTADE) h += tormenta * alturaVaga(o, p, t)
  }
  return h
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
  tormenta = 0,
): Balanco {
  const fx = Math.cos(rumo)
  const fy = Math.sin(rumo)
  const amostra = (frente: number, lado: number) =>
    alturaDoMar(
      ondas,
      { x: centro.x + fx * frente - fy * lado, y: centro.y + fy * frente + fx * lado },
      t,
      agitacao,
      tormenta,
    )

  const proa = amostra(meioComprimento, 0)
  const popa = amostra(-meioComprimento, 0)
  const bombordo = amostra(0, -meiaLargura * 1.6)
  const boreste = amostra(0, meiaLargura * 1.6)

  const limite = (v: number, m: number) => Math.max(-m, Math.min(m, v))
  // Ganhos altos de propósito: o balanço tem que ser visível em alto mar,
  // não só na tempestade. Como a rolagem vem da diferença entre bombordo e
  // boreste, ela muda conforme o rumo em relação às ondas — de través o navio
  // joga de lado, de proa ele arfa.
  const altura = ((proa + popa + bombordo + boreste) / 4) * sensibilidade * 1.4
  const arfagem = limite(Math.atan2(proa - popa, meioComprimento * 2) * 3 * sensibilidade, 0.3)
  const rolagem = limite(Math.atan2(bombordo - boreste, meiaLargura * 3.2) * 3.2 * sensibilidade, 0.32)
  return { altura, rolagem, arfagem }
}
