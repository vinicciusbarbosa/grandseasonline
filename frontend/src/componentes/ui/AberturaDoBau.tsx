import { useEffect, useState } from 'react'

/**
 * Animação de abertura do baú, exibida ao entrar no porão.
 *
 * A tampa é um grupo próprio no SVG e gira em torno da dobradiça (o
 * `transform-origin` fica na aresta traseira), então o movimento é o de uma
 * tampa abrindo mesmo, não um sprite trocando de quadro. Uma explosão de luz
 * sai de dentro no meio do giro e a cena se dissolve no inventário.
 *
 * Só roda uma vez por aba: uma animação de dois segundos é encantadora na
 * primeira visita e irritante na décima.
 */
const CHAVE_SESSAO = 'sugoi:bau-aberto'

const DURACAO_MS = 1700

export function useAberturaDoBau() {
  const [animando, setAnimando] = useState(() => {
    if (typeof window === 'undefined') return false

    // Quem pediu menos movimento não recebe a cena; vai direto ao conteúdo.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

    try {
      return sessionStorage.getItem(CHAVE_SESSAO) !== '1'
    } catch {
      // Aba anônima ou storage bloqueado: mostra a animação, sem memória.
      return true
    }
  })

  useEffect(() => {
    if (!animando) return

    try {
      sessionStorage.setItem(CHAVE_SESSAO, '1')
    } catch {
      // Sem storage a animação repete; é só cosmético.
    }

    const id = setTimeout(() => setAnimando(false), DURACAO_MS)

    return () => clearTimeout(id)
  }, [animando])

  return animando
}

export function AberturaDoBau() {
  return (
    <div
      aria-hidden="true"
      className="bau-cena pointer-events-none fixed inset-0 z-50 grid place-items-center bg-abissal/92 backdrop-blur-sm"
    >
      <div className="bau-conjunto relative">
        {/* Raios de luz saindo de dentro do baú. */}
        <span className="bau-raios absolute top-[38%] left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full" />

        <svg viewBox="0 0 200 150" className="relative w-56 sm:w-72" role="img" aria-label="Baú abrindo">
          <defs>
            <linearGradient id="bau-madeira" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8a5a2e" />
              <stop offset="55%" stopColor="#6b431f" />
              <stop offset="100%" stopColor="#4a2d13" />
            </linearGradient>
            <linearGradient id="bau-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0d68e" />
              <stop offset="50%" stopColor="#c9a227" />
              <stop offset="100%" stopColor="#8a7434" />
            </linearGradient>
            <radialGradient id="bau-interior">
              <stop offset="0%" stopColor="#fff6d8" />
              <stop offset="60%" stopColor="#f0c34a" />
              <stop offset="100%" stopColor="#8a5f1c" />
            </radialGradient>
          </defs>

          {/* Interior iluminado, revelado conforme a tampa sobe. */}
          <rect x="34" y="62" width="132" height="34" rx="3" fill="url(#bau-interior)" />

          {/* Corpo do baú */}
          <rect x="30" y="74" width="140" height="56" rx="5" fill="url(#bau-madeira)" stroke="#33200d" strokeWidth="2.5" />
          <rect x="30" y="74" width="140" height="56" rx="5" fill="none" stroke="#a8743c" strokeWidth="1" opacity="0.5" />

          {/* Cintas de metal do corpo */}
          <rect x="52" y="74" width="9" height="56" fill="url(#bau-metal)" opacity="0.9" />
          <rect x="139" y="74" width="9" height="56" fill="url(#bau-metal)" opacity="0.9" />
          <rect x="30" y="118" width="140" height="8" fill="url(#bau-metal)" opacity="0.85" />

          {/* Fechadura */}
          <rect x="92" y="86" width="16" height="18" rx="2.5" fill="url(#bau-metal)" stroke="#5c4a15" strokeWidth="1" />
          <circle cx="100" cy="93" r="2.6" fill="#33200d" />

          {/* Tampa: gira na dobradiça traseira, no canto superior esquerdo do arco. */}
          <g className="bau-tampa" style={{ transformOrigin: '34px 72px' }}>
            <path
              d="M30 72 A70 44 0 0 1 170 72 Z"
              fill="url(#bau-madeira)"
              stroke="#33200d"
              strokeWidth="2.5"
            />
            <path d="M52 52.5 A70 44 0 0 0 52 72 L61 72 A70 44 0 0 1 61 51 Z" fill="url(#bau-metal)" opacity="0.9" />
            <path d="M139 51 A70 44 0 0 1 139 72 L148 72 A70 44 0 0 0 148 52.5 Z" fill="url(#bau-metal)" opacity="0.9" />
            <path d="M30 72 A70 44 0 0 1 170 72 Z" fill="none" stroke="#a8743c" strokeWidth="1" opacity="0.45" />
          </g>

          {/* Faíscas subindo do interior */}
          <g className="bau-faiscas" fill="#ffeaa8">
            <circle cx="72" cy="66" r="2" />
            <circle cx="100" cy="60" r="2.6" />
            <circle cx="128" cy="66" r="2" />
            <circle cx="86" cy="70" r="1.5" />
            <circle cx="114" cy="70" r="1.5" />
          </g>
        </svg>

        <p className="bau-texto titulo-serif mt-6 text-center tracking-[0.3em] text-ouro-claro/80 uppercase">
          Abrindo o porão
        </p>
      </div>
    </div>
  )
}
