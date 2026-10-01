import { useCallback, useEffect, useRef, useState } from 'react'
import { CenaTurnos } from './CenaTurnos'
import { Anel, COR_TIPO, IconeTipo, NOME_ALCANCE } from './icones'
import { agir, agirInimigo, criarBatalha, custoDe, fila, golpeDe, NOMES_TIPO, porId, proximo, vivos, vizinhos, type Escolha, type Estado, type Golpe, type Resultado, type Unidade } from './regras'

/**
 * Tela de teste do combate estilo Honkai: /teste-turnos
 * A interface segue a do Honkai (fila à esquerda, tripulação embaixo à
 * esquerda, botões redondos à direita), com a cara do Grand Seas: azul-marinho,
 * dourado e pergaminho. O E abre o leque de habilidades (ícones redondos; a
 * descrição só no hover); o botão grande mostra o que está escolhido e o
 * Espaço (ou clicar nele) usa.
 */

const base = import.meta.env.BASE_URL
const DOURADO = '#e8c26a'
const PERGAMINHO = '#f6ead0'
const MARINHO = 'rgba(12, 20, 34, 0.82)'
const retrato = (u: Unidade, tam: number, alto = tam): React.CSSProperties => ({
  width: tam,
  height: alto,
  backgroundImage: `url(${base}sprites/${u.sprite}/parado_S.png)`,
  backgroundSize: `${tam * 2.2}px ${tam * 2.2}px`,
  backgroundPosition: `center ${-tam * 0.42}px`,
  imageRendering: 'pixelated',
  backgroundRepeat: 'no-repeat',
})
const tipoDoGolpe = (u: Unidade, g: Golpe) => (g.alcance === 'time' ? 'time' : (g.tipo ?? u.tipo))

