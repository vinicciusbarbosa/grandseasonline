import * as THREE from 'three'

/**
 * Peças do navio em alta resolução: torneados (balaústres, cabrestante,
 * lanterna), cordas em tubo com barriga, rolo de corda em espiral, timão,
 * porta, janelas, escada e âncora. Tudo em coordenadas locais da peça; quem
 * monta o navio posiciona.
 */

type Mat = THREE.Material

const sombra = <T extends THREE.Object3D>(o: T, recebe = true) => {
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      m.castShadow = true
      m.receiveShadow = recebe
    }
  })
  return o
}

/** sólido de revolução em torno de Y a partir de [raio, altura] */
export function torneado(perfil: [number, number][], mat: Mat, seg = 20) {
  return sombra(new THREE.Mesh(new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat))
}

/** tubo ao longo de uma curva, com a textura repetindo pelo comprimento (`porUnid` vezes por unidade) */
export function tubo(curva: THREE.Curve<THREE.Vector3>, r: number, mat: Mat, segs: number, radial = 8, porUnid = 6) {
  const geo = new THREE.TubeGeometry(curva, segs, r, radial, false)
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  const comp = curva.getLength()
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * comp * porUnid, uv.getY(i))
  return sombra(new THREE.Mesh(geo, mat), false)
}

/** corda entre dois pontos, com uma barriga (`cede`, em unidades) para baixo */
export function corda(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: Mat, cede = 0) {
  const meio = a.clone().lerp(b, 0.5)
  meio.y -= cede * 2
  const comp = a.distanceTo(b)
  return tubo(new THREE.QuadraticBezierCurve3(a, meio, b), r, mat, Math.max(6, Math.round(comp * 5)), 8)
}

/** rolo de corda: espiral em camadas e a ponta solta no chão */
export function roloCorda(mat: Mat, raio = 0.3, voltas = 3, grossura = 0.045) {
  const pts: THREE.Vector3[] = []
  const camadas = 3
  const porVolta = 28
  for (let c = 0; c < camadas; c++) {
    const r0 = raio - c * grossura * 1.1
    for (let i = 0; i < voltas * porVolta; i++) {
      const k = i / porVolta
      const ang = k * Math.PI * 2
      // cada volta vai para dentro; a camada de cima começa de fora de novo
      const r = r0 - (k / voltas) * raio * 0.45
      pts.push(new THREE.Vector3(Math.cos(ang) * r, grossura + c * grossura * 1.6 + (k / voltas) * grossura * 0.4, Math.sin(ang) * r))
    }
  }
  // ponta solta saindo para fora, rente ao chão
  const ult = pts[pts.length - 1]
  pts.push(ult.clone().multiplyScalar(1.6).setY(grossura * 1.2), ult.clone().multiplyScalar(2.4).setY(grossura))
  const g = new THREE.Group()
  g.add(tubo(new THREE.CatmullRomCurve3(pts), grossura, mat, pts.length * 2, 8, 10))
  return g
}

/** balaústre torneado (de 0 a `alt`) */
export function balaustre(mat: Mat, alt: number, r = 0.045) {
  const k = alt
  return torneado(
    [
      [0, 0],
      [r * 1.25, 0],
      [r * 1.25, k * 0.08],
      [r * 0.7, k * 0.14],
      [r * 1.1, k * 0.38],
      [r * 1.15, k * 0.5],
      [r * 0.75, k * 0.68],
      [r * 0.6, k * 0.82],
      [r * 1.05, k * 0.88],
      [r * 1.25, k * 0.92],
      [r * 1.25, k],
      [0, k],
    ],
    mat,
    12,
  )
}

/** pinha no topo dos postes */
export function pinha(mat: Mat, r = 0.09) {
  return torneado(
    [
      [0, 0],
      [r * 0.55, 0],
      [r * 0.4, r * 0.4],
      [r * 0.9, r * 0.9],
      [r, r * 1.3],
      [r * 0.8, r * 1.8],
      [r * 0.3, r * 2.2],
      [0, r * 2.3],
    ],
    mat,
    14,
  )
}

