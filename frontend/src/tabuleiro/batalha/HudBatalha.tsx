import { useState } from 'react'
import type { ControleBatalha, FichaHud, RetratoBatalha, SkillHud } from './controle'
import { MOVIMENTO_POR_VEZ } from './regras'

/**
 * HUD da batalha com a cara de Grand Seas (One Piece, náutico):
 *   laterais      — retratos em escotilhas com aro de latão, placas de madeira
 *                   com vida/energia/espírito; a escotilha ganha um contorno
 *                   de Haki do Rei animado quando o Rei (imbuído ou em área)
 *                   está liberado para aquele pirata;
 *   topo          — faixa de pergaminho "Sua vez" com ampulheta e pegadas;
 *   esquerda      — tábuas de ação: Haki, Atacar, Skills, Profissão, Passar;
 *   baixo         — bandeja de Haki (interruptores) ou pergaminho de skills;
 *   inferior dir. — diário de bordo (translúcido, aparece ao passar o mouse);
 *   preparação    — 10 s para ligar o Haki antes da batalha.
 */

const CSS = `
.hud { position:absolute; inset:0; pointer-events:none; font:600 13px/1.25 'Trebuchet MS', system-ui, sans-serif; color:#f6ead0; }
.hud * { box-sizing:border-box; }
.hud .tit { font-family:'Pirata One', 'Cinzel', Georgia, serif; font-weight:400; letter-spacing:.6px; }
.hud .serif { font-family:'Cinzel', Georgia, serif; font-weight:700; }

/* madeira escura com moldura de latão */
.hud .madeira { pointer-events:auto; color:#f6ead0;
  background:
    repeating-linear-gradient(92deg, rgba(255,255,255,.025) 0 2px, transparent 2px 9px),
    linear-gradient(180deg, #3a2414, #24160c);
  border:2px solid #c9a24a; box-shadow:0 0 0 1px #3a2408, inset 0 0 0 1px rgba(255,220,140,.25), inset 0 0 18px rgba(0,0,0,.6), 0 8px 20px rgba(0,0,0,.55); border-radius:6px; }
/* pergaminho */
.hud .pergaminho { pointer-events:auto; color:#3a2410;
  background: radial-gradient(ellipse at 30% 20%, #fbf1d6, #efdcae 60%, #dcc18a);
  border:1px solid #8a6a3a; box-shadow: inset 0 0 22px rgba(120,80,30,.45), 0 8px 20px rgba(0,0,0,.5); }

/* quadro de personagem: escotilha + placa */
.hud .quadro { display:flex; align-items:center; margin-bottom:6px; pointer-events:auto; position:relative; }
.hud .quadro.dir { flex-direction:row-reverse; }
.hud .escotilha { position:relative; flex:none; width:66px; height:66px; border-radius:50%; z-index:1;
  background: radial-gradient(circle at 35% 30%, #fff1b0, #d6a640 45%, #8a5a18 80%); box-shadow:0 2px 6px rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; }
.hud .escotilha::after { content:''; position:absolute; inset:0; border-radius:50%;
  background: radial-gradient(circle at 50% 4%, #3a2408 2.5px, transparent 3px), radial-gradient(circle at 96% 50%, #3a2408 2.5px, transparent 3px),
              radial-gradient(circle at 50% 96%, #3a2408 2.5px, transparent 3px), radial-gradient(circle at 4% 50%, #3a2408 2.5px, transparent 3px); }
.hud .vidro { width:54px; height:54px; border-radius:50%; background-color:#1a3a5a; background-repeat:no-repeat; image-rendering:pixelated;
  box-shadow: inset 0 0 0 2px #3a2408, inset 0 -8px 12px rgba(0,0,0,.35); }
.hud .quadro.sel .escotilha { background: radial-gradient(circle at 35% 30%, #ffffff, #fff08a 40%, #d0a020 80%); box-shadow:0 0 14px #ffe070; }
.hud .quadro.dir .escotilha { background: radial-gradient(circle at 35% 30%, #f0f0f0, #a8b0c0 45%, #505868 80%); }
.hud .quadro.morto { opacity:.4; filter:grayscale(1); }
.hud .quadro.clic { cursor:pointer; }
.hud .quadro.clic:hover .placa { filter:brightness(1.2); }
.hud .placa { margin-left:-14px; padding:5px 10px 6px 20px; width:218px; border-radius:0 8px 8px 0;
  background: repeating-linear-gradient(92deg, rgba(255,255,255,.03) 0 2px, transparent 2px 10px), linear-gradient(90deg, #4a2c16, #2e1a0c);
  border:1px solid #c9a24a; border-left:none; box-shadow: inset 0 0 10px rgba(0,0,0,.6), 0 3px 8px rgba(0,0,0,.5); }
.hud .quadro.dir .placa { margin-left:0; margin-right:-14px; padding:5px 20px 6px 10px; border-radius:8px 0 0 8px; border-left:1px solid #9aa8c0; border-right:none;
  background: repeating-linear-gradient(92deg, rgba(255,255,255,.03) 0 2px, transparent 2px 10px), linear-gradient(270deg, #1c2c4a, #101a2e); border-color:#9aa8c0; text-align:right; }
.hud .linha { display:flex; align-items:center; gap:5px; font-size:10.5px; }
.hud .quadro.dir .linha { flex-direction:row-reverse; }
.hud .linha b { width:16px; font-size:9.5px; color:#e8c878; }
.hud .barra { flex:1; height:8px; border-radius:4px; background:#140a04; border:1px solid #8a6a2a; overflow:hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.8); }
.hud .barra.fina { height:5px; }
.hud .barra > i { display:block; height:100%; border-radius:3px; transition:width .3s; box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
.hud .num { min-width:54px; text-align:right; font-size:10.5px; color:#f6ead0; }
.hud .ico { display:inline-block; min-width:16px; height:15px; padding:0 3px; margin:0 1px; border-radius:8px; font-size:10px; line-height:14px; text-align:center; font-weight:700; }

/* Haki do Rei liberado: contorno animado na escotilha */
@keyframes giroRei { to { transform: rotate(360deg) } }
@keyframes pulsoRei { 0%,100% { opacity:.55; transform:scale(1) } 50% { opacity:1; transform:scale(1.06) } }
.hud .quadro.rei .escotilha::before { content:''; position:absolute; inset:-6px; border-radius:50%; z-index:-1;
  background: conic-gradient(from 0deg, #000 0deg, #ff1030 40deg, #1a0003 80deg, #ff3a4a 130deg, #000 170deg, #e0102a 220deg, #0a0002 260deg, #ff1030 310deg, #000 360deg);
  animation: giroRei 1.6s linear infinite; filter: drop-shadow(0 0 8px #ff1030); }
.hud .quadro.rei .etiqueta { position:absolute; bottom:-7px; left:2px; z-index:2; font:400 12px 'Pirata One', Georgia, serif; color:#fff; padding:0 7px;
  background:linear-gradient(90deg,#8a0010,#e0102a); border:1px solid #ff8a9a; border-radius:3px; box-shadow:0 0 10px #ff1030; animation: pulsoRei 1s ease-in-out infinite; white-space:nowrap; }

/* tábuas de ação */
.hud .menu { display:flex; flex-direction:column; gap:5px; pointer-events:auto; }
.hud .tabua { pointer-events:auto; position:relative; width:210px; display:flex; align-items:center; gap:10px; padding:8px 16px 8px 22px; cursor:pointer;
  font:400 20px 'Pirata One', Georgia, serif; letter-spacing:.6px; color:#f6ead0; text-shadow:0 2px 0 #000;
  background: repeating-linear-gradient(90deg, rgba(0,0,0,.12) 0 1px, transparent 1px 14px), linear-gradient(180deg, #7a4a24, #5a3418 55%, #432610);
  border:1px solid #2a1606; border-radius:4px; box-shadow: inset 0 1px 0 rgba(255,220,160,.25), 0 3px 0 #1e0f04, 0 5px 10px rgba(0,0,0,.45); transition: transform .1s, filter .12s; }
.hud .tabua::before, .hud .tabua::after { content:''; position:absolute; top:50%; width:7px; height:7px; margin-top:-3.5px; border-radius:50%;
  background: radial-gradient(circle at 35% 30%, #fff1b0, #b88a2a 60%, #5a3a0a); }
.hud .tabua::before { left:7px } .hud .tabua::after { right:7px }
.hud .tabua:hover:not(:disabled) { transform: translateX(5px); filter:brightness(1.18); }
.hud .tabua.on { background: repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 1px, transparent 1px 14px), linear-gradient(180deg, #e8c060, #c9962e 55%, #9a6a18); color:#2a1606; text-shadow:0 1px 0 rgba(255,255,255,.4); }
.hud .tabua:disabled { opacity:.45; cursor:default; }
.hud .tabua .i { width:26px; text-align:center; font-size:19px; }
.hud .tabua.haki { background: repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 14px), linear-gradient(180deg, #3a1a4a, #22102e); border-color:#8a4ac0; }
.hud .tabua.haki.on { background: linear-gradient(180deg, #b070ff, #6a2ab0); color:#fff; text-shadow:0 1px 0 #000; }
.hud .tabua.haki.alerta { box-shadow: 0 0 0 1px #ff3a4a, 0 0 14px #ff1030, 0 3px 0 #1e0f04; }

/* botões pequenos */
.hud .bt { pointer-events:auto; font:inherit; color:#f6ead0; cursor:pointer; border:1px solid #c9a24a; border-radius:4px; background:linear-gradient(180deg,#5a3418,#3a2010); padding:6px 12px; transition: filter .12s; }
.hud .bt:hover:not(:disabled) { filter:brightness(1.3); }
.hud .bt:disabled { opacity:.45; cursor:default; }
.hud .bt.on { background:linear-gradient(180deg,#e8c060,#b8862a); color:#2a1606; }
.hud .bt.vermelho { border-color:#ff9a7a; background:linear-gradient(180deg,#b0281a,#6a0e06); color:#fff; }

/* bandeja inferior (skills / Haki) */
.hud .bandeja { pointer-events:auto; padding:10px 14px 12px; border-radius:6px; }
.hud .bandeja .cab { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.hud .grade { display:grid; grid-template-columns:repeat(auto-fill, minmax(176px, 1fr)); gap:8px; }
.hud .carta { text-align:left; cursor:pointer; font:inherit; padding:8px 10px 9px; border-radius:4px; display:flex; flex-direction:column; gap:4px; min-height:118px;
  color:#3a2410; background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0)), #f3e3bb; border:1px solid #9a7a4a;
  box-shadow: inset 0 0 12px rgba(140,100,40,.35), 0 2px 0 #7a5a2a; transition: transform .12s, box-shadow .12s; }
.hud .carta:hover:not(:disabled) { transform: translateY(-3px); box-shadow: inset 0 0 12px rgba(140,100,40,.35), 0 6px 12px rgba(0,0,0,.35); }
.hud .carta.on { background:#fff6d8; border-color:#b0201a; box-shadow: 0 0 0 2px #b0201a, 0 6px 14px rgba(0,0,0,.35); }
.hud .carta:disabled { opacity:.5; cursor:default; filter:sepia(.4); }
.hud .carta .nome { font:400 17px 'Pirata One', Georgia, serif; color:#2a1606; line-height:1.05; }
.hud .carta .selo { display:inline-flex; align-items:center; gap:3px; font:700 10px sans-serif; padding:1px 6px; border-radius:10px; }
.hud .carta p { margin:0; font:400 11.5px/1.3 Georgia, serif; color:#4a3018; }
.hud .carta.hakic { color:#f6ead0; background: linear-gradient(180deg, #2a1834, #160c1e); border-color:#6a4a8a; box-shadow: inset 0 0 12px rgba(0,0,0,.5); }
.hud .carta.hakic .nome { color:#fff; }
.hud .carta.hakic p { color:#d8c8e8; }

/* diário de bordo */
.hud .diario { opacity:.4; transition: opacity .2s; }
.hud .diario:hover { opacity:1; }
.hud .diario .ent { padding:2px 0; border-bottom:1px dashed rgba(120,80,30,.35); font:400 12.5px/1.3 Georgia, serif; }
.hud .diario .h { color:#8a6a3a; margin-right:8px; font-variant-numeric:tabular-nums; }
@media (max-height: 620px) { .hud .escotilha { width:52px; height:52px } .hud .vidro { width:42px; height:42px } .hud .tabua { font-size:16px; padding:5px 14px 5px 20px; width:180px } .hud .placa { width:190px } }
`

