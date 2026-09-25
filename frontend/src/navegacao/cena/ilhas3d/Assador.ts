import type Phaser from 'phaser'
import * as THREE from 'three'
import { ACHATAMENTO, ELEVACAO } from '../projecao'
import { ESCALA_ASSADA } from './escala'
import { CONSTRUTORES } from './objetos'
import { aleatorio, Pecas } from './pecas'
import { arvores, MapaIlha, malhaTerreno, type Bloqueio, type MetaIlha } from './terreno'

/**
 * "Assa" as ilhas: monta cada uma em 3D (Three.js) com a mesma câmera
 * inclinada do jogo e renderiza UMA vez em imagens, que viram texturas do
 * Phaser. Na hora de jogar é só desenhar imagens — zero custo de 3D.
 *
 * A ilha sai fatiada em faixas horizontais (de `FAIXA` px do mundo). Cada
 * faixa tem a profundidade do seu limite sul, então o navio que passa ao
 * norte de uma montanha fica atrás dela, e ao sul, na frente — igual a um
 * teste de profundidade de verdade: nessa câmera, o que está mais ao sul
 * sempre cobre o que está mais ao norte.
 */

export { ESCALA_ASSADA }
const FAIXA = 56

export type FaixaAssada = {
  chave: string
  /** Canto superior esquerdo, em coordenadas de TELA do mundo (já projetadas). */
  x: number
  y: number
  /** Limite sul da faixa, em y do mundo: vira a profundidade de desenho. */
  sul: number
}

export type IlhaAssada = { id: number; faixas: FaixaAssada[] }

const FRENTE = new THREE.Vector3(0, -ACHATAMENTO, -ELEVACAO)
const CIMA = new THREE.Vector3(0, ELEVACAO, -ACHATAMENTO)
const SOL = new THREE.Vector3(-0.55, 1.0, -0.5).normalize()

export class Assador {
  private readonly renderizador: THREE.WebGLRenderer

  constructor() {
    this.renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderizador.setPixelRatio(1)
    this.renderizador.setClearColor(0x000000, 0)
    this.renderizador.shadowMap.enabled = true
    this.renderizador.shadowMap.type = THREE.PCFShadowMap
    // Recorte por material (não global): assim a sombra continua vindo da ilha inteira.
    this.renderizador.localClippingEnabled = true
    this.renderizador.shadowMap.autoUpdate = false
  }

  destruir() {
    this.renderizador.dispose()
    this.renderizador.forceContextLoss()
  }

