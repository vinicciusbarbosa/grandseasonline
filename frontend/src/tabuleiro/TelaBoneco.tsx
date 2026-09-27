import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Assador, DIRECOES, QUADRO_A, QUADRO_L, type Folhas } from './boneco/assador'
import { CAPITAES, type Aparencia } from './boneco/boneco'
import { PECAS, type Encaixe } from './boneco/pecas'

/**
 * Provador dos bonecos: assa as folhas de pixel art e mostra cada animação
 * rodando nas 8 direções (as 3 da esquerda são o espelho). Dá para trocar
 * as peças de cada encaixe e ver o resultado na hora.
 */

const ORDEM_DIR = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const
const ESPELHO: Record<string, string> = { SW: 'SE', W: 'E', NW: 'NE' }

function Quadro({ folha, dir, escala }: { folha: Folhas[string]; dir: string; escala: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const g = cv.getContext('2d')!
    g.imageSmoothingEnabled = false
    const base = ESPELHO[dir] ?? dir
    const linha = DIRECOES.indexOf(base as (typeof DIRECOES)[number])
    const espelha = dir in ESPELHO
    let q = 0
    let quadro = 0
    let ultimo = performance.now()
    const passo = (agora: number) => {
      quadro = requestAnimationFrame(passo)
      if (agora - ultimo < 1000 / folha.fps) return
      ultimo = agora
      g.clearRect(0, 0, cv.width, cv.height)
      g.save()
      if (espelha) {
        g.translate(cv.width, 0)
        g.scale(-1, 1)
      }
      g.drawImage(folha.canvas, q * QUADRO_L, linha * QUADRO_A, QUADRO_L, QUADRO_A, 0, 0, QUADRO_L * escala, QUADRO_A * escala)
      g.restore()
      q = folha.laco ? (q + 1) % folha.quadros : q + 1 >= folha.quadros + 6 ? 0 : q + 1
      if (q >= folha.quadros) q = Math.min(q, folha.quadros - 1 + 6)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [folha, dir, escala])
  return <canvas ref={ref} width={QUADRO_L * escala} height={QUADRO_A * escala} style={{ imageRendering: 'pixelated', background: '#7a5236' }} />
}

export default function TelaBoneco() {
  const [id, setId] = useState<keyof typeof CAPITAES>('capitao-vermelho')
  const [aparencia, setAparencia] = useState<Aparencia>(CAPITAES['capitao-vermelho'])
  const [folhas, setFolhas] = useState<Folhas | null>(null)
  const [anim, setAnim] = useState('correr')
  const assador = useRef<Assador | null>(null)

  useEffect(() => {
    const r = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    assador.current = new Assador(r)
    return () => r.dispose()
  }, [])

  useEffect(() => {
    if (!assador.current) return
    const f = assador.current.assar(aparencia)
    setFolhas(f)
    ;(window as unknown as { folhasBoneco?: Folhas }).folhasBoneco = f
  }, [aparencia])

  const trocar = (e: Encaixe, i: number) => setAparencia((a) => ({ ...a, [e]: PECAS[e][i].valor }))

  return (
    <div style={{ minHeight: '100vh', background: '#1c1410', color: '#f3e3c3', font: '12px monospace', padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <b style={{ color: '#ffd88a', fontSize: 14 }}>Provador</b>
        {Object.keys(CAPITAES).map((k) => (
          <button
            key={k}
            onClick={() => {
              setId(k)
              setAparencia(CAPITAES[k])
            }}
            style={{ background: id === k ? '#ffd88a' : '#3a2616', color: id === k ? '#2a1608' : '#f3e3c3', border: '1px solid #b58a4a', padding: '2px 8px' }}
          >
            {k}
          </button>
        ))}
        <span style={{ marginLeft: 12 }}>Animação:</span>
        {folhas &&
          Object.keys(folhas).map((a) => (
            <button key={a} onClick={() => setAnim(a)} style={{ background: anim === a ? '#ffd88a' : '#3a2616', color: anim === a ? '#2a1608' : '#f3e3c3', border: '1px solid #b58a4a', padding: '2px 8px' }}>
              {a}
            </button>
          ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {(Object.keys(PECAS) as Encaixe[]).map((e) => (
          <label key={e} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {e}
            <select
              onChange={(ev) => trocar(e, Number(ev.target.value))}
              value={Math.max(0, PECAS[e].findIndex((p) => JSON.stringify(p.valor) === JSON.stringify(aparencia[e])))}
              style={{ background: '#3a2616', color: '#f3e3c3', border: '1px solid #b58a4a' }}
            >
              {PECAS[e].map((p, i) => (
                <option key={p.nome} value={i}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {folhas && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ORDEM_DIR.map((d) => (
            <div key={d} style={{ textAlign: 'center' }}>
              <Quadro folha={folhas[anim]} dir={d} escala={2} />
              <div>{d}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
