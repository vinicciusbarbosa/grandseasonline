import * as THREE from 'three'
import { fbm } from '../../navegacao/cena/fbm'
import { NIVEL_MAR } from './navio'

/**
 * Mar do combate, no estilo do mapa de navegação: soma de ondas com relevo
 * (o plano sobe e desce de verdade, e a linha d'água corre pelos cascos),
 * normal analítica + ruído fino correndo, sol da tarde (difusa, brilho que
 * cintila), céu refletido pelo Fresnel, cor de água funda/turquesa nas
 * cristas e carneirinhos. Nos cascos: sombra dos navios na água, água
 * revolvida, espuma batendo na linha d'água e marolas saindo do casco.
 *
 * O formato dos cascos vem num campo de distância (textura) calculado uma
 * vez a partir do contorno de cada casco na linha d'água.
 */

/**
 * Ondas (direção em rad, comprimento, amplitude), em unidades do mundo (uma
 * casa = 1). A velocidade sai da dispersão de águas fundas (ω = √(g·k)),
 * com g baixo para o mar ficar calmo. O shader e a faixa do casco usam as mesmas.
 */
const ONDAS: [number, number, number][] = [
  [0.35, 9.0, 0.11],
  [1.25, 5.3, 0.07],
  [-0.55, 3.4, 0.045],
  [2.35, 2.2, 0.03],
  [-1.35, 1.4, 0.018],
]
const G = 3.2

function uniformesOndas() {
  return {
    ondas: { value: ONDAS.map(([a, l]) => new THREE.Vector4(Math.cos(a), Math.sin(a), (2 * Math.PI) / l, Math.sqrt((G * 2 * Math.PI) / l))) },
    amplitudes: { value: ONDAS.map(([, , amp]) => amp) },
  }
}

/** altura e gradiente das ondas (GLSL, compartilhado) */
const GLSL_ONDAS = /* glsl */ `
  uniform vec4 ondas[5];
  uniform float amplitudes[5];
  uniform float tempo;
  // altura (x) e gradiente (yz) no ponto p do plano XZ
  vec3 relevo(vec2 p) {
    vec3 r = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      vec4 o = ondas[i];
      float f = o.z * dot(o.xy, p) - o.w * tempo + float(i) * 1.7;
      r.x += amplitudes[i] * sin(f);
      r.yz += amplitudes[i] * o.z * cos(f) * o.xy;
    }
    return r;
  }
`

