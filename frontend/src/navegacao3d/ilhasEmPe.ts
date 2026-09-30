import * as THREE from 'three'
import ilhasModeladas from '../navegacao/mundo/ilhas.json'
import { CONSTRUTORES } from '../navegacao/cena/ilhas3d/objetos'
import { aleatorio, Pecas } from '../navegacao/cena/ilhas3d/pecas'
import { arvores, MapaIlha, malhaTerreno, type Bloqueio, type MetaIlha } from '../navegacao/cena/ilhas3d/terreno'

const MODELADAS = ilhasModeladas as unknown as MetaIlha[]

/**
 * As ilhas modeladas (as mesmas que a navegação 2D "fotografa" de cima),
 * montadas em 3D de verdade para serem vistas de qualquer ângulo.
 */
export async function montarIlhas(cena: THREE.Scene) {
  const base = import.meta.env.BASE_URL
  await Promise.all(
    MODELADAS.map(async (meta) => {
      const img = new Image()
      img.src = `${base}mundo/ilhas/${meta.id}.png`
      await img.decode()
      const tela = document.createElement('canvas')
      tela.width = meta.colunas
      tela.height = meta.linhas
      const ctx = tela.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const mapa = new MapaIlha(meta, ctx.getImageData(0, 0, meta.colunas, meta.linhas))
      const grupo = new THREE.Group()
      grupo.name = meta.nome
      grupo.add(malhaTerreno(mapa))
      const pecas = new Pecas()
      const bloqueios: Bloqueio = []
      const rng = aleatorio(meta.id * 1013)
      for (const o of meta.objetos) {
        const construtor = CONSTRUTORES[o.t]
        if (!construtor) continue
        const antes = pecas.total
        bloqueios.push(...construtor(pecas, o, mapa, rng))
        pecas.marcar(antes)
      }
      const objetos = pecas.malha(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }))
      if (objetos) grupo.add(objetos)
      for (const a of arvores(mapa, bloqueios)) grupo.add(a)
      cena.add(grupo)
    }),
  )
}
