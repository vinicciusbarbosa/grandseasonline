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
.hud .quadro.dir { flex-direction:row-reverse; }
.hud .quadro.dir .info { margin-left:0; margin-right:-8px; padding:4px 16px 5px 10px; background:linear-gradient(270deg, rgba(26,6,10,.9) 60%, rgba(26,6,10,0)); text-align:right; }
.hud .quadro.dir .borda { background:linear-gradient(135deg,#ff8a7a,#8a1a10); clip-path:polygon(0 0,86% 0,100% 100%,14% 100%); }
.hud .quadro.dir .ret { clip-path:polygon(0 0,86% 0,100% 100%,14% 100%); }
.hud .hk { display:grid; grid-template-columns:repeat(2, 30px); gap:3px; margin-left:4px; }
.hud .hkb { pointer-events:auto; width:30px; height:22px; font:700 11px 'Cinzel', Georgia, serif; color:#cfd8e8; cursor:pointer; position:relative;
  border:1px solid rgba(255,255,255,.25); background:rgba(10,16,30,.85); clip-path:polygon(18% 0,100% 0,82% 100%,0 100%); }
.hud .hkb:disabled { opacity:.3; cursor:default; }
.hud .hkb small { position:absolute; right:3px; bottom:0; font:600 8px sans-serif; color:#fff; }
.hud .log { opacity:.38; transition:opacity .2s; }
.hud .log:hover { opacity:1; }
.hud .cartas { display:flex; gap:8px; pointer-events:auto; overflow-x:auto; padding:4px 2px 2px; max-width:calc(100vw - 16px); }
.hud .carta { flex:none; width:188px; min-height:128px; text-align:left; padding:0; cursor:pointer; font:inherit; color:#eaf6ff; border:1px solid rgba(120,220,230,.35);
  background:linear-gradient(180deg, rgba(16,28,50,.96), rgba(8,12,24,.96)); clip-path:polygon(0 0,100% 0,100% 88%,92% 100%,0 100%); transition:transform .12s, box-shadow .12s; }
.hud .carta:hover:not(:disabled) { transform:translateY(-6px); box-shadow:0 0 16px rgba(111,240,232,.5); }
.hud .carta:disabled { opacity:.45; cursor:default; }
.hud .carta.on { border-color:#fff3a0; box-shadow:0 0 18px rgba(255,243,160,.7); transform:translateY(-6px); }
.hud .carta .topo { height:5px; }
.hud .carta .corpo { padding:7px 10px 8px; }
.hud .carta .tags { display:flex; flex-wrap:wrap; gap:4px; margin:5px 0; }
.hud .carta .tag { font:600 10px sans-serif; padding:1px 5px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); }
.hud .carta p { margin:0; font-weight:400; font-size:11.5px; line-height:1.3; color:#b8c6dc; }
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

/** Botões de Haki no quadro do pirata (liga/desliga direto, sem abrir menu). */
function BotoesHaki({ f, c, ativo }: { f: FichaHud; c: ControleBatalha; ativo: boolean }) {
  const b = (letra: string, titulo: string, corB: string, ligado: boolean, pode: boolean, clique: () => void, usos?: number) => (
    <button
      className="hkb"
      title={titulo}
      disabled={!ativo || (!pode && !ligado)}
      onClick={(ev) => {
        ev.stopPropagation()
        clique()
      }}
      style={ligado ? { color: '#fff', borderColor: corB, background: `linear-gradient(180deg, ${corB}, ${corB}66)`, boxShadow: `0 0 10px ${corB}` } : { color: corB }}
    >
      {letra}
      {usos !== undefined && <small>{usos}</small>}
    </button>
  )
  if (!f.armamento && !f.observacao && !f.rei) return null
  return (
    <div className="hk">
      {f.armamento && b('A', `Haki de armamento${f.armamento.avancado ? ' avançado' : ''} (${f.armamento.usos}/${f.armamento.max} usos): liga/desliga, não gasta a vez`, cor.arm, f.armamento.ligado, f.armamento.usos > 0, () => c.alternarArmamento(f.id), f.armamento.usos)}
      {f.rei && f.armamento?.avancado && b('R', 'Haki do Rei imbuído: liga/desliga (40 de espírito por ataque)', cor.rei, f.rei.ligado, f.podeRei, () => c.alternarRei(f.id))}
      {f.observacao && b('O', `Haki de observação${f.observacao.avancado ? ' avançado' : ''} (${f.observacao.usos}/${f.observacao.max} usos): liga/desliga`, cor.obs, f.observacao.ligado, f.observacao.usos > 0, () => c.observar(f.id), f.observacao.usos)}
      {f.rei && b('✦', 'Haki do Rei em área (70 de espírito): atordoa na próxima vez quem ele pegar; não gasta a vez', '#ff6a5a', false, f.podeHaoshoku, () => c.haoshoku(f.id))}
    </div>
  )
}

function Quadro({ f, sel, onClick, direita, c, ativo }: { f: FichaHud; sel?: boolean; onClick?: () => void; direita?: boolean; c?: ControleBatalha; ativo?: boolean }) {
  const morto = f.hp <= 0
  return (
    <div className={`quadro${sel ? ' sel' : ''}${onClick ? ' clic' : ''}${morto ? ' morto' : ''}${direita ? ' dir' : ''}`} onClick={onClick}>
      <div className="borda">
        <div className="ret" style={rosto(f.retrato, 74, 58)} />
      </div>
      <div className="info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexDirection: direita ? 'row-reverse' : 'row' }}>
          <span className="tit" style={{ fontSize: 15 }}>
            {f.nome}
          </span>
          <Icones f={f} />
        </div>
        <div className="linha">
          <b>HP</b>
          <Barra v={f.hp} max={f.hpMax} c={f.hp / f.hpMax > 0.35 ? (direita ? '#ff6a4a' : cor.vida) : cor.vidaBaixa} c2={f.hp / f.hpMax > 0.35 ? (direita ? '#a0200a' : cor.vida2) : '#a02010'} />
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
      {c && !morto && <BotoesHaki f={f} c={c} ativo={!!ativo} />}
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

const AREA: Record<string, string> = { alvo: '1 alvo', linha: 'em linha', leque: 'leque', volta: 'em volta', si: 'em si', mapa: 'mapa inteiro' }
const areaDe = (k: SkillHud) => (k.area === 'explosao' ? `área ${k.raio * 2 + 1}×${k.raio * 2 + 1}` : AREA[k.area] ?? k.area)

/** Cartas das skills na parte de baixo da tela, com a descrição. */
function CartasSkills({ skills, atual, escolher }: { skills: SkillHud[]; atual: string | null; escolher: (id: string) => void }) {
  return (
    <div className="cartas">
      {skills.map((k) => {
        const faixa = k.livre ? 'linear-gradient(90deg,#7dff8a,#2a9a4a)' : k.fruta ? 'linear-gradient(90deg,#ffd35a,#d0701a)' : 'linear-gradient(90deg,#6ff0e8,#1a7a8a)'
        return (
          <button key={k.id} className={`carta${atual === k.id ? ' on' : ''}`} disabled={!!k.motivo} title={k.motivo ?? ''} onClick={() => escolher(k.id)}>
            <div className="topo" style={{ background: faixa }} />
            <div className="corpo">
              <div className="tit" style={{ fontSize: 14, color: k.fruta ? '#ffe08a' : '#fff' }}>
                {k.nome}
              </div>
              <div className="tags">
                <span className="tag" style={{ color: cor.energia }}>⚡ {k.energia}</span>
                {k.espera > 0 && <span className="tag" style={{ color: '#ffb070' }}>⟳ {k.recarga > 0 ? `${k.recarga} (espera)` : k.espera}</span>}
                {k.alcance > 0 && <span className="tag">alcance {k.alcance}</span>}
                <span className="tag">{areaDe(k)}</span>
                {k.livre && <span className="tag" style={{ color: '#7dff8a' }}>não gasta a vez</span>}
              </div>
              <p>{k.motivo ? <span style={{ color: '#ff9a8a' }}>{k.motivo}</span> : k.descricao}</p>
            </div>
          </button>
        )
      })}
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

  return (
    <div className="hud">
      <style>{CSS}</style>
      {b.fase === 'preparar' && <Preparar b={b} c={c} />}

      {b.fase !== 'preparar' && (
        <>
          {/* tripulação (com os botões de Haki) */}
          <div style={{ position: 'absolute', left: 8, top: 8, pointerEvents: 'auto' }}>
            {b.tripulacao.map((t) => (
              <Quadro key={t.id} f={t} c={c} ativo={minha} sel={s?.id === t.id} onClick={minha && t.hp > 0 ? () => c.selecionar(s?.id === t.id ? null : t.id) : undefined} />
            ))}
          </div>

          {/* Marinha */}
          <div style={{ position: 'absolute', right: 8, top: 8, pointerEvents: 'auto' }}>
            {b.inimigos.map((t) => (
              <Quadro key={t.id} f={t} direita />
            ))}
          </div>

          {/* vez: topo central */}
          {b.fase !== 'fim' && (
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div
                className="tit"
                style={{
                  fontSize: 26,
                  padding: '2px 44px',
                  color: b.fase === 'haki' ? '#fff3a0' : b.vez === 'piratas' ? '#eafffd' : '#ffd0c8',
                  background:
                    b.vez === 'piratas' || b.fase === 'haki'
                      ? 'linear-gradient(90deg, transparent, rgba(20,110,120,.85) 22%, rgba(20,110,120,.85) 78%, transparent)'
                      : 'linear-gradient(90deg, transparent, rgba(130,20,20,.85) 22%, rgba(130,20,20,.85) 78%, transparent)',
                  textShadow: '0 2px 0 #000',
                  whiteSpace: 'nowrap',
                }}
              >
                {b.fase === 'haki' ? 'Preparação' : b.vez === 'piratas' ? 'Sua vez' : 'Vez da Marinha'}
              </div>
              {b.fase === 'minha' && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 4, fontSize: 12.5, textShadow: '0 1px 3px #000' }}>
                  <span title="Passos da tripulação nesta vez">
                    👣 <Pips n={b.movimento} max={MOVIMENTO_POR_VEZ} c="#8ae8ff" /> {b.movimento} {b.movimento === 1 ? 'passo' : 'passos'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 70 }}>
                      <Barra v={b.tempo} max={b.tempoMax} c={b.tempo <= 20 ? '#ff5a4a' : '#fff3a0'} />
                    </span>
                    <span style={{ color: b.tempo <= 20 ? '#ff7a6a' : undefined }}>{b.tempo}s</span>
                  </span>
                </div>
              )}
              {b.fase === 'inimiga' && <div style={{ fontSize: 12, marginTop: 3, color: '#ffc0b8', textShadow: '0 1px 3px #000' }}>Marinha agindo…</div>}
            </div>
          )}

          {/* preparação de Haki */}
          {b.fase === 'haki' && <PreparoHaki b={b} c={c} />}

          {/* menu de ações */}
          {s && minha && (
            <div className="menu" style={{ position: 'absolute', left: 8, bottom: 8 }}>
              <button className={`op${!s.skill || s.skill === basica?.id ? ' on' : ''}`} onClick={() => basica && escolherSkill(basica.id)} title={basica?.descricao}>
                <span className="i">⚔</span> Atacar
              </button>
              <button className={`op${verSkills || (skill && skill.id !== basica?.id && !profissao.includes(skill)) ? ' on' : ''}`} onClick={() => setVerSkills(!verSkills)}>
                <span className="i">🌀</span> Skills {verSkills ? '▾' : '▴'}
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
          )}

          {/* skills: cartas na parte de baixo */}
          {s && minha && verSkills && (
            <div style={{ position: 'absolute', left: 250, right: 8, bottom: 8, display: 'flex', justifyContent: 'center' }}>
              <CartasSkills skills={s.skills.filter((k) => !profissao.includes(k))} atual={s.skill} escolher={escolherSkill} />
            </div>
          )}

          {/* confirmar golpe (toque) */}
          {s && minha && skill && s.previa && !verSkills && (
            <div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)' }}>
              <button className="bt vermelho tit" style={{ fontSize: 17, padding: '9px 26px' }} onClick={() => c.usarPrevia()}>
                ⚔ {skill.nome}
              </button>
            </div>
          )}

          {/* registro de combate: translúcido, aparece ao passar o mouse */}
          {!(s && minha && verSkills) && (
            <div className="pn log" style={{ position: 'absolute', right: 8, bottom: 8, width: 'min(400px, 42%)', padding: '6px 12px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: verLog ? '1px solid rgba(120,220,230,.3)' : 'none', paddingBottom: verLog ? 4 : 0, marginBottom: verLog ? 4 : 0 }}>
                <span className="tit" style={{ fontSize: 13, color: '#9ff4ee' }}>
                  Registro de combate
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button className={`bt${b.auto ? ' on' : ''}`} style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => c.alternarAuto()} title="A IA joga pelos piratas também">
                    Auto
                  </button>
                  <button className="bt" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => mudarVelocidade(velocidade === 1 ? 2 : 1)} title="Velocidade das animações">
                    {velocidade}×
                  </button>
                  <button className="bt" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => setVerLog(!verLog)} title={verLog ? 'Minimizar' : 'Mostrar'}>
                    {verLog ? '▾' : '▴'}
                  </button>
                </span>
              </div>
              {verLog && (
                <div
                  style={{ maxHeight: 130, overflow: 'auto', fontSize: 12.5 }}
                  ref={(el) => {
                    if (el) el.scrollTop = el.scrollHeight
                  }}
                >
                  {b.log.slice(-12).map((l, i) => (
                    <div key={i}>
                      <span className="h">{hora(l.t)}</span>
                      <Colorido texto={l.texto} piratas={nomesP} marinha={nomesM} />
                    </div>
                  ))}
                </div>
              )}
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
