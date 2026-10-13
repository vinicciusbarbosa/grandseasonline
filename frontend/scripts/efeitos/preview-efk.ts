/**
 * Pré-visualização dos efeitos (sem o jogo): /preview-efk.html?fx=nuvem|prisao
 * Um pedaço de convés (casas de 1×1), quem lança em (0,0,0) e o alvo 3 casas
 * à frente. window.passo(n) avança n quadros (60 fps) e desenha; usado pelos
 * scripts de captura para montar GIFs.
 */
import * as THREE from 'three'
import { EfeitoEfk, carregarEfk, type DadosEfk } from '../../src/tabuleiro/cena/efk'

const W = 800, H = 500
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(W, H)
document.body.appendChild(renderer.domElement)
const cena = new THREE.Scene()
cena.background = new THREE.Color(0x2a2f3a)
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100)
camera.position.set(3.2, 6.2, 7.5)
camera.lookAt(0, 0.4, 1.6)
cena.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.2))
// convés: tábuas em xadrez
for (let x = -4; x <= 4; x++)
  for (let z = -2; z <= 6; z++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshLambertMaterial({ color: (x + z) % 2 ? 0x8a5a32 : 0x7a4e2a }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0, z)
    cena.add(m)
  }
const boneco = (z: number, cor: number) => {
  const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 12), new THREE.MeshLambertMaterial({ color: cor }))
  g.position.set(0, 0.6, z)
  cena.add(g)
}
boneco(0, 0x3a6fd8)
boneco(3, 0xd84a3a)

const efeitos: EfeitoEfk[] = []
const tocar = (nome: string, d: DadosEfk, onde: THREE.Vector3, alvo?: THREE.Vector3) => {
  const ef = new EfeitoEfk(nome, d, { origem: onde.clone(), alvo, escala: 0.25, camera })
  ef.sprite.position.copy(onde)
  if (alvo) ef.sprite.rotation.set(0, Math.atan2(alvo.x - onde.x, alvo.z - onde.z), 0)
  cena.add(ef.sprite)
  efeitos.push(ef)
  return ef
}

const fx = new URLSearchParams(location.search).get('fx') ?? 'nuvem'
const agenda: [number, () => void][] = []
let q = 0
;(async () => {
  const jato = (await carregarEfk('fumaca-jato'))!
  const alvo = new THREE.Vector3(0, 0, 3)
  const j = tocar('fumaca-jato', jato, new THREE.Vector3(0, 0, 0), alvo)
  if (fx === 'prisao') {
    const pr = (await carregarEfk('fumaca-prisao'))!
    agenda.push([j.quadroImpacto, () => tocar('fumaca-prisao', pr, alvo)])
  } else {
    const nv = (await carregarEfk('fumaca-nuvem'))!
    agenda.push([j.quadroImpacto, () => [-1, 0, 1].forEach((x) => tocar('fumaca-nuvem', nv, new THREE.Vector3(x, 0, 3)))])
  }
  ;(window as unknown as { pronto: boolean }).pronto = true
})()

;(window as unknown as { passo: (n: number) => void }).passo = (n: number) => {
  for (let k = 0; k < n; k++) {
    q++
    for (const [qq, f] of agenda) if (qq === q) f()
    for (const e of efeitos) if (e.vivo) e.atualizar(1 / 60)
  }
  renderer.render(cena, camera)
}
renderer.render(cena, camera)