/** timão: aro duplo, oito raios torneados com punhos para fora, cubo e pedestal */
export function timao(madeira: Mat, ferro: Mat) {
  const g = new THREE.Group()
  const roda = new THREE.Group()
  const R = 0.42
  roda.add(sombra(new THREE.Mesh(new THREE.TorusGeometry(R, 0.045, 12, 64), madeira)))
  roda.add(sombra(new THREE.Mesh(new THREE.TorusGeometry(R - 0.12, 0.025, 10, 48), madeira)))
  // cintas de ferro no aro
  for (const z of [-0.035, 0.035]) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 6, 64), ferro)
    c.position.z = z * 0.9
    roda.add(c)
  }
  for (let i = 0; i < 8; i++) {
    const raio = torneado(
      [
        [0, 0],
        [0.028, 0],
        [0.024, R - 0.02],
        [0.03, R + 0.02],
        [0.022, R + 0.06],
        [0.036, R + 0.12],
        [0.04, R + 0.17],
        [0.026, R + 0.21],
        [0, R + 0.22],
      ],
      madeira,
      10,
    )
    raio.rotation.z = (i * Math.PI) / 4
    roda.add(raio)
  }
  const cubo = torneado(
    [
      [0, -0.08],
      [0.07, -0.08],
      [0.09, -0.04],
      [0.09, 0.04],
      [0.07, 0.08],
      [0, 0.08],
    ],
    madeira,
    16,
  )
  cubo.rotation.x = Math.PI / 2
  roda.add(cubo)
  const tampa = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 14), ferro)
  tampa.rotation.x = Math.PI / 2
  roda.add(tampa)
  g.add(roda)
  // pedestal: coluna torneada que segura o eixo por trás
  const pe = torneado(
    [
      [0, 0],
      [0.2, 0],
      [0.2, 0.06],
      [0.13, 0.12],
      [0.1, 0.3],
      [0.12, 0.55],
      [0.09, 0.7],
      [0.11, 0.78],
      [0.11, 0.86],
      [0, 0.86],
    ],
    madeira,
    18,
  )
  pe.position.set(0, -0.92, -0.16)
  g.add(pe)
  const eixo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), ferro)
  eixo.rotation.x = Math.PI / 2
  eixo.position.z = -0.1
  g.add(eixo)
  return g
}

/**
 * Porta de tábuas com batente, verga com moldura, ferragens (dobradiças
 * compridas, cravos, argola) e soleira; de frente para +X, base em y = 0.
 */
export function porta(madeira: Mat, batente: Mat, ferro: Mat, escuro: Mat, larg = 0.72, alt = 1.0) {
  const g = new THREE.Group()
  const box = (w: number, h: number, d: number, m: Mat, x: number, y: number, z: number) => {
    const b = sombra(new THREE.Mesh(new THREE.BoxGeometry(d, h, w), m))
    b.position.set(x, y, z)
    g.add(b)
    return b
  }
  // vão escuro atrás
  box(larg, alt, 0.02, escuro, 0, alt / 2, 0)
  // tábuas verticais com frestas
  const n = 5
  const lt = larg / n
  for (let i = 0; i < n; i++) box(lt - 0.012, alt - 0.03, 0.04, madeira, 0.03, (alt - 0.03) / 2 + 0.01, -larg / 2 + lt * (i + 0.5))
  // travessas e dobradiças de ferro com cravos
  for (const y of [alt * 0.2, alt * 0.78]) {
    box(larg * 0.9, 0.055, 0.015, ferro, 0.058, y, 0)
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), ferro)
      c.position.set(0.068, y, -larg * 0.4 + (larg * 0.8 * i) / 4)
      g.add(c)
    }
  }
  // argola e espelho da fechadura
  box(0.07, 0.1, 0.012, ferro, 0.058, alt * 0.5, larg * 0.3)
  const argola = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 20), ferro)
  argola.rotation.y = Math.PI / 2
  argola.position.set(0.07, alt * 0.47, larg * 0.3)
  g.add(argola)
  // batente, verga com cornija e soleira
  const lb = 0.08
  for (const s of [-1, 1]) box(lb, alt + 0.04, 0.09, batente, 0.04, (alt + 0.04) / 2, s * (larg / 2 + lb / 2))
  box(larg + lb * 2 + 0.04, 0.09, 0.1, batente, 0.045, alt + 0.06, 0)
  box(larg + lb * 2 + 0.12, 0.04, 0.14, batente, 0.06, alt + 0.12, 0)
  box(larg + lb * 2 + 0.04, 0.035, 0.16, batente, 0.07, 0.0175, 0)
  return g
}