const cor = { vida: '#5ad65a', vidaBaixa: '#ff5a3a', energia: '#4aa8ff', espirito: '#ff3a5a', arm: '#b070ff', rei: '#ff2a3a', obs: '#7fd8ff', pirata: '#8fe0a0', marinha: '#ff8a7a' }

function Barra({ v, max, c, fina }: { v: number; max: number; c: string; fina?: boolean }) {
  return (
    <div className={`barra${fina ? ' fina' : ''}`}>
      <i style={{ width: `${(100 * Math.max(0, v)) / max}%`, background: `linear-gradient(180deg, ${c}, ${c}bb)` }} />
    </div>
  )
}

/** Rosto do personagem: recorte da cabeça na folha parada (quadro 128×128). */
function rosto(url: string, l: number): React.CSSProperties {
  const k = l / 50
  return { backgroundImage: `url(${url})`, backgroundSize: `${128 * k}px ${128 * k}px`, backgroundPosition: `${-39 * k}px ${-22 * k}px` }
}

function Pips({ n, max, c, forma = 'losango' }: { n: number; max: number; c: string; forma?: 'losango' | 'circulo' }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ width: 8, height: 8, background: i < n ? c : 'rgba(0,0,0,.35)', border: '1px solid rgba(0,0,0,.6)', borderRadius: forma === 'circulo' ? '50%' : 0, transform: forma === 'losango' ? 'rotate(45deg)' : undefined }} />
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
        <span key={titulo} className="ico" title={titulo} style={{ background: `${c}30`, color: c, border: `1px solid ${c}` }}>
          {t}
        </span>
      ))}
    </span>
  )
}

