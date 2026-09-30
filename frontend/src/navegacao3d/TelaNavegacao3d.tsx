import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cena3d, type Angulo, type Painel } from './Cena3d'

/** Tela de teste: /teste-navegacao3d */
export default function TelaNavegacao3d() {
  const tela = useRef<HTMLCanvasElement>(null)
  const cena = useRef<Cena3d | null>(null)
  const [painel, setPainel] = useState<Painel | null>(null)

  useEffect(() => {
    const c = new Cena3d(tela.current!)
    c.aoAtualizar = setPainel
    cena.current = c
    return () => c.destruir()
  }, [])

  const botao = (a: Angulo, texto: string, tecla: string) => (
    <button
      key={a}
      onClick={() => cena.current?.mudarAngulo(a)}
      style={{
        ...estilo.botao,
        background: painel?.angulo === a ? '#e8c26a' : 'rgba(20,28,40,0.75)',
        color: painel?.angulo === a ? '#1b1409' : '#f6ead0',
      }}
    >
      {tecla} · {texto}
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1220' }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
      <div style={{ ...estilo.caixa, top: 12, left: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Navegação 3D — teste</div>
        <div>W / S — subir e baixar as velas</div>
        <div>A / D — leme</div>
        <div>Arrastar — girar a câmera · Roda — zoom</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {botao('alto', '3/4 alta', '1')}
          {botao('terceira', '3ª pessoa', '2')}
          {botao('cima', 'De cima', '3')}
        </div>
        <label style={{ display: 'block', marginTop: 8 }}>
          Altura das ondas: ×{painel?.alturaOndas.toFixed(1) ?? '3.0'}
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            defaultValue={3}
            onChange={(e) => cena.current?.mudarAlturaOndas(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <Link to="/navegacao" style={{ color: '#e8c26a' }}>
          ← navegação atual
        </Link>
      </div>
      {painel && (
        <div style={{ ...estilo.caixa, bottom: 12, left: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>{painel.velas}</span>
          <span>{(painel.velocidade / 9).toFixed(1)} nós</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Vento
            <span style={{ display: 'inline-block', transform: `rotate(${(-painel.rumoVento * 180) / Math.PI - 90}deg)`, fontSize: 18 }}>➤</span>
            {Math.round(painel.vento * 100)}%
          </span>
          <span style={{ opacity: 0.6 }}>{painel.fps} fps</span>
        </div>
      )}
    </div>
  )
}

const estilo = {
  caixa: {
    position: 'absolute',
    padding: '10px 12px',
    background: 'rgba(20,28,40,0.72)',
    color: '#f6ead0',
    border: '1px solid rgba(232,194,106,0.5)',
    borderRadius: 8,
    font: '13px/1.45 Georgia, serif',
    userSelect: 'none',
  },
  botao: { border: '1px solid rgba(232,194,106,0.6)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', font: '12px Georgia, serif' },
} as const
