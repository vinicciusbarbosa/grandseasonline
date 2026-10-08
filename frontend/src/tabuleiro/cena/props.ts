import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { recurso } from './visualFolhas'

/**
 * Props do navio em modelos 3D baixados (public/modelos/props/, convertidos por
 * scripts/modelos/props_glb.py): cada um entra no lugar do prop feito por
 * código, no mesmo tamanho, quando o .glb carrega; sem ele, fica o de código.
 */

const cache = new Map<string, Promise<THREE.Object3D | null>>()

/**
 * Peça solta (o cano do canhão) deitada: o eixo mais comprido dela (pelos
 * vértices) vira o Z, mantendo para que lado a ponta apontava
 */
function alinharEixo(raiz: THREE.Group) {
  const pts: THREE.Vector3[] = []
  for (const m of raiz.children as THREE.Mesh[]) {
    const pos = m.geometry.getAttribute('position')
    const passo = Math.max(1, Math.floor(pos.count / 2000))
    for (let i = 0; i < pos.count; i += passo) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrix))
  }
  const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length)
  // eixo principal por iteração de potência na covariância
  let eixo = new THREE.Vector3(0, 0, 1)
  for (let k = 0; k < 20; k++) {
    const n = new THREE.Vector3()
    for (const v of pts) {
      const d = v.clone().sub(c)
      n.addScaledVector(d, d.dot(eixo))
    }
    eixo = n.normalize()
  }
  if (eixo.z > 0) eixo.negate()
  const q = new THREE.Quaternion().setFromUnitVectors(eixo, new THREE.Vector3(0, 0, -1))
  for (const m of raiz.children) m.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q))
}

/** o modelo (ou só a peça `peca` dele), com material Lambert da cor, como o resto do navio */
function carregar(nome: string, peca?: string) {
  const chave = `${nome}#${peca ?? ''}`
  let p = cache.get(chave)
  if (!p) {
    p = new GLTFLoader()
      .loadAsync(recurso(`${import.meta.env.BASE_URL}modelos/props/${nome}.glb`))
      .then((g) => {
        g.scene.updateMatrixWorld(true)
        const raiz = new THREE.Group()
        g.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || (peca && !o.name.startsWith(peca))) return
          const map = (o.material as THREE.MeshStandardMaterial).map
          const m = new THREE.Mesh(o.geometry, new THREE.MeshLambertMaterial({ map }))
          m.applyMatrix4(o.matrixWorld)
          m.castShadow = true
          m.receiveShadow = true
          raiz.add(m)
        })
        if (peca && raiz.children.length) alinharEixo(raiz)
        return raiz.children.length ? raiz : null
      })
      .catch(() => null)
    cache.set(chave, p)
  }
  return p
}

/**
 * Troca o que está dentro de `alvo` pelo modelo, encaixado na caixa do prop de
 * código (a maior medida igual, assentado no mesmo chão, centrado);
 * `giro` vira o modelo em Y antes (para apontar como o de código).
 */
export function trocarPorModelo(alvo: THREE.Group, nome: string, op: { peca?: string; giro?: number } = {}) {
  // caixa no espaço do próprio alvo (ele ainda nem está na cena)
  const caixa = new THREE.Box3()
  alvo.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const mat = new THREE.Matrix4()
    for (let p: THREE.Object3D | null = o; p && p !== alvo; p = p.parent) mat.premultiply(p.matrix.compose(p.position, p.quaternion, p.scale))
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
    caixa.union(o.geometry.boundingBox!.clone().applyMatrix4(mat))
  })
  void carregar(nome, op.peca).then((modelo) => {
    if (!modelo || caixa.isEmpty()) return
    const m = modelo.clone()
    m.rotation.y = op.giro ?? 0
    m.updateMatrixWorld(true)
    const t = new THREE.Box3().setFromObject(m)
    const tam = caixa.getSize(new THREE.Vector3())
    const k = Math.max(tam.x, tam.y, tam.z) / Math.max(...t.getSize(new THREE.Vector3()).toArray())
    m.scale.setScalar(k)
    m.updateMatrixWorld(true)
    const t2 = new THREE.Box3().setFromObject(m)
    const c = caixa.getCenter(new THREE.Vector3())
    const c2 = t2.getCenter(new THREE.Vector3())
    m.position.set(c.x - c2.x, caixa.min.y - t2.min.y, c.z - c2.z)
    alvo.clear()
    alvo.add(m)
  })
  return alvo
}