/** O Haki do Rei (imbuído ou em área) está liberado para este pirata? */
const reiLiberado = (f: FichaHud) => f.hp > 0 && ((f.podeRei && !f.rei?.ligado) || f.podeHaoshoku)

function Quadro({ f, sel, onClick, direita }: { f: FichaHud; sel?: boolean; onClick?: () => void; direita?: boolean }) {
  const morto = f.hp <= 0
  const rei = !direita && reiLiberado(f)
  return (
    <div className={`quadro${sel ? ' sel' : ''}${onClick ? ' clic' : ''}${morto ? ' morto' : ''}${direita ? ' dir' : ''}${rei ? ' rei' : ''}`} onClick={onClick}>
      {rei && <span className="etiqueta" title="Haki do Rei liberado: use no botão Haki">Haki do Rei!</span>}
      <div className="escotilha">
        <div className="vidro" style={rosto(f.retrato, 54)} />
      </div>
      <div className="placa">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: direita ? 'row-reverse' : 'row', marginBottom: 2 }}>
          <span className="tit" style={{ fontSize: 17, color: direita ? '#dde6f6' : '#ffe8b0' }}>
            {f.nome}
          </span>
          <Icones f={f} />
        </div>
        <div className="linha">
          <b>HP</b>
          <Barra v={f.hp} max={f.hpMax} c={f.hp / f.hpMax > 0.35 ? (direita ? '#ff6a4a' : cor.vida) : cor.vidaBaixa} />
          <span className="num">
            {Math.max(0, f.hp)}/{f.hpMax}
          </span>
        </div>
        <div className="linha">
          <b>EN</b>
          <Barra v={f.energia} max={100} c={cor.energia} fina />
          <span className="num">{f.energia}</span>
        </div>
        <div className="linha" title="Espírito (Haki do Rei)">
          <b style={{ color: '#ff8a9a' }}>ES</b>
          <Barra v={f.espirito} max={100} c={cor.espirito} fina />
          <span className="num">{f.espirito}</span>
        </div>
      </div>
    </div>
  )
}

