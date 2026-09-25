import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipamentosApi, personagensApi } from '../api/endpoints'
import { ErroApi } from '../api/client'
import type { AtributoFicha, PersonagemStatus, SlotEquipado } from '../api/tipos'
import { Losango } from '../componentes/ui/ornamentos'
import { Aviso, Botao, Carregando, Dica } from '../componentes/ui/controles'
import {
  Barra,
  Estrelas,
  MolduraItem,
  Retrato,
  estrelasDaCategoria,
  iconeDoAtributo,
  retratoDoPersonagem,
} from '../componentes/ui/jogo'

const chavePersonagens = ['personagens'] as const
const chaveEquipamentos = (cod: number) => ['equipamentos', cod] as const

type Secao = 'atributos' | 'equipamento' | 'haki' | 'profissao'

const SECOES: { id: Secao; rotulo: string }[] = [
  { id: 'atributos', rotulo: 'Atributos' },
  { id: 'equipamento', rotulo: 'Equipamento' },
  { id: 'haki', rotulo: 'Haki' },
  { id: 'profissao', rotulo: 'Profissão' },
]

/** Rótulos curtos para caber sob o slot. O nome inteiro fica no título acessível. */
const ROTULO_CURTO: Record<string, string> = {
  PrimeiraMao: '1ª mão',
  SegundaMao: '2ª mão',
}