/**
 * Janela de caixilho: moldura, vidro aceso dividido em quatro pelo
 * caixilho em cruz, peitoril e uma testeira em cima; de frente para +X.
 */
export function janela(moldura: Mat, caixilho: Mat, vidro: Mat, larg = 0.4, alt = 0.36) {
  const g = new THREE.Group()
  const box = (w: number, h: number, d: number, m: Mat, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), m)
    b.position.set(x, y, z)
    g.add(b)
    return b
  }
  box(larg, alt, 0.02, vidro, 0, 0, 0)
  const e = 0.05
  for (const s of [-1, 1]) {
    box(e, alt + e * 2, 0.06, moldura, 0.02, 0, s * (larg / 2 + e / 2))
    box(larg + e * 2, e, 0.06, moldura, 0.02, s * (alt / 2 + e / 2), 0)
  }
  box(0.025, alt, 0.035, caixilho, 0.02, 0, 0)
  box(larg, 0.025, 0.035, caixilho, 0.02, 0, 0)
  box(larg + e * 2 + 0.08, 0.035, 0.12, moldura, 0.05, -alt / 2 - e - 0.017, 0)
  box(larg + e * 2 + 0.04, 0.03, 0.09, moldura, 0.035, alt / 2 + e + 0.015, 0)
  return g
}

/**
 * Escada de tábuas encostada numa parede: duas pernas inclinadas, degraus e
 * corrimão com balaústres no lado de fora. Sobe de x = 0 (chão) até x = -`fundo`
 * (topo, na altura `alt`); `lado` diz de que lado fica o corrimão (±Z).
 */
export function escada(madeira: Mat, corrimao: Mat, alt: number, fundo: number, larg = 0.55, lado = 1) {
  const g = new THREE.Group()
  const n = Math.max(3, Math.round(alt / 0.2))
  const comp = Math.hypot(alt, fundo)
  const ang = Math.atan2(alt, fundo)
  for (const s of [-1, 1]) {
    const perna = sombra(new THREE.Mesh(new THREE.BoxGeometry(comp + 0.1, 0.12, 0.05), madeira))
    perna.rotation.z = -ang
    perna.position.set(-fundo / 2, alt / 2, s * (larg / 2))
    g.add(perna)
  }
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n
    const d = sombra(new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.18, fundo / n + 0.06), 0.04, larg), madeira))
    d.position.set(-fundo * k + fundo / n / 2, alt * k - 0.02, 0)
    g.add(d)
  }
  // corrimão inclinado com balaústres
  const z = lado * (larg / 2 + 0.02)
  const a = new THREE.Vector3(0.05, 0.62, z)
  const b = new THREE.Vector3(-fundo, alt + 0.62, z)
  const d = b.clone().sub(a)
  const corr = sombra(new THREE.Mesh(new THREE.BoxGeometry(d.length() + 0.08, 0.06, 0.07), corrimao))
  corr.position.copy(a).addScaledVector(d, 0.5)
  corr.rotation.z = -Math.atan2(d.y, -d.x)
  g.add(corr)
  for (let i = 0; i <= n; i += 2) {
    const k = i / n
    const p = balaustre(madeira, 0.6, 0.03)
    p.position.set(-fundo * k, alt * k, z)
    g.add(p)
  }
  return g
}

