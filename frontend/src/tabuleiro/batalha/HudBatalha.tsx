import { useState } from 'react'
import type { ControleBatalha, FichaHud, HakiHud, RetratoBatalha, SkillHud } from './controle'
import { MOVIMENTO_POR_VEZ } from './regras'

/**
 * HUD da batalha (no estilo das referências de RPG de anime):
 *   topo-esquerda — quadros da tripulação (retrato inclinado, vida, energia,
 *                   espírito, ícones de estado);
 *   topo-direita  — registro de combate com horário e nomes coloridos;
 *   esquerda      — menu de ações em botões inclinados (Atacar, Skills,
 *                   Profissão, Passar) — Skills abre a lista ao lado;
 *   centro-baixo  — painel de Haki separado (interruptores);
 *   baixo         — ordem das vezes (esquerda) e faixa da vez (direita);
 *   preparação    — 10 s para ligar o Haki de cada pirata antes da batalha.
 * Os inimigos mostram nome e vida nas placas em cima deles (TelaTabuleiro).
 */

const CSS = `
.hud { position:absolute; inset:0; pointer-events:none; font:600 13px/1.25 'Trebuchet MS', system-ui, sans-serif; color:#eef4ff; }
.hud * { box-sizing:border-box; }
.hud .tit { font-family:'Cinzel', 'Pirata One', Georgia, serif; font-weight:700; letter-spacing:.4px; }
.hud .pn { pointer-events:auto; background:linear-gradient(180deg, rgba(10,18,34,.92), rgba(6,10,22,.92)); border:1px solid rgba(120,220,230,.45);
  box-shadow:0 0 0 1px rgba(0,0,0,.6), inset 0 0 20px rgba(60,200,220,.08), 0 8px 24px rgba(0,0,0,.5); }
.hud .quadro { display:flex; align-items:center; gap:0; margin-bottom:6px; pointer-events:auto; }
.hud .quadro .ret { flex:none; width:74px; height:58px; clip-path:polygon(14% 0,100% 0,86% 100%,0 100%); background-color:#16233a; background-repeat:no-repeat;
  image-rendering:pixelated; border:0; position:relative; }
.hud .quadro .borda { flex:none; width:78px; height:62px; clip-path:polygon(14% 0,100% 0,86% 100%,0 100%); background:linear-gradient(135deg,#6ff0e8,#1a7a8a); display:flex; align-items:center; justify-content:center; }
.hud .quadro.sel .borda { background:linear-gradient(135deg,#fff3a0,#d0a020); }
.hud .quadro.morto { opacity:.35; filter:grayscale(1); }
.hud .quadro.clic { cursor:pointer; }
.hud .quadro .info { margin-left:-8px; padding:4px 10px 5px 16px; width:210px; background:linear-gradient(90deg, rgba(6,12,26,.9) 60%, rgba(6,12,26,0)); }
.hud .linha { display:flex; align-items:center; gap:6px; font-size:11px; }
.hud .linha b { width:18px; font-size:10px; color:#8fe8ff; }
.hud .barra { flex:1; height:7px; background:#0a0f1c; border:1px solid rgba(255,255,255,.15); overflow:hidden; transform:skewX(-20deg); }
.hud .barra > i { display:block; height:100%; transition:width .3s; }
.hud .num { width:62px; text-align:right; font-size:11px; color:#dfe8f8; }
.hud .ico { display:inline-block; min-width:16px; height:15px; padding:0 3px; margin-right:3px; border-radius:3px; font-size:10px; line-height:15px; text-align:center; font-weight:700; }
.hud .pip { display:inline-block; width:8px; height:8px; margin:0 1px; transform:rotate(45deg); border:1px solid rgba(0,0,0,.6); }
.hud .menu { display:flex; flex-direction:column; gap:6px; pointer-events:auto; }
.hud .op { pointer-events:auto; width:230px; display:flex; align-items:center; gap:12px; padding:9px 18px; font-family:'Cinzel', Georgia, serif; font-weight:700; font-size:18px;
  color:#eaf6ff; cursor:pointer; border:1px solid rgba(120,220,230,.35); background:linear-gradient(90deg, rgba(14,24,44,.95), rgba(14,24,44,.75));
  clip-path:polygon(0 0,94% 0,100% 50%,94% 100%,0 100%); transition:transform .1s, background .12s; }
.hud .op:hover:not(:disabled) { transform:translateX(6px); background:linear-gradient(90deg, rgba(40,90,110,.95), rgba(20,50,70,.8)); }
.hud .op.on { color:#0a1222; background:linear-gradient(90deg,#e8fbff,#9ce8f0); }
.hud .op:disabled { opacity:.4; cursor:default; }
.hud .op .i { width:24px; text-align:center; font-size:20px; }
.hud .bt { pointer-events:auto; font:inherit; color:#eaf6ff; cursor:pointer; border:1px solid rgba(120,220,230,.45); background:linear-gradient(180deg,#1c2e4a,#0e1828);
  padding:7px 12px; clip-path:polygon(6% 0,100% 0,94% 100%,0 100%); transition:filter .12s; }
.hud .bt:hover:not(:disabled) { filter:brightness(1.35); }
.hud .bt:disabled { opacity:.4; cursor:default; }
.hud .bt.on { color:#0a1222; background:linear-gradient(180deg,#e8fbff,#9ce8f0); }
.hud .bt.vermelho { border-color:#ff6a5a; background:linear-gradient(180deg,#8a1e14,#420a06); }
.hud .sk { display:flex; flex-direction:column; text-align:left; padding:8px 12px; width:100%; clip-path:none; }
.hud .sk small { font-weight:400; font-size:11px; color:#a8b8d0; margin-top:2px; }
.hud .tg { display:flex; flex-direction:column; align-items:center; gap:3px; min-width:104px; padding:7px 10px; clip-path:polygon(8% 0,100% 0,92% 100%,0 100%); }
.hud .log div { padding:3px 0; border-bottom:1px solid rgba(255,255,255,.05); font-weight:400; }
.hud .log span.h { color:#7f90a8; margin-right:10px; font-variant-numeric:tabular-nums; }
@media (max-height: 600px) { .hud .quadro .ret { width:56px; height:44px } .hud .quadro .borda { width:60px; height:48px } .hud .op { font-size:15px; padding:6px 14px; width:190px } }
`

