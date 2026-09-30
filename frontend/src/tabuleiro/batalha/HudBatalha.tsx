import { useState } from 'react'
import type { ControleBatalha, FichaHud, HakiHud, RetratoBatalha } from './controle'
import { MOVIMENTO_POR_VEZ } from './regras'

/**
 * HUD da batalha, com cara de jogo:
 *   topo      — faixa da vez (sua / da Marinha), tempo e movimentos;
 *   laterais  — cards das duas tripulações (retrato, vida, energia,
 *               espírito e ícones de estado — só o essencial);
 *   embaixo   — barra de ações do pirata escolhido: Atacar (golpe básico),
 *               Skills (abre a lista), o painel de Haki (interruptores, com
 *               os usos que sobram) e Passar a vez;
 *   cantos    — registro, Auto e velocidade; preparação e fim em janelas.
 */

const CSS = `
.hud { position:absolute; inset:0; pointer-events:none; font:600 13px/1.25 'Trebuchet MS', system-ui, sans-serif; color:#f4e6c8; }
.hud * { box-sizing:border-box; }
.hud .tit { font-family:'Pirata One', Georgia, serif; font-weight:400; letter-spacing:.5px; }
.hud .pn { pointer-events:auto; background:linear-gradient(180deg, rgba(28,34,56,.94), rgba(12,15,28,.94)); border:2px solid #b8913e;
  border-radius:10px; box-shadow:0 0 0 1px #2a1c06, inset 0 0 0 1px rgba(255,230,160,.18), 0 6px 18px rgba(0,0,0,.45); }
.hud .bt { pointer-events:auto; font:inherit; color:#f4e6c8; cursor:pointer; border-radius:8px; border:2px solid #6a5424;
  background:linear-gradient(180deg,#3a3f5c,#1d2135); box-shadow:inset 0 1px 0 rgba(255,255,255,.15), 0 2px 0 #0b0d18; padding:8px 12px; transition:transform .08s, filter .12s; }
.hud .bt:hover:not(:disabled) { filter:brightness(1.25); transform:translateY(-1px); }
.hud .bt:active:not(:disabled) { transform:translateY(1px); }
.hud .bt:disabled { opacity:.42; cursor:default; }
.hud .bt.on { border-color:#ffd34a; color:#ffe89a; background:linear-gradient(180deg,#6a4a14,#2e2008); }
.hud .bt.grande { font-size:15px; padding:11px 18px; }
.hud .bt.vermelho { border-color:#ff5a4a; background:linear-gradient(180deg,#9a2a1a,#4a0e08); }
.hud .card { display:flex; gap:7px; align-items:center; padding:5px 7px; margin-bottom:5px; border-radius:9px; border:1px solid rgba(184,145,62,.5);
  background:linear-gradient(90deg, rgba(20,26,44,.92), rgba(12,15,28,.85)); pointer-events:auto; transition:transform .1s; }
.hud .card.sel { border-color:#ffd34a; box-shadow:0 0 10px rgba(255,211,74,.55); }
.hud .card.clic { cursor:pointer; }
.hud .card.clic:hover { transform:translateX(3px); }
.hud .card.morto { opacity:.35; filter:grayscale(1); }
.hud .ret { flex:none; width:44px; height:44px; border-radius:50%; border:2px solid #b8913e; background-color:#20283e; background-repeat:no-repeat; image-rendering:pixelated; }
.hud .barra { height:8px; border-radius:4px; background:#150c10; overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,.7); }
.hud .barra > i { display:block; height:100%; border-radius:4px; transition:width .3s; }
.hud .fina { height:4px; margin-top:2px; }
.hud .ico { display:inline-block; min-width:16px; height:16px; padding:0 3px; margin-right:2px; border-radius:8px; font-size:10px; line-height:16px; text-align:center; font-weight:700; }
.hud .pip { display:inline-block; width:9px; height:9px; margin:0 1px; border-radius:50%; border:1px solid rgba(0,0,0,.6); }
.hud .skills { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px,1fr)); gap:6px; }
.hud .sk { text-align:left; padding:7px 9px; }
.hud .sk small { display:block; font-weight:400; font-size:11px; color:#b8c2d8; margin-top:2px; }
.hud .tg { display:flex; flex-direction:column; align-items:center; gap:3px; min-width:92px; padding:6px 8px; }
`

