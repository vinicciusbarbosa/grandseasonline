import type { Mundo, Vetor } from '../mundo/Mundo'
import { RAIO_ZONA_SEGURA } from '../mundo/Mundo'
import { type EstadoCombate } from './combateNaval'
import { navegarPara, type EstadoViagem } from './navegacao'

/**
 * Cérebro do navio de patrulha:
 *
 *   patrulha → vaga entre pontos da área dele;
 *   combate  → avistou o jogador fora da zona segura: fecha distância e
 *              passa a ORBITAR o jogador, o que deixa o costado virado para
 *              ele (é assim que um navio de linha luta);
 *   fuga     → casco abaixo de 25%: foge para longe.
 *
 * A decisão é refeita a cada 0,8 s; entre uma e outra, o navio só navega.
 */
export type ModoIA = 'patrulha' | 'combate' | 'fuga'

export type EstadoIA = {
  modo: ModoIA
  centro: Vetor
  raioPatrulha: number
  proximaDecisao: number
  /** Sentido da órbita (1 ou -1), sorteado ao entrar em combate. */
  sentido: number
}

const AVISTAR = 650
const ESQUECER = 1000
const DISTANCIA_ORBITA = 270

export function criarIA(centro: Vetor, raioPatrulha: number): EstadoIA {
  return { modo: 'patrulha', centro, raioPatrulha, proximaDecisao: 0, sentido: 1 }
}

export function naZonaSegura(mundo: Mundo, p: Vetor) {
  return mundo.ilhas.some((i) => {
    const d = mundo.posicaoDaDoca(i)
    return Math.hypot(d.x - p.x, d.y - p.y) <= RAIO_ZONA_SEGURA * mundo.celula
  })
}

export function pensar(mundo: Mundo, ia: EstadoIA, npc: EstadoViagem, combate: EstadoCombate, jogador: EstadoViagem, dt: number) {
  ia.proximaDecisao -= dt
  if (ia.proximaDecisao > 0) return
  ia.proximaDecisao = 0.8

  const dx = jogador.posicao.x - npc.posicao.x
  const dy = jogador.posicao.y - npc.posicao.y
  const distancia = Math.hypot(dx, dy)
  const jogadorProtegido = naZonaSegura(mundo, jogador.posicao) || jogador.naufragio !== null

  if (combate.casco < combate.cascoMax * 0.25) ia.modo = 'fuga'
  else if (ia.modo === 'patrulha' && distancia < AVISTAR && !jogadorProtegido) {
    ia.modo = 'combate'
    ia.sentido = Math.random() < 0.5 ? 1 : -1
  } else if (ia.modo === 'combate' && (distancia > ESQUECER || jogadorProtegido)) ia.modo = 'patrulha'

  if (ia.modo === 'fuga') {
    const a = Math.atan2(-dy, -dx)
    tentarIr(mundo, npc, { x: npc.posicao.x + Math.cos(a) * 600, y: npc.posicao.y + Math.sin(a) * 600 })
    return
  }

  if (ia.modo === 'combate') {
    // Órbita: um ponto adiante no círculo em volta do jogador. Longe, o ponto
    // puxa para perto; no raio certo, o navio corre em volta com o costado
    // virado para dentro.
    const a = Math.atan2(npc.posicao.y - jogador.posicao.y, npc.posicao.x - jogador.posicao.x)
    const raio = Math.max(DISTANCIA_ORBITA, Math.min(distancia * 0.8, DISTANCIA_ORBITA * 1.4))
    for (const s of [ia.sentido, -ia.sentido]) {
      const b = a + s * 0.7
      const ponto = { x: jogador.posicao.x + Math.cos(b) * raio, y: jogador.posicao.y + Math.sin(b) * raio }
      if (mundo.navegavel(ponto) && tentarIr(mundo, npc, ponto)) {
        ia.sentido = s
        return
      }
    }
    return
  }

  // Patrulha: sorteia outro ponto ao chegar.
  if (!npc.rota) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * ia.raioPatrulha
      const ponto = { x: ia.centro.x + Math.cos(a) * r, y: ia.centro.y + Math.sin(a) * r }
      if (mundo.navegavel(ponto) && tentarIr(mundo, npc, ponto)) return
    }
  }
}

function tentarIr(mundo: Mundo, npc: EstadoViagem, ponto: Vetor) {
  return navegarPara(mundo, npc, ponto, null) === 'ok'
}