/** Cartas de Haki (bandeja escura): cada uma liga/desliga um Haki. */
function CartasHaki({ f, c, preparo }: { f: FichaHud; c: ControleBatalha; preparo?: boolean }) {
  const carta = (chave: string, nome: string, desc: string, corH: string, ligado: boolean, pode: boolean, clique: () => void, extra: React.ReactNode, acao = false) => (
    <button
      key={chave}
      className="carta hakic"
      disabled={!pode && !ligado}
      onClick={clique}
      style={ligado ? { borderColor: corH, boxShadow: `0 0 0 1px ${corH}, 0 0 18px ${corH}88` } : undefined}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="nome" style={{ color: ligado ? corH : '#fff' }}>
          {nome}
        </span>
        {!acao && (
          <span className="selo" style={{ background: ligado ? corH : 'rgba(255,255,255,.1)', color: ligado ? '#000' : '#bbb' }}>
            {ligado ? 'LIGADO' : 'desligado'}
          </span>
        )}
      </span>
      <span>{extra}</span>
      <p>{desc}</p>
    </button>
  )
  return (
    <div className="grade">
      {f.armamento &&
        carta(
          'arm',
          f.armamento.avancado ? 'Armamento avançado' : 'Haki de armamento',
          `Braço e arma negros: ${f.armamento.avancado ? '×1,55 e fura 35% da defesa' : '×1,4 e fura 15% da defesa'}; toca a Logia. Gasta 1 uso por ataque; recupera com espírito.`,
          cor.arm,
          f.armamento.ligado,
          f.armamento.usos > 0,
          () => c.alternarArmamento(f.id),
          <>
            <Pips n={f.armamento.usos} max={f.armamento.max} c={cor.arm} /> <small style={{ color: '#c8b8e0' }}>usos</small>
          </>,
        )}
      {f.rei &&
        f.armamento?.avancado &&
        carta(
          'rei',
          'Rei imbuído',
          'O Haki do Rei na arma: dano ×1,35, pode atordoar e chocar com outro Rei. Gasta 40 de espírito por ataque.',
          cor.rei,
          f.rei.ligado,
          f.podeRei,
          () => c.alternarRei(f.id),
          <small style={{ color: '#ffb0b8' }}>✦ 40 de espírito por ataque (tem {f.espirito})</small>,
        )}
      {f.observacao &&
        carta(
          'obs',
          f.observacao.avancado ? 'Observação avançada' : 'Haki de observação',
          `Prevê os golpes: chance de esquivar de todos os hits de um ataque (1 uso por ataque recebido)${f.observacao.avancado ? ' e revida de perto' : ''}.`,
          cor.obs,
          f.observacao.ligado,
          f.observacao.usos > 0,
          () => c.observar(f.id),
          <>
            <Pips n={f.observacao.usos} max={f.observacao.max} c={cor.obs} /> <small style={{ color: '#b8e0f0' }}>usos</small>
          </>,
        )}
      {f.rei &&
        !preparo &&
        carta(
          'area',
          'Haki do Rei em área',
          'Solta a vontade do Rei: quem estiver perto e for mais fraco fica atordoado na próxima vez. Não gasta a vez.',
          '#ff5a3a',
          false,
          f.podeHaoshoku,
          () => c.haoshoku(f.id),
          <small style={{ color: '#ffb0b8' }}>✦ 70 de espírito (tem {f.espirito})</small>,
          true,
        )}
    </div>
  )
}

