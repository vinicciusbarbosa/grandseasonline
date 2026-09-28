import * as THREE from 'three'

/**
 * Luz nos sprites dos personagens, para parecerem volumes na cena 3D e não
 * recortes chapados:
 *
 * - volume: uma "normal" é estimada pelo contorno do desenho (quanto de
 *   figura há de cada lado do pixel, em três distâncias) — o lado virado para
 *   o sol clareia, o oposto escurece, com um brilho de borda do lado da luz;
 * - sombra da cena (velas, mastro): escurece e esfria a cor;
 * - sombra de contato: escurece de leve perto dos pés;
 * - lanternas: soma a luz quente das que estiverem perto.
 */

export type LuzPersonagem = {
  /** 0 = ao sol, 1 = na sombra de algo da cena */
  sombra: number
  /** luz quente das lanternas próximas (soma, já com intensidade) */
  quente: THREE.Color
}

export const LUZ_NEUTRA: LuzPersonagem = { sombra: 0, quente: new THREE.Color(0, 0, 0) }

type Uniformes = {
  uTexel: { value: THREE.Vector2 }
  uRecorte: { value: THREE.Vector4 }
  uPe: { value: THREE.Vector2 }
  uEspelho: { value: number }
  uLuzDir: { value: THREE.Vector3 }
  uSombra: { value: number }
  uQuente: { value: THREE.Color }
}

/** Direção do sol na tela (x direita, y cima, z para o observador). */
const LUZ_TELA = new THREE.Vector3(-0.55, 0.62, 0.56).normalize()

export function materialIluminado(parametros: THREE.SpriteMaterialParameters = {}) {
  const mat = new THREE.SpriteMaterial({ alphaTest: 0.5, ...parametros })
  const u: Uniformes = {
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uRecorte: { value: new THREE.Vector4(0, 0, 1, 1) },
    uPe: { value: new THREE.Vector2(0.1, 0.9) },
    uEspelho: { value: 1 },
    uLuzDir: { value: LUZ_TELA.clone() },
    uSombra: { value: 0 },
    uQuente: { value: new THREE.Color(0, 0, 0) },
  }
  mat.userData.luz = u
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `
uniform vec2 uTexel;
uniform vec4 uRecorte;
uniform vec2 uPe;
uniform float uEspelho;
uniform vec3 uLuzDir;
uniform float uSombra;
uniform vec3 uQuente;
void main() {`,
      )
      .replace(
        '#include <alphahash_fragment>',
        /* glsl */ `#include <alphahash_fragment>
#ifdef USE_MAP
  {
    // "normal" pelo contorno: diferença de figura dos dois lados do pixel
    float gx = 0.0, gy = 0.0;
    for (int i = 1; i <= 3; i++) {
      float d = float(i * i) * 3.0;
      vec2 ox = vec2(uTexel.x * d, 0.0);
      vec2 oy = vec2(0.0, uTexel.y * d);
      gx += texture2D(map, vMapUv + ox).a - texture2D(map, vMapUv - ox).a;
      gy += texture2D(map, vMapUv + oy).a - texture2D(map, vMapUv - oy).a;
    }
    vec3 n = normalize(vec3(-gx * uEspelho, -gy, 1.6));
    float s = dot(n, uLuzDir) - uLuzDir.z;           // 0 no miolo chapado
    s = floor(s * 6.0 + 0.5) / 6.0;                   // em degraus (pixel art)
    vec3 c = diffuseColor.rgb;
    c *= 1.0 + 0.42 * s;                              // volume
    c += vec3(1.0, 0.94, 0.8) * max(s, 0.0) * 0.18;   // brilho de borda do lado do sol
    // sombra de contato perto dos pés
    float y = (vMapUv.y - uRecorte.y) / uRecorte.w;   // 0 = base do quadro
    float altura = max(uPe.y - uPe.x, 1e-3);
    c *= mix(0.78, 1.0, smoothstep(0.0, 0.16, (y - uPe.x) / altura));
    // sol quente ou sombra fria da cena
    c *= mix(vec3(1.05, 1.0, 0.92), vec3(0.6, 0.64, 0.78), uSombra);
    // lanternas
    c += uQuente * (0.55 + 0.45 * max(s + 0.3, 0.0)) * diffuseColor.rgb;
    diffuseColor.rgb = c;
  }
#endif`,
      )
  }
  return mat
}

/**
 * Atualiza os uniformes a cada quadro: recorte do quadro atual na folha, se
 * está espelhado, onde fica o pé e o topo (fração da altura do quadro), luz.
 */
export function atualizarLuz(
  mat: THREE.SpriteMaterial,
  mapa: THREE.Texture,
  espelha: boolean,
  peY: number,
  topoY: number,
  luz: LuzPersonagem,
) {
  const u = mat.userData.luz as Uniformes
  const img = mapa.image as { width?: number; height?: number } | undefined
  if (img?.width && img.height) u.uTexel.value.set(1 / img.width, 1 / img.height)
  u.uRecorte.value.set(mapa.offset.x, mapa.offset.y, mapa.repeat.x, mapa.repeat.y)
  u.uPe.value.set(peY, topoY)
  u.uEspelho.value = espelha ? -1 : 1
  u.uSombra.value = luz.sombra
  u.uQuente.value.copy(luz.quente)
}
