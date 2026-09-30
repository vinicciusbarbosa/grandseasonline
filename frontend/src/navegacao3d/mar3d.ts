import * as THREE from 'three'
import { componentes } from '../navegacao/sim/ondas'
import { dadosRuido, LADO_RUIDO } from '../navegacao/cena/dadosRuido'

/**
 * O mar da navegação em 3D: a MESMA soma de ondas do jogo (sim/ondas.ts)
 * sobe e desce os vértices de verdade, e o pincel do mar visto de cima
 * (cena/shaderOceano.ts) pinta a superfície pela posição no mundo — mesmas
 * cores, espuma, brilho, arrebentação e terra. O que muda com a câmera baixa:
 * a luz usa a posição real do olho, o detalhe some com a distância e tudo
 * se mistura no horizonte.
 *
 * Mundo 2D (x, y) → 3D (x, altura, z = y). Unidade: px do mundo.
 */

/** Exagero da altura das ondas (a vista de cima usava o mesmo truque na paralaxe). */
export const ALTURA_ONDAS = 3

const COMUM = /* glsl */ `
uniform sampler2D uTerra;
uniform sampler2D uRuido;
uniform vec2 uMundo;
uniform float uTempo;
uniform float uAltura;
uniform vec4 uOnda0;
uniform vec4 uOnda1;
uniform vec4 uOnda2;
uniform vec4 uOnda3;
uniform vec4 uAmplitudes;
uniform vec4 uFases;

vec2 coordTextura(vec2 p) {
  vec2 t = p / uMundo;
  return vec2(t.x, 1.0 - t.y);
}
vec4 dadoTerra(vec2 p) {
  return texture2D(uTerra, coordTextura(clamp(p, vec2(1.0), uMundo - 1.0)));
}
float distanciaDe(vec4 d) {
  return (d.r * 255.0 - 128.0) / 127.0 * 320.0;
}
float ehModelada(vec4 d) {
  return 1.0 - smoothstep(0.02, 0.05, abs(d.g - 40.0 / 255.0));
}
void onda(vec4 o, float a, float f, vec2 p, float t, inout float h, inout vec2 g) {
  float fase = o.z * dot(o.xy, p) - o.w * t + f;
  h += a * sin(fase);
  g += a * o.z * cos(fase) * o.xy;
}
void ondas(vec2 p, float t, out float h, out vec2 g) {
  h = 0.0;
  g = vec2(0.0);
  onda(uOnda0, uAmplitudes.x, uFases.x, p, t, h, g);
  onda(uOnda1, uAmplitudes.y, uFases.y, p, t, h, g);
  onda(uOnda2, uAmplitudes.z, uFases.z, p, t, h, g);
  onda(uOnda3, uAmplitudes.w, uFases.w, p, t, h, g);
}
`

const VERTICE = /* glsl */ `
${COMUM}
varying vec3 vMundo;
varying float vAgua;

void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 p = w.xz;
  vec4 d = dadoTerra(p);
  float sd = distanciaDe(d);
  float h;
  vec2 g;
  ondas(p, uTempo, h, g);
  // Perto da costa a onda morre; em terra o chão sobe (ilhas sem modelo 3D)
  // ou afunda sob o modelo (ilhas modeladas: o modelo é o chão).
  float agua = smoothstep(-6.0, 30.0, sd);
  float morro = min(-sd * 0.22, 26.0) * (1.0 - ehModelada(d));
  float y = h * uAltura * agua + (sd < 0.0 ? mix(morro, -14.0, ehModelada(d)) : 0.0);
  w.y = y;
  vMundo = w.xyz;
  vAgua = agua;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAGMENTO = /* glsl */ `
${COMUM}
uniform vec3 uVento;
uniform vec3 uSol;
uniform vec3 uHorizonte;
uniform vec2 uNevoa;
varying vec3 vMundo;
varying float vAgua;

float ruido(vec2 p) { return texture2D(uRuido, p).r; }
float ruidoB(vec2 p) { return texture2D(uRuido, p).g; }
float ruidoFino(vec2 p) { return texture2D(uRuido, p).b; }

