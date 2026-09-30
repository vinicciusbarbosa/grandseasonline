import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CenaTabuleiro, type EstadoTela } from './cena/CenaTabuleiro'
import { HudBatalha } from './batalha/HudBatalha'

/**
 * Batalha de tripulação no tabuleiro (protótipo): dois navios lado a lado,
 * tabuleiro 10×20, 5 piratas contra 5 da Marinha (IA). Roda sem API nem login.
 */

const VAZIO: EstadoTela = { personagens: [], flutuantes: [], aura: 0, hakiArmamento: false, velocidade: 1, escala: 1, dica: '', batalha: null }
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

      {estado.batalha && cena?.controle && <HudBatalha b={estado.batalha} c={cena.controle} velocidade={estado.velocidade} mudarVelocidade={(v) => cena.setVelocidade(v)} />}
    </div>
  )
}
