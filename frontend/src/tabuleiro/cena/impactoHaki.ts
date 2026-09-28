import * as THREE from 'three'
import { MADEIRA, rng } from './texturas'

/**
 * Onde um raio do Haki do Rei bate no convés: a madeira arrebenta.
 *
 * - buraco no chão: tábuas partidas, pontas lascadas e o escuro do porão,
 *   (fica e depois some);
 * - pedaços de tábua em 3D voando, girando, quicando no convés e parando;
 * - explosão curta (clarão laranja-avermelhado com anel de choque);
 * - poeira: nuvens bege que sobem, crescem e se desfazem.
 */

const VIDA = 2.6 // s até o buraco sumir
const PX = 256

const cor = (i: number, d = 0) => {
  const [r, g, b] = MADEIRA[Math.max(0, Math.min(MADEIRA.length - 1, i))]
  return `rgb(${Math.min(255, r + d)},${Math.min(255, g + d)},${Math.min(255, b + d)})`
}

function tela() {
  const c = document.createElement('canvas')
  c.width = c.height = PX
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return { c, g: c.getContext('2d')!, t }
}

/** Buraco com tábuas partidas (vista de cima), já desenhado. */
function texturaBuraco(semente: number) {
  const { g, t } = tela()
  const r = rng(semente)
  const c = PX / 2
  // contorno irregular do rombo
  const n = 14
  const borda: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const raio = PX * (0.16 + r() * 0.12) * (i % 2 ? 0.75 : 1.1)
    borda.push([c + Math.cos(a) * raio, c + Math.sin(a) * raio])
  }
  // tábuas afundadas/lascadas em volta (em raio, como madeira arrebentada)
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2
    const d0 = PX * (0.12 + r() * 0.1)
    const comp = PX * (0.12 + r() * 0.2)
    const larg = 6 + r() * 8
    g.save()
    g.translate(c + Math.cos(a) * d0, c + Math.sin(a) * d0)
    g.rotate(a + (r() - 0.5) * 0.6)
    g.fillStyle = cor(2 + Math.floor(r() * 3))
    g.beginPath()
    g.moveTo(0, -larg / 2)
    g.lineTo(comp, -larg / 2 + (r() - 0.5) * 4)
    g.lineTo(comp * (0.8 + r() * 0.2), 0)
    g.lineTo(comp, larg / 2)
    g.lineTo(0, larg / 2)
    g.closePath()
    g.fill()
    g.fillStyle = cor(0, 10)
    g.fillRect(0, -larg / 2, comp * 0.9, 1.5)
    g.fillStyle = cor(6)
    g.fillRect(0, larg / 2 - 1.5, comp * 0.9, 1.5)
    g.restore()
  }
  // o rombo: escuro do porão, com lascas pontudas para dentro
  g.fillStyle = 'rgb(16,8,6)'
  g.beginPath()
  borda.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  g.fill()
  for (let i = 0; i < n; i++) {
    const [x, y] = borda[i]
    const a = Math.atan2(y - c, x - c) + Math.PI
    g.fillStyle = cor(3 + Math.floor(r() * 2))
    g.beginPath()
    g.moveTo(x + Math.cos(a + 1.6) * 5, y + Math.sin(a + 1.6) * 5)
    g.lineTo(x + Math.cos(a) * (10 + r() * 16), y + Math.sin(a) * (10 + r() * 16))
    g.lineTo(x + Math.cos(a - 1.6) * 5, y + Math.sin(a - 1.6) * 5)
    g.fill()
  }
  // fuligem em volta
  const f = g.createRadialGradient(c, c, PX * 0.2, c, c, PX * 0.48)
  f.addColorStop(0, 'rgba(20,10,8,0.35)')
  f.addColorStop(1, 'rgba(20,10,8,0)')
  g.globalCompositeOperation = 'destination-over'
  g.fillStyle = f
  g.fillRect(0, 0, PX, PX)
  t.needsUpdate = true
  return t
}

