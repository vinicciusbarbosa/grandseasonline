import Phaser from 'phaser'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Cantoneiras, Losango } from '../componentes/ui/ornamentos'
import { CenaOceano } from './cena/CenaOceano'
import { painelNavegacao, type RetratoNavegacao } from './painel'
import { AVISTADA, VISITADA } from './sim/descoberta'
import { TEMPESTADES } from './sim/tempestade'
import { NAVIOS, type AtributosNavegacao, type TipoNavio } from './sim/navios'

/**
 * Protótipo da navegação oceânica: a cena Phaser ocupa a tela inteira e o HUD
 * em React flutua por cima. Não depende da API nem de login — dá para abrir
 * direto em /navegacao.
 */
export default function TelaNavegacao() {
  const alvo = useRef<HTMLDivElement>(null)
  const [cena, setCena] = useState<CenaOceano | null>(null)
  const retrato = useSyncExternalStore(painelNavegacao.assinar, painelNavegacao.obter)

  useEffect(() => {
    if (!alvo.current) return
    const oceano = new CenaOceano()
    const jogo = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: alvo.current,
      backgroundColor: '#0b1220',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: oceano,
      banner: false,
    })
    jogo.events.once(Phaser.Core.Events.READY, () => {
      // O Phaser guarda a posição do canvas no boot. Em desenvolvimento o React
      // monta a tela duas vezes, e o canvas antigo ainda está no DOM nesse
      // instante — sem refresh, o clique chega deslocado.
      jogo.scale.refresh()
      setCena(oceano)
    })
    return () => {
      painelNavegacao.fontes = null
      jogo.destroy(true)
    }
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden bg-abissal select-none">
      <div ref={alvo} className="absolute inset-0 [&>canvas]:absolute [&>canvas]:inset-0" />

      {retrato && cena && (
        <>
          <Localizacao retrato={retrato} />
          <Minimapa retrato={retrato} aoNavegar={(x, y) => cena.navegarPara(x, y)} />
          <Instrumentos retrato={retrato} />
          <Comandos retrato={retrato} cena={cena} />
          {retrato.aviso && (
            <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 rounded-sm border border-pirata/60 bg-abissal/85 px-5 py-2.5 text-sm text-creme shadow-lg backdrop-blur-md">
              {retrato.aviso}
            </div>
          )}
          <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-xs tracking-wide text-creme/55 lg:block">
            Clique no mar para navegar · numa ilha para atracar · roda do mouse: zoom
          </p>
        </>
      )}
    </div>
  )
}

