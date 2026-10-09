import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ControleBatalha, HakiHud, RetratoBatalha, SkillHud } from './controle'
import { CUSTO_ARMAMENTO, REI_IMBUIDO } from './regras'
import { arteSkill } from './iconesSkills'
import './BarraCombate.css'

type Selecionado = NonNullable<RetratoBatalha['selecionado']>
export type DicaCombate = { titulo: string; texto: string; tags?: string[] } | null
type Simbolo = 'espada' | 'fruta' | 'coroa' | 'buff' | 'haki' | 'passar'

/** Símbolos discretos para cabeçalhos e controles; as skills usam pinturas nos atlas. */
function Icone({ tipo }: { tipo: Simbolo }) {
  const formas: Record<Simbolo, ReactNode> = {
    espada: <><path d="m8 19 12-12 1-5-5 1L4 15M3 13l8 8M6 18l-4 4"/><path d="m9 15 8-8"/></>,
    fruta: <><path d="M12 8c-8-5-12 8-6 13 3 2 5 0 6 0s3 2 6 0c6-5 2-18-6-13Zm0 0V3m0 2c0-4 5-4 7-3-1 3-4 4-7 3Z"/><path d="M6 12c3-3 5 4 8 1s5 2 3 4"/></>,
    coroa: <><path d="m3 7 5 4 4-8 4 8 5-4-2 12H5L3 7Zm2 15h14M12 13v3"/><circle cx="3" cy="5" r="1"/><circle cx="21" cy="5" r="1"/></>,
    buff: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7ZM2 2l2 2m16 16 2 2"/></>,
    haki: <><path d="m14 1-9 12h6l-1 10 9-14h-6l1-8Z"/><path d="M4 3 2 7m18 10 2 4"/></>,
    passar: <><path d="m4 4 12 8L4 20V4Zm16 0v16"/></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{formas[tipo]}</svg>
}

function ArteHabilidade({ id }: { id: string }) {
  const arte = arteSkill(id)
  return <span className={arte ? 'habilidade-arte' : 'habilidade-emblema'} style={arte} data-icone-skill={id} aria-hidden="true">{!arte && <Icone tipo="espada" />}</span>
}

function dicaSkill(k: SkillHud): DicaCombate {
  const areas: Record<string, string> = { alvo: '1 alvo', linha: 'Em linha', leque: 'Em leque', volta: 'Ao redor', si: 'Em si', mapa: 'Mapa inteiro' }
  return { titulo:k.nome, texto:k.motivo ?? k.descricao, tags:[
    k.espirito ? `${k.espirito} espírito` : k.energia ? `${k.energia} energia` : 'Sem custo de energia',
    ...(k.espera ? [`Recarga: ${k.espera} turnos`] : []), ...(k.alcance ? [`Alcance: ${k.alcance}`] : []),
    k.area === 'explosao' ? `Área ${k.raio*2+1} × ${k.raio*2+1}` : areas[k.area] ?? k.area,
    ...(k.livre ? ['Não encerra a vez'] : [])
  ] }
}

function rosto(url: string): CSSProperties {
  const k=32/72
  return { backgroundImage:`url(${url})`, backgroundSize:`${300*k}px auto`, backgroundPosition:`${-(150-36)*k}px ${-(90-36)*k}px` }
}

function ChaveHaki({ tipo, haki, bloqueado, alternar }: { tipo:'armamento'|'observacao'; haki:HakiHud|null; bloqueado:boolean; alternar:()=>void }) {
  const arm = tipo === 'armamento'
  const custo = haki?.avancado ? CUSTO_ARMAMENTO.avancado : CUSTO_ARMAMENTO.normal
  return <div className={`chave-haki ${arm ? 'armamento' : 'observacao'}${haki?.ligado ? ' ligada' : ''}`}>
    <div className="chave-simbolo"><ArteHabilidade id={tipo} /></div>
    <div className="chave-texto">
      <b>{arm ? 'Armamento' : 'Observação'}</b>
      <span>{!haki ? 'Não aprendido' : haki.imbuido ? 'Rei imbuído' : haki.avancado ? 'Avançado' : 'Normal'}{haki && ` · ${haki.usos}/${haki.max} usos`}</span>
    </div>
    <button type="button" className="interruptor-haki" role="switch" aria-checked={haki?.ligado ?? false} aria-label={`Haki de ${arm ? 'Armamento' : 'Observação'}`} disabled={bloqueado || !haki || (!haki.ligado && haki.usos<=0)} onClick={alternar}>
      <i /><span>{haki?.ligado ? 'Ligado' : 'Desligado'}</span>
    </button>
    {haki && <div className="chave-descricao">{arm
      ? `Reforça os ataques e atinge Logias. Gasta −${custo} de energia por golpe${haki.imbuido ? ` e −${REI_IMBUIDO.espirito} de espírito` : ''}.`
      : `Pode esquivar um ataque recebido. Consome 1 uso por ataque${haki.avancado ? '; também pode revidar de perto' : ''}.`}</div>}
  </div>
}

export function BarraCombate({ s, c, b, mostrar }: { s:Selecionado; c:ControleBatalha; b:RetratoBatalha; mostrar:(d:DicaCombate)=>void }) {
  const [hakiAberto, setHakiAberto] = useState(false)
  const root=useRef<HTMLDivElement>(null)
  const hakiBotao=useRef<HTMLButtonElement>(null)
  const popup=useRef<HTMLDivElement>(null)
  const bloqueado=b.animando || b.auto || b.fase!=='minha'
  const grupos = [
    { id:'arma', titulo:'Arma', icone:'espada' as const, skills:s.skills.filter(k=>k.origem==='arma'&&!k.buff) },
    { id:'fruta', titulo:'Fruta', icone:'fruta' as const, skills:s.skills.filter(k=>k.origem==='fruta'&&!k.buff) },
    { id:'haki', titulo:'Técnicas', icone:'coroa' as const, skills:s.skills.filter(k=>k.origem==='haki') },
  ]
  const buffs=s.skills.filter(k=>k.buff || k.origem==='suporte')
  const atalhos=grupos.flatMap(g=>g.skills).filter(k=>k.origem!=='haki').slice(0,9)
  const ligados=Number(!!s.armamento?.ligado)+Number(!!s.observacao?.ligado)

  useEffect(()=>{
    function tecla(ev:KeyboardEvent) {
      const el=ev.target as HTMLElement
      if (el.closest('input, select, textarea, [contenteditable="true"]') || ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat || bloqueado) return
      const key=ev.key.toLowerCase()
      if (key==='escape' && hakiAberto) { ev.stopImmediatePropagation();ev.preventDefault();setHakiAberto(false);hakiBotao.current?.focus();return }
      if (key==='h') {ev.preventDefault();setHakiAberto(v=>!v);mostrar(null)}
      else if (!hakiAberto && key==='r' && s.skills.some(k=>k.origem==='haki'&&!k.motivo)) {ev.preventDefault();c.escolherSkill('haoshoku');mostrar(null);if(root.current?.contains(el))el.blur()}
      else if (!hakiAberto && /^[1-9]$/.test(key)) {const skill=atalhos[Number(key)-1];if(skill&&!skill.motivo){ev.preventDefault();c.escolherSkill(skill.id);mostrar(null);if(root.current?.contains(el))el.blur()}}
      else if (!hakiAberto && key==='enter' && s.previa && (!(el instanceof HTMLButtonElement) || !!el.closest('.habilidade'))) {ev.preventDefault();c.usarPrevia()}
    }
    window.addEventListener('keydown',tecla,true)
    return ()=>window.removeEventListener('keydown',tecla,true)
  },[c,s,atalhos,bloqueado,hakiAberto,mostrar])

  useEffect(()=>{
    if (!hakiAberto) return
    popup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const fora=(ev:PointerEvent)=>{if(!root.current?.contains(ev.target as Node)){setHakiAberto(false);mostrar(null)}}
    document.addEventListener('pointerdown',fora)
    return ()=>document.removeEventListener('pointerdown',fora)
  },[hakiAberto,mostrar])

  function skillBotao(k:SkillHud, compacto=false) {
    const key=k.origem==='haki' ? 'R' : String(atalhos.indexOf(k)+1)
    const selecionada=s.skill===k.id
    const fruta=s.fruta?.nome.toLowerCase() ?? ''
    const tinta=k.fruta ? fruta.includes('fogo') ? '#f3ac7b' : fruta.includes('gelo') ? '#8edbff' : fruta.includes('luz') ? '#f4dd8e' : '#c6bcd9' : undefined
    return <div key={k.id} style={tinta ? {'--tinta':tinta} as CSSProperties : undefined} className={`habilidade ${k.origem}${compacto?' compacta':''}${selecionada?' selecionada':''}${k.motivo?' indisponivel':''}`} onMouseEnter={()=>!hakiAberto&&mostrar(dicaSkill(k))} onMouseLeave={()=>mostrar(null)}>
      <button type="button" disabled={bloqueado || !!k.motivo} aria-label={k.nome} aria-pressed={selecionada} onClick={()=>{c.escolherSkill(k.id);setHakiAberto(false);mostrar(null)}} onFocus={()=>!hakiAberto&&mostrar(dicaSkill(k))} onBlur={()=>mostrar(null)}>
        <ArteHabilidade id={k.id} />
        {!compacto && key!=='0' && <kbd>{key}</kbd>}
        <span className={`habilidade-custo${k.espirito?' espirito':''}`}>{k.espirito || k.energia || '•'}</span>
        {k.recarga>0 && <span className="habilidade-recarga"><strong>{k.recarga}</strong><small>turnos</small></span>}
        {compacto && <span className="habilidade-nome">{k.nome}</span>}
        <span className="marca-selecao" />
      </button>
    </div>
  }

  return <div ref={root} className={`barra-combate${bloqueado?' ocupada':''}`} aria-label="Habilidades de combate">
    <div className="combate-cabecalho">
      <div className="combatente-retrato" style={rosto(s.retrato)} />
      <div className="combatente-identidade"><b>{s.nome}</b></div>
      <div className="combate-recurso energia"><span>ENERGIA</span><b>{s.energia}<small> / 100</small></b><i><em style={{width:`${Math.max(0,Math.min(100,s.energia))}%`}} /></i></div>
      <div className="combate-recurso espirito"><span>ESPÍRITO</span><b>{s.espirito}<small> / 100</small></b><i><em style={{width:`${Math.max(0,Math.min(100,s.espirito))}%`}} /></i></div>
      <div className="combate-utilitarios">
        <button ref={hakiBotao} type="button" className={`abrir-haki${hakiAberto?' aberto':''}${ligados?' ativo':''}`} aria-expanded={hakiAberto} aria-controls={`haki-${s.id}`} onClick={()=>{setHakiAberto(v=>!v);mostrar(null)}}>
          <Icone tipo="haki"/><span>Haki</span><span className="haki-indicadores"><i className={s.armamento?.ligado?'arm-on':''}/><i className={s.observacao?.ligado?'obs-on':''}/></span><kbd>H</kbd>
        </button>
        {!b.treino && <button type="button" className="encerrar-vez" disabled={bloqueado} onClick={()=>c.passar()}><Icone tipo="passar"/><span>Passar a vez</span></button>}
      </div>
    </div>
    <div className="combate-ativas" aria-label="Skills ativas">
      {grupos.filter(g=>g.skills.length>0).map(g=><section key={g.id} className={`grupo-habilidades grupo-${g.id}`} aria-label={`Skills de ${g.titulo.toLowerCase()}`}>
        <div className="grupo-titulo"><Icone tipo={g.icone}/><span>{g.titulo}</span><i/></div>
        <div className="grupo-slots">{g.skills.map(k=>skillBotao(k))}</div>
      </section>)}
      {!s.fruta && <div className="fruta-ausente"><Icone tipo="fruta"/><span>Sem Akuma no Mi</span></div>}
    </div>
    {buffs.length>0 && <div className="combate-buffs" aria-label="Buffs e suporte"><span className="buffs-titulo"><Icone tipo="buff"/>Buffs & suporte</span>{buffs.map(k=>skillBotao(k,true))}{s.transformado>0 && <span className="buff-em-uso">Transformação ativa · {s.transformado} turnos</span>}</div>}
    {hakiAberto && <div ref={popup} id={`haki-${s.id}`} className="haki-painel" role="region" aria-label="Controle de Haki">
      <div className="haki-titulo"><Icone tipo="haki"/><b>Controle de Haki</b><button type="button" aria-label="Fechar Haki" onClick={()=>{setHakiAberto(false);hakiBotao.current?.focus()}}>×</button></div>
      <ChaveHaki tipo="armamento" haki={s.armamento} bloqueado={bloqueado} alternar={()=>c.alternarArmamento(s.id)}/>
      <ChaveHaki tipo="observacao" haki={s.observacao} bloqueado={bloqueado} alternar={()=>c.observar(s.id)}/>
      <div className="haki-rodape">Ativar ou desativar não encerra a vez.{s.rei && <span>Haki do Rei está na barra de skills.</span>}</div>
    </div>}
  </div>
}
