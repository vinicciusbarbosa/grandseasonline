import * as THREE from 'three'
import { recurso } from './visualFolhas'

/**
 * Tocador de efeitos do Effekseer, convertidos por
 * scripts/efeitos/efk_converter.py (projeto .efkproj -> efeito.json). Cobre o
 * que esses efeitos usam: sprite (billboard, eixo Y fixo, fixo), fita
 * (ribbon) e anel; posição fixa/PVA/curva, rotação fixa/PVA, escala
 * fixa/easing, geração em círculo, fade, UV fixo e rolando, mistura e soma.
 *
 * O efeito é desenhado em volta de quem lança (origem, olhando para +Z). Se o
 * efeito "vai" até um ponto (o Entei cai em Z = 18), as posições Z dos nós de
 * cima são esticadas para cair no alvo de verdade. Tempo em quadros de 60 fps.
 */

type Faixa = [number, number]
type Vet = [Faixa, Faixa, Faixa]
type No = {
  nome: string
  tipo: number
  vida: Faixa
  max: number
  intervalo: Faixa
  atraso: Faixa
  heranca: [number, number, number]
  comPai: boolean
  pos?: { t: 'fixo'; p: Vet } | { t: 'pva'; p: Vet; v: Vet; a: Vet } | { t: 'curva'; c: [number, number][][] }
  rot?: { t: 'fixo'; p: Vet } | { t: 'pva'; p: Vet; v: Vet; a: Vet }
  esc?: { t: 'fixo'; p: Vet } | { t: 'easing'; de: Vet; ate: Vet }
  circulo?: { eixo: number; div: number; ordem: number; raio: Faixa; a0: Faixa; a1: Faixa; ruido: Faixa }
  render?: {
    tex: string
    mistura: number
    fadeIn: number
    fadeOut: number
    uv?: { t: 'fixo' | 'rolar'; x: number; y: number; w: number; h: number; vx?: number; vy?: number }
  }
  sprite?: { billboard: number; cor: number[] }
  fita?: { l: number; r: number; cor: number[]; olho: number; uvTipo: number; tile: number }
  anel?: { vertices: number; fora: [number, number]; dentro: [number, number]; meio: number; corFora: number[]; corMeio: number[]; corDentro: number[] }
  filhos: No[]
}
export type DadosEfk = { fim: number; filhos: No[]; texturas: string[] }

const sorteio = (f: Faixa) => f[0] + Math.random() * (f[1] - f[0])
const vet = (v: Vet) => new THREE.Vector3(sorteio(v[0]), sorteio(v[1]), sorteio(v[2]))
const GRAU = Math.PI / 180

/** valor da curva no quadro (chaves lineares) */
function curva(ks: [number, number][], q: number) {
  if (q <= ks[0][0]) return ks[0][1]
  for (let i = 1; i < ks.length; i++) {
    if (q <= ks[i][0]) {
      const [a, va] = ks[i - 1]
      const [b, vb] = ks[i]
      return va + ((vb - va) * (q - a)) / Math.max(1e-6, b - a)
    }
  }
  return ks[ks.length - 1][1]
}

/** uma partícula/nó vivo */
class Inst {
  readonly no: No
  readonly pai: Inst | null
  readonly nasc: number
  readonly vida: number
  readonly indice: number
  idade = 0
  vivo = true
  readonly mundo = new THREE.Matrix4()
  /** mundo do pai no nascimento (herança "só ao nascer") */
  readonly paiNasc = new THREE.Matrix4()
  private readonly p0 = new THREE.Vector3()
  private readonly v0 = new THREE.Vector3()
  private readonly a0 = new THREE.Vector3()
  private readonly r0 = new THREE.Vector3()
  private readonly rv = new THREE.Vector3()
  private readonly ra = new THREE.Vector3()
  private readonly s0 = new THREE.Vector3(1, 1, 1)
  private readonly s1 = new THREE.Vector3(1, 1, 1)
  private readonly circ = new THREE.Vector3()
  /** geração dos filhos: quantos já nasceram e quando nasce o próximo (idade) */
  readonly geracao: { n: number; prox: number }[]
  readonly filhos: Inst[][] = []