const cor = { vida: '#3de0b0', vida2: '#2aa8d8', vidaBaixa: '#ff5a4a', energia: '#4a9cff', espirito: '#ff4a6a', arm: '#b070ff', rei: '#ff3a4a', obs: '#7fd8ff', pirata: '#6ff0e8', marinha: '#ff6a6a' }

function Barra({ v, max, c, c2 }: { v: number; max: number; c: string; c2?: string }) {
  return (
    <div className="barra">
      <i style={{ width: `${(100 * Math.max(0, v)) / max}%`, background: `linear-gradient(90deg, ${c2 ?? c}, ${c})` }} />
    </div>
  )
}

/** Rosto do personagem: recorte da cabeça na folha parada. */
function rosto(url: string, l: number, a: number): React.CSSProperties {
  // quadro 128×128; o rosto fica por volta de x 36–92, y 24–68
  const k = l / 56
  return { backgroundImage: `url(${url})`, backgroundSize: `${128 * k}px ${128 * k}px`, backgroundPosition: `${-36 * k}px ${-24 * k - (a - l * 0.78) / 2}px` }
}

function Pips({ n, max, c }: { n: number; max: number; c: string }) {
  return (
    <span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="pip" style={{ background: i < n ? c : '#1c2438' }} />
      ))}
    </span>
  )
}