/** âncora: haste, argola, cepo de madeira e os braços curvos com patas */
export function ancora(ferro: Mat, madeira: Mat) {
  const g = new THREE.Group()
  const haste = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.3, 12), ferro))
  g.add(haste)
  const argola = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 10, 24), ferro))
  argola.position.y = 0.76
  g.add(argola)
  const cepo = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 10), madeira))
  cepo.rotation.x = Math.PI / 2
  cepo.position.y = 0.55
  g.add(cepo)
  const braco = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 32, Math.PI * 0.85), ferro))
  braco.rotation.z = Math.PI + Math.PI * 0.075
  braco.position.y = -0.25
  g.add(braco)
  for (const s of [-1, 1]) {
    const pata = sombra(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), ferro))
    pata.position.set(s * 0.41, -0.18, 0)
    pata.rotation.z = s * -0.5
    pata.scale.set(1, 1, 0.35)
    g.add(pata)
  }
  const ponta = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), ferro))
  ponta.position.y = -0.67
  g.add(ponta)
  return g
}

/** cabrestante torneado com as barras de empurrar */
export function cabrestante(madeira: Mat, barra: Mat, ferro: Mat) {
  const g = new THREE.Group()
  g.add(
    torneado(
      [
        [0, 0],
        [0.42, 0],
        [0.42, 0.08],
        [0.3, 0.12],
        [0.26, 0.3],
        [0.3, 0.46],
        [0.36, 0.5],
        [0.36, 0.62],
        [0.3, 0.66],
        [0.12, 0.7],
        [0, 0.7],
      ],
      madeira,
      24,
    ),
  )
  for (const y of [0.15, 0.45]) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(y < 0.3 ? 0.29 : 0.3, 0.014, 6, 32), ferro)
    c.rotation.x = Math.PI / 2
    c.position.y = y
    g.add(c)
  }
  for (let i = 0; i < 4; i++) {
    const b = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.4, 10), barra))
    b.rotation.z = Math.PI / 2
    b.rotation.y = (i * Math.PI) / 4
    b.position.y = 0.56
    g.add(b)
  }
  return g
}

/** lanterna de ferro com vidro aceso (base em y = 0) */
export function lanterna(ferro: Mat, vidro: Mat) {
  const g = new THREE.Group()
  g.add(
    torneado(
      [
        [0, 0],
        [0.12, 0],
        [0.13, 0.03],
        [0.1, 0.05],
        [0, 0.05],
      ],
      ferro,
      16,
    ),
  )
  const v = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.2, 16), vidro)
  v.position.y = 0.15
  g.add(v)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), ferro)
    b.position.set(Math.cos(a) * 0.095, 0.15, Math.sin(a) * 0.095)
    g.add(b)
  }
  g.add(
    torneado(
      [
        [0, 0.25],
        [0.13, 0.25],
        [0.06, 0.34],
        [0.03, 0.36],
        [0.04, 0.38],
        [0, 0.38],
      ],
      ferro,
      16,
    ),
  )
  const argola = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), ferro)
  argola.position.y = 0.42
  g.add(argola)
  return g
}

const pintado = (cor: number) => new THREE.MeshLambertMaterial({ color: cor })
const peca = <T extends THREE.BufferGeometry>(geo: T, mat: Mat, x = 0, y = 0, z = 0) => {
  const m = sombra(new THREE.Mesh(geo, mat))
  m.position.set(x, y, z)
  return m
}

/**
 * Figura de proa: cabeça de leão esculpida e pintada, com a juba em pétalas
 * em volta (como a do Sunny). Olha para +X; a base (o pescoço na roda de
 * proa) fica na origem.
 */