let texPoeira: THREE.Texture | null = null
function poeira() {
  if (texPoeira) return texPoeira
  const { g, t } = tela()
  const c = PX / 2
  // nuvem em "bolotas" com luz de cima (pixelado em 3 tons)
  const bolas = [[0, 0, 0.3], [-0.18, 0.06, 0.2], [0.17, 0.05, 0.22], [-0.06, -0.14, 0.2], [0.1, -0.12, 0.17]]
  for (const [k, cores] of [[1, 'rgba(120,98,80,1)'], [0.92, 'rgba(190,168,140,1)'], [0.7, 'rgba(228,214,190,1)']] as const) {
    g.fillStyle = cores
    for (const [x, y, rr] of bolas) {
      g.beginPath()
      g.arc(c + x * PX, c + y * PX - (1 - k) * 18, rr * PX * k, 0, Math.PI * 2)
      g.fill()
    }
  }
  t.needsUpdate = true
  texPoeira = t
  return t
}

type Pedaco = { m: THREE.Mesh; v: THREE.Vector3; giro: THREE.Vector3; parado: boolean }
type Nuvem = { s: THREE.Sprite; v: THREE.Vector3; t: number; vida: number; tam: number }

export class ImpactoHaki {
  readonly objetos: THREE.Object3D[]
  vivo = true
  private t = 0
  private readonly buraco: THREE.Mesh
  private readonly matBuraco: THREE.MeshBasicMaterial
  private readonly explosao = tela()
  private readonly spriteExplosao: THREE.Sprite
  private readonly pedacos: Pedaco[] = []
  private readonly nuvens: Nuvem[] = []
  private readonly grupo = new THREE.Group()