function Quadro({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto relative border border-painel-borda/45 bg-painel/80 text-creme shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md ${className}`}
      style={{ borderRadius: 'var(--sg-raio)' }}
    >
      <Cantoneiras />
      {children}
    </div>
  )
}

const SITUACAO: Record<RetratoNavegacao['situacao'], string> = {
  atracado: 'Atracado',
  parado: 'À deriva',
  navegando: 'Navegando',
  'indo-atracar': 'Rumo à doca',
  redemoinho: 'Na correnteza do redemoinho',
  capturado: 'Preso no redemoinho!',
  naufragado: 'O navio se partiu',
}

function Localizacao({ retrato }: { retrato: RetratoNavegacao }) {
  let detalhe = SITUACAO[retrato.situacao]
  if (retrato.situacao === 'atracado' && retrato.ilhaAtual) detalhe = `Atracado em ${retrato.ilhaAtual}`
  if (retrato.situacao === 'indo-atracar' && retrato.destino) detalhe = `Rumo a ${retrato.destino}`

  return (
    <div className="pointer-events-none absolute top-4 left-4">
      <Quadro className="min-w-64 px-5 py-4">
        <div className="flex items-center gap-2">
          <Losango className="text-ouro" />
          <h1 className="titulo-serif text-xl text-ouro-claro">{retrato.mar}</h1>
        </div>
        <p className="numero-ficha mt-1 text-sm text-creme/70">{retrato.coordenada}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-creme/90">{detalhe}</span>
          {retrato.zonaSegura && (
            <span className="rounded-full border border-ouro/60 bg-ouro/15 px-2.5 py-0.5 text-xs text-ouro-claro">
              Zona segura
            </span>
          )}
          {retrato.tempestade > 0.05 && (
            <span className="rounded-full border border-pirata/70 bg-pirata/25 px-2.5 py-0.5 text-xs text-creme">
              {retrato.tempestade > 0.7 ? 'Olho da tempestade' : 'Tempestade'}
            </span>
          )}
          {retrato.naCorrente && (
            <span className="rounded-full border border-espirito/70 bg-espirito/20 px-2.5 py-0.5 text-xs text-creme">
              Corrente
            </span>
          )}
        </div>
        <Link to="/status" className="mt-3 inline-block text-xs text-creme/45 hover:text-ouro-claro">
          ← Voltar ao jogo
        </Link>
      </Quadro>
    </div>
  )
}

/** Rosa dos ventos: seta dourada é o vento, ponteiro claro é a proa. */
function Instrumentos({ retrato }: { retrato: RetratoNavegacao }) {
  const grausVento = (retrato.ventoDirecao * 180) / Math.PI
  const grausRumo = (retrato.rumo * 180) / Math.PI
  const efeito = Math.round((retrato.fatorVento - 1) * 100)
  const razao = Math.min(1, retrato.velocidade / retrato.velocidadeMax)

  return (
    <div className="pointer-events-none absolute bottom-4 left-4">
      <Quadro className="flex items-center gap-5 px-5 py-4">
        <svg viewBox="-60 -60 120 120" className="size-32" aria-label="Rosa dos ventos">
          <circle r="56" fill="rgba(7,10,16,0.55)" stroke="var(--color-ouro)" strokeOpacity="0.5" />
          <circle r="44" fill="none" stroke="var(--color-painel-borda)" strokeOpacity="0.5" strokeDasharray="2 4" />
          {['N', 'L', 'S', 'O'].map((ponto, i) => {
            const a = (i * Math.PI) / 2 - Math.PI / 2
            return (
              <text
                key={ponto}
                x={Math.cos(a) * 50}
                y={Math.sin(a) * 50 + 4}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-creme)"
                opacity={ponto === 'N' ? 0.95 : 0.55}
                fontFamily="Cinzel, Georgia, serif"
              >
                {ponto}
              </text>
            )
          })}
          {/* Vento: a seta aponta para onde ele sopra; o comprimento é a força. */}
          <g transform={`rotate(${grausVento})`} opacity={0.4 + retrato.ventoIntensidade * 0.6}>
            <line x1={-30} y1="0" x2={10 + retrato.ventoIntensidade * 22} y2="0" stroke="var(--color-ouro)" strokeWidth="3" />
            <path d={`M${16 + retrato.ventoIntensidade * 22} 0 l-10 -7 v14 z`} fill="var(--color-ouro)" />
          </g>
          {/* Proa */}
          <g transform={`rotate(${grausRumo})`}>
            <path d="M34 0 L-8 -5 L-4 0 L-8 5 Z" fill="var(--color-creme)" opacity="0.9" />
          </g>
          <circle r="4" fill="var(--color-ouro-claro)" />
        </svg>

        <div className="w-40">
          <p className="text-xs tracking-wider text-creme/55 uppercase">Velocidade</p>
          <p className="numero-ficha text-3xl text-creme">
            {retrato.velocidade.toFixed(1)} <span className="text-base text-creme/60">nós</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-abissal/70">
            <div className="h-full rounded-full bg-gradient-to-r from-marinha to-ouro-claro" style={{ width: `${razao * 100}%` }} />
          </div>
          <p className="mt-3 text-xs tracking-wider text-creme/55 uppercase">Vento</p>
          <p className="text-sm text-creme/90">
            {Math.round(retrato.ventoIntensidade * 100)}% ·{' '}
            <span className={efeito >= 0 ? 'text-ouro-claro' : 'text-pirata'}>
              {efeito >= 0 ? '+' : ''}
              {efeito}% {efeito >= 2 ? 'a favor' : efeito <= -2 ? 'contra' : 'de través'}
            </span>
          </p>
        </div>
      </Quadro>
    </div>
  )
}

const ROTULOS: [keyof AtributosNavegacao, string][] = [
  ['maxSpeed', 'Velocidade'],
  ['acceleration', 'Aceleração'],
  ['turnRate', 'Manobra'],
  ['waveResistance', 'Estabilidade'],
  ['windEfficiency', 'Vento'],
]

function Comandos({ retrato, cena }: { retrato: RetratoNavegacao; cena: CenaOceano }) {
  return (
    <div className="pointer-events-none absolute right-4 bottom-4 flex w-80 flex-col gap-3">
      <Quadro className="p-4">
        <p className="mb-3 flex items-center gap-2 text-xs tracking-wider text-creme/55 uppercase">
          <Losango className="text-ouro" tamanho={6} /> Navio
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(NAVIOS) as TipoNavio[]).map((tipo) => {
            const modelo = NAVIOS[tipo]
            const ativo = retrato.navio === tipo
            return (
              <button
                key={tipo}
                onClick={() => cena.trocarNavio(tipo)}
                className={`rounded-sm border px-3 py-2 text-left transition-all ${
                  ativo
                    ? 'border-ouro/80 bg-painel-claro/80 shadow-[0_0_16px_-6px_var(--color-ouro)]'
                    : 'border-painel-borda/40 hover:border-ouro/40'
                }`}
              >
                <span className={`titulo-serif block text-sm ${tipo === 'pirata' ? 'text-[#e8836f]' : 'text-[#8fb8e4]'}`}>
                  {modelo.nome}
                </span>
                <span className="text-[0.68rem] text-creme/55">{tipo === 'pirata' ? 'Pirata' : 'Marinha'}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-creme/65">{NAVIOS[retrato.navio].descricao}</p>
        <div className="mt-3 space-y-1.5">
          {ROTULOS.map(([chave, rotulo]) => (
            <div key={chave} className="flex items-center gap-2 text-[0.7rem]">
              <span className="w-20 text-creme/60">{rotulo}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-abissal/70">
                <div className="h-full bg-ouro/80" style={{ width: `${NAVIOS[retrato.navio].atributos[chave] * 10}%` }} />
              </div>
              <span className="numero-ficha w-6 text-right text-creme/70">{NAVIOS[retrato.navio].atributos[chave]}</span>
            </div>
          ))}
        </div>
      </Quadro>

      <Quadro className="flex flex-wrap items-center gap-2 p-3 text-xs">
        <span className="text-creme/55">Tempo</span>
        {[1, 2, 4].map((escala) => (
          <button
            key={escala}
            onClick={() => cena.definirEscalaTempo(escala)}
            className={`rounded-sm border px-2.5 py-1 ${
              retrato.escalaTempo === escala ? 'border-ouro/80 text-ouro-claro' : 'border-painel-borda/40 text-creme/70 hover:border-ouro/40'
            }`}
          >
            {escala}×
          </button>
        ))}
        <button
          onClick={() => cena.alternarSom()}
          className={`ml-auto rounded-sm border px-2.5 py-1 ${
            retrato.som ? 'border-ouro/80 text-ouro-claro' : 'border-painel-borda/40 text-creme/70 hover:border-ouro/40'
          }`}
        >
          Som
        </button>
        <button
          onClick={() => cena.alternarGrade()}
          className={`rounded-sm border px-2.5 py-1 ${
            retrato.grade ? 'border-ouro/80 text-ouro-claro' : 'border-painel-borda/40 text-creme/70 hover:border-ouro/40'
          }`}
          title="Mostra a grade lógica e os chunks de 10×10"
        >
          Grade
        </button>
        <button
          onClick={() => cena.irParaTempestade()}
          className="w-full rounded-sm border border-pirata/50 px-2.5 py-1 text-creme/80 hover:border-pirata"
        >
          Navegar até a tempestade
        </button>
        <button
          onClick={() => cena.irParaRedemoinho()}
          className="w-full rounded-sm border border-pirata/50 px-2.5 py-1 text-creme/80 hover:border-pirata"
        >
          Navegar até o redemoinho
        </button>
      </Quadro>
    </div>
  )
}

const LARGURA_MINIMAPA = 300

function Minimapa({ retrato, aoNavegar }: { retrato: RetratoNavegacao; aoNavegar: (x: number, y: number) => void }) {
  const tela = useRef<HTMLCanvasElement>(null)
  const base = useRef<{ versao: number; imagem: ImageData | null }>({ versao: -1, imagem: null })
  const fontes = painelNavegacao.fontes

  useEffect(() => {
    const canvas = tela.current
    if (!canvas || !fontes) return
    const { mundo, descoberta } = fontes
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // A base (terra, mar, névoa) só é refeita quando a descoberta muda.
    if (base.current.versao !== descoberta.versao || !base.current.imagem) {
      const imagem = base.current.imagem ?? ctx.createImageData(mundo.largura, mundo.altura)
      const d = imagem.data
      for (let i = 0; i < mundo.bloqueio.length; i++) {
        const visto = descoberta.estado[i]
        let r = 16
        let g = 22
        let b = 34
        if (visto !== 0 && mundo.bloqueio[i]) [r, g, b] = visto === VISITADA ? [176, 150, 104] : [150, 128, 92]
        else if (visto !== 0) [r, g, b] = visto === AVISTADA ? [38, 96, 132] : [52, 124, 160]
        d[i * 4] = r
        d[i * 4 + 1] = g
        d[i * 4 + 2] = b
        d[i * 4 + 3] = 255
      }
      base.current = { versao: descoberta.versao, imagem }
    }
    ctx.putImageData(base.current.imagem!, 0, 0)

    // Tempestade: círculo tracejado vermelho.
    ctx.setLineDash([2, 2])
    ctx.strokeStyle = 'rgba(214,90,80,0.8)'
    ctx.lineWidth = 0.8
    for (const t of TEMPESTADES) {
      ctx.beginPath()
      ctx.arc(t.cx, t.cy, t.raio, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.setLineDash([])

    const px = 1 / mundo.celula
    ctx.fillStyle = '#f0d68e'
    for (const ilha of mundo.ilhas) {
      if (descoberta.estado[mundo.indice(ilha.x, ilha.y)]) ctx.fillRect(ilha.x - 0.5, ilha.y - 0.5, 2, 2)
    }

    const rota = fontes.rota()
    if (rota) {
      ctx.strokeStyle = 'rgba(255,243,196,0.8)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(retrato.posicao.x * px, retrato.posicao.y * px)
      for (const p of rota) ctx.lineTo(p.x * px, p.y * px)
      ctx.stroke()
    }

    ctx.fillStyle = retrato.navio === 'pirata' ? '#ff8a73' : '#9cc6ff'
    ctx.beginPath()
    ctx.arc(retrato.posicao.x * px, retrato.posicao.y * px, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }, [retrato, fontes])

  if (!fontes) return null
  const { mundo } = fontes
  const altura = (LARGURA_MINIMAPA * mundo.altura) / mundo.largura

  return (
    <div className="pointer-events-none absolute top-4 right-4">
      <Quadro className="p-3">
        <canvas
          ref={tela}
          width={mundo.largura}
          height={mundo.altura}
          style={{ width: LARGURA_MINIMAPA, height: altura }}
          className="block cursor-crosshair"
          title="Clique para traçar rota"
          onClick={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect()
            const x = ((ev.clientX - r.left) / r.width) * mundo.larguraPx
            const y = ((ev.clientY - r.top) / r.height) * mundo.alturaPx
            aoNavegar(x, y)
          }}
        />
        <p className="mt-2 flex justify-between text-[0.7rem] text-creme/55">
          <span>Mar descoberto</span>
          <span className="numero-ficha text-creme/80">{(retrato.descoberto * 100).toFixed(1)}%</span>
        </p>
      </Quadro>
    </div>
  )
}