export function figuraLeao(madeira: Mat) {
  const g = new THREE.Group()
  const amarelo = pintado(0xf0c24a)
  const claro = pintado(0xfbe39a)
  const juba = pintado(0xd8742a)
  const juba2 = pintado(0xb8561e)
  const escuro = pintado(0x2a160c)
  const cab = new THREE.Group()
  cab.position.set(0.15, 0.25, 0)
  // juba: duas voltas de pétalas apontando para fora, no plano YZ
  for (const [n, r, comp, mat, x] of [
    [14, 0.42, 0.42, juba, -0.12],
    [11, 0.3, 0.32, juba2, -0.02],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (x > -0.05 ? 0.2 : 0)
      // pétala arredondada (elipsoide comprido no raio, achatado na frente-trás)
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat)
      p.scale.set(0.12, comp, 0.26)
      p.position.set(x, Math.sin(a) * (r + comp * 0.25), Math.cos(a) * (r + comp * 0.25))
      p.rotation.x = Math.PI / 2 - a
      p.castShadow = true
      cab.add(p)
    }
  }
  // cara, focinho, bochechas, nariz, olhos, sobrancelhas, orelhas, boca
  const cara = peca(new THREE.SphereGeometry(0.36, 24, 18), amarelo, 0.08, 0, 0)
  cara.scale.set(0.85, 1, 1)
  cab.add(cara)
  const focinho = peca(new THREE.SphereGeometry(0.17, 18, 14), claro, 0.34, -0.1, 0)
  focinho.scale.set(0.9, 0.75, 1.15)
  cab.add(focinho)
  for (const s of [-1, 1]) {
    cab.add(peca(new THREE.SphereGeometry(0.11, 14, 10), claro, 0.36, -0.14, s * 0.1))
    const olho = peca(new THREE.SphereGeometry(0.045, 10, 8), escuro, 0.33, 0.1, s * 0.13)
    cab.add(olho)
    const sob = peca(new THREE.BoxGeometry(0.06, 0.035, 0.14), juba2, 0.34, 0.17, s * 0.12)
    sob.rotation.x = s * 0.35
    cab.add(sob)
    const orelha = peca(new THREE.SphereGeometry(0.09, 12, 10), amarelo, 0.0, 0.31, s * 0.22)
    orelha.scale.set(0.5, 1, 1)
    cab.add(orelha)
    cab.add(peca(new THREE.SphereGeometry(0.05, 10, 8), juba2, 0.04, 0.31, s * 0.22))
  }
  const nariz = peca(new THREE.SphereGeometry(0.06, 12, 10), escuro, 0.47, -0.04, 0)
  nariz.scale.set(0.8, 0.7, 1.2)
  cab.add(nariz)
  const boca = peca(new THREE.TorusGeometry(0.07, 0.014, 6, 16, Math.PI), escuro, 0.45, -0.21, 0)
  boca.rotation.set(0, Math.PI / 2, Math.PI)
  cab.add(boca)
  g.add(cab)
  // suporte: voluta esculpida que prende a cabeça na roda de proa
  const voluta = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 24, Math.PI * 1.3), madeira)
  voluta.rotation.y = Math.PI / 2
  voluta.position.set(-0.15, -0.28, 0)
  voluta.castShadow = true
  g.add(voluta)
  g.add(peca(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 14), madeira, -0.2, -0.05, 0))
  return g
}

/**
 * Figura de proa: cabeça de dragão marinho, de bocarra aberta, chifres,
 * barbatanas nas laterais e olhos acesos. Olha para +X; base na origem.
 */
