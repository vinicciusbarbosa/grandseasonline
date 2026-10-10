import { Fragment, useState } from 'react'
import type { ControleBatalha, FichaHud, RetratoBatalha } from './controle'
import { HAOSHOKU } from './regras'
import { SKILLS_ARMA } from './armas'
import { BarraCombate, type DicaCombate } from './BarraCombate'
import { ATRIBUTOS_BUILD, NOMES_CLASSE, PONTOS_BUILD, buildValida, comBuild, pontosGastos, MAX_POR_ATRIBUTO, VIDA_POR_VIG, type Config } from './elenco'

/**
 * HUD da batalha, estilo RPG tático compacto: painéis escuros translúcidos
 * com filete dourado, para tomar pouco da tela.
 *   cantos de cima — cartões pequenos das duas tripulações (rosto, vida,
 *                    energia, espírito, ícones de estado);
 *   topo           — a vez (pílula), passos e tempo;
 *   baixo, centro  — barra de ações do selecionado: Haki, skills em
 *                    espaços com custo e recarga, e Passar a vez (sempre
 *                    visível na sua vez);
 *   baixo, esq.    — diário recolhível.
 */

const CSS = `
.hud { position:absolute; inset:0; pointer-events:none; font:600 12px/1.25 'Trebuchet MS', system-ui, sans-serif; color:#e8e2d4; --ouro:#d8b45a; --fundo:rgba(14,18,28,.82); --fundo2:rgba(24,30,44,.92); }
.hud * { box-sizing:border-box; }
.hud .tit { font-family:'Cinzel', Georgia, serif; font-weight:700; letter-spacing:.5px; }
.hud .painel { pointer-events:auto; background:var(--fundo); border:1px solid rgba(216,180,90,.45); border-radius:6px; box-shadow:0 4px 14px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06); backdrop-filter: blur(2px); }

/* cartões das tripulações */
.hud .cartao { display:flex; gap:6px; align-items:center; width:200px; padding:4px 6px; margin-bottom:4px; position:relative; }
.hud .cartao.dir { flex-direction:row-reverse; text-align:right; }
.hud .cartao.sel { border-color:var(--ouro); box-shadow:0 0 0 1px var(--ouro), 0 0 12px rgba(216,180,90,.45); }
.hud .cartao.clic { cursor:pointer; }
.hud .cartao.clic:hover { background:var(--fundo2); }
.hud .cartao.morto { opacity:.38; filter:grayscale(1); }
.hud .rosto { flex:none; width:34px; height:34px; border-radius:4px; background-color:#1c2a40; background-repeat:no-repeat; image-rendering:pixelated; border:1px solid rgba(216,180,90,.6); }
.hud .cartao.dir .rosto { border-color:rgba(255,120,100,.6); }
.hud .info { flex:1; min-width:0; }
.hud .nome { display:flex; justify-content:space-between; gap:4px; font-size:12px; margin-bottom:2px; white-space:nowrap; }
.hud .cartao.dir .nome { flex-direction:row-reverse; }
.hud .barra { height:9px; border-radius:3px; background:rgba(0,0,0,.55); overflow:hidden; margin-top:2px; position:relative; }
.hud .barra.fina { height:3px; }
.hud .barra > i { display:block; height:100%; transition:width .3s; }
.hud .barra > span { position:absolute; right:3px; top:0; font-size:8px; line-height:9px; color:#fff; text-shadow:0 1px 1px #000; }
.hud .ico { display:inline-block; min-width:13px; height:13px; padding:0 2px; border-radius:3px; font-size:9px; line-height:12px; text-align:center; font-weight:700; margin-left:2px; }
/* Haki carregado envolve o cartão inteiro, sem cobrir retrato ou barras. */
.hud .cartao.rei { --linha-selecao:transparent; border-color:#c94356; animation:rei-moldura 2.1s ease-in-out infinite; z-index:1; }
.hud .cartao.rei.sel { --linha-selecao:#d8b45a88; }
.hud .cartao.rei .rosto { border-color:#d86270; }
.hud .rei-raios { position:absolute; left:-3px; top:-3px; width:calc(100% + 6px); height:calc(100% + 6px); overflow:visible; pointer-events:none; fill:none; stroke-linecap:round; stroke-linejoin:round; animation:rei-centelhas 2.1s ease-in-out infinite; }
.hud .rei-raios .sombra { stroke:#180710; stroke-width:4; }
.hud .rei-raios .centelha { stroke:#ff6171; stroke-width:1.2; filter:drop-shadow(0 0 2px #ed173d); }
.hud .cartao.dir.rei,.hud .cartao.dir .rei-raios { animation-delay:-.8s; }
@keyframes rei-moldura { 0%,100% { border-color:#97394c; box-shadow:0 0 3px #d5143844,inset 0 0 0 1px var(--linha-selecao); } 50% { border-color:#ff6979; box-shadow:0 0 0 1px #b52040aa,0 0 12px #ed204c66,inset 0 0 0 1px var(--linha-selecao),inset 0 0 8px #b4102522; } }
@keyframes rei-centelhas { 0%,100% { opacity:.18; } 40% { opacity:.45; } 50%,58% { opacity:.95; } 54%,64% { opacity:.35; } 75% { opacity:.6; } }
@media(prefers-reduced-motion:reduce) { .hud .cartao.rei,.hud .rei-raios { animation:none; }.hud .cartao.rei { box-shadow:0 0 7px #ed204c55; }.hud .rei-raios { opacity:.6; } }

/* build (pontos de atributo) na preparação */
.hud .build { position:relative; margin:2px 0 8px; padding:10px 12px 12px; border:1px solid rgba(216,180,90,.32); border-radius:6px; background:linear-gradient(180deg, rgba(34,40,58,.92), rgba(16,20,30,.92)); }
.hud .build-topo { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
.hud .build-pontos { white-space:nowrap; font-size:11px; color:#b8ae98; text-transform:uppercase; letter-spacing:.6px; }
.hud .build-pontos b { font-size:17px; color:var(--ouro); margin-right:3px; }
.hud .build-pontos.cheio b { color:#8a8270; }
.hud .build-trilho { flex:1; height:5px; border-radius:3px; background:rgba(0,0,0,.5); overflow:hidden; }
.hud .build-trilho > i { display:block; height:100%; background:linear-gradient(90deg, #8a6a28, #e8c060); transition:width .15s; }
.hud .build-topo .bt { font-size:11px; padding:1px 8px; }
.hud .build-grade { display:grid; grid-template-columns:repeat(3, minmax(160px, 1fr)); gap:6px 10px; }
.hud .atr { display:grid; grid-template-columns:1fr auto; align-items:center; gap:2px 8px; padding:5px 8px; border-radius:4px; background:rgba(255,255,255,.035); border:1px solid transparent; }
.hud .atr.com { border-color:rgba(143,224,160,.22); }
.hud .atr .sig { font-size:11px; letter-spacing:.8px; color:#c8bca0; }
.hud .atr .ajuda { pointer-events:auto; display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; margin-left:4px; vertical-align:1px; border-radius:50%; border:1px solid rgba(216,180,90,.5); color:#d8b45a; font-size:9px; cursor:help; }
.hud .atr .ajuda:hover { background:#3a3220; color:#ffe6a0; }
.hud .balao-atr { position:absolute; z-index:50; width:260px; padding:8px 10px; border-radius:5px; background:rgba(12,15,24,.97); border:1px solid rgba(216,180,90,.55); box-shadow:0 4px 14px rgba(0,0,0,.6); font:400 12px/1.4 'Trebuchet MS', sans-serif; color:#e8e2d4; pointer-events:none; transform:translate(-50%, calc(-100% - 8px)); }
.hud .balao-atr.baixo { transform:translate(-50%, 22px); }
.hud .balao-atr b { display:block; font-weight:700; color:#ffd27a; margin-bottom:2px; }
.hud .atr.akm .sig { color:#ffcf5a; }
.hud .atr .val { font-size:16px; color:#f2ead8; }
.hud .atr .val small { font-size:11px; color:#8fe0a0; margin-left:3px; }
.hud .atr .ctl { display:flex; gap:3px; }
.hud .atr .ctl button { pointer-events:auto; width:22px; height:22px; border-radius:50%; border:1px solid rgba(216,180,90,.45); background:#232b3e; color:#f2e2b0; font:700 14px/1 'Trebuchet MS', sans-serif; cursor:pointer; padding:0; }
.hud .atr .ctl button:hover:not(:disabled) { background:#3a3220; border-color:var(--ouro); }
.hud .atr .ctl button:disabled { opacity:.3; cursor:default; }

/* modo fila por AGL: quem joga agora, o próximo e o resto, embaixo da vez */
.hud .fila-agl { display:flex; justify-content:center; align-items:center; gap:5px; margin-top:5px; flex-wrap:nowrap; width:max-content; position:relative; left:50%; transform:translateX(-50%); }
.hud .fila-card { display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 3px; border-radius:5px; background:var(--fundo); border:1px solid rgba(255,255,255,.15); }
.hud .fila-card .rosto { width:30px; height:30px; }
.hud .fila-card .txt { display:flex; flex-direction:column; line-height:1.15; }
.hud .fila-card .rot { font-size:9px; letter-spacing:.8px; color:#a89a78; text-transform:uppercase; }
.hud .fila-card b { font-size:13px; }
.hud .fila-card .quem { font-size:10px; font-weight:700; }
.hud .fila-card.meu { border-color:rgba(143,224,160,.7); }
.hud .fila-card.meu .quem { color:#8fe0a0; }
.hud .fila-card.inimigo { border-color:rgba(255,138,122,.7); }
.hud .fila-card.inimigo .quem { color:#ff9a8a; }
.hud .fila-card.agora { box-shadow:0 0 0 1px var(--ouro), 0 0 10px rgba(216,180,90,.5); }
.hud .fila-card.agora .rot { color:var(--ouro); }
.hud .fila-seta { color:#a89a78; font-size:14px; }
.hud .fila-resto { display:inline-flex; align-items:center; gap:3px; }
.hud .fila-mini { position:relative; display:inline-flex; padding:1px; border-radius:4px; background:var(--fundo); border:1px solid rgba(255,255,255,.12); }
.hud .fila-mini .rosto { width:22px; height:22px; }
.hud .fila-mini.meu { border-color:rgba(143,224,160,.55); }
.hud .fila-mini.inimigo { border-color:rgba(255,138,122,.55); }
.hud .fila-mini.prox { opacity:.6; }
.hud .fila-perde { position:absolute; right:-3px; top:-5px; font-size:10px; }
.hud .fila-rodada { font-size:9px; color:#a89a78; letter-spacing:.6px; text-transform:uppercase; padding:0 2px; border-left:1px solid rgba(216,180,90,.35); margin-left:2px; }

/* topo: a vez */
.hud .vez { display:inline-flex; align-items:center; gap:10px; padding:4px 14px; border-radius:20px; font-size:12px; }
.hud .vez .tit { font-size:15px; }

/* barra de ações */
.hud .acoes { display:flex; align-items:stretch; gap:6px; padding:6px; }
.hud .sep { width:1px; background:rgba(216,180,90,.3); margin:2px 2px; }
.hud .slot { pointer-events:auto; position:relative; width:64px; height:58px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; cursor:pointer;
  font:inherit; color:#e8e2d4; background:linear-gradient(180deg, #2a3348, #1a2030); border:1px solid rgba(216,180,90,.35); border-radius:5px; padding:3px; transition: filter .1s, transform .1s; }
.hud .slot:hover:not(:disabled) { filter:brightness(1.25); transform:translateY(-2px); }
.hud .slot.on { border-color:var(--ouro); box-shadow:0 0 0 1px var(--ouro), 0 0 10px rgba(216,180,90,.5); background:linear-gradient(180deg, #4a4028, #2a2418); }
.hud .slot:disabled { opacity:.42; cursor:default; }
.hud .slot .ic { font-size:18px; line-height:20px; }
.hud .slot .rot { font-size:9px; line-height:10px; text-align:center; max-width:60px; max-height:20px; overflow:hidden; }
.hud .slot .custo { position:absolute; left:2px; bottom:1px; font-size:9px; color:#7ab8ff; }
.hud .slot .espera { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.6); border-radius:5px; font-size:18px; color:#ffb070; }
.hud .slot.fruta { background:linear-gradient(180deg, #3a2a2a, #241818); }
.hud .slot.haki.on { border-color:#b070ff; box-shadow:0 0 0 1px #b070ff, 0 0 10px rgba(176,112,255,.6); background:linear-gradient(180deg, #3a2a50, #1e1430); }
.hud .slot.haki.imb.on { border-color:#ff3040; box-shadow:0 0 0 1px #ff3040, 0 0 10px rgba(255,48,64,.6); background:linear-gradient(180deg, #4a1a24, #2a0e14); }
.hud .slot.rei { border-color:#ff5040; }
.hud .slot.passar { width:72px; background:linear-gradient(180deg, #4a2a1a, #2a160c); border-color:rgba(255,160,100,.5); }
.hud .pips { position:absolute; right:3px; bottom:2px; display:flex; gap:1px; }
.hud .pips i { width:4px; height:4px; border-radius:50%; }

/* dica de skill (acima da barra) */
.hud .dica { padding:6px 10px; max-width:360px; font:400 11.5px/1.35 Georgia, serif; }
.hud .dica b { font-family:'Cinzel', Georgia, serif; font-size:13px; color:#ffe6a0; }
.hud .tag { display:inline-block; font:700 9.5px sans-serif; padding:0 5px; border-radius:8px; margin:2px 3px 2px 0; background:rgba(255,255,255,.1); }

/* botões */
.hud .bt { pointer-events:auto; font:inherit; color:#e8e2d4; cursor:pointer; border:1px solid rgba(216,180,90,.5); border-radius:4px; background:linear-gradient(180deg,#2e3850,#1c2234); padding:4px 10px; }
.hud .bt:hover:not(:disabled) { filter:brightness(1.3); }
.hud .bt:disabled { opacity:.45; cursor:default; }
.hud .bt.on { background:linear-gradient(180deg,#d8b45a,#a07a2a); color:#1a1408; }
.hud .bt.forte { border-color:#ff9a7a; background:linear-gradient(180deg,#a8281a,#5a0e06); color:#fff; font-family:'Cinzel', Georgia, serif; font-weight:700; }

/* diário */
.hud .diario { width:300px; padding:4px 8px 5px; opacity:.55; transition:opacity .2s; }
.hud .diario:hover { opacity:1; }
.hud .diario .ent { padding:1px 0; font:400 11px/1.3 Georgia, serif; color:#d8d2c4; }
.hud .diario .h { color:#8a8270; margin-right:6px; font-variant-numeric:tabular-nums; }

/* telas cheias (preparação, fim) */
.hud .tela { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(4,8,16,.6); pointer-events:auto; }
.hud .janela { padding:14px 18px; max-width:calc(100% - 16px); max-height:calc(100% - 16px); overflow:auto; }
.hud .janela table td { padding:2px 6px; }
.hud select, .hud input[type=number] { font:inherit; font-size:11.5px; background:#141a28; color:#e8e2d4; border:1px solid rgba(216,180,90,.4); border-radius:3px; padding:2px; }
@media (max-height: 640px) { .hud .slot { width:48px; height:48px } .hud .slot .ic { font-size:15px } .hud .cartao { width:180px } }
`

