/**
 * Glifos das abas do porão. São desenhos próprios, em linha, no espírito dos
 * ícones de categoria das UIs de jogo — o acervo legado não tem um conjunto
 * coerente para isso.
 */
const comum = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden="true" {...comum}>
      {children}
    </svg>
  )
}

/** Tudo: quatro quadrantes. */
export const IconeTudo = () => (
  <Base>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  </Base>
)

/** Equipamentos: espada. */
export const IconeEquipamento = () => (
  <Base>
    <path d="M18.5 3.5 9 13l2 2 9.5-9.5V3.5Z" />
    <path d="m8.2 13.8-2.4 2.4 2 2 2.4-2.4" />
    <path d="m5 19 1.6 1.6" />
  </Base>
)

/** Materiais: gema lapidada. */
export const IconeMaterial = () => (
  <Base>
    <path d="M7 4h10l4 6-9 10-9-10Z" />
    <path d="M3 10h18M9.5 10 12 4M14.5 10 12 4M12 20l2.5-10M12 20 9.5 10" />
  </Base>
)

/** Consumíveis: frasco. */
export const IconeConsumivel = () => (
  <Base>
    <path d="M10 3h4M11 3v6.2L6.4 17A2.6 2.6 0 0 0 8.7 21h6.6a2.6 2.6 0 0 0 2.3-4L13 9.2V3" />
    <path d="M8.2 15h7.6" />
  </Base>
)

/** Navio: âncora. */
export const IconeNavio = () => (
  <Base>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2V21M7.5 10.5h9" />
    <path d="M4 14.5a8 8 0 0 0 16 0" />
  </Base>
)

/** Outros: pergaminho. */
export const IconeOutros = () => (
  <Base>
    <path d="M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6" />
    <path d="M4 6a2 2 0 0 1 2-2M9 8h7M9 12h7M9 16h4" />
  </Base>
)
