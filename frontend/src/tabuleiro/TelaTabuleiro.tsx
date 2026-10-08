import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CenaTabuleiro, type EstadoTela } from './cena/CenaTabuleiro'
import { HudBatalha } from './batalha/HudBatalha'

/**
 * Batalha de tripulação no tabuleiro (protótipo): dois navios lado a lado,
 * tabuleiro 10×20, 5 piratas contra 5 da Marinha (IA). Roda sem API nem login.
 */

const VAZIO: EstadoTela = { personagens: [], flutuantes: [], aura: 0, lampejo: null, hakiArmamento: false, velocidade: 1, escala: 1, dica: '', batalha: null }
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

      {/* quadro de impacto do anime: a tela pisca negra e vermelha (Haki do Rei) ou branca */}
      {estado.lampejo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: Math.min(1, estado.lampejo.forca * 1.4),
            background:
              estado.lampejo.tipo === 'branco'
                ? '#ffffff'
                : estado.lampejo.fase
                  ? 'radial-gradient(ellipse at center, rgba(255,30,50,0.2) 0%, rgba(120,0,15,0.85) 70%, #0a0003 100%)'
                  : 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(10,0,4,0.9) 65%, #000 100%)',
            mixBlendMode: estado.lampejo.tipo === 'branco' ? 'screen' : 'multiply',
          }}
        />
      )}

      {estado.personagens.map((p) => {
        // inimigo = do outro navio (no multiplayer, o jogador 2 fica com o de baixo)
        const inimigo = !p.id.startsWith((estado.batalha?.mp?.lado ?? 'piratas') === 'piratas' ? 'pirata' : 'marinha')
        const c = inimigo ? '#ff4a3a' : '#3de0b0'
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              font: "700 11px/1.1 'Cinzel', Georgia, serif",
              color: '#fff',
              textShadow: '0 1px 2px #000',
              background: 'linear-gradient(90deg, rgba(6,10,22,.85), rgba(6,10,22,.55))',
              borderLeft: `3px solid ${c}`,
              padding: '2px 6px 3px 5px',
              clipPath: 'polygon(0 0,100% 0,94% 100%,0 100%)',
              minWidth: 78,
              opacity: p.selecionado ? 1 : 0.92,
            }}
          >
            <div style={{ whiteSpace: 'nowrap', marginBottom: 2 }}>{p.nome}</div>
            <div style={{ height: 4, background: '#1a0d0a', transform: 'skewX(-20deg)' }}>
              <div style={{ width: `${(100 * Math.max(0, p.vida)) / p.vidaMax}%`, height: '100%', background: c }} />
            </div>
            <div style={{ fontSize: 9, textAlign: 'right', marginTop: 1, fontFamily: 'Trebuchet MS, sans-serif' }}>
              {Math.max(0, Math.round(p.vida))} / {p.vidaMax}
            </div>
          </div>
        )
      })}

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
