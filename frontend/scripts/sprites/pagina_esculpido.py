"""Página de visualização do personagem esculpido (sprites/esculpir.py):
    python3 pagina_esculpido.py saida.html boneco.json
O volume é pintado projetando as próprias vistas (frente, costas e os dois
lados), cada uma no lado para onde a superfície está virada."""
import json, sys
d = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'boneco.json'))
html = '''<title>Almirante Esculpido</title>
<style>
  :root { color-scheme: dark; --fundo: #0e1622; --texto: #f6ead0; --ouro: #e8c26a; }
  html, body { height: 100%; margin: 0; background: var(--fundo); color: var(--texto); font: 14px Georgia, serif; overflow: hidden; }
  #palco { position: fixed; inset: 0; }
  .legenda { position: fixed; left: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); max-width: 420px; background: rgba(12,20,34,.82); border: 1px solid rgba(232,194,106,.45); border-radius: 8px; padding: 10px 12px; line-height: 1.4; }
  .legenda b { color: var(--ouro); font-family: Cinzel, Georgia, serif; }
  .botoes { position: fixed; right: 16px; top: calc(16px + env(safe-area-inset-top, 0px)); display: flex; gap: 6px; }
  button { font: 13px Georgia, serif; color: var(--texto); background: rgba(12,20,34,.86); border: 1px solid var(--ouro); border-radius: 8px; height: 36px; padding: 0 12px; cursor: pointer; }
  button[aria-pressed="true"] { background: var(--ouro); color: #1b1409; }
  #erro { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; padding: 24px; text-align: center; }
</style>
<div id="palco"></div>
<div class="botoes">
  <button id="girar" aria-pressed="true">Girar</button>
  <button id="modo" aria-pressed="false">Ver volume</button>
</div>
<div class="legenda"><b>Almirante esculpido</b><br>Volume tirado das silhuetas de frente, costas e dos dois lados, pintado projetando os próprios desenhos. Arraste para girar; pinça ou roda para aproximar.</div>
<div id="erro">Não foi possível iniciar o 3D neste aparelho.</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
const D = ''' + json.dumps(d) + ''';
const bin = (b64, T) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
let r;
try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { document.getElementById('erro').style.display = 'flex'; }
r.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('palco').appendChild(r.domElement);
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x0e1622);
const cam = new THREE.PerspectiveCamera(32, 1, 1, 20000);
cam.position.set(0, D.altura * 0.55, 2100);
const ctl = new THREE.OrbitControls(cam, r.domElement);
ctl.target.set(0, D.altura * 0.5, 0);
ctl.autoRotate = true; ctl.autoRotateSpeed = 2.2; ctl.enableDamping = true;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(bin(D.pos, Float32Array), 3));
geo.setAttribute('normal', new THREE.BufferAttribute(bin(D.nor, Float32Array), 3));
geo.setIndex(new THREE.BufferAttribute(bin(D.idx, Uint32Array), 1));
const tl = new THREE.TextureLoader();
const V = D.vistas;
const tex = (k) => { const t = tl.load('data:image/webp;base64,' + V[k].img); t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
const mat = new THREE.ShaderMaterial({
  uniforms: {
    tF: { value: tex('frente') }, tB: { value: tex('costas') }, tE: { value: tex('esquerda') }, tD: { value: tex('direita') },
    c: { value: new THREE.Vector4(V.frente.c, V.costas.c, V.esquerda.c, V.direita.c) },
    l: { value: new THREE.Vector4(V.frente.l, V.costas.l, V.esquerda.l, V.direita.l) },
    alt: { value: D.altura }, volume: { value: 0 },
  },
  vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vNv;
    void main(){ vP = position; vN = normal; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tF, tB, tE, tD; uniform vec4 c, l; uniform float alt, volume;
    varying vec3 vP; varying vec3 vN; varying vec3 vNv;
    void main(){
      vec3 n = normalize(vN);
      float v = vP.y / (alt + 1.0);
      vec3 f = texture2D(tF, vec2((c.x + vP.x) / l.x, v)).rgb;
      vec3 b = texture2D(tB, vec2((c.y - vP.x) / l.y, v)).rgb;
      vec3 e = texture2D(tE, vec2((c.z - vP.z) / l.z, v)).rgb;
      vec3 d = texture2D(tD, vec2((c.w + vP.z) / l.w, v)).rgb;
      // cada ponto usa praticamente a vista para onde está virado (mistura só na quina)
      float cima = 0.05 * max(n.y, 0.0);
      float af = pow(max(n.z, 0.0), 12.0) + cima, ab = pow(max(-n.z, 0.0), 12.0) + cima;
      float ae = pow(max(n.x, 0.0), 12.0), ad = pow(max(-n.x, 0.0), 12.0);
      // na cabeça o perfil desenhado viraria um "segundo rosto" de lado: lá vale a frente/costas
      float cabeca = smoothstep(alt - 150.0, alt - 120.0, vP.y);
      ae *= 1.0 - 0.9 * cabeca; ad *= 1.0 - 0.9 * cabeca;
      af += 0.02 * cabeca * step(0.0, n.z); ab += 0.02 * cabeca * step(n.z, 0.0);
      vec3 cor = (f * af + b * ab + e * ae + d * ad) / max(af + ab + ae + ad, 1e-4);
      vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
      float luz = 0.85 + 0.2 * max(dot(vNv, L), 0.0);
      vec3 cinza = vec3(0.78) * (0.35 + 0.65 * max(dot(vNv, L), 0.0));
      gl_FragColor = vec4(mix(cor * luz, cinza, volume), 1.0);
    }`,
});
cena.add(new THREE.Mesh(geo, mat));
const chao = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: 0x1b2638 }));
chao.rotation.x = -Math.PI / 2; chao.position.y = -2; cena.add(chao);
function tamanho(){ const w = innerWidth, h = innerHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', tamanho); tamanho();
const bGirar = document.getElementById('girar'), bModo = document.getElementById('modo');
bGirar.onclick = () => { ctl.autoRotate = !ctl.autoRotate; bGirar.setAttribute('aria-pressed', ctl.autoRotate); };
bModo.onclick = () => { const on = mat.uniforms.volume.value < 0.5; mat.uniforms.volume.value = on ? 1 : 0; bModo.setAttribute('aria-pressed', on); };
window.__ver = (a, vol) => { ctl.autoRotate = false; cam.position.set(Math.sin(a) * 2100, D.altura * 0.55, Math.cos(a) * 2100); mat.uniforms.volume.value = vol ? 1 : 0; ctl.update(); r.render(cena, cam); };
(function laco(){ ctl.update(); r.render(cena, cam); requestAnimationFrame(laco); })();
</script>
'''
open(sys.argv[1], 'w').write(html)
print(len(html) // 1024, 'KB')
