/**
 * O oceano inteiro é um shader: não há um tile de imagem sequer.
 *
 * Entradas:
 * - uTerra (terra.png): distância até a costa, tipo de terra e névoa fixa;
 * - uDescoberta: o que o jogador já viu (atualizado conforme navega);
 * - uVento: direção e força, para as ondas correrem com o vento.
 *
 * Camadas, de baixo para cima: profundidade (raso turquesa → fundo escuro),
 * ondas com iluminação, cristas estilizadas, espuma de arrebentação na costa,
 * terra (ilha, Red Line, montanha), névoa fixa, névoa de descoberta e, por
 * fim, a névoa de borda de tela.
 */
export const FRAGMENTO_OCEANO = /* glsl */ `
#pragma phaserTemplate(shaderName)
precision highp float;

uniform sampler2D uTerra;
uniform sampler2D uDescoberta;
uniform vec4 uRet;
uniform vec4 uVista;
uniform vec2 uMundo;
uniform float uTempo;
uniform vec3 uVento;
uniform float uGrade;
uniform float uCelula;

varying vec2 outTexCoord;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ruido(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

// Altura das ondas: duas camadas correndo com o vento em velocidades diferentes.
float ondas(vec2 p, vec2 vento, float forca, float t) {
  vec2 q = p * 0.0042;
  float a = fbm(q + vento * t * (0.05 + 0.05 * forca));
  float b = fbm(q * 2.4 - vento.yx * t * 0.07 + 3.1);
  return a * 0.62 + b * 0.38;
}

float marcasDeOnda(vec2 p, vec2 vento, float forca, float t, vec2 tamanho, float semente) {
  vec2 frente = normalize(vento + vec2(1e-4, 0.0));
  vec2 lado = vec2(-frente.y, frente.x);
  // Eixo x: través; eixo y: contra o vento (as marcas derivam a favor dele).
  vec2 q = vec2(dot(p, lado), -dot(p, frente));
  q.y += t * (8.0 + 22.0 * forca);
  vec2 id = floor(q / tamanho);
  vec2 f = fract(q / tamanho) - 0.5;
  float sorte = hash(id + semente);
  if (sorte > 0.16 + 0.24 * forca) return 0.0;
  vec2 desvio = (vec2(hash(id + semente + 3.1), hash(id + semente + 7.7)) - 0.5) * 0.45;
  vec2 lp = (f - desvio) * tamanho;
  float raio = 30.0 + 26.0 * hash(id + semente + 1.3);
  float vida = fract(t * (0.12 + 0.1 * hash(id + semente + 9.1)) + sorte * 7.0);
  float surge = sin(vida * 3.14159);
  // Arco: pedaço de circunferência com a barriga virada para o vento.
  float d = abs(length(lp - vec2(0.0, raio)) - raio);
  float abertura = 1.0 - smoothstep(0.18, 0.5, abs(lp.x) / raio);
  float traco = (1.0 - smoothstep(0.5, 1.6, d)) * abertura * step(lp.y, raio * 0.5);
  return traco * surge * surge;
}

vec2 coordTextura(vec2 p) {
  vec2 t = p / uMundo;
  return vec2(t.x, 1.0 - t.y);
}

float distanciaCosta(vec2 p) {
  return (texture2D(uTerra, coordTextura(p)).r * 255.0 - 128.0) / 127.0 * 320.0;
}

vec3 corTerra(vec2 p, float dentro, float tipo, float t) {
  float n1 = fbm(p * 0.02);
  float n2 = fbm(p * 0.005);

  // Ilha: praia, grama, mata.
  vec3 areia = vec3(0.93, 0.84, 0.60);
  vec3 grama = mix(vec3(0.33, 0.60, 0.28), vec3(0.45, 0.70, 0.32), n2);
  vec3 mata = mix(vec3(0.16, 0.40, 0.20), vec3(0.24, 0.48, 0.24), n1);
  vec3 ilha = mix(areia, grama, smoothstep(10.0, 18.0, dentro + n1 * 10.0));
  ilha = mix(ilha, mata, smoothstep(40.0, 90.0, dentro + n2 * 50.0));
  ilha *= 0.88 + 0.24 * n1;

  // Red Line: rocha vermelha com estrias verticais e paredão escuro na costa.
  float estria = fbm(p * vec2(0.012, 0.045));
  vec3 rocha = mix(vec3(0.55, 0.20, 0.18), vec3(0.80, 0.42, 0.34), estria);
  rocha = mix(vec3(0.30, 0.10, 0.09), rocha, smoothstep(6.0, 30.0, dentro + n1 * 12.0));
  rocha *= 0.85 + 0.3 * n2;

  // Montanha de borda: cinza com neve.
  vec3 pedra = mix(vec3(0.46, 0.47, 0.52), vec3(0.70, 0.71, 0.75), n1);
  pedra = mix(pedra, vec3(0.94, 0.96, 0.99), smoothstep(0.55, 0.65, n2 + dentro * 0.001));

  float pVermelho = smoothstep(0.25, 0.45, tipo) * (1.0 - smoothstep(0.75, 0.92, tipo));
  float pMontanha = smoothstep(0.75, 0.92, tipo);
  vec3 cor = ilha * (1.0 - pVermelho - pMontanha) + rocha * pVermelho + pedra * pMontanha;

  // Relevo: luz vinda do noroeste pelo gradiente do ruído.
  float relevo = fbm(p * 0.02 + vec2(1.5, 1.5)) - n1;
  return cor * (1.0 + relevo * 0.9);
}

void main() {
  vec2 uv = outTexCoord;
  vec2 p = uRet.xy + vec2(uv.x, 1.0 - uv.y) * uRet.zw;
  float t = uTempo;
  vec2 vento = uVento.xy;
  float forca = uVento.z;

  vec2 tc = p / uMundo;
  float fora = max(max(-tc.x, tc.x - 1.0), max(-tc.y, tc.y - 1.0));

  vec4 dado = texture2D(uTerra, coordTextura(clamp(p, vec2(1.0), uMundo - 1.0)));
  float sd = (dado.r * 255.0 - 128.0) / 127.0 * 320.0;
  float tipo = dado.g;
  float nevoa = dado.b;

  // Contorno orgânico: o ruído mexe um pouco na linha da costa.
  float sdn = sd + (fbm(p * 0.025) - 0.5) * 16.0;

  // ---- Água -------------------------------------------------------------------
  float h = ondas(p, vento, forca, t);
  float hx = ondas(p + vec2(6.0, 0.0), vento, forca, t);
  float hy = ondas(p + vec2(0.0, 6.0), vento, forca, t);
  float relevoOnda = 9.0 + 7.0 * forca;
  vec3 normal = normalize(vec3((h - hx) * relevoOnda, (h - hy) * relevoOnda, 1.0));
  vec3 sol = normalize(vec3(-0.45, -0.6, 0.66));
  float difusa = dot(normal, sol);
  float brilho = pow(max(dot(reflect(-sol, normal), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);

  float profundidade = clamp(sdn / 300.0, 0.0, 1.0);
  vec3 raso = vec3(0.23, 0.78, 0.76);
  vec3 medio = vec3(0.05, 0.46, 0.66);
  vec3 fundo = vec3(0.02, 0.22, 0.42);
  vec3 agua = mix(raso, medio, smoothstep(0.0, 0.3, profundidade));
  agua = mix(agua, fundo, smoothstep(0.3, 1.0, profundidade));
  agua *= 0.8 + 0.35 * difusa;
  agua += brilho * (0.35 + 0.25 * forca);

  // Cristas: marcas de onda em arco, soltas e passageiras — o traço de
  // desenho animado do mar. Cada célula (no referencial do vento) pode ter
  // uma marca que nasce, deriva a favor do vento e some.
  agua = mix(agua, vec3(0.9, 0.97, 1.0), marcasDeOnda(p, vento, forca, t, vec2(130.0, 80.0), 0.0) * (0.35 + 0.35 * forca) * smoothstep(25.0, 90.0, sdn));
  agua = mix(agua, vec3(0.9, 0.97, 1.0), marcasDeOnda(p, vento, forca, t, vec2(80.0, 52.0), 5.3) * (0.18 + 0.22 * forca) * smoothstep(25.0, 90.0, sdn));

  // Cáusticas no raso.
  float caustica = smoothstep(0.62, 0.8, fbm(p * 0.03 + vec2(t * 0.25, -t * 0.2)));
  agua += caustica * 0.14 * (1.0 - smoothstep(0.0, 140.0, sdn));

  // Arrebentação: faixas de espuma que andam em direção à praia.
  float faixas = sin(sdn * 0.12 + t * 2.1);
  float espuma = smoothstep(0.72, 1.0, faixas) * (1.0 - smoothstep(8.0, 70.0, sdn)) * 0.75;
  espuma += 1.0 - smoothstep(0.0, 9.0, sdn);
  espuma *= 0.75 + 0.25 * ruido(p * 0.08 + t);
  agua = mix(agua, vec3(0.95, 0.98, 1.0), clamp(espuma, 0.0, 1.0) * 0.9);

  // ---- Terra ------------------------------------------------------------------
  vec3 terra = corTerra(p, max(0.0, -sdn), tipo, t);
  // Traço escuro na costa, como contorno de ilustração.
  terra *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 5.0, -sdn));

  vec3 cor = mix(terra, agua, smoothstep(-1.2, 1.2, sdn));

  // ---- Névoa fixa do mapa -------------------------------------------------------
  float bruma = nevoa * (0.55 + 0.45 * fbm(p * 0.004 + vec2(t * 0.03, t * 0.01)));
  cor = mix(cor, vec3(0.84, 0.89, 0.94), bruma * 0.8);

  // ---- Grade lógica (depuração) ------------------------------------------------
  if (uGrade > 0.5) {
    vec2 g = abs(fract(p / uCelula + 0.5) - 0.5) * uCelula;
    float linha = 1.0 - smoothstep(0.0, 1.2, min(g.x, g.y));
    vec2 gc = abs(fract(p / (uCelula * 10.0) + 0.5) - 0.5) * uCelula * 10.0;
    float linhaChunk = 1.0 - smoothstep(0.0, 2.0, min(gc.x, gc.y));
    cor = mix(cor, vec3(1.0), linha * 0.12);
    cor = mix(cor, vec3(1.0, 0.85, 0.3), linhaChunk * 0.5);
  }

  // ---- Névoa de descoberta -----------------------------------------------------------
  float visto = texture2D(uDescoberta, coordTextura(p)).r;
  float conhecido = smoothstep(0.12, 0.42, visto + (fbm(p * 0.008 + t * 0.02) - 0.5) * 0.35);
  vec3 desconhecido = mix(vec3(0.06, 0.09, 0.15), vec3(0.15, 0.19, 0.27), fbm(p * 0.0025 + vec2(t * 0.01, 0.0)));
  cor = mix(desconhecido, cor, conhecido);

  // Fora do recorte: o mesmo véu do desconhecido.
  cor = mix(cor, desconhecido * 0.8, smoothstep(0.0, 0.01, fora));

  // ---- Névoa de borda de tela -----------------------------------------------------------
  vec2 sv = (p - uVista.xy) / uVista.zw - 0.5;
  float borda = length(sv * vec2(1.7, 2.0));
  float veu = smoothstep(0.62, 1.12, borda + (fbm(p * 0.0022 + vec2(t * 0.015, 0.0)) - 0.5) * 0.35);
  cor = mix(cor, vec3(0.76, 0.84, 0.9), veu * 0.5);

  gl_FragColor = vec4(cor, 1.0);
}
`
