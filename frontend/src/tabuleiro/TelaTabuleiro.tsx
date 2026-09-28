import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CenaTabuleiro, type EstadoTela } from './cena/CenaTabuleiro'

/**
 * Tela de testes do combate em tabuleiro (pixel art): dois navios lado a
 * lado, tabuleiro 10×20 e os dois capitães animados. Roda sem API nem login.
 */

const VAZIO: EstadoTela = { personagens: [], flutuantes: [], velocidade: 1, escala: 1, dica: '' }
const nada = () => () => {}

export default function TelaTabuleiro() {
  const hospedeiro = useRef<HTMLDivElement>(null)
  const [cena, setCena] = useState<CenaTabuleiro | null>(null)

  useEffect(() => {
    const c = new CenaTabuleiro(hospedeiro.current!)
    setCena(c)
    return () => c.destruir()
  }, [])

  // celular: painel compacto no canto de baixo e textos de toque
  const toque = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const pequena = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 560

  const estado = useSyncExternalStore(cena?.inscrever ?? nada, cena?.retrato ?? (() => VAZIO))

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b2a66', overflow: 'hidden', userSelect: 'none' }}>
      <div ref={hospedeiro} style={{ position: 'absolute', inset: 0 }} />

      {estado.personagens.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            textAlign: 'center',
            font: '700 11px/1 monospace',
            color: '#fff',
            textShadow: '1px 1px 0 #000',
          }}
        >
          <div style={{ marginBottom: 3, opacity: p.selecionado ? 1 : 0.85 }}>{p.nome}</div>
          <div style={{ width: 56, height: 6, background: '#1a0d0a', border: '1px solid #000', margin: '0 auto', imageRendering: 'pixelated' }}>
            <div style={{ width: `${(100 * p.vida) / p.vidaMax}%`, height: '100%', background: p.vida / p.vidaMax > 0.4 ? '#5fd35a' : '#e8503a' }} />
          </div>
        </div>
      ))}

      {estado.flutuantes.map((f) => (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y - f.t * 46,
            transform: `translate(-50%, -50%) scale(${f.t < 0.12 ? 1 + (0.12 - f.t) * 6 : 1})`,
            opacity: f.t > 0.8 ? (1.2 - f.t) / 0.4 : 1,
            font: '900 22px/1 monospace',
            color: f.cor,
            textShadow: '2px 2px 0 #000, -1px -1px 0 #000',
            pointerEvents: 'none',
          }}
        >
          {f.texto}
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          left: 12,
          ...(pequena ? { bottom: 12 } : { top: 12 }),
          padding: '10px 12px',
          background: 'rgba(20,12,8,0.78)',
          border: '2px solid #b58a4a',
          color: '#f3e3c3',
          font: pequena ? '11px/1.35 monospace' : '12px/1.45 monospace',
          maxWidth: pequena ? 250 : 360,
        }}
      >
        <div style={{ font: '700 14px monospace', color: '#ffd88a', marginBottom: 4 }}>Teste de tabuleiro · 10×20</div>
        <div>{estado.dica}</div>
        <div style={{ opacity: 0.7, marginTop: 4 }}>
          {toque ? 'Toque para escolher · arraste para mover a câmera.' : 'Botão direito ou Esc: cancelar · setas/WASD movem a câmera.'}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <span>Velocidade:</span>
          {[1, 0.5, 0.25, 0.1].map((v) => (
            <button
              key={v}
              onClick={() => cena?.setVelocidade(v)}
              style={{
                font: '700 11px monospace',
                padding: '2px 6px',
                background: estado.velocidade === v ? '#ffd88a' : '#3a2616',
                color: estado.velocidade === v ? '#2a1608' : '#f3e3c3',
                border: '1px solid #b58a4a',
                cursor: 'pointer',
              }}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
