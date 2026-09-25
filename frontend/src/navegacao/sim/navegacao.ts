import type { Ilha, Mundo, Vetor } from '../mundo/Mundo'
import type { FisicaNavio } from './navios'
import { comprimentoRestante, planejarRota } from './rota'
import { diferencaAngular, girarPara } from './ruido'
import { influenciaRedemoinho, type Zona } from './redemoinho'
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
  /** Onde o navio está em relação ao redemoinho. */
  zonaRedemoinho: Zona
  /** Preso no redemoinho: o jogador perdeu o controle. */
  capturado: boolean
  /** 0–1: quanto de água já entrou no navio. */
  alagamento: number
  /** Segundos desde que o navio se partiu; null enquanto inteiro. */
  naufragio: number | null
  /** 0–1: quanto o navio já desceu no funil do redemoinho (visual). */
  funil: number
  /** Adernamento para dentro da curva do redemoinho, em radianos (visual). */
  adernaRedemoinho: number
  /** Giro próprio acumulado dentro do redemoinho. */
  rodopio: number
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
    zonaRedemoinho: 'fora',
    capturado: false,
    alagamento: 0,
    naufragio: null,
    funil: 0,
    adernaRedemoinho: 0,
    rodopio: 0,
  }
}

export type ResultadoComando = 'ok' | 'sem-rota' | 'sem-controle'