const cor = { vida: '#56d65a', vidaBaixa: '#e8503a', energia: '#4ab0ff', espirito: '#ff4a6a', arm: '#b070ff', rei: '#ff3a4a', obs: '#7fd8ff' }

function Barra({ v, max, c, fina }: { v: number; max: number; c: string; fina?: boolean }) {
  return (
    <div className={`barra${fina ? ' fina' : ''}`}>
      <i style={{ width: `${(100 * Math.max(0, v)) / max}%`, background: `linear-gradient(180deg, ${c}, ${c}aa)` }} />
    </div>
  )
}

/** Rosto do personagem: recorte da cabeça na folha parada. */
function Retrato({ url, tam = 44 }: { url: string; tam?: number }) {
  // quadro 128×128; a cabeça fica por volta de x 34–94, y 14–74
  const k = tam / 60
  return <div className="ret" style={{ width: tam, height: tam, backgroundImage: `url(${url})`, backgroundSize: `${128 * k}px ${128 * k}px`, backgroundPosition: `${-34 * k}px ${-12 * k}px` }} />
}

function Pips({ n, max, c }: { n: number; max: number; c: string }) {
  return (
    <span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="pip" style={{ background: i < n ? c : '#2a2e40' }} />
      ))}
    </span>
  )
}

function Icones({ f }: { f: FichaHud }) {
  const ic: [string, string, string][] = []
  if (f.fruta) ic.push([f.fruta.tipo === 'logia' ? 'L' : f.fruta.tipo === 'zoan' ? 'Z' : 'P', '#ffcf5a', `${f.fruta.nome}`])
  if (f.armamento?.ligado) ic.push(['A', f.rei?.ligado ? cor.rei : cor.arm, f.rei?.ligado ? 'Haki do Rei imbuído ligado' : 'Haki de armamento ligado'])
  if (f.observacao?.ligado) ic.push(['O', cor.obs, 'Observação ligada'])
  if (f.atordoado) ic.push(['✶', '#ff5a6e', 'Atordoado: perde a vez'])
  if (f.queimando) ic.push(['🔥', '#ff8a3a', 'Queimando'])
  if (f.transformado) ic.push(['⇪', '#ffcf5a', `Transformado (${f.transformado})`])
  return (
    <div style={{ marginTop: 3, minHeight: 16 }}>
      {ic.map(([t, c, titulo]) => (
        <span key={titulo} className="ico" title={titulo} style={{ background: `${c}33`, color: c, border: `1px solid ${c}` }}>
          {t}
        </span>
      ))}
    </div>
  )
}

function Card({ f, sel, onClick, direita }: { f: FichaHud; sel?: boolean; onClick?: () => void; direita?: boolean }) {
  const morto = f.hp <= 0
  return (
    <div className={`card${sel ? ' sel' : ''}${onClick ? ' clic' : ''}${morto ? ' morto' : ''}`} onClick={onClick} style={{ flexDirection: direita ? 'row-reverse' : 'row' }}>
      <Retrato url={f.retrato} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, flexDirection: direita ? 'row-reverse' : 'row' }}>
          <span className="tit" style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {f.nome}
          </span>
          <span style={{ fontSize: 11, color: '#d8c8a0' }}>{Math.max(0, f.hp)}</span>
        </div>
        <Barra v={f.hp} max={f.hpMax} c={f.hp / f.hpMax > 0.35 ? cor.vida : cor.vidaBaixa} />
        <Barra v={f.energia} max={100} c={cor.energia} fina />
        <Barra v={f.espirito} max={100} c={cor.espirito} fina />
        <Icones f={f} />
      </div>
    </div>
  )
}

function Interruptor(props: { nome: string; h: HakiHud | null; c: string; ligado: boolean; pode: boolean; onClick: () => void; titulo: string; extra?: string }) {
  return (
    <button className={`bt tg${props.ligado ? ' on' : ''}`} disabled={!props.pode && !props.ligado} onClick={props.onClick} title={props.titulo} style={props.ligado ? { borderColor: props.c, color: props.c, boxShadow: `0 0 12px ${props.c}88` } : undefined}>
      <span style={{ fontSize: 12 }}>{props.nome}</span>
      <span style={{ fontSize: 10, color: props.ligado ? props.c : '#8a93aa' }}>{props.ligado ? 'LIGADO' : 'desligado'}</span>
      {props.h && <Pips n={props.h.usos} max={props.h.max} c={props.c} />}
      {props.extra && <span style={{ fontSize: 10, color: '#c8a0a8' }}>{props.extra}</span>}
    </button>
  )
}

