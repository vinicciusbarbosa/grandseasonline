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
uniform float uElevacao;
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
uniform vec2 uRelampagoPos;
// Vagas de tempestade: direção (xy), k, ω; amplitudes e fases em vec2.
uniform vec4 uVaga0;
uniform vec4 uVaga1;
uniform vec2 uVagaAmp;
uniform vec2 uVagaFase;
// Redemoinho: centro (xy), raio de influência, raio de captura (px).
uniform vec4 uRedemoinho;
// Rastro do navio: textura que acompanha o navio e sua janela no mundo.
uniform sampler2D uRastro;
uniform vec4 uJanelaRastro;

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

// Vaga de tempestade: crista pontuda (sobe rápido, desce devagar).
void vaga(vec4 o, float a, float f, vec2 p, float t, inout float h, inout vec2 g) {
  float fase = o.z * dot(o.xy, p) - o.w * t + f;
  float s = (sin(fase) + 1.0) * 0.5;
  h += a * (2.0 * pow(s, 1.5) - 0.8);
  g += a * o.z * 1.5 * pow(s, 0.5) * cos(fase) * o.xy;
}

// Só a altura (sem gradiente), para o deslocamento de paralaxe.
float alturaEm(vec2 p, float t, float tormenta, float agitacao) {
  float h = 0.0;
  h += uAmplitudes.x * sin(uOnda0.z * dot(uOnda0.xy, p) - uOnda0.w * t + uFases.x);
  h += uAmplitudes.y * sin(uOnda1.z * dot(uOnda1.xy, p) - uOnda1.w * t + uFases.y);
  h += uAmplitudes.z * sin(uOnda2.z * dot(uOnda2.xy, p) - uOnda2.w * t + uFases.z);
  h += uAmplitudes.w * sin(uOnda3.z * dot(uOnda3.xy, p) - uOnda3.w * t + uFases.w);
  h *= agitacao;
  float s0 = (sin(uVaga0.z * dot(uVaga0.xy, p) - uVaga0.w * t + uVagaFase.x) + 1.0) * 0.5;
  float s1 = (sin(uVaga1.z * dot(uVaga1.xy, p) - uVaga1.w * t + uVagaFase.y) + 1.0) * 0.5;
  h += tormenta * (uVagaAmp.x * (2.0 * pow(s0, 1.5) - 0.8) + uVagaAmp.y * (2.0 * pow(s1, 1.5) - 0.8));
  return h;
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
  // Paralaxe das ondas: com a câmera inclinada, a crista alta aparece mais
  // acima na tela. Uma iteração basta para as vagas "subirem" de verdade.
  float tormenta0 = tempestadeEm(p);
  float h0 = alturaEm(p, t, tormenta0, 1.0 + ${AGITACAO_TEMPESTADE.toFixed(2)} * tormenta0);
  // Na tempestade a paralaxe é parcial: inteira, as vagas altas "dobram" a imagem.
  p.y = (pp.y + h0 * uElevacao * mix(1.0, 0.5, tormenta0)) / uAchatamento;
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
  vaga(uVaga0, uVagaAmp.x * tormenta, uVagaFase.x, p, t, h, g);
  vaga(uVaga1, uVagaAmp.y * tormenta, uVagaFase.y, p, t, h, g);
  float amplitudeTotal = dot(uAmplitudes, vec4(1.0)) * agitacao + (uVagaAmp.x + uVagaAmp.y) * tormenta;
  float hn = h / amplitudeTotal;

  // Variação lenta de tom que corre com o vento (lida da textura, bem suave).
  vec2 deslize = vento * t * (0.004 + 0.006 * forca);
  float det = ruido(p * 0.0011 + deslize);

  vec3 normal = normalize(vec3(-g * (5.0 + 1.5 * tormenta), 1.0));
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
  agua *= 0.84 + (0.22 + 0.3 * tormenta) * hn + 0.3 * difusa;
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
  agua = mix(agua, vec3(0.9, 0.95, 0.97), carneiro * 0.1 * smoothstep(20.0, 80.0, sdn));
  // ---- Mar de tempestade ---------------------------------------------------------------
  // Diferente do mar aberto: vagas longas + mar picado de cristas agudas por
  // cima + faixas de espuma arrastadas pelo vento. A espuma é lida no
  // referencial da própria onda, então anda junto com ela.
  if (tormenta > 0.01) {
    vec2 frente = normalize(vento + vec2(1e-4, 0.0));
    vec2 lado = vec2(-frente.y, frente.x);
    // Mar picado: três ondas curtas de crista pontuda mas contínua
    // (s³, com s = (1 + sen)/2), sem as quinas que facetavam a água.
    float pic = 0.0;
    vec2 gp = vec2(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 d = normalize(frente + lado * (fi - 1.0) * 0.55);
      float k = 6.2831 / (150.0 - fi * 32.0);
      float fase = k * (dot(d, p) - (38.0 + fi * 6.0) * t) + fi * 2.1;
      float s = 0.5 + 0.5 * sin(fase);
      pic += s * s * s;
      gp += 1.5 * s * s * cos(fase) * k * d;
    }
    pic /= 3.0;
    g += gp * 1.4 * tormenta;
    vec3 nT = normalize(vec3(-g * 6.0, 1.0));
    float luzT = dot(nT, sol);

    float faseVaga0 = uVaga0.z * dot(uVaga0.xy, p) - uVaga0.w * t + uVagaFase.x;
    vec2 naOnda0 = p - uVaga0.xy * (uVaga0.w / uVaga0.z) * t;
    float vagaAlta = smoothstep(0.35, 1.0, sin(faseVaga0));

    // Cavado quase preto, encosta da vaga clara: contraste forte = mar pesado.
    vec3 mar = mix(vec3(0.02, 0.07, 0.1), vec3(0.22, 0.36, 0.38), smoothstep(-0.7, 0.95, hn));
    mar *= 0.7 + 0.55 * luzT;
    mar += vec3(0.12, 0.18, 0.19) * pic * 0.8;

    // Carneiros: nas cristas do mar picado e, farto, na crista da vaga.
    float grao = ruidoFino(naOnda0 * 0.0034);
    float carneirosT = smoothstep(0.55, 0.85, pic) * smoothstep(0.42, 0.62, grao);
    carneirosT = max(carneirosT, smoothstep(0.75, 1.0, sin(faseVaga0)) * smoothstep(0.35, 0.6, grao));
    // Faixas de espuma esticadas na direção do vento (espuma de ventania).
    // Linhas finas desenhadas por fórmula (seno torcido por ruído grosso),
    // longas no sentido do vento e interrompidas aos pedaços.
    vec2 q = vec2(dot(p, lado), dot(p, frente) - t * 70.0);
    float linhas = smoothstep(0.93, 1.0, sin(q.x * 0.11 + ruido(q * vec2(0.0012, 0.0004)) * 9.0));
    float pedacos = smoothstep(0.45, 0.65, ruido(vec2(q.x * 0.002, q.y * 0.0009) + 0.5));
    float faixa = linhas * pedacos * 0.8;
    float espumaT = clamp(carneirosT + faixa * (0.4 + 0.6 * vagaAlta), 0.0, 1.0);
    mar = mix(mar, vec3(0.82, 0.88, 0.9), espumaT * 0.85);

    agua = mix(agua, mar, smoothstep(0.0, 0.45, tormenta) * smoothstep(20.0, 80.0, sdn));
  }

  // ---- Redemoinho ------------------------------------------------------------------
  // Padrão em coordenadas polares: espirais logarítmicas que correm para dentro.
  // Como o desenho depende só do ângulo e do log do raio, ele gira para sempre
  // sem "enrolar" a textura.
  vec2 rc = p - uRedemoinho.xy;
  float rr = length(rc);
  float raioR = uRedemoinho.z;
  float zonaR = 1.0 - smoothstep(raioR * 0.55, raioR * 1.15, rr);
  if (zonaR > 0.0) {
    float teta = atan(rc.y, rc.x);
    float lr = log(rr + 8.0);
    float rn = rr / raioR;
    // Três camadas de espiral: braços largos, estrias médias e fios finos,
    // cada uma mais fechada e mais rápida que a anterior.
    float e1 = teta * 3.0 + lr * 9.0 + t * 3.0;
    float e2 = teta * 7.0 + lr * 16.0 + t * 5.5;
    float e3 = teta * 15.0 + lr * 30.0 + t * 9.0;
    float bracos = 0.5 + 0.5 * sin(e1);
    float estrias = 0.5 + 0.5 * sin(e2 + sin(e1) * 0.8);
    float fios = smoothstep(0.7, 1.0, sin(e3 + sin(e2) * 0.6));
    float fluxo = ruidoFino(vec2(e1 * 0.035 - t * 0.02, lr * 0.45));
    float flocos = smoothstep(0.66, 0.8, ruidoFino(vec2(e2 * 0.02 - t * 0.05, lr * 0.9)));

    // Funil: escurece e afunda em direção ao centro, com a encosta iluminada.
    float funil = 1.0 - smoothstep(0.0, raioR * 0.95, rr);
    vec2 encosta = rc / max(rr, 1.0);
    float luzFunil = dot(normalize(vec3(encosta * funil * 1.6, 1.0)), sol);
    vec3 redemoinho = mix(vec3(0.04, 0.3, 0.42), vec3(0.01, 0.07, 0.13), pow(funil, 1.3));
    redemoinho *= 0.65 + 0.55 * luzFunil;

    // Brilho ciano nos braços (como na referência), mais forte perto da garganta.
    vec3 ciano = vec3(0.35, 0.85, 1.0);
    float perto = 1.0 - smoothstep(0.1, 0.9, rn);
    redemoinho += ciano * (0.18 * bracos + 0.16 * estrias * perto) * (0.5 + 0.5 * fluxo);
    redemoinho += vec3(0.8, 0.95, 1.0) * fios * 0.28 * perto;

    // Anéis concêntricos na borda, correndo para dentro.
    float aneis = smoothstep(0.82, 1.0, sin(rr * 0.09 + t * 3.2)) * smoothstep(0.35, 0.6, rn) * (1.0 - smoothstep(0.85, 1.1, rn));
    redemoinho += vec3(0.6, 0.85, 0.95) * aneis * 0.22;

    // Espuma nas espirais e flocos soltos girando.
    float espumaR = smoothstep(0.6, 0.92, bracos * (0.6 + 0.6 * fluxo)) * (1.0 - smoothstep(0.3, 1.0, rn));
    redemoinho = mix(redemoinho, vec3(0.92, 0.97, 1.0), clamp(espumaR * 0.7 + flocos * perto * 0.55, 0.0, 1.0));

    // Garganta: anel branco revolto e brilhante, com a borda "fervendo".
    float borda = 0.13 + 0.015 * sin(teta * 9.0 + t * 11.0) + 0.01 * sin(teta * 17.0 - t * 7.0);
    float garganta = exp(-pow((rn - borda) / 0.045, 2.0));
    redemoinho = mix(redemoinho, vec3(0.95, 0.99, 1.0), clamp(garganta * (0.75 + 0.25 * fluxo), 0.0, 1.0));
    redemoinho += ciano * exp(-pow((rn - borda) / 0.12, 2.0)) * 0.25;

    // O fundo: um buraco escuro com uma espiral rápida por dentro.
    float dentro = 1.0 - smoothstep(0.04, 0.12, rn);
    vec3 fundoR = mix(vec3(0.0, 0.02, 0.04), vec3(0.05, 0.18, 0.26), 0.5 + 0.5 * sin(teta * 4.0 + lr * 14.0 + t * 12.0));
    redemoinho = mix(redemoinho, fundoR * (0.4 + 0.6 * rn / 0.12), dentro);
    agua = mix(agua, redemoinho, zonaR);
  }

  // ---- Rastro do navio ---------------------------------------------------------------
  vec2 rq = (p - uJanelaRastro.xy) / uJanelaRastro.z;
  if (rq.x > 0.0 && rq.y > 0.0 && rq.x < 1.0 && rq.y < 1.0) {
    // A textura guarda um resíduo baixo que não apaga (8 bits): corta abaixo dele.
    float rastro = max(0.0, (texture2D(uRastro, vec2(rq.x, 1.0 - rq.y)).r - 0.1) / 0.9);
    // Borda da janela sem emenda.
    rastro *= smoothstep(0.0, 0.06, min(min(rq.x, rq.y), min(1.0 - rq.x, 1.0 - rq.y)));
    // Água revolvida fica mais clara e turquesa; a espuma aparece quebrada
    // pelo mesmo ruído da arrebentação, nunca como uma faixa chapada.
    agua = mix(agua, mix(agua, raso * 1.1, 0.55), smoothstep(0.0, 0.5, rastro));
    float grao = ruidoFino(p * 0.0045 + vec2(t * 0.05, -t * 0.03));
    float espumaRastro = smoothstep(0.42, 0.85, rastro * (0.35 + 1.0 * grao));
    agua = mix(agua, vec3(0.94, 0.98, 1.0), espumaRastro * 0.85);
  }

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
  float nuvem = smoothstep(0.2, 0.9, ruido(p * 0.00025 + vec2(t * 0.003, t * 0.0015)));
  cor *= 1.0 - tormenta * (0.35 + 0.2 * nuvem);
  cor = mix(cor, cor * vec3(0.62, 0.68, 0.78), uTempestadeNaVista * 0.55);
  // Clarão: forte perto de onde o raio caiu, fraco no resto (nuvens acendendo).
  vec2 dRaio = (p - uRelampagoPos) / 700.0;
  cor += vec3(0.72, 0.8, 1.0) * uRelampago * (0.12 + 0.55 * exp(-dot(dRaio, dRaio))) * (0.4 + 0.6 * tormenta);

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
  float conhecido = smoothstep(0.08, 0.45, visto + (ruido(p * 0.0012 + t * 0.002) - 0.5) * 0.2);
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
