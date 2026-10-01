import { useCallback, useEffect, useRef, useState } from 'react'
import { FRUTAS, type Skill } from '../tabuleiro/batalha/armas'
import { aplicarConfig, combatentesIniciais, configPadrao } from '../tabuleiro/batalha/elenco'
import { ESPIRITO_MAX, ENERGIA_MAX, HAOSHOKU, REI_IMBUIDO } from '../tabuleiro/batalha/regras'
import { recurso } from '../tabuleiro/cena/visualFolhas'
import { COM_ARTE, CenaTurnos, type Estilo } from './CenaTurnos'
import { proximaAcao } from './ia'
import { IconeHaki, IconeSkill, corDaSkill } from './icones'
import { alvosDe, aplicar, corpoACorpo, criar, fila, miraDe, motivo, nomeDaMira, porId, proximaVez, skillsDe, vivos, type Acao, type Combatente, type Estado, type Ev } from './regras'

/**
 * Tela de teste do combate por turnos SEM tabuleiro: /teste-turnos
 * Regras do tabuleiro (energia, espírito, recargas, Haki, Logia, frutas),
 * vez individual pela agilidade, câmera na diagonal.
 *
 * Na vez de um dos nossos: escolhe a skill (botão Skills abre a fileira de
 * ícones; o ataque básico já vem escolhido), toca nos inimigos para mirar
 * (as skills de vários alvos deixam escolher quem quiser) e confirma no
 * botão grande. O Haki liga e desliga nos botões grandes da esquerda.
 * Feita primeiro para o celular deitado; no PC cresce junto com a tela.
 */

const base = import.meta.env.BASE_URL
const DOURADO = '#e8c26a'
const PERGAMINHO = '#f6ead0'
const MARINHO = 'rgba(12, 20, 34, 0.86)'
/** golpes grandes: entram com o cut-in */
const GRANDES = new Set(['entei', 'era-gelo', 'yasakani', 'prisao-fumaca', 'martelada-titanica'])
/** tela de toque (celular): sem hover — a descrição aparece no quadro da skill */
const TOQUE = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
const retrato = (c: Combatente, tam: number, alto = tam): React.CSSProperties =>
  COM_ARTE.has(c.id)
    ? {
        // arte desenhada: o rosto recortado da pose parada (cabeça perto do topo, no meio)
        width: tam,
        height: alto,
        backgroundImage: `url(${recurso(`${base}sprites/${c.id}/arte/parado.webp`)})`,
        backgroundSize: `${tam * 2.6}px auto`,
        backgroundPosition: `${tam / 2 - tam * 2.6 * 0.47}px ${alto / 2 - tam * 2.6 * 1.454 * 0.08}px`,
        backgroundRepeat: 'no-repeat',
        flex: 'none',
      }
    : {
  width: tam,
  height: alto,
  backgroundImage: `url(${recurso(`${base}sprites/${c.id}/parado_S.png`)})`,
  backgroundSize: `${tam * 2.2}px ${tam * 2.2}px`,
  backgroundPosition: `center ${-tam * 0.42}px`,
  imageRendering: 'pixelated',
  backgroundRepeat: 'no-repeat',
  flex: 'none',
}
const basicaDe = (c: Combatente) => skillsDe(c).find((s) => s.energia === 0 && !s.cura) ?? skillsDe(c)[0]

function estiloDe(c: Combatente, s: Skill, rei: boolean): Estilo {
  if (s.cura) return 'cura'
  if (s.transforma) return 'buff'
  if (rei) return 'haki'
  if (s.elemento) return s.elemento
  if (c.akuma && FRUTAS[c.akuma.fruta].skills.includes(s)) return 'impacto'
  return c.arma === 'espingarda' ? 'tiro' : c.arma === 'maca' ? 'impacto' : 'corte'
}
const efeitoDe = (s: Skill) => (s.id === 'hiken' ? 'hiken-perto' : s.id === 'hotarubi' || s.id === 'entei' ? s.id : undefined)

function novaBatalha() {
  // teste: o Lutador com a Fruta do Fogo (Hiken, Hotarubi, Enjōmō, Entei)
  const cfg = configPadrao()
  cfg.find((k) => k.id === 'pirata-lutador')!.akuma = 'fogo'
  // formação: o capitão e o comandante no meio da fileira
  const ordem = ['pirata-espadachim', 'pirata-lutador', 'pirata-capitao', 'pirata-atiradora', 'pirata-medico', 'marinha-oficial', 'marinha-soldado', 'marinha-almirante', 'marinha-atirador', 'marinha-enfermeira']
  const cs = aplicarConfig(combatentesIniciais(), cfg).sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id))
  return criar(cs)
}

