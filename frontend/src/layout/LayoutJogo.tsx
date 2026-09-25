import { NavLink, Outlet } from 'react-router-dom'
import { useSessao } from '../auth/SessaoContext'
import { Losango } from '../componentes/ui/ornamentos'
import type { ReactNode } from 'react'
import { ARTE } from '../componentes/ui/jogo'
import { IconeBerries, IconeDobroes, IconeOuro } from '../componentes/ui/moedas'

const DESTINOS = [
  { para: '/status', rotulo: 'Status', icone: 'Visao_geral' },
  { para: '/inventario', rotulo: 'Porão', icone: 'Bau' },
  { para: '/tripulacoes', rotulo: 'Tripulações', icone: 'selTrip' },
  { para: '/navegacao', rotulo: 'Oceano', icone: 'Oceano' },
] as const

/** Contador de recurso: ícone vetorial, valor tabular e o nome só para leitores de tela. */
function Recurso({ icone, rotulo, valor }: { icone: ReactNode; rotulo: string; valor: number }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-painel-borda/30 bg-abissal/45 py-1 pr-3.5 pl-1.5"
      title={rotulo}
    >
      {icone}
      <span className="numero-ficha text-sm text-creme/90">{valor.toLocaleString('pt-BR')}</span>
      <span className="sr-only">{rotulo}</span>
    </div>
  )
}

/**
 * Casco da aplicação: trilha vertical de ícones à esquerda e faixa de recursos
 * no topo — a disposição das UIs de jogo, em vez da navbar horizontal de site.
 */
export function LayoutJogo() {
  const { sessao, sair } = useSessao()

  if (!sessao) {
    return null
  }

  const { conta, tripulacaoAtiva } = sessao
  const faccaoCor = tripulacaoAtiva?.faccao === 'Pirata' ? 'text-pirata' : 'text-marinha'

  return (
    <div className="flex min-h-dvh">
      {/* Trilha de navegação */}
      <nav
        aria-label="Navegação principal"
        className="sticky top-0 flex h-dvh w-[78px] shrink-0 flex-col items-center gap-2 border-r border-painel-borda/30 bg-painel/70 py-5 backdrop-blur-md"
      >
        <Losango className="mb-3 text-ouro" tamanho={10} />

        {DESTINOS.map((destino) => (
          <NavLink
            key={destino.para}
            to={destino.para}
            className={({ isActive }) =>
              `group relative flex w-[62px] flex-col items-center gap-1 rounded-sm border py-2.5 transition-all ${
                isActive
                  ? 'border-ouro/70 bg-painel-claro/80 shadow-[0_0_18px_-7px_var(--color-ouro)]'
                  : 'border-transparent hover:border-ouro/35 hover:bg-painel-claro/40'
              }`
            }
          >
            <img
              src={`${ARTE}/Icones/${destino.icone}.png`}
              alt=""
              aria-hidden="true"
              className="size-7 opacity-90"
            />
            <span className="text-[0.62rem] tracking-wide text-creme/70">{destino.rotulo}</span>
          </NavLink>
        ))}

        <button
          onClick={() => void sair()}
          className="mt-auto flex w-[62px] flex-col items-center gap-1 rounded-sm border border-transparent py-2.5 text-creme/60 transition-colors hover:border-pirata/50 hover:text-pirata"
        >
          <img src={`${ARTE}/Icones/Logout.png`} alt="" aria-hidden="true" className="size-6 opacity-80" />
          <span className="text-[0.62rem]">Sair</span>
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Faixa de recursos */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-painel-borda/30 bg-painel/55 px-6 py-3 backdrop-blur-md">
          <div className="min-w-0">
            <h1 className="titulo-serif truncate text-lg text-ouro-claro">
              {tripulacaoAtiva?.nome ?? conta.nome}
            </h1>
            {tripulacaoAtiva && (
              <p className={`text-[0.7rem] tracking-[0.18em] uppercase ${faccaoCor}`}>
                {tripulacaoAtiva.faccao}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {tripulacaoAtiva && (
              <Recurso
                icone={<IconeBerries tamanho={22} />}
                rotulo="Berries"
                valor={tripulacaoAtiva.berries}
              />
            )}
            <Recurso icone={<IconeOuro tamanho={22} />} rotulo="Ouro" valor={conta.gold} />
            <Recurso icone={<IconeDobroes tamanho={22} />} rotulo="Dobrões" valor={conta.dobroes} />
          </div>
        </header>

        {!conta.ativada && (
          <p
            role="status"
            className="border-b border-ouro/25 bg-ouro/10 px-6 py-2 text-center text-xs tracking-wide text-ouro-claro"
          >
            Conta não ativada — confira o código enviado por e-mail.
          </p>
        )}

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
