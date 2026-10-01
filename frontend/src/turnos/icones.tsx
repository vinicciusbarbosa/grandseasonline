import type { Skill, TipoArma } from '../tabuleiro/batalha/armas'
import { FRUTAS } from '../tabuleiro/batalha/armas'

/**
 * Ícones das skills desenhados em SVG (sem arte externa): um desenho por
 * skill, na cor da arma ou do elemento da fruta.
 */

const COR_ARMA: Record<TipoArma, string> = { espada: '#dfe6ef', maca: '#d9a066', espingarda: '#f2d34b', adaga: '#9fe3c8' }
const COR_ELEMENTO: Record<string, string> = { fogo: '#ff7a2e', gelo: '#9be8ff', luz: '#fff07a', fumaca: '#cfcfcf' }
const COR_FRUTA: Record<string, string> = { borracha: '#ff8a8a', bisao: '#d39a5f' }

export function corDaSkill(s: Skill, arma: TipoArma) {
  if (s.cura) return '#6dff9a'
  if (s.elemento) return COR_ELEMENTO[s.elemento]
  for (const [id, f] of Object.entries(FRUTAS)) if (f.skills.includes(s)) return COR_FRUTA[id] ?? '#e8c26a'
  return COR_ARMA[arma]
}

type Glifo =
  | 'corte' | 'duplo' | 'onda' | 'lanca' | 'giro' | 'impacto' | 'martelo' | 'choque' | 'racha' | 'meteoro' | 'tiro' | 'mira' | 'espalha' | 'rajada'
  | 'adaga' | 'arremesso' | 'vital' | 'cruz' | 'nuvem' | 'prisao' | 'punho' | 'vagalumes' | 'chama' | 'sol' | 'sabre' | 'raio' | 'feixe'
  | 'floco' | 'punhos' | 'vapor' | 'chifres' | 'coroa' | 'olho' | 'armamento'

const GLIFO: Record<string, Glifo> = {
  corte: 'corte', 'corte-duplo': 'duplo', 'corte-voador': 'onda', 'estocada-perfurante': 'lanca', 'tornado-laminas': 'giro',
  pancada: 'impacto', esmagar: 'martelo', 'onda-choque': 'choque', tremor: 'racha', 'martelada-titanica': 'meteoro',
  tiro: 'tiro', 'tiro-certeiro': 'mira', 'chumbo-grosso': 'espalha', rajada: 'rajada', 'tiro-perfurante': 'lanca',
  estocada: 'adaga', 'corte-rapido': 'duplo', arremesso: 'arremesso', 'golpe-vital': 'vital', 'danca-laminas': 'giro',
  'primeiros-socorros': 'cruz',
  'nuvem-fumaca': 'nuvem', 'prisao-fumaca': 'prisao',
  hiken: 'punho', hotarubi: 'vagalumes', enjomo: 'chama', entei: 'sol',
  'sabre-luz': 'sabre', yasakani: 'vagalumes', 'chute-luz': 'raio', 'raio-luz': 'feixe',
  'lanca-gelo': 'lanca', 'ice-saber': 'corte', 'ice-time': 'floco', 'era-gelo': 'floco',
  pistola: 'punho', gatling: 'punhos', 'gear-second': 'vapor', 'forma-hibrida': 'chifres',
}

export function IconeSkill({ s, arma, tam = 24, cor }: { s: Skill; arma: TipoArma; tam?: number; cor?: string }) {
  return <Desenho g={GLIFO[s.id] ?? 'impacto'} tam={tam} c={cor ?? corDaSkill(s, arma)} />
}

/** Ícones do Haki (botões de ligar). */
export function IconeHaki({ tipo, tam = 24, cor = '#e8c26a' }: { tipo: 'armamento' | 'rei' | 'observacao' | 'haoshoku'; tam?: number; cor?: string }) {
  return <Desenho g={tipo === 'armamento' ? 'armamento' : tipo === 'observacao' ? 'olho' : tipo === 'rei' ? 'coroa' : 'choque'} tam={tam} c={cor} />
}

