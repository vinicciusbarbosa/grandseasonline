import * as THREE from 'three'
import { casco, mastro } from '../navegacao/cena/ilhas3d/marcos'
import { COR } from '../navegacao/cena/ilhas3d/paleta'
import { Pecas } from '../navegacao/cena/ilhas3d/pecas'
import type { TipoNavio } from '../navegacao/sim/navios'

/**
 * Navio provisório do teste 3D, com as mesmas peças das ilhas (casco, mastro,
 * vela): proa em +X, 100 px de comprimento como o navio da navegação 2D.
 */
export const COMPRIMENTO_NAVIO = 100
export const LARGURA_NAVIO = 32

const CORES: Record<TipoNavio, { casco: number; faixa: number; convés: number; vela: number; bandeira: number; simbolo: number }> = {
  pirata: { casco: 0x6b4226, faixa: 0x2b1a10, convés: 0xa8763f, vela: 0xf3ead2, bandeira: 0x1b1b1b, simbolo: 0xf4f1e8 },
  marinha: { casco: 0xf2f0ea, faixa: 0x2d5fa8, convés: 0xb98a55, vela: 0xfbfbf6, bandeira: 0x2d5fa8, simbolo: 0xf4f1e8 },
}

export function criarNavio(tipo: TipoNavio) {
  const c = CORES[tipo]
  const p = new Pecas()
  const deck = casco(p, COMPRIMENTO_NAVIO, LARGURA_NAVIO, 18, c.casco, c.faixa, c.convés)
  mastro(p, 10, deck, 64, c.vela, 36, { cor: c.bandeira, simbolo: c.simbolo })
  mastro(p, -22, deck, 50, c.vela, 28)
  // castelo de popa e gurupés
  p.caixa(24, 8, LARGURA_NAVIO * 0.78, c.casco, -36, deck, 0)
  p.caixa(25, 1.2, LARGURA_NAVIO * 0.82, c.faixa, -36, deck + 8, 0)
  p.add(new THREE.CylinderGeometry(0.6, 0.9, 22, 6), COR.madeiraEscura, true, new THREE.Matrix4().makeTranslation(58, deck + 6, 0).multiply(new THREE.Matrix4().makeRotationZ(-1.2)))
  const malha = p.malha(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }))!
  const grupo = new THREE.Group()
  grupo.add(malha)
  return grupo
}
