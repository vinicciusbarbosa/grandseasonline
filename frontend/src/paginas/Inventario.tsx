import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipamentosApi, inventarioApi, personagensApi } from '../api/endpoints'
import { ErroApi } from '../api/client'
import type { ItemInventario, SlotEquipamento, TipoItem } from '../api/tipos'
import { Cantoneiras, Losango } from '../componentes/ui/ornamentos'
import { Aviso, Carregando } from '../componentes/ui/controles'
import {
  Estrelas,
  MolduraItem,
  Retrato,
  corDaRaridade,
  estrelasDaCategoria,
  retratoDoPersonagem,
} from '../componentes/ui/jogo'
import {
  IconeConsumivel,
  IconeEquipamento,
  IconeMaterial,
  IconeNavio,
  IconeOutros,
  IconeTudo,
} from '../componentes/ui/iconesCategoria'
import { AberturaDoBau, useAberturaDoBau } from '../componentes/ui/AberturaDoBau'

const chaveInventario = ['inventario'] as const

/** Abas do porão. Cada uma junta os tipos que o jogador pensa como uma coisa só. */
const CATEGORIAS: { id: string; rotulo: string; icone: ReactNode; tipos: TipoItem[] | null }[] = [
  { id: 'tudo', rotulo: 'Tudo', icone: <IconeTudo />, tipos: null },
  { id: 'equipamento', rotulo: 'Equipamentos', icone: <IconeEquipamento />, tipos: ['Equipamento', 'Acessorio'] },
  { id: 'material', rotulo: 'Materiais', icone: <IconeMaterial />, tipos: ['Reagente'] },
  {
    id: 'consumivel',
    rotulo: 'Consumíveis',
    icone: <IconeConsumivel />,
    tipos: ['Comida', 'Remedio', 'IscaNormal', 'IscaDourada', 'BalaDeCanhao'],
  },
  { id: 'navio', rotulo: 'Navio', icone: <IconeNavio />, tipos: ['Casco', 'Leme', 'Velas', 'Canhao'] },
  { id: 'outros', rotulo: 'Outros', icone: <IconeOutros />, tipos: ['Mapa', 'Pose', 'Missao', 'Akuma'] },
]

/** Uma arma de uma mão pode ir para qualquer das mãos: o jogador escolhe. */
function destinosDe(slot: SlotEquipamento | undefined): SlotEquipamento[] {
  return slot === 'UmaMao' ? ['PrimeiraMao', 'SegundaMao'] : []
}

/**
 * Ação do rodapé do detalhe: larga, baixa e de canto arredondado, no formato das
 * duplas "Retirar / Reforçar" das telas de item.
 */
function AcaoDoItem({
  children,
  onClick,
  carregando = false,
  tom = 'neutro',
}: {
  children: ReactNode
  onClick: () => void
  carregando?: boolean
  tom?: 'neutro' | 'destaque' | 'perigo'
}) {
  const estilo = {
    neutro: 'bg-painel-claro/90 text-creme border-painel-borda/50 hover:border-ouro/60',
    destaque: 'bg-gradient-to-b from-pergaminho to-pergaminho-sombra text-tinta border-ouro/70 hover:from-white',
    perigo: 'bg-pirata/85 text-white border-pirata hover:bg-pirata',
  }[tom]

  return (
    <button
      onClick={onClick}
      disabled={carregando}
      className={`h-11 flex-1 rounded-full border text-sm font-medium tracking-wide whitespace-nowrap transition-all
        focus-visible:ring-2 focus-visible:ring-ouro focus-visible:outline-none disabled:opacity-45 ${estilo}`}
    >
      {carregando ? '…' : children}
    </button>
  )
}

