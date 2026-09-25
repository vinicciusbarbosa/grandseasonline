import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { tripulacoesApi } from '../api/endpoints'
import { ErroApi } from '../api/client'
import { useSessao } from '../auth/SessaoContext'
import type { Faccao, TripulacaoResumo } from '../api/tipos'
import { Divisor, Losango, Painel } from '../componentes/ui/ornamentos'
import { Aviso, Botao, Campo } from '../componentes/ui/controles'
import { Retrato } from '../componentes/ui/jogo'

const OCEANOS = [
  { valor: 1, nome: 'East Blue' },
  { valor: 2, nome: 'West Blue' },
  { valor: 3, nome: 'North Blue' },
  { valor: 4, nome: 'South Blue' },
]

const MAX_TRIPULACOES = 3

/**
 * Linha de tripulação no formato das listas de seleção das referências: losango
 * marcando a escolha à esquerda, retrato, e borda dourada quando ativa.
 */
function LinhaTripulacao({
  tripulacao,
  ativa,
  carregando,
  onEscolher,
}: {
  tripulacao: TripulacaoResumo
  ativa: boolean
  carregando: boolean
  onEscolher: () => void
}) {
  const corFaccao = tripulacao.faccao === 'Pirata' ? 'text-pirata' : 'text-marinha'

  return (
    <button
      onClick={onEscolher}
      disabled={carregando}
      aria-pressed={ativa}
      style={{ borderRadius: 'var(--sg-raio)' }}
      className={`flex w-full items-center gap-4 border px-4 py-3 text-left transition-all disabled:opacity-60 ${
        ativa
          ? 'border-ouro bg-painel-claro/85 shadow-[0_0_22px_-8px_var(--color-ouro)]'
          : 'border-painel-borda/35 bg-painel/60 hover:border-ouro/55'
      }`}
    >
      <Losango tamanho={9} className={ativa ? 'text-ouro' : 'text-painel-borda'} />

      {tripulacao.capitao && (
        <Retrato
          img={tripulacao.capitao.img}
          nome={tripulacao.capitao.nome}
          tamanho={46}
        />
      )}

      <span className="min-w-0 flex-1">
        <span className="titulo-serif block truncate text-[1.05rem] text-creme">{tripulacao.nome}</span>
        <span className={`text-[0.7rem] tracking-[0.16em] uppercase ${corFaccao}`}>
          {tripulacao.faccao}
        </span>
        <span className="mt-0.5 block truncate text-xs text-creme/45">
          {tripulacao.capitao
            ? `Capitão ${tripulacao.capitao.nome} · nível ${tripulacao.capitao.lvl}`
            : 'Sem capitão'}
        </span>
      </span>

      <span className="numero-ficha shrink-0 text-sm text-creme/60">
        {tripulacao.berries.toLocaleString('pt-BR')}
      </span>
    </button>
  )
}