  constructor(no: No, pai: Inst | null, nasc: number, indice: number) {
    this.no = no
    this.pai = pai
    this.nasc = nasc
    this.indice = indice
    this.vida = sorteio(no.vida)
    if (pai) this.paiNasc.copy(pai.mundo)
    const p = no.pos
    if (p?.t === 'fixo') this.p0.copy(vet(p.p))
    else if (p?.t === 'pva') {
      this.p0.copy(vet(p.p))
      this.v0.copy(vet(p.v))
      this.a0.copy(vet(p.a))
    }
    const r = no.rot
    if (r?.t === 'fixo') this.r0.copy(vet(r.p))
    else if (r?.t === 'pva') {
      this.r0.copy(vet(r.p))
      this.rv.copy(vet(r.v))
      this.ra.copy(vet(r.a))
    }
    const e = no.esc
    if (e?.t === 'fixo') this.s0.copy(vet(e.p)), this.s1.copy(this.s0)
    else if (e?.t === 'easing') this.s0.copy(vet(e.de)), this.s1.copy(vet(e.ate))
    const c = no.circulo
    if (c) {
      const a0 = sorteio(c.a0)
      const a1 = sorteio(c.a1)
      const k = c.ordem ? (indice % c.div) / c.div : Math.random()
      const ang = (a0 + (a1 - a0) * k + sorteio(c.ruido)) * GRAU
      const raio = sorteio(c.raio)
      // eixo: 0 X, 1 Y, 2 Z (o círculo fica no plano perpendicular)
      if (c.eixo === 0) this.circ.set(0, Math.cos(ang) * raio, Math.sin(ang) * raio)
      else if (c.eixo === 1) this.circ.set(Math.cos(ang) * raio, 0, Math.sin(ang) * raio)
      else this.circ.set(Math.cos(ang) * raio, Math.sin(ang) * raio, 0)
    }
    this.geracao = no.filhos.map((f) => ({ n: 0, prox: sorteio(f.atraso) }))
    for (let i = 0; i < no.filhos.length; i++) this.filhos.push([])
  }

  /** rotação Z própria (graus), para o sprite girar na tela */
  giroZ() {
    const t = this.idade
    return this.r0.z + this.rv.z * t + 0.5 * this.ra.z * t * t
  }

  /** escala própria agora */
  escala(out: THREE.Vector3) {
    const k = Math.min(1, this.idade / Math.max(1, this.vida))
    return out.lerpVectors(this.s0, this.s1, k)
  }

  /** recalcula a matriz de mundo (espaço do efeito) */
  calcular(alongar: number) {
    const t = this.idade
    const no = this.no
    const pos = new THREE.Vector3()
    if (no.pos?.t === 'curva') {
      const c = no.pos.c
      pos.set(curva(c[0], t), curva(c[1], t), curva(c[2], t))
    } else pos.copy(this.p0).addScaledVector(this.v0, t).addScaledVector(this.a0, 0.5 * t * t)
    if (this.pai && !this.pai.pai) pos.z *= alongar // nós de cima: o Z vai até o alvo
    pos.add(this.circ)
    const rot = new THREE.Vector3().copy(this.r0).addScaledVector(this.rv, t).addScaledVector(this.ra, 0.5 * t * t).multiplyScalar(GRAU)
    const local = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z, 'ZXY')), this.escala(new THREE.Vector3()))
    if (!this.pai) return this.mundo.copy(local)
    const [hl, hr, hs] = no.heranca
    const atual = this.pai.mundo
    const pt = new THREE.Vector3()
    const pq = new THREE.Quaternion()
    const ps = new THREE.Vector3()
    const nt = new THREE.Vector3()
    const nq = new THREE.Quaternion()
    const ns = new THREE.Vector3()
    atual.decompose(pt, pq, ps)
    this.paiNasc.decompose(nt, nq, ns)
    const T = hl === 2 ? pt : hl === 1 ? nt : new THREE.Vector3()
    const R = hr === 2 ? pq : hr === 1 ? nq : new THREE.Quaternion()
    const S = hs === 2 ? ps : hs === 1 ? ns : new THREE.Vector3(1, 1, 1)
    return this.mundo.compose(T, R, S).multiply(local)
  }

  fade() {
    const r = this.no.render
    if (!r) return 1
    let a = 1
    if (r.fadeIn > 0) a *= Math.min(1, this.idade / r.fadeIn)
    if (r.fadeOut > 0) a *= Math.min(1, Math.max(0, (this.vida - this.idade) / r.fadeOut))
    return a
  }
}