  constructor(pos: THREE.Vector3, tamanho: number) {
    this.matBuraco = new THREE.MeshBasicMaterial({ map: texturaBuraco(Math.floor(Math.random() * 1e6)), transparent: true, depthWrite: false })
    this.buraco = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * tamanho, 1.5 * tamanho), this.matBuraco)
    this.buraco.rotation.x = -Math.PI / 2
    this.buraco.rotation.z = Math.random() * Math.PI * 2
    this.buraco.position.set(pos.x, 0.016, pos.z)
    this.buraco.renderOrder = 0

    this.spriteExplosao = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.explosao.t, transparent: true, depthWrite: false }))
    this.spriteExplosao.scale.set(2.2 * tamanho, 2.2 * tamanho, 1)
    this.spriteExplosao.center.set(0.5, 0.3)
    this.spriteExplosao.position.set(pos.x, 0.05, pos.z)
    this.spriteExplosao.renderOrder = 3

    // pedaços de tábua em 3D
    const n = Math.round(10 + 6 * tamanho)
    for (let i = 0; i < n; i++) {
      const comp = 0.12 + Math.random() * 0.32
      const geo = new THREE.BoxGeometry(comp, 0.04 + Math.random() * 0.03, 0.06 + Math.random() * 0.08)
      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(cor(1 + Math.floor(Math.random() * 4))), transparent: true })
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = true
      m.position.set(pos.x + (Math.random() - 0.5) * 0.3, 0.05, pos.z + (Math.random() - 0.5) * 0.3)
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      const a = Math.random() * Math.PI * 2
      const h = 1.2 + Math.random() * 3 * tamanho
      this.pedacos.push({
        m,
        v: new THREE.Vector3(Math.cos(a) * h, 3.5 + Math.random() * 4.5 * tamanho, Math.sin(a) * h),
        giro: new THREE.Vector3((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22),
        parado: false,
      })
      this.grupo.add(m)
    }

    // poeira
    const nn = Math.round(7 + 4 * tamanho)
    for (let i = 0; i < nn; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: poeira(), transparent: true, depthWrite: false, opacity: 0 }))
      const a = Math.random() * Math.PI * 2
      const v = 0.6 + Math.random() * 1.6
      s.position.set(pos.x + Math.cos(a) * 0.15, 0.2 + Math.random() * 0.3, pos.z + Math.sin(a) * 0.15)
      s.material.rotation = Math.random() * Math.PI * 2
      s.renderOrder = 3
      this.nuvens.push({ s, v: new THREE.Vector3(Math.cos(a) * v, 0.5 + Math.random() * 0.8, Math.sin(a) * v), t: -Math.random() * 0.12, vida: 1 + Math.random() * 0.9, tam: (0.7 + Math.random() * 0.7) * tamanho })
      this.grupo.add(s)
    }
    this.objetos = [this.buraco, this.grupo, this.spriteExplosao]
  }

  atualizar(dt: number) {
    this.t += dt
    if (this.t >= VIDA) {
      this.vivo = false
      return
    }
    // buraco: fica e some no fim
    this.matBuraco.opacity = this.t < VIDA * 0.65 ? 1 : 1 - (this.t - VIDA * 0.65) / (VIDA * 0.35)

    // tábuas: gravidade, quique, atrito, param e desaparecem no fim
    for (const p of this.pedacos) {
      if (!p.parado) {
        p.v.y -= 14 * dt
        p.m.position.addScaledVector(p.v, dt)
        p.m.rotation.x += p.giro.x * dt
        p.m.rotation.y += p.giro.y * dt
        p.m.rotation.z += p.giro.z * dt
        if (p.m.position.y < 0.03) {
          p.m.position.y = 0.03
          if (Math.abs(p.v.y) < 1.2) {
            p.parado = true
            p.m.rotation.x = Math.round(p.m.rotation.x / Math.PI) * Math.PI
            p.m.rotation.z = Math.round(p.m.rotation.z / Math.PI) * Math.PI
          } else {
            p.v.y *= -0.32
            p.v.x *= 0.55
            p.v.z *= 0.55
            p.giro.multiplyScalar(0.5)
          }
        }
      }
      ;(p.m.material as THREE.MeshLambertMaterial).opacity = this.t < VIDA * 0.7 ? 1 : 1 - (this.t - VIDA * 0.7) / (VIDA * 0.3)
    }

    // poeira: sobe, espalha, cresce e se desfaz
    for (const n of this.nuvens) {
      n.t += dt
      if (n.t < 0) continue
      const k = n.t / n.vida
      n.s.position.addScaledVector(n.v, dt)
      n.v.multiplyScalar(1 - 2.2 * dt)
      const sc = n.tam * (0.5 + 1.1 * Math.sqrt(Math.min(1, k)))
      n.s.scale.set(sc, sc, 1)
      n.s.material.opacity = k < 0.15 ? k / 0.15 * 0.9 : Math.max(0, 0.9 * (1 - (k - 0.15) / 0.85))
    }

    // explosão: clarão laranja-avermelhado e anel, bem curta
    const { g, t } = this.explosao
    g.clearRect(0, 0, PX, PX)
    const k = this.t / 0.35
    if (k < 1) {
      const cx = PX / 2
      const cy = PX * 0.7
      g.save()
      g.translate(cx, cy)
      g.scale(1, 0.6)
      const raio = PX * (0.1 + 0.34 * Math.sqrt(k))
      const bola = g.createRadialGradient(0, 0, 0, 0, 0, raio)
      bola.addColorStop(0, `rgba(255,245,220,${1 - k})`)
      bola.addColorStop(0.35, `rgba(255,150,60,${0.95 * (1 - k)})`)
      bola.addColorStop(0.7, `rgba(200,90,40,${0.6 * (1 - k)})`)
      bola.addColorStop(1, 'rgba(90,50,30,0)')
      g.fillStyle = bola
      g.beginPath()
      g.arc(0, 0, raio, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = `rgba(255,200,170,${1 - k})`
      g.lineWidth = 5 * (1 - k) + 1
      g.beginPath()
      g.arc(0, 0, raio * 1.15, 0, Math.PI * 2)
      g.stroke()
      g.restore()
      // lascas finas voando (riscos)
      g.strokeStyle = `rgba(210,160,110,${1 - k})`
      g.lineWidth = 2
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * (0.1 + (i / 10) * 0.8)
        const d0 = PX * 0.08 + k * PX * 0.35
        g.beginPath()
        g.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0 * 0.8)
        g.lineTo(cx + Math.cos(a) * (d0 + 14), cy + Math.sin(a) * (d0 + 14) * 0.8)
        g.stroke()
      }
    }
    t.needsUpdate = true
  }

  descartar() {
    this.matBuraco.map?.dispose()
    this.matBuraco.dispose()
    this.explosao.t.dispose()
    for (const p of this.pedacos) {
      p.m.geometry.dispose()
      ;(p.m.material as THREE.Material).dispose()
    }
    for (const n of this.nuvens) n.s.material.dispose()
  }
}