function Icones({ f }: { f: FichaHud }) {
  const ic: [string, string, string][] = []
  if (f.fruta) ic.push([f.fruta.tipo === 'logia' ? 'L' : f.fruta.tipo === 'zoan' ? 'Z' : 'P', '#ffcf5a', f.fruta.nome])
  if (f.armamento?.ligado) ic.push(['A', f.rei?.ligado ? cor.rei : cor.arm, f.rei?.ligado ? 'Haki do Rei imbuído ligado' : 'Haki de armamento ligado'])
  if (f.observacao?.ligado) ic.push(['O', cor.obs, 'Observação ligada'])
  if (f.atordoado) ic.push(['✶', '#ff5a6e', 'Atordoado: perde a vez'])
  if (f.queimando) ic.push(['🔥', '#ff8a3a', 'Queimando'])
  if (f.transformado) ic.push(['⇪', '#ffcf5a', `Transformado (${f.transformado})`])
  return (
    <span>
      {ic.map(([t, c, titulo]) => (
        <span key={titulo} className="ico" title={titulo} style={{ background: `${c}26`, color: c, border: `1px solid ${c}` }}>
          {t}
        </span>
      ))}
    </span>
  )
}

function Quadro({ f, sel, onClick }: { f: FichaHud; sel?: boolean; onClick?: () => void }) {
  const morto = f.hp <= 0
  return (
    <div className={`quadro${sel ? ' sel' : ''}${onClick ? ' clic' : ''}${morto ? ' morto' : ''}`} onClick={onClick}>
      <div className="borda">
        <div className="ret" style={rosto(f.retrato, 74, 58)} />
      </div>
      <div className="info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="tit" style={{ fontSize: 15 }}>
            {f.nome}
          </span>
          <Icones f={f} />
        </div>
        <div className="linha">
          <b>HP</b>
          <Barra v={f.hp} max={f.hpMax} c={f.hp / f.hpMax > 0.35 ? cor.vida : cor.vidaBaixa} c2={f.hp / f.hpMax > 0.35 ? cor.vida2 : '#a02010'} />
          <span className="num">
            {Math.max(0, f.hp)} / {f.hpMax}
          </span>
        </div>
        <div className="linha">
          <b>EN</b>
          <Barra v={f.energia} max={100} c={cor.energia} c2="#2a5aa8" />
          <span className="num">{f.energia} / 100</span>
        </div>
        <div className="linha" title="Espírito (Haki do Rei)">
          <b style={{ color: cor.espirito }}>ES</b>
          <Barra v={f.espirito} max={100} c={cor.espirito} c2="#8a1030" />
          <span className="num">{f.espirito}</span>
        </div>
      </div>
    </div>
  )
}

function Interruptor(props: { nome: string; h: HakiHud | null; c: string; ligado: boolean; pode: boolean; onClick: () => void; titulo: string; extra?: string }) {
  return (
    <button className="bt tg" disabled={!props.pode && !props.ligado} onClick={props.onClick} title={props.titulo} style={props.ligado ? { borderColor: props.c, color: '#fff', background: `linear-gradient(180deg, ${props.c}88, ${props.c}33)`, boxShadow: `0 0 14px ${props.c}` } : undefined}>
      <span className="tit" style={{ fontSize: 12 }}>
        {props.nome}
      </span>
      <span style={{ fontSize: 10, color: props.ligado ? '#fff' : '#8a93aa' }}>{props.ligado ? 'LIGADO' : 'desligado'}</span>
      {props.h && <Pips n={props.h.usos} max={props.h.max} c={props.c} />}
      {props.extra && <span style={{ fontSize: 10, color: '#d8b0b8' }}>{props.extra}</span>}
    </button>
  )
}

