import type { Alcance, Icone, Tipo } from './regras'

/** Ícones desenhados em SVG (sem arte externa): tipo de golpe e alcance. */

export const COR_TIPO: Record<Tipo, string> = { corte: '#dfe6ef', impacto: '#d39a5f', fogo: '#ff7a2e', tiro: '#f2d34b', haki: '#b77bff' }
export const NOME_ALCANCE: Record<Alcance, string> = { um: 'Único', leque: 'Leque', todos: 'Todos', time: 'Tripulação' }

export function IconeTipo({ tipo, tam = 24, cor, icone }: { tipo: Tipo | 'time'; tam?: number; cor?: string; icone?: Icone }) {
  const c = cor ?? (tipo === 'time' ? '#f0c76a' : COR_TIPO[tipo])
  if (icone) return <Desenho icone={icone} tam={tam} c={c} />
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {tipo === 'corte' && (
        <>
          <path d="M5 19 L17 7 L20 4 L19.2 8.2 L7 20" fill={c} fillOpacity={0.25} />
          <path d="M4 15 L9 20 M3 21 L6 18" />
        </>
      )}
      {tipo === 'impacto' && <path d="M12 2 L14 8 L20 6 L16 11 L22 14 L15 15 L16 22 L12 17 L7 22 L8 15 L2 13 L8 10 L5 4 L10 7 Z" fill={c} fillOpacity={0.25} />}
      {tipo === 'fogo' && <path d="M12 22 C7 22 5 18 6 14 C7 11 9 10 9 7 C11 9 12 10 12 12 C13 10 13 7 12 3 C16 6 19 10 19 14 C19 18 16 22 12 22 Z M12 22 C10 22 9 20 9.5 18.5 C10 17 11.5 16 12 14.5 C13 16 15 17 14.5 19 C14.2 20.7 13.3 22 12 22 Z" fill={c} fillOpacity={0.3} />}
      {tipo === 'tiro' && (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.6" fill={c} />
          <path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" />
        </>
      )}
      {tipo === 'haki' && <path d="M4 18 L3 7 L8 11 L12 4 L16 11 L21 7 L20 18 Z M4 21 H20" fill={c} fillOpacity={0.25} />}
      {tipo === 'time' && (
        <>
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="1.8" fill={c} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d={`M${12 + Math.cos((a * Math.PI) / 180) * 6} ${12 + Math.sin((a * Math.PI) / 180) * 6} L${12 + Math.cos((a * Math.PI) / 180) * 10.5} ${12 + Math.sin((a * Math.PI) / 180) * 10.5}`} />
          ))}
        </>
      )}
    </svg>
  )
}

/** Anel de progresso (energia do ultimate). */
export function Anel({ v, tam, cor, grossura = 4, children }: { v: number; tam: number; cor: string; grossura?: number; children?: React.ReactNode }) {
  const r = (tam - grossura) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: tam, height: tam }}>
      <svg width={tam} height={tam} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={tam / 2} cy={tam / 2} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={grossura} fill="rgba(10,16,28,0.7)" />
        <circle cx={tam / 2} cy={tam / 2} r={r} stroke={cor} strokeWidth={grossura} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, v)))} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

/** Um desenho por habilidade (para não ficarem iguais as do mesmo tipo). */
function Desenho({ icone, tam, c }: { icone: Icone; tam: number; c: string }) {
  const f = { fill: c, fillOpacity: 0.25 }
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {icone === 'coroa' && (
        <>
          <path d="M5 14 L4 6 L8.5 9 L12 3.5 L15.5 9 L20 6 L19 14 Z" {...f} />
          <path d="M3 18 C6 16 9 20 12 18 C15 16 18 20 21 18 M5 21.5 C8 20 10 22.5 12 21.5 C14 20.5 16 22.5 19 21.5" />
        </>
      )}
      {icone === 'imbuido' && (
        <>
          <path d="M6 18 L18 6 L20.5 3.5 L19.8 7.6 L8 19.5" {...f} />
          <path d="M4 14 L10 20 M2.5 21.5 L5.5 18.5" />
          <path d="M13 3 C14 5 12 6 13.5 8 M21 11 C19 12 18 10 16 11.5 M9 5 L10 7 M19 15 L17 14" strokeWidth={1.4} />
        </>
      )}
      {icone === 'ordem' && (
        <>
          <circle cx="12" cy="12" r="5.5" />
          <circle cx="12" cy="12" r="1.8" fill={c} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d={`M${12 + Math.cos((a * Math.PI) / 180) * 5.5} ${12 + Math.sin((a * Math.PI) / 180) * 5.5} L${12 + Math.cos((a * Math.PI) / 180) * 10.5} ${12 + Math.sin((a * Math.PI) / 180) * 10.5}`} />
          ))}
        </>
      )}
      {icone === 'duplo' && <path d="M3 17 L15 5 M8 21 L20 9 M14 3 L17 3 L17 6 M19 7 L22 7 L22 10" />}
      {icone === 'giro' && (
        <>
          <path d="M20 12 A8 8 0 1 1 15 4.6" />
          <path d="M15 1.5 L15.5 5 L12 5.5" />
          <path d="M8 16 L16 8" strokeWidth={2.2} />
        </>
      )}
      {icone === 'saque' && (
        <>
          <path d="M2 14 H15" strokeWidth={3} />
          <path d="M15 14 H22 L20 12" />
          <path d="M6 8 L9 10 M12 6 L13 9 M18 7 L16.5 10" strokeWidth={1.4} />
        </>
      )}
      {icone === 'punho' && (
        <>
          <path d="M7 11 H15 C17 11 18 12.5 18 14 V16 C18 18.5 16 20 13.5 20 H9 C7.5 20 6.5 19 6.5 17.5 V12 C6.5 11.4 6.8 11 7 11 Z" {...f} />
          <path d="M9.5 11 V14 M12 11 V14 M14.5 11 V14" strokeWidth={1.3} />
          <path d="M10 8 C9 6 11 5 10 2.5 C13 4 14 6 13 8 M15.5 8.5 C15.5 7 17 6.5 16.5 4.5 C18.5 6 18.5 8 17.5 9" />
        </>
      )}
      {icone === 'vagalumes' && (
        <>
          {[
            [6, 7, 2.2],
            [15, 5, 1.6],
            [18, 13, 2.4],
            [9, 15, 1.8],
            [13, 20, 1.4],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} fillOpacity={0.6} />
          ))}
          <path d="M6 3.5 V4.5 M6 9.5 V10.5 M2.5 7 H3.5 M8.5 7 H9.5 M18 9 V10 M18 16 V17 M14.5 13 H15.5 M20.5 13 H21.5" strokeWidth={1.2} />
        </>
      )}
      {icone === 'rajada' && (
        <>
          {[5, 12, 19].map((y) => (
            <path key={y} d={`M3 ${y} H13 M13 ${y - 2} H18 C20 ${y - 2} 21 ${y - 1} 21 ${y} C21 ${y + 1} 20 ${y + 2} 18 ${y + 2} H13 Z`} {...f} />
          ))}
        </>
      )}
      {icone === 'perna' && (
        <>
          <circle cx="12" cy="9" r="6" />
          <circle cx="12" cy="9" r="1.5" fill={c} />
          <path d="M12 1.5 V4 M12 14 V16.5 M4.5 9 H7 M17 9 H19.5" />
          <path d="M12 17 V22 M9 19.5 L12 22.5 L15 19.5" />
        </>
      )}
    </svg>
  )
}
