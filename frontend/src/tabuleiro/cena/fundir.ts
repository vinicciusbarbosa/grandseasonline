import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Junta as peças paradas de um grupo numa malha por material (mesma sombra):
 * o navio tem ~900 peças (balaústres, degraus, cordas...) e cada uma era uma
 * chamada de desenho, duas com a sombra. Ficam de fora as que mudam depois:
 * `userData.oclusor` (velas e mastros, que fazem sombra nos personagens),
 * `userData.ondula` (bandeiras) e o que estiver dentro de um
 * `userData.modelo` (os props trocados pelo .glb quando ele carrega).
 */
export function fundirEstaticos(raiz: THREE.Object3D) {
  raiz.updateMatrixWorld(true)
  const inv = raiz.matrixWorld.clone().invert()
  const grupos = new Map<string, { mat: THREE.Material; sombra: boolean; recebe: boolean; geos: THREE.BufferGeometry[] }>()
  const fundidos: THREE.Mesh[] = []
  const visitar = (o: THREE.Object3D) => {
    if (o.userData.modelo) return
    for (const f of [...o.children]) visitar(f)
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o instanceof THREE.SkinnedMesh) return
    if (o.userData.oclusor || o.userData.ondula || Array.isArray(o.material)) return
    const g = preparar(o.geometry)
    if (!g) return
    g.applyMatrix4(inv.clone().multiply(o.matrixWorld))
    const chave = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`
    let gr = grupos.get(chave)
    if (!gr) grupos.set(chave, (gr = { mat: o.material, sombra: o.castShadow, recebe: o.receiveShadow, geos: [] }))
    gr.geos.push(g)
    fundidos.push(o)
  }
  visitar(raiz)
  for (const o of fundidos) o.removeFromParent()
  for (const gr of grupos.values()) {
    const geo = mergeGeometries(gr.geos, false)
    for (const g of gr.geos) g.dispose()
    if (!geo) continue
    const m = new THREE.Mesh(geo, gr.mat)
    m.castShadow = gr.sombra
    m.receiveShadow = gr.recebe
    m.matrixAutoUpdate = false
    raiz.add(m)
  }
  // grupos que ficaram vazios
  const vazios: THREE.Object3D[] = []
  raiz.traverse((o) => {
    if (o !== raiz && o.type === 'Group' && !o.children.length && !o.userData.modelo) vazios.push(o)
  })
  for (const v of vazios) v.removeFromParent()
}

/** cópia só com posição, normal e uv, sempre indexada (para juntar sem erro) */
function preparar(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position')
  if (!pos) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', pos.clone())
  if (geo.getAttribute('normal')) g.setAttribute('normal', geo.getAttribute('normal').clone())
  g.setAttribute('uv', geo.getAttribute('uv') ? geo.getAttribute('uv').clone() : new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2))
  if (geo.index) g.setIndex(geo.index.clone())
  else g.setIndex([...Array(pos.count).keys()])
  if (!geo.getAttribute('normal')) g.computeVertexNormals()
  return g
}
