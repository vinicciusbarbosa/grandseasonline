import * as THREE from 'three'

/**
 * O convés da batalha por turnos, todo feito por código (sem modelos nem
 * imagens externas): tábuas com veio, emendas e pregos; amurada alta com
 * balaústres, portinholas e canhões; mastros com vergas, velas, cordame e
 * bandeira; castelo de proa com escada; barris com aros, caixotes, rolos de
 * corda, alçapão gradeado e lanternas; mar com ondas e céu com nuvens.
 *
 * Referencial: x para a direita, z para a câmera; o convés vai de z = 9
 * (atrás da câmera) até a proa em z ≈ −22; a amurada fica em x = ±7,5.
 */

const LARGURA = 15
const MEIO = LARGURA / 2
const POPA = 9
const PROA = -22
const COMPRIMENTO = POPA - PROA

/** gerador pseudoaleatório fixo (o convés sai sempre igual) */
function sorteio(semente: number) {
  let s = semente
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function canvas(l: number, a: number) {
  const c = document.createElement('canvas')
  c.width = l
  c.height = a
  return [c, c.getContext('2d')!] as const
}

function texturaDe(c: HTMLCanvasElement, repetir?: [number, number]) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repetir)
  }
  return t
}

/** Tábuas do convés: cada tábua com tom próprio, veio, emendas desencontradas e pregos. */
function texturaTabuas(tabuas: number, rnd: () => number, tom = [150, 104, 62]) {
  const L = 1024
  const [c, g] = canvas(L, L)
  const w = L / tabuas
  for (let i = 0; i < tabuas; i++) {
    let y = -rnd() * 400
    while (y < L) {
      const comp = 260 + rnd() * 320
      const v = 0.82 + rnd() * 0.3
      g.fillStyle = `rgb(${tom[0] * v},${tom[1] * v},${tom[2] * v})`
      g.fillRect(i * w, y, w, comp)
      // veio: linhas finas e onduladas ao longo da tábua
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(${rnd() < 0.5 ? '60,35,18' : '235,200,150'},${0.08 + rnd() * 0.12})`
        g.lineWidth = 1 + rnd()
        g.beginPath()
        const x0 = i * w + 4 + rnd() * (w - 8)
        g.moveTo(x0, y)
        for (let yy = y; yy < y + comp; yy += 24) g.lineTo(x0 + Math.sin(yy * 0.02 + k) * 2.5 + (rnd() - 0.5), yy)
        g.stroke()
      }
      // nó na madeira, às vezes
      if (rnd() < 0.25) {
        const nx = i * w + w * (0.3 + rnd() * 0.4)
        const ny = y + comp * rnd()
        g.fillStyle = 'rgba(70,40,20,0.45)'
        g.beginPath()
        g.ellipse(nx, ny, 3 + rnd() * 3, 6 + rnd() * 6, 0, 0, Math.PI * 2)
        g.fill()
      }
      // emenda (topo da tábua) com pregos
      g.fillStyle = 'rgba(35,20,10,0.85)'
      g.fillRect(i * w, y, w, 3)
      g.fillStyle = 'rgba(30,30,34,0.9)'
      for (const px of [0.28, 0.72]) {
        g.beginPath()
        g.arc(i * w + w * px, y + 9, 2.4, 0, Math.PI * 2)
        g.fill()
      }
      y += comp
    }
    // fresta entre tábuas (calafeto escuro) e um brilho na borda
    g.fillStyle = 'rgba(25,14,6,0.9)'
    g.fillRect(i * w, 0, 3, L)
    g.fillStyle = 'rgba(255,230,190,0.07)'
    g.fillRect(i * w + 3, 0, 2, L)
  }
  return c
}

/** Céu: degradê com nuvens macias e o brilho do sol. */
function ceu(rnd: () => number) {
  const [c, g] = canvas(1024, 512)
  const gr = g.createLinearGradient(0, 0, 0, 512)
  gr.addColorStop(0, '#3a78c2')
  gr.addColorStop(0.55, '#8cbfe6')
  gr.addColorStop(0.82, '#d9ecf5')
  gr.addColorStop(1, '#eef6f8')
  g.fillStyle = gr
  g.fillRect(0, 0, 1024, 512)
  const sol = g.createRadialGradient(760, 150, 0, 760, 150, 220)
  sol.addColorStop(0, 'rgba(255,248,220,0.9)')
  sol.addColorStop(1, 'rgba(255,248,220,0)')
  g.fillStyle = sol
  g.fillRect(0, 0, 1024, 512)
  for (let n = 0; n < 14; n++) {
    const cx = rnd() * 1024
    const cy = 60 + rnd() * 260
    const s = 0.6 + rnd() * 1.2
    for (let k = 0; k < 9; k++) {
      const r = (24 + rnd() * 30) * s
      const nu = g.createRadialGradient(cx + (rnd() - 0.5) * 140 * s, cy + (rnd() - 0.5) * 22 * s, 0, cx, cy, r * 1.6)
      nu.addColorStop(0, 'rgba(255,255,255,0.55)')
      nu.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = nu
      g.beginPath()
      g.arc(cx + (rnd() - 0.5) * 140 * s, cy + (rnd() - 0.5) * 22 * s, r * 1.6, 0, Math.PI * 2)
      g.fill()
    }
  }
  return c
}

/** Bandeira pirata (caveira e ossos) desenhada no canvas. */
function bandeira() {
  const [c, g] = canvas(256, 160)
  g.fillStyle = '#111316'
  g.fillRect(0, 0, 256, 160)
  g.fillStyle = '#f1ece0'
  g.strokeStyle = '#f1ece0'
  g.lineWidth = 14
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(80, 50)
  g.lineTo(176, 126)
  g.moveTo(176, 50)
  g.lineTo(80, 126)
  g.stroke()
  g.beginPath()
  g.arc(128, 72, 34, 0, Math.PI * 2)
  g.fill()
  g.fillRect(108, 92, 40, 24)
  g.fillStyle = '#111316'
  g.beginPath()
  g.arc(115, 70, 9, 0, Math.PI * 2)
  g.arc(141, 70, 9, 0, Math.PI * 2)
  g.fill()
  g.fillRect(126, 84, 4, 8)
  for (const x of [114, 122, 130, 138]) g.fillRect(x, 106, 3, 10)
  return c
}

/** Aduelas do barril. */
function texturaAduelas(rnd: () => number) {
  const [c, g] = canvas(256, 128)
  for (let i = 0; i < 16; i++) {
    const v = 0.85 + rnd() * 0.25
    g.fillStyle = `rgb(${138 * v},${88 * v},${48 * v})`
    g.fillRect(i * 16, 0, 16, 128)
    g.fillStyle = 'rgba(40,22,10,0.8)'
    g.fillRect(i * 16, 0, 2, 128)
  }
  return c
}

export function montarConves(cena: THREE.Scene) {
  const rnd = sorteio(7)
  const coisas = new THREE.Group()
  cena.add(coisas)

  cena.background = texturaDe(ceu(rnd))
  cena.fog = new THREE.Fog(0xd5e8f1, 26, 90)

  cena.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b5136, 1.25))
  const sol = new THREE.DirectionalLight(0xfff0d2, 2.1)
  sol.position.set(-9, 16, 6)
  sol.target.position.set(0, 0, -6)
  sol.castShadow = true
  sol.shadow.mapSize.set(1024, 1024)
  Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 18, bottom: -18, near: 1, far: 60 })
  sol.shadow.bias = -0.0006
  cena.add(sol, sol.target)

  // materiais
  const madeira = new THREE.MeshLambertMaterial({ color: 0x7a4e2a })
  const madeiraEscura = new THREE.MeshLambertMaterial({ color: 0x4b2d17 })
  const casco = new THREE.MeshLambertMaterial({ color: 0x5a2e1c })
  const faixa = new THREE.MeshLambertMaterial({ color: 0xc9a24a })
  const ferro = new THREE.MeshLambertMaterial({ color: 0x2c2f35 })
  const corda = new THREE.MeshLambertMaterial({ color: 0xb8975e })
  const lona = new THREE.MeshLambertMaterial({ color: 0xf0e6cf, side: THREE.DoubleSide })

  const malha = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, sombra = true) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = sombra
    m.receiveShadow = true
    coisas.add(m)
    return m
  }

  // ---- mar com ondas --------------------------------------------------------------
  const mar = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 160, 160),
    new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uNevoa: { value: new THREE.Color(0xd5e8f1) } },
      vertexShader: `
        uniform float uT; varying float vH; varying float vDist;
        void main() {
          vec3 p = position;
          float h = sin(p.x * 0.18 + uT * 0.9) * 0.35 + sin(p.y * 0.23 - uT * 1.2) * 0.3 + sin((p.x + p.y) * 0.5 + uT * 2.0) * 0.08;
          p.z += h;
          vH = h;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uNevoa; varying float vH; varying float vDist;
        void main() {
          vec3 fundo = vec3(0.05, 0.27, 0.45);
          vec3 crista = vec3(0.22, 0.58, 0.72);
          vec3 c = mix(fundo, crista, smoothstep(-0.5, 0.6, vH));
          c = mix(c, vec3(0.92, 0.97, 1.0), smoothstep(0.52, 0.7, vH) * 0.6);
          c = mix(c, uNevoa, smoothstep(26.0, 120.0, vDist));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  mar.rotation.x = -Math.PI / 2
  mar.position.y = -2.2
  cena.add(mar)

  // ---- casco por fora (aparece nas bordas) e o convés ---------------------------------
  const tabuas = texturaDe(texturaTabuas(16, rnd), [LARGURA / 4, COMPRIMENTO / 4])
  const conves = malha(new THREE.PlaneGeometry(LARGURA, COMPRIMENTO), new THREE.MeshLambertMaterial({ map: tabuas }), 0, 0, (POPA + PROA) / 2, false)
  conves.rotation.x = -Math.PI / 2
  for (const s of [-1, 1]) {
    malha(new THREE.BoxGeometry(0.5, 4, COMPRIMENTO), casco, s * (MEIO + 0.25), -1.2, (POPA + PROA) / 2, false)
    malha(new THREE.BoxGeometry(0.56, 0.22, COMPRIMENTO), faixa, s * (MEIO + 0.25), 0.25, (POPA + PROA) / 2, false)
  }

  // ---- amurada: parede de tábuas, balaústres, corrimão, portinholas com canhões -----
  const tabuasAmurada = texturaDe(texturaTabuas(6, rnd, [128, 84, 48]), [COMPRIMENTO / 3, 1])
  const paredeMat = new THREE.MeshLambertMaterial({ map: tabuasAmurada })
  for (const s of [-1, 1]) {
    const x = s * MEIO
    const parede = malha(new THREE.BoxGeometry(0.22, 0.55, COMPRIMENTO), paredeMat, x, 0.28, (POPA + PROA) / 2, false)
    parede.receiveShadow = true
    // corrimão
    malha(new THREE.BoxGeometry(0.42, 0.14, COMPRIMENTO), madeiraEscura, x, 1.32, (POPA + PROA) / 2)
    // balaústres torneados
    const balaustre = new THREE.LatheGeometry([new THREE.Vector2(0.07, 0), new THREE.Vector2(0.1, 0.08), new THREE.Vector2(0.06, 0.2), new THREE.Vector2(0.09, 0.4), new THREE.Vector2(0.06, 0.62), new THREE.Vector2(0.09, 0.7)], 8)
    for (let z = POPA; z > PROA + 1; z -= 0.55) malha(balaustre, madeira, x, 0.55, z)
    // colunas grossas de tempos em tempos
    for (let z = POPA - 1; z > PROA + 1; z -= 4.4) malha(new THREE.BoxGeometry(0.34, 1.5, 0.34), madeiraEscura, x, 0.7, z)
    // canhões nas portinholas, apontando para fora
    for (const z of [3.5, -2.5, -8.5, -14.5]) {
      const carreta = malha(new THREE.BoxGeometry(0.9, 0.35, 0.7), madeiraEscura, x - s * 0.7, 0.28, z)
      carreta.rotation.y = 0
      for (const dz of [-0.28, 0.28]) {
        const roda = malha(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), madeira, x - s * 0.7, 0.2, z + dz)
        roda.rotation.x = Math.PI / 2
      }
      const cano = malha(new THREE.CylinderGeometry(0.13, 0.19, 1.5, 14), ferro, x - s * 0.35, 0.62, z)
      cano.rotation.z = (s * Math.PI) / 2
    }
    // lanternas penduradas nas colunas
    for (const z of [POPA - 1 - 4.4, POPA - 1 - 13.2]) {
      malha(new THREE.BoxGeometry(0.06, 0.06, 0.5), ferro, x - s * 0.25, 1.75, z)
      const caixa = malha(new THREE.BoxGeometry(0.26, 0.34, 0.26), new THREE.MeshLambertMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.2 }), x - s * 0.45, 1.5, z)
      caixa.castShadow = false
      malha(new THREE.ConeGeometry(0.22, 0.16, 4), ferro, x - s * 0.45, 1.75, z)
    }
  }

  // ---- castelo de proa: degrau, escada e grade --------------------------------------
  const castelo = -15.5
  malha(new THREE.BoxGeometry(LARGURA, 1.1, castelo - PROA), new THREE.MeshLambertMaterial({ map: tabuas }), 0, 0.55, (castelo + PROA) / 2, false)
  malha(new THREE.BoxGeometry(LARGURA, 0.12, 0.25), madeiraEscura, 0, 1.12, castelo)
  for (let i = 0; i < 4; i++) malha(new THREE.BoxGeometry(2.4, 0.08, 0.32), madeira, 0, 0.26 + i * 0.27, castelo + 0.35 + i * 0.32)
  for (const s of [-1, 1]) malha(new THREE.BoxGeometry(0.1, 1.1, 1.5), madeiraEscura, s * 1.25, 0.55, castelo + 0.7)
  for (let x = -MEIO + 0.4; x < MEIO; x += 0.5) malha(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), madeira, x, 1.4, castelo + 0.05)
  // gurupés saindo da proa
  const gurupes = malha(new THREE.CylinderGeometry(0.14, 0.24, 9, 10), madeiraEscura, 0, 2.6, PROA - 2.5)
  gurupes.rotation.x = -1.2

  // ---- alçapão gradeado no meio do convés ------------------------------------------------
  const grade = new THREE.Group()
  grade.position.set(-0.4, 0.02, -1.6)
  coisas.add(grade)
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.8), madeiraEscura)
  moldura.receiveShadow = true
  grade.add(moldura)
  const buraco = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.5), new THREE.MeshBasicMaterial({ color: 0x120a05 }))
  buraco.rotation.x = -Math.PI / 2
  buraco.position.y = 0.085
  grade.add(buraco)
  for (let i = -4; i <= 4; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.5), madeira)
    a.position.set(i * 0.25, 0.1, 0)
    grade.add(a)
  }
  for (let j = -2; j <= 2; j++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.06), madeira)
    b.position.set(0, 0.12, j * 0.3)
    grade.add(b)
  }

  // ---- mastros, vergas, velas, cordame e bandeira --------------------------------------
  const velas: THREE.Mesh[] = []
  let bandeiraMalha: THREE.Mesh | null = null
  const cordame: number[] = []
  for (const [z, h, alt] of [
    [-10.5, 15, 0],
    [-19, 12.5, 1.1],
  ] as const) {
    const base = alt
    malha(new THREE.CylinderGeometry(0.2, 0.32, h, 12), madeiraEscura, 0, base + h / 2, z)
    malha(new THREE.CylinderGeometry(0.45, 0.5, 0.35, 12), madeira, 0, base + 0.18, z)
    malha(new THREE.CylinderGeometry(0.5, 0.4, 0.18, 12), madeira, 0, base + h * 0.72, z) // cesto
    for (const [hy, larg] of [
      [0.42, 7.2],
      [0.66, 5.6],
    ] as const) {
      const y = base + h * hy
      const verga = malha(new THREE.CylinderGeometry(0.09, 0.09, larg, 8), madeiraEscura, 0, y + h * 0.17, z + 0.25)
      verga.rotation.z = Math.PI / 2
      // vela estufada pelo vento
      const geo = new THREE.PlaneGeometry(larg * 0.94, h * 0.17, 12, 6)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / (larg * 0.47)
        const v = pos.getY(i) / (h * 0.085)
        pos.setZ(i, (1 - u * u) * (0.55 + 0.25 * (1 - v)) * 0.9)
      }
      geo.computeVertexNormals()
      const vela = malha(geo, lona, 0, y + h * 0.085, z + 0.35)
      vela.userData.base = geo.attributes.position.array.slice()
      velas.push(vela)
    }
    // cordame: do topo do mastro até a amurada dos dois lados
    for (const s of [-1, 1]) for (const dz of [-0.6, 0.4, 1.4]) cordame.push(0, base + h * 0.95, z, s * (MEIO - 0.1), 1.35, z + dz)
    if (!bandeiraMalha) {
      const geo = new THREE.PlaneGeometry(2.2, 1.4, 16, 6)
      bandeiraMalha = malha(geo, new THREE.MeshLambertMaterial({ map: texturaDe(bandeira()), side: THREE.DoubleSide }), 1.15, base + h + 0.6, z, false)
      bandeiraMalha.userData.base = geo.attributes.position.array.slice()
    }
  }
  const linhas = new THREE.BufferGeometry()
  linhas.setAttribute('position', new THREE.Float32BufferAttribute(cordame, 3))
  coisas.add(new THREE.LineSegments(linhas, new THREE.LineBasicMaterial({ color: 0x3b2a18, transparent: true, opacity: 0.8 })))

  // ---- barris, caixotes e rolos de corda nas bordas ------------------------------------
  const aduelas = new THREE.MeshLambertMaterial({ map: texturaDe(texturaAduelas(rnd)) })
  const perfilBarril = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8
    return new THREE.Vector2(0.36 + Math.sin(t * Math.PI) * 0.08, t * 0.95)
  })
  const barril = (x: number, z: number, deitado = false) => {
    const g = new THREE.Group()
    const corpo = new THREE.Mesh(new THREE.LatheGeometry(perfilBarril, 16), aduelas)
    corpo.castShadow = corpo.receiveShadow = true
    g.add(corpo)
    const tampa = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), madeiraEscura)
    tampa.rotation.x = -Math.PI / 2
    tampa.position.y = 0.95
    g.add(tampa)
    for (const y of [0.12, 0.83]) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.38 + Math.sin((y / 0.95) * Math.PI) * 0.08, 0.025, 6, 20), ferro)
      aro.rotation.x = Math.PI / 2
      aro.position.y = y
      g.add(aro)
    }
    g.position.set(x, deitado ? 0.42 : 0, z)
    if (deitado) {
      g.rotation.z = Math.PI / 2
      g.position.x += 0.48
    }
    coisas.add(g)
  }
  const tabuasCaixote = new THREE.MeshLambertMaterial({ map: texturaDe(texturaTabuas(4, rnd, [176, 132, 82])) })
  const caixote = (x: number, z: number, tam: number, giro: number, y = 0) => {
    const g = new THREE.Group()
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(tam, tam, tam), tabuasCaixote)
    corpo.castShadow = corpo.receiveShadow = true
    g.add(corpo)
    for (const [a, b] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const quina = new THREE.Mesh(new THREE.BoxGeometry(0.08, tam + 0.02, 0.08), madeiraEscura)
      quina.position.set((a * tam) / 2, 0, (b * tam) / 2)
      g.add(quina)
    }
    g.position.set(x, y + tam / 2, z)
    g.rotation.y = giro
    coisas.add(g)
  }
  const rolo = (x: number, z: number) => {
    for (let i = 0; i < 4; i++) {
      const anel = malha(new THREE.TorusGeometry(0.42 - i * 0.04, 0.07, 6, 18), corda, x, 0.07 + i * 0.12, z)
      anel.rotation.x = Math.PI / 2
    }
  }
  barril(-6.4, 6.2)
  barril(-5.6, 6.8)
  barril(-6.6, 5.2, true)
  barril(6.3, 0.8)
  barril(6.5, -5.6)
  barril(-6.4, -12.6)
  caixote(-6.2, 1.2, 0.9, 0.2)
  caixote(-6.3, 1.4, 0.6, -0.3, 0.9)
  caixote(6.1, 5.4, 1, -0.15)
  caixote(5.9, -12.2, 0.8, 0.4)
  rolo(-5.8, -6.8)
  rolo(5.7, 2.9)
  rolo(2.6, -14.2)

  // ---- animação: mar, velas ao vento e bandeira tremulando ------------------------------
  return {
    atualizar(t: number) {
      ;(mar.material as THREE.ShaderMaterial).uniforms.uT.value = t
      for (const v of velas) {
        const pos = v.geometry.attributes.position
        const base = v.userData.base as Float32Array
        for (let i = 0; i < pos.count; i++) pos.setZ(i, base[i * 3 + 2] * (1 + Math.sin(t * 1.3 + base[i * 3] * 0.5) * 0.08))
        pos.needsUpdate = true
      }
      if (bandeiraMalha) {
        const pos = bandeiraMalha.geometry.attributes.position
        const base = bandeiraMalha.userData.base as Float32Array
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3] + 1.1
          pos.setZ(i, Math.sin(x * 2.4 - t * 5) * 0.16 * x)
        }
        pos.needsUpdate = true
      }
    },
  }
}