vec3 corTerra(vec2 p, float dentro, float tipo) {
  float n1 = ruido(p * 0.0021);
  float n2 = ruidoB(p * 0.0007);
  float n3 = ruidoFino(p * 0.0035);
  vec3 areia = vec3(0.93, 0.84, 0.60);
  vec3 grama = mix(vec3(0.33, 0.60, 0.28), vec3(0.47, 0.72, 0.33), n2);
  vec3 mata = mix(vec3(0.15, 0.38, 0.19), vec3(0.24, 0.49, 0.24), n1);
  vec3 ilha = mix(areia, grama, smoothstep(10.0, 18.0, dentro + n1 * 10.0));
  ilha = mix(ilha, mata, smoothstep(40.0, 90.0, dentro + n2 * 50.0));
  ilha *= 0.84 + 0.3 * n3 * smoothstep(30.0, 60.0, dentro);
  float estria = ruidoB(p * vec2(0.0012, 0.005));
  vec3 rocha = mix(vec3(0.55, 0.20, 0.18), vec3(0.80, 0.42, 0.34), estria) * (0.85 + 0.3 * n1);
  vec3 pedra = mix(vec3(0.46, 0.47, 0.52), vec3(0.72, 0.73, 0.77), n1);
  pedra = mix(pedra, vec3(0.94, 0.96, 0.99), smoothstep(0.55, 0.65, n2));
  float pVermelho = smoothstep(0.25, 0.45, tipo) * (1.0 - smoothstep(0.75, 0.92, tipo));
  float pMontanha = smoothstep(0.75, 0.92, tipo);
  return ilha * (1.0 - pVermelho - pMontanha) + rocha * pVermelho + pedra * pMontanha;
}

