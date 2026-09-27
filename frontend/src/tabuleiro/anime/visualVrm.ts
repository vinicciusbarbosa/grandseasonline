import * as THREE from 'three'
import { MToonMaterial } from '@pixiv/three-vrm'
import { ANIMACOES } from '../boneco/animacoes'
import type { Direcao, EstadoVisual, InfoAnim, NomeAnim, Visual } from '../cena/personagem'
import { Esqueleto, PersonagemVrm } from './personagemVrm'
import { Rastro } from './rastro'

/**
 * Visual de anime: o modelo VRoid em 3D, animado suave a 60 fps com as poses
 * do combate, girando com calma para a direção, com rastro no corte e clarão
 * ao levar golpe.
 */

/** o modelo do VRoid tem ~1,6 m; no tabuleiro fica um pouco maior que a casa */
const ESCALA = 1.3
const GIRO: Record<Direcao, number> = { S: 0, SE: 45, E: 90, NE: 135, N: 180, NW: 225, W: 270, SW: 315 }

/** Tempo e marcas das animações, tirados das próprias poses. */
function infoDasAnimacoes(): Record<NomeAnim, InfoAnim> {
  const esq = new Esqueleto()
  const r = {} as Record<NomeAnim, InfoAnim>
  for (const [nome, a] of Object.entries(ANIMACOES)) {
    const poeira: InfoAnim['poeira'] = []
    for (let q = 0; q < a.quadros; q++) {
      esq.zerar()
      poeira.push(a.pose(esq, a.laco ? q / a.quadros : q / (a.quadros - 1)).poeira)
    }
    r[nome as NomeAnim] = { quadros: a.quadros, fps: a.fps, laco: a.laco, impacto: a.impacto, poeira }
  }
  return r
}

export class VisualVrm implements Visual {
  readonly info = infoDasAnimacoes()
  readonly objetos: THREE.Object3D[]
  readonly altura = 1.75 * ESCALA
  private readonly p: PersonagemVrm
  private readonly rastro = new Rastro()
  private giro: number
  private readonly cores: [number, number, number]
  private readonly materiais: MToonMaterial[] = []

  constructor(p: PersonagemVrm, cores: [number, number, number], dir: Direcao) {
    this.p = p
    this.cores = cores
    this.giro = THREE.MathUtils.degToRad(GIRO[dir])
    p.grupo.scale.setScalar(ESCALA)
    this.objetos = [p.grupo, this.rastro.malha]
    p.vrm.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) if (mat instanceof MToonMaterial) this.materiais.push(mat)
    })
  }

  mostrar(e: EstadoVisual) {
    const a = ANIMACOES[e.anim]
    const dur = a.quadros / a.fps
    const t = a.laco ? (e.tAnim / dur) % 1 : Math.min(1, e.tAnim / dur)
    // vira pelo caminho mais curto, rápido mas sem estalo
    const alvo = THREE.MathUtils.degToRad(GIRO[e.dir])
    let d = alvo - this.giro
    d = Math.atan2(Math.sin(d), Math.cos(d))
    this.giro += d * Math.min(1, e.dt * 16)
    this.p.giro = this.giro
    this.p.grupo.position.copy(e.pos)
    const extra = this.p.posar(e.anim, t)
    this.p.atualizar(e.dt)
    const l = this.p.lamina()
    this.rastro.atualizar(e.dt, l.ponta, l.meio, extra.rastro ? Math.max(0, extra.rastro.forca) : 0, ...this.cores)
    const k = e.clarao > 0 ? 0.9 : 0
    for (const m of this.materiais) m.emissive.setRGB(k, k, k)
  }
}