/** malha de um nó: geometria refeita a cada quadro (poucos milhares de vértices) */
class Malha {
  readonly mesh: THREE.Mesh
  private readonly geo = new THREE.BufferGeometry()
  private pos: number[] = []
  private cor: number[] = []
  private uv: number[] = []
  private idx: number[] = []
  constructor(tex: THREE.Texture | null, mistura: number, ordem: number) {
    const blending = mistura === 2 ? THREE.AdditiveBlending : mistura === 3 ? THREE.SubtractiveBlending : mistura === 4 ? THREE.MultiplyBlending : THREE.NormalBlending
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } },
      vertexShader: `attribute vec4 cor; varying vec4 vCor; varying vec2 vUv;
        void main() { vCor = cor; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vCor; varying vec2 vUv;
        void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb * vCor.rgb, t.a * vCor.a); }`,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending,
    })
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 100 + ordem
  }
  limpar() {
    this.pos.length = this.cor.length = this.uv.length = this.idx.length = 0
  }
  vertice(p: THREE.Vector3, u: number, v: number, c: number[], a: number) {
    this.pos.push(p.x, p.y, p.z)
    this.uv.push(u, v)
    this.cor.push(c[0], c[1], c[2], c[3] * a)
    return this.pos.length / 3 - 1
  }
  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d)
  }
  enviar() {
    this.mesh.visible = this.idx.length > 0
    if (!this.mesh.visible) return
    this.geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    this.geo.setAttribute('cor', new THREE.Float32BufferAttribute(this.cor, 4))
    this.geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    this.geo.setIndex(this.idx)
  }
  descartar() {
    this.geo.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

const dadosCache = new Map<string, Promise<DadosEfk | null>>()
const texCache = new Map<string, THREE.Texture>()

function base(nome: string) {
  return `${import.meta.env.BASE_URL}sprites/efk/${nome}/`
}

/** Carrega o efeito convertido (null se não existir). */
export function carregarEfk(nome: string) {
  let d = dadosCache.get(nome)
  if (!d) {
    const url = recurso(`${base(nome)}efeito.json`)
    d = (url.startsWith('data:')
      ? Promise.resolve(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))) as DadosEfk)
      : fetch(url).then((r) => (r.ok ? (r.json() as Promise<DadosEfk>) : null))
    ).catch(() => null)
    dadosCache.set(nome, d)
  }
  return d
}

function textura(nome: string, arq: string) {
  const url = recurso(`${base(nome)}${arq}`)
  let t = texCache.get(url)
  if (!t) {
    t = new THREE.TextureLoader().load(url)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    texCache.set(url, t)
  }
  return t
}

export type OpcoesEfk = {
  /** pé de quem lança (mundo) */
  origem: THREE.Vector3
  /** para onde o efeito vai (mundo); sem alvo, olha para +Z do mundo */
  alvo?: THREE.Vector3
  /** unidades do Effekseer -> mundo */
  escala: number
  camera: THREE.Camera
  /** a cada quadro (60 fps) do efeito */
  aoQuadro?: (q: number) => void
}

/** Um efeito do Effekseer tocando na cena. */
export class EfeitoEfk {
  readonly sprite = new THREE.Group()
  vivo = true
  /** não acelera no 2× (cena cinemática) */
  readonly cinematico = true
  private q = 0
  private qAnt = -1
  private readonly raiz: Inst
  private readonly malhas = new Map<No, Malha>()
  private readonly nome: string
  private readonly dados: DadosEfk
  private readonly op: OpcoesEfk
  private readonly alongar: number
  private readonly texs = new Map<string, THREE.Texture>()
  /** quadro em que o nó de impacto (o de cima que vai mais longe em Z) nasce */
  readonly quadroImpacto: number

  constructor(nome: string, dados: DadosEfk, op: OpcoesEfk) {
    this.nome = nome
    this.dados = dados
    this.op = op
    // o nó de cima mais longe em Z é o impacto: estica até o alvo
    const zDe = (f: No) => {
      const p = f.pos
      return p?.t === 'fixo' ? p.p[2][1] : p?.t === 'curva' ? Math.max(...p.c[2].map((k) => k[1])) : 0
    }
    const zMax = Math.max(0, ...dados.filhos.map(zDe))
    const imp = dados.filhos.find((f) => f.pos?.t === 'fixo' && zMax > 0 && zDe(f) === zMax)
    this.quadroImpacto = imp ? imp.atraso[0] : dados.fim / 2
    const dist = op.alvo ? Math.hypot(op.alvo.x - op.origem.x, op.alvo.z - op.origem.z) : 0
    this.alongar = zMax > 0 && dist > 0 ? dist / op.escala / zMax : 1
    this.sprite.position.copy(op.origem)
    if (op.alvo) this.sprite.rotation.y = Math.atan2(op.alvo.x - op.origem.x, op.alvo.z - op.origem.z)
    this.sprite.scale.setScalar(op.escala)
    // raiz: nó invisível que gera os de cima
    this.raiz = new Inst({ nome: 'raiz', tipo: 0, vida: [1e9, 1e9], max: 1, intervalo: [1, 1], atraso: [0, 0], heranca: [0, 0, 0], comPai: false, filhos: dados.filhos }, null, 0, 0)
    let ordem = 0
    const criar = (n: No) => {
      if (n.render && n.tipo >= 2) {
        const tex = n.render.tex ? textura(nome, n.render.tex) : null
        const m = new Malha(tex, n.render.mistura, ordem++)
        this.malhas.set(n, m)
        this.sprite.add(m.mesh)
        if (tex && n.render.tex) this.texs.set(n.render.tex, tex)
      }
      n.filhos.forEach(criar)
    }
    dados.filhos.forEach(criar)
  }