function formatar(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/**
 * Linha de atributo: ícone e nome à esquerda, total à direita, com o detalhe do
 * cálculo (base + bônus) logo abaixo. É o formato de lista de status de jogo,
 * não uma tabela de site.
 */
function LinhaAtributo({
  atributo,
  podeInvestir,
  investindo,
  onInvestir,
}: {
  atributo: AtributoFicha
  podeInvestir: boolean
  investindo: boolean
  onInvestir: () => void
}) {
  const total = atributo.valor + atributo.bonus

  return (
    <div className="group flex items-center gap-3 border-b border-painel-borda/20 py-2.5 last:border-b-0">
      <img
        src={iconeDoAtributo(atributo.sigla)}
        alt=""
        aria-hidden="true"
        className="size-6 shrink-0 opacity-70"
      />

      <span className="min-w-0 flex-1 truncate text-[0.92rem] text-creme/85">{atributo.nome}</span>

      <span className="flex items-baseline gap-1.5">
        <span className="numero-ficha text-[1.05rem] text-white">{formatar(total)}</span>
        {atributo.bonus > 0 && (
          <span className="text-[0.72rem] text-[#6ecf87]">
            {atributo.valor}
            <span className="text-[#6ecf87]/70">+{formatar(atributo.bonus)}</span>
          </span>
        )}
      </span>

      {podeInvestir && (
        <button
          onClick={onInvestir}
          disabled={investindo}
          aria-label={`Investir 1 ponto em ${atributo.nome}`}
          className="grid size-7 shrink-0 place-items-center rounded-full border border-ouro/50 text-sm leading-none font-bold text-ouro-claro transition-colors hover:border-ouro hover:bg-ouro/15 disabled:opacity-40"
        >
          +
        </button>
      )}

      <Dica texto={atributo.descricao} rotulo={atributo.nome} />
    </div>
  )
}

function SlotDoCorpo({
  slot,
  removendo,
  onRemover,
}: {
  slot: SlotEquipado
  removendo: boolean
  onRemover: () => void
}) {
  const ocupado = slot.nome !== null
  const estrelas = slot.equipamento ? estrelasDaCategoria(slot.equipamento.categoria) : 0

  return (
    <div className="flex flex-col items-center gap-1.5">
      <MolduraItem
        img={ocupado ? slot.img : undefined}
        estrelas={estrelas}
        upgrade={slot.equipamento?.upgrade ?? 0}
        rotulo={ocupado ? `${slot.nome} — ${slot.slotNome}` : slot.slotNome}
        vazio={<Losango tamanho={10} />}
        onClick={ocupado && !slot.espelhaArmaDeDuasMaos ? onRemover : undefined}
        selecionado={removendo}
      />
      <span className="max-w-[80px] truncate text-center text-[0.62rem] text-creme/45">
        {ROTULO_CURTO[slot.slot] ?? slot.slotNome}
      </span>
    </div>
  )
}

function Ficha({ personagem }: { personagem: PersonagemStatus }) {
  const queryClient = useQueryClient()
  const [secao, setSecao] = useState<Secao>('atributos')

  const atualizarFicha = (atualizado: PersonagemStatus) => {
    queryClient.setQueryData<PersonagemStatus[]>(chavePersonagens, (lista) =>
      lista?.map((p) => (p.cod === atualizado.cod ? atualizado : p)),
    )
  }

  const { data: equipamentos } = useQuery({
    queryKey: chaveEquipamentos(personagem.cod),
    queryFn: () => equipamentosApi.obter(personagem.cod),
  })

  const investir = useMutation({
    mutationFn: (atributo: AtributoFicha) =>
      personagensApi.distribuirPontos(personagem.cod, atributo.atributo, 1),
    onSuccess: atualizarFicha,
  })

  const evoluir = useMutation({
    mutationFn: () => personagensApi.evoluir(personagem.cod),
    onSuccess: atualizarFicha,
  })

  const desequipar = useMutation({
    mutationFn: (slot: SlotEquipado) => equipamentosApi.desequipar(personagem.cod, slot.slot),
    onSuccess: (dados) => {
      queryClient.setQueryData(chaveEquipamentos(personagem.cod), dados)
      void queryClient.invalidateQueries({ queryKey: chavePersonagens })
      void queryClient.invalidateQueries({ queryKey: ['inventario'] })
    },
  })

  const erro = investir.error ?? evoluir.error ?? desequipar.error

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[190px_minmax(0,1fr)_360px]">
      {/* Menu de seções: losango marcando a ativa, como a coluna das telas de personagem. */}
      <nav aria-label="Seções da ficha" className="flex flex-col gap-1 pt-2">
        {SECOES.map((s) => {
          const ativa = secao === s.id

          return (
            <button
              key={s.id}
              onClick={() => setSecao(s.id)}
              aria-current={ativa}
              className={`flex items-center gap-2.5 px-2 py-2.5 text-left transition-all ${
                ativa ? 'text-ouro-claro' : 'text-creme/50 hover:text-creme/85'
              }`}
            >
              <Losango tamanho={ativa ? 9 : 6} className={ativa ? 'text-ouro' : 'text-creme/30'} />
              <span className={`titulo-serif tracking-wide ${ativa ? 'text-[1.05rem]' : 'text-[0.92rem]'}`}>
                {s.rotulo}
              </span>
            </button>
          )
        })}

        {personagem.pontosDisponiveis > 0 && (
          <span className="mt-3 ml-2 rounded-full border border-ouro/40 bg-ouro/10 px-3 py-1.5 text-center text-[0.7rem] text-ouro-claro">
            {personagem.pontosDisponiveis} ponto(s)
          </span>
        )}
      </nav>

      {/* Personagem ao centro, em corpo inteiro. */}
      <div className="flex min-h-0 flex-col items-center justify-end gap-3 pb-4">
        <img
          src={retratoDoPersonagem(personagem.img, personagem.skinCorpo, true)}
          alt={personagem.nome}
          className="max-h-[52vh] object-contain drop-shadow-[0_14px_32px_rgba(0,0,0,0.7)]"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />

        <div className="text-center">
          <h2 className="titulo-serif text-2xl text-ouro-claro">{personagem.nome}</h2>
          <p className="mt-0.5 text-[0.72rem] tracking-[0.2em] text-creme/45 uppercase">
            Nível {personagem.lvl}
            {personagem.ehCapitao && ' · Capitão'}
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2.5">
          <Barra rotulo="Vida" valor={personagem.hp} maximo={personagem.hpMax} cor="var(--color-vida)" />
          <Barra rotulo="Espírito" valor={personagem.mp} maximo={personagem.mpMax} cor="var(--color-espirito)" />
          <Barra rotulo="Experiência" valor={personagem.xp} maximo={personagem.xpMax} />
        </div>

        {personagem.podeEvoluir && (
          <Botao onClick={() => evoluir.mutate()} carregando={evoluir.isPending}>
            Evoluir ao nível {personagem.lvl + 1}
          </Botao>
        )}
      </div>

      {/* Painel da seção escolhida. */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {erro instanceof ErroApi && <Aviso>{erro.message}</Aviso>}

        {secao === 'atributos' && (
          <div className="flex flex-col">
            {personagem.atributos.map((atributo) => (
              <LinhaAtributo
                key={atributo.atributo}
                atributo={atributo}
                podeInvestir={personagem.pontosDisponiveis > 0}
                investindo={investir.isPending && investir.variables?.atributo === atributo.atributo}
                onInvestir={() => investir.mutate(atributo)}
              />
            ))}
            <p className="mt-3 text-[0.72rem] text-creme/35">
              O número grande é o total. Em verde, a base e o bônus de equipamento.
            </p>
          </div>
        )}

        {secao === 'equipamento' && (
          <div className="flex flex-col gap-4">
            {equipamentos ? (
              <>
                <div className="grid grid-cols-4 justify-items-center gap-3">
                  {equipamentos.slots.map((slot) => (
                    <SlotDoCorpo
                      key={slot.slot}
                      slot={slot}
                      removendo={desequipar.isPending && desequipar.variables?.slot === slot.slot}
                      onRemover={() => desequipar.mutate(slot)}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  {equipamentos.slots
                    .filter((s) => s.equipamento && !s.espelhaArmaDeDuasMaos)
                    .map((s) => (
                      <div
                        key={s.slot}
                        className="flex items-center gap-2 border-b border-painel-borda/20 pb-2 text-[0.82rem] last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-creme/80">{s.nome}</span>
                        <Estrelas quantidade={estrelasDaCategoria(s.equipamento!.categoria)} tamanho={9} />
                        {s.equipamento!.bonusPrimario && (
                          <span className="numero-ficha text-[#6ecf87]">
                            +{formatar(s.equipamento!.bonusPrimario.valor)} {s.equipamento!.bonusPrimario.sigla}
                          </span>
                        )}
                      </div>
                    ))}
                </div>

                <p className="text-[0.72rem] text-creme/35">Toque numa peça para guardá-la no porão.</p>
              </>
            ) : (
              <Carregando texto="Abrindo o baú" />
            )}
          </div>
        )}

        {secao === 'haki' && (
          <div className="flex flex-col gap-4">
            <Barra
              rotulo={`Nível ${personagem.haki.lvl}`}
              valor={personagem.haki.xp}
              maximo={personagem.haki.xpMax}
            />
            <dl className="flex flex-col">
              {(
                [
                  ['Esquiva', personagem.haki.esquiva],
                  ['Bloqueio', personagem.haki.bloqueio],
                  ['Crítico', personagem.haki.critico],
                  ['Haoshoku', personagem.haki.hdr],
                ] as const
              ).map(([rotulo, valor]) => (
                <div
                  key={rotulo}
                  className="flex items-center justify-between border-b border-painel-borda/20 py-2.5 last:border-b-0"
                >
                  <dt className="text-[0.92rem] text-creme/70">{rotulo}</dt>
                  <dd className="numero-ficha text-[1.05rem] text-white">{valor}</dd>
                </div>
              ))}
            </dl>
            {personagem.haki.pontosDisponiveis > 0 && (
              <p className="text-[0.75rem] text-ouro-claro">
                {personagem.haki.pontosDisponiveis} ponto(s) de Haki disponível(is).
              </p>
            )}
          </div>
        )}

        {secao === 'profissao' && (
          <div className="flex flex-col gap-3">
            {personagem.profissao.codigo === 0 ? (
              <p className="py-10 text-center text-sm text-creme/35">Nenhuma profissão aprendida.</p>
            ) : (
              <Barra
                rotulo={`Nível ${personagem.profissao.lvl}`}
                valor={personagem.profissao.xp}
                maximo={personagem.profissao.xpMax}
              />
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

export function Status() {
  const [codSelecionado, setCodSelecionado] = useState<number | null>(null)

  const { data: personagens, isPending, error } = useQuery({
    queryKey: chavePersonagens,
    queryFn: personagensApi.listar,
  })

  if (isPending) {
    return <Carregando texto="Reunindo a tripulação" />
  }

  if (error) {
    return (
      <div className="p-6">
        <Aviso>{error instanceof ErroApi ? error.message : 'Não foi possível carregar a ficha.'}</Aviso>
      </div>
    )
  }

  if (personagens.length === 0) {
    return (
      <div className="p-6">
        <Aviso tom="info">Esta tripulação ainda não tem personagens ativos.</Aviso>
      </div>
    )
  }

  const selecionado =
    personagens.find((p) => p.cod === codSelecionado) ?? personagens.find((p) => p.ehCapitao) ?? personagens[0]

  return (
    <div className="flex h-full min-h-0 gap-3 p-5">
      {/* Fita de tripulantes na borda, como a lista de personagens da party. */}
      {personagens.length > 1 && (
        <nav aria-label="Tripulantes" className="flex shrink-0 flex-col gap-2 pt-2">
          {personagens.map((p) => (
            <button
              key={p.cod}
              onClick={() => setCodSelecionado(p.cod)}
              aria-label={p.nome}
              aria-current={p.cod === selecionado.cod}
              className={`relative rounded-full border-2 transition-all ${
                p.cod === selecionado.cod
                  ? 'border-ouro shadow-[0_0_16px_-3px_var(--color-ouro)]'
                  : 'border-transparent opacity-45 hover:opacity-90'
              }`}
            >
              <Retrato img={p.img} skin={p.skinRosto} nome={p.nome} tamanho={44} />
              {p.pontosDisponiveis > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ouro shadow-[0_0_6px_var(--color-ouro)]" />
              )}
            </button>
          ))}
        </nav>
      )}

      <Ficha key={selecionado.cod} personagem={selecionado} />
    </div>
  )
}