export function figuraDragao(madeira: Mat) {
  const g = new THREE.Group()
  const escama = pintado(0x2e7a6a)
  const escama2 = pintado(0x1e5248)
  const ventre = pintado(0xd8c890)
  const osso = pintado(0xf2ead2)
  const olhoM = new THREE.MeshBasicMaterial({ color: 0xffd040 })
  const cab = new THREE.Group()
  cab.position.set(0.1, 0.22, 0)
  cab.rotation.z = 0.12
  // crânio alongado e focinho
  const cranio = peca(new THREE.SphereGeometry(0.26, 22, 16), escama, 0, 0.04, 0)
  cranio.scale.set(1.25, 0.9, 0.95)
  cab.add(cranio)
  const focinho = peca(new THREE.CylinderGeometry(0.1, 0.17, 0.42, 16), escama, 0.36, 0.0, 0)
  focinho.rotation.z = -Math.PI / 2
  focinho.scale.set(1, 1, 0.85)
  cab.add(focinho)
  cab.add(peca(new THREE.SphereGeometry(0.1, 14, 10), escama, 0.57, 0.0, 0))
  // mandíbula aberta, com o ventre claro e dentes
  const mand = new THREE.Group()
  mand.position.set(0.05, -0.12, 0)
  mand.rotation.z = -0.38
  const queixo = peca(new THREE.CylinderGeometry(0.07, 0.13, 0.5, 14), ventre, 0.25, 0, 0)
  queixo.rotation.z = -Math.PI / 2
  queixo.scale.set(1, 1, 0.8)
  mand.add(queixo)
  for (let i = 0; i < 4; i++)
    for (const s of [-1, 1]) {
      const d = peca(new THREE.ConeGeometry(0.022, 0.08, 6), osso, 0.12 + i * 0.1, 0.07, s * (0.07 - i * 0.008))
      mand.add(d)
      const d2 = peca(new THREE.ConeGeometry(0.022, 0.08, 6), osso, 0.18 + i * 0.1, -0.07, s * (0.07 - i * 0.008))
      d2.rotation.z = Math.PI
      cab.add(d2)
    }
  cab.add(mand)
  // olhos, sobrolho, chifres, crista e barbatanas
  for (const s of [-1, 1]) {
    cab.add(peca(new THREE.SphereGeometry(0.045, 10, 8), olhoM, 0.2, 0.12, s * 0.16))
    const sob = peca(new THREE.BoxGeometry(0.16, 0.04, 0.06), escama2, 0.19, 0.17, s * 0.16)
    sob.rotation.x = s * 0.4
    cab.add(sob)
    const chifre = peca(new THREE.ConeGeometry(0.045, 0.42, 10), osso, -0.12, 0.3, s * 0.12)
    chifre.rotation.set(s * 0.3, 0, 0.9)
    cab.add(chifre)
    // barbatana lateral em leque
    for (let i = 0; i < 4; i++) {
      const b = peca(new THREE.ConeGeometry(0.035, 0.32 - i * 0.04, 6), escama2, -0.18 - i * 0.04, -0.02 + i * 0.05, s * 0.24)
      b.rotation.set(s * (1.1 + i * 0.12), 0, 1.2 - i * 0.15)
      cab.add(b)
    }
  }
  for (let i = 0; i < 5; i++) {
    const c = peca(new THREE.ConeGeometry(0.04, 0.2 - i * 0.02, 6), escama2, -0.05 - i * 0.1, 0.27 - i * 0.03, 0)
    c.rotation.z = 0.6 + i * 0.1
    c.scale.set(1, 1, 0.4)
    cab.add(c)
  }
  g.add(cab)
  // pescoço curvo descendo até a roda de proa, com o ventre claro
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.35, -0.55, 0), new THREE.Vector3(-0.3, 0.05, 0), new THREE.Vector3(0.0, 0.18, 0))
  g.add(sombra(new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 0.15, 14, false), escama)))
  const curva2 = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.27, -0.55, 0), new THREE.Vector3(-0.2, 0.0, 0), new THREE.Vector3(0.05, 0.1, 0))
  const ventreM = sombra(new THREE.Mesh(new THREE.TubeGeometry(curva2, 16, 0.1, 10, false), ventre))
  g.add(ventreM)
  g.add(peca(new THREE.CylinderGeometry(0.12, 0.18, 0.3, 14), madeira, -0.36, -0.6, 0))
  return g
}