  atualizar(dt: number) {
    if (!this.vivo) return
    this.q += Math.min(0.05, dt) * 60
    const q = Math.floor(this.q)
    if (q !== this.qAnt) {
      for (let k = this.qAnt + 1; k <= q; k++) this.op.aoQuadro?.(k)
      this.qAnt = q
    }
    this.passo(this.raiz)
    this.desenhar()
    if (this.q > this.dados.fim && !this.temVivos(this.raiz)) this.vivo = false
  }

  private temVivos(i: Inst): boolean {
    return i.filhos.some((l) => l.some((f) => f.vivo || this.temVivos(f)))
  }

  /** envelhece, gera filhos e remove os mortos */
  private passo(i: Inst) {
    i.idade = this.q - i.nasc
    if (i.pai && i.idade >= i.vida) i.vivo = false
    if (i.vivo) i.calcular(this.alongar)
    i.no.filhos.forEach((fn, k) => {
      const g = i.geracao[k]
      while (i.vivo && g.n < fn.max && i.idade >= g.prox) {
        const f = new Inst(fn, i, i.nasc + g.prox, g.n)
        i.filhos[k].push(f)
        g.n++
        g.prox += Math.max(1e-3, sorteio(fn.intervalo))
      }
      const lista = i.filhos[k]
      for (const f of lista) {
        if (!i.vivo && fn.comPai) f.vivo = false
        if (f.vivo || f.filhos.some((l) => l.length)) this.passo(f)
      }
      i.filhos[k] = lista.filter((f) => f.vivo || this.temVivos(f))
    })
  }