const AREA: Record<string, string> = { alvo: '1 alvo', linha: 'em linha', leque: 'leque', volta: 'em volta', si: 'em si', mapa: 'mapa inteiro' }
const areaDe = (k: SkillHud) => (k.area === 'explosao' ? `área ${k.raio * 2 + 1}×${k.raio * 2 + 1}` : AREA[k.area] ?? k.area)

/** Cartas das skills (pergaminho), com custo, recarga, alcance e descrição. */
function CartasSkills({ skills, atual, escolher }: { skills: SkillHud[]; atual: string | null; escolher: (id: string) => void }) {
  return (
    <div className="grade">
      {skills.map((k) => (
        <button key={k.id} className={`carta${atual === k.id ? ' on' : ''}`} disabled={!!k.motivo} title={k.motivo ?? ''} onClick={() => escolher(k.id)}>
          <span className="nome" style={{ color: k.fruta ? '#8a3a08' : undefined }}>
            {k.fruta ? '🍎 ' : ''}
            {k.nome}
          </span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span className="selo" style={{ background: '#1a4a8a', color: '#fff' }}>⚡ {k.energia}</span>
            {k.espera > 0 && <span className="selo" style={{ background: k.recarga > 0 ? '#8a1a10' : '#8a5a1a', color: '#fff' }}>⟳ {k.recarga > 0 ? `espera ${k.recarga}` : k.espera}</span>}
            {k.alcance > 0 && <span className="selo" style={{ background: 'rgba(58,36,16,.15)' }}>alcance {k.alcance}</span>}
            <span className="selo" style={{ background: 'rgba(58,36,16,.15)' }}>{areaDe(k)}</span>
            {k.livre && <span className="selo" style={{ background: '#2a7a3a', color: '#fff' }}>não gasta a vez</span>}
          </span>
          <p>{k.motivo ? <b style={{ color: '#a01a10' }}>{k.motivo}</b> : k.descricao}</p>
        </button>
      ))}
    </div>
  )
}

