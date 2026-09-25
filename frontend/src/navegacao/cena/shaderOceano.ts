import { AGITACAO_TEMPESTADE, QUANTIDADE_ONDAS } from '../sim/ondas'

/**
 * O oceano inteiro é um shader: não há um tile de imagem sequer.
 *
 * Desempenho: nada de ruído calculado por pixel. O relevo da água é a soma
 * analítica das mesmas ondas que movem o navio (sim/ondas.ts), e todo o
 * "grão" vem de uma textura de ruído pequena e repetida (uRuido). São poucas
 * leituras de textura e alguns senos por pixel.
 *
 * Entradas:
 * - uTerra (terra.png): distância até a costa, tipo de terra e névoa fixa;
 * - uDescoberta: o que o jogador já viu;
 * - uRuido: ruído 256×256 que se repete (gerado no navegador);
 * - uOnda0..3, uAmplitudes, uFases: o campo de ondas;
 * - uTempestade: centro e raios da tempestade, em px do mundo.
 *
 * A vista é inclinada (cena/projecao.ts): o quad cobre a tela em coordenadas
 * projetadas e o shader desfaz o achatamento para achar o ponto do mundo.
 */
if (QUANTIDADE_ONDAS !== 4) throw new Error('O shader do oceano espera exatamente 4 ondas.')

