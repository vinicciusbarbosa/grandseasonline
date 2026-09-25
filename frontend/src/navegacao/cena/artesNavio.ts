import Phaser from 'phaser'
import type { TipoNavio } from '../sim/navios'

/**
 * Os dois navios iniciais, desenhados por código (vista de cima, proa para a
 * direita). São provisórios: quando houver arte de verdade, basta gerar
 * texturas com as mesmas chaves e o resto da cena não muda.
 *
 * Cada navio vira quatro texturas separadas — casco, vela, bandeira e sombra —
 * porque elas se mexem de forma independente: a vela gira com o vento, a
 * bandeira tremula, a sombra fica fora do balanço.
 */

/** Tudo é desenhado em 2x e exibido em 0,5 para ficar nítido com zoom. */
export const ESCALA_ARTE = 0.6

type Paleta = {
  casco: number
  faixa: number
  deck: number
  tabuas: number
  contorno: number
  friso: number
  cabine: number
  mastro: number
  vela: number
  velaDetalhe: number
  bandeira: number
  bandeiraDetalhe: number
}

type Projeto = {
  comprimento: number
  meiaLargura: number
  /** Posição dos mastros ao longo do casco (0 = popa, 1 = proa). */
  mastros: number[]
  canhoes: number[]
  paleta: Paleta
  larguraVela: number
}

export const PROJETOS: Record<TipoNavio, Projeto> = {
  pirata: {
    comprimento: 128,
    meiaLargura: 23,
    mastros: [0.52],
    canhoes: [0.3, 0.45],
    larguraVela: 88,
    paleta: {
      casco: 0x9a6232,
      faixa: 0x7a4722,
      deck: 0xd1a46a,
      tabuas: 0xb3864f,
      contorno: 0x3a2212,
      friso: 0xe0b04a,
      cabine: 0x6b4022,
      mastro: 0x4a2c17,
      vela: 0xf4e8cc,
      velaDetalhe: 0xb23a36,
      bandeira: 0x1b1b1f,
      bandeiraDetalhe: 0xf4f0e6,
    },
  },
  marinha: {
    comprimento: 150,
    meiaLargura: 26,
    mastros: [0.36, 0.68],
    canhoes: [0.25, 0.4, 0.55],
    larguraVela: 92,
    paleta: {
      casco: 0xeef2f7,
      faixa: 0x1e3a6b,
      deck: 0xc9b089,
      tabuas: 0xae9570,
      contorno: 0x14233f,
      friso: 0xc9a227,
      cabine: 0x1e3a6b,
      mastro: 0x3b2a1c,
      vela: 0xf8fafc,
      velaDetalhe: 0x2c5aa0,
      bandeira: 0x2c5aa0,
      bandeiraDetalhe: 0xf8fafc,
    },
  },
}

export function chaves(tipo: TipoNavio) {
  return {
    casco: `navio-${tipo}-casco`,
    vela: `navio-${tipo}-vela`,
    bandeira: `navio-${tipo}-bandeira`,
    sombra: `navio-${tipo}-sombra`,
  }
}

/** Meia-largura do casco em `s` (0 popa, 1 proa): bojudo no meio, afinando na proa. */
function meiaLarguraEm(projeto: Projeto, s: number) {
  const w = projeto.meiaLargura
  if (s < 0.62) return w * (0.8 + 0.2 * Math.sin((s / 0.62) * (Math.PI / 2)))
  return w * Math.pow(Math.cos(((s - 0.62) / 0.38) * (Math.PI / 2)), 0.75)
}

function contornoCasco(projeto: Projeto, cx: number, cy: number, encolher = 0) {
  const pontos: Phaser.Math.Vector2[] = []
  const passos = 40
  const inicio = cx - projeto.comprimento / 2
  for (let i = 0; i <= passos; i++) {
    const s = i / passos
    pontos.push(new Phaser.Math.Vector2(inicio + s * projeto.comprimento, cy - Math.max(0, meiaLarguraEm(projeto, s) - encolher)))
  }
  for (let i = passos; i >= 0; i--) {
    const s = i / passos
    pontos.push(new Phaser.Math.Vector2(inicio + s * projeto.comprimento, cy + Math.max(0, meiaLarguraEm(projeto, s) - encolher)))
  }
  return pontos
}

export function gerarArtesNavios(cena: Phaser.Scene) {
  for (const tipo of Object.keys(PROJETOS) as TipoNavio[]) {
    const projeto = PROJETOS[tipo]
    const k = chaves(tipo)
    if (cena.textures.exists(k.casco)) continue
    gerarCasco(cena, tipo, projeto, k.casco)
    gerarSombra(cena, projeto, k.sombra)
    gerarVela(cena, tipo, projeto, k.vela)
    gerarBandeira(cena, tipo, projeto, k.bandeira)
  }
}

function dimensoes(projeto: Projeto) {
  const largura = projeto.comprimento + 24
  const altura = projeto.meiaLargura * 2 + 24
  return { largura, altura, cx: largura / 2, cy: altura / 2 }
}