const cor = { vida: '#5ad65a', vidaInimigo: '#ff6a4a', vidaBaixa: '#ff4a3a', energia: '#4aa8ff', espirito: '#ff3a5a', arm: '#b070ff', rei: '#ff3040', obs: '#7fd8ff' }

function Barra({ v, max, c, fina, texto }: { v: number; max: number; c: string; fina?: boolean; texto?: string }) {
  return (
    <div className={`barra${fina ? ' fina' : ''}`}>
      <i style={{ width: `${(100 * Math.max(0, v)) / max}%`, background: c }} />
      {texto && <span>{texto}</span>}
    </div>
  )
}

/** Fila por AGL: o da vez e o próximo em destaque (nome e se é seu ou do inimigo); o resto em rostinhos, separando a próxima rodada. */
function FilaAgl({ fila, meuLado }: { fila: NonNullable<RetratoBatalha['fila']>; meuLado: string }) {
  const quem = (l: string) => (l === meuLado ? 'meu' : 'inimigo')
  const Card = ({ f, rotulo, agora }: { f: (typeof fila)[number]; rotulo: string; agora?: boolean }) => (
    <span className={`fila-card ${quem(f.lado)}${agora ? ' agora' : ''}`} title={`AGL ${f.agl}`}>
      <i className="rosto" style={rosto(f.retrato, 30)} />
      <span className="txt">
        <span className="rot">{rotulo}</span>
        <b>{f.nome}</b>
        <span className="quem">{f.lado === meuLado ? 'Você' : 'Inimigo'}{f.perde ? ' · perde a vez' : ''}</span>
      </span>
    </span>
  )
  const [agora, prox, ...resto] = fila
  if (!agora) return null
  return (
    <div className="fila-agl">
      <Card f={agora} rotulo="Agora" agora />
      {prox && (
        <>
          <span className="fila-seta">›</span>
          <Card f={prox} rotulo={prox.rodada ? 'Próximo (nova rodada)' : 'Próximo'} />
        </>
      )}
      {resto.length > 0 && <span className="fila-seta">›</span>}
      <span className="fila-resto">
        {resto.map((f, i) => (
          <Fragment key={`${f.id}-${f.rodada}`}>
            {f.rodada === 1 && (i === 0 ? prox?.rodada !== 1 : resto[i - 1].rodada === 0) && <span className="fila-rodada">nova rodada</span>}
            <span className={`fila-mini ${quem(f.lado)}${f.rodada ? ' prox' : ''}`} title={`${f.nome} (${f.lado === meuLado ? 'você' : 'inimigo'}) · AGL ${f.agl}${f.perde ? ' · perde a vez' : ''}`}>
              <i className="rosto" style={rosto(f.retrato, 22)} />
              {f.perde && <span className="fila-perde">❄</span>}
            </span>
          </Fragment>
        ))}
      </span>
    </div>
  )
}

