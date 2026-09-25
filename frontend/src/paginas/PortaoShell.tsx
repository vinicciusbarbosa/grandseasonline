import type { ReactNode } from 'react'
import { Losango } from '../componentes/ui/ornamentos'

/**
 * Moldura das telas de entrada (login e cadastro).
 *
 * Segue a estrutura de tela-título de jogo: o cenário ocupa tudo, o título fica
 * centralizado em serifada com ornamentos laterais, e o formulário vem abaixo
 * num painel estreito — em vez do card centralizado de um site.
 */
export function PortaoShell({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string
  subtitulo: string
  children: ReactNode
  rodape: ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <header className="mb-9 text-center">
        <div className="flex items-center justify-center gap-4 text-ouro">
          <span className="h-px w-12 bg-gradient-to-l from-ouro to-transparent sm:w-20" />
          <Losango tamanho={9} />
          <h1 className="titulo-serif text-3xl text-ouro-claro sm:text-[2.6rem]">{titulo}</h1>
          <Losango tamanho={9} />
          <span className="h-px w-12 bg-gradient-to-r from-ouro to-transparent sm:w-20" />
        </div>
        <p className="mt-3 text-sm tracking-[0.2em] text-creme/45 uppercase">{subtitulo}</p>
      </header>

      <div className="w-full max-w-sm">{children}</div>

      <footer className="mt-8 text-sm text-creme/50">{rodape}</footer>
    </main>
  )
}
