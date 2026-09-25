import { useId } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Losango } from './ornamentos'

type VarianteBotao = 'primario' | 'secundario' | 'perigo'

const estilos: Record<VarianteBotao, string> = {
  // Claro sobre escuro, como as ações principais das referências: o botão é a
  // única coisa luminosa da tela, então não precisa de cor para chamar atenção.
  primario:
    'bg-gradient-to-b from-pergaminho to-pergaminho-sombra text-tinta border-ouro/70 ' +
    'hover:from-white hover:to-pergaminho shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
  secundario:
    'bg-painel-claro/60 text-creme border-ouro/40 hover:border-ouro/80 hover:bg-painel-claro/90',
  perigo:
    'bg-gradient-to-b from-pirata to-[#8d2b28] text-white border-pirata/80 hover:from-[#c44540]',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  carregando?: boolean
  compacto?: boolean
}

export function Botao({
  variante = 'primario',
  carregando = false,
  compacto = false,
  disabled,
  children,
  className = '',
  ...resto
}: BotaoProps) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando}
      style={{
        height: compacto ? 'var(--sg-altura-botao-compacto)' : 'var(--sg-altura-botao)',
        borderRadius: 'var(--sg-raio)',
      }}
      className={`inline-flex items-center justify-center gap-2 border px-6 text-[0.95rem] font-medium tracking-wide whitespace-nowrap transition-all
        focus-visible:ring-2 focus-visible:ring-ouro focus-visible:outline-none
        disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50
        ${estilos[variante]} ${className}`}
    >
      {carregando && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

/**
 * Ação de diálogo: rótulo precedido de um medalhão circular, como as opções
 * Confirmar/Cancelar das referências. Não é um retângulo preenchido.
 */
export function BotaoDialogo({
  glifo,
  tom = 'neutro',
  children,
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { glifo: string; tom?: 'neutro' | 'perigo' }) {
  const cor = tom === 'perigo' ? 'text-pirata border-pirata/70' : 'text-ouro-claro border-ouro/70'

  return (
    <button
      {...resto}
      className={`group inline-flex items-center gap-2.5 px-2 py-1.5 text-[0.95rem] transition-opacity
        hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ouro focus-visible:outline-none
        disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-7 place-items-center rounded-full border text-xs font-bold ${cor}`}
      >
        {glifo}
      </span>
      <span className="text-creme">{children}</span>
    </button>
  )
}

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  dica?: string
}

export function Campo({ rotulo, dica, className = '', ...resto }: CampoProps) {
  const id = useId()
  const idDica = `${id}-dica`

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-[0.8rem] tracking-[0.12em] text-ouro-claro/80 uppercase"
      >
        <Losango tamanho={5} className="text-ouro/70" />
        {rotulo}
      </label>
      <input
        {...resto}
        id={id}
        aria-describedby={dica ? idDica : undefined}
        style={{ height: 'var(--sg-altura-botao)', borderRadius: 'var(--sg-raio)' }}
        className={`border border-painel-borda/50 bg-abissal/60 px-4 text-creme
          placeholder:text-creme/25 focus:border-ouro focus:outline-none ${className}`}
      />
      {dica && (
        <p id={idDica} className="text-xs text-creme/45">
          {dica}
        </p>
      )}
    </div>
  )
}

/**
 * Linha em pílula: a forma das listas nas referências — bem mais alta que uma
 * linha de tabela web, totalmente arredondada, em pergaminho, com o valor num
 * chip à direita.
 */