/** Rosto: recorte da cabeça na folha parada (as folhas têm todas a mesma proporção, 300×264 ou 150×132). */
function rosto(url: string, l: number): React.CSSProperties {
  const larg = 72 // px do quadro (em 300) que aparecem
  const k = l / larg
  return { backgroundImage: `url(${url})`, backgroundSize: `${300 * k}px auto`, backgroundPosition: `${-(150 - larg / 2) * k}px ${-(90 - larg / 2) * k}px` }
}

function Icones({ f }: { f: FichaHud }) {
  const ic: [string, string, string][] = []
  if (f.fruta) ic.push([f.fruta.tipo === 'logia' ? 'L' : f.fruta.tipo === 'zoan' ? 'Z' : 'P', '#ffcf5a', f.fruta.nome])
  // Logia: cargas de intangibilidade; sem cargas fica desgastada (golpes sem Haki acertam)
  if (f.logia && f.logia.max < 99)
    ic.push(f.logia.cargas > 0
      ? [`${f.logia.cargas}`, '#dfe6f3', `Intangível: ${f.logia.cargas}/${f.logia.max} cargas (cada golpe sem Haki que atravessa gasta 1)`]
      : ['✕', '#ff9a5a', 'Logia desgastada: sem cargas, golpes sem Haki acertam'])
  if (f.armamento?.ligado) ic.push(['A', f.armamento.imbuido ? cor.rei : cor.arm, f.armamento.imbuido ? 'Armamento com o Rei imbuído ligado' : 'Haki de armamento ligado'])
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

const RAIOS_REI = [
  'M3 11 0 5 9 2 21 3 26 0 35 4 42 2 61 2 68 0 78 3',
  'M125 2 139 2 145 0 152 4 168 2 183 2 195 4 200 10 197 18 201 24',
  'M199 32 197 39 200 45 191 48 181 47 176 50 166 46 155 48 138 48 129 50 119 47',
  'M81 48 67 48 61 50 53 46 37 48 24 48 13 46 3 47 0 41 3 32 0 25',
]

function Cartao({ f, sel, onClick, direita, combateAtivo }: { f: FichaHud; sel?: boolean; onClick?: () => void; direita?: boolean; combateAtivo: boolean }) {
  const morto = f.hp <= 0
  const rei = combateAtivo && !morto && !f.atordoado && !!f.rei && f.espirito >= HAOSHOKU.espirito
  const corVida = f.hp / f.hpMax <= 0.35 ? cor.vidaBaixa : direita ? cor.vidaInimigo : cor.vida
  return (
    <div
      className={`painel cartao${sel ? ' sel' : ''}${onClick ? ' clic' : ''}${morto ? ' morto' : ''}${direita ? ' dir' : ''}${rei ? ' rei' : ''}`}
      onClick={onClick}
      title={rei ? `Haki do Rei em área pronto · ${HAOSHOKU.espirito} espírito. Pode ser usado na vez deste time.` : undefined}
    >
      {rei && <svg className="rei-raios" viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden="true">{RAIOS_REI.map((d, i) => <g key={i}><path className="sombra" d={d} vectorEffect="non-scaling-stroke"/><path className="centelha" d={d} vectorEffect="non-scaling-stroke"/></g>)}</svg>}
      <div className="rosto" style={rosto(f.retrato, 34)} />
      <div className="info">
        <div className="nome">
          <span className="tit" style={{ fontSize: 12, color: direita ? '#ffc8b8' : '#ffe6a0' }}>
            {f.nome}
          </span>
          <Icones f={f} />
        </div>
        <Barra v={f.hp} max={f.hpMax} c={corVida} texto={`${Math.max(0, f.hp)}`} />
        <Barra v={f.energia} max={100} c={cor.energia} fina />
        <Barra v={f.espirito} max={100} c={cor.espirito} fina />
      </div>
    </div>
  )
}

/** Texto do diário com os nomes coloridos (sua tripulação verde, inimigos vermelho). */
function Colorido({ texto, piratas, marinha }: { texto: string; piratas: string[]; marinha: string[] }) {
  const nomes = [...piratas.map((n) => [n, '#8fe0a0'] as const), ...marinha.map((n) => [n, '#ff9a8a'] as const)].sort((a, b) => b[0].length - a[0].length)
  if (!nomes.length) return <>{texto}</>
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
]
const NIVEL = ['—', 'normal', 'avançado']
/** armamento: o nível 3 é o Haki do Rei imbuído no golpe */
const NIVEL_ARMAMENTO = [...NIVEL, 'Rei imbuído']

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Sala do multiplayer: quem está, quem deu pronto e o tempo da preparação. */
function SalaMp({ mp }: { mp: NonNullable<RetratoBatalha['mp']> }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, margin: '0 0 10px', fontSize: 12 }}>
      {mp.jogadores.map((j) => (
        <span key={j.lado} style={{ color: j.lado === mp.lado ? '#8fe0a0' : '#ff9a8a' }}>
          {j.pronto ? '✔' : '…'} {j.nome}
          {j.lado === mp.lado ? ' (você)' : ''}
        </span>
      ))}
      {mp.restam !== null ? (
        <span className="tit" style={{ fontSize: 16, color: mp.restam <= 30 ? '#ff8a6a' : '#ffe6a0' }}>
          ⌛ {mmss(mp.restam)}
        </span>
      ) : (
        <span style={{ color: '#b8b0a0' }}>Aguardando o oponente entrar…</span>
      )}
    </div>
  )
}

