import type { Vetor } from '../mundo/Mundo'
import type { EstadoViagem } from './navegacao'
import { diferencaAngular } from './ruido'

/**
 * Combate naval de costado. Os canhões ficam nas laterais: cada bateria
 * (bombordo, boreste) só dispara dentro do seu arco, com alcance e recarga
 * próprios. A graça está em manobrar para pôr o costado virado para o
 * inimigo — e manter o seu navio fora do arco dele.
 *
 * Tudo aqui é regra pura (sem Phaser): o servidor pode rodar igual.
 */

export type Lado = 'bombordo' | 'boreste'

export type Artilharia = {
  canhoes: number
  /** px do mundo. */
  alcance: number
  /** Meio-ângulo do arco de tiro, em radianos, a partir da perpendicular. */
  arco: number
  /** Segundos entre salvas de uma mesma bateria. */
  recarga: number
  /** Dano de cada bala que acerta. */
  dano: number
}

export type EstadoCombate = {
  casco: number
  cascoMax: number
  velas: number
  velasMax: number
  recarga: Record<Lado, number>
  artilharia: Artilharia
}

export function criarEstadoCombate(artilharia: Artilharia, cascoMax: number, velasMax: number): EstadoCombate {
  return { casco: cascoMax, cascoMax, velas: velasMax, velasMax, recarga: { bombordo: 0, boreste: 0 }, artilharia }
}

export const ARTILHARIA_PIRATA: Artilharia = { canhoes: 4, alcance: 430, arco: 0.9, recarga: 4.2, dano: 32 }
export const ARTILHARIA_MARINHA: Artilharia = { canhoes: 5, alcance: 460, arco: 0.8, recarga: 5, dano: 30 }

/** Direção para onde a bateria aponta (perpendicular ao casco). */
export function direcaoDoLado(rumo: number, lado: Lado) {
  return rumo + (lado === 'boreste' ? Math.PI / 2 : -Math.PI / 2)
}

/** Pode disparar essa bateria no alvo agora? Devolve o motivo se não puder. */
export function situacaoDaBateria(
  atirador: EstadoViagem,
  combate: EstadoCombate,
  lado: Lado,
  alvo: Vetor,
): 'pronta' | 'recarregando' | 'fora-do-arco' | 'fora-de-alcance' {
  const dx = alvo.x - atirador.posicao.x
  const dy = alvo.y - atirador.posicao.y
  if (Math.hypot(dx, dy) > combate.artilharia.alcance) return 'fora-de-alcance'
  const desvio = Math.abs(diferencaAngular(direcaoDoLado(atirador.rumo, lado), Math.atan2(dy, dx)))
  if (desvio > combate.artilharia.arco) return 'fora-do-arco'
  if (combate.recarga[lado] > 0) return 'recarregando'
  return 'pronta'
}

/** Qual lado está virado para o alvo (o que tem menor desvio). */
export function ladoVoltadoPara(atirador: EstadoViagem, alvo: Vetor): Lado {
  const a = Math.atan2(alvo.y - atirador.posicao.y, alvo.x - atirador.posicao.x)
  const b = Math.abs(diferencaAngular(direcaoDoLado(atirador.rumo, 'boreste'), a))
  const e = Math.abs(diferencaAngular(direcaoDoLado(atirador.rumo, 'bombordo'), a))
  return b < e ? 'boreste' : 'bombordo'
}

export type Disparo = {
  /** Onde a bala sai (costado), em px do mundo. */
  origem: Vetor
  /** Onde ela cai. */
  destino: Vetor
  acerta: boolean
  /** Segundos de voo. */
  voo: number
  /** Atraso de saída (a salva não sai toda no mesmo instante). */
  atraso: number
  dano: number
}

/**
 * Uma salva: cada canhão rola o próprio acerto. A chance cai com a
 * distância, com a velocidade do alvo e com o mar grosso. A mira já
 * antecipa o movimento do alvo; o erro vira uma bala caindo na água perto.
 */
export function dispararSalva(
  atirador: EstadoViagem,
  combate: EstadoCombate,
  lado: Lado,
  alvo: EstadoViagem,
  meioComprimento: number,
  tempestade: number,
  aleatorio: () => number = Math.random,
): Disparo[] {
  const art = combate.artilharia
  combate.recarga[lado] = art.recarga
  const frente = { x: Math.cos(atirador.rumo), y: Math.sin(atirador.rumo) }
  const saida = direcaoDoLado(atirador.rumo, lado)
  const distancia = Math.hypot(alvo.posicao.x - atirador.posicao.x, alvo.posicao.y - atirador.posicao.y)
  const velocidadeAlvo = Math.hypot(alvo.movimento.x, alvo.movimento.y)

  const chance =
    0.9 *
    (1 - 0.55 * Math.pow(distancia / art.alcance, 2)) *
    (1 - Math.min(0.35, velocidadeAlvo / 250)) *
    (1 - 0.45 * tempestade)

  const disparos: Disparo[] = []
  for (let i = 0; i < art.canhoes; i++) {
    const aoLongo = ((i + 0.5) / art.canhoes - 0.5) * meioComprimento * 1.2
    const origem = {
      x: atirador.posicao.x + frente.x * aoLongo + Math.cos(saida) * 14,
      y: atirador.posicao.y + frente.y * aoLongo + Math.sin(saida) * 14,
    }
    const voo = 0.5 + distancia / 520
    // Antecipação: mira onde o alvo vai estar quando a bala chegar.
    const previsto = { x: alvo.posicao.x + alvo.movimento.x * voo, y: alvo.posicao.y + alvo.movimento.y * voo }
    const acerta = aleatorio() < chance
    const espalha = acerta ? 16 : 45 + aleatorio() * 70
    const angulo = aleatorio() * Math.PI * 2
    disparos.push({
      origem,
      destino: { x: previsto.x + Math.cos(angulo) * espalha, y: previsto.y + Math.sin(angulo) * espalha },
      acerta,
      voo,
      atraso: i * 0.09 + aleatorio() * 0.05,
      dano: art.dano * (0.85 + aleatorio() * 0.3),
    })
  }
  return disparos
}

/** Dano de uma bala: a maior parte no casco, o resto no velame. */
export function aplicarDano(combate: EstadoCombate, dano: number) {
  combate.casco = Math.max(0, combate.casco - dano * 0.75)
  combate.velas = Math.max(0, combate.velas - dano * 0.25)
}

/** Velas rasgadas tiram velocidade: com o velame zerado, sobra metade. */
export function fatorVelas(combate: EstadoCombate) {
  return 0.5 + 0.5 * (combate.velas / combate.velasMax)
}

export function recarregar(combate: EstadoCombate, dt: number) {
  combate.recarga.bombordo = Math.max(0, combate.recarga.bombordo - dt)
  combate.recarga.boreste = Math.max(0, combate.recarga.boreste - dt)
}

/**
 * Pode abordar: inimigo avariado (casco abaixo de 40% ou velame abaixo de
 * 30%), bem perto e com pouca velocidade relativa.
 */
export function podeAbordar(nosso: EstadoViagem, deles: EstadoViagem, combateDeles: EstadoCombate) {
  const perto = Math.hypot(nosso.posicao.x - deles.posicao.x, nosso.posicao.y - deles.posicao.y) < 130
  const relativa = Math.hypot(nosso.movimento.x - deles.movimento.x, nosso.movimento.y - deles.movimento.y)
  const avariado = combateDeles.casco < combateDeles.cascoMax * 0.4 || combateDeles.velas < combateDeles.velasMax * 0.3
  return perto && relativa < 45 && avariado
}