/** textura de ruído 256² que se repete (R e G grossos, B fino), como a do mapa */
function texturaRuido() {
  const L = 256
  const r = fbm(L, [8, 16, 32, 64], 1)
  const g = fbm(L, [4, 8, 16, 32], 2)
  const b = fbm(L, [16, 32, 64, 128], 3)
  const dados = new Uint8Array(L * L * 4)
  for (let i = 0; i < L * L; i++) {
    dados[i * 4] = r[i]
    dados[i * 4 + 1] = g[i]
    dados[i * 4 + 2] = b[i]
    dados[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(dados, L, L, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

/** distância até o casco mais perto (negativa dentro), guardada em 8 bits de -1 a 7 unidades */
const D_MIN = -1
const D_FAIXA = 8

function campoCascos(contornos: THREE.Vector2[][]) {
  const POR = 8 // texels por unidade
  const caixa = new THREE.Box2()
  for (const c of contornos) for (const p of c) caixa.expandByPoint(p)
  caixa.expandByScalar(D_FAIXA)
  const w = Math.ceil((caixa.max.x - caixa.min.x) * POR)
  const h = Math.ceil((caixa.max.y - caixa.min.y) * POR)
  const dados = new Uint8Array(w * h)
  const segs = contornos.map((c) => c.map((a, i) => [a, c[(i + 1) % c.length]] as const))
  for (let j = 0; j < h; j++) {
    const z = caixa.min.y + (j + 0.5) / POR
    for (let i = 0; i < w; i++) {
      const x = caixa.min.x + (i + 0.5) / POR
      let d2 = Infinity
      let dentro = false
      for (const lista of segs)
        for (const [a, b] of lista) {
          const ex = b.x - a.x
          const ez = b.y - a.y
          const l2 = ex * ex + ez * ez || 1e-9
          const k = Math.min(1, Math.max(0, ((x - a.x) * ex + (z - a.y) * ez) / l2))
          const dx = x - a.x - ex * k
          const dz = z - a.y - ez * k
          d2 = Math.min(d2, dx * dx + dz * dz)
          if (a.y > z !== b.y > z && x < a.x + ((z - a.y) * ex) / (b.y - a.y)) dentro = !dentro
        }
      const d = (dentro ? -1 : 1) * Math.sqrt(d2)
      dados[j * w + i] = Math.round(Math.min(1, Math.max(0, (d - D_MIN) / D_FAIXA)) * 255)
    }
  }
  const t = new THREE.DataTexture(dados, w, h, THREE.RedFormat)
  t.magFilter = t.minFilter = THREE.LinearFilter
  t.needsUpdate = true
  return { textura: t, ret: new THREE.Vector4(caixa.min.x, caixa.min.y, w / POR, h / POR) }
}

export function criarMar(contornos: THREE.Vector2[][], dirSol: THREE.Vector3) {
  const ruido = texturaRuido()
  const campo = campoCascos(contornos)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tempo: { value: 0 },
      ...uniformesOndas(),
      ruido: { value: ruido },
      campo: { value: campo.textura },
      campoRet: { value: campo.ret },
      sol: { value: dirSol.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      ${GLSL_ONDAS}
      varying vec3 vMundo;
      void main() {
        vec4 m = modelMatrix * vec4(position, 1.0);
        m.y += relevo(m.xz).x;
        vMundo = m.xyz;
        gl_Position = projectionMatrix * viewMatrix * m;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_ONDAS}
      uniform sampler2D ruido;
      uniform sampler2D campo;
      uniform vec4 campoRet;
      uniform vec3 sol;
      varying vec3 vMundo;

      float rA(vec2 p) { return texture2D(ruido, p).r; }
      float rB(vec2 p) { return texture2D(ruido, p).g; }
      float rF(vec2 p) { return texture2D(ruido, p).b; }

      // distância até o casco mais perto (longe dos navios: bem longe)
      float casco(vec2 p) {
        vec2 q = (p - campoRet.xy) / campoRet.zw;
        if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 50.0;
        return texture2D(campo, q).r * ${D_FAIXA.toFixed(1)} + ${D_MIN.toFixed(1)};
      }

      void main() {
        vec2 p = vMundo.xz;
        float t = tempo;
        vec3 rel = relevo(p);
        float amp = 0.0;
        for (int i = 0; i < 5; i++) amp += amplitudes[i];
        float hn = rel.x / amp;

        // ondinhas finas (ruído correndo em duas direções): só na normal
        vec2 u1 = p * 0.045 + vec2(t * 0.018, t * 0.007);
        vec2 u2 = p * 0.07 - vec2(t * 0.011, -t * 0.02);
        float e = 0.004;
        float a1 = rF(u1), a2 = rF(u2);
        vec2 gFino = vec2(rF(u1 + vec2(e, 0.0)) - a1 + rF(u2 + vec2(e, 0.0)) - a2, rF(u1 + vec2(0.0, e)) - a1 + rF(u2 + vec2(0.0, e)) - a2) / e * 0.012;

        float d = casco(p);
        // perto do casco o mar acalma (a água fica presa entre os navios)
        float calmo = mix(0.55, 1.0, smoothstep(0.0, 2.5, d));
        vec3 n = normalize(vec3(-(rel.y * calmo + gFino.x), 1.0, -(rel.z * calmo + gFino.y)));
        vec3 v = normalize(cameraPosition - vMundo);

        // corpo da água: funda com manchas lentas, turquesa nas cristas
        float mancha = rB(p * 0.012 + vec2(t * 0.002, 0.0));
        vec3 fundo = mix(vec3(0.02, 0.16, 0.34), vec3(0.03, 0.24, 0.45), mancha);
        vec3 medio = vec3(0.04, 0.42, 0.62);
        vec3 agua = mix(fundo, medio, smoothstep(-0.7, 1.0, hn) * 0.65);
        // luz atravessando a crista (vista contra o sol)
        float atravessa = pow(max(dot(v, -vec3(sol.x, 0.0, sol.z)), 0.0), 2.0) * smoothstep(0.1, 0.9, hn);
        agua += vec3(0.05, 0.4, 0.38) * (0.25 * smoothstep(0.2, 1.0, hn) + 0.35 * atravessa);
        float difusa = max(dot(n, sol), 0.0);
        agua *= 0.72 + 0.45 * difusa;

        // céu refletido (Fresnel): mais forte de lado, quase nada olhando de cima
        vec3 r = reflect(-v, n);
        vec3 ceu = mix(vec3(0.62, 0.78, 0.93), vec3(0.3, 0.52, 0.86), clamp(r.y, 0.0, 1.0));
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 cor = mix(agua, ceu, clamp(fresnel * 1.6, 0.0, 0.75));

        // sol: reflexo largo e pontinhos que cintilam
        float esp = max(dot(reflect(-sol, n), v), 0.0);
        float cintila = smoothstep(0.6, 0.8, rF(p * 0.11 + vec2(t * 0.05, -t * 0.03)));
        cor += vec3(1.0, 0.93, 0.8) * (pow(esp, 40.0) * 0.25 + pow(esp, 300.0) * 2.5 * cintila);

        // carneirinhos: espuma rara nas cristas da onda grande, quebrada pelo ruído
        vec4 o0 = ondas[0];
        float f0 = o0.z * dot(o0.xy, p) - o0.w * t + (rA(p * 0.03) - 0.5) * 2.0;
        float crista = smoothstep(0.94, 0.995, sin(f0)) * smoothstep(0.35, 0.8, hn + 0.2);
        float quebra = smoothstep(0.55, 0.7, rF(p * 0.06 + vec2(t * 0.01, 0.0)));
        float bolhas = smoothstep(0.3, 0.55, rF(p * 0.2 - vec2(t * 0.02, 0.0)));
        cor = mix(cor, vec3(0.9, 0.95, 0.97), crista * quebra * (0.35 + 0.4 * bolhas));

        // ---- cascos ----------------------------------------------------------
        // sombra do navio na água (o sol vem de trás: a sombra cai para a frente)
        vec2 solXZ = normalize(sol.xz);
        float ds = casco(p + solXZ * 1.5);
        cor *= mix(0.55, 1.0, smoothstep(-0.6, 0.6, ds));
        // água escura junto ao casco (oclusão), mais clara e revolvida um pouco além
        cor *= mix(0.62, 1.0, smoothstep(0.0, 0.7, d));
        float revolto = (1.0 - smoothstep(0.2, 2.2, d)) * smoothstep(0.35, 0.7, rA(p * 0.08 + vec2(t * 0.02, -t * 0.015)));
        cor = mix(cor, vec3(0.16, 0.58, 0.66), revolto * 0.35);
        // renda de bolhas (a espuma nunca é chapada)
        float renda = smoothstep(0.3, 0.55, rF(p * 0.16 + vec2(t * 0.03, t * 0.02)));
        // a onda bate e recua: a espuma colada no casco engrossa e afina,
        // correndo ao longo dele
        float bate = 0.5 + 0.5 * sin(t * 1.9 - p.x * 0.85 + rA(p * 0.05) * 5.0 + rel.x * 8.0);
        float colada = 1.0 - smoothstep(0.02, 0.1 + 0.32 * bate, d);
        // marolas que saem do casco e se desfazem
        float marola = smoothstep(0.55, 1.0, sin(d * 7.0 - t * 2.6 + rA(p * 0.06) * 4.0)) * exp(-d * 1.1) * smoothstep(0.05, 0.3, d);
        float espuma = clamp(colada * (0.55 + 0.45 * renda) + marola * renda * 0.8, 0.0, 1.0);
        cor = mix(cor, vec3(0.93, 0.97, 1.0), espuma * 0.92);
        if (d < -0.05) cor = vec3(0.02, 0.06, 0.12);

        gl_FragColor = vec4(cor, 1.0);
      }
    `,
  })
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(120, 90, 180, 135), mat)
  mar.rotation.x = -Math.PI / 2
  mar.position.y = NIVEL_MAR

  /**
   * Espuma no casco: a onda sobe e desce na faixa da linha d'água (a mesma
   * soma de ondas do mar, mais o vaivém da batida), com renda de bolhas e um
   * filete de casco molhado logo acima.
   */
  const matCasco = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      tempo: mat.uniforms.tempo,
      ondas: mat.uniforms.ondas,
      amplitudes: mat.uniforms.amplitudes,
      ruido: { value: ruido },
    },
    vertexShader: /* glsl */ `
      varying vec3 vMundo;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 m = modelMatrix * vec4(position, 1.0);
        vMundo = m.xyz;
        gl_Position = projectionMatrix * viewMatrix * m;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_ONDAS}
      uniform sampler2D ruido;
      varying vec3 vMundo;
      varying vec2 vUv;
      void main() {
        float t = tempo;
        vec2 p = vMundo.xz;
        // altura da água aqui (o plano do mar sobe e desce com a mesma soma)
        float agua = relevo(p).x;
        float acima = vMundo.y - (${NIVEL_MAR.toFixed(2)} + agua);
        // batida: sobe e recua correndo ao longo do casco, em rajadas
        float rajada = texture2D(ruido, vec2(vUv.x * 0.025 - t * 0.03, t * 0.01)).r;
        float bate = 0.5 + 0.5 * sin(t * 1.9 - p.x * 0.85 + rajada * 5.0);
        float alto = 0.05 + 0.28 * bate * bate * smoothstep(0.3, 0.7, rajada + 0.15);
        float renda = smoothstep(0.28, 0.55, texture2D(ruido, vec2(vUv.x * 0.09 + t * 0.02, (vUv.y - agua) * 0.35 - t * 0.04)).b);
        // espuma: cheia embaixo, rendada e respingada perto do topo da onda
        float corpo = 1.0 - smoothstep(alto * 0.45, alto, acima + (1.0 - renda) * 0.06);
        float espuma = corpo * (0.6 + 0.4 * renda) * step(-0.03, acima);
        // casco molhado: uma sombra fina acima de onde a água chegou
        float molhado = (1.0 - smoothstep(alto, alto + 0.12, acima)) * step(0.0, acima) * 0.22;
        vec3 cor = mix(vec3(0.05, 0.08, 0.1), vec3(0.93, 0.97, 1.0), espuma / max(espuma + molhado, 1e-3));
        float a = clamp(espuma * 0.9 + molhado, 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(cor, a);
      }
    `,
  })
  const espumaCasco = (geo: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(geo, matCasco)
    m.renderOrder = 1
    return m
  }
  return { mar, mat, espumaCasco }
}
