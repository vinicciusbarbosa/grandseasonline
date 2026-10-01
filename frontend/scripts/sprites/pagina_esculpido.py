"""Página de visualização do personagem esculpido: python3 pagina_esculpido.py saida.html boneco.json"""
import json, sys
d = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'boneco.json'))
dados = json.dumps(d)
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
</style>
<div id="palco"></div>
<div class="botoes">
  <button id="girar" aria-pressed="true">Girar</button>
  <button id="modo" aria-pressed="false">Ver volume</button>
</div>
<div class="legenda"><b>Almirante esculpido</b><br>Volume tirado das silhuetas de frente, lado e costas, pintado projetando os próprios desenhos da folha. Arraste para girar, pinça ou roda para aproximar.</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
const D = ''' + dados + ''';
const bin = (b64, T) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('palco').appendChild(r.domElement);
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x0e1622);
const cam = new THREE.PerspectiveCamera(35, 1, 1, 10000);
cam.position.set(0, D.pe * 0.55, 1900);
const ctl = new THREE.OrbitControls(cam, r.domElement);
ctl.target.set(0, (D.pe - 20) * 0.5, 0);
ctl.autoRotate = true; ctl.autoRotateSpeed = 2.2; ctl.enableDamping = true;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(bin(D.pos, Float32Array), 3));
geo.setAttribute('normal', new THREE.BufferAttribute(bin(D.nor, Float32Array), 3));
geo.setIndex(new THREE.BufferAttribute(bin(D.idx, Uint32Array), 1));
const tl = new THREE.TextureLoader();
const tex = (k) => { const t = tl.load('data:image/webp;base64,' + D.vistas[k]); t.minFilter = THREE.LinearFilter; return t; };
const mat = new THREE.ShaderMaterial({
  uniforms: {
    tF: { value: tex('frente') }, tB: { value: tex('costas') }, tS: { value: tex('lado') },
    cF: { value: D.centros.frente }, cB: { value: D.centros.costas }, cS: { value: D.centros.lado },
    wF: { value: D.tamanhos.frente[0] }, wB: { value: D.tamanhos.costas[0] }, wS: { value: D.tamanhos.lado[0] },
    pe: { value: D.pe }, alt: { value: D.altura }, volume: { value: 0 },
  },
  vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vNv;
    void main(){ vP = position; vN = normal; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tF, tB, tS; uniform float cF, cB, cS, wF, wB, wS, pe, alt, volume;
    varying vec3 vP; varying vec3 vN; varying vec3 vNv;
    void main(){
      vec3 n = normalize(vN);
      float v = 1.0 - (pe - vP.y) / alt;
      vec3 f = texture2D(tF, vec2((cF + vP.x) / wF, v)).rgb;
      vec3 b = texture2D(tB, vec2((cB - vP.x) / wB, v)).rgb;
      vec3 s = texture2D(tS, vec2((cS - vP.z) / wS, v)).rgb;
      float af = pow(max(n.z, 0.0), 2.0) + 0.15 * max(n.y, 0.0);
      float ab = pow(max(-n.z, 0.0), 2.0) + 0.15 * max(n.y, 0.0);
      float as = pow(abs(n.x), 2.0) * 1.2;
      vec3 c = (f * af + b * ab + s * as) / max(af + ab + as, 1e-3);
      float luz = 0.82 + 0.25 * max(dot(vNv, normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
      vec3 cinza = vec3(0.75) * (0.4 + 0.6 * max(dot(vNv, normalize(vec3(-0.4, 0.6, 0.7))), 0.0));
      gl_FragColor = vec4(mix(c * luz, cinza, volume), 1.0);
    }`,
});
const boneco = new THREE.Mesh(geo, mat);
boneco.rotation.y = Math.PI;
cena.add(boneco);
const chao = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: 0x1b2638 }));
chao.rotation.x = -Math.PI / 2; chao.position.y = -2; cena.add(chao);
function tamanho(){ const w = innerWidth, h = innerHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', tamanho); tamanho();
const bGirar = document.getElementById('girar'), bModo = document.getElementById('modo');
bGirar.onclick = () => { ctl.autoRotate = !ctl.autoRotate; bGirar.setAttribute('aria-pressed', ctl.autoRotate); };
bModo.onclick = () => { const on = mat.uniforms.volume.value < 0.5; mat.uniforms.volume.value = on ? 1 : 0; bModo.setAttribute('aria-pressed', on); };
window.__ver = (a, vol) => { ctl.autoRotate = false; cam.position.set(Math.sin(a) * 1900, D.pe * 0.55, Math.cos(a) * 1900); mat.uniforms.volume.value = vol ? 1 : 0; ctl.update(); r.render(cena, cam); };
(function laco(){ ctl.update(); r.render(cena, cam); requestAnimationFrame(laco); })();
</script>
'''
open(sys.argv[1], 'w').write(html)
print(len(html) // 1024, 'KB')
