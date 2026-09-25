import type { ReactNode } from 'react'

/**
 * Cantoneira em L com losango na dobra — o ornamento que marca as quinas de
 * todo painel nas UIs de jogo. Quatro cópias rotacionadas formam a moldura.
 */
function Cantoneira({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden="true"
      className={`pointer-events-none absolute size-6 text-ouro ${className}`}
    >
      <path d="M3 14V6a3 3 0 0 1 3-3h8" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M7.5 18.5v-9a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.45" />
      <path d="M6 1.5 9.5 5 6 8.5 2.5 5Z" fill="currentColor" />
    </svg>
  )
}

/** As quatro cantoneiras de um painel. Absolutas: o pai precisa ser relative. */
export function Cantoneiras() {
  return (
    <>
      <Cantoneira className="-top-px -left-px" />
      <Cantoneira className="-top-px -right-px rotate-90" />
      <Cantoneira className="-right-px -bottom-px rotate-180" />
      <Cantoneira className="-bottom-px -left-px -rotate-90" />
    </>
  )
}

/** O losango do motivo. Usado como marcador de lista, separador e marca de seleção. */
export function Losango({ className = '', tamanho = 7 }: { className?: string; tamanho?: number }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{ width: tamanho, height: tamanho }}
      className={`shrink-0 ${className}`}
    >
      <path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Divisória fina com losangos nas pontas. Nas referências ela aparece logo
 * abaixo do título de cada painel e entre o corpo e as ações.
 */
export function Divisor({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-2 text-ouro/60 ${className}`}>
      <Losango tamanho={6} />
      <span className="h-px flex-1 bg-gradient-to-r from-ouro/50 via-ouro/25 to-transparent" />
      <span className="h-px flex-1 bg-gradient-to-l from-ouro/50 via-ouro/25 to-transparent" />
      <Losango tamanho={6} />
    </div>
  )
}

type Superficie = 'escura' | 'pergaminho'

interface PainelProps {
  titulo?: string
  acao?: ReactNode
  superficie?: Superficie
  children: ReactNode
  className?: string
}

/**
 * Painel ornamentado: a unidade de composição de toda a interface.
 *
 * São só duas superfícies em todo o jogo — escura translúcida sobre a carta
 * náutica, e pergaminho para conteúdo denso de leitura.
 */
export function Painel({
  titulo,
  acao,
  superficie = 'escura',
  children,
  className = '',
}: PainelProps) {
  const escura = superficie === 'escura'

  return (
    <section
      className={`relative border p-6 ${
        escura
          ? 'border-painel-borda/45 bg-painel/85 text-creme backdrop-blur-md'
          : 'border-ouro-fosco/50 bg-pergaminho text-tinta'
      } ${className}`}
      style={{ borderRadius: 'var(--sg-raio)' }}
    >
      <Cantoneiras />

      {titulo && (
        <header className="mb-4">
          <div className="flex items-center justify-between gap-4">
            <h2
              className={`titulo-serif flex items-center gap-2.5 text-[1.35rem] ${
                escura ? 'text-ouro-claro' : 'text-tinta'
              }`}
            >
              <Losango className={escura ? 'text-ouro' : 'text-ouro-fosco'} />
              {titulo}
            </h2>
            {acao}
          </div>
          <Divisor className="mt-3" />
        </header>
      )}

      {children}
    </section>
  )
}