export function SelecionarTripulacao() {
  const { sessao, definirSessao } = useSessao()
  const navegar = useNavigate()

  const [nomeTripulacao, setNomeTripulacao] = useState('')
  const [nomeCapitao, setNomeCapitao] = useState('')
  const [faccao, setFaccao] = useState<Faccao>('Pirata')
  const [oceano, setOceano] = useState(1)

  const irParaOJogo = (novaSessao: Parameters<typeof definirSessao>[0]) => {
    definirSessao(novaSessao)
    navegar('/status', { replace: true })
  }

  const selecionar = useMutation({
    mutationFn: (id: number) => tripulacoesApi.selecionar(id),
    onSuccess: irParaOJogo,
  })

  const criar = useMutation({
    mutationFn: () =>
      tripulacoesApi.criar({
        nomeTripulacao,
        nomeCapitao,
        faccao,
        // O ícone do capitão ainda não tem seletor: a galeria de sprites é a
        // próxima fatia. Até lá, sorteamos um dos 369 disponíveis.
        iconeCapitao: Math.floor(Math.random() * 369) + 1,
        oceano,
      }),
    onSuccess: irParaOJogo,
  })

  const tripulacoes = sessao?.tripulacoes ?? []
  const noLimite = tripulacoes.length >= MAX_TRIPULACOES

  function aoCriar(evento: FormEvent) {
    evento.preventDefault()
    criar.mutate()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <Painel
        titulo="Suas tripulações"
        acao={
          <span className="numero-ficha text-sm text-creme/55">
            {tripulacoes.length}
            <span className="text-creme/30"> / {MAX_TRIPULACOES}</span>
          </span>
        }
      >
        {tripulacoes.length === 0 ? (
          <p className="py-8 text-center text-sm text-creme/45">
            Nenhuma tripulação ainda. Crie a primeira abaixo para zarpar.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tripulacoes.map((tripulacao) => (
              <LinhaTripulacao
                key={tripulacao.id}
                tripulacao={tripulacao}
                ativa={sessao?.tripulacaoAtiva?.id === tripulacao.id}
                carregando={selecionar.isPending && selecionar.variables === tripulacao.id}
                onEscolher={() => selecionar.mutate(tripulacao.id)}
              />
            ))}
          </div>
        )}

        {selecionar.error instanceof ErroApi && (
          <div className="mt-3">
            <Aviso>{selecionar.error.message}</Aviso>
          </div>
        )}
      </Painel>

      <Painel titulo="Nova tripulação">
        {noLimite ? (
          <Aviso tom="info">Você atingiu o limite de {MAX_TRIPULACOES} tripulações por conta.</Aviso>
        ) : (
          <form onSubmit={aoCriar} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo="Tripulação"
                value={nomeTripulacao}
                onChange={(e) => setNomeTripulacao(e.target.value)}
                dica="3 a 15 caracteres."
                maxLength={15}
                required
              />
              <Campo
                rotulo="Capitão"
                value={nomeCapitao}
                onChange={(e) => setNomeCapitao(e.target.value)}
                dica="Único no jogo inteiro."
                maxLength={15}
                required
              />
            </div>

            <fieldset>
              <legend className="mb-2.5 flex items-center gap-2 text-[0.8rem] tracking-[0.12em] text-ouro-claro/80 uppercase">
                <Losango tamanho={5} className="text-ouro/70" />
                Facção
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    // As classes são escritas por extenso porque o Tailwind lê o
                    // código-fonte: `border-${cor}` não geraria CSS nenhum.
                    { opcao: 'Pirata', ativa: 'border-pirata bg-pirata/20', marca: 'text-pirata' },
                    { opcao: 'Marinha', ativa: 'border-marinha bg-marinha/20', marca: 'text-marinha' },
                  ] as const
                ).map(({ opcao, ativa, marca }) => {
                  const marcada = faccao === opcao

                  return (
                    <label
                      key={opcao}
                      style={{ height: 'var(--sg-altura-botao)', borderRadius: 'var(--sg-raio)' }}
                      className={`flex cursor-pointer items-center justify-center gap-2.5 border transition-all ${
                        marcada
                          ? `${ativa} text-creme`
                          : 'border-painel-borda/40 bg-painel/50 text-creme/55 hover:border-ouro/45'
                      }`}
                    >
                      <input
                        type="radio"
                        name="faccao"
                        value={opcao}
                        checked={marcada}
                        onChange={() => setFaccao(opcao)}
                        className="sr-only"
                      />
                      <Losango tamanho={7} className={marcada ? marca : 'text-transparent'} />
                      <span className="titulo-serif tracking-wider">{opcao}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2.5 flex items-center gap-2 text-[0.8rem] tracking-[0.12em] text-ouro-claro/80 uppercase">
                <Losango tamanho={5} className="text-ouro/70" />
                Oceano inicial
              </legend>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {OCEANOS.map((o) => {
                  const marcado = oceano === o.valor

                  return (
                    <label
                      key={o.valor}
                      style={{ height: 'var(--sg-altura-botao-compacto)', borderRadius: 'var(--sg-raio)' }}
                      className={`flex cursor-pointer items-center justify-center border text-sm transition-all ${
                        marcado
                          ? 'border-ouro bg-painel-claro/80 text-ouro-claro'
                          : 'border-painel-borda/35 bg-painel/50 text-creme/55 hover:border-ouro/45'
                      }`}
                    >
                      <input
                        type="radio"
                        name="oceano"
                        value={o.valor}
                        checked={marcado}
                        onChange={() => setOceano(o.valor)}
                        className="sr-only"
                      />
                      {o.nome}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {criar.error instanceof ErroApi && <Aviso>{criar.error.message}</Aviso>}

            <Divisor />

            <Botao type="submit" carregando={criar.isPending} className="self-end px-10">
              Zarpar
            </Botao>
          </form>
        )}
      </Painel>
    </div>
  )
}
