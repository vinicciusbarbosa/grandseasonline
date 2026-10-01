import { useCallback, useEffect, useRef, useState } from 'react'
import { CenaTurnos } from './CenaTurnos'
import { agir, agirInimigo, criarBatalha, fila, NOMES_TIPO, porId, proximo, vivos, vizinhos, type Estado, type Resultado, type Tipo, type Unidade } from './regras'

/** Tela de teste do combate estilo Honkai: /teste-turnos */

const COR_TIPO: Record<Tipo, string> = { corte: '#d9dee6', impacto: '#c9925a', fogo: '#ff7a2e', tiro: '#f2d34b', haki: '#b06bff' }
const base = import.meta.env.BASE_URL
const retrato = (u: Unidade, tam: number): React.CSSProperties => ({
  width: tam,
  height: tam,
  backgroundImage: `url(${base}sprites/${u.sprite}/parado_S.png)`,
  backgroundSize: `${tam * 2.2}px ${tam * 2.2}px`,
  backgroundPosition: `center ${-tam * 0.42}px`,
  imageRendering: 'pixelated',
  backgroundRepeat: 'no-repeat',
})
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function TelaTurnos() {
  const tela = useRef<HTMLCanvasElement>(null)
  const camada = useRef<HTMLDivElement>(null)
  const cena = useRef<CenaTurnos | null>(null)
  const est = useRef<Estado>(criarBatalha())
  const [, setVersao] = useState(0)
  const redesenhar = useCallback(() => setVersao((v) => v + 1), [])
  const [atual, setAtual] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string>('marinha-almirante')
  const [ocupado, setOcupado] = useState(true)
  const [cutin, setCutin] = useState<{ u: Unidade; nome: string } | null>(null)
  const [jogo, setJogo] = useState(0)
  const jogada = useRef<(() => void) | null>(null)
  const ults = useRef<string[]>([])
  const alvoRef = useRef(alvo)
  alvoRef.current = alvo

  const e = est.current

  /** Toca o resultado na cena; as barras caem no impacto. */
  const animar = useCallback(
    async (r: Resultado) => {
      const c = cena.current!
      const ator = porId(est.current, r.ator)
      if (r.tipoGolpe === 'ultimate') {
        setCutin({ u: ator, nome: r.golpe.nome })
        await esperar(1150)
        setCutin(null)
      }
      await c.golpe(r.ator, r.acertos.map((a) => a.alvo), ator.tipo, r.tipoGolpe, r.golpe.efeito, () => {
        for (const a of r.acertos) {
          c.numero(a.alvo, String(a.dano), a.fraco ? '#ffd35a' : '#ffffff', r.tipoGolpe === 'ultimate')
          if (a.quebrou) setTimeout(() => c.numero(a.alvo, 'QUEBRA!', '#ff5a5a', true), 180)
        }
        redesenhar()
      })
      await Promise.all(r.acertos.filter((a) => a.caiu).map((a) => c.cair(a.alvo)))
      // alvo derrubado: a mira passa para outro inimigo
      const vivosIni = vivos(est.current, 'inimigos')
      if (vivosIni.length && !vivosIni.some((u) => u.id === alvoRef.current)) setAlvo(vivosIni[Math.floor(vivosIni.length / 2)].id)
      redesenhar()
    },
    [redesenhar],
  )

  const soltarUltimates = useCallback(async () => {
    while (ults.current.length && !est.current.vencedor) {
      const id = ults.current.shift()!
      const u = porId(est.current, id)
      if (u.hp <= 0 || u.energia < u.energiaMax) continue
      const alvoU = vivos(est.current, 'inimigos').some((x) => x.id === alvoRef.current) ? alvoRef.current : vivos(est.current, 'inimigos')[0].id
      cena.current!.marcarAtual(id)
      await animar(agir(est.current, id, 'ultimate', alvoU))
    }
  }, [animar])

  // laço da batalha
  useEffect(() => {
    let vivo = true
    const c = new CenaTurnos(tela.current!, camada.current!)
    cena.current = c
    est.current = criarBatalha()
    // teste: o Lutador já começa com o Entei carregado
    const lutador = porId(est.current, 'pirata-lutador')
    lutador.energia = lutador.energiaMax
    ults.current = []
    setAlvo('marinha-almirante')
    redesenhar()
    void (async () => {
      await c.carregar(est.current.unidades)
      await esperar(500)
      while (vivo && !est.current.vencedor) {
        await soltarUltimates()
        if (est.current.vencedor) break
        const u = proximo(est.current)
        setAtual(u.id)
        c.marcarAtual(u.id)
        redesenhar()
        if (u.lado === 'inimigos') {
          await esperar(450)
          await animar(agirInimigo(est.current, u.id))
          continue
        }
        setOcupado(false)
        await new Promise<void>((r) => (jogada.current = r))
        setOcupado(true)
      }
      c.marcarAtual(null)
      setAtual(null)
      redesenhar()
    })()
    return () => {
      vivo = false
      jogada.current?.()
      c.destruir()
    }
  }, [jogo, animar, soltarUltimates, redesenhar])

  const jogar = useCallback(
    async (tipo: 'basico' | 'habilidade') => {
      if (ocupado || !atual) return
      const u = porId(est.current, atual)
      if (u.lado !== 'tripulacao') return
      if (tipo === 'habilidade' && est.current.ph <= 0) return
      setOcupado(true)
      await animar(agir(est.current, atual, tipo, alvoRef.current))
      const fim = jogada.current
      jogada.current = null
      fim?.()
    },
    [ocupado, atual, animar],
  )

  const ultimate = useCallback(
    async (id: string) => {
      const u = porId(est.current, id)
      if (u.hp <= 0 || u.energia < u.energiaMax || ults.current.includes(id)) return
      ults.current.push(id)
      redesenhar()
      // na vez de um dos nossos, sai na hora; senão, assim que a ação atual acabar
      if (!ocupado) {
        setOcupado(true)
        await soltarUltimates()
        cena.current?.marcarAtual(atual)
        setOcupado(false)
      }
    },
    [ocupado, atual, soltarUltimates, redesenhar],
  )

  // teclado: Q básico, E habilidade, A/D (setas) mira, 1–4 ultimate
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase()
      if (k === 'q') void jogar('basico')
      if (k === 'e') void jogar('habilidade')
      if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') {
        const linha = vivos(est.current, 'inimigos')
        const i = linha.findIndex((u) => u.id === alvoRef.current)
        const j = Math.max(0, Math.min(linha.length - 1, i + (k === 'a' || k === 'arrowleft' ? -1 : 1)))
        if (linha[j]) setAlvo(linha[j].id)
      }
      const n = Number(k)
      if (n >= 1 && n <= 4) {
        const nossos = est.current.unidades.filter((u) => u.lado === 'tripulacao')
        if (nossos[n - 1]) void ultimate(nossos[n - 1].id)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [jogar, ultimate])

  const nossos = e.unidades.filter((u) => u.lado === 'tripulacao')
  const inimigos = e.unidades.filter((u) => u.lado === 'inimigos')
  const vez = atual ? porId(e, atual) : null
  const minhaVez = !!vez && vez.lado === 'tripulacao' && !ocupado
  const golpeMira = vez?.kit?.habilidade
  const naMira = new Set(golpeMira?.alcance === 'todos' ? vivos(e, 'inimigos').map((u) => u.id) : golpeMira?.alcance === 'leque' ? [alvo, ...vizinhos(e, alvo)] : [alvo])
  const proximos = e.unidades.some((u) => u.hp > 0) ? fila(e, 8) : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1220', overflow: 'hidden', userSelect: 'none', font: '14px Georgia, serif', color: '#f6ead0' }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div ref={camada} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* inimigos: nome, vida, escudo, fraquezas; clicar mira */}
        {inimigos
          .filter((u) => u.hp > 0)
          .map((u) => (
            <div key={u.id} data-segue={u.id} data-altura="1.08" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setAlvo(u.id)}>
              <div style={{ transform: 'translate(-50%, -100%)', width: u.chefe ? 150 : 112, textAlign: 'center' }}>
                {alvo === u.id && <div style={{ color: '#f0c76a', fontSize: 22, lineHeight: '18px', textShadow: '0 0 6px #000' }}>▼</div>}
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 2 }}>
                  {u.fraquezas.map((t) => (
                    <span key={t} title={`Fraco a ${NOMES_TIPO[t]}`} style={{ background: COR_TIPO[t], color: '#1b1409', borderRadius: 3, padding: '0 4px', fontSize: 10, fontWeight: 700 }}>
                      {NOMES_TIPO[t]}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, textShadow: '0 1px 2px #000', color: naMira.has(u.id) && minhaVez ? '#f0c76a' : undefined }}>{u.nome}</div>
                <Barra v={u.hp / u.hpMax} cor="#d8473a" alt={6} />
                <div style={{ marginTop: 2 }}>{u.quebrado ? <div style={{ fontSize: 10, color: '#ff8a7a', fontWeight: 700 }}>QUEBRADO</div> : <Barra v={u.escudo / u.escudoMax} cor="#f2f2f2" alt={3} />}</div>
              </div>
            </div>
          ))}
      </div>

      {/* fila de ação */}
      <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {proximos.map((id, i) => {
          const u = porId(e, id)
          const nosso = u.lado === 'tripulacao'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: i === 0 ? 1 : 0.85, transform: i === 0 ? 'scale(1.08)' : undefined, transformOrigin: 'left' }}>
              <div style={{ ...retrato(u, i === 0 ? 46 : 38), borderRadius: 6, border: `2px solid ${nosso ? '#e8c26a' : '#d8473a'}`, backgroundColor: nosso ? 'rgba(232,194,106,0.25)' : 'rgba(216,71,58,0.25)' }} />
              {i === 0 && <span style={{ fontSize: 12, textShadow: '0 1px 2px #000' }}>{u.nome}</span>}
            </div>
          )
        })}
      </div>

      {/* tripulação: cartas com vida e energia; cheia, clicar solta o ultimate */}
      <div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
        {nossos.map((u, i) => {
          const cheio = u.energia >= u.energiaMax && u.hp > 0
          const daVez = atual === u.id
          return (
            <div
              key={u.id}
              onClick={() => void ultimate(u.id)}
              title={`${u.kit!.ultimate.nome}: ${u.kit!.ultimate.descricao}`}
              style={{
                width: 108,
                padding: 6,
                borderRadius: 8,
                background: 'rgba(16,22,34,0.82)',
                border: `2px solid ${daVez ? '#f0c76a' : cheio ? '#ffe9a8' : 'rgba(232,194,106,0.35)'}`,
                boxShadow: cheio ? '0 0 14px #ffd35a' : daVez ? '0 0 10px rgba(240,199,106,0.6)' : undefined,
                transform: daVez ? 'translateY(-8px)' : undefined,
                transition: 'transform 0.2s',
                cursor: cheio ? 'pointer' : 'default',
                opacity: u.hp > 0 ? 1 : 0.35,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ ...retrato(u, 40), borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <div style={{ fontSize: 12, lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700 }}>{u.nome}</div>
                  <div style={{ color: COR_TIPO[u.tipo], fontSize: 10 }}>{NOMES_TIPO[u.tipo]}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>[{i + 1}] ult.</div>
                </div>
              </div>
              <div style={{ marginTop: 5 }}>
                <Barra v={u.hp / u.hpMax} cor="#5ccf6a" alt={6} />
                <div style={{ fontSize: 10, textAlign: 'right', opacity: 0.8 }}>
                  {u.hp}/{u.hpMax}
                </div>
                <Barra v={u.energia / u.energiaMax} cor={cheio ? '#ffd35a' : '#5aa8ff'} alt={4} />
              </div>
            </div>
          )
        })}
      </div>

      {/* pontos de habilidade e ações */}
      <div style={{ position: 'absolute', right: 18, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 11, opacity: 0.8, marginRight: 4 }}>Pontos de habilidade</span>
          {Array.from({ length: e.phMax }, (_, i) => (
            <span key={i} style={{ width: 13, height: 13, transform: 'rotate(45deg)', background: i < e.ph ? '#f0c76a' : 'rgba(255,255,255,0.12)', border: '1px solid #f0c76a', display: 'inline-block' }} />
          ))}
        </div>
        {vez?.kit && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Botao tecla="Q" nome={vez.kit.basico.nome} extra="+1 ponto" desc={vez.kit.basico.descricao} ativo={minhaVez} onClick={() => void jogar('basico')} />
            <Botao tecla="E" nome={vez.kit.habilidade.nome} extra="−1 ponto" desc={vez.kit.habilidade.descricao} ativo={minhaVez && e.ph > 0} onClick={() => void jogar('habilidade')} />
          </div>
        )}
        <div style={{ fontSize: 11, opacity: 0.7 }}>A/D ou clique: mira · 1–4: ultimate (energia cheia, a qualquer momento)</div>
      </div>

      {/* cut-in do ultimate */}
      {cutin && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', animation: 'turnos-cutin 1.15s ease-out' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', height: '40%', background: 'linear-gradient(100deg, rgba(10,10,20,0.92) 0%, rgba(120,30,20,0.85) 60%, rgba(240,140,40,0.7) 100%)', transform: 'skewY(-6deg)' }} />
          <div style={{ position: 'relative', marginLeft: '12%', ...retrato(cutin.u, 260), backgroundPosition: 'center -100px', filter: 'drop-shadow(0 0 18px #ffb347)' }} />
          <div style={{ position: 'relative', marginLeft: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.85 }}>{cutin.u.nome}</div>
            <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: 2, textShadow: '0 4px 0 #000, 0 0 20px #ff7a2e' }}>{cutin.nome}</div>
          </div>
        </div>
      )}

      {e.vencedor && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,14,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 46, fontWeight: 900 }}>{e.vencedor === 'tripulacao' ? 'Vitória!' : 'Derrota'}</div>
          <button onClick={() => setJogo((j) => j + 1)} style={{ font: '18px Georgia, serif', padding: '8px 20px', borderRadius: 8, border: '2px solid #e8c26a', background: '#1b1409', color: '#f6ead0', cursor: 'pointer' }}>
            Lutar de novo
          </button>
        </div>
      )}
      <style>{`@keyframes turnos-cutin { 0% { opacity: 0; transform: translateX(-60px) } 15% { opacity: 1; transform: none } 85% { opacity: 1 } 100% { opacity: 0; transform: translateX(40px) } }`}</style>
    </div>
  )
}

function Barra({ v, cor, alt }: { v: number; cor: string; alt: number }) {
  return (
    <div style={{ height: alt, background: 'rgba(0,0,0,0.55)', borderRadius: alt, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.6)' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: cor, transition: 'width 0.35s' }} />
    </div>
  )
}

function Botao({ tecla, nome, extra, desc, ativo, onClick }: { tecla: string; nome: string; extra: string; desc: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!ativo}
      title={desc}
      style={{
        width: 150,
        padding: '10px 10px',
        borderRadius: 10,
        border: '2px solid #e8c26a',
        background: ativo ? 'linear-gradient(180deg, #3a2a14, #1b1409)' : 'rgba(30,30,30,0.6)',
        color: '#f6ead0',
        opacity: ativo ? 1 : 0.5,
        cursor: ativo ? 'pointer' : 'default',
        textAlign: 'left',
        font: '13px Georgia, serif',
      }}
    >
      <div style={{ fontSize: 11, color: '#f0c76a' }}>
        [{tecla}] {extra}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{nome}</div>
    </button>
  )
}
