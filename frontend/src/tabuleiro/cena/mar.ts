import * as THREE from 'three'

/**
 * Mar em volta e entre os navios: azul em degraus de cor, com cristas e
 * espuma branca em "pixels" do mundo (a grade é fixa na água, então nada
 * cintila quando a câmera muda de tamanho). Espuma batendo nos cascos.
 */
export function criarMar(cascos: THREE.Vector4[]) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tempo: { value: 0 },
      cascos: { value: cascos },
    },
    vertexShader: /* glsl */ `
      varying vec2 vMundo;
      void main() {
        vec4 m = modelMatrix * vec4(position, 1.0);
        vMundo = m.xz;
        gl_Position = projectionMatrix * viewMatrix * m;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float tempo;
      uniform vec4 cascos[2];
      varying vec2 vMundo;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
      }
      float caixa(vec2 p, vec4 r) {
        vec2 c = (r.xy + r.zw) * 0.5, e = (r.zw - r.xy) * 0.5;
        vec2 d = abs(p - c) - e;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }
      void main() {
        // grade de pixels no mundo: 14 por unidade (uma casa)
        vec2 p = floor(vMundo * 16.0) / 16.0;
        float t = tempo;
        float onda = sin(p.x * 1.7 + p.y * 0.5 + t * 1.3 + sin(p.y * 1.1 + t * 0.5) * 1.2) * 0.5
                   + sin(p.x * 0.8 - p.y * 1.9 - t * 1.0) * 0.5;
        float n = ruido(p * 2.2 + vec2(t * 0.3, -t * 0.12)) * 0.55 + ruido(p * 5.5 - vec2(t * 0.6, t * 0.25)) * 0.45;
        float v = onda * 0.22 + n;
        float d = min(caixa(p, cascos[0]), caixa(p, cascos[1]));
        float bate = 0.5 + 0.5 * sin(t * 2.2 - d * 7.0 + ruido(p * 2.0) * 4.0);
        float espuma = step(d, 0.06 + 0.16 * bate * n) + step(0.93, v + (d < 1.0 ? 0.1 : 0.0));
        vec3 cor = v < 0.42 ? vec3(0.05, 0.22, 0.55) : v < 0.62 ? vec3(0.09, 0.33, 0.72) : v < 0.8 ? vec3(0.19, 0.49, 0.85) : vec3(0.52, 0.76, 0.98);
        // sombra dos cascos na água
        cor *= mix(0.5, 1.0, smoothstep(0.0, 1.2, d));
        if (espuma > 0.5) cor = vec3(0.92, 0.97, 1.0);
        if (d < 0.0) cor = vec3(0.03, 0.07, 0.16);
        gl_FragColor = vec4(cor, 1.0);
      }
    `,
  })
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), mat)
  mar.rotation.x = -Math.PI / 2
  mar.position.y = -0.8
  return { mar, mat }
}