const FRUTAS_OP: [string, string][] = [
  ['', 'Nenhuma'],
  ['fumaca', 'Logia: Fumaça'],
  ['fogo', 'Logia: Fogo'],
  ['luz', 'Logia: Luz'],
  ['gelo', 'Logia: Gelo'],
  ['borracha', 'Paramecia: Borracha'],
  ['bisao', 'Zoan: Bisão'],
]
const NIVEL = ['—', 'normal', 'avançado']

function Preparar({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const sel: React.CSSProperties = { font: 'inherit', fontSize: 12, background: '#1e263a', color: '#f4e6c8', border: '1px solid #6a5424', borderRadius: 5, padding: '3px' }
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', pointerEvents: 'auto' }}>
      <div className="pn" style={{ padding: 14, maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
        <div className="tit" style={{ fontSize: 26, textAlign: 'center', color: '#ffd34a' }}>
          Preparar batalha
        </div>
        <div style={{ fontWeight: 400, color: '#b8c2d8', margin: '4px 0 10px', maxWidth: 560, textAlign: 'center' }}>
          Teste: escolha a Akuma no Mi e o Haki de cada um. O overall decide os duelos de Haki (observação, Haki do Rei e o choque entre dois Rei).
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#9aa6bc', fontSize: 11 }}>
              <td></td>
              <td>Akuma</td>
              <td>Armamento</td>
              <td>Observação</td>
              <td>Rei</td>
              <td>Overall</td>
            </tr>
          </thead>
          <tbody>
            {b.config.map((k) => (
              <tr key={k.id}>
                <td className="tit" style={{ padding: '3px 6px', fontSize: 15, color: k.lado === 'piratas' ? '#ffd34a' : '#8ac4ff' }}>
                  {k.nome}
                </td>
                <td>
                  <select value={k.akuma} onChange={(ev) => c.mudarConfig(k.id, 'akuma', ev.target.value)} style={sel}>
                    {FRUTAS_OP.map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                {(['armamento', 'observacao'] as const).map((campo) => (
                  <td key={campo}>
                    <select value={k[campo]} onChange={(ev) => c.mudarConfig(k.id, campo, Number(ev.target.value))} style={sel}>
                      {NIVEL.map((n, i) => (
                        <option key={i} value={i}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={k.rei} onChange={(ev) => c.mudarConfig(k.id, 'rei', ev.target.checked)} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="bt" style={{ padding: '2px 8px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.max(0, k.overall - 5))}>
                    −
                  </button>
                  <span style={{ display: 'inline-block', width: 28, textAlign: 'center' }}>{k.overall}</span>
                  <button className="bt" style={{ padding: '2px 8px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.min(100, k.overall + 5))}>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="bt grande vermelho tit" style={{ fontSize: 20 }} onClick={() => c.comecar()}>
            Começar batalha
          </button>
        </div>
      </div>
    </div>
  )
}

export function HudBatalha({ b, c, velocidade, mudarVelocidade }: { b: RetratoBatalha; c: ControleBatalha; velocidade: number; mudarVelocidade: (v: number) => void }) {
  const [verLog, setVerLog] = useState(false)
  const [verSkills, setVerSkills] = useState(false)
  const s = b.selecionado
  const minha = b.fase === 'minha' && !b.animando && !b.auto
  const skill = s?.skills.find((k) => k.id === s.skill)
  const basica = s?.skills.find((k) => k.energia === 0 && k.area === 'alvo')
  const escolherSkill = (id: string) => {
    c.escolherSkill(id)
    setVerSkills(false)
  }
  return (
    <div className="hud">
      <style>{CSS}</style>
      {b.fase === 'preparar' && <Preparar b={b} c={c} />}

      {b.fase !== 'preparar' && (
        <>
          {/* faixa da vez */}
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div
              className="tit"
              style={{
                fontSize: 26,
                padding: '2px 28px',
                color: b.vez === 'piratas' ? '#ffe07a' : '#bfe0ff',
                background: b.vez === 'piratas' ? 'linear-gradient(90deg, transparent, rgba(140,70,10,.9) 20%, rgba(140,70,10,.9) 80%, transparent)' : 'linear-gradient(90deg, transparent, rgba(20,60,130,.9) 20%, rgba(20,60,130,.9) 80%, transparent)',
                textShadow: '0 2px 0 #000',
                whiteSpace: 'nowrap',
              }}
            >
              {b.vez === 'piratas' ? 'Sua vez' : 'Vez da Marinha'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 3, fontSize: 12, textShadow: '0 1px 2px #000' }}>
              <span>Vez {b.turno}</span>
              {b.fase === 'minha' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 90 }}>
                    <Barra v={b.tempo} max={b.tempoMax} c={b.tempo <= 20 ? '#ff5a4a' : '#ffd34a'} fina />
                  </span>
                  <span style={{ color: b.tempo <= 20 ? '#ff7a6a' : undefined }}>{b.tempo}s</span>
                </span>
              )}
              <span title="Movimentos da tripulação nesta vez">
                👣 <Pips n={b.movimento} max={MOVIMENTO_POR_VEZ} c="#8ac4ff" />
              </span>
            </div>
            {b.dica && <div style={{ marginTop: 3, fontSize: 12, fontWeight: 400, color: '#e8ecf8', textShadow: '0 1px 2px #000', maxWidth: 440 }}>{b.dica}</div>}
          </div>

          {/* tripulações */}
          <div style={{ position: 'absolute', left: 8, top: 8, width: 190, maxHeight: 'calc(100% - 110px)', overflow: 'auto', pointerEvents: 'auto' }}>
            {b.tripulacao.map((t) => (
              <Card key={t.id} f={t} sel={s?.id === t.id} onClick={minha && t.hp > 0 ? () => c.selecionar(s?.id === t.id ? null : t.id) : undefined} />
            ))}
          </div>
          <div style={{ position: 'absolute', right: 8, top: 8, width: 190, maxHeight: 'calc(100% - 110px)', overflow: 'auto', pointerEvents: 'auto' }}>
            {b.inimigos.map((t) => (
              <Card key={t.id} f={t} direita />
            ))}
          </div>

          {/* lista de skills */}
          {s && minha && verSkills && (
            <div className="pn" style={{ position: 'absolute', left: '50%', bottom: 118, transform: 'translateX(-50%)', width: 'min(620px, calc(100% - 16px))', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="tit" style={{ fontSize: 18, color: '#ffd34a' }}>
                  Skills — {s.nome}
                </span>
                <button className="bt" style={{ padding: '2px 10px' }} onClick={() => setVerSkills(false)}>
                  ✕
                </button>
              </div>
              <div className="skills">
                {s.skills.map((k) => (
                  <button key={k.id} className={`bt sk${s.skill === k.id ? ' on' : ''}`} disabled={!!k.motivo} title={k.motivo ?? k.descricao} onClick={() => escolherSkill(k.id)}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ color: k.fruta ? '#ffcf5a' : undefined }}>{k.nome}</span>
                      <span>
                        <span style={{ color: cor.energia }}>⚡{k.energia}</span>
                        {k.espera > 0 && <span style={{ color: '#ffb070', marginLeft: 6 }}>⟳{k.recarga > 0 ? `${k.recarga}` : k.espera}</span>}
                      </span>
                    </span>
                    <small>{k.motivo ?? k.descricao}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* barra de ações */}
          {s && minha && (
            <div className="pn" style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', display: 'flex', alignItems: 'stretch', gap: 8, padding: 8, maxWidth: 'calc(100% - 16px)', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 150 }}>
                <Retrato url={s.retrato} tam={52} />
                <div style={{ width: 96 }}>
                  <div className="tit" style={{ fontSize: 17 }}>
                    {s.nome}
                  </div>
                  <Barra v={s.hp} max={s.hpMax} c={cor.vida} />
                  <div style={{ fontSize: 10, color: '#b8c2d8', marginTop: 2 }}>
                    <span style={{ color: cor.energia }}>⚡{s.energia}</span> · <span style={{ color: cor.espirito }}>✦{s.espirito}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                <button className={`bt${!s.skill || s.skill === basica?.id ? ' on' : ''}`} onClick={() => basica && escolherSkill(basica.id)} title={basica?.descricao}>
                  ⚔ Atacar
                </button>
                <button className={`bt${verSkills || (skill && skill.id !== basica?.id) ? ' on' : ''}`} onClick={() => setVerSkills(!verSkills)}>
                  ✦ Skills ▴
                </button>
              </div>

              {(s.armamento || s.observacao || s.rei) && (
                <div style={{ display: 'flex', gap: 5, paddingLeft: 8, borderLeft: '1px solid rgba(184,145,62,.4)' }}>
                  {s.armamento && (
                    <Interruptor
                      nome={s.armamento.avancado ? 'Armamento+' : 'Armamento'}
                      h={s.armamento}
                      c={cor.arm}
                      ligado={s.armamento.ligado}
                      pode={s.podeArmamento}
                      onClick={() => c.alternarArmamento()}
                      titulo="Liga/desliga (não gasta a vez). Ligado, cada ataque gasta 1 uso. Recupera com espírito."
                    />
                  )}
                  {s.rei && s.armamento?.avancado && (
                    <Interruptor
                      nome="Rei imbuído"
                      h={null}
                      c={cor.rei}
                      ligado={s.rei.ligado}
                      pode={s.podeRei}
                      onClick={() => c.alternarRei()}
                      titulo="Liga/desliga (não gasta a vez). Ligado, cada ataque gasta 40 de espírito."
                      extra="✦40 por ataque"
                    />
                  )}
                  {s.observacao && (
                    <Interruptor
                      nome={s.observacao.avancado ? 'Observação+' : 'Observação'}
                      h={s.observacao}
                      c={cor.obs}
                      ligado={s.observacao.ligado}
                      pode={s.observacao.usos > 0}
                      onClick={() => c.observar()}
                      titulo="Ligada, gasta 1 uso por ataque recebido e tenta esquivar de todos os hits."
                    />
                  )}
                  {s.rei && (
                    <button className="bt tg vermelho" disabled={!s.podeHaoshoku} onClick={() => c.haoshoku()} title="Haki do Rei em área (70 de espírito): atordoa na próxima vez quem tem overall menor. Não gasta a vez.">
                      <span style={{ fontSize: 12 }}>Haki do Rei</span>
                      <span style={{ fontSize: 10 }}>em área</span>
                      <span style={{ fontSize: 10, color: '#ffb0b0' }}>✦70</span>
                    </button>
                  )}
                </div>
              )}

              {skill && s.previa && (
                <button className="bt grande vermelho" onClick={() => c.usarPrevia()} title="Usa a skill na área marcada (encerra a vez)">
                  ⚔ {skill.nome}
                </button>
              )}
            </div>
          )}

          {/* registro */}
          <div className="pn" style={{ position: 'absolute', left: 8, bottom: 8, padding: '5px 8px', width: verLog ? 320 : 'auto', maxWidth: 'calc(100% - 16px)', cursor: 'pointer' }} onClick={() => setVerLog(!verLog)}>
            {verLog ? (
              <div style={{ fontWeight: 400, fontSize: 12, maxHeight: 170, overflow: 'auto' }}>
                {b.log.map((l, i) => (
                  <div key={i} style={{ padding: '1px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    {l}
                  </div>
                ))}
              </div>
            ) : (
              <span>📜 Registro</span>
            )}
          </div>

          {/* passar, auto e velocidade */}
          {b.fase !== 'fim' && (
            <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className={`bt${b.auto ? ' on' : ''}`} onClick={() => c.alternarAuto()} title="A IA joga pelos piratas também">
                  Auto
                </button>
                <button className="bt" onClick={() => mudarVelocidade(velocidade === 1 ? 2 : 1)} title="Velocidade das animações">
                  {velocidade}×
                </button>
              </div>
              <button className="bt grande tit" style={{ fontSize: 18 }} disabled={!minha} onClick={() => c.passar()}>
                {b.fase === 'minha' ? 'Passar a vez' : 'Marinha jogando…'}
              </button>
            </div>
          )}

          {/* fim */}
          {b.fase === 'fim' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
              <div className="pn" style={{ padding: '22px 40px', textAlign: 'center' }}>
                <div className="tit" style={{ fontSize: 46, color: b.vencedor === 'piratas' ? '#ffd34a' : '#ff8a7a', textShadow: '0 3px 0 #000' }}>
                  {b.vencedor === 'piratas' ? 'Vitória!' : 'Derrota'}
                </div>
                <div style={{ margin: '6px 0 14px' }}>{b.turno} vezes</div>
                <button className="bt grande vermelho tit" style={{ fontSize: 20 }} onClick={() => c.novaBatalha()}>
                  Nova batalha
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
