import type { Ilha, Mundo, Vetor } from '../mundo/Mundo'
import type { FisicaNavio } from './navios'
import { comprimentoRestante, planejarRota } from './rota'
import { diferencaAngular, girarPara } from './ruido'
import { intensidadeTempestade } from './tempestade'
import { fatorDoVento, type EstadoVento } from './vento'

/**
 * Estado de viagem de um navio — o "ShipRoot" do dossiê: a posição verdadeira
 * no mundo. Quando o servidor virar autoritativo, é este estado que ele manda
 * (e que o cliente interpola); tudo que é onda, rastro e câmera fica fora daqui.
 */
export type EstadoViagem = {
  posicao: Vetor
  /** Para onde a proa aponta, em radianos. */
  rumo: number
  /** Velocidade de avanço da proa, em px/s. */
  velocidade: number
  /** Velocidade real (proa + deriva), em px/s — é o que move o navio. */
  movimento: Vetor
  rota: Vetor[] | null
  /** Índice do próximo ponto da rota. */
  pontoAtual: number
  /** Ilha para onde está indo atracar. */
  indoPara: Ilha | null
  /** Ilha onde está atracado. */
  atracadoEm: Ilha | null
  /** Taxa de giro atual (rad/s), para o visual inclinar nas curvas. */
  giroAtual: number
  /** Último multiplicador de vento aplicado, para o HUD. */
  fatorVento: number
  correnteAtual: Vetor
}

export function criarEstadoViagem(posicao: Vetor, rumo = 0): EstadoViagem {
  return {
    posicao: { ...posicao },
    rumo,
    velocidade: 0,
    movimento: { x: 0, y: 0 },
    rota: null,
    pontoAtual: 0,
    indoPara: null,
    atracadoEm: null,
    giroAtual: 0,
    fatorVento: 1,
    correnteAtual: { x: 0, y: 0 },
  }
}

export type ResultadoComando = 'ok' | 'sem-rota'

/** Clique no mar: navega até o ponto. Clique numa ilha: vai até a doca e atraca. */
export function navegarPara(mundo: Mundo, estado: EstadoViagem, destino: Vetor, ilha: Ilha | null): ResultadoComando {
  const alvo = ilha ? mundo.posicaoDaDoca(ilha) : destino
  const rota = planejarRota(mundo, estado.posicao, alvo)
  if (!rota) return 'sem-rota'
  estado.rota = rota
  estado.pontoAtual = 1
  estado.indoPara = ilha
  estado.atracadoEm = null
  return 'ok'
}

export function pararNavio(estado: EstadoViagem) {
  estado.rota = null
  estado.indoPara = null
}

const VELOCIDADE_CORRENTE = 30 // px/s por ponto de intensidade