export function LinhaPilula({
  children,
  valor,
  onClick,
  selecionada = false,
  className = '',
}: {
  children: ReactNode
  valor?: ReactNode
  onClick?: () => void
  selecionada?: boolean
  className?: string
}) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      style={{ height: 'var(--sg-altura-pilula)', borderRadius: 'var(--sg-raio-pilula)' }}
      className={`pilula-brilho flex w-full items-center gap-3 border px-5 text-left text-tinta transition-all
        ${selecionada ? 'border-ouro shadow-[0_0_0_1px_var(--color-ouro),0_0_18px_-4px_var(--color-ouro)]' : 'border-transparent'}
        ${onClick ? 'hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ouro focus-visible:outline-none' : ''}
        ${className}`}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{children}</span>
      {valor !== undefined && (
        <span className="grid min-w-[3.5rem] place-items-center rounded-sm border border-tinta/25 bg-white/45 px-3 py-1 text-sm font-semibold">
          {valor}
        </span>
      )}
    </Tag>
  )
}

/**
 * Ladrilho quadrado do menu: ícone grande sobre rótulo pequeno. Selecionado
 * ganha borda dourada e brilho, nunca preenchimento sólido.
 */
export function Ladrilho({
  icone,
  rotulo,
  selecionado = false,
  onClick,
  badge,
}: {
  icone: ReactNode
  rotulo: string
  selecionado?: boolean
  onClick?: () => void
  badge?: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selecionado}
      style={{ width: 'var(--sg-ladrilho)', height: 'var(--sg-ladrilho)', borderRadius: 'var(--sg-raio)' }}
      className={`relative flex flex-col items-center justify-center gap-2 border transition-all
        focus-visible:ring-2 focus-visible:ring-ouro focus-visible:outline-none
        ${
          selecionado
            ? 'border-ouro bg-painel-claro/90 shadow-[0_0_20px_-6px_var(--color-ouro)]'
            : 'border-painel-borda/35 bg-painel/70 hover:border-ouro/60'
        }`}
    >
      <span className="grid h-10 place-items-center">{icone}</span>
      <span className="text-[0.72rem] tracking-wide text-creme/85">{rotulo}</span>
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-pirata px-1.5 text-[0.65rem] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

/**
 * Botão de ajuda: um "?" discreto que revela a explicação ao passar o mouse ou
 * receber foco pelo teclado.
 *
 * É um popover próprio em vez do atributo `title` nativo — o do navegador demora
 * quase um segundo para aparecer, não é estilizável e destoa do resto.
 */
export function Dica({ texto, rotulo }: { texto: string; rotulo: string }) {
  const id = useId()

  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`O que faz ${rotulo}`}
        aria-describedby={id}
        className="grid size-5 place-items-center rounded-full border border-ouro/45 text-[0.7rem] font-bold text-ouro/70
          transition-colors hover:border-ouro hover:text-ouro-claro
          focus-visible:ring-2 focus-visible:ring-ouro focus-visible:outline-none"
      >
        ?
      </button>

      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-20 mt-2 w-64 origin-top-left scale-95 border border-ouro/45
          bg-abissal/95 p-3 text-xs leading-relaxed text-creme/85 opacity-0 shadow-lg shadow-black/60 backdrop-blur-sm
          transition-all duration-150 group-hover:scale-100 group-hover:opacity-100
          group-focus-within:scale-100 group-focus-within:opacity-100"
        style={{ borderRadius: 'var(--sg-raio)' }}
      >
        {texto}
      </span>
    </span>
  )
}

export function Aviso({ children, tom = 'erro' }: { children: ReactNode; tom?: 'erro' | 'info' }) {
  const estilo =
    tom === 'erro'
      ? 'border-pirata/60 bg-pirata/15 text-[#f0a9a6]'
      : 'border-ouro/40 bg-ouro/10 text-ouro-claro'

  return (
    <p
      role={tom === 'erro' ? 'alert' : 'status'}
      style={{ borderRadius: 'var(--sg-raio)' }}
      className={`flex items-start gap-2.5 border px-4 py-3 text-sm ${estilo}`}
    >
      <Losango tamanho={6} className="mt-1.5" />
      <span>{children}</span>
    </p>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-creme/55">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-ouro/70 border-t-transparent"
      />
      <span className="titulo-serif tracking-widest">{texto}</span>
    </div>
  )
}