function gerarCasco(cena: Phaser.Scene, tipo: TipoNavio, projeto: Projeto, chave: string) {
  const { largura, altura, cx, cy } = dimensoes(projeto)
  const p = projeto.paleta
  const g = cena.make.graphics({ x: 0, y: 0 }, false)
  const popa = cx - projeto.comprimento / 2

  // Canhões aparecem pelas bordas, então vão antes do casco.
  for (const s of projeto.canhoes) {
    const x = popa + s * projeto.comprimento
    const w = meiaLarguraEm(projeto, s)
    g.fillStyle(0x222428, 1)
    g.fillRect(x - 4, cy - w - 5, 8, 7)
    g.fillRect(x - 4, cy + w - 2, 8, 7)
  }

  // Casco e faixa externa.
  g.fillStyle(p.faixa, 1)
  g.fillPoints(contornoCasco(projeto, cx, cy), true)
  g.fillStyle(p.casco, 1)
  g.fillPoints(contornoCasco(projeto, cx, cy, tipo === 'marinha' ? 5 : 2.5), true)

  // Convés com tábuas no sentido do comprimento.
  const deck = contornoCasco(projeto, cx, cy, tipo === 'marinha' ? 9 : 6)
  g.fillStyle(p.deck, 1)
  g.fillPoints(deck, true)
  g.lineStyle(1.2, p.tabuas, 0.8)
  for (let faixa = -3; faixa <= 3; faixa++) {
    const y = cy + faixa * 5.5
    let xIni = -1
    for (let i = 0; i <= 60; i++) {
      const s = i / 60
      const cabe = meiaLarguraEm(projeto, s) - (tipo === 'marinha' ? 9 : 6) > Math.abs(y - cy) + 1
      const x = popa + s * projeto.comprimento
      if (cabe && xIni < 0) xIni = x
      if ((!cabe || i === 60) && xIni >= 0) {
        g.lineBetween(xIni + 2, y, x - 2, y)
        xIni = -1
      }
    }
  }

  // Friso dourado acompanhando a amurada.
  g.lineStyle(1.6, p.friso, 0.9)
  g.strokePoints(contornoCasco(projeto, cx, cy, tipo === 'marinha' ? 7 : 4.5), true)

  // Cabine de popa.
  const cabineW = projeto.comprimento * 0.16
  const cabineH = projeto.meiaLargura * 1.2
  g.fillStyle(p.cabine, 1)
  g.fillRoundedRect(popa + 6, cy - cabineH / 2, cabineW, cabineH, 4)
  g.lineStyle(1.5, p.friso, 1)
  g.strokeRoundedRect(popa + 6, cy - cabineH / 2, cabineW, cabineH, 4)
  g.fillStyle(p.friso, 0.9)
  g.fillRect(popa + 9, cy - 1.5, cabineW - 6, 3)

  // Escotilha no meio do convés.
  const sEscotilha = projeto.mastros[0] - 0.14
  g.fillStyle(p.contorno, 0.55)
  g.fillRect(popa + sEscotilha * projeto.comprimento - 7, cy - 7, 14, 14)
  g.lineStyle(1, p.tabuas, 1)
  g.strokeRect(popa + sEscotilha * projeto.comprimento - 7, cy - 7, 14, 14)

  // Vela de proa (bujarrona): triângulo do mastro dianteiro até o gurupés.
  const proa = popa + projeto.comprimento
  const ultimoMastro = popa + projeto.mastros[projeto.mastros.length - 1] * projeto.comprimento
  g.fillStyle(p.vela, 0.95)
  g.fillTriangle(ultimoMastro + 16, cy - 2, proa + 8, cy, ultimoMastro + 16, cy + 9)
  g.lineStyle(1, p.contorno, 0.5)
  g.strokeTriangle(ultimoMastro + 16, cy - 2, proa + 8, cy, ultimoMastro + 16, cy + 9)

  // Gurupés e figura de proa.
  g.lineStyle(3, p.mastro, 1)
  g.lineBetween(proa - 10, cy, proa + 10, cy)
  if (tipo === 'pirata') {
    // Cabeça de carneiro estilizada: o ornamento que dá identidade ao Brave Tide.
    g.fillStyle(0xf4ecd6, 1)
    g.fillCircle(proa - 2, cy, 7)
    g.fillStyle(0xe0b04a, 1)
    g.fillCircle(proa - 5, cy - 6, 3.5)
    g.fillCircle(proa - 5, cy + 6, 3.5)
    g.fillStyle(p.contorno, 1)
    g.fillCircle(proa + 1, cy - 2.5, 1.2)
    g.fillCircle(proa + 1, cy + 2.5, 1.2)
  } else {
    // Crista da Marinha: gaivota dourada em "V".
    g.lineStyle(2.5, p.friso, 1)
    g.beginPath()
    g.moveTo(proa - 12, cy - 7)
    g.lineTo(proa - 4, cy)
    g.lineTo(proa - 12, cy + 7)
    g.strokePath()
  }

  // Contorno geral.
  g.lineStyle(2.2, p.contorno, 1)
  g.strokePoints(contornoCasco(projeto, cx, cy), true)

  // Mastros.
  for (const s of projeto.mastros) {
    const x = popa + s * projeto.comprimento
    g.fillStyle(p.mastro, 1)
    g.fillCircle(x, cy, 5.5)
    g.fillStyle(p.friso, 1)
    g.fillCircle(x, cy, 2)
  }

  g.generateTexture(chave, largura, altura)
  g.destroy()
}