/** Clique no mar: navega até o ponto. Clique numa ilha: vai até a doca e atraca. */
export function navegarPara(mundo: Mundo, estado: EstadoViagem, destino: Vetor, ilha: Ilha | null): ResultadoComando {
  if (estado.capturado || estado.naufragio !== null) return 'sem-controle'
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

  if (estado.naufragio !== null) {
    estado.naufragio += dt
    estado.velocidade = 0
    return
  }

  const redemoinho = influenciaRedemoinho(posicao, mundo.celula)
  estado.zonaRedemoinho = redemoinho?.zona ?? 'fora'
  atualizarVisualRedemoinho(estado, redemoinho, dt)
  if (redemoinho && (redemoinho.zona === 'captura' || redemoinho.zona === 'centro')) estado.capturado = true
  if (estado.capturado && redemoinho) {
    girarNoRedemoinho(estado, redemoinho, dt)
    return
  }

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
    // Na borda do redemoinho a água segura o casco: o pano rende quase nada.
    const segura = redemoinho ? 1 - 0.85 * Math.min(1, redemoinho.profundidade * 2.2) : 1
    velocidadeAlvo = Math.min(fisica.velocidadeMax * estado.fatorVento * fatorCurva * mar * segura, freio + 5)

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
  let autoridade = 0.35 + 0.65 * Math.min(1, estado.velocidade / (fisica.velocidadeMax * 0.5))
  if (redemoinho) autoridade *= 1 - 0.9 * Math.min(1, redemoinho.profundidade * 2.2)
  const rumoAntes = estado.rumo
  estado.rumo = Math.atan2(Math.sin(estado.rumo), Math.cos(estado.rumo))
  estado.rumo = girarPara(estado.rumo, rumoAlvo, fisica.giro * autoridade * dt)
  // A correnteza vira o casco: ele tende a se alinhar com a água, como uma folha.
  if (redemoinho) {
    const forca = Math.min(1, redemoinho.profundidade * 2.5)
    estado.rumo += diferencaAngular(estado.rumo, redemoinho.tangente + 0.25) * forca * 1.4 * dt
  }
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
  if (redemoinho) {
    alvoCorrente.x += redemoinho.correnteza.x
    alvoCorrente.y += redemoinho.correnteza.y
  }
  estado.correnteAtual.x += (alvoCorrente.x - estado.correnteAtual.x) * Math.min(1, dt * 1.5)
  estado.correnteAtual.y += (alvoCorrente.y - estado.correnteAtual.y) * Math.min(1, dt * 1.5)
  // A água do redemoinho entra direto, sem suavizar: suavizar um vetor que
  // gira atrasa a tangente e cria um empurrão para fora.
  if (redemoinho) {
    estado.correnteAtual.x = alvoCorrente.x
    estado.correnteAtual.y = alvoCorrente.y
  }

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

/**
 * Preso: o navio vai na água como uma folha. Orbita o centro com a
 * correnteza, desce devagar pela espiral, gira em torno de si cada vez mais
 * rápido e afunda no funil enquanto alaga. No centro, ele se parte.
 * Tudo é suavizado (sem trancos): velocidades e rumo seguem alvos.
 */
function girarNoRedemoinho(
  estado: EstadoViagem,
  r: NonNullable<ReturnType<typeof influenciaRedemoinho>>,
  dt: number,
) {
  estado.rota = null
  estado.indoPara = null
  estado.atracadoEm = null

  // Integra em coordenadas polares: o ângulo gira com a água e o raio só
  // diminui. (Somar vetores de velocidade suavizados atrasava a tangente, e o
  // atraso empurrava o navio para fora: ele orbitava para sempre.)
  const dx = estado.posicao.x - r.centro.x
  const dy = estado.posicao.y - r.centro.y
  const angulo = Math.atan2(dy, dx)
  const tangencial = Math.hypot(r.correnteza.x, r.correnteza.y) * 0.9
  // Sentido do giro: o mesmo da correnteza.
  const sentido = Math.sign(dx * Math.sin(r.tangente) - dy * Math.cos(r.tangente)) || 1
  // A espiral leva uns 9 s da captura ao centro, acelerando no fim.
  const succao = 8 + 14 * r.profundidade
  const raio = Math.max(0, r.distancia - succao * dt)
  const novoAngulo = angulo + (sentido * tangencial * dt) / Math.max(raio, 20)
  const destino = { x: r.centro.x + Math.cos(novoAngulo) * raio, y: r.centro.y + Math.sin(novoAngulo) * raio }
  estado.movimento.x = (destino.x - estado.posicao.x) / dt
  estado.movimento.y = (destino.y - estado.posicao.y) / dt
  estado.correnteAtual.x = 0
  estado.correnteAtual.y = 0

  // Rumo: acompanha a tangente (uma volta por órbita) e ganha giro próprio
  // perto do centro — sempre seguindo o alvo com suavidade.
  estado.rodopio += (0.2 + 2.4 * Math.pow(r.profundidade, 2.5)) * dt
  const alvo = r.tangente + 0.35 + estado.rodopio
  const antes = estado.rumo
  estado.rumo += diferencaAngular(estado.rumo, alvo) * Math.min(1, 2.2 * dt)
  estado.giroAtual = diferencaAngular(antes, estado.rumo) / Math.max(dt, 1e-6)
  estado.velocidade = tangencial * 0.5

  estado.alagamento = Math.min(1, estado.alagamento + dt / 9)
  estado.posicao.x = destino.x
  estado.posicao.y = destino.y
  if (r.zona === 'centro' || raio < 30) estado.naufragio = 0
}

/** Funil e adernamento: o navio desce na água e se inclina para o centro. */
function atualizarVisualRedemoinho(estado: EstadoViagem, r: ReturnType<typeof influenciaRedemoinho>, dt: number) {
  let funilAlvo = 0
  let adernaAlvo = 0
  if (r) {
    funilAlvo = Math.pow(r.profundidade, 2)
    // Centro a boreste ou a bombordo? O casco aderna para o lado do centro.
    const paraCentro = Math.atan2(r.centro.y - estado.posicao.y, r.centro.x - estado.posicao.x)
    const lado = Math.sin(diferencaAngular(estado.rumo, paraCentro))
    adernaAlvo = lado * 0.35 * Math.pow(r.profundidade, 1.2)
  }
  const suave = 1 - Math.exp(-2 * dt)
  estado.funil += (funilAlvo - estado.funil) * suave
  estado.adernaRedemoinho += (adernaAlvo - estado.adernaRedemoinho) * suave
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