  private desenhar() {
    for (const m of this.malhas.values()) m.limpar()
    // câmera no espaço do efeito (para os billboards)
    this.sprite.updateMatrixWorld()
    const inv = new THREE.Matrix4().copy(this.sprite.matrixWorld).invert()
    const cam = this.op.camera
    const olho = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld).applyMatrix4(inv)
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(cam.matrixWorld))
    const giroInv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.sprite.rotation.y)
    const direita = new THREE.Vector3(1, 0, 0).applyQuaternion(q).applyQuaternion(giroInv)
    const cima = new THREE.Vector3(0, 1, 0).applyQuaternion(q).applyQuaternion(giroInv)
    const visita = (i: Inst) => {
      i.no.filhos.forEach((fn, k) => {
        const lista = i.filhos[k]
        const m = this.malhas.get(fn)
        if (m && fn.tipo === 3) this.fita(m, fn, lista.filter((f) => f.vivo), olho)
        for (const f of lista) {
          if (f.vivo && m) {
            if (fn.tipo === 2) this.spriteQuad(m, f, direita, cima, olho)
            else if (fn.tipo === 4) this.anel(m, f)
          }
          visita(f)
        }
      })
    }
    visita(this.raiz)
    for (const m of this.malhas.values()) m.enviar()
  }

  private uvRet(no: No, idade: number) {
    const r = no.render!
    const uv = r.uv
    const img = this.texs.get(r.tex)?.image as HTMLImageElement | undefined
    const [tw, th] = img?.width ? [img.width, img.height] : [256, 256]
    if (!uv) return [0, 0, 1, 1]
    let x = uv.x
    let y = uv.y
    if (uv.t === 'rolar') {
      x += (uv.vx ?? 0) * idade
      y += (uv.vy ?? 0) * idade
    }
    // V do three cresce para cima; o Effekseer conta de cima
    return [x / tw, 1 - (y + uv.h) / th, (x + uv.w) / tw, 1 - y / th]
  }

  private spriteQuad(m: Malha, f: Inst, direita: THREE.Vector3, cima: THREE.Vector3, olho: THREE.Vector3) {
    const s = f.no.sprite!
    const p = new THREE.Vector3().setFromMatrixPosition(f.mundo)
    const sx = new THREE.Vector3().setFromMatrixColumn(f.mundo, 0).length() * 0.5
    const sy = new THREE.Vector3().setFromMatrixColumn(f.mundo, 1).length() * 0.5
    let dx: THREE.Vector3
    let dy: THREE.Vector3
    if (s.billboard === 1) {
      // eixo Y fixo: em pé, virado para a câmera só no giro horizontal
      dy = new THREE.Vector3(0, 1, 0)
      const para = olho.clone().sub(p).setY(0)
      dx = new THREE.Vector3(0, 1, 0).cross(para).normalize()
      if (!isFinite(dx.x)) dx = direita.clone()
    } else if (s.billboard === 2) {
      dx = new THREE.Vector3().setFromMatrixColumn(f.mundo, 0).normalize()
      dy = new THREE.Vector3().setFromMatrixColumn(f.mundo, 1).normalize()
    } else {
      const a = f.giroZ() * GRAU
      dx = direita.clone().multiplyScalar(Math.cos(a)).addScaledVector(cima, Math.sin(a))
      dy = cima.clone().multiplyScalar(Math.cos(a)).addScaledVector(direita, -Math.sin(a))
    }
    dx.multiplyScalar(sx)
    dy.multiplyScalar(sy)
    const [u0, v0, u1, v1] = this.uvRet(f.no, f.idade)
    const a = f.fade()
    const c = s.cor
    const i0 = m.vertice(p.clone().sub(dx).sub(dy), u0, v0, c, a)
    const i1 = m.vertice(p.clone().add(dx).sub(dy), u1, v0, c, a)
    const i2 = m.vertice(p.clone().add(dx).add(dy), u1, v1, c, a)
    const i3 = m.vertice(p.clone().sub(dx).add(dy), u0, v1, c, a)
    m.quad(i0, i1, i2, i3)
  }

  private fita(m: Malha, no: No, pts: Inst[], olho: THREE.Vector3) {
    if (pts.length < 2) return
    const fi = no.fita!
    const ps = pts.map((f) => new THREE.Vector3().setFromMatrixPosition(f.mundo))
    let dist = 0
    let ant = -1
    for (let k = 0; k < ps.length; k++) {
      const tan = ps[Math.min(ps.length - 1, k + 1)].clone().sub(ps[Math.max(0, k - 1)]).normalize()
      const lado = fi.olho ? tan.clone().cross(olho.clone().sub(ps[k])).normalize() : new THREE.Vector3(1, 0, 0)
      if (k) dist += ps[k].distanceTo(ps[k - 1])
      const f = pts[k]
      const [u0, v0, u1, v1] = this.uvRet(no, f.idade)
      // ao longo: repete a textura a cada `tile`; atravessando: a altura da textura
      const u = u0 + (fi.uvTipo ? dist / Math.max(1e-3, fi.tile) : k / (ps.length - 1)) * (u1 - u0)
      const a = f.fade()
      const e = new THREE.Vector3().setFromMatrixColumn(f.mundo, 0).length() || 1
      const iL = m.vertice(ps[k].clone().addScaledVector(lado, fi.l * e), u, v0, fi.cor, a)
      const iR = m.vertice(ps[k].clone().addScaledVector(lado, fi.r * e), u, v1, fi.cor, a)
      if (ant >= 0) m.quad(ant, ant + 1, iR, iL)
      ant = iL
    }
  }

  private anel(m: Malha, f: Inst) {
    const an = f.no.anel!
    const n = Math.max(3, an.vertices)
    const a = f.fade()
    const [u0, v0, u1, v1] = this.uvRet(f.no, f.idade)
    const meio: [number, number] = [an.dentro[0] + (an.fora[0] - an.dentro[0]) * an.meio, an.dentro[1] + (an.fora[1] - an.dentro[1]) * an.meio]
    const aneis: [[number, number], number[], number][] = [
      [an.fora, an.corFora, v0],
      [meio, an.corMeio, (v0 + v1) / 2],
      [an.dentro, an.corDentro, v1],
    ]
    const ids: number[][] = []
    for (const [[r, h], cor, v] of aneis) {
      const linha: number[] = []
      for (let k = 0; k <= n; k++) {
        const ang = (k / n) * Math.PI * 2
        const p = new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, h).applyMatrix4(f.mundo)
        linha.push(m.vertice(p, u0 + (u1 - u0) * (k / n), v, cor, a))
      }
      ids.push(linha)
    }
    for (let j = 0; j < 2; j++) for (let k = 0; k < n; k++) m.quad(ids[j][k], ids[j][k + 1], ids[j + 1][k + 1], ids[j + 1][k])
  }

  /** termina já (some no próximo quadro) */
  encerrar() {
    this.vivo = false
  }

  descartar() {
    for (const m of this.malhas.values()) m.descartar()
    this.vivo = false
    void this.nome
  }
}