export default function TelaTurnos() {
  const tela = useRef<HTMLCanvasElement>(null)
  const camada = useRef<HTMLDivElement>(null)
  const cena = useRef<CenaTurnos | null>(null)
  const [e, setE] = useState<Estado>(novaBatalha)
  const est = useRef(e)
  const trocar = useCallback((n: Estado) => {
    est.current = n
    setE(n)
  }, [])
  const [ocupado, setOcupado] = useState(true)
  const [escolha, setEscolha] = useState('')
  const [alvos, setAlvos] = useState<string[]>(['marinha-almirante'])
  const [aberto, setAberto] = useState(false)
  const [dica, setDica] = useState<{ c: Combatente; s: Skill; x: number; y: number } | null>(null)
  const [cutin, setCutin] = useState<{ c: Combatente; nome: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [jogo, setJogo] = useState(0)
  const [rapido, setRapido] = useState(false)
  const [auto, setAuto] = useState(false)
  const fimDaVez = useRef<(() => void) | null>(null)
  const autoRef = useRef(auto)
  const velRef = useRef(1)
  // desenhada para 900×420 (celular deitado); cresce no PC, encolhe em telas menores
  const [k, setK] = useState(1)
  const [empe, setEmpe] = useState(false)
  useEffect(() => {
    const medir = () => {
      setK(Math.max(0.7, Math.min(1.45, window.innerWidth / 900, window.innerHeight / 420)))
      setEmpe(window.innerHeight > window.innerWidth)
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  useEffect(() => {
    autoRef.current = auto
    // ligou o automático na vez de um dos nossos: a IA assume esta vez
    if (auto) fimDaVez.current?.()
  }, [auto])
  useEffect(() => {
    velRef.current = rapido ? 2 : 1
    if (cena.current) cena.current.velocidade = velRef.current
  }, [rapido])

  const avisar = useCallback((t: string) => {
    setAviso(t)
    setTimeout(() => setAviso((a) => (a === t ? null : a)), 1800)
  }, [])

  /** Mostra os eventos de uma ação na cena. */
  const animar = useCallback(async (antes: Estado, a: Acao, ev: Ev[]) => {
    const c = cena.current!
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms / velRef.current))
    const textos = () => {
      for (const v of ev) {
        if (v.t === 'golpe') {
          if (v.dano > 0) c.numero(v.alvo, v.efeito === 'critico' ? `${v.dano}!` : String(v.dano), v.efeito === 'critico' ? '#ffd35a' : v.efeito === 'bloqueou' ? '#b8c4d4' : '#ffffff', v.efeito === 'critico')
          else c.numero(v.alvo, v.efeito === 'observou' ? 'Previu!' : v.efeito === 'atravessou' ? 'Atravessou' : 'Esquivou', v.efeito === 'observou' ? '#7fe3ff' : '#cfd6e0')
          if (v.efeito === 'bloqueou') c.numero(v.alvo, 'Bloqueio', '#b8c4d4')
        }
        if (v.t === 'contra') c.numero(v.alvo, `${v.dano} revide`, '#ff8a7a')
        if (v.t === 'cura') c.numero(v.alvo, `+${v.valor}`, '#6dff9a', true)
        if (v.t === 'clash') c.numero(v.alvo, v.resultado === 'empate' ? 'Choque de Rei!' : v.resultado === 'venceu' ? 'Rei venceu!' : 'Rei perdeu!', '#d07bff', true)
        if (v.t === 'atordoou') c.numero(v.id, 'Atordoado!', '#d07bff')
        if (v.t === 'resistiu') c.numero(v.id, 'Resistiu', '#cfd6e0')
        if (v.t === 'congelou') c.numero(v.id, 'Congelado!', '#9be8ff')
        if (v.t === 'transformou') c.numero(v.id, 'Transformado!', DOURADO)
      }
    }
    if (a.t === 'haki') {
      c.brilho(a.id, a.tipo === 'rei' ? 0xb04cff : 0x404048)
      c.numero(a.id, a.ligado ? (a.tipo === 'rei' ? 'Rei imbuído!' : 'Armamento!') : 'Haki desligado', a.tipo === 'rei' ? '#d07bff' : '#cfd6e0')
      await espera(350)
    } else if (a.t === 'observar') {
      c.brilho(a.id, 0x7fe3ff)
      c.numero(a.id, a.ligado ? 'Observação' : 'Observação desligada', '#7fe3ff')
      await espera(350)
    } else if (a.t === 'haoshoku') {
      c.numero(a.id, 'Haki do Rei!', '#d07bff', true)
      await c.haoshoku(a.id)
      textos()
      await espera(400)
    } else if (a.t === 'skill') {
      const ator = porId(antes, a.id)
      const s = skillsDe(ator).find((x) => x.id === a.skill)!
      const sk = ev.find((v) => v.t === 'skill') as Extract<Ev, { t: 'skill' }> | undefined
      if (GRANDES.has(s.id)) {
        setCutin({ c: ator, nome: s.nome })
        await espera(1150)
        setCutin(null)
      }
      const atingidos = alvosDe(antes, ator, s, a.alvos).filter((id) => porId(antes, id).hp > 0)
      const apanham = new Set(ev.filter((v) => v.t === 'golpe' && v.dano > 0).map((v) => (v as { alvo: string }).alvo))
      await c.golpe(a.id, atingidos, { estilo: estiloDe(ator, s, !!sk?.rei), efeito: efeitoDe(s), corpo: corpoACorpo(s), grande: GRANDES.has(s.id), apanham }, textos)
    }
    await Promise.all(ev.filter((v) => v.t === 'caiu').map((v) => c.cair((v as { id: string }).id)))
  }, [])

  /** Faz uma ação (do jogador ou da IA) e anima. */
  const executar = useCallback(
    async (a: Acao) => {
      const antes = est.current
      const r = aplicar(antes, a)
      if ('erro' in r) {
        avisar(r.erro)
        return false
      }
      trocar(r.estado)
      await animar(antes, a, r.eventos)
      return true
    },
    [animar, avisar, trocar],
  )

  // laço da batalha
  useEffect(() => {
    let vivo = true
    const c = new CenaTurnos(tela.current!, camada.current!)
    c.velocidade = velRef.current
    cena.current = c
    const inicio = novaBatalha()
    trocar(inicio)
    void (async () => {
      await c.carregar(inicio.combatentes.map((x) => ({ id: x.id, sprite: x.id, lado: x.lado === 'piratas' ? 'nossos' : 'deles', chefe: x.id === 'marinha-almirante' })))
      await new Promise((r) => setTimeout(r, 500))
      while (vivo && !est.current.vencedor) {
        if (!est.current.atual) {
          const r = proximaVez(est.current)
          trocar(r.estado)
          for (const v of r.eventos) {
            if (v.t === 'queimou') c.numero(v.id, `${v.dano} queimadura`, '#ff8a3a')
            if (v.t === 'recuperou') c.numero(v.id, 'Armamento +1', '#cfd6e0')
            if (v.t === 'perdeu') c.numero(v.id, 'Perdeu a vez', '#d07bff', true)
          }
          if (!r.estado.atual) {
            await new Promise((ok) => setTimeout(ok, 700 / velRef.current))
            continue
          }
        }
        const atual = porId(est.current, est.current.atual!)
        c.marcarAtual(atual.id)
        setEscolha(basicaDe(atual).id)
        setAberto(false)
        if (atual.lado === 'marinha' || autoRef.current) {
          await new Promise((ok) => setTimeout(ok, 450 / velRef.current))
          let n = 0
          while (vivo && est.current.atual === atual.id && !est.current.vencedor && n++ < 8) {
            if (!(await executar(proximaAcao(est.current)))) await executar({ t: 'passar' })
          }
          if (est.current.atual === atual.id) await executar({ t: 'passar' })
          continue
        }
        setOcupado(false)
        await new Promise<void>((ok) => (fimDaVez.current = ok))
        fimDaVez.current = null
        setOcupado(true)
      }
      c.marcarAtual(null)
    })()
    return () => {
      vivo = false
      fimDaVez.current?.()
      c.destruir()
    }
  }, [jogo, executar, trocar])

  /** Ação do jogador (a vez acaba quando o golpe gasta a vez). */
  const jogar = useCallback(
    async (a: Acao) => {
      if (ocupado) return
      setOcupado(true)
      setAberto(false)
      setDica(null)
      await executar(a)
      if (!est.current.atual || est.current.vencedor) fimDaVez.current?.()
      else setOcupado(false)
    },
    [ocupado, executar],
  )

  const atual = e.atual ? porId(e, e.atual) : null
  const minhaVez = !!atual && atual.lado === 'piratas' && !ocupado && !auto
  const skills = atual ? skillsDe(atual) : []
  const skill = skills.find((s) => s.id === escolha) ?? (atual ? basicaDe(atual) : null)
  const mira = skill ? miraDe(skill) : { tipo: 'um' as const, n: 1 }

  // os alvos escolhidos continuam valendo? (morreram, trocou de skill) — senão, um padrão
  const ladoAlvo = mira.tipo === 'aliado' ? 'piratas' : 'marinha'
  const validos = alvos.filter((id) => {
    const x = e.combatentes.find((c) => c.id === id)
    return x && x.hp > 0 && x.lado === ladoAlvo
  })
  const padrao = (() => {
    const lista = vivos(e, ladoAlvo)
    if (!lista.length) return []
    if (mira.tipo === 'aliado') return [lista.reduce((a, b) => (b.hp / b.hpMax < a.hp / a.hpMax ? b : a)).id]
    return [lista[Math.floor(lista.length / 2)].id]
  })()
  const escolhidos = (validos.length ? validos : padrao).slice(0, mira.tipo === 'varios' ? mira.n : 1)
  const atingidos = atual && skill && mira.tipo !== 'si' && mira.tipo !== 'aliado' ? alvosDe(e, atual, skill, escolhidos) : []
  const acao: Acao | null = atual && skill ? { t: 'skill', id: atual.id, skill: skill.id, alvos: escolhidos } : null
  const problema = acao ? motivo(e, acao) : 'Aguarde.'

  /** Tocou num personagem (na cena ou na barra): mira nele. */
  const mirar = useCallback(
    (id: string) => {
      if (!minhaVez) return
      const x = est.current.combatentes.find((c) => c.id === id)
      if (!x || x.hp <= 0 || x.lado !== ladoAlvo) return
      if (mira.tipo === 'varios') {
        setAlvos(() => {
          const atual = escolhidos.includes(id) ? escolhidos.filter((a) => a !== id) : [...escolhidos, id]
          return atual.slice(-mira.n)
        })
      } else setAlvos([id])
    },
    [minhaVez, ladoAlvo, mira.tipo, mira.n, escolhidos],
  )

  const usar = useCallback(() => {
    if (!acao || problema) {
      if (problema) avisar(problema)
      return
    }
    void jogar(acao)
  }, [acao, problema, avisar, jogar])

  const escolher = (s: Skill) => {
    setEscolha(s.id)
    if (TOQUE) setAberto(false)
  }

  // teclado (PC): Q básico, E skills, Espaço usa, A/D trocam o alvo
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const t = ev.key.toLowerCase()
      if (!atual || atual.lado !== 'piratas') return
      if (t === 'q') {
        setEscolha(basicaDe(atual).id)
        setAberto(false)
      }
      if (t === 'e') setAberto((v) => !v)
      if (t === 'escape') setAberto(false)
      if (t === ' ') {
        ev.preventDefault()
        usar()
      }
      if (t === 'a' || t === 'd' || t === 'arrowleft' || t === 'arrowright') {
        const linha = vivos(est.current, ladoAlvo)
        const i = linha.findIndex((x) => x.id === escolhidos[escolhidos.length - 1])
        const j = Math.max(0, Math.min(linha.length - 1, i + (t === 'a' || t === 'arrowleft' ? -1 : 1)))
        if (linha[j]) setAlvos([linha[j].id])
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [atual, ladoAlvo, escolhidos, usar])

  const nossos = e.combatentes.filter((x) => x.lado === 'piratas')
  const inimigos = e.combatentes.filter((x) => x.lado === 'marinha')
  const proximos = vivos(e).length ? fila(e, 9) : []
  const podeSkill = (s: Skill) => !!atual && !atual.recargas[s.id] && atual.energia >= s.energia
  const instrucao = !minhaVez
    ? ''
    : mira.tipo === 'varios'
      ? `Toque nos inimigos: ${escolhidos.length} de ${mira.n}`
      : mira.tipo === 'um' || mira.tipo === 'area'
        ? `Alvo: ${porId(e, escolhidos[0] ?? '')?.nome ?? '—'} (toque para trocar)`
        : mira.tipo === 'aliado'
          ? `Cura: ${porId(e, escolhidos[0] ?? '')?.nome ?? '—'} (toque num aliado)`
          : mira.tipo === 'todos'
            ? 'Atinge todos os inimigos'
            : 'Em si mesmo'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1220', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', font: '14px Georgia, serif', color: PERGAMINHO, touchAction: 'manipulation' }}>
      <canvas
        ref={tela}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onClick={(ev) => {
          const r = (ev.currentTarget as HTMLCanvasElement).getBoundingClientRect()
          const id = cena.current?.pegar(ev.clientX - r.left, ev.clientY - r.top)
          if (id) mirar(id)
          setAberto(false)
        }}
      />

      {/* sobre os inimigos: só a vida; a mira em quem será atingido */}
      <div ref={camada} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[...inimigos, ...nossos]
          .filter((u) => u.hp > 0)
          .map((u) => (
            <div key={u.id}>
              {u.lado === 'marinha' && (
                <div data-segue={u.id} data-altura="1.05" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'auto' }} onClick={() => mirar(u.id)}>
                  <div style={{ transform: `translate(-50%, -100%) scale(${k})`, transformOrigin: '50% 100%', width: u.id === 'marinha-almirante' ? 84 : 64, padding: '6px 0' }}>
                    <Barra v={u.hp / u.hpMax} cor="#d9483b" alt={5} />
                  </div>
                </div>
              )}
              {minhaVez && (atingidos.includes(u.id) || (mira.tipo === 'aliado' && escolhidos.includes(u.id))) && (
                <div data-segue={u.id} data-altura="0.5" style={{ position: 'absolute', left: 0, top: 0 }}>
                  <div style={{ transform: `scale(${k})`, transformOrigin: '0 0' }}>
                    <Mira principal={escolhidos.includes(u.id)} cura={mira.tipo === 'aliado'} />
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* fila de ação (pela agilidade), no alto à esquerda */}
      <div style={{ transform: `scale(${k})`, transformOrigin: 'top left', position: 'absolute', left: 8, top: 8, display: 'flex', alignItems: 'flex-end', gap: 4, ...painel, padding: '4px 6px' }}>
        {proximos.map((id, i) => {
          const u = porId(e, id)
          const nosso = u.lado === 'piratas'
          const t = i === 0 ? 42 : 32
          return <div key={i} title={u.nome} style={{ ...retrato(u, t), borderRadius: 6, backgroundColor: nosso ? 'rgba(40,70,90,0.9)' : 'rgba(80,28,28,0.9)', borderBottom: `3px solid ${nosso ? '#5ad1c4' : '#d9483b'}`, outline: i === 0 ? `2px solid ${DOURADO}` : undefined }} />
        })}
      </div>

      {/* velocidade e automático */}
      <div style={{ transform: `scale(${k})`, transformOrigin: 'top right', position: 'absolute', right: 8, top: 8, display: 'flex', gap: 6 }}>
        <BotaoTopo ativo={rapido} onClick={() => setRapido((v) => !v)}>2×</BotaoTopo>
        <BotaoTopo ativo={auto} onClick={() => setAuto((v) => !v)}>AUTO</BotaoTopo>
      </div>

      {/* tripulação (embaixo, à esquerda) e, na vez de um deles, o Haki em cima */}
      <div style={{ transform: `scale(${k})`, transformOrigin: 'bottom left', position: 'absolute', left: 8, bottom: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        {atual && atual.lado === 'piratas' && !auto && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {atual.haki.armamento && (
              <BotaoHaki tipo="armamento" nome="Armamento" ligado={atual.armamentoLigado} conta={`${atual.haki.armamento.usos}`} apagado={!minhaVez} onClick={() => void jogar({ t: 'haki', id: atual.id, tipo: 'armamento', ligado: !atual.armamentoLigado })} />
            )}
            {atual.haki.rei && atual.haki.armamento?.avancado && (
              <BotaoHaki tipo="rei" nome="Rei imbuído" ligado={atual.reiLigado} conta={`${REI_IMBUIDO.espirito}✦`} apagado={!minhaVez || (!atual.reiLigado && atual.espirito < REI_IMBUIDO.espirito)} onClick={() => void jogar({ t: 'haki', id: atual.id, tipo: 'rei', ligado: !atual.reiLigado })} />
            )}
            {atual.haki.observacao && (
              <BotaoHaki tipo="observacao" nome="Observação" ligado={atual.observando} conta={`${atual.haki.observacao.usos}`} apagado={!minhaVez} onClick={() => void jogar({ t: 'observar', id: atual.id, ligado: !atual.observando })} />
            )}
            {atual.haki.rei && (
              <BotaoHaki tipo="haoshoku" nome="Haki do Rei" ligado={false} conta={`${HAOSHOKU.espirito}✦`} apagado={!minhaVez || atual.espirito < HAOSHOKU.espirito} onClick={() => void jogar({ t: 'haoshoku', id: atual.id })} />
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {nossos.map((u) => {
            const daVez = atual?.id === u.id
            const curando = mira.tipo === 'aliado' && minhaVez
            return (
              <div
                key={u.id}
                onClick={() => curando && mirar(u.id)}
                style={{ ...painel, width: 92, padding: 4, opacity: u.hp > 0 ? 1 : 0.35, borderColor: daVez ? DOURADO : curando && escolhidos.includes(u.id) ? '#6dff9a' : 'rgba(232,194,106,0.3)', boxShadow: daVez ? '0 0 10px rgba(232,194,106,0.55)' : undefined, transform: daVez ? 'translateY(-6px)' : undefined, transition: 'transform 0.2s', cursor: curando ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ ...retrato(u, 30), borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nome}</div>
                    <Selos c={u} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2 }}>
                  <span style={{ color: '#7fe8cf' }}>{u.hp}</span>
                  <span style={{ opacity: 0.6 }}>/{u.hpMax}</span>
                </div>
                <Barra v={u.hp / u.hpMax} cor="#4fd1b5" alt={4} />
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  <div style={{ flex: 1 }} title="Energia">
                    <Barra v={u.energia / ENERGIA_MAX} cor="#5ab4e8" alt={3} />
                  </div>
                  <div style={{ flex: 1 }} title="Espírito">
                    <Barra v={u.espirito / ESPIRITO_MAX} cor="#b77bff" alt={3} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ações (embaixo, à direita) */}
      {atual && atual.lado === 'piratas' && skill && !auto && (
        <div style={{ transform: `scale(${k})`, transformOrigin: 'bottom right', position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: 400 }}>
          {/* quadro da skill escolhida: nome, alvos e (no celular) a descrição */}
          <div style={{ ...painel, padding: '6px 10px', maxWidth: 300, textAlign: 'right' }}>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, fontWeight: 700, color: corDaSkill(skill, atual.arma) }}>{skill.nome}</div>
            <div style={{ fontSize: 11, color: DOURADO }}>
              {nomeDaMira(mira)} · {skill.energia ? `${skill.energia} de energia` : 'sem custo'}
              {skill.recarga ? ` · recarga ${skill.recarga}` : ''}
              {skill.livre ? ' · não gasta a vez' : ''}
            </div>
            {TOQUE && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, lineHeight: 1.35 }}>{skill.descricao}</div>}
            <div style={{ fontSize: 12, marginTop: 3, color: '#ffb07a' }}>{instrucao}</div>
          </div>
          {/* fileira de skills (abre no botão Skills) */}
          {aberto && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', ...painel, padding: 6, animation: 'gs-surge 0.15s ease-out' }}>
              {skills.map((s) => {
                const rec = atual.recargas[s.id]
                return (
                  <div key={s.id} style={{ textAlign: 'center', width: 52 }}>
                    <BotaoRedondo tam={48} marcado={escolha === s.id} apagado={!podeSkill(s)} onClick={() => escolher(s)} onHover={TOQUE ? undefined : (p) => setDica(p ? { c: atual, s, ...p } : null)}>
                      <IconeSkill s={s} arma={atual.arma} tam={24} />
                      {rec ? <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700 }}>{rec}</span> : null}
                    </BotaoRedondo>
                    <div style={{ fontSize: 10, marginTop: 1, color: atual.energia >= s.energia ? '#8fd0ff' : '#ff8a7a' }}>{s.energia || '—'}</div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => void jogar({ t: 'passar' })} disabled={!minhaVez} style={{ ...painel, color: PERGAMINHO, height: 36, padding: '0 12px', font: '13px Georgia, serif', opacity: minhaVez ? 1 : 0.5 }}>
              Passar
            </button>
            <div style={{ textAlign: 'center' }}>
              <BotaoRedondo tam={58} marcado={aberto} onClick={() => setAberto((v) => !v)}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={DOURADO} strokeWidth="1.8">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="18" r="3" />
                </svg>
              </BotaoRedondo>
              <div style={{ fontSize: 11, color: DOURADO }}>Skills</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <BotaoRedondo tam={84} marcado={minhaVez && !problema} apagado={!minhaVez || !!problema} grande onClick={usar} onHover={TOQUE ? undefined : (p) => setDica(p ? { c: atual, s: skill, ...p } : null)}>
                <IconeSkill s={skill} arma={atual.arma} tam={40} />
              </BotaoRedondo>
              <div style={{ fontSize: 12, fontWeight: 700, color: DOURADO, marginTop: 2 }}>Usar</div>
            </div>
          </div>
        </div>
      )}

      {/* descrição no hover (PC) */}
      {dica && !TOQUE && (
        <div style={{ position: 'fixed', left: Math.max(8, dica.x - 290), top: Math.max(8, dica.y - 60), width: 270, ...painel, padding: '10px 12px', pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconeSkill s={dica.s} arma={dica.c.arma} tam={20} />
            <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: 700, fontSize: 15 }}>{dica.s.nome}</span>
          </div>
          <div style={{ fontSize: 11, color: DOURADO, margin: '4px 0' }}>
            {nomeDaMira(miraDe(dica.s))} · {dica.s.energia ? `${dica.s.energia} de energia` : 'sem custo'}
            {dica.s.recarga ? ` · recarga ${dica.s.recarga}` : ''}
            {dica.s.mult > 0 && ` · ×${dica.s.mult}${dica.s.golpes ? ` × ${dica.s.golpes} golpes` : ''}`}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>{dica.s.descricao}</div>
        </div>
      )}

      {aviso && <div style={{ position: 'absolute', left: '50%', top: 60 * k, transform: `translateX(-50%) scale(${k})`, transformOrigin: 'top center', ...painel, padding: '6px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>{aviso}</div>}

      {cutin && COM_ARTE.has(cutin.c.id) && (
        // com arte: a splash inteira numa faixa inclinada, o nome do golpe no vazio da esquerda
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', animation: 'gs-cutin 1.15s ease-out' }}>
          <div style={{ position: 'absolute', left: '-5%', right: '-5%', top: '18%', height: '64%', backgroundImage: `url(${recurso(`${base}sprites/${cutin.c.id}/arte/splash.webp`)})`, backgroundSize: 'cover', backgroundPosition: '70% 30%', transform: 'skewY(-6deg)', borderTop: `3px solid ${DOURADO}`, borderBottom: `3px solid ${DOURADO}`, boxShadow: '0 0 40px rgba(0,0,0,0.7)' }} />
          <div style={{ position: 'relative', marginLeft: '6%', transform: `scale(${k})`, transformOrigin: 'left center' }}>
            <div style={{ fontSize: 16, color: '#0e1a2c', fontWeight: 700, textShadow: '0 0 8px #fff' }}>{cutin.c.nome}</div>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 40, fontWeight: 900, letterSpacing: 2, textShadow: '0 4px 0 #000, 0 0 20px #4aa3ff' }}>{cutin.nome}</div>
          </div>
        </div>
      )}
      {cutin && !COM_ARTE.has(cutin.c.id) && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', animation: 'gs-cutin 1.15s ease-out' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', height: '40%', background: 'linear-gradient(100deg, rgba(10,14,26,0.94) 0%, rgba(30,50,80,0.88) 45%, rgba(232,194,106,0.55) 100%)', transform: 'skewY(-6deg)', borderTop: `2px solid ${DOURADO}`, borderBottom: `2px solid ${DOURADO}` }} />
          <div style={{ position: 'relative', marginLeft: '10%', ...retrato(cutin.c, 200 * k), filter: 'drop-shadow(0 0 18px #ffb347)' }} />
          <div style={{ position: 'relative', marginLeft: 20, transform: `scale(${k})`, transformOrigin: 'left center' }}>
            <div style={{ fontSize: 16, opacity: 0.85 }}>{cutin.c.nome}</div>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 40, fontWeight: 900, letterSpacing: 2, textShadow: '0 4px 0 #000, 0 0 20px #ff7a2e' }}>{cutin.nome}</div>
          </div>
        </div>
      )}

      {empe && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,14,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 24, zIndex: 10 }}>
          <div style={{ fontSize: 44 }}>⟲</div>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 22 }}>Vire o celular</div>
          <div style={{ opacity: 0.8 }}>A batalha é jogada com a tela deitada.</div>
        </div>
      )}

      {e.vencedor && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,14,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 46, fontWeight: 900 }}>{e.vencedor === 'piratas' ? 'Vitória!' : 'Derrota'}</div>
          <button onClick={() => setJogo((j) => j + 1)} style={{ font: '18px Georgia, serif', padding: '10px 22px', borderRadius: 8, border: `2px solid ${DOURADO}`, background: '#1b1409', color: PERGAMINHO, cursor: 'pointer' }}>
            Lutar de novo
          </button>
        </div>
      )}
      <style>{`
        @keyframes gs-cutin { 0% { opacity: 0; transform: translateX(-60px) } 15% { opacity: 1; transform: none } 85% { opacity: 1 } 100% { opacity: 0; transform: translateX(40px) } }
        @keyframes gs-surge { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes gs-gira { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

const painel: React.CSSProperties = { background: MARINHO, border: '1px solid rgba(232,194,106,0.45)', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }

/** Selos do que está valendo no tripulante (Haki ligado, Logia, efeitos). */
function Selos({ c }: { c: Combatente }) {
  const itens: [string, React.ReactNode][] = []
  if (c.armamentoLigado) itens.push(['Armamento ligado', <IconeHaki key="a" tipo="armamento" tam={11} cor="#e6e9ef" />])
  if (c.reiLigado) itens.push(['Rei imbuído', <IconeHaki key="r" tipo="rei" tam={11} cor="#d07bff" />])
  if (c.observando) itens.push(['Observação ligada', <IconeHaki key="o" tipo="observacao" tam={11} cor="#7fe3ff" />])
  if (c.logia && c.logia.cargas > 0) itens.push([`Logia: ${c.logia.cargas} cargas`, <span key="l" style={{ fontSize: 9, color: DOURADO }}>L{c.logia.cargas}</span>])
  if (c.atordoado) itens.push(['Atordoado', <span key="t" style={{ fontSize: 9, color: '#d07bff' }}>✶</span>])
  if (c.queimadura) itens.push(['Queimando', <span key="q" style={{ fontSize: 9, color: '#ff8a3a' }}>♨</span>])
  if (c.akuma?.transformado) itens.push([`Transformado (${c.akuma.transformado})`, <span key="z" style={{ fontSize: 9, color: DOURADO }}>▲</span>])
  return (
    <div style={{ display: 'flex', gap: 2, height: 12 }}>
      {itens.map(([t, n]) => (
        <span key={t} title={t} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {n}
        </span>
      ))}
    </div>
  )
}

function Barra({ v, cor, alt }: { v: number; cor: string; alt: number }) {
  return (
    <div style={{ height: alt, background: 'rgba(0,0,0,0.6)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.7)', borderRadius: 2 }}>
      <div style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: cor, transition: 'width 0.35s' }} />
    </div>
  )
}

function Mira({ principal, cura }: { principal: boolean; cura: boolean }) {
  const t = principal ? 62 : 46
  const c = cura ? '#6dff9a' : '#ff7a3a'
  return (
    <svg width={t} height={t} viewBox="0 0 64 64" style={{ transform: 'translate(-50%, -50%)', filter: `drop-shadow(0 0 6px ${c})` }}>
      <g style={{ transformOrigin: '32px 32px', animation: 'gs-gira 6s linear infinite' }}>
        <circle cx="32" cy="32" r="24" fill="none" stroke={c} strokeWidth="3" strokeDasharray="30 8" />
        {[0, 120, 240].map((a) => (
          <path key={a} d="M32 2 L28 9 L36 9 Z" fill={c} transform={`rotate(${a} 32 32)`} />
        ))}
      </g>
      {principal && <circle cx="32" cy="32" r="11" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" />}
      <circle cx="32" cy="32" r="3" fill="#fff" />
    </svg>
  )
}

function BotaoRedondo({ tam, marcado, apagado, grande, onClick, onHover, children }: { tam: number; marcado?: boolean; apagado?: boolean; grande?: boolean; onClick: () => void; onHover?: (p: { x: number; y: number } | null) => void; children: React.ReactNode }) {
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
        cursor: 'pointer',
        background: 'radial-gradient(circle at 50% 40%, #24344e, #0d1626 70%)',
        border: `${grande ? 3 : 2}px solid ${marcado ? DOURADO : 'rgba(232,194,106,0.45)'}`,
        boxShadow: marcado ? `0 0 ${grande ? 22 : 12}px rgba(232,194,106,0.65), inset 0 0 12px rgba(232,194,106,0.25)` : 'inset 0 0 10px rgba(0,0,0,0.6)',
        opacity: apagado ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        flex: 'none',
      }}
    >
      {children}
    </div>
  )
}

/** Botão grande de Haki: ícone, nome e o que custa/sobra. Aceso quando ligado. */
function BotaoHaki({ tipo, nome, ligado, conta, apagado, onClick }: { tipo: 'armamento' | 'rei' | 'observacao' | 'haoshoku'; nome: string; ligado: boolean; conta: string; apagado?: boolean; onClick: () => void }) {
  const cor = tipo === 'armamento' ? '#e6e9ef' : tipo === 'observacao' ? '#7fe3ff' : '#d07bff'
  return (
    <button
      onClick={onClick}
      disabled={apagado}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        padding: '0 12px 0 8px',
        borderRadius: 20,
        cursor: apagado ? 'default' : 'pointer',
        background: ligado ? `linear-gradient(180deg, ${cor}33, ${cor}11), #141c2c` : 'rgba(12,20,34,0.88)',
        border: `2px solid ${ligado ? cor : 'rgba(232,194,106,0.45)'}`,
        boxShadow: ligado ? `0 0 12px ${cor}` : undefined,
        color: PERGAMINHO,
        opacity: apagado ? 0.45 : 1,
        font: '13px Georgia, serif',
      }}
    >
      <IconeHaki tipo={tipo} tam={22} cor={cor} />
      <span style={{ fontWeight: 700 }}>{nome}</span>
      <span style={{ fontSize: 11, color: DOURADO }}>{conta}</span>
      {tipo !== 'haoshoku' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: ligado ? cor : 'rgba(255,255,255,0.12)', color: ligado ? '#111' : PERGAMINHO }}>{ligado ? 'LIGADO' : 'desligado'}</span>}
    </button>
  )
}

function BotaoTopo({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ minWidth: 52, height: 36, borderRadius: 8, border: `1px solid ${DOURADO}`, background: ativo ? DOURADO : 'rgba(12,20,34,0.86)', color: ativo ? '#1b1409' : PERGAMINHO, font: '700 13px Georgia, serif', cursor: 'pointer' }}>
      {children}
    </button>
  )
}