export default function TelaTurnos() {
  const tela = useRef<HTMLCanvasElement>(null)
  const camada = useRef<HTMLDivElement>(null)
  const cena = useRef<CenaTurnos | null>(null)
  const [estado, setEstado] = useState<Estado>(() => criarBatalha())
  const est = useRef(estado)
  const [, setVersao] = useState(0)
  const redesenhar = useCallback(() => setVersao((v) => v + 1), [])
  const [atual, setAtual] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string>('marinha-almirante')
  const [ocupado, setOcupado] = useState(true)
  const [escolha, setEscolha] = useState<Escolha>('basico')
  const [leque, setLeque] = useState(false)
  const [dica, setDica] = useState<{ u: Unidade; g: Golpe; x: number; y: number } | null>(null)
  const [cutin, setCutin] = useState<{ u: Unidade; nome: string } | null>(null)
  const [jogo, setJogo] = useState(0)
  const [rapido, setRapido] = useState(false)
  const [auto, setAuto] = useState(false)
  const jogada = useRef<(() => void) | null>(null)
  const ults = useRef<string[]>([])
  const alvoRef = useRef(alvo)
  const velRef = useRef(1)
  useEffect(() => {
    alvoRef.current = alvo
  }, [alvo])
  useEffect(() => {
    velRef.current = rapido ? 2 : 1
    if (cena.current) cena.current.velocidade = velRef.current
  }, [rapido])
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms / velRef.current))

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
      await c.golpe(r.ator, r.acertos.map((a) => a.alvo), r.tipo, r.tipoGolpe, r.golpe.efeito, () => {
        for (const a of r.acertos) {
          c.numero(a.alvo, String(a.dano), a.fraco ? '#ffd35a' : '#ffffff', r.tipoGolpe === 'ultimate')
          if (a.quebrou) setTimeout(() => c.numero(a.alvo, 'QUEBRA!', '#ff5a5a', true), 180)
        }
        if (r.golpe.energiaTime) for (const u of vivos(est.current, 'tripulacao')) if (u.id !== r.ator) c.numero(u.id, `+${r.golpe.energiaTime} energia`, '#7cc4ff')
        redesenhar()
      })
      await Promise.all(r.acertos.filter((a) => a.caiu).map((a) => c.cair(a.alvo)))
      const vivosIni = vivos(est.current, 'inimigos')
      if (vivosIni.length && !vivosIni.some((u) => u.id === alvoRef.current)) setAlvo(vivosIni[Math.floor(vivosIni.length / 2)].id)
      redesenhar()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [redesenhar],
  )

  const soltarUltimates = useCallback(async () => {
    while (ults.current.length && !est.current.vencedor) {
      const id = ults.current.shift()!
      const u = porId(est.current, id)
      if (u.hp <= 0 || u.energia < u.energiaMax) continue
      const ini = vivos(est.current, 'inimigos')
      const alvoU = ini.some((x) => x.id === alvoRef.current) ? alvoRef.current : ini[0].id
      cena.current!.marcarAtual(id)
      await animar(agir(est.current, id, 'ultimate', alvoU))
    }
  }, [animar])

  // laço da batalha
  useEffect(() => {
    let vivo = true
    const c = new CenaTurnos(tela.current!, camada.current!)
    c.velocidade = velRef.current
    cena.current = c
    const e = criarBatalha()
    // teste: o Lutador já começa com o Entei carregado
    const lutador = porId(e, 'pirata-lutador')
    lutador.energia = lutador.energiaMax
    est.current = e
    setEstado(e)
    ults.current = []
    void (async () => {
      await c.carregar(e.unidades)
      await new Promise((r) => setTimeout(r, 500))
      while (vivo && !e.vencedor) {
        await soltarUltimates()
        if (e.vencedor) break
        const u = proximo(e)
        setAtual(u.id)
        setEscolha('basico')
        setLeque(false)
        c.marcarAtual(u.id)
        redesenhar()
        if (u.lado === 'inimigos') {
          await new Promise((r) => setTimeout(r, 450 / velRef.current))
          await animar(agirInimigo(e, u.id))
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

  const usar = useCallback(
    async (esc: Escolha) => {
      if (ocupado || !atual) return
      const u = porId(est.current, atual)
      if (u.lado !== 'tripulacao') return
      if (esc !== 'basico' && esc !== 'ultimate' && est.current.ph < custoDe(golpeDe(u, esc))) return
      setOcupado(true)
      setLeque(false)
      setDica(null)
      await animar(agir(est.current, atual, esc, alvoRef.current))
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
      if (!ocupado) {
        setOcupado(true)
        await soltarUltimates()
        cena.current?.marcarAtual(atual)
        setOcupado(false)
      }
    },
    [ocupado, atual, soltarUltimates, redesenhar],
  )

  // automático: usa a primeira habilidade quando há pontos, senão o básico; solta os ultimates cheios
  useEffect(() => {
    if (!auto || ocupado || !atual) return
    const t = setTimeout(() => {
      const u = porId(est.current, atual)
      for (const x of vivos(est.current, 'tripulacao')) if (x.energia >= x.energiaMax && !ults.current.includes(x.id)) ults.current.push(x.id)
      const hab = u.kit!.habilidades.findIndex((g) => g.alcance !== 'time' && est.current.ph >= custoDe(g))
      void (async () => {
        if (ults.current.length) {
          setOcupado(true)
          await soltarUltimates()
          setOcupado(false)
        }
        void usar(hab >= 0 && est.current.ph >= 3 ? hab : 'basico')
      })()
    }, 400)
    return () => clearTimeout(t)
  }, [auto, ocupado, atual, usar, soltarUltimates])

  // teclado: Q básico, E habilidades, Espaço usa, A/D mira, 1–4 ultimate
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase()
      if (k === 'q') {
        if (escolha === 'basico' && !leque) void usar('basico')
        setEscolha('basico')
        setLeque(false)
      }
      if (k === 'e') setLeque((v) => !v)
      if (k === ' ') {
        ev.preventDefault()
        void usar(escolha)
      }
      if (k === 'escape') setLeque(false)
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
  }, [usar, ultimate, escolha, leque])

  const e = estado
  const nossos = e.unidades.filter((u) => u.lado === 'tripulacao')
  const inimigos = e.unidades.filter((u) => u.lado === 'inimigos')
  const vez = atual ? porId(e, atual) : null
  const minhaVez = !!vez && vez.lado === 'tripulacao' && !ocupado
  const golpeAtual = vez?.kit ? golpeDe(vez, escolha) : null
  const naMira = new Set(
    !golpeAtual || golpeAtual.alcance === 'time' ? [] : golpeAtual.alcance === 'todos' ? vivos(e, 'inimigos').map((u) => u.id) : golpeAtual.alcance === 'leque' ? [alvo, ...vizinhos(e, alvo)] : [alvo],
  )
  const proximos = e.unidades.some((u) => u.hp > 0) ? fila(e, 8) : []
  const alvoU = porId(e, alvo)
  const podeUsar = (g: Golpe, esc: Escolha) => minhaVez && (esc === 'basico' || e.ph >= custoDe(g))

  return (
    <div className="gs-turnos" style={{ position: 'fixed', inset: 0, background: '#0b1220', overflow: 'hidden', userSelect: 'none', font: '14px Georgia, serif', color: PERGAMINHO }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* camada que segue os inimigos: mira, fraquezas, escudo e vida */}
      <div ref={camada} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {inimigos
          .filter((u) => u.hp > 0)
          .map((u) => (
            <div key={u.id}>
              <div data-segue={u.id} data-altura="1.06" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setAlvo(u.id)}>
                <div style={{ transform: 'translate(-50%, -100%)', width: u.chefe ? 120 : 84 }}>
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 3 }}>
                    {u.fraquezas.map((t) => (
                      <span key={t} title={`Fraco a ${NOMES_TIPO[t]}`} style={{ width: 18, height: 18, borderRadius: 9, background: 'rgba(8,12,20,0.85)', border: `1px solid ${COR_TIPO[t]}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconeTipo tipo={t} tam={13} />
                      </span>
                    ))}
                  </div>
                  {u.quebrado ? <div style={{ height: 3, background: '#7a7f88', marginBottom: 1 }} /> : <Barra v={u.escudo / u.escudoMax} cor="#f4f4f4" alt={3} />}
                  <div style={{ height: 1 }} />
                  <Barra v={u.hp / u.hpMax} cor="#d9483b" alt={5} />
                </div>
              </div>
              {naMira.has(u.id) && (
                <div data-segue={u.id} data-altura="0.5" style={{ position: 'absolute', left: 0, top: 0 }}>
                  <Mira principal={u.id === alvo} />
                </div>
              )}
            </div>
          ))}
      </div>

      {/* fila de ação */}
      <div style={{ position: 'absolute', left: 14, top: 14, display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 10, borderLeft: `1px solid rgba(232,194,106,0.35)` }}>
        {proximos.map((id, i) => {
          const u = porId(e, id)
          const nosso = u.lado === 'tripulacao'
          const w = i === 0 ? 92 : 74
          return (
            <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              {i === 0 && <span style={{ position: 'absolute', left: -19, color: DOURADO, fontSize: 12 }}>▶</span>}
              <span style={{ position: 'absolute', left: -14, width: 7, height: 7, borderRadius: 4, background: nosso ? '#5ad1c4' : '#d9483b' }} />
              <div
                style={{
                  ...retrato(u, w, i === 0 ? 50 : 38),
                  backgroundColor: nosso ? 'rgba(30,48,70,0.85)' : 'rgba(70,24,24,0.8)',
                  border: `1px solid ${i === 0 ? DOURADO : 'rgba(232,194,106,0.3)'}`,
                  borderRadius: '4px 12px 4px 4px',
                  boxShadow: i === 0 ? '0 0 10px rgba(232,194,106,0.5)' : undefined,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* alvo e controles (canto de cima) */}
      <div style={{ position: 'absolute', right: 14, top: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {alvoU && alvoU.hp > 0 && (
          <div style={{ ...painel, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px' }}>
            <div style={{ ...retrato(alvoU, 34), borderRadius: 17, backgroundColor: 'rgba(70,24,24,0.8)' }} />
            <div>
              <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, fontWeight: 700 }}>{alvoU.nome} ▸</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>
                {alvoU.hp}/{alvoU.hpMax} · fraco a {alvoU.fraquezas.map((t) => NOMES_TIPO[t]).join(' e ')}
              </div>
            </div>
          </div>
        )}
        <div style={{ ...painel, display: 'flex', gap: 2, padding: 3 }}>
          <BotaoTopo ativo={rapido} onClick={() => setRapido((v) => !v)} titulo="Velocidade 2×">
            ▶▶
          </BotaoTopo>
          <BotaoTopo ativo={auto} onClick={() => setAuto((v) => !v)} titulo="Batalha automática">
            AUTO
          </BotaoTopo>
        </div>
      </div>

      {/* tripulação (embaixo, à esquerda) */}
      <div style={{ position: 'absolute', left: 16, bottom: 46, display: 'flex', gap: 14 }}>
        {nossos.map((u, i) => {
          const cheio = u.energia >= u.energiaMax && u.hp > 0
          const daVez = atual === u.id
          const morto = u.hp <= 0
          return (
            <div key={u.id} onClick={() => void ultimate(u.id)} title={`${u.kit!.ultimate.nome}: ${u.kit!.ultimate.descricao}`} style={{ position: 'relative', width: 128, opacity: morto ? 0.35 : 1, transform: daVez ? 'translateY(-10px)' : undefined, transition: 'transform 0.2s', cursor: cheio ? 'pointer' : 'default' }}>
              <span style={{ position: 'absolute', right: 2, top: -10, zIndex: 2, width: 20, height: 20, borderRadius: 10, background: '#1b1409', border: `1px solid ${DOURADO}`, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ ...retrato(u, 64), borderRadius: '6px 6px 0 0', backgroundColor: daVez ? 'rgba(232,194,106,0.28)' : 'rgba(20,32,50,0.8)', borderBottom: `2px solid ${daVez ? DOURADO : 'transparent'}`, boxShadow: daVez ? `0 0 12px rgba(232,194,106,0.6)` : undefined }} />
                <div style={{ marginLeft: -6, marginBottom: 2, animation: cheio ? 'gs-pulso 1.2s infinite' : undefined, borderRadius: '50%' }}>
                  <Anel v={u.energia / u.energiaMax} tam={52} cor={cheio ? '#ffd35a' : '#5ab4e8'} grossura={4}>
                    <IconeTipo tipo={u.kit!.ultimate.tipo ?? u.tipo} tam={22} cor={cheio ? '#ffd35a' : 'rgba(246,234,208,0.55)'} />
                  </Anel>
                </div>
              </div>
              <div style={{ marginTop: 3 }}>
                <Barra v={u.hp / u.hpMax} cor="#4fd1b5" alt={5} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 1 }}>
                <span style={{ fontFamily: 'Cinzel, Georgia, serif' }}>{u.nome}</span>
                <span>{u.hp}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ações (embaixo, à direita) */}
      {vez?.kit && vez.lado === 'tripulacao' && golpeAtual && (
        <div style={{ position: 'absolute', right: 52, bottom: 52, width: 330, height: 260 }}>
          {/* leque de habilidades em volta do botão grande */}
          {leque &&
            vez.kit.habilidades.map((g, i) => {
              const n = vez.kit!.habilidades.length
              const ang = (240 + (i - (n - 1) / 2) * 36) * (Math.PI / 180)
              const x = 255 + Math.cos(ang) * 150 - 30
              const y = 180 + Math.sin(ang) * 150 - 30
              const pode = podeUsar(g, i)
              return (
                <div key={g.nome} style={{ position: 'absolute', left: x, top: y, animation: 'gs-surge 0.18s ease-out' }}>
                  <BotaoRedondo
                    tam={60}
                    tipo={tipoDoGolpe(vez, g)}
                    icone={g.icone}
                    marcado={escolha === i}
                    apagado={!pode}
                    onClick={() => {
                      if (!pode) return
                      if (escolha === i) void usar(i)
                      else setEscolha(i)
                    }}
                    onHover={(ev) => setDica(ev ? { u: vez, g, x: ev.x, y: ev.y } : null)}
                  />
                  <div style={{ textAlign: 'center', marginTop: 2, fontSize: 9, color: DOURADO }}>{'◆'.repeat(custoDe(g))}</div>
                </div>
              )
            })}
          {/* pontos de habilidade */}
          <div style={{ position: 'absolute', right: 150, top: 222, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Cinzel, Georgia, serif', marginRight: 2 }}>{e.ph}</span>
            <span style={{ opacity: 0.6, marginRight: 2 }}>/</span>
            {Array.from({ length: e.phMax }, (_, i) => (
              <span key={i} style={{ width: 10, height: 10, transform: 'rotate(45deg)', background: i < e.ph ? DOURADO : 'transparent', border: `1px solid ${DOURADO}`, display: 'inline-block', boxShadow: i < e.ph ? '0 0 6px rgba(232,194,106,0.7)' : undefined }} />
            ))}
          </div>
          {/* botão de habilidades (E) */}
          <div style={{ position: 'absolute', left: 300, top: 92 }}>
            <BotaoRedondo tam={58} tipo={tipoDoGolpe(vez, vez.kit.habilidades[0])} icone={vez.kit.habilidades[0].icone} tecla="E" marcado={leque || escolha !== 'basico'} onClick={() => setLeque((v) => !v)} />
            <div style={{ textAlign: 'center', fontSize: 10, marginTop: 2, color: DOURADO }}>Habilidades</div>
          </div>
          {/* botão grande: o que está escolhido; clicar (ou Espaço) usa */}
          <div style={{ position: 'absolute', left: 195, top: 120 }}>
            <BotaoRedondo
              tam={120}
              tipo={tipoDoGolpe(vez, golpeAtual)}
              icone={golpeAtual.icone}
              tecla={escolha === 'basico' ? 'Q' : undefined}
              marcado={minhaVez}
              apagado={!podeUsar(golpeAtual, escolha)}
              grande
              onClick={() => void usar(escolha)}
              onHover={(ev) => setDica(ev ? { u: vez, g: golpeAtual, x: ev.x, y: ev.y } : null)}
            />
            <div style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: '#1b1409', border: `1px solid ${DOURADO}`, borderRadius: 10, padding: '1px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconeTipo tipo={tipoDoGolpe(vez, golpeAtual)} tam={12} />
              {NOME_ALCANCE[golpeAtual.alcance]}
            </div>
          </div>
          {/* nome do golpe escolhido */}
          <div style={{ position: 'absolute', right: 150, top: 172, textAlign: 'right', textShadow: '0 2px 4px #000', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: 11, color: DOURADO }}>{escolha === 'basico' ? 'Ataque básico · +1 ponto' : `Habilidade · −${custoDe(golpeAtual)} ponto${custoDe(golpeAtual) > 1 ? 's' : ''}`}</div>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 20, fontWeight: 700 }}>{golpeAtual.nome}</div>
          </div>
        </div>
      )}

      {/* descrição só no hover */}
      {dica && (
        <div style={{ position: 'fixed', left: dica.x - 290, top: dica.y - 40, width: 260, ...painel, padding: '10px 12px', pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconeTipo tipo={tipoDoGolpe(dica.u, dica.g)} icone={dica.g.icone} tam={18} />
            <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: 700, fontSize: 15 }}>{dica.g.nome}</span>
          </div>
          <div style={{ fontSize: 11, color: DOURADO, margin: '4px 0' }}>
            {dica.g.alcance === 'time' ? 'Tripulação' : `${NOMES_TIPO[dica.g.tipo ?? dica.u.tipo]} · ${NOME_ALCANCE[dica.g.alcance]}`}
            {dica.g === dica.u.kit!.basico ? ' · +1 ponto' : ` · custa ${custoDe(dica.g)} ponto${custoDe(dica.g) > 1 ? 's' : ''}`}
            {dica.g.mult > 0 && ` · ${Math.round(dica.g.mult * 100)}% do ataque`}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>{dica.g.descricao}</div>
        </div>
      )}

      {/* faixa de teclas */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: 'linear-gradient(0deg, rgba(8,12,20,0.95), rgba(8,12,20,0.6))', borderTop: '1px solid rgba(232,194,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 22, paddingRight: 24, fontSize: 12 }}>
        <span style={{ marginRight: 'auto', marginLeft: 16, opacity: 0.5, fontSize: 11 }}>Grand Seas · teste de combate por turnos</span>
        <Tecla t="A" /> Mira ←
        <Tecla t="D" /> Mira →
        <Tecla t="Q" /> Ataque
        <Tecla t="E" /> Habilidades
        <Tecla t="1–4" /> Ultimate
        <Tecla t="Espaço" /> Usar
      </div>

      {/* cut-in do ultimate */}
      {cutin && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', animation: 'gs-cutin 1.15s ease-out' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', height: '40%', background: 'linear-gradient(100deg, rgba(10,14,26,0.94) 0%, rgba(30,50,80,0.88) 45%, rgba(232,194,106,0.55) 100%)', transform: 'skewY(-6deg)', borderTop: `2px solid ${DOURADO}`, borderBottom: `2px solid ${DOURADO}` }} />
          <div style={{ position: 'relative', marginLeft: '12%', ...retrato(cutin.u, 260), backgroundPosition: 'center -100px', filter: 'drop-shadow(0 0 18px #ffb347)' }} />
          <div style={{ position: 'relative', marginLeft: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.85 }}>{cutin.u.nome}</div>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 54, fontWeight: 900, letterSpacing: 2, textShadow: '0 4px 0 #000, 0 0 20px #ff7a2e' }}>{cutin.nome}</div>
          </div>
        </div>
      )}

      {e.vencedor && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,14,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 50, fontWeight: 900 }}>{e.vencedor === 'tripulacao' ? 'Vitória!' : 'Derrota'}</div>
          <button onClick={() => setJogo((j) => j + 1)} style={{ font: '18px Georgia, serif', padding: '8px 20px', borderRadius: 8, border: `2px solid ${DOURADO}`, background: '#1b1409', color: PERGAMINHO, cursor: 'pointer' }}>
            Lutar de novo
          </button>
        </div>
      )}
      <style>{`
        @keyframes gs-cutin { 0% { opacity: 0; transform: translateX(-60px) } 15% { opacity: 1; transform: none } 85% { opacity: 1 } 100% { opacity: 0; transform: translateX(40px) } }
        @keyframes gs-pulso { 0%, 100% { box-shadow: 0 0 6px #ffd35a } 50% { box-shadow: 0 0 18px #ffd35a } }
        @keyframes gs-surge { from { opacity: 0; transform: scale(0.6) } to { opacity: 1; transform: none } }
        @keyframes gs-gira { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

const painel: React.CSSProperties = { background: MARINHO, border: '1px solid rgba(232,194,106,0.45)', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }

function Barra({ v, cor, alt }: { v: number; cor: string; alt: number }) {
  return (
    <div style={{ height: alt, background: 'rgba(0,0,0,0.6)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.7)' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: cor, transition: 'width 0.35s' }} />
    </div>
  )
}

/** Mira laranja (o alvo principal maior; os do leque/área menores). */
function Mira({ principal }: { principal: boolean }) {
  const t = principal ? 64 : 44
  return (
    <svg width={t} height={t} viewBox="0 0 64 64" style={{ transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 0 6px rgba(255,110,40,0.8))' }}>
      <g style={{ transformOrigin: '32px 32px', animation: 'gs-gira 6s linear infinite' }}>
        <circle cx="32" cy="32" r="24" fill="none" stroke="#ff7a3a" strokeWidth="3" strokeDasharray="30 8" />
        {[0, 120, 240].map((a) => (
          <path key={a} d="M32 2 L28 9 L36 9 Z" fill="#ffb07a" transform={`rotate(${a} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="12" fill="rgba(255,120,60,0.25)" stroke="#ffd0b0" strokeWidth="2" />
      <circle cx="32" cy="32" r="3" fill="#fff" />
    </svg>
  )
}

function BotaoRedondo({
  tam,
  tipo,
  icone,
  tecla,
  marcado,
  apagado,
  grande,
  onClick,
  onHover,
}: {
  tam: number
  tipo: Parameters<typeof IconeTipo>[0]['tipo']
  icone?: Golpe['icone']
  tecla?: string
  marcado?: boolean
  apagado?: boolean
  grande?: boolean
  onClick: () => void
  onHover?: (p: { x: number; y: number } | null) => void
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={(ev) => {
        const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
        onHover?.({ x: r.left, y: r.top + r.height / 2 })
      }}
      onMouseLeave={() => onHover?.(null)}
      style={{
        position: 'relative',
        width: tam,
        height: tam,
        borderRadius: '50%',
        cursor: apagado ? 'default' : 'pointer',
        background: `radial-gradient(circle at 50% 40%, #24344e, #0d1626 70%)`,
        border: `2px solid ${marcado ? DOURADO : 'rgba(232,194,106,0.45)'}`,
        boxShadow: marcado ? `0 0 ${grande ? 26 : 14}px rgba(232,194,106,0.65), inset 0 0 12px rgba(232,194,106,0.25)` : 'inset 0 0 10px rgba(0,0,0,0.6)',
        opacity: apagado ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {grande && (
        // anel de rosa-dos-ventos em volta do botão grande
        <svg width={tam + 30} height={tam + 30} style={{ position: 'absolute', left: -17, top: -17, pointerEvents: 'none' }}>
          <circle cx={(tam + 30) / 2} cy={(tam + 30) / 2} r={tam / 2 + 10} fill="none" stroke="rgba(232,194,106,0.35)" strokeWidth="1" />
          {Array.from({ length: 32 }, (_, i) => {
            const a = (i / 32) * Math.PI * 2
            const r0 = tam / 2 + (i % 8 === 0 ? 4 : 7)
            const r1 = tam / 2 + 12
            const c = (tam + 30) / 2
            return <line key={i} x1={c + Math.cos(a) * r0} y1={c + Math.sin(a) * r0} x2={c + Math.cos(a) * r1} y2={c + Math.sin(a) * r1} stroke={DOURADO} strokeOpacity={i % 8 === 0 ? 0.9 : 0.4} strokeWidth={i % 8 === 0 ? 2 : 1} />
          })}
        </svg>
      )}
      <IconeTipo tipo={tipo} icone={icone} tam={tam * 0.5} />
      {tecla && <span style={{ position: 'absolute', right: grande ? 4 : -4, top: grande ? 4 : -4, width: 20, height: 20, borderRadius: 10, background: '#1b1409', border: `1px solid ${DOURADO}`, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PERGAMINHO }}>{tecla}</span>}
    </div>
  )
}

function BotaoTopo({ ativo, onClick, titulo, children }: { ativo: boolean; onClick: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <button title={titulo} onClick={onClick} style={{ minWidth: 46, height: 30, borderRadius: 6, border: 'none', background: ativo ? 'rgba(232,194,106,0.85)' : 'transparent', color: ativo ? '#1b1409' : PERGAMINHO, font: '700 12px Georgia, serif', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function Tecla({ t }: { t: string }) {
  return <span style={{ minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, border: `1px solid ${DOURADO}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, marginRight: -16, color: DOURADO }}>{t}</span>
}