/** Build de um tripulante: + e − em cada atributo, com o valor final (base da classe + pontos). */
function PainelBuild({ k, c, travado }: { k: Config; c: ControleBatalha; travado: boolean }) {
  const gastos = pontosGastos(k.build)
  const livres = PONTOS_BUILD - gastos
  const { at, hp } = comBuild(k.classe, buildValida(k.build))
  const [dica, setDica] = useState<{ nome: string; texto: string; x: number; y: number } | null>(null)
  return (
    <div className="build">
      {dica && (
        <div className={`balao-atr${dica.y < 60 ? ' baixo' : ''}`} style={{ left: dica.x, top: dica.y }}>
          <b>{dica.nome}</b>
          {dica.texto}
        </div>
      )}
      <div className="build-topo">
        <span className={`build-pontos${livres ? '' : ' cheio'}`}>
          <b>{livres}</b>pontos livres
        </span>
        <span className="build-trilho">
          <i style={{ width: `${(gastos / PONTOS_BUILD) * 100}%` }} />
        </span>
        <button className="bt" disabled={travado} onClick={() => c.resetarBuild(k.id, false)} title={`Build padrão de ${NOMES_CLASSE[k.classe]}`}>
          Padrão
        </button>
        <button className="bt" disabled={travado || !gastos} onClick={() => c.resetarBuild(k.id, true)}>
          Zerar
        </button>
      </div>
      <div className="build-grade">
        {ATRIBUTOS_BUILD.map(([a, nome, texto]) => {
          const pts = k.build[a] ?? 0
          return (
            <div key={a} className={`atr${a === 'akm' ? ' akm' : ''}${pts ? ' com' : ''}`}>
              <div>
                <span className="sig">{a === 'vig' ? 'VIDA' : nome}</span>{' '}
                <span className="val">
                  {a === 'vig' ? hp : at[a]}
                  {pts > 0 && <small>+{a === 'vig' ? pts * VIDA_POR_VIG : pts}</small>}
                </span>
                <span
                  className="ajuda"
                  onMouseEnter={(ev) => {
                    const r = ev.currentTarget.getBoundingClientRect()
                    const b = ev.currentTarget.closest('.build')!.getBoundingClientRect()
                    setDica({ nome: a === 'vig' ? 'VIDA (VIG)' : nome, texto, x: Math.min(Math.max(r.left + r.width / 2 - b.left, 135), b.width - 135), y: r.top - b.top })
                  }}
                  onMouseLeave={() => setDica(null)}
                >
                  ?
                </span>
              </div>
              <span className="ctl">
                <button disabled={travado || pts <= 0} onClick={() => c.mudarBuild(k.id, a, -1)} aria-label={`Tirar ponto de ${nome}`}>
                  −
                </button>
                <button disabled={travado || !livres || pts >= MAX_POR_ATRIBUTO} onClick={() => c.mudarBuild(k.id, a, 1)} aria-label={`Pôr ponto em ${nome}`}>
                  +
                </button>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Preparar({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const mp = b.mp
  const travado = !!mp?.pronto
  const [aberto, setAberto] = useState<string | null>(null)
  const meu = (k: { lado: string }) => !mp || k.lado === mp.lado
  return (
    <div className="tela">
      <div className="painel janela">
        <div className="tit" style={{ fontSize: 22, textAlign: 'center', color: '#ffe6a0', marginBottom: 8 }}>
          {mp ? 'Montar a sua tripulação' : 'Montar as tripulações'}
          {c.modo === 'fila' && <div style={{ fontSize: 12, color: '#d8b45a', fontFamily: 'inherit', marginTop: 2 }}>Modo fila: cada personagem joga na sua vez, do maior AGL ao menor</div>}
        </div>
        {mp && <SalaMp mp={mp} />}
        {mp?.aviso && <div style={{ textAlign: 'center', color: '#ff9a8a', marginBottom: 8 }}>{mp.aviso}</div>}
        <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
          <thead>
            <tr style={{ color: '#a89a78', fontSize: 10.5 }}>
              <td></td>
              <td>Classe</td>
              <td>Akuma</td>
              <td>Armamento</td>
              <td>Observação</td>
              <td title="Haki do Rei em área (o imbuído é o nível 3 do armamento)">Rei (área)</td>
              <td>Overall</td>
              <td>Build</td>
            </tr>
          </thead>
          <tbody>
            {b.config.map((k) => (
              <Fragment key={k.id}>
              <tr>
                <td className="tit" style={{ fontSize: 13, color: k.lado === 'piratas' ? '#8fe0a0' : '#ff9a8a' }}>
                  {k.nome}
                </td>
                <td>
                  <select value={k.classe} onChange={(ev) => c.mudarConfig(k.id, 'classe', ev.target.value)}>
                    {Object.entries(NOMES_CLASSE).map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={k.akuma} onChange={(ev) => c.mudarConfig(k.id, 'akuma', ev.target.value)}>
                    {FRUTAS_OP.map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                {(['armamento', 'observacao'] as const).map((campo) => (
                  <td key={campo}>
                    <select value={k[campo]} onChange={(ev) => c.mudarConfig(k.id, campo, Number(ev.target.value))}>
                      {(campo === 'armamento' ? NIVEL_ARMAMENTO : NIVEL).map((n, i) => (
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
                  <button className="bt" style={{ padding: '0 7px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.max(0, k.overall - 5))}>
                    −
                  </button>
                  <span style={{ display: 'inline-block', width: 28, textAlign: 'center' }}>{k.overall}</span>
                  <button className="bt" style={{ padding: '0 7px' }} onClick={() => c.mudarConfig(k.id, 'overall', Math.min(100, k.overall + 5))}>
                    +
                  </button>
                </td>
                <td>
                  {meu(k) && (
                    <button className={`bt${aberto === k.id ? ' on' : ''}`} style={{ padding: '0 8px', whiteSpace: 'nowrap' }} onClick={() => setAberto(aberto === k.id ? null : k.id)} title="Distribuir os pontos de atributo">
                      {PONTOS_BUILD - pontosGastos(k.build) ? `${PONTOS_BUILD - pontosGastos(k.build)} livres` : 'Atributos'} {aberto === k.id ? '▴' : '▾'}
                    </button>
                  )}
                </td>
              </tr>
              {aberto === k.id && meu(k) && (
                <tr>
                  <td colSpan={8}>
                    <PainelBuild k={k} c={c} travado={travado} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="bt" disabled={travado} onClick={() => c.aleatorizar()} title="Sorteia Akuma no Mi, Haki e a build">
            🎲 Aleatorizar
          </button>
          <button className="bt" disabled={travado} onClick={() => c.restaurarConfig()} title="Volta ao elenco de teste">
            ↺ Padrão
          </button>
          {!mp && (
            <>
              <button className="bt" onClick={() => c.entrarTreino()} title="Um pirata e um boneco alvo para testar skills e sprites">
                🎯 Treino
              </button>
              <button className="bt" onClick={() => (location.href = `${location.pathname}?mp`)} title="Batalha contra outro jogador (os dois abrem este link)">
                ⚔ Multiplayer
              </button>
              <button className="bt" onClick={() => (location.href = `${location.pathname}?mp&fila`)} title="Multiplayer com fila única: cada personagem joga na sua vez, do mais ágil (AGL) ao menos ágil">
                ⚔ Multiplayer (fila AGL)
              </button>
              <button className="bt" onClick={() => (location.href = c.modo === 'fila' ? location.pathname : `${location.pathname}?fila`)} title="Contra a IA: alterna entre a vez da tripulação e a fila única por AGL">
                {c.modo === 'fila' ? '↔ Vez por tripulação' : '↕ Fila por AGL'}
              </button>
            </>
          )}
          {mp ? (
            <button className={`bt ${mp.pronto ? 'on' : 'forte'}`} style={{ fontSize: 15, padding: '4px 22px' }} disabled={mp.restam === null} onClick={() => c.comecar()}>
              {mp.pronto ? '✔ Pronto (cancelar)' : 'Pronto!'}
            </button>
          ) : (
            <button className="bt forte" style={{ fontSize: 15, padding: '4px 22px' }} onClick={() => c.comecar()}>
              Zarpar!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Preparação de Haki: 10 s para ligar o Haki de cada pirata. */
function PreparoHaki({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const comHaki = b.tripulacao.filter((t) => t.armamento || t.observacao)
  const chave = (ligado: boolean, cor0: string, texto: string, clique: () => void, pode: boolean) => (
    <button className={`bt${ligado ? ' on' : ''}`} style={ligado ? { background: cor0, color: '#000', borderColor: cor0 } : undefined} disabled={!pode && !ligado} onClick={clique}>
      {texto}: {ligado ? 'ligado' : 'desligado'}
    </button>
  )
  return (
    <div className="painel janela" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px, calc(100% - 16px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div className="tit" style={{ fontSize: 18, color: '#ffe6a0' }}>
            Preparação de Haki
          </div>
          <div style={{ font: '400 11.5px Georgia, serif', color: '#b8b0a0' }}>Ligue (ou não) o Haki de cada um antes da batalha.</div>
        </div>
        <div className="tit" style={{ fontSize: 28, color: b.tempoHaki <= 3 ? '#ff6a5a' : '#ffe6a0' }}>
          {b.tempoHaki}s
        </div>
      </div>
      {comHaki.length === 0 && <div style={{ color: '#b8b0a0', margin: '8px 0' }}>Ninguém tem Haki nesta montagem.</div>}
      {comHaki.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid rgba(216,180,90,.2)' }}>
          <div className="rosto" style={rosto(f.retrato, 34)} />
          <div className="tit" style={{ width: 80, fontSize: 12.5, color: '#ffe6a0' }}>
            {f.nome}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {f.armamento && chave(f.armamento.ligado, f.armamento.imbuido ? cor.rei : cor.arm, f.armamento.imbuido ? 'Rei imbuído' : 'Armamento', () => c.alternarArmamento(f.id), f.armamento.usos > 0)}
            {f.observacao && chave(f.observacao.ligado, cor.obs, 'Observação', () => c.observar(f.id), f.observacao.usos > 0)}
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        {b.mp?.hakiEnviado ? (
          <span style={{ color: '#b8b0a0' }}>Esperando o oponente…</span>
        ) : (
          <button className="bt forte" style={{ fontSize: 15, padding: '4px 26px' }} onClick={() => c.pronto()}>
            Pronto!
          </button>
        )}
      </div>
    </div>
  )
}

const NOMES_ARMAS: Record<string, string> = { espada: 'Sabre', sabre: 'Sabre', maca: 'Kanabo', kanabo: 'Kanabo', espingarda: 'Arma de fogo', punho: 'Punhos', punhos: 'Punhos' }
const ARMAS = Object.keys(SKILLS_ARMA).filter(id => id !== 'adaga').map(id => [id, NOMES_ARMAS[id] ?? id])

/** Painel do modo treino: troca fruta e arma do pirata, fruta do boneco. */
function PainelTreino({ t, c }: { t: NonNullable<RetratoBatalha['treino']>; c: ControleBatalha }) {
  const rotulo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: '#a89a78' }
  return (
    <div className="painel" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '5px 12px 6px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      <span className="tit" style={{ fontSize: 15, color: '#ffe6a0', alignSelf: 'center' }}>
        Treino
      </span>
      <label style={rotulo}>
        Fruta
        <select value={t.fruta} onChange={(ev) => c.mudarTreino('fruta', ev.target.value)}>
          {FRUTAS_OP.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={rotulo}>
        Arma
        <select value={t.arma} onChange={(ev) => c.mudarTreino('arma', ev.target.value)}>
          {ARMAS.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={rotulo}>
        Armamento
        <select value={t.armamento} onChange={(ev) => c.mudarTreino('armamento', Number(ev.target.value))}>
          {NIVEL_ARMAMENTO.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={{ ...rotulo, alignItems: 'center' }}>
        Rei (área)
        <input type="checkbox" checked={t.rei} onChange={(ev) => c.mudarTreino('rei', ev.target.checked)} />
      </label>
      <label style={rotulo}>
        Fruta do boneco
        <select value={t.alvoFruta} onChange={(ev) => c.mudarTreino('alvoFruta', ev.target.value)}>
          {FRUTAS_OP.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button className="bt" style={{ alignSelf: 'center' }} onClick={() => c.sairTreino()} title="Volta para a batalha">
        Sair
      </button>
    </div>
  )
}

export function HudBatalha({ b, c, velocidade, mudarVelocidade }: { b: RetratoBatalha; c: ControleBatalha; velocidade: number; mudarVelocidade: (v: number) => void }) {
  const [verLog, setVerLog] = useState(false)
  const [dica, setDica] = useState<DicaCombate>(null)
  const s = b.selecionado
  const meuLado = b.mp?.lado ?? 'piratas'
  const minha = b.fase === 'minha' && !b.animando && !b.auto
  const acoesVisiveis = b.fase === 'minha' && !b.auto
  const skill = s?.skills.find((k) => k.id === s.skill)
  const nomesP = b.tripulacao.map((t) => t.nome)
  const nomesM = b.inimigos.map((t) => t.nome)
  const hora = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`

  return (
    <div className="hud">
      <style>{CSS}</style>
      {b.fase === 'preparar' && <Preparar b={b} c={c} />}

      {b.fase !== 'preparar' && (
        <>
          {/* sua tripulação */}
          <div style={{ position: 'absolute', left: 8, top: 8 }}>
            {b.tripulacao.map((t) => (
              <Cartao key={t.id} f={t} combateAtivo={b.fase === 'minha' || b.fase === 'inimiga'} sel={s?.id === t.id} onClick={minha && t.hp > 0 ? () => c.selecionar(s?.id === t.id ? null : t.id) : undefined} />
            ))}
          </div>

          {/* inimigos */}
          <div style={{ position: 'absolute', right: 8, top: 8 }}>
            {b.inimigos.map((t) => (
              <Cartao key={t.id} f={t} direita combateAtivo={b.fase === 'minha' || b.fase === 'inimiga'} />
            ))}
          </div>

          {b.treino && <PainelTreino t={b.treino} c={c} />}

          {/* a vez */}
          {b.fase !== 'fim' && !b.treino && (
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }}>
              <div className="painel vez">
                <span className="tit" style={{ color: b.fase === 'haki' ? '#ffe6a0' : b.vez === meuLado ? '#8fe0a0' : '#ff9a8a' }}>
                  {b.fase === 'haki' ? 'Preparação' : b.vez === meuLado ? 'Sua vez' : 'Vez do inimigo'}
                </span>
                {b.fase === 'minha' && (
                  <>
                    <span title={b.fila ? 'Passos de quem joga nesta vez' : 'Passos da tripulação nesta vez'}>
                      👣 {b.movimento}/{b.movimentoMax}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ⌛
                      <span style={{ width: 54, display: 'inline-block' }}>
                        <Barra v={b.tempo} max={b.tempoMax} c={b.tempo <= 20 ? '#ff5a3a' : '#d8b45a'} fina />
                      </span>
                      <span style={{ color: b.tempo <= 20 ? '#ff8a6a' : undefined, minWidth: 24 }}>{b.tempo}s</span>
                    </span>
                  </>
                )}
                {b.fase === 'inimiga' && <span style={{ color: '#a8a090' }}>agindo…</span>}
                {b.mp?.aviso && <span style={{ color: '#ff9a8a' }}>{b.mp.aviso}</span>}
              </div>
              {b.fila && b.fase !== 'haki' && <FilaAgl fila={b.fila} meuLado={meuLado} />}
            </div>
          )}

          {b.fase === 'haki' && <PreparoHaki b={b} c={c} />}

          {/* barra de ações: com alguém selecionado; senão, só o Passar a vez */}
          {acoesVisiveis && (
            <div className="combate-dock">
              {dica && (
                <div className="painel dica">
                  <b>{dica.titulo}</b>
                  <div>
                    {dica.tags?.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div>{dica.texto}</div>
                </div>
              )}
              {skill && s?.previa && (
                <button className="confirmar-skill" disabled={b.animando} onClick={() => c.usarPrevia()}>
                  Usar {skill.nome}<kbd>ENTER</kbd>
                </button>
              )}
              {s ? (
                <BarraCombate key={s.id} s={s} c={c} b={b} mostrar={setDica} />
              ) : (
                !b.treino && (
                  <div className="painel acoes" style={{ alignItems: 'center' }}>
                    <span style={{ color: '#a8a090', padding: '0 8px', fontSize: 11.5 }}>Escolha um tripulante</span>
                    <button className="slot passar" onClick={() => c.passar()}>
                      <span className="ic">⏭</span>
                      <span className="rot">Passar a vez</span>
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* diário */}
          <div className={`painel diario${acoesVisiveis && s ? ' diario-em-combate' : ''}`} style={{ position: 'absolute', left: 8, bottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: verLog ? 2 : 0 }}>
              <span className="tit" style={{ fontSize: 11.5, color: '#d8b45a' }}>
                Diário
              </span>
              <span style={{ display: 'flex', gap: 3 }}>
                <button className={`bt${b.auto ? ' on' : ''}`} style={{ padding: '0 6px', fontSize: 10 }} onClick={() => c.alternarAuto()} title="A IA joga pela sua tripulação também">
                  Auto
                </button>
                <button className="bt" style={{ padding: '0 6px', fontSize: 10 }} onClick={() => mudarVelocidade(velocidade === 1 ? 2 : 1)} title="Velocidade das animações">
                  {velocidade}×
                </button>
                <button className="bt" style={{ padding: '0 6px', fontSize: 10 }} onClick={() => setVerLog(!verLog)} title={verLog ? 'Minimizar' : 'Mostrar'}>
                  {verLog ? '▾' : '▴'}
                </button>
              </span>
            </div>
            {verLog && (
              <div
                style={{ maxHeight: 74, overflow: 'auto' }}
                ref={(el) => {
                  if (el) el.scrollTop = el.scrollHeight
                }}
              >
                {b.log.slice(-10).map((l, i) => (
                  <div key={i} className="ent">
                    <span className="h">{hora(l.t)}</span>
                    <Colorido texto={l.texto} piratas={nomesP} marinha={nomesM} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* fim */}
          {b.fase === 'fim' && (
            <div className="tela">
              <div className="painel janela" style={{ textAlign: 'center', padding: '18px 40px' }}>
                <div className="tit" style={{ fontSize: 36, color: b.vencedor === meuLado ? '#ffe6a0' : '#ff9a8a' }}>
                  {!b.vencedor ? 'Partida encerrada' : b.vencedor === meuLado ? 'Vitória!' : 'Derrota'}
                </div>
                {b.mp?.aviso && <div style={{ color: '#ff9a8a', fontSize: 12 }}>{b.mp.aviso}</div>}
                <div style={{ margin: '4px 0 12px', font: '400 12.5px Georgia, serif', color: '#b8b0a0' }}>{b.turno} vezes de batalha</div>
                <button className="bt forte" style={{ fontSize: 15, padding: '4px 24px' }} onClick={() => c.novaBatalha()}>
                  {b.mp ? 'Voltar à sala' : 'Nova batalha'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
