import * as THREE from 'three'
import type { EstadoVisual, Visual } from './personagem'

/**
 * Personagem que troca de corpo ao se transformar (Zoan do Lobo vira o
 * lobisomem, o Corpo de Chamas vira o espírito de fogo): guarda o visual
 * normal e o de cada forma; `forma` escolhe qual aparece.
 */
export class VisualComForma implements Visual {
  forma: string | null = null
  private ativo: Visual
  readonly objetos: THREE.Object3D[]
  private readonly base: Visual
  private readonly formas: Record<string, Visual>

  constructor(base: Visual, formas: Record<string, Visual>) {
    this.base = base
    this.formas = formas
    this.ativo = base
    this.objetos = [...base.objetos, ...Object.values(formas).flatMap((v) => v.objetos)]
    for (const v of Object.values(formas)) for (const o of v.objetos) o.visible = false
  }

  get info() {
    return this.base.info
  }
  get altura() {
    return this.ativo.altura
  }
  get alturaPx() {
    return this.ativo.alturaPx
  }

  tem(anim: Parameters<NonNullable<Visual['tem']>>[0], dir: Parameters<NonNullable<Visual['tem']>>[1]) {
    return this.ativo.tem?.(anim, dir) ?? true
  }

  mostrar(e: EstadoVisual, camera: THREE.PerspectiveCamera, telaL: number, telaA: number) {
    const quer = (this.forma && this.formas[this.forma]) || this.base
    if (quer !== this.ativo) {
      for (const o of this.ativo.objetos) o.visible = false
      for (const o of quer.objetos) o.visible = true
      this.ativo = quer
    }
    this.ativo.mostrar(e, camera, telaL, telaA)
  }
}