/** Interruptores de Haki de um pirata. */
function PainelHaki({ f, c, podeRei, podeHaoshoku }: { f: FichaHud; c: ControleBatalha; podeRei: boolean; podeHaoshoku?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {f.armamento && (
        <Interruptor
          nome={f.armamento.avancado ? 'Armamento+' : 'Armamento'}
          h={f.armamento}
          c={cor.arm}
          ligado={f.armamento.ligado}
          pode={f.armamento.usos > 0}
          onClick={() => c.alternarArmamento(f.id)}
          titulo="Liga/desliga (não gasta a vez). Ligado, cada ataque gasta 1 uso. Recupera com espírito."
        />
      )}
      {f.rei && f.armamento?.avancado && (
        <Interruptor nome="Rei imbuído" h={null} c={cor.rei} ligado={f.rei.ligado} pode={podeRei} onClick={() => c.alternarRei(f.id)} titulo="Liga/desliga (não gasta a vez). Ligado, cada ataque gasta 40 de espírito." extra="✦40 por ataque" />
      )}
      {f.observacao && (
        <Interruptor
          nome={f.observacao.avancado ? 'Observação+' : 'Observação'}
          h={f.observacao}
          c={cor.obs}
          ligado={f.observacao.ligado}
          pode={f.observacao.usos > 0}
          onClick={() => c.observar(f.id)}
          titulo="Ligada, gasta 1 uso por ataque recebido e tenta esquivar de todos os hits."
        />
      )}
      {f.rei && podeHaoshoku !== undefined && (
        <button className="bt tg vermelho" disabled={!podeHaoshoku} onClick={() => c.haoshoku()} title="Haki do Rei em área (70 de espírito): atordoa na próxima vez quem ele pegar. Não gasta a vez.">
          <span className="tit" style={{ fontSize: 12 }}>
            Haki do Rei
          </span>
          <span style={{ fontSize: 10 }}>em área</span>
          <span style={{ fontSize: 10, color: '#ffb0b0' }}>✦70</span>
        </button>
      )}
    </div>
  )
}