void main() {
  vec2 p = vMundo.xz;
  float t = uTempo;
  vec3 paraOlho = cameraPosition - vMundo;
  float dist = length(paraOlho);
  vec3 olho = paraOlho / dist;
  // Detalhe fino some com a distância (senão o padrão "espremido" cintila).
  float perto = 1.0 - smoothstep(500.0, 1800.0, dist);

  vec4 dado = dadoTerra(p);
  float sd = distanciaDe(dado);
  float tipo = dado.g;
  float sdn = sd + (ruido(p * 0.004) - 0.5) * 16.0;
  vec2 vento = uVento.xy;
  float forca = uVento.z;

  // ---- Água (o mesmo pincel da vista de cima) --------------------------------
  float h;
  vec2 g;
  ondas(p, t, h, g);
  float hn = h / dot(uAmplitudes, vec4(1.0));
  vec2 deslize = vento * t * (0.004 + 0.006 * forca);
  float det = ruido(p * 0.0011 + deslize);

  vec3 normal = normalize(vec3(-g.x * 5.0, 1.0, -g.y * 5.0));
  float difusa = dot(normal, uSol);
  float brilho = pow(max(dot(reflect(-uSol, normal), olho), 0.0), 24.0);
  brilho *= 0.8 * smoothstep(0.63, 0.78, ruidoFino(p * 0.0034 + vec2(t * 0.03, -t * 0.02))) * perto;

  float profundidade = clamp(sdn / 300.0, 0.0, 1.0);
  vec3 raso = vec3(0.23, 0.78, 0.76);
  vec3 medio = vec3(0.05, 0.46, 0.66);
  vec3 fundo = vec3(0.02, 0.23, 0.43);
  vec3 agua = mix(raso, medio, smoothstep(0.0, 0.3, profundidade));
  agua = mix(agua, fundo, smoothstep(0.3, 1.0, profundidade));
  agua *= 0.84 + 0.22 * hn + 0.3 * difusa;
  agua *= 0.95 + 0.1 * det;
  agua += brilho * (0.3 + 0.2 * forca);

  // Carneirinhos nas cristas da onda dominante.
  float faseDominante = uOnda0.z * dot(uOnda0.xy, p) - uOnda0.w * t + uFases.x + (det - 0.5) * 2.0;
  float crista = smoothstep(0.93, 0.99, sin(faseDominante));
  float quebra = smoothstep(0.42, 0.6, ruidoFino(p * 0.0032 + deslize * 2.0));
  float carneiro = crista * quebra * smoothstep(0.1, 0.5, hn + 0.3);
  agua = mix(agua, vec3(0.9, 0.95, 0.97), carneiro * 0.1 * smoothstep(20.0, 80.0, sdn) * perto);

  // Só existe de lado: a água virada de quina para o olho clareia com o céu
  // (na paleta do mar, não reflexo de verdade).
  float quina = pow(1.0 - max(dot(normal, olho), 0.0), 4.0);
  agua = mix(agua, mix(uHorizonte, raso, 0.35), quina * 0.45);

  // Cáusticas no raso e arrebentação andando para a praia.
  float caustica = smoothstep(0.62, 0.82, ruidoFino(p * 0.0036 + vec2(t * 0.02, -t * 0.015)));
  agua += caustica * 0.12 * (1.0 - smoothstep(0.0, 140.0, sdn)) * perto;
  float faixas = sin(sdn * 0.12 + t * 2.1);
  float espuma = smoothstep(0.72, 1.0, faixas) * (1.0 - smoothstep(8.0, 70.0, sdn)) * 0.75;
  espuma += 1.0 - smoothstep(0.0, 9.0, sdn);
  espuma *= 0.75 + 0.25 * ruidoFino(p * 0.0038 + t * 0.02);
  agua = mix(agua, vec3(0.95, 0.98, 1.0), clamp(espuma, 0.0, 1.0) * 0.9);

  // ---- Terra das ilhas sem modelo 3D ------------------------------------------
  vec3 cor = agua;
  if (sdn < 2.0 && ehModelada(dado) < 0.5) {
    float dentro = max(0.0, -sdn);
    vec3 terra = corTerra(p, dentro, tipo);
    vec3 nT = normalize(cross(dFdy(vMundo), dFdx(vMundo)));
    terra *= 0.7 + 0.45 * max(dot(nT, uSol), 0.0);
    terra *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 5.0, dentro));
    cor = mix(terra, agua, smoothstep(-1.2, 1.2, sdn));
  }

  // Névoa fixa do mapa e o horizonte.
  float bruma = dado.b * (0.55 + 0.45 * ruidoB(p * 0.0005 + vec2(t * 0.003, t * 0.001)));
  cor = mix(cor, vec3(0.84, 0.89, 0.94), bruma * 0.8);
  cor = mix(cor, uHorizonte, smoothstep(uNevoa.x, uNevoa.y, dist));
  gl_FragColor = vec4(cor, 1.0);
}
`

export class Mar3d {
  readonly malha: THREE.Mesh
  readonly material: THREE.ShaderMaterial
  private readonly passo: number

  constructor(terra: THREE.Texture, mundo: { x: number; y: number }, horizonte: THREE.Color, sol: THREE.Vector3, tamanho = 8000, segmentos = 400) {
    const ruido = new THREE.DataTexture(dadosRuido(), LADO_RUIDO, LADO_RUIDO, THREE.RGBAFormat)
    ruido.wrapS = ruido.wrapT = THREE.RepeatWrapping
    ruido.magFilter = ruido.minFilter = THREE.LinearFilter
    ruido.needsUpdate = true
    const ondas = componentes()
    const u: Record<string, THREE.IUniform> = {
      uTerra: { value: terra },
      uRuido: { value: ruido },
      uMundo: { value: new THREE.Vector2(mundo.x, mundo.y) },
      uTempo: { value: 0 },
      uAltura: { value: ALTURA_ONDAS },
      uAmplitudes: { value: new THREE.Vector4(...ondas.map((o) => o.amplitude)) },
      uFases: { value: new THREE.Vector4(...ondas.map((o) => o.fase)) },
      uVento: { value: new THREE.Vector3(1, 0, 0.5) },
      uSol: { value: sol.clone().normalize() },
      uHorizonte: { value: horizonte },
      uNevoa: { value: new THREE.Vector2(1600, 3900) },
    }
    ondas.forEach((o, i) => {
      const k = (Math.PI * 2) / o.comprimento
      u[`uOnda${i}`] = { value: new THREE.Vector4(Math.cos(o.direcao), Math.sin(o.direcao), k, k * o.velocidade) }
    })
    this.material = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERTICE, fragmentShader: FRAGMENTO })
    const geo = new THREE.PlaneGeometry(tamanho, tamanho, segmentos, segmentos)
    geo.rotateX(-Math.PI / 2)
    this.malha = new THREE.Mesh(geo, this.material)
    this.malha.frustumCulled = false
    this.passo = tamanho / segmentos
  }

  /** A malha acompanha a câmera, sempre encaixada na grade (senão a água "nada"). */
  atualizar(t: number, centro: THREE.Vector3, vento: { direcao: number; intensidade: number }) {
    this.material.uniforms.uTempo.value = t
    this.malha.position.set(Math.round(centro.x / this.passo) * this.passo, 0, Math.round(centro.z / this.passo) * this.passo)
    this.material.uniforms.uVento.value.set(Math.cos(vento.direcao), Math.sin(vento.direcao), vento.intensidade)
  }

  set altura(v: number) {
    this.material.uniforms.uAltura.value = v
  }
}
