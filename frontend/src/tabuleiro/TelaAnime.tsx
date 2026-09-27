import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ANIMACOES } from './boneco/animacoes'
import { carregarVrm, PersonagemVrm, type NomeAnimVrm } from './anime/personagemVrm'
import { Rastro } from './anime/rastro'
import { texturaTabuleiro, type TipoCasa } from './cena/texturas'

const tiposChao = (c: number, l: number): TipoCasa[][] =>
  Array.from({ length: l }, (_, i) => Array.from({ length: c }, (_, k) => ((i * 3 + k * 5) % 11 === 0 ? 'grade' : 'madeira')))

/**
 * Teste do personagem de anime (VRoid): o modelo num pedaço de convés,
 * com as animações do combate, para conferir antes de ir para o tabuleiro.
 */

const MODELO = '/modelos/pirata-teste.vrm'

export default function TelaAnime() {
  const hospedeiro = useRef<HTMLDivElement>(null)
  const [anim, setAnim] = useState<NomeAnimVrm>('parado')
  const [giro, setGiro] = useState(0)
  const [vel, setVel] = useState(1)
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const estado = useRef({ anim: 'parado' as NomeAnimVrm, giro: 0, vel: 1, t: 0 })
  estado.current.giro = giro
  estado.current.vel = vel

  useEffect(() => {
    estado.current.anim = anim
    estado.current.t = 0
  }, [anim])

  useEffect(() => {
    const el = hospedeiro.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const cena = new THREE.Scene()
    cena.background = new THREE.Color(0x0e2e6a)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    const sol = new THREE.DirectionalLight(0xfff0dc, 2.8)
    sol.position.set(-3, 6, 4)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 })
    cena.add(sol, new THREE.HemisphereLight(0xbcd4ff, 0x6a4a30, 1.2))
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshLambertMaterial({ map: texturaTabuleiro(7, 5, tiposChao(7, 5), 48, 7) }))
    chao.rotation.x = -Math.PI / 2
    chao.receiveShadow = true
    cena.add(chao)
    const rastro = new Rastro()
    cena.add(rastro.malha)

    let personagem: PersonagemVrm | null = null
    carregarVrm(MODELO)
      .then((vrm) => {
        personagem = new PersonagemVrm(vrm)
        cena.add(personagem.grupo)
        setPronto(true)
        ;(window as unknown as { personagemVrm?: PersonagemVrm }).personagemVrm = personagem
      })
      .catch((e) => setErro(String(e)))

    const redimensionar = () => {
      const r = el.getBoundingClientRect()
      renderer.setSize(r.width, r.height)
      camera.aspect = r.width / r.height
      camera.updateProjectionMatrix()
    }
    redimensionar()
    window.addEventListener('resize', redimensionar)
    // mesma inclinação da câmera do tabuleiro, mais perto
    const alvo = new THREE.Vector3(0, 0.85, 0)
    const dir = new THREE.Vector3(Math.sin(-0.14), Math.sin(0.62), Math.cos(0.62)).normalize()
    camera.position.copy(alvo).addScaledVector(dir, 7.5)
    camera.lookAt(alvo)

    let anterior = performance.now()
    let quadro = 0
    const laco = (agora: number) => {
      quadro = requestAnimationFrame(laco)
      const dtReal = Math.min(0.05, (agora - anterior) / 1000)
      anterior = agora
      const e = estado.current
      const dt = dtReal * e.vel
      if (personagem) {
        const a = ANIMACOES[e.anim]
        const dur = a.quadros / a.fps
        e.t += dt / dur
        if (e.t >= 1) e.t = a.laco ? e.t % 1 : e.t > 1.6 ? 0 : e.t
        // testes automáticos podem fixar a fase: window.__fase = 0.25
        const fixa = (window as unknown as { __fase?: number }).__fase
        const t = fixa ?? Math.min(1, e.t)
        personagem.giro = THREE.MathUtils.degToRad(e.giro)
        const extra = personagem.posar(e.anim, t)
        personagem.atualizar(dt)
        const l = personagem.lamina()
        rastro.atualizar(dt, l.ponta, l.meio, extra.rastro ? extra.rastro.forca : 0, 0xfff2c0, 0xff9a30, 0xd8401c)
      }
      renderer.render(cena, camera)
    }
    quadro = requestAnimationFrame(laco)
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('resize', redimensionar)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  const botao = (ativo: boolean) => ({
    background: ativo ? '#ffd88a' : '#3a2616',
    color: ativo ? '#2a1608' : '#f3e3c3',
    border: '1px solid #b58a4a',
    padding: '3px 9px',
    font: '700 12px monospace',
    cursor: 'pointer',
  })

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div ref={hospedeiro} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', left: 12, top: 12, padding: 10, background: 'rgba(20,12,8,0.8)', border: '2px solid #b58a4a', color: '#f3e3c3', font: '12px monospace', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <b style={{ color: '#ffd88a' }}>Personagem anime (VRoid) {pronto ? '' : erro ? '— erro' : '— carregando…'}</b>
        {erro && <span style={{ color: '#ff8a7a' }}>{erro}</span>}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(Object.keys(ANIMACOES) as NomeAnimVrm[]).map((a) => (
            <button key={a} style={botao(anim === a)} onClick={() => setAnim(a)}>
              {a}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          Direção:
          {[0, 45, 90, 135, 180, 225, 270, 315].map((g) => (
            <button key={g} style={botao(giro === g)} onClick={() => setGiro(g)}>
              {g}°
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          Velocidade:
          {[1, 0.5, 0.25, 0.1].map((v) => (
            <button key={v} style={botao(vel === v)} onClick={() => setVel(v)}>
              {v}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