/** Texto do registro com os nomes coloridos (piratas ciano, Marinha vermelho). */
function Colorido({ texto, piratas, marinha }: { texto: string; piratas: string[]; marinha: string[] }) {
  const nomes = [...piratas.map((n) => [n, cor.pirata] as const), ...marinha.map((n) => [n, cor.marinha] as const)].sort((a, b) => b[0].length - a[0].length)
  const re = new RegExp(`(${nomes.map(([n]) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return (
    <>
      {texto.split(re).map((p, i) => {
        const n = nomes.find(([x]) => x === p)
        return n ? (
          <span key={i} style={{ color: n[1] }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}

const FRUTAS_OP: [string, string][] = [
  ['', 'Nenhuma'],
  ['fumaca', 'Logia: Fumaça'],
  ['fogo', 'Logia: Fogo (Mera)'],
  ['luz', 'Logia: Luz (Pika)'],
  ['gelo', 'Logia: Gelo (Hie)'],
  ['borracha', 'Paramecia: Borracha (Gomu)'],
  ['bisao', 'Zoan: Bisão'],
]
const NIVEL = ['—', 'normal', 'avançado']

function Preparar({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const sel: React.CSSProperties = { font: 'inherit', fontSize: 12, background: '#0e1828', color: '#eaf6ff', border: '1px solid rgba(120,220,230,.45)', padding: '3px' }
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
      <div className="pn" style={{ padding: 16, maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
        <div className="tit" style={{ fontSize: 26, textAlign: 'center', color: '#9ff4ee' }}>
          Montar as tripulações
        </div>
        <div style={{ fontWeight: 400, color: '#a8b8d0', margin: '4px 0 10px', maxWidth: 580, textAlign: 'center' }}>
          Teste: escolha a Akuma no Mi e o Haki de cada um. Depois de começar, há 10 s para ligar o Haki antes da batalha.
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#8fa0b8', fontSize: 11 }}>
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
                <td className="tit" style={{ padding: '3px 8px', fontSize: 14, color: k.lado === 'piratas' ? cor.pirata : cor.marinha }}>
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
                  <button className="bt" style={{ padding: '2px 9px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.max(0, k.overall - 5))}>
                    −
                  </button>
                  <span style={{ display: 'inline-block', width: 30, textAlign: 'center' }}>{k.overall}</span>
                  <button className="bt" style={{ padding: '2px 9px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.min(100, k.overall + 5))}>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="bt" onClick={() => c.aleatorizar()} title="Sorteia Akuma no Mi e Haki de todos">
            🎲 Aleatorizar
          </button>
          <button className="bt" onClick={() => c.restaurarConfig()} title="Volta ao elenco de teste">
            ↺ Padrão
          </button>
          <button className="bt vermelho tit" style={{ fontSize: 18, padding: '9px 26px' }} onClick={() => c.comecar()}>
            Começar batalha
          </button>
        </div>
      </div>
    </div>
  )
}

/** Preparação de Haki: 10 s para ligar o Haki de cada pirata. */
function PreparoHaki({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const vivos = b.tripulacao.filter((t) => t.armamento || t.observacao || t.rei)
  return (
    <div className="pn" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', padding: 16, width: 'min(760px, calc(100% - 16px))', maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div className="tit" style={{ fontSize: 24, color: '#9ff4ee' }}>
            Preparação de Haki
          </div>
          <div style={{ fontWeight: 400, color: '#a8b8d0' }}>Ligue (ou não) o Haki de cada pirata antes da batalha. A Marinha também se prepara.</div>
        </div>
        <div className="tit" style={{ fontSize: 42, color: b.tempoHaki <= 3 ? '#ff6a5a' : '#fff3a0', minWidth: 70, textAlign: 'center' }}>
          {b.tempoHaki}
        </div>
      </div>
      {vivos.length === 0 && <div style={{ color: '#a8b8d0', margin: '10px 0' }}>Nenhum pirata tem Haki nesta montagem.</div>}
      {vivos.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid rgba(120,220,230,.15)' }}>
          <div className="quadro" style={{ margin: 0 }}>
            <div className="borda">
              <div className="ret" style={rosto(f.retrato, 74, 58)} />
            </div>
          </div>
          <div className="tit" style={{ width: 110, fontSize: 15 }}>
            {f.nome}
          </div>
          <PainelHaki f={f} c={c} podeRei={false} />
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button className="bt vermelho tit" style={{ fontSize: 18, padding: '9px 30px' }} onClick={() => c.pronto()}>
          Pronto!
        </button>
      </div>
    </div>
  )
}

function ListaSkills({ skills, atual, escolher, fechar }: { skills: SkillHud[]; atual: string | null; escolher: (id: string) => void; fechar: () => void }) {
  return (
    <div className="pn" style={{ width: 340, maxHeight: 360, overflow: 'auto', padding: 8, pointerEvents: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="tit" style={{ fontSize: 16, color: '#9ff4ee' }}>
          Skills
        </span>
        <button className="bt" style={{ padding: '1px 10px' }} onClick={fechar}>
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {skills.map((k) => (
          <button key={k.id} className={`bt sk${atual === k.id ? ' on' : ''}`} disabled={!!k.motivo} title={k.motivo ?? k.descricao} onClick={() => escolher(k.id)}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span className="tit" style={{ color: atual === k.id ? undefined : k.fruta ? '#ffcf5a' : undefined }}>
                {k.nome}
              </span>
              <span>
                <span style={{ color: atual === k.id ? '#1a3a7a' : cor.energia }}>⚡{k.energia}</span>
                {k.espera > 0 && <span style={{ color: '#ffb070', marginLeft: 6 }}>⟳{k.recarga > 0 ? k.recarga : k.espera}</span>}
              </span>
            </span>
            <small>{k.motivo ?? k.descricao}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

export function HudBatalha({ b, c, velocidade, mudarVelocidade }: { b: RetratoBatalha; c: ControleBatalha; velocidade: number; mudarVelocidade: (v: number) => void }) {
  const [verLog, setVerLog] = useState(true)
  const [verSkills, setVerSkills] = useState(false)
  const s = b.selecionado
  const minha = b.fase === 'minha' && !b.animando && !b.auto
  const skill = s?.skills.find((k) => k.id === s.skill)
  const basica = s?.skills.find((k) => k.energia === 0 && k.area === 'alvo')
  const profissao = s?.skills.filter((k) => k.id === 'primeiros-socorros') ?? []
  const escolherSkill = (id: string) => {
    c.escolherSkill(id)
    setVerSkills(false)
  }
  const nomesP = b.tripulacao.map((t) => t.nome)
  const nomesM = b.inimigos.map((t) => t.nome)
  const hora = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  // ordem das vezes: a atual e as próximas (alternando)
  const capP = b.tripulacao[0]
  const capM = b.inimigos[0]
  const ordem = Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? b.vez : b.vez === 'piratas' ? 'marinha' : 'piratas'))
  const faixa = s ?? (b.vez === 'piratas' ? capP : capM)

  return (
    <div className="hud">
      <style>{CSS}</style>
      {b.fase === 'preparar' && <Preparar b={b} c={c} />}

      {b.fase !== 'preparar' && (
        <>
          {/* tripulação */}
          <div style={{ position: 'absolute', left: 8, top: 8, pointerEvents: 'auto' }}>
            {b.tripulacao.map((t) => (
              <Quadro key={t.id} f={t} sel={s?.id === t.id} onClick={minha && t.hp > 0 ? () => c.selecionar(s?.id === t.id ? null : t.id) : undefined} />
            ))}
          </div>

          {/* registro de combate */}
          <div className="pn log" style={{ position: 'absolute', right: 8, top: 8, width: 'min(400px, 40%)', padding: '6px 12px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(120,220,230,.3)', paddingBottom: 4, marginBottom: 4 }}>
              <span className="tit" style={{ fontSize: 13, color: '#9ff4ee', borderBottom: '2px solid #6ff0e8' }}>
                Registro de combate
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className={`bt${b.auto ? ' on' : ''}`} style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => c.alternarAuto()} title="A IA joga pelos piratas também">
                  Auto
                </button>
                <button className="bt" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => mudarVelocidade(velocidade === 1 ? 2 : 1)} title="Velocidade das animações">
                  {velocidade}×
                </button>
                <button className="bt" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => setVerLog(!verLog)}>
                  {verLog ? '▴' : '▾'}
                </button>
              </span>
            </div>
            {verLog && (
              <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 12.5 }} ref={(el) => {
                  if (el) el.scrollTop = el.scrollHeight
                }}>
                {b.log.slice(-12).map((l, i) => (
                  <div key={i}>
                    <span className="h">{hora(l.t)}</span>
                    <Colorido texto={l.texto} piratas={nomesP} marinha={nomesM} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* dica */}
          {b.dica && b.fase !== 'haki' && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', maxWidth: 420, textAlign: 'center', fontSize: 12.5, fontWeight: 400, textShadow: '0 1px 3px #000, 0 0 6px #000' }}>{b.dica}</div>
          )}

          {/* preparação de Haki */}
          {b.fase === 'haki' && <PreparoHaki b={b} c={c} />}

          {/* menu de ações */}
          {s && minha && (
            <div style={{ position: 'absolute', left: 8, bottom: 96, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div className="menu">
                <button className={`op${!s.skill || s.skill === basica?.id ? ' on' : ''}`} onClick={() => basica && escolherSkill(basica.id)} title={basica?.descricao}>
                  <span className="i">⚔</span> Atacar
                </button>
                <button className={`op${verSkills || (skill && skill.id !== basica?.id && !profissao.includes(skill)) ? ' on' : ''}`} onClick={() => setVerSkills(!verSkills)}>
                  <span className="i">🌀</span> Skills
                </button>
                {profissao.map((k) => (
                  <button key={k.id} className={`op${s.skill === k.id ? ' on' : ''}`} disabled={!!k.motivo} title={k.motivo ?? k.descricao} onClick={() => escolherSkill(k.id)}>
                    <span className="i">✚</span> Profissão
                  </button>
                ))}
                <button className="op" onClick={() => c.passar()}>
                  <span className="i">⏭</span> Passar a vez
                </button>
              </div>
              {verSkills && <ListaSkills skills={s.skills.filter((k) => !profissao.includes(k))} atual={s.skill} escolher={escolherSkill} fechar={() => setVerSkills(false)} />}
            </div>
          )}

          {/* painel de Haki (separado das skills) */}
          {s && minha && (s.armamento || s.observacao || s.rei) && (
            <div className="pn" style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', padding: '6px 10px' }}>
              <div className="tit" style={{ fontSize: 12, color: '#9ff4ee', marginBottom: 4 }}>
                Haki — {s.nome}
              </div>
              <PainelHaki f={s} c={c} podeRei={s.podeRei} podeHaoshoku={s.podeHaoshoku} />
            </div>
          )}

          {/* confirmar golpe (toque) */}
          {s && minha && skill && s.previa && (
            <div style={{ position: 'absolute', left: '50%', bottom: 118, transform: 'translateX(-50%)' }}>
              <button className="bt vermelho tit" style={{ fontSize: 17, padding: '9px 26px' }} onClick={() => c.usarPrevia()}>
                ⚔ {skill.nome}
              </button>
            </div>
          )}

          {/* ordem das vezes */}
          {capP && capM && (
            <div style={{ position: 'absolute', left: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="tit" style={{ fontSize: 12, color: '#cfe0f0', marginRight: 4, textShadow: '0 1px 3px #000' }}>
                Ordem
              </span>
              {ordem.map((l, i) => {
                const f = l === 'piratas' ? capP : capM
                const k = i === 0 ? 1.2 : 1
                return (
                  <div
                    key={i}
                    title={l === 'piratas' ? 'Piratas' : 'Marinha'}
                    style={{
                      width: 46 * k,
                      height: 52 * k,
                      clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
                      background: l === 'piratas' ? 'linear-gradient(135deg,#6ff0e8,#1a7a8a)' : 'linear-gradient(135deg,#ff8a7a,#8a1a10)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: i === 0 ? 1 : 0.8,
                    }}
                  >
                    <div style={{ width: 38 * k, height: 44 * k, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', backgroundColor: '#16233a', imageRendering: 'pixelated', ...rosto(f.retrato, 38 * k, 44 * k) }} />
                  </div>
                )
              })}
            </div>
          )}

          {/* faixa da vez */}
          {faixa && b.fase !== 'fim' && (
            <div className="pn" style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 16px', clipPath: 'polygon(6% 0,100% 0,100% 100%,0 100%)' }}>
              <div style={{ textAlign: 'right' }}>
                <div className="tit" style={{ fontSize: 20, color: b.vez === 'piratas' ? '#fff' : '#ffc0b8' }}>
                  {b.fase === 'haki' ? 'Preparação' : b.vez === 'piratas' ? (s ? `Vez de ${s.nome}` : 'Sua vez') : 'Vez da Marinha'}
                </div>
                <div style={{ fontSize: 12, color: '#6ff0e8' }}>
                  {b.fase === 'haki' ? `Haki — ${b.tempoHaki}s` : b.fase === 'minha' ? `Fase de ação · ${b.tempo}s` : 'Marinha agindo…'}
                </div>
                {b.fase === 'minha' && (
                  <div style={{ fontSize: 11, marginTop: 2 }} title="Movimentos da tripulação nesta vez">
                    👣 <Pips n={b.movimento} max={MOVIMENTO_POR_VEZ} c="#8ac4ff" />
                  </div>
                )}
              </div>
              <div className="quadro" style={{ margin: 0 }}>
                <div className="borda" style={{ background: b.vez === 'piratas' ? undefined : 'linear-gradient(135deg,#ff8a7a,#8a1a10)' }}>
                  <div className="ret" style={rosto(faixa.retrato, 74, 58)} />
                </div>
              </div>
            </div>
          )}

          {/* fim */}
          {b.fase === 'fim' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
              <div className="pn" style={{ padding: '24px 44px', textAlign: 'center' }}>
                <div className="tit" style={{ fontSize: 46, color: b.vencedor === 'piratas' ? '#fff3a0' : '#ff8a7a', textShadow: '0 3px 0 #000' }}>
                  {b.vencedor === 'piratas' ? 'Vitória!' : 'Derrota'}
                </div>
                <div style={{ margin: '6px 0 14px' }}>{b.turno} vezes</div>
                <button className="bt vermelho tit" style={{ fontSize: 18, padding: '9px 26px' }} onClick={() => c.novaBatalha()}>
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