function Desenho({ g, tam, c }: { g: Glifo; tam: number; c: string }) {
  const f = { fill: c, fillOpacity: 0.25 }
  const raios = (r0: number, r1: number, n: number, cx = 12, cy = 12) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return <path key={i} d={`M${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0} L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}`} />
    })
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {g === 'corte' && (
        <>
          <path d="M5 19 L17 7 L20 4 L19.2 8.2 L7 20" {...f} />
          <path d="M4 15 L9 20 M3 21 L6 18" />
        </>
      )}
      {g === 'duplo' && <path d="M3 17 L15 5 M8 21 L20 9 M14 3 L17 3 L17 6 M19 7 L22 7 L22 10" />}
      {g === 'onda' && (
        <>
          <path d="M5 4 C14 6 17 12 15 20 C19 14 18 7 9 3 Z" {...f} />
          <path d="M3 9 H8 M2 13 H9 M3 17 H8" strokeWidth={1.3} />
        </>
      )}
      {g === 'lanca' && <path d="M2 22 L16 8 M13 5 L21 3 L19 11 Z M11 11 L13 13" {...f} />}
      {g === 'giro' && (
        <>
          <path d="M20 12 A8 8 0 1 1 15 4.6" />
          <path d="M15 1.5 L15.5 5 L12 5.5" />
          <path d="M8 16 L16 8" strokeWidth={2.2} />
        </>
      )}
      {g === 'impacto' && <path d="M12 2 L14 8 L20 6 L16 11 L22 14 L15 15 L16 22 L12 17 L7 22 L8 15 L2 13 L8 10 L5 4 L10 7 Z" {...f} />}
      {g === 'martelo' && (
        <>
          <path d="M4 6 H14 V12 H4 Z" {...f} />
          <path d="M14 8 H17 M17 6 V12 M9 12 L9 22" strokeWidth={2.2} />
          <path d="M19 3 L21 1 M20 7 H23 M19 11 L21 13" strokeWidth={1.3} />
        </>
      )}
      {g === 'choque' && (
        <>
          <circle cx="12" cy="12" r="2.5" fill={c} />
          <path d="M6 8 A7 7 0 0 0 6 16 M18 8 A7 7 0 0 1 18 16 M3 5 A11 11 0 0 0 3 19 M21 5 A11 11 0 0 1 21 19" />
        </>
      )}
      {g === 'racha' && <path d="M2 20 H22 M12 20 L10 15 L13 12 L10 8 L12 3 M10 15 L6 14 M13 12 L17 10" />}
      {g === 'meteoro' && (
        <>
          <circle cx="15" cy="15" r="6" {...f} />
          <path d="M3 3 L10 10 M7 2 L12 7 M2 7 L7 12" strokeWidth={1.4} />
        </>
      )}
      {g === 'tiro' && (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.6" fill={c} />
          <path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" />
        </>
      )}
      {g === 'mira' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1.2" fill={c} />
          <path d="M12 1 V5 M12 19 V23 M1 12 H5 M19 12 H23" strokeWidth={1.3} />
        </>
      )}
      {g === 'espalha' && (
        <>
          <path d="M2 12 H7 M7 12 L21 4 M7 12 H22 M7 12 L21 20" />
          {[4, 12, 20].map((y) => (
            <circle key={y} cx="21" cy={y} r="1.6" fill={c} />
          ))}
        </>
      )}
      {g === 'rajada' &&
        [5, 12, 19].map((y) => <path key={y} d={`M3 ${y} H13 M13 ${y - 2} H18 C20 ${y - 2} 21 ${y - 1} 21 ${y} C21 ${y + 1} 20 ${y + 2} 18 ${y + 2} H13 Z`} {...f} />)}
      {g === 'adaga' && <path d="M4 20 L14 10 L18 4 L20 6 L14 10 M6 13 L11 18 M3 21 L5 19" {...f} />}
      {g === 'arremesso' && (
        <>
          <path d="M8 16 L17 7 L21 3 L20 8 Z M10 12 L12 14" {...f} />
          <path d="M2 14 H6 M3 18 H7 M5 22 H9" strokeWidth={1.3} />
        </>
      )}
      {g === 'vital' && (
        <>
          <path d="M12 21 C5 15 2 11 5 6.5 C7.5 3.5 11 4.5 12 7 C13 4.5 16.5 3.5 19 6.5 C22 11 19 15 12 21 Z" {...f} />
          <path d="M12 9 V15 M9 12 H15" />
        </>
      )}
      {g === 'cruz' && <path d="M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z" {...f} />}
      {g === 'nuvem' && <path d="M6 18 C2.5 18 2 13 5.5 12.5 C5 8.5 10 7 11.5 10 C12.5 6 18.5 6.5 18.5 11 C22 11 22.5 18 18 18 Z M8 21 H16" {...f} />}
      {g === 'prisao' && (
        <>
          <path d="M6 15 C3 15 3 11 6 10.5 C6 7 10.5 6 12 8.5 C13 5.5 18 6 18 10 C21 10 21.5 15 18 15 Z" {...f} />
          <path d="M7 15 V21 M11 15 V21 M15 15 V21 M5 21 H19" />
        </>
      )}
      {g === 'punho' && (
        <>
          <path d="M7 11 H15 C17 11 18 12.5 18 14 V16 C18 18.5 16 20 13.5 20 H9 C7.5 20 6.5 19 6.5 17.5 V12 C6.5 11.4 6.8 11 7 11 Z" {...f} />
          <path d="M9.5 11 V14 M12 11 V14 M14.5 11 V14" strokeWidth={1.3} />
          <path d="M10 8 C9 6 11 5 10 2.5 C13 4 14 6 13 8 M15.5 8.5 C15.5 7 17 6.5 16.5 4.5 C18.5 6 18.5 8 17.5 9" />
        </>
      )}
      {g === 'punhos' && (
        <>
          {[
            [4, 4],
            [12, 9],
            [5, 14],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="7" height="6" rx="2" {...f} />
          ))}
          <path d="M14 6 H22 M20 12 H23 M15 18 H22" strokeWidth={1.3} />
        </>
      )}
      {g === 'vagalumes' && (
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
      {g === 'chama' && <path d="M12 22 C7 22 5 18 6 14 C7 11 9 10 9 7 C11 9 12 10 12 12 C13 10 13 7 12 3 C16 6 19 10 19 14 C19 18 16 22 12 22 Z M12 22 C10 22 9 20 9.5 18.5 C10 17 11.5 16 12 14.5 C13 16 15 17 14.5 19 C14.2 20.7 13.3 22 12 22 Z" {...f} />}
      {g === 'sol' && (
        <>
          <circle cx="12" cy="12" r="5.5" fill={c} fillOpacity={0.45} />
          {raios(8, 11, 12)}
        </>
      )}
      {g === 'sabre' && (
        <>
          <path d="M6 18 L19 5" strokeWidth={3.2} strokeOpacity={0.35} />
          <path d="M6 18 L19 5" />
          <path d="M3 21 L7 17 M4 15 L9 20" />
        </>
      )}
      {g === 'raio' && <path d="M13 2 L5 13 H11 L9 22 L19 9 H13 L15 2 Z" {...f} />}
      {g === 'feixe' && (
        <>
          <circle cx="5" cy="12" r="3" fill={c} fillOpacity={0.5} />
          <path d="M8 10 H22 M8 14 H22" />
          <path d="M8 12 H22" strokeWidth={3} strokeOpacity={0.35} />
        </>
      )}
      {g === 'floco' && (
        <>
          <path d="M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7" />
          <path d="M9.5 4 L12 6 L14.5 4 M9.5 20 L12 18 L14.5 20" strokeWidth={1.3} />
        </>
      )}
      {g === 'vapor' && (
        <>
          <path d="M7 21 C4 17 9 15 6 11 C4 8 8 5 7 2 M12 21 C9 17 14 15 11 11 C9 8 13 5 12 2 M17 21 C14 17 19 15 16 11 C14 8 18 5 17 2" />
        </>
      )}
      {g === 'chifres' && <path d="M4 3 C3 9 6 12 9 12 M20 3 C21 9 18 12 15 12 M8 12 C8 18 10 21 12 21 C14 21 16 18 16 12 Z" {...f} />}
      {g === 'coroa' && (
        <>
          <path d="M5 14 L4 6 L8.5 9 L12 3.5 L15.5 9 L20 6 L19 14 Z" {...f} />
          <path d="M3 18 C6 16 9 20 12 18 C15 16 18 20 21 18" />
        </>
      )}
      {g === 'olho' && (
        <>
          <path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z" {...f} />
          <circle cx="12" cy="12" r="3" fill={c} />
        </>
      )}
      {g === 'armamento' && (
        <>
          <path d="M8 3 H16 V12 C16 16 14 19 12 21 C10 19 8 16 8 12 Z" fill={c} fillOpacity={0.55} />
          <path d="M8 8 H16" />
        </>
      )}
    </svg>
  )
}

/** Anel de progresso. */
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
