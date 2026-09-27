import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MToonMaterial, VRM, VRMLoaderPlugin, VRMUtils, type VRMHumanBoneName } from '@pixiv/three-vrm'
import { ANIMACOES, type Extra, type Posavel } from '../boneco/animacoes'
import type { NomeOsso } from '../boneco/boneco'

/**
 * Personagem de anime (modelo .vrm do VRoid) animado com as mesmas poses do
 * boneco: um esqueleto "fantasma" com os ossos do boneco recebe a pose e ela
 * é traduzida para os ossos humanoides do VRM. Cabelo e roupa balançam pela
 * física de molas do próprio VRM. A espada vai presa na mão direita.
 */

/** Esqueleto só de ossos, com a mesma hierarquia/medidas do boneco. */
export class Esqueleto implements Posavel {
  readonly raiz = new THREE.Group()
  readonly ossos = {} as Record<NomeOsso, THREE.Object3D>
  private readonly repouso = new Map<THREE.Object3D, THREE.Vector3>()

  constructor() {
    const O = (nome: NomeOsso, pai: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Group()
      o.position.set(x, y, z)
      pai.add(o)
      this.ossos[nome] = o
      this.repouso.set(o, o.position.clone())
      return o
    }
    const quadril = O('quadril', this.raiz, 0, 0.94, 0)
    for (const [l, s] of [['E', 1], ['D', -1]] as const) {
      const coxa = O(`coxa${l}`, quadril, 0.12 * s, -0.02, 0)
      const canela = O(`canela${l}`, coxa, 0, -0.42, 0)
      O(`pe${l}`, canela, 0, -0.42, 0)
    }
    const tronco = O('tronco', quadril, 0, 0.12, 0)
    const peito = O('peito', tronco, 0, 0.24, 0)
    const pescoco = O('pescoco', peito, 0, 0.3, 0)
    O('cabeca', pescoco, 0, 0.08, 0)
    for (const [l, s] of [['E', 1], ['D', -1]] as const) {
      const braco = O(`braco${l}`, peito, 0.33 * s, 0.19, 0)
      const ante = O(`antebraco${l}`, braco, 0, -0.3, 0)
      O(`mao${l}`, ante, 0, -0.29, 0)
    }
    O('espada', this.ossos.maoD, 0, -0.04, 0)
  }

  zerar() {
    for (const [o, p] of this.repouso) {
      o.position.copy(p)
      o.rotation.set(0, 0, 0)
    }
    this.raiz.position.set(0, 0, 0)
    this.raiz.rotation.set(0, 0, 0)
  }
}

const MAPA: [NomeOsso, VRMHumanBoneName, 'E' | 'D' | null][] = [
  ['tronco', 'spine', null],
  ['peito', 'chest', null],
  ['pescoco', 'neck', null],
  ['cabeca', 'head', null],
  ['coxaE', 'leftUpperLeg', null],
  ['canelaE', 'leftLowerLeg', null],
  ['peE', 'leftFoot', null],
  ['coxaD', 'rightUpperLeg', null],
  ['canelaD', 'rightLowerLeg', null],
  ['peD', 'rightFoot', null],
  ['bracoE', 'leftUpperArm', 'E'],
  ['antebracoE', 'leftLowerArm', 'E'],
  ['maoE', 'leftHand', 'E'],
  ['bracoD', 'rightUpperArm', 'D'],
  ['antebracoD', 'rightLowerArm', 'D'],
  ['maoD', 'rightHand', 'D'],
]

// No VRM os braços descansam abertos (pose T); no boneco, caídos ao lado do corpo.
const BAIXA = {
  E: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  D: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
}

const carregador = new GLTFLoader()
carregador.register((parser) => new VRMLoaderPlugin(parser))

export async function carregarVrm(url: string) {
  const gltf = await carregador.loadAsync(url)
  const vrm = gltf.userData.vrm as VRM
  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  vrm.scene.traverse((o) => {
    o.frustumCulled = false
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = true
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        // contorno um pouco mais grosso: o personagem fica pequeno na tela
        if (mat instanceof MToonMaterial && mat.outlineWidthMode !== 'none') mat.outlineWidthFactor = 0.004
      }
    }
  })
  return vrm
}