export const FRAGMENTO_OCEANO = /* glsl */ `
#pragma phaserTemplate(shaderName)
precision highp float;

uniform sampler2D uTerra;
uniform sampler2D uDescoberta;
uniform sampler2D uRuido;
uniform vec4 uRet;
uniform vec4 uVista;
uniform vec2 uMundo;
uniform float uTempo;
uniform vec3 uVento;
uniform float uGrade;
uniform float uCelula;
uniform float uAchatamento;
// Cada onda: direção (xy), número de onda k, frequência angular ω.
uniform vec4 uOnda0;
uniform vec4 uOnda1;
uniform vec4 uOnda2;
uniform vec4 uOnda3;
uniform vec4 uAmplitudes;
uniform vec4 uFases;
uniform vec4 uTempestade;
uniform float uTempestadeNaVista;
uniform float uRelampago;

varying vec2 outTexCoord;

float ruido(vec2 p) { return texture2D(uRuido, p).r; }
float ruidoB(vec2 p) { return texture2D(uRuido, p).g; }
float ruidoFino(vec2 p) { return texture2D(uRuido, p).b; }

vec2 coordTextura(vec2 p) {
  vec2 t = p / uMundo;
  return vec2(t.x, 1.0 - t.y);
}

float distanciaCosta(vec2 p) {
  return (texture2D(uTerra, coordTextura(p)).r * 255.0 - 128.0) / 127.0 * 320.0;
}

float tempestadeEm(vec2 p) {
  float d = length(p - uTempestade.xy);
  float f = 1.0 - clamp((d - uTempestade.w) / (uTempestade.z - uTempestade.w), 0.0, 1.0);
  return f * f * (3.0 - 2.0 * f);
}

// Soma das ondas: altura e gradiente analíticos.
void onda(vec4 o, float a, float f, vec2 p, float t, inout float h, inout vec2 g) {
  float fase = o.z * dot(o.xy, p) - o.w * t + f;
  h += a * sin(fase);
  g += a * o.z * cos(fase) * o.xy;
}

vec3 corTerra(vec2 p, float dentro, float tipo) {
  float n1 = ruido(p * 0.0021);
  float n2 = ruidoB(p * 0.0007);
  float n3 = ruidoFino(p * 0.0035);

  vec3 areia = vec3(0.93, 0.84, 0.60);
  vec3 grama = mix(vec3(0.33, 0.60, 0.28), vec3(0.47, 0.72, 0.33), n2);
  vec3 mata = mix(vec3(0.15, 0.38, 0.19), vec3(0.24, 0.49, 0.24), n1);
  vec3 ilha = mix(areia, grama, smoothstep(10.0, 18.0, dentro + n1 * 10.0));
  ilha = mix(ilha, mata, smoothstep(40.0, 90.0, dentro + n2 * 50.0));
  // Copas de árvore: manchinhas mais escuras e mais claras.
  ilha *= 0.84 + 0.3 * n3 * smoothstep(30.0, 60.0, dentro);

  float estria = ruidoB(p * vec2(0.0012, 0.005));
  vec3 rocha = mix(vec3(0.55, 0.20, 0.18), vec3(0.80, 0.42, 0.34), estria);
  rocha *= 0.85 + 0.3 * n1;

  vec3 pedra = mix(vec3(0.46, 0.47, 0.52), vec3(0.72, 0.73, 0.77), n1);
  pedra = mix(pedra, vec3(0.94, 0.96, 0.99), smoothstep(0.55, 0.65, n2));

  float pVermelho = smoothstep(0.25, 0.45, tipo) * (1.0 - smoothstep(0.75, 0.92, tipo));
  float pMontanha = smoothstep(0.75, 0.92, tipo);
  return ilha * (1.0 - pVermelho - pMontanha) + rocha * pVermelho + pedra * pMontanha;
}

void main() {
  vec2 uv = outTexCoord;
  // Ponto projetado (tela) → ponto do mundo: desfaz o achatamento vertical.
  vec2 pp = uRet.xy + vec2(uv.x, 1.0 - uv.y) * uRet.zw;
  vec2 p = vec2(pp.x, pp.y / uAchatamento);
  float t = uTempo;
  vec2 vento = uVento.xy;
  float forca = uVento.z;

  vec2 tc = p / uMundo;
  float fora = max(max(-tc.x, tc.x - 1.0), max(-tc.y, tc.y - 1.0));

  vec4 dado = texture2D(uTerra, coordTextura(clamp(p, vec2(1.0), uMundo - 1.0)));
  float sd = (dado.r * 255.0 - 128.0) / 127.0 * 320.0;
  float tipo = dado.g;
  float nevoa = dado.b;
  float sdn = sd + (ruido(p * 0.004) - 0.5) * 16.0;

  float tormenta = tempestadeEm(p);
  float agitacao = 1.0 + ${AGITACAO_TEMPESTADE.toFixed(2)} * tormenta;

  // ---- Água ------------------------------------------------------------------
  float h = 0.0;
  vec2 g = vec2(0.0);
  onda(uOnda0, uAmplitudes.x * agitacao, uFases.x, p, t, h, g);
  onda(uOnda1, uAmplitudes.y * agitacao, uFases.y, p, t, h, g);
  onda(uOnda2, uAmplitudes.z * agitacao, uFases.z, p, t, h, g);
  onda(uOnda3, uAmplitudes.w * agitacao, uFases.w, p, t, h, g);
  float amplitudeTotal = dot(uAmplitudes, vec4(1.0)) * agitacao;
  float hn = h / amplitudeTotal;

  // Variação lenta de tom que corre com o vento (lida da textura, bem suave).
  vec2 deslize = vento * t * (0.004 + 0.006 * forca);
  float det = ruido(p * 0.0011 + deslize);

  vec3 normal = normalize(vec3(-g * (5.0 + 3.0 * tormenta), 1.0));
  // Sol vindo de trás e da esquerda da câmera inclinada.
  vec3 sol = normalize(vec3(-0.45, -0.75, 0.55));
  float difusa = dot(normal, sol);
  vec3 olho = normalize(vec3(0.0, 0.55, 0.84));
  // Brilho do sol em pontinhos (cintila), não em mancha.
  float brilho = pow(max(dot(reflect(-sol, normal), olho), 0.0), 24.0);
  brilho *= 0.8 * smoothstep(0.63, 0.78, ruidoFino(p * 0.0034 + vec2(t * 0.03, -t * 0.02)));

  float profundidade = clamp(sdn / 300.0, 0.0, 1.0);
  vec3 raso = vec3(0.23, 0.78, 0.76);
  vec3 medio = vec3(0.05, 0.46, 0.66);
  vec3 fundo = vec3(0.02, 0.23, 0.43);
  vec3 agua = mix(raso, medio, smoothstep(0.0, 0.3, profundidade));
  agua = mix(agua, fundo, smoothstep(0.3, 1.0, profundidade));
  // Mar de tempestade: chumbo esverdeado.
  agua = mix(agua, vec3(0.08, 0.17, 0.2), tormenta * 0.75);

  // Cavado mais escuro, crista mais clara: é o que dá leitura de volume.
  agua *= 0.84 + 0.22 * hn + 0.3 * difusa;
  agua *= 0.95 + 0.1 * det;
  agua += brilho * (0.3 + 0.2 * forca) * (1.0 - tormenta * 0.7);

  // Carneirinhos: espuma nas cristas da onda dominante — linhas longas e
  // paralelas, que é como o olho lê "mar agitado". Raras no mar normal,
  // fartas na tempestade. O ruído só quebra a linha em pedaços.
  float faseDominante = uOnda0.z * dot(uOnda0.xy, p) - uOnda0.w * t + uFases.x + (det - 0.5) * 2.0;
  float faseCruzada = uOnda1.z * dot(uOnda1.xy, p) - uOnda1.w * t + uFases.y;
  float crista = smoothstep(mix(0.93, 0.72, tormenta), 0.99, sin(faseDominante));
  crista = max(crista, smoothstep(0.9, 0.99, sin(faseCruzada)) * tormenta * 0.7);
  float quebra = smoothstep(0.42, 0.6, ruidoFino(p * 0.0032 + deslize * 2.0));
  float carneiro = crista * quebra * smoothstep(0.1, 0.5, hn + 0.3);
  agua = mix(agua, vec3(0.9, 0.95, 0.97), carneiro * (0.1 + 0.75 * tormenta) * smoothstep(20.0, 80.0, sdn));

  // Cáusticas no raso.
  float caustica = smoothstep(0.62, 0.82, ruidoFino(p * 0.0036 + vec2(t * 0.02, -t * 0.015)));
  agua += caustica * 0.12 * (1.0 - smoothstep(0.0, 140.0, sdn)) * (1.0 - tormenta);

  // Arrebentação: faixas de espuma que andam em direção à praia.
  float faixas = sin(sdn * 0.12 + t * (2.1 + tormenta * 1.5));
  float espuma = smoothstep(0.72, 1.0, faixas) * (1.0 - smoothstep(8.0, 70.0 + tormenta * 60.0, sdn)) * 0.75;
  espuma += 1.0 - smoothstep(0.0, 9.0 + tormenta * 10.0, sdn);
  espuma *= 0.75 + 0.25 * ruidoFino(p * 0.0038 + t * 0.02);
  agua = mix(agua, vec3(0.95, 0.98, 1.0), clamp(espuma, 0.0, 1.0) * 0.9);

  // ---- Terra ------------------------------------------------------------------
  vec3 cor = agua;
  if (sdn < 2.0) {
    float dentro = max(0.0, -sdn);
    vec3 terra = corTerra(p, dentro, tipo);
    // Com a câmera inclinada, a costa virada para o sul mostra um barranco.
    float sul = distanciaCosta(p + vec2(0.0, 14.0));
    float barranco = smoothstep(0.0, 10.0, sul - sd) * (1.0 - smoothstep(0.0, 16.0, dentro));
    terra = mix(terra, terra * vec3(0.55, 0.45, 0.38), barranco);
    terra *= 0.92 + 0.12 * smoothstep(0.0, 60.0, dentro) * ruidoB(p * 0.0015);
    terra *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 5.0, dentro));
    cor = mix(terra, agua, smoothstep(-1.2, 1.2, sdn));
  }

  // ---- Névoa fixa do mapa -------------------------------------------------------
  float bruma = nevoa * (0.55 + 0.45 * ruidoB(p * 0.0005 + vec2(t * 0.003, t * 0.001)));
  cor = mix(cor, vec3(0.84, 0.89, 0.94), bruma * 0.8);

  // ---- Tempestade: sombra das nuvens, céu fechado e clarão --------------------------
  float nuvem = smoothstep(0.35, 0.75, ruidoB(p * 0.0004 + vec2(t * 0.004, t * 0.002)));
  cor *= 1.0 - tormenta * (0.35 + 0.3 * nuvem);
  cor = mix(cor, cor * vec3(0.62, 0.68, 0.78), uTempestadeNaVista * 0.55);
  cor += vec3(0.7, 0.78, 1.0) * uRelampago * (0.2 + 0.35 * tormenta);

  // ---- Grade lógica (depuração) ------------------------------------------------
  if (uGrade > 0.5) {
    vec2 gr = abs(fract(p / uCelula + 0.5) - 0.5) * uCelula;
    float linha = 1.0 - smoothstep(0.0, 1.2, min(gr.x, gr.y));
    vec2 gc = abs(fract(p / (uCelula * 10.0) + 0.5) - 0.5) * uCelula * 10.0;
    float linhaChunk = 1.0 - smoothstep(0.0, 2.0, min(gc.x, gc.y));
    cor = mix(cor, vec3(1.0), linha * 0.12);
    cor = mix(cor, vec3(1.0, 0.85, 0.3), linhaChunk * 0.5);
  }

  // ---- Névoa de descoberta -----------------------------------------------------------
  float visto = texture2D(uDescoberta, coordTextura(p)).r;
  float conhecido = smoothstep(0.12, 0.42, visto + (ruido(p * 0.0012 + t * 0.002) - 0.5) * 0.35);
  vec3 desconhecido = mix(vec3(0.06, 0.09, 0.15), vec3(0.15, 0.19, 0.27), ruidoB(p * 0.0004 + vec2(t * 0.001, 0.0)));
  cor = mix(desconhecido, cor, conhecido);
  cor = mix(cor, desconhecido * 0.8, smoothstep(0.0, 0.01, fora));

  // ---- Névoa de borda de tela (mais fechada no topo: é o horizonte) -------------------
  vec2 sv = (pp - uVista.xy) / uVista.zw - 0.5;
  float borda = length(sv * vec2(1.7, 2.0)) + max(0.0, -sv.y) * 0.35;
  float veu = smoothstep(0.62, 1.12, borda + (ruidoB(p * 0.0003 + vec2(t * 0.0015, 0.0)) - 0.5) * 0.35);
  vec3 corVeu = mix(vec3(0.76, 0.84, 0.9), vec3(0.2, 0.24, 0.3), uTempestadeNaVista);
  cor = mix(cor, corVeu, veu * 0.55);

  gl_FragColor = vec4(cor, 1.0);
}
`