export function Inventario() {
  const queryClient = useQueryClient()
  const abrindoBau = useAberturaDoBau()

  const [categoria, setCategoria] = useState('tudo')
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)
  const [alvoCod, setAlvoCod] = useState<number | null>(null)

  const { data: inventario, isPending, error } = useQuery({
    queryKey: chaveInventario,
    queryFn: inventarioApi.obter,
  })

  const { data: personagens } = useQuery({
    queryKey: ['personagens'],
    queryFn: personagensApi.listar,
  })

  const aoMudarInventario = () => {
    void queryClient.invalidateQueries({ queryKey: chaveInventario })
    void queryClient.invalidateQueries({ queryKey: ['personagens'] })
    void queryClient.invalidateQueries({ queryKey: ['equipamentos'] })
  }

  const equipar = useMutation({
    mutationFn: ({ cod, item, destino }: { cod: number; item: ItemInventario; destino?: SlotEquipamento }) =>
      equipamentosApi.equipar(cod, item.codItem, destino),
    onSuccess: () => {
      setSelecionadoId(null)
      aoMudarInventario()
    },
  })

  const descartar = useMutation({
    mutationFn: (item: ItemInventario) => inventarioApi.descartar(item.id, item.quantidade),
    onSuccess: () => {
      setSelecionadoId(null)
      aoMudarInventario()
    },
  })

  const filtrados = useMemo(() => {
    if (!inventario) return []

    const tipos = CATEGORIAS.find((c) => c.id === categoria)?.tipos

    return tipos ? inventario.itens.filter((i) => tipos.includes(i.tipo)) : inventario.itens
  }, [inventario, categoria])

  if (isPending) {
    return <Carregando texto="Vasculhando o porão" />
  }

  if (error) {
    return (
      <div className="p-6">
        <Aviso>{error instanceof ErroApi ? error.message : 'Não foi possível abrir o inventário.'}</Aviso>
      </div>
    )
  }

  const selecionado = filtrados.find((i) => i.id === selecionadoId) ?? null
  const tripulantes = personagens ?? []
  const alvo = tripulantes.find((p) => p.cod === alvoCod) ?? tripulantes.find((p) => p.ehCapitao) ?? tripulantes[0]
  const destinos = destinosDe(selecionado?.equipamento?.slot)
  const erroAcao = equipar.error ?? descartar.error
  const estrelas = estrelasDaCategoria(selecionado?.equipamento?.categoria)
  const cor = corDaRaridade(estrelas)

  return (
    <>
      {abrindoBau && <AberturaDoBau />}

      <div className={`flex h-full flex-col gap-4 p-5 ${abrindoBau ? '' : 'porao-entra'}`}>
        {/* Abas em ícone, como a fileira de tipos no topo das telas de item. */}
        <nav aria-label="Categorias" className="flex items-center gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              aria-current={categoria === c.id}
              title={c.rotulo}
              className={`grid size-11 place-items-center rounded-full border transition-all ${
                categoria === c.id
                  ? 'border-ouro bg-pergaminho text-tinta shadow-[0_0_18px_-4px_var(--color-ouro)]'
                  : 'border-painel-borda/40 bg-painel/60 text-creme/60 hover:border-ouro/55 hover:text-creme'
              }`}
            >
              {c.icone}
              <span className="sr-only">{c.rotulo}</span>
            </button>
          ))}

          <span className="ml-auto flex items-center gap-2 rounded-full border border-painel-borda/35 bg-painel/60 px-4 py-2">
            <Losango tamanho={6} className="text-ouro" />
            <span className="numero-ficha text-sm text-creme/85">
              {inventario.ocupado}
              <span className="text-creme/35"> / {inventario.capacidade}</span>
            </span>
          </span>
        </nav>

        {!inventario.temNavio && (
          <Aviso tom="info">Sua tripulação ainda não tem navio, então não há porão para guardar nada.</Aviso>
        )}

        {/* Grade · tripulante · detalhe — a divisão em três das telas de inventário. */}
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px_340px]">
          {/* Grade de itens */}
          <div className="relative min-h-0 overflow-y-auto border border-painel-borda/40 bg-painel/70 p-4 backdrop-blur-md">
            <Cantoneiras />

            {filtrados.length === 0 ? (
              <p className="py-16 text-center text-sm text-creme/35">Nada por aqui.</p>
            ) : (
              <div className="flex flex-wrap content-start gap-2">
                {filtrados.map((item) => (
                  <MolduraItem
                    key={item.id}
                    img={item.img}
                    formato={item.imgFormato}
                    estrelas={item.equipamento ? estrelasDaCategoria(item.equipamento.categoria) : 0}
                    upgrade={item.equipamento?.upgrade ?? 0}
                    quantidade={item.quantidade}
                    novo={item.novo}
                    rotulo={item.nome}
                    selecionado={item.id === selecionadoId}
                    onClick={() => setSelecionadoId(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Tripulante ao centro: quem vai receber a peça. */}
          <div className="hidden flex-col items-center justify-end gap-4 pb-6 xl:flex">
            {alvo && (
              <>
                <img
                  src={retratoDoPersonagem(alvo.img, alvo.skinCorpo, true)}
                  alt={alvo.nome}
                  className="max-h-[420px] object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />

                {tripulantes.length > 1 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {tripulantes.map((p) => (
                      <button
                        key={p.cod}
                        onClick={() => setAlvoCod(p.cod)}
                        aria-label={p.nome}
                        aria-pressed={p.cod === alvo.cod}
                        className={`rounded-full border-2 transition-all ${
                          p.cod === alvo.cod
                            ? 'border-ouro shadow-[0_0_14px_-3px_var(--color-ouro)]'
                            : 'border-transparent opacity-50 hover:opacity-100'
                        }`}
                      >
                        <Retrato img={p.img} skin={p.skinRosto} nome={p.nome} tamanho={40} />
                      </button>
                    ))}
                  </div>
                )}

                <p className="titulo-serif text-sm tracking-[0.2em] text-creme/60 uppercase">{alvo.nome}</p>
              </>
            )}
          </div>

          {/* Detalhe: sem moldura de painel, flutuando sobre o fundo. */}
          <aside className="flex min-h-0 flex-col">
            {!selecionado ? (
              <p className="mt-16 text-center text-sm text-creme/30">
                Escolha um item para ver o que ele faz.
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-1">
                <header className="flex items-start gap-3">
                  <MolduraItem
                    img={selecionado.img}
                    formato={selecionado.imgFormato}
                    estrelas={selecionado.equipamento ? estrelas : 0}
                    upgrade={selecionado.equipamento?.upgrade ?? 0}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="titulo-serif text-[1.15rem] leading-tight text-white">{selecionado.nome}</h2>
                    {selecionado.equipamento && (
                      <>
                        <p className="mt-1 text-[0.75rem] text-creme/45">{selecionado.equipamento.slotNome}</p>
                        <span className="mt-1.5 flex">
                          <Estrelas quantidade={estrelas} tamanho={13} />
                        </span>
                      </>
                    )}
                  </div>
                </header>

                {/* Atributo principal numa barra clara — o número que importa. */}
                {selecionado.equipamento?.bonusPrimario && (
                  <div
                    className="flex items-center justify-between rounded-sm px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                  >
                    <span className="text-[0.8rem] text-creme/75">
                      {selecionado.equipamento.bonusPrimario.nome}
                    </span>
                    <span className="numero-ficha text-xl text-white">
                      +
                      {selecionado.equipamento.bonusPrimario.valor.toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                {selecionado.equipamento && (
                  <ul className="flex flex-col gap-1 text-[0.82rem] text-creme/70">
                    {selecionado.equipamento.bonusSecundario && (
                      <li>
                        · {selecionado.equipamento.bonusSecundario.nome}+
                        {selecionado.equipamento.bonusSecundario.valor.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                        })}
                      </li>
                    )}
                    <li>· Nível exigido {selecionado.equipamento.lvl}</li>
                  </ul>
                )}

                {/* Condições de uso em verde, como os bônus de conjunto. */}
                {selecionado.equipamento && alvo && (
                  <div className="flex flex-col gap-1 text-[0.82rem]">
                    <span className="font-medium text-[#6ecf87]">Requisitos</span>
                    <span className={alvo.lvl >= selecionado.equipamento.lvl ? 'text-[#6ecf87]' : 'text-pirata'}>
                      {alvo.lvl >= selecionado.equipamento.lvl ? '✓' : '✕'} Nível {selecionado.equipamento.lvl}
                      <span className="text-creme/45"> — {alvo.nome} está no {alvo.lvl}</span>
                    </span>
                  </div>
                )}

                <p className="text-[0.82rem] leading-relaxed text-creme/40 italic">{selecionado.descricao}</p>

                {erroAcao instanceof ErroApi && <Aviso>{erroAcao.message}</Aviso>}

                <div className="mt-auto flex flex-col gap-3 pt-2">
                  {selecionado.equipamento && alvo && (
                    <span className="flex items-center gap-2 self-start rounded-full border border-painel-borda/40 bg-painel/70 py-1 pr-4 pl-1">
                      <Retrato img={alvo.img} skin={alvo.skinRosto} nome={alvo.nome} tamanho={26} />
                      <span className="text-xs text-creme/70">Equipar em {alvo.nome}</span>
                    </span>
                  )}

                  <div className="flex gap-2">
                    <AcaoDoItem tom="perigo" carregando={descartar.isPending} onClick={() => descartar.mutate(selecionado)}>
                      Descartar
                    </AcaoDoItem>

                    {selecionado.equipamento &&
                      alvo &&
                      (destinos.length > 0 ? (
                        destinos.map((destino) => (
                          <AcaoDoItem
                            key={destino}
                            tom="destaque"
                            carregando={equipar.isPending && equipar.variables?.destino === destino}
                            onClick={() => equipar.mutate({ cod: alvo.cod, item: selecionado, destino })}
                          >
                            {destino === 'PrimeiraMao' ? '1ª mão' : '2ª mão'}
                          </AcaoDoItem>
                        ))
                      ) : (
                        <AcaoDoItem
                          tom="destaque"
                          carregando={equipar.isPending}
                          onClick={() => equipar.mutate({ cod: alvo.cod, item: selecionado })}
                        >
                          Equipar
                        </AcaoDoItem>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Fio de raridade no topo da tela, tingindo a cena com o item escolhido. */}
      {selecionado && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-0.5 transition-colors"
          style={{ background: cor.borda }}
        />
      )}
    </>
  )
}