function espadaMalha() {
  const g = new THREE.Group()
  const forma = new THREE.Shape()
  forma.moveTo(-0.022, 0.12)
  forma.quadraticCurveTo(-0.03, 0.55, -0.08, 0.98)
  forma.quadraticCurveTo(0.02, 0.8, 0.045, 0.55)
  forma.lineTo(0.032, 0.12)
  forma.lineTo(-0.022, 0.12)
  const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.018, bevelEnabled: false })
  geo.translate(0, 0, -0.009)
  const lam = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: 0xdfe6f0 }))
  lam.rotation.x = Math.PI / 2
  const guarda = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI * 1.2), new THREE.MeshToonMaterial({ color: 0xe0a83a }))
  guarda.position.z = 0.1
  guarda.rotation.y = Math.PI / 2
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8), new THREE.MeshToonMaterial({ color: 0x3a2418 }))
  cabo.rotation.x = Math.PI / 2
  cabo.position.z = 0.02
  g.add(lam, guarda, cabo)
  g.traverse((o) => (o.castShadow = true))
  return g
}

export type NomeAnimVrm = keyof typeof ANIMACOES

export class PersonagemVrm {
  readonly vrm: VRM
  readonly grupo = new THREE.Group()
  readonly esq = new Esqueleto()
  /** ponta da lâmina no espaço do osso da espada (igual ao boneco) */
  readonly ponta = new THREE.Vector3(-0.08 * 0.72, 0, 0.98 * 0.72)
  readonly espada: THREE.Group
  private readonly alturaQuadril: number
  private readonly quadrilRepouso: THREE.Vector3
  /** giro para onde o personagem olha (rad em torno de Y) */
  giro = 0

  constructor(vrm: VRM) {
    this.vrm = vrm
    this.grupo.add(vrm.scene)
    const h = vrm.humanoid
    this.quadrilRepouso = h.getNormalizedBoneNode('hips')!.position.clone()
    this.alturaQuadril = this.quadrilRepouso.y
    // espada: o encaixe compensa a diferença entre a mão do VRM e a do boneco
    this.espada = espadaMalha()
    this.espada.scale.setScalar(0.72)
    const encaixe = new THREE.Group()
    encaixe.quaternion.copy(BAIXA.D).invert()
    const noOsso = new THREE.Group()
    noOsso.position.set(0, -0.04, 0)
    noOsso.add(this.espada)
    encaixe.add(noOsso)
    h.getNormalizedBoneNode('rightHand')!.add(encaixe)
    this.espadaOsso = noOsso
  }

  private readonly espadaOsso: THREE.Group

  /** Posa o VRM na animação `nome`, fase t (0–1). */
  posar(nome: NomeAnimVrm, t: number): Extra {
    const esq = this.esq
    esq.zerar()
    const extra = ANIMACOES[nome].pose(esq, t)
    const h = this.vrm.humanoid
    const k = this.alturaQuadril / 0.94
    const hips = h.getNormalizedBoneNode('hips')!
    hips.position.copy(this.quadrilRepouso)
    hips.position.y += (esq.ossos.quadril.position.y - 0.94) * k
    // avanço do corpo (estocada) e giro
    hips.position.z += esq.raiz.position.z * k
    hips.position.x += esq.raiz.position.x * k
    hips.quaternion.copy(esq.ossos.quadril.quaternion)
    const inv = new THREE.Quaternion()
    for (const [meu, dele, lado] of MAPA) {
      const no = h.getNormalizedBoneNode(dele)
      if (!no) continue
      const q = esq.ossos[meu].quaternion
      if (!lado) no.quaternion.copy(q)
      else if (meu.startsWith('braco')) no.quaternion.copy(q).multiply(BAIXA[lado])
      else {
        inv.copy(BAIXA[lado]).invert()
        no.quaternion.copy(inv).multiply(q).multiply(BAIXA[lado])
      }
    }
    this.espadaOsso.quaternion.copy(esq.ossos.espada.quaternion)
    this.vrm.scene.rotation.y = this.giro
    return extra
  }

  atualizar(dt: number) {
    this.vrm.update(dt)
  }

  /** Posição da ponta e do meio da lâmina no mundo. */
  lamina() {
    this.grupo.updateMatrixWorld(true)
    const p = this.ponta.clone()
    const m = this.ponta.clone().multiplyScalar(0.3)
    this.espadaOsso.localToWorld(p)
    this.espadaOsso.localToWorld(m)
    return { ponta: p, meio: m }
  }
}