  assar(cena: Phaser.Scene, meta: MetaIlha, dados: ImageData): IlhaAssada {
    const mapa = new MapaIlha(meta, dados)
    const cena3d = new THREE.Scene()
    const terreno = malhaTerreno(mapa)
    cena3d.add(terreno)

    // Objetos (casas, muralhas, marcos) fundidos numa malha só.
    const pecas = new Pecas()
    const bloqueios: Bloqueio = []
    const rng = aleatorio(meta.id * 1013)
    for (const o of meta.objetos) {
      const construtor = CONSTRUTORES[o.t]
      if (!construtor) {
        console.warn(`ilha ${meta.nome}: objeto desconhecido "${o.t}"`)
        continue
      }
      const antes = pecas.total
      bloqueios.push(...construtor(pecas, o, mapa, rng))
      pecas.marcar(antes)
    }
    const objetos = pecas.malha(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }))
    if (objetos) cena3d.add(objetos)
    for (const a of arvores(mapa, bloqueios)) cena3d.add(a)

    const largura = (meta.colunas - 1) * meta.passo
    const profundidade = (meta.linhas - 1) * meta.passo
    const centro = new THREE.Vector3(meta.x + largura / 2, 0, meta.y + profundidade / 2)

    // Sombra projetada na água (só a sombra: o mar em si é o shader do jogo).
    // O ShadowMaterial não respeita planos de recorte: o plano é refeito do
    // tamanho exato de cada faixa (ver o laço abaixo).
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.22 }))
    agua.rotation.x = -Math.PI / 2
    agua.receiveShadow = true
    cena3d.add(agua)

    // Luz: céu claro + sol alto a noroeste (sombras caem para sudeste, para a câmera).
    cena3d.add(new THREE.HemisphereLight(0xe4f1ff, 0x5d6b3f, 1.7))
    const sol = new THREE.DirectionalLight(0xfff0d8, 2.7)
    sol.position.copy(centro).addScaledVector(SOL, 1500)
    sol.target.position.copy(centro)
    cena3d.add(sol.target)
    sol.castShadow = true
    const alcance = Math.max(largura, profundidade) * 0.62 + 120
    Object.assign(sol.shadow.camera, { left: -alcance, right: alcance, top: alcance, bottom: -alcance, near: 100, far: 3200 })
    sol.shadow.mapSize.set(4096, 4096)
    sol.shadow.bias = -0.0004
    sol.shadow.normalBias = 0.6
    sol.shadow.radius = 2.5
    cena3d.add(sol)

    const r = this.renderizador
    // Planos de recorte da faixa (norte, sul) e da linha d'água, em todos os materiais.
    const norte = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const sul = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
    const linhaDagua = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02)
    cena3d.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined
      if (mat) {
        mat.clippingPlanes = [norte, sul, linhaDagua]
        mat.clipShadows = false
      }
    })
    r.shadowMap.needsUpdate = true

    // Altura máxima de cada linha da grade (terreno + copa), para o topo de cada faixa.
    const topoLinha = new Float32Array(meta.linhas)
    const faixaX = { min: new Float32Array(meta.linhas).fill(Infinity), max: new Float32Array(meta.linhas).fill(-Infinity) }
    for (let j = 0; j < meta.linhas; j++) {
      let m = 0
      for (let i = 0; i < meta.colunas; i++) {
        const h = mapa.h[j * meta.colunas + i]
        if (h > 0) {
          m = Math.max(m, h)
          const x = meta.x + i * meta.passo
          faixaX.min[j] = Math.min(faixaX.min[j], x)
          faixaX.max[j] = Math.max(faixaX.max[j], x)
        }
      }
      topoLinha[j] = m
    }

    const faixas: FaixaAssada[] = []
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000)
    camera.up.copy(CIMA)
    for (let z0 = meta.y; z0 < meta.y + profundidade; z0 += FAIXA) {
      const z1 = Math.min(meta.y + profundidade, z0 + FAIXA)
      // Conteúdo da faixa: terreno das linhas dela + caixas dos objetos que a cruzam.
      let topo = 0
      let xMin = Infinity
      let xMax = -Infinity
      for (let j = Math.floor((z0 - meta.y) / meta.passo); j <= Math.ceil((z1 - meta.y) / meta.passo) && j < meta.linhas; j++) {
        if (topoLinha[j] > 0) topo = Math.max(topo, topoLinha[j] + 24)
        xMin = Math.min(xMin, faixaX.min[j])
        xMax = Math.max(xMax, faixaX.max[j])
      }
      for (const c of pecas.caixas) {
        if (c.max.z < z0 || c.min.z > z1) continue
        topo = Math.max(topo, c.max.y + 2)
        xMin = Math.min(xMin, c.min.x)
        xMax = Math.max(xMax, c.max.x)
      }
      if (!Number.isFinite(xMin) || topo <= 0) continue
      xMin = Math.floor(xMin - 16)
      xMax = Math.ceil(xMax + 16)

      const telaTopo = z0 * ACHATAMENTO - topo * ELEVACAO
      const telaBase = z1 * ACHATAMENTO + 2
      const pxL = Math.ceil((xMax - xMin) * ESCALA_ASSADA)
      const pxA = Math.ceil((telaBase - telaTopo) * ESCALA_ASSADA)
      const w = pxL / ESCALA_ASSADA
      const h = pxA / ESCALA_ASSADA
      const alvo = new THREE.Vector3(xMin + w / 2, 0, (telaTopo + h / 2) / ACHATAMENTO)
      camera.left = -w / 2
      camera.right = w / 2
      camera.top = h / 2
      camera.bottom = -h / 2
      camera.position.copy(alvo).addScaledVector(FRENTE, -3000)
      camera.lookAt(alvo)
      camera.updateProjectionMatrix()

      // Só o que está nesta faixa (com 1,5 px de sobra para não abrir fresta) e acima d'água.
      norte.constant = -(z0 - 0.5)
      sul.constant = z1 + 1.5
      agua.scale.set(largura + 240, z1 - z0 + 1, 1)
      agua.position.set(centro.x, 0.05, (z0 + z1) / 2)
      r.setSize(pxL, pxA, false)
      r.render(cena3d, camera)

      const tela = document.createElement('canvas')
      tela.width = pxL
      tela.height = pxA
      tela.getContext('2d')!.drawImage(r.domElement, 0, 0)
      const chave = `ilha-${meta.id}-${Math.round(z0)}`
      if (cena.textures.exists(chave)) cena.textures.remove(chave)
      cena.textures.addCanvas(chave, tela)
      faixas.push({ chave, x: xMin, y: telaTopo, sul: z1 })
    }

    // Libera a GPU do Three: as imagens já estão com o Phaser.
    cena3d.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    sol.shadow.map?.dispose()
    return { id: meta.id, faixas }
  }
}
