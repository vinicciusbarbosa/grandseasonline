import * as THREE from 'three'

/**
 * Coloca um sprite de pixel art na cena 3D com um texel = um pixel da tela:
 * projeta o ponto de apoio, arredonda para o pixel e desprojeta de volta, e
 * ajusta a escala à profundidade. Assim nada fica borrado nem "tremendo".
 */
/**
 * Zoom da câmera: um pixel da arte vira `zoom` pixels da cena (abaixo de 1 no
 * tabuleiro inteiro, quando a arte nativa é maior que a tela comporta).
 */
export const escalaPixel = { zoom: 1 }

/** Largura (px da arte) de uma casa: o personagem de 176 px cabe numa casa. */
export const PX_CASA = 108
/** Arte antiga (bonecos/poeira) foi feita para casas de 64 px. */
export const ESCALA_ARTE_ANTIGA = PX_CASA / 64

export function posicionarPixel(
  sprite: THREE.Sprite,
  apoio: THREE.Vector3,
  largura: number,
  altura: number,
  camera: THREE.PerspectiveCamera,
  telaL: number,
  telaA: number,
  espelha = false,
  paraCamera = 0.45,
  desvio: [number, number] = [0, 0],
) {
  const ndc = apoio.clone().project(camera)
  const px = Math.round(((ndc.x + 1) / 2) * telaL) + Math.round(desvio[0] * escalaPixel.zoom)
  const py = Math.round(((1 - ndc.y) / 2) * telaA) + Math.round(desvio[1] * escalaPixel.zoom)
  const recuo = camera.position.clone().sub(apoio).normalize().multiplyScalar(paraCamera)
  const ndcZ = apoio.clone().add(recuo).project(camera).z
  const alinhado = new THREE.Vector3((px / telaL) * 2 - 1, 1 - (py / telaA) * 2, ndcZ).unproject(camera)
  sprite.position.copy(alinhado)
  const prof = -alinhado.clone().applyMatrix4(camera.matrixWorldInverse).z
  const porPixel = (2 * prof * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / telaA
  const z = escalaPixel.zoom
  sprite.scale.set(largura * porPixel * z * (espelha ? -1 : 1), altura * porPixel * z, 1)
}

/** Textura de canvas com filtro de pixel. */
export function texturaPixel(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