export function passoNavegacao(
  mundo: Mundo,
  estado: EstadoViagem,
  fisica: FisicaNavio,
  vento: EstadoVento,
  dt: number,
) {
  const { posicao } = estado
  let velocidadeAlvo = 0
  let rumoAlvo = estado.rumo

  if (estado.rota) {
    const rota = estado.rota
    // Perseguição com antecipação: mira num ponto à frente na rota, e não no
    // vértice seguinte — é isso que transforma a linha quebrada em curva.
    const antecipacao = mundo.celula * 1.6 + estado.velocidade * 0.7
    while (
      estado.pontoAtual < rota.length - 1 &&
      Math.hypot(rota[estado.pontoAtual].x - posicao.x, rota[estado.pontoAtual].y - posicao.y) < antecipacao
    ) {
      estado.pontoAtual++
    }
    const alvo = rota[estado.pontoAtual]
    const restante = comprimentoRestante(rota, estado.pontoAtual, posicao)
    rumoAlvo = Math.atan2(alvo.y - posicao.y, alvo.x - posicao.x)

    const erro = Math.abs(diferencaAngular(estado.rumo, rumoAlvo))
    // Curva fechada pede menos pano: ninguém faz 180° a toda velocidade.
    let fatorCurva = erro > 1.4 ? 0.3 : 1 - (erro / 1.4) * 0.6
    // Perto do fim, desalinhado, o navio quase para em vez de orbitar o ponto.
    if (restante < mundo.celula * 3) fatorCurva *= Math.max(0.12, Math.cos(Math.min(erro, Math.PI / 2)))
    // Velocidade com que ainda dá para parar no destino.
    const freio = Math.sqrt(2 * fisica.desaceleracao * Math.max(0, restante - 4))
    // Mar grosso freia: o casco bate nas ondas em vez de deslizar.
    const mar = 1 - intensidadeTempestade(posicao, mundo.celula) * fisica.perdaNoMar
    velocidadeAlvo = Math.min(fisica.velocidadeMax * estado.fatorVento * fatorCurva * mar, freio + 5)

    const noFim = estado.pontoAtual === rota.length - 1
    // Chegou: ou está em cima do ponto, ou está perto e teria de dar a volta.
    const chegou = restante < 12 || (restante < mundo.celula * 1.2 && erro > 1.2)
    if (noFim && chegou && estado.velocidade < 30) {
      estado.rota = null
      if (estado.indoPara) {
        estado.atracadoEm = estado.indoPara
        estado.indoPara = null
      }
    }
  }

  // --- Rumo -------------------------------------------------------------------
  // O leme morde mais com o navio andando; parado, ele ainda gira, mas devagar.
  const autoridade = 0.35 + 0.65 * Math.min(1, estado.velocidade / (fisica.velocidadeMax * 0.5))
  const rumoAntes = estado.rumo
  estado.rumo = Math.atan2(Math.sin(estado.rumo), Math.cos(estado.rumo))
  estado.rumo = girarPara(estado.rumo, rumoAlvo, fisica.giro * autoridade * dt)
  const giro = diferencaAngular(rumoAntes, estado.rumo) / Math.max(dt, 1e-6)
  estado.giroAtual += (giro - estado.giroAtual) * Math.min(1, dt * 4)

  // --- Velocidade -----------------------------------------------------------------
  estado.fatorVento = fatorDoVento(estado.rumo, vento, fisica.aproveitamentoVento)
  if (velocidadeAlvo > estado.velocidade) {
    estado.velocidade = Math.min(velocidadeAlvo, estado.velocidade + fisica.aceleracao * dt)
  } else {
    estado.velocidade = Math.max(velocidadeAlvo, estado.velocidade - fisica.desaceleracao * dt)
  }

  // --- Deriva: a velocidade real alinha com a proa aos poucos ---------------------------
  const proa = { x: Math.cos(estado.rumo) * estado.velocidade, y: Math.sin(estado.rumo) * estado.velocidade }
  const alinhar = 1 - Math.exp(-fisica.aderencia * dt)
  estado.movimento.x += (proa.x - estado.movimento.x) * alinhar
  estado.movimento.y += (proa.y - estado.movimento.y) * alinhar

  const corrente = mundo.correnteEm(posicao)
  const alvoCorrente = corrente
    ? { x: corrente.dx * corrente.forca * VELOCIDADE_CORRENTE, y: corrente.dy * corrente.forca * VELOCIDADE_CORRENTE }
    : { x: 0, y: 0 }
  estado.correnteAtual.x += (alvoCorrente.x - estado.correnteAtual.x) * Math.min(1, dt * 1.5)
  estado.correnteAtual.y += (alvoCorrente.y - estado.correnteAtual.y) * Math.min(1, dt * 1.5)

  // Atracado, o navio encosta devagar na doca e fica preso a ela.
  if (estado.atracadoEm) {
    estado.movimento.x *= 1 - Math.min(1, dt * 3)
    estado.movimento.y *= 1 - Math.min(1, dt * 3)
    const doca = mundo.posicaoDaDoca(estado.atracadoEm)
    const encostar = 1 - Math.exp(-1.2 * dt)
    posicao.x += (doca.x - posicao.x) * encostar
    posicao.y += (doca.y - posicao.y) * encostar
    return
  }

  const dx = (estado.movimento.x + estado.correnteAtual.x) * dt
  const dy = (estado.movimento.y + estado.correnteAtual.y) * dt
  mover(mundo, estado, dx, dy)
}

/** Move com colisão contra terra: desliza pela costa em vez de atravessar. */
function mover(mundo: Mundo, estado: EstadoViagem, dx: number, dy: number) {
  const p = estado.posicao
  if (mundo.navegavel({ x: p.x + dx, y: p.y + dy })) {
    p.x += dx
    p.y += dy
    return
  }
  if (mundo.navegavel({ x: p.x + dx, y: p.y })) {
    p.x += dx
    estado.movimento.y = 0
  } else if (mundo.navegavel({ x: p.x, y: p.y + dy })) {
    p.y += dy
    estado.movimento.x = 0
  } else {
    estado.movimento.x = 0
    estado.movimento.y = 0
  }
  estado.velocidade *= 0.6
}
