/**
 * Ícones das três moedas do jogo, desenhados como SVG.
 *
 * Os PNGs do acervo legado têm 16px e cores apagadas — não aguentam a escala nem
 * o contraste da interface nova. Em vetor eles ficam nítidos em qualquer tamanho
 * e cada moeda ganha uma identidade de cor própria, que é como um jogo distingue
 * moeda comum de moeda premium à primeira vista.
 */

interface MoedaProps {
  tamanho?: number
  className?: string
}

/** Berries: a moeda corrente. Âmbar quente, com o símbolo ฿ gravado. */
export function IconeBerries({ tamanho = 20, className = '' }: MoedaProps) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sg-berries" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6d27a" />
          <stop offset="45%" stopColor="#e0a93c" />
          <stop offset="100%" stopColor="#a7701d" />
        </linearGradient>
      </defs>

      <circle cx="12" cy="12" r="10" fill="url(#sg-berries)" stroke="#7d5214" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#fbe6b0" strokeWidth="0.8" opacity="0.55" />

      {/* Reflexo no canto superior esquerdo, que dá volume à moeda. */}
      <ellipse cx="8.8" cy="8" rx="3.1" ry="2" fill="#fff3d0" opacity="0.4" transform="rotate(-30 8.8 8)" />

      {/* O "B" cortado por duas barras — a grafia do berry. */}
      <g fill="none" stroke="#5f3d0c" strokeWidth="1.5" strokeLinecap="round">
        <path d="M9.9 7.4v9.2" />
        <path d="M9.9 7.4h3.2a2.3 2.3 0 0 1 0 4.6H9.9" />
        <path d="M9.9 12h3.5a2.3 2.3 0 0 1 0 4.6H9.9" />
        <path d="M8.1 9.5h7.6M8.1 14.3h7.6" strokeWidth="1.1" />
      </g>
    </svg>
  )
}

/** Ouro: pilha de moedas claras. Recurso de conta, não de tripulação. */
export function IconeOuro({ tamanho = 20, className = '' }: MoedaProps) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sg-ouro-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff0b8" />
          <stop offset="50%" stopColor="#f0c34a" />
          <stop offset="100%" stopColor="#c08e1c" />
        </linearGradient>
        <linearGradient id="sg-ouro-lado" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9a62c" />
          <stop offset="100%" stopColor="#9a7113" />
        </linearGradient>
      </defs>

      {/* Duas moedas atrás dão a ideia de pilha sem poluir o desenho. */}
      <ellipse cx="12" cy="17.4" rx="8.4" ry="3.4" fill="url(#sg-ouro-lado)" stroke="#6f5110" strokeWidth="1" />
      <ellipse cx="12" cy="14.6" rx="8.4" ry="3.4" fill="url(#sg-ouro-lado)" stroke="#6f5110" strokeWidth="1" />
      <ellipse cx="12" cy="11.6" rx="8.4" ry="3.6" fill="url(#sg-ouro-face)" stroke="#6f5110" strokeWidth="1.1" />
      <ellipse cx="12" cy="11.6" rx="5.4" ry="2" fill="none" stroke="#fff6d2" strokeWidth="0.8" opacity="0.6" />

      {/* Cintilação: o toque que faz o metal parecer polido. */}
      <path d="M6.6 6.2 7.3 8l1.8.7-1.8.7-.7 1.8-.7-1.8L4.1 8.7l1.8-.7Z" fill="#fff4cf" opacity="0.85" />
    </svg>
  )
}

/** Dobrões: moeda premium. Gema facetada, para não se confundir com ouro. */
export function IconeDobroes({ tamanho = 20, className = '' }: MoedaProps) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sg-dobrao-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a9e4ff" />
          <stop offset="100%" stopColor="#4aa3d9" />
        </linearGradient>
        <linearGradient id="sg-dobrao-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5fb4e4" />
          <stop offset="100%" stopColor="#1f5f92" />
        </linearGradient>
      </defs>

      {/* Halo: sinaliza raridade sem precisar de rótulo. */}
      <circle cx="12" cy="12" r="10.5" fill="#57b4e6" opacity="0.16" />

      {/* Gema em losango, facetada em quatro planos. */}
      <path d="M12 2.2 20.4 12 12 21.8 3.6 12Z" fill="url(#sg-dobrao-b)" stroke="#123f63" strokeWidth="1.1" />
      <path d="M12 2.2 20.4 12H12Z" fill="url(#sg-dobrao-a)" opacity="0.95" />
      <path d="M12 2.2 3.6 12H12Z" fill="url(#sg-dobrao-a)" opacity="0.7" />
      <path d="M12 12h8.4L12 21.8Z" fill="#2c7cb3" opacity="0.8" />

      <path d="M12 2.2v19.6M3.6 12h16.8" stroke="#bfe9ff" strokeWidth="0.7" opacity="0.5" />
      <path d="M9.4 6.6 10.6 9l-1.2 2.4" fill="none" stroke="#eaf8ff" strokeWidth="0.9" opacity="0.75" strokeLinecap="round" />
    </svg>
  )
}