function gerarSombra(cena: Phaser.Scene, projeto: Projeto, chave: string) {
  const { largura, altura, cx, cy } = dimensoes(projeto)
  const g = cena.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(0x000000, 1)
  g.fillPoints(contornoCasco(projeto, cx, cy, -2), true)
  g.generateTexture(chave, largura, altura)
  g.destroy()
}

/**
 * Vela vista de cima: a verga atravessa o navio e o pano faz barriga para a
 * frente. A textura tem a verga em x=10, então a origem fica ali e o
 * `scaleX` controla o quanto ela enche.
 */
function gerarVela(cena: Phaser.Scene, tipo: TipoNavio, projeto: Projeto, chave: string) {
  const p = projeto.paleta
  const largura = 44
  const altura = projeto.larguraVela + 8
  const cy = altura / 2
  const meia = projeto.larguraVela / 2
  const g = cena.make.graphics({ x: 0, y: 0 }, false)

  const barriga = (frac: number) => 10 + 26 * Math.sin(frac * Math.PI)
  const pano: Phaser.Math.Vector2[] = []
  for (let i = 0; i <= 24; i++) pano.push(new Phaser.Math.Vector2(barriga(i / 24), cy - meia + (i / 24) * meia * 2))
  pano.push(new Phaser.Math.Vector2(10, cy + meia))
  pano.push(new Phaser.Math.Vector2(10, cy - meia))

  g.fillStyle(p.vela, 1)
  g.fillPoints(pano, true)

  // Sombreado: a barriga fica mais clara, as pontas mais escuras.
  g.fillStyle(0x000000, 0.08)
  g.fillRect(10, cy - meia, 8, meia * 2)

  // Faixas coloridas acompanhando a curva.
  g.lineStyle(3, p.velaDetalhe, 0.9)
  for (const f of [0.28, 0.72]) {
    g.beginPath()
    for (let i = 0; i <= 12; i++) {
      const frac = i / 12
      const x = 10 + (barriga(frac) - 10) * f
      const y = cy - meia + frac * meia * 2
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.strokePath()
  }

  // Emblema no centro.
  const ex = 24
  if (tipo === 'pirata') {
    g.fillStyle(p.velaDetalhe, 1)
    g.fillCircle(ex, cy, 8)
    g.fillStyle(0xf4f0e6, 1)
    g.fillCircle(ex, cy - 1, 4.5)
    g.lineStyle(2, 0xf4f0e6, 1)
    g.lineBetween(ex - 6, cy - 6, ex + 6, cy + 6)
    g.lineBetween(ex - 6, cy + 6, ex + 6, cy - 6)
    g.fillStyle(p.velaDetalhe, 1)
    g.fillCircle(ex - 1.8, cy - 1.5, 1.1)
    g.fillCircle(ex + 1.8, cy - 1.5, 1.1)
  } else {
    g.lineStyle(2.5, p.velaDetalhe, 1)
    g.beginPath()
    g.arc(ex - 4, cy - 4, 5, Math.PI * 0.1, Math.PI * 0.9, false)
    g.strokePath()
    g.beginPath()
    g.arc(ex - 4, cy + 4, 5, -Math.PI * 0.9, -Math.PI * 0.1, false)
    g.strokePath()
  }

  g.lineStyle(1.5, 0x000000, 0.35)
  g.strokePoints(pano, true)

  // Verga.
  g.lineStyle(4, p.mastro, 1)
  g.lineBetween(10, cy - meia - 3, 10, cy + meia + 3)

  g.generateTexture(chave, largura, altura)
  g.destroy()
}

function gerarBandeira(cena: Phaser.Scene, tipo: TipoNavio, projeto: Projeto, chave: string) {
  const p = projeto.paleta
  const g = cena.make.graphics({ x: 0, y: 0 }, false)
  // Flâmula presa em x=0, voando para +x.
  g.fillStyle(p.bandeira, 1)
  g.fillTriangle(0, 0, 34, 7, 0, 14)
  g.fillStyle(p.bandeiraDetalhe, 1)
  if (tipo === 'pirata') {
    g.fillCircle(9, 7, 3.2)
  } else {
    g.fillRect(0, 5.5, 22, 3)
  }
  g.generateTexture(chave, 36, 14)
  g.destroy()
}
