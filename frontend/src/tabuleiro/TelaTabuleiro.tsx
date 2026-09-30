import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CenaTabuleiro, type EstadoTela } from './cena/CenaTabuleiro'

/**
 * Tela de testes do combate em tabuleiro (pixel art): dois navios lado a
 * lado, tabuleiro 10×20 e os dois capitães animados. Roda sem API nem login.
 */

const VAZIO: EstadoTela = { personagens: [], flutuantes: [], aura: 0, hakiArmamento: false, velocidade: 1, escala: 1, dica: '' }
const nada = () => () => {}

export default function TelaTabuleiro() {
  const hospedeiro = useRef<HTMLDivElement>(null)
  const [cena, setCena] = useState<CenaTabuleiro | null>(null)

  useEffect(() => {
    const c = new CenaTabuleiro(hospedeiro.current!)
    setCena(c)
    return () => c.destruir()
  }, [])

  const estado = useSyncExternalStore(cena?.inscrever ?? nada, cena?.retrato ?? (() => VAZIO))

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b2a66', overflow: 'hidden', userSelect: 'none' }}>
      <div ref={hospedeiro} style={{ position: 'absolute', inset: 0 }} />
      {/* Haki do Rei: a tela escurece em vermelho nas bordas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: estado.aura,
          background: 'radial-gradient(ellipse at center, rgba(120,0,20,0) 35%, rgba(60,0,12,0.55) 75%, rgba(10,0,4,0.85) 100%)',
          mixBlendMode: 'multiply',
        }}
      />

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

      {/* HUD mínimo por enquanto */}
      <button
        onClick={() => cena?.hakiDoRei()}
        title="Haki do Rei (liga/desliga)"
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          width: 44,
          height: 44,
          font: '700 18px monospace',
          background: 'rgba(40,4,10,0.8)',
          color: '#ffd6dc',
          border: '1px solid #ff4a62',
          cursor: 'pointer',
        }}
      >
        H
      </button>
      <button
        onClick={() => cena?.hakiArmamento()}
        title="Haki de armamento (liga/desliga) — tecla B"
        style={{
          position: 'absolute',
          left: 64,
          bottom: 12,
          width: 44,
          height: 44,
          font: '700 18px monospace',
          background: estado.hakiArmamento ? 'rgba(10,2,6,0.95)' : 'rgba(20,20,30,0.8)',
          color: estado.hakiArmamento ? '#c890ff' : '#d8d8e8',
          border: `1px solid ${estado.hakiArmamento ? '#9b4df0' : '#8888aa'}`,
          boxShadow: estado.hakiArmamento ? '0 0 10px #8a3ae6' : 'none',
          cursor: 'pointer',
        }}
      >
        B
      </button>
    </div>
  )
}