/** Texto do diário com os nomes coloridos (piratas verde, Marinha vermelho). */
function Colorido({ texto, piratas, marinha }: { texto: string; piratas: string[]; marinha: string[] }) {
  const nomes = [...piratas.map((n) => [n, '#1a6a2a'] as const), ...marinha.map((n) => [n, '#a01a10'] as const)].sort((a, b) => b[0].length - a[0].length)
  const re = new RegExp(`(${nomes.map(([n]) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return (
    <>
      {texto.split(re).map((p, i) => {
        const n = nomes.find(([x]) => x === p)
        return n ? (
          <b key={i} style={{ color: n[1] }}>
            {p}
          </b>
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
  const sel: React.CSSProperties = { font: 'inherit', fontSize: 12, background: '#fbf1d6', color: '#3a2410', border: '1px solid #8a6a3a', padding: '3px' }
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.55)', pointerEvents: 'auto' }}>
      <div className="pergaminho" style={{ padding: '18px 22px', borderRadius: 6, maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
        <div className="tit" style={{ fontSize: 34, textAlign: 'center', color: '#8a1a10' }}>
          ☠ Montar as tripulações ⚓
        </div>
        <div style={{ font: '400 13px Georgia, serif', color: '#5a3a1a', margin: '2px 0 12px', maxWidth: 600, textAlign: 'center' }}>
          Teste: escolha a Akuma no Mi e o Haki de cada um. Depois de começar, há 10 s para ligar o Haki antes da batalha.
        </div>
        <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
          <thead>
            <tr style={{ color: '#7a5a2a', fontSize: 11 }}>
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
                <td className="tit" style={{ padding: '3px 10px', fontSize: 17, color: k.lado === 'piratas' ? '#1a5a2a' : '#1a3a7a' }}>
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
                  <button className="bt" style={{ padding: '1px 8px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.max(0, k.overall - 5))}>
                    −
                  </button>
                  <span style={{ display: 'inline-block', width: 30, textAlign: 'center', color: '#3a2410' }}>{k.overall}</span>
                  <button className="bt" style={{ padding: '1px 8px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.min(100, k.overall + 5))}>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="bt" onClick={() => c.aleatorizar()} title="Sorteia Akuma no Mi e Haki de todos">
            🎲 Aleatorizar
          </button>
          <button className="bt" onClick={() => c.restaurarConfig()} title="Volta ao elenco de teste">
            ↺ Padrão
          </button>
          <button className="bt" onClick={() => (location.search = '?treino')} title="Um pirata e um boneco alvo para testar skills e sprites">
            🎯 Treino
          </button>
          <button className="bt vermelho tit" style={{ fontSize: 22, padding: '6px 28px' }} onClick={() => c.comecar()}>
            Zarpar para a batalha!
          </button>
        </div>
      </div>
    </div>
  )
}

/** Preparação de Haki: 10 s para ligar o Haki de cada pirata. */
function PreparoHaki({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const comHaki = b.tripulacao.filter((t) => t.armamento || t.observacao || t.rei)
  return (
    <div className="madeira" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', padding: 16, width: 'min(820px, calc(100% - 16px))', maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div className="tit" style={{ fontSize: 30, color: '#ffe08a' }}>
            Preparação de Haki
          </div>
          <div style={{ font: '400 13px Georgia, serif', color: '#e8d8b8' }}>Ligue (ou não) o Haki de cada pirata antes da batalha. A Marinha também se prepara.</div>
        </div>
        <div className="tit" style={{ fontSize: 48, color: b.tempoHaki <= 3 ? '#ff6a5a' : '#ffe08a', minWidth: 80, textAlign: 'center' }}>
          ⌛{b.tempoHaki}
        </div>
      </div>
      {comHaki.length === 0 && <div style={{ color: '#e8d8b8', margin: '10px 0' }}>Nenhum pirata tem Haki nesta montagem.</div>}
      {comHaki.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(201,162,74,.35)' }}>
          <div className="escotilha">
            <div className="vidro" style={rosto(f.retrato, 54)} />
          </div>
          <div className="tit" style={{ width: 100, fontSize: 18, color: '#ffe8b0' }}>
            {f.nome}
          </div>
          <div style={{ flex: 1 }}>
            <CartasHaki f={f} c={c} preparo />
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button className="bt vermelho tit" style={{ fontSize: 22, padding: '6px 34px' }} onClick={() => c.pronto()}>
          Pronto!
        </button>
      </div>
    </div>
  )
}

const ARMAS: [string, string][] = [
  ['espada', 'Espada'],
  ['maca', 'Maça'],
  ['espingarda', 'Espingarda'],
  ['adaga', 'Adaga'],
]

/** Painel do modo treino (?treino): troca fruta e arma do pirata, fruta do boneco. */
function PainelTreino({ t, c }: { t: NonNullable<RetratoBatalha['treino']>; c: ControleBatalha }) {
  const sel: React.CSSProperties = { font: 'inherit', fontSize: 12, background: '#fbf1d6', color: '#3a2410', border: '1px solid #8a6a3a', padding: '2px' }
  const rotulo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#6a4a1a' }
  return (
    <div className="pergaminho" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '6px 14px 8px', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
      <span className="tit" style={{ fontSize: 24, color: '#8a1a10', alignSelf: 'center' }}>
        🎯 Treino
      </span>
      <label style={rotulo}>
        Fruta
        <select value={t.fruta} onChange={(ev) => c.mudarTreino('fruta', ev.target.value)} style={sel}>
          {FRUTAS_OP.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={rotulo}>
        Arma
        <select value={t.arma} onChange={(ev) => c.mudarTreino('arma', ev.target.value)} style={sel}>
          {ARMAS.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={rotulo}>
        Armamento
        <select value={t.armamento} onChange={(ev) => c.mudarTreino('armamento', Number(ev.target.value))} style={sel}>
          {NIVEL.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={{ ...rotulo, alignItems: 'center' }}>
        Rei
        <input type="checkbox" checked={t.rei} onChange={(ev) => c.mudarTreino('rei', ev.target.checked)} />
      </label>
      <label style={rotulo}>
        Fruta do boneco
        <select value={t.alvoFruta} onChange={(ev) => c.mudarTreino('alvoFruta', ev.target.value)} style={sel}>
          {FRUTAS_OP.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button className="bt" style={{ alignSelf: 'center' }} onClick={() => (location.search = '')} title="Volta para a batalha">
        Sair
      </button>
    </div>
  )
}

export function HudBatalha({ b, c, velocidade, mudarVelocidade }: { b: RetratoBatalha; c: ControleBatalha; velocidade: number; mudarVelocidade: (v: number) => void }) {
  const [verLog, setVerLog] = useState(true)
  const [bandeja, setBandeja] = useState<'skills' | 'haki' | null>(null)
  const s = b.selecionado
  const minha = b.fase === 'minha' && !b.animando && !b.auto
  const skill = s?.skills.find((k) => k.id === s.skill)
  const basica = s?.skills.find((k) => k.energia === 0 && k.area === 'alvo')
  const profissao = s?.skills.filter((k) => k.id === 'primeiros-socorros') ?? []
  const temHaki = !!s && !!(s.armamento || s.observacao || s.rei)
  const aberta = s && minha ? bandeja : null
  const escolherSkill = (id: string) => {
    c.escolherSkill(id)
    setBandeja(null)
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
          {/* piratas */}
          <div style={{ position: 'absolute', left: 10, top: 10, pointerEvents: 'auto' }}>
            {b.tripulacao.map((t) => (
              <Quadro key={t.id} f={t} sel={s?.id === t.id} onClick={minha && t.hp > 0 ? () => c.selecionar(s?.id === t.id ? null : t.id) : undefined} />
            ))}
          </div>

          {/* Marinha */}
          <div style={{ position: 'absolute', right: 10, top: 10, pointerEvents: 'auto' }}>
            {b.inimigos.map((t) => (
              <Quadro key={t.id} f={t} direita />
            ))}
          </div>

          {/* treino: escolher fruta, arma e Haki */}
          {b.treino && <PainelTreino t={b.treino} c={c} />}

          {/* faixa da vez (pergaminho) */}
          {b.fase !== 'fim' && !b.treino && (
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div
                className="pergaminho tit"
                style={{
                  fontSize: 30,
                  padding: '2px 46px 4px',
                  color: b.fase === 'haki' ? '#6a4a0a' : b.vez === 'piratas' ? '#8a1a10' : '#1a3a7a',
                  clipPath: 'polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                {b.fase === 'haki' ? '⌛ Preparação ⌛' : b.vez === 'piratas' ? '☠ Sua vez ☠' : '⚓ Vez da Marinha ⚓'}
              </div>
              {b.fase === 'minha' && (
                <div className="madeira" style={{ display: 'inline-flex', gap: 14, alignItems: 'center', marginTop: 4, padding: '3px 14px', fontSize: 12.5, borderRadius: 14 }}>
                  <span title="Passos da tripulação nesta vez">
                    👣 <Pips n={b.movimento} max={MOVIMENTO_POR_VEZ} c="#ffe08a" forma="circulo" /> {b.movimento} {b.movimento === 1 ? 'passo' : 'passos'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    ⌛
                    <span style={{ width: 70, display: 'inline-block' }}>
                      <Barra v={b.tempo} max={b.tempoMax} c={b.tempo <= 20 ? '#ff5a3a' : '#ffe08a'} fina />
                    </span>
                    <span style={{ color: b.tempo <= 20 ? '#ff8a6a' : undefined }}>{b.tempo}s</span>
                  </span>
                </div>
              )}
              {b.fase === 'inimiga' && (
                <div className="madeira" style={{ display: 'inline-block', marginTop: 4, padding: '2px 14px', fontSize: 12, borderRadius: 14, color: '#bcd0f0' }}>
                  A Marinha está agindo…
                </div>
              )}
            </div>
          )}

          {/* preparação de Haki */}
          {b.fase === 'haki' && <PreparoHaki b={b} c={c} />}

          {/* tábuas de ação */}
          {s && minha && (
            <div className="menu" style={{ position: 'absolute', left: 10, bottom: 10 }}>
              {temHaki && (
                <button className={`tabua haki${aberta === 'haki' ? ' on' : ''}${reiLiberado(s) ? ' alerta' : ''}`} onClick={() => setBandeja(aberta === 'haki' ? null : 'haki')}>
                  <span className="i">✊</span> Haki
                </button>
              )}
              <button className={`tabua${!s.skill || s.skill === basica?.id ? ' on' : ''}`} onClick={() => basica && escolherSkill(basica.id)} title={basica?.descricao}>
                <span className="i">⚔</span> Atacar
              </button>
              <button className={`tabua${aberta === 'skills' || (skill && skill.id !== basica?.id && !profissao.includes(skill)) ? ' on' : ''}`} onClick={() => setBandeja(aberta === 'skills' ? null : 'skills')}>
                <span className="i">📜</span> Skills
              </button>
              {profissao.map((k) => (
                <button key={k.id} className={`tabua${s.skill === k.id ? ' on' : ''}`} disabled={!!k.motivo} title={k.motivo ?? k.descricao} onClick={() => escolherSkill(k.id)}>
                  <span className="i">✚</span> Profissão
                </button>
              ))}
              {!b.treino && <button className="tabua" onClick={() => c.passar()}>
                <span className="i">⏭</span> Passar a vez
              </button>}
            </div>
          )}

          {/* bandeja: skills (pergaminho) ou Haki */}
          {s && aberta && (
            <div
              className={`bandeja ${aberta === 'skills' ? 'pergaminho' : 'madeira'}`}
              style={{ position: 'absolute', left: 236, right: 10, bottom: 10, maxWidth: 1000, margin: '0 auto', maxHeight: '46%', overflow: 'auto' }}
            >
              <div className="cab">
                <span className="tit" style={{ fontSize: 22, color: aberta === 'skills' ? '#8a1a10' : '#ffe08a' }}>
                  {aberta === 'skills' ? `📜 Skills de ${s.nome}` : `✊ Haki de ${s.nome}`}
                </span>
                <button className="bt" style={{ padding: '1px 10px' }} onClick={() => setBandeja(null)}>
                  ✕
                </button>
              </div>
              {aberta === 'skills' ? <CartasSkills skills={s.skills.filter((k) => !profissao.includes(k))} atual={s.skill} escolher={escolherSkill} /> : <CartasHaki f={s} c={c} />}
            </div>
          )}

          {/* confirmar golpe (toque) */}
          {s && minha && skill && s.previa && !aberta && (
            <div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)' }}>
              <button className="bt vermelho tit" style={{ fontSize: 20, padding: '6px 28px' }} onClick={() => c.usarPrevia()}>
                ⚔ {skill.nome}
              </button>
            </div>
          )}

          {/* diário de bordo */}
          {!aberta && (
            <div className="pergaminho diario" style={{ position: 'absolute', right: 10, bottom: 10, width: 'min(400px, 42%)', padding: '6px 12px 8px', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: verLog ? '1px solid rgba(120,80,30,.4)' : 'none', paddingBottom: verLog ? 3 : 0, marginBottom: verLog ? 3 : 0 }}>
                <span className="tit" style={{ fontSize: 17, color: '#6a2a0a' }}>
                  Diário de bordo
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
                  style={{ maxHeight: 128, overflow: 'auto' }}
                  ref={(el) => {
                    if (el) el.scrollTop = el.scrollHeight
                  }}
                >
                  {b.log.slice(-12).map((l, i) => (
                    <div key={i} className="ent">
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
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,10,25,0.55)', pointerEvents: 'auto' }}>
              <div className="pergaminho" style={{ padding: '22px 50px', textAlign: 'center', borderRadius: 6 }}>
                <div className="tit" style={{ fontSize: 56, color: b.vencedor === 'piratas' ? '#8a1a10' : '#1a3a7a' }}>
                  {b.vencedor === 'piratas' ? '☠ Vitória! ☠' : '⚓ Derrota ⚓'}
                </div>
                <div style={{ margin: '4px 0 14px', font: '400 14px Georgia, serif' }}>{b.turno} vezes de batalha</div>
                <button className="bt vermelho tit" style={{ fontSize: 22, padding: '6px 28px' }} onClick={() => c.novaBatalha()}>
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
