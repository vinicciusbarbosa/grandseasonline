import { useEffect, useRef, useState } from 'react'
import { Cantoneiras, Losango } from '../componentes/ui/ornamentos'
import {
  agir,
  alvosPossiveis,
  chanceBloqueio,
  chanceCritico,
  chanceEsquiva,
  daVez,
  decidirIA,
  disponivel,
  porId,
  type Batalha,
  type Combatente,
  type Evento,
  type Habilidade,
} from './sim/abordagem'

/**
 * Abordagem: a luta de tripulações por turnos, por cima do mar congelado.
 * As regras (e a fórmula de dano do legado) estão em sim/abordagem.ts; aqui
 * é a mesa: cartas dos marujos, vez de quem, golpes, alvos e o registro.
 */

const ESPERA_IA = 850

type Flutuante = { chave: number; para: string; texto: string; tipo: 'dano' | 'critico' | 'cura' | 'esquiva' | 'bloqueio' }

export function TelaAbordagem({ batalha, nomeInimigo, aoTerminar }: { batalha: Batalha; nomeInimigo: string; aoTerminar: () => void }) {
  // A batalha é um objeto mutável (é assim que o servidor vai tê-la); o React
  // só precisa saber que algo mudou.
  const [, setVersao] = useState(0)
  const [escolhida, setEscolhida] = useState<Habilidade | null>(null)
  const [flutuantes, setFlutuantes] = useState<Flutuante[]>([])
  const [agindo, setAgindo] = useState<string | null>(null)
  const lidos = useRef(batalha.eventos.length)
  const chave = useRef(0)

  const atual = batalha.fim ? null : daVez(batalha)
  const vezDeles = atual?.lado === 'eles'

  const executar = (habilidade: string, alvo: string | null) => {
    const quem = daVez(batalha)
    agir(batalha, habilidade, alvo)
    setAgindo(quem?.id ?? null)
    setEscolhida(null)

    const novos = batalha.eventos.slice(lidos.current)
    lidos.current = batalha.eventos.length
    const agora: Flutuante[] = []
    for (const e of novos) {
      if (e.tipo === 'dano') {
        const tipo = e.esquivou ? 'esquiva' : e.bloqueou ? 'bloqueio' : e.critico ? 'critico' : 'dano'
        const texto = e.esquivou ? 'Esquivou' : `${e.dano.toLocaleString('pt-BR')}${e.critico ? '!' : ''}`
        agora.push({ chave: chave.current++, para: e.para, texto, tipo })
      } else if (e.tipo === 'cura') {
        agora.push({ chave: chave.current++, para: e.para, texto: `+${e.cura.toLocaleString('pt-BR')}`, tipo: 'cura' })
      }
    }
    setFlutuantes((f) => [...f, ...agora])
    const chaves = new Set(agora.map((f) => f.chave))
    window.setTimeout(() => setFlutuantes((f) => f.filter((x) => !chaves.has(x.chave))), 1300)
    window.setTimeout(() => setAgindo(null), 350)
    setVersao((v) => v + 1)
  }

  // Vez do inimigo: pensa um instante e age.
  useEffect(() => {
    if (!vezDeles || batalha.fim) return
    const id = window.setTimeout(() => {
      const d = decidirIA(batalha)
      if (d) executar(d.habilidade, d.alvo)
    }, ESPERA_IA)
    return () => window.clearTimeout(id)
    // executar é recriada a cada render; a vez muda junto com a versão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id, batalha.rodada, batalha.fim])

  const escolher = (h: Habilidade) => {
    if (!atual || vezDeles || !disponivel(atual, h)) return
    if (h.alvo.startsWith('todos')) executar(h.cod, null)
    else setEscolhida(h)
  }

  const alvosValidos = new Set(atual && escolhida ? alvosPossiveis(batalha, atual, escolhida).map((c) => c.id) : [])
  const clicarCarta = (c: Combatente) => {
    if (escolhida && alvosValidos.has(c.id)) executar(escolhida.cod, c.id)
  }

  const nos = batalha.combatentes.filter((c) => c.lado === 'nos')
  const eles = batalha.combatentes.filter((c) => c.lado === 'eles')

  const carta = (c: Combatente) => (
    <Carta
      key={c.id}
      c={c}
      daVez={atual?.id === c.id}
      agindo={agindo === c.id}
      alvo={alvosValidos.has(c.id)}
      flutuantes={flutuantes.filter((f) => f.para === c.id)}
      aoClicar={() => clicarCarta(c)}
      mira={atual && atual.lado === 'nos' && c.lado === 'eles' ? atual : null}
    />
  )

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-abissal/70 p-4 backdrop-blur-[3px]">
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col gap-4 overflow-y-auto border border-painel-borda/50 bg-painel/92 p-5 text-creme shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        style={{ borderRadius: 'var(--sg-raio)' }}
      >
        <Cantoneiras />
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Losango className="text-ouro" />
            <h2 className="titulo-serif text-2xl text-ouro-claro">Abordagem!</h2>
            <span className="text-sm text-creme/60">contra {nomeInimigo}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-creme/70">
            <span>
              Rodada <span className="numero-ficha text-base text-creme">{batalha.rodada}</span>
            </span>
            <Vontade rotulo="Nossa vontade" valor={batalha.vontade.nos} cor="bg-ouro" />
            <Vontade rotulo="Deles" valor={batalha.vontade.eles} cor="bg-pirata" />
          </div>
        </header>

        <section>
          <p className="mb-2 text-xs tracking-wider text-creme/50 uppercase">Tripulação inimiga</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{eles.map(carta)}</div>
        </section>

        <section>
          <p className="mb-2 text-xs tracking-wider text-creme/50 uppercase">Nossa tripulação</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{nos.map(carta)}</div>
        </section>

        <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
          <section className="min-h-28 rounded-sm border border-painel-borda/40 bg-abissal/40 p-3">
            {batalha.fim ? (
              <Resultado fim={batalha.fim} aoTerminar={aoTerminar} />
            ) : atual && !vezDeles ? (
              <>
                <p className="mb-2 text-sm">
                  Vez de <span className="titulo-serif text-ouro-claro">{atual.nome}</span>
                  <span className="text-creme/55">
                    {' '}
                    — {escolhida ? `${escolhida.nome}: escolha o alvo (clique na carta).` : 'escolha um golpe.'}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {atual.habilidades.map((h) => {
                    const espera = atual.recargas[h.cod] ?? 0
                    const pronta = disponivel(atual, h)
                    return (
                      <button
                        key={h.cod}
                        onClick={() => escolher(h)}
                        disabled={!pronta}
                        title={h.descricao}
                        className={`min-w-36 rounded-sm border px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                          escolhida?.cod === h.cod
                            ? 'border-ouro bg-ouro/15 shadow-[0_0_14px_-5px_var(--color-ouro)]'
                            : 'border-painel-borda/50 hover:border-ouro/60'
                        }`}
                      >
                        <span className="block text-sm text-creme">{h.nome}</span>
                        <span className="text-[0.68rem] text-creme/55">
                          {h.cura ? 'Cura' : 'Dano'} ×{h.dano} · {ALVO[h.alvo]}
                          {!pronta && ` · espera ${espera}`}
                        </span>
                      </button>
                    )
                  })}
                  {escolhida && (
                    <button onClick={() => setEscolhida(null)} className="rounded-sm border border-painel-borda/40 px-3 py-2 text-xs text-creme/60 hover:border-creme/50">
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="animate-pulse text-sm text-creme/70">
                {atual ? `${atual.nome} está agindo…` : 'Preparando a próxima rodada…'}
              </p>
            )}
          </section>
          <Registro batalha={batalha} />
        </div>
      </div>
    </div>
  )
}

const ALVO: Record<Habilidade['alvo'], string> = {
  inimigo: '1 inimigo',
  'todos-inimigos': 'todos os inimigos',
  aliado: '1 aliado',
  'todos-aliados': 'todos os aliados',
}

function Vontade({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <span className="flex items-center gap-1.5" title="A vontade cresce a cada rodada e aumenta o dano de todos os golpes.">
      {rotulo}
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-abissal/70">
        <span className={`block h-full ${cor}`} style={{ width: `${(valor / 40) * 100}%` }} />
      </span>
      <span className="numero-ficha text-creme">{valor}</span>
    </span>
  )
}

const COR_FLUTUANTE: Record<Flutuante['tipo'], string> = {
  dano: 'text-creme',
  critico: 'text-ouro-claro text-2xl',
  cura: 'text-emerald-300',
  esquiva: 'text-sky-300 italic',
  bloqueio: 'text-slate-300',
}

function Carta({
  c,
  daVez,
  agindo,
  alvo,
  flutuantes,
  aoClicar,
  mira,
}: {
  c: Combatente
  daVez: boolean
  agindo: boolean
  alvo: boolean
  flutuantes: Flutuante[]
  aoClicar: () => void
  mira: Combatente | null
}) {
  const caiu = c.hp <= 0
  const razao = c.hp / c.hpMax
  const ferido = flutuantes.some((f) => f.tipo === 'dano' || f.tipo === 'critico')
  return (
    <button
      onClick={aoClicar}
      disabled={!alvo}
      className={`relative rounded-sm border p-3 text-left transition-all duration-200 ${caiu ? 'opacity-35 grayscale' : ''} ${
        alvo ? 'cursor-crosshair border-pirata/80 hover:bg-pirata/15' : daVez ? 'border-ouro/90 shadow-[0_0_18px_-6px_var(--color-ouro)]' : 'border-painel-borda/40'
      } ${agindo ? (c.lado === 'nos' ? '-translate-y-1.5' : 'translate-y-1.5') : ''} ${ferido ? 'animate-[tremer_0.3s_ease-in-out]' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`titulo-serif text-sm ${c.lado === 'nos' ? 'text-ouro-claro' : 'text-[#e8a092]'}`}>{c.nome}</span>
        <span className="text-[0.65rem] text-creme/45">{c.fileira === 0 ? 'frente' : 'retaguarda'}</span>
      </div>
      <p className="text-[0.68rem] text-creme/55">{c.papel}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-abissal/80">
        <div
          className={`h-full transition-[width] duration-500 ${razao > 0.5 ? 'bg-vida' : razao > 0.25 ? 'bg-amber-600' : 'bg-red-700'}`}
          style={{ width: `${razao * 100}%` }}
        />
      </div>
      <p className="numero-ficha mt-1 text-[0.7rem] text-creme/70">
        {c.hp.toLocaleString('pt-BR')} / {c.hpMax.toLocaleString('pt-BR')}
      </p>
      {mira && !caiu && (
        <p className="mt-1 text-[0.62rem] text-creme/45" title="Chances do golpe de quem está na vez contra este alvo (fórmula do legado)">
          esq {chanceEsquiva(mira.atributos, c.atributos)}% · crít {chanceCritico(mira.atributos, c.atributos)}% · bloq{' '}
          {chanceBloqueio(mira.atributos, c.atributos)}%
        </p>
      )}
      {daVez && !caiu && <span className="absolute -top-2 right-2 rounded-sm bg-ouro px-1.5 text-[0.6rem] font-bold text-abissal">VEZ</span>}
      {flutuantes.map((f, i) => (
        <span
          key={f.chave}
          className={`numero-ficha pointer-events-none absolute left-1/2 animate-[subir_1.3s_ease-out_forwards] font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${COR_FLUTUANTE[f.tipo]}`}
          style={{ top: `${20 + i * 14}%` }}
        >
          {f.texto}
          {f.tipo === 'bloqueio' && <span className="ml-1 text-[0.6rem]">bloq.</span>}
        </span>
      ))}
    </button>
  )
}

function Registro({ batalha }: { batalha: Batalha }) {
  const linhas = batalha.eventos.slice(-9).reverse()
  const nome = (id: string) => porId(batalha, id).nome
  const texto = (e: Evento) => {
    switch (e.tipo) {
      case 'rodada':
        return <span className="text-ouro/80">— Rodada {e.rodada} —</span>
      case 'caiu':
        return <span className="text-pirata">{nome(e.quem)} caiu!</span>
      case 'cura':
        return (
          <>
            {nome(e.de)} usa {e.habilidade}: <span className="text-emerald-300">+{e.cura.toLocaleString('pt-BR')}</span> em {nome(e.para)}
          </>
        )
      case 'dano':
        return (
          <>
            {nome(e.de)} → {nome(e.para)} ({e.habilidade}):{' '}
            {e.esquivou ? (
              <span className="text-sky-300">esquivou</span>
            ) : (
              <>
                <span className={e.critico ? 'text-ouro-claro' : 'text-creme'}>{e.dano.toLocaleString('pt-BR')}</span>
                {e.critico && <span className="text-ouro-claro"> crítico</span>}
                {e.bloqueou && <span className="text-slate-300"> bloqueado</span>}
              </>
            )}
          </>
        )
    }
  }
  return (
    <section className="max-h-44 overflow-y-auto rounded-sm border border-painel-borda/40 bg-abissal/40 p-3 text-[0.72rem] leading-relaxed text-creme/75">
      {linhas.map((e, i) => (
        <p key={batalha.eventos.length - i} className={i === 0 ? 'text-creme' : ''}>
          {texto(e)}
        </p>
      ))}
    </section>
  )
}

function Resultado({ fim, aoTerminar }: { fim: 'vitoria' | 'derrota'; aoTerminar: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className={`titulo-serif text-2xl ${fim === 'vitoria' ? 'text-ouro-claro' : 'text-pirata'}`}>
          {fim === 'vitoria' ? 'O navio é nosso!' : 'Fomos derrotados…'}
        </p>
        <p className="text-sm text-creme/65">
          {fim === 'vitoria'
            ? 'Tripulação rendida: o porão inteiro vem junto — saque completo.'
            : 'O inimigo tomou o convés. A tripulação acorda na última ilha.'}
        </p>
      </div>
      <button
        onClick={aoTerminar}
        className="rounded-sm border border-ouro/80 bg-ouro/15 px-5 py-2 text-sm text-ouro-claro hover:bg-ouro/25"
      >
        Voltar ao mar
      </button>
    </div>
  )
}
