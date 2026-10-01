import { useCallback, useEffect, useRef, useState } from 'react'
import { FRUTAS, type Skill } from '../tabuleiro/batalha/armas'
import { aplicarConfig, combatentesIniciais, configPadrao } from '../tabuleiro/batalha/elenco'
import { ESPIRITO_MAX, ENERGIA_MAX, HAOSHOKU, REI_IMBUIDO } from '../tabuleiro/batalha/regras'
import { recurso } from '../tabuleiro/cena/visualFolhas'
import { CenaTurnos, type Estilo } from './CenaTurnos'
import { proximaAcao } from './ia'
import { Anel, IconeHaki, IconeSkill, corDaSkill } from './icones'
import { alcanceDe, alvosDe, aplicar, corpoACorpo, criar, fila, NOME_ALCANCE, outro, porId, proximaVez, skillsDe, vivos, vizinhos, type Acao, type Combatente, type Estado, type Ev } from './regras'

/**
 * Tela de teste do combate por turnos SEM tabuleiro: /teste-turnos
 * Regras do tabuleiro (energia, espírito, recargas, Haki, Logia, frutas),
 * vez individual pela agilidade. Interface no estilo do Honkai com a cara do
 * Grand Seas: o E abre o leque de skills (ícones redondos; a descrição só no
 * hover), o botão grande mostra a escolhida e o Espaço (ou clicar) usa.
 */

const base = import.meta.env.BASE_URL
const DOURADO = '#e8c26a'
const PERGAMINHO = '#f6ead0'
const MARINHO = 'rgba(12, 20, 34, 0.82)'
/** golpes grandes: entram com o cut-in */
const GRANDES = new Set(['entei', 'era-gelo', 'yasakani', 'prisao-fumaca', 'martelada-titanica'])
const retrato = (c: Combatente, tam: number, alto = tam): React.CSSProperties => ({
  width: tam,
  height: alto,
  backgroundImage: `url(${recurso(`${base}sprites/${c.id}/parado_S.png`)})`,
  backgroundSize: `${tam * 2.2}px ${tam * 2.2}px`,
  backgroundPosition: `center ${-tam * 0.42}px`,
  imageRendering: 'pixelated',
  backgroundRepeat: 'no-repeat',
})
/** tela de toque (celular): sem hover — tocar numa skill mostra a descrição */
const TOQUE = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
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
  // formação: o capitão e o comandante no meio da linha
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
  const [alvo, setAlvo] = useState('marinha-almirante')
  const [alvoAliado, setAlvoAliado] = useState('pirata-capitao')
  const [ocupado, setOcupado] = useState(true)
  const [escolha, setEscolha] = useState<string>('')
  const [leque, setLeque] = useState(false)
  const [dica, setDica] = useState<{ c: Combatente; s: Skill; x: number; y: number } | null>(null)
  const [cutin, setCutin] = useState<{ c: Combatente; nome: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [jogo, setJogo] = useState(0)
  const [rapido, setRapido] = useState(false)
  const [auto, setAuto] = useState(false)
  const fimDaVez = useRef<(() => void) | null>(null)
  // a interface foi desenhada para 1280×720: em telas menores (celular) encolhe junto
  const [k, setK] = useState(1)
  const [empe, setEmpe] = useState(false)
  useEffect(() => {
    const medir = () => {
      setK(Math.min(1, window.innerWidth / 1280, window.innerHeight / 720))
      setEmpe(window.innerHeight > window.innerWidth)
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  const alvoRef = useRef(alvo)
  const autoRef = useRef(auto)
  const velRef = useRef(1)
  useEffect(() => {
    alvoRef.current = alvo
  }, [alvo])
  useEffect(() => {
    autoRef.current = auto
    // ligou o automático na vez de um dos nossos: a IA assume esta vez
    if (auto) fimDaVez.current?.()
  }, [auto])
  useEffect(() => {
    velRef.current = rapido ? 2 : 1
    if (cena.current) cena.current.velocidade = velRef.current
  }, [rapido])

  useEffect(() => {
    if (!leque) setDica(null)
  }, [leque])

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
      const alvos = alvosDe(antes, ator, s, a.alvo).filter((id) => porId(antes, id).hp > 0)
      const apanham = new Set(ev.filter((v) => v.t === 'golpe' && v.dano > 0).map((v) => (v as { alvo: string }).alvo))
      await c.golpe(a.id, alvos, { estilo: estiloDe(ator, s, !!sk?.rei), efeito: efeitoDe(s), corpo: corpoACorpo(s), grande: GRANDES.has(s.id), apanham }, textos)
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
      // o alvo caiu: a mira passa para outro
      const ini = vivos(r.estado, 'marinha')
      if (ini.length && !ini.some((x) => x.id === alvoRef.current)) setAlvo(ini[Math.floor(ini.length / 2)].id)
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
        setLeque(false)
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
      setLeque(false)
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
  const alcance = skill ? alcanceDe(skill) : 'um'

  const usarSkill = useCallback(
    (s: Skill) => {
      if (!atual) return
      const al = alcanceDe(s)
      void jogar({ t: 'skill', id: atual.id, skill: s.id, alvo: al === 'aliado' ? alvoAliado : al === 'si' ? atual.id : alvo })
    },
    [atual, alvo, alvoAliado, jogar],
  )

  // teclado: Q básico, E skills, Espaço usa, A/D mira
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase()
      if (!atual || atual.lado !== 'piratas') return
      if (k === 'q') {
        const b = basicaDe(atual)
        if (escolha === b.id && !leque) usarSkill(b)
        setEscolha(b.id)
        setLeque(false)
      }
      if (k === 'e') setLeque((v) => !v)
      if (k === 'escape') setLeque(false)
      if (k === ' ') {
        ev.preventDefault()
        if (skill) usarSkill(skill)
      }
      if (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright') {
        const dir = k === 'a' || k === 'arrowleft' ? -1 : 1
        const aliado = alcance === 'aliado'
        const linha = vivos(est.current, aliado ? 'piratas' : 'marinha')
        const i = linha.findIndex((x) => x.id === (aliado ? alvoAliado : alvo))
        const j = Math.max(0, Math.min(linha.length - 1, i + dir))
        if (linha[j]) (aliado ? setAlvoAliado : setAlvo)(linha[j].id)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [atual, escolha, leque, skill, alcance, alvo, alvoAliado, usarSkill])

  const nossos = e.combatentes.filter((x) => x.lado === 'piratas')
  const inimigos = e.combatentes.filter((x) => x.lado === 'marinha')
  const naMira = new Set(!skill || !atual || alcance === 'si' || alcance === 'aliado' ? [] : alcance === 'todos' ? vivos(e, outro(atual.lado)).map((x) => x.id) : alcance === 'leque' ? [alvo, ...vizinhos(e, alvo)] : [alvo])
  const proximos = vivos(e).length ? fila(e, 8) : []
  const alvoC = porId(e, alvo)
  const podeSkill = (s: Skill) => !!atual && minhaVez && !atual.recargas[s.id] && atual.energia >= s.energia
  const outras = atual ? skills.filter((s) => s.id !== basicaDe(atual).id) : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1220', overflow: 'hidden', userSelect: 'none', font: '14px Georgia, serif', color: PERGAMINHO }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* camada que segue os inimigos: estado, vida e mira */}
      <div ref={camada} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {inimigos
          .filter((u) => u.hp > 0)
          .map((u) => (
            <div key={u.id}>
              <div data-segue={u.id} data-altura="1.06" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setAlvo(u.id)}>
                <div style={{ zoom: k, transform: 'translate(-50%, -100%)', width: u.id === 'marinha-almirante' ? 110 : 80 }}>
                  <Estados c={u} />
                  <Barra v={u.hp / u.hpMax} cor="#d9483b" alt={5} />
                </div>
              </div>
              {naMira.has(u.id) && minhaVez && (
                <div data-segue={u.id} data-altura="0.5" style={{ position: 'absolute', left: 0, top: 0 }}>
                  <div style={{ zoom: Math.max(0.6, k) }}>
                    <Mira principal={u.id === alvo} />
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* fila de ação (pela agilidade) */}
      <div style={{ zoom: k, position: 'absolute', left: 14, top: 14, display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 10, borderLeft: '1px solid rgba(232,194,106,0.35)' }}>
        {proximos.map((id, i) => {
          const u = porId(e, id)
          const nosso = u.lado === 'piratas'
          const w = i === 0 ? 92 : 74
          return (
            <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              {i === 0 && <span style={{ position: 'absolute', left: -19, color: DOURADO, fontSize: 12 }}>▶</span>}
              <span style={{ position: 'absolute', left: -14, width: 7, height: 7, borderRadius: 4, background: nosso ? '#5ad1c4' : '#d9483b' }} />
              <div style={{ ...retrato(u, w, i === 0 ? 50 : 38), backgroundColor: nosso ? 'rgba(30,48,70,0.85)' : 'rgba(70,24,24,0.8)', border: `1px solid ${i === 0 ? DOURADO : 'rgba(232,194,106,0.3)'}`, borderRadius: '4px 12px 4px 4px', boxShadow: i === 0 ? '0 0 10px rgba(232,194,106,0.5)' : undefined }} />
            </div>
          )
        })}
      </div>

      {/* alvo e controles (no alto) */}
      <div style={{ zoom: k, position: 'absolute', right: 14, top: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {alvoC && alvoC.hp > 0 && (
          <div style={{ ...painel, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px' }}>
            <div style={{ ...retrato(alvoC, 34), borderRadius: 17, backgroundColor: 'rgba(70,24,24,0.8)' }} />
            <div>
              <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, fontWeight: 700 }}>{alvoC.nome} ▸</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                {alvoC.hp}/{alvoC.hpMax}
                {alvoC.akuma && ` · ${FRUTAS[alvoC.akuma.fruta].nome}`}
                {alvoC.logia && ` · Logia ${alvoC.logia.cargas}/${alvoC.logia.max}`}
                {alvoC.haki.armamento && ` · Armamento ${alvoC.haki.armamento.usos}`}
                {alvoC.haki.observacao && ` · Observação ${alvoC.haki.observacao.usos}`}
                {alvoC.haki.rei && ' · Rei'}
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

      {/* tripulação (embaixo, à esquerda): vida, energia e espírito */}
      <div style={{ zoom: k, position: 'absolute', left: 16, bottom: TOQUE ? 12 : 44, display: 'flex', gap: 10 }}>
        {nossos.map((u) => {
          const daVez = atual?.id === u.id
          const mirado = alcance === 'aliado' && alvoAliado === u.id && minhaVez
          return (
            <div
              key={u.id}
              onClick={() => alcance === 'aliado' && u.hp > 0 && setAlvoAliado(u.id)}
              style={{ width: 112, opacity: u.hp > 0 ? 1 : 0.35, transform: daVez ? 'translateY(-10px)' : undefined, transition: 'transform 0.2s', cursor: alcance === 'aliado' ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ ...retrato(u, 58), borderRadius: '6px 6px 0 0', backgroundColor: daVez ? 'rgba(232,194,106,0.28)' : 'rgba(20,32,50,0.8)', borderBottom: `2px solid ${daVez ? DOURADO : 'transparent'}`, boxShadow: mirado ? '0 0 0 2px #6dff9a, 0 0 14px #6dff9a' : daVez ? '0 0 12px rgba(232,194,106,0.6)' : undefined }} />
                <div title="Espírito" style={{ marginBottom: 2 }}>
                  <Anel v={u.espirito / ESPIRITO_MAX} tam={30} cor="#b77bff" grossura={3}>
                    <span style={{ fontSize: 9 }}>{Math.round(u.espirito)}</span>
                  </Anel>
                </div>
              </div>
              <div style={{ marginTop: 3 }}>
                <Barra v={u.hp / u.hpMax} cor="#4fd1b5" alt={5} />
                <div style={{ height: 2 }} />
                <Barra v={u.energia / ENERGIA_MAX} cor="#5ab4e8" alt={3} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 1 }}>
                <span style={{ fontFamily: 'Cinzel, Georgia, serif' }}>{u.nome}</span>
                <span>{u.hp}</span>
              </div>
              <Estados c={u} />
            </div>
          )
        })}
      </div>

      {/* ações (embaixo, à direita) */}
      {atual && atual.lado === 'piratas' && skill && !auto && (
        <div style={{ zoom: k, position: 'absolute', right: TOQUE ? 24 : 52, bottom: TOQUE ? 16 : 50, width: 360, height: 270 }}>
          {/* leque de skills em volta do botão grande */}
          {leque &&
            outras.map((s, i) => {
              const n = outras.length
              const passo = n > 5 ? 26 : 32
              const ang = (238 + (i - (n - 1) / 2) * passo) * (Math.PI / 180)
              const x = 285 + Math.cos(ang) * 158 - 27
              const y = 190 + Math.sin(ang) * 158 - 27
              const pode = podeSkill(s)
              const rec = atual.recargas[s.id]
              return (
                <div key={s.id} style={{ position: 'absolute', left: x, top: y, animation: 'gs-surge 0.18s ease-out', textAlign: 'center' }}>
                  <BotaoRedondo tam={54} marcado={escolha === s.id} apagado={!pode} onClick={(p) => {
                      if (escolha === s.id && pode) return usarSkill(s)
                      setEscolha(s.id)
                      // sem hover no celular: tocar mostra a descrição; tocar de novo usa
                      if (TOQUE && p) setDica({ c: atual, s, ...p })
                    }} onHover={TOQUE ? undefined : (p) => setDica(p ? { c: atual, s, ...p } : null)}>
                    <IconeSkill s={s} arma={atual.arma} tam={27} />
                    {rec ? <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{rec}</span> : null}
                  </BotaoRedondo>
                  <div style={{ fontSize: 10, marginTop: 1, color: atual.energia >= s.energia ? '#8fd0ff' : '#ff8a7a' }}>{s.energia}</div>
                </div>
              )
            })}
          {/* Haki: ligar/desligar (não gasta a vez) */}
          <div style={{ position: 'absolute', left: 0, top: 222, display: 'flex', gap: 6 }}>
            {atual.haki.armamento && (
              <BotaoHaki tipo="armamento" ligado={atual.armamentoLigado} conta={atual.haki.armamento.usos} titulo={`Haki de armamento${atual.haki.armamento.avancado ? ' (avançado)' : ''}: usos ${atual.haki.armamento.usos}/${atual.haki.armamento.max}. Cada golpe com ele gasta 1.`} onClick={() => void jogar({ t: 'haki', id: atual.id, tipo: 'armamento', ligado: !atual.armamentoLigado })} />
            )}
            {atual.haki.rei && atual.haki.armamento?.avancado && (
              <BotaoHaki tipo="rei" ligado={atual.reiLigado} titulo={`Haki do Rei imbuído: ${REI_IMBUIDO.espirito} de espírito por golpe, mais dano e pode atordoar.`} onClick={() => void jogar({ t: 'haki', id: atual.id, tipo: 'rei', ligado: !atual.reiLigado })} />
            )}
            {atual.haki.observacao && (
              <BotaoHaki tipo="observacao" ligado={atual.observando} conta={atual.haki.observacao.usos} titulo={`Haki de observação${atual.haki.observacao.avancado ? ' (avançado: revida golpes de perto)' : ''}: usos ${atual.haki.observacao.usos}. Gasta 1 quando é atacado.`} onClick={() => void jogar({ t: 'observar', id: atual.id, ligado: !atual.observando })} />
            )}
            {atual.haki.rei && (
              <BotaoHaki tipo="haoshoku" ligado={false} apagado={atual.espirito < HAOSHOKU.espirito} titulo={`Haki do Rei em área: ${HAOSHOKU.espirito} de espírito; pode atordoar todos os inimigos mais fracos (não gasta a vez).`} onClick={() => void jogar({ t: 'haoshoku', id: atual.id })} />
            )}
            <button onClick={() => void jogar({ t: 'passar' })} disabled={!minhaVez} style={{ alignSelf: 'center', marginLeft: 4, background: 'transparent', border: '1px solid rgba(232,194,106,0.5)', color: PERGAMINHO, borderRadius: 12, padding: '3px 10px', font: '11px Georgia, serif', cursor: 'pointer' }}>
              Passar
            </button>
          </div>
          {/* botão das skills (E) */}
          <div style={{ position: 'absolute', left: 318, top: 96, textAlign: 'center' }}>
            <BotaoRedondo tam={56} tecla="E" marcado={leque || escolha !== basicaDe(atual).id} onClick={() => setLeque((v) => !v)}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={DOURADO} strokeWidth="1.8">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="18" r="3" />
              </svg>
            </BotaoRedondo>
            <div style={{ fontSize: 10, marginTop: 2, color: DOURADO }}>Skills</div>
          </div>
          {/* botão grande: a skill escolhida; clicar (ou Espaço) usa */}
          <div style={{ position: 'absolute', left: 225, top: 130 }}>
            <BotaoRedondo tam={118} tecla={skill.id === basicaDe(atual).id ? 'Q' : undefined} marcado={minhaVez} apagado={!podeSkill(skill)} grande onClick={() => usarSkill(skill)} onHover={TOQUE ? undefined : (p) => setDica(p ? { c: atual, s: skill, ...p } : null)}>
              <IconeSkill s={skill} arma={atual.arma} tam={58} />
            </BotaoRedondo>
            <div style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: '#1b1409', border: `1px solid ${DOURADO}`, borderRadius: 10, padding: '1px 10px', fontSize: 11 }}>{NOME_ALCANCE[alcance]}</div>
          </div>
          {/* nome da skill, energia e espírito de quem está na vez (some com o leque aberto) */}
          <div style={{ position: 'absolute', right: 150, top: 168, opacity: leque ? 0 : 1, transition: 'opacity 0.15s', textAlign: 'right', textShadow: '0 2px 4px #000', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: 11, color: DOURADO }}>
              {atual.nome} · {skill.energia ? `${skill.energia} de energia` : 'sem custo'}
              {skill.recarga ? ` · recarga ${skill.recarga}` : ''}
            </div>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 20, fontWeight: 700, color: corDaSkill(skill, atual.arma) }}>{skill.nome}</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              <span style={{ color: '#8fd0ff' }}>Energia {Math.round(atual.energia)}</span> · <span style={{ color: '#c9a2ff' }}>Espírito {Math.round(atual.espirito)}</span>
            </div>
          </div>
        </div>
      )}

      {/* descrição só no hover */}
      {dica && (
        <div style={{ zoom: k, position: 'fixed', left: Math.max(8, dica.x - 300 * k) / k, top: Math.max(8, dica.y - 50 * k) / k, width: 270, ...painel, padding: '10px 12px', pointerEvents: 'none', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconeSkill s={dica.s} arma={dica.c.arma} tam={20} />
            <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: 700, fontSize: 15 }}>{dica.s.nome}</span>
          </div>
          <div style={{ fontSize: 11, color: DOURADO, margin: '4px 0' }}>
            {NOME_ALCANCE[alcanceDe(dica.s)]} · {dica.s.energia ? `${dica.s.energia} de energia` : 'sem custo'}
            {dica.s.recarga ? ` · recarga ${dica.s.recarga}` : ''}
            {dica.s.mult > 0 && ` · ×${dica.s.mult}${dica.s.golpes ? ` × ${dica.s.golpes} golpes` : ''}`}
            {dica.s.livre && ' · não gasta a vez'}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>{dica.s.descricao}</div>
        </div>
      )}

      {aviso && <div style={{ position: 'absolute', left: '50%', bottom: 190, transform: 'translateX(-50%)', ...painel, padding: '6px 14px', fontSize: 13 }}>{aviso}</div>}

      {/* faixa de teclas (não no celular) */}
      {!TOQUE && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: 'linear-gradient(0deg, rgba(8,12,20,0.95), rgba(8,12,20,0.6))', borderTop: '1px solid rgba(232,194,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 22, paddingRight: 24, fontSize: 12 }}>
        <span style={{ marginRight: 'auto', marginLeft: 16, opacity: 0.5, fontSize: 11 }}>Grand Seas · combate por turnos (regras do tabuleiro, sem casas)</span>
        <Tecla t="A" /> Mira ←
        <Tecla t="D" /> Mira →
        <Tecla t="Q" /> Ataque
        <Tecla t="E" /> Skills
        <Tecla t="Espaço" /> Usar
      </div>}

      {cutin && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', animation: 'gs-cutin 1.15s ease-out' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', height: '40%', background: 'linear-gradient(100deg, rgba(10,14,26,0.94) 0%, rgba(30,50,80,0.88) 45%, rgba(232,194,106,0.55) 100%)', transform: 'skewY(-6deg)', borderTop: `2px solid ${DOURADO}`, borderBottom: `2px solid ${DOURADO}` }} />
          <div style={{ position: 'relative', marginLeft: '12%', ...retrato(cutin.c, 260), backgroundPosition: 'center -100px', filter: 'drop-shadow(0 0 18px #ffb347)' }} />
          <div style={{ position: 'relative', marginLeft: 24 }}>
            <div style={{ fontSize: 18, opacity: 0.85 }}>{cutin.c.nome}</div>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 54, fontWeight: 900, letterSpacing: 2, textShadow: '0 4px 0 #000, 0 0 20px #ff7a2e' }}>{cutin.nome}</div>
          </div>
        </div>
      )}

      {empe && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,14,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 24, zIndex: 10 }}>
          <div style={{ fontSize: 44 }}>⟲</div>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 22 }}>Vire o celular</div>
          <div style={{ opacity: 0.8 }}>A batalha é jogada com a tela deitada.</div>
        </div>
      )}

      {e.vencedor && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,14,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 50, fontWeight: 900 }}>{e.vencedor === 'piratas' ? 'Vitória!' : 'Derrota'}</div>
          <button onClick={() => setJogo((j) => j + 1)} style={{ font: '18px Georgia, serif', padding: '8px 20px', borderRadius: 8, border: `2px solid ${DOURADO}`, background: '#1b1409', color: PERGAMINHO, cursor: 'pointer' }}>
            Lutar de novo
          </button>
        </div>
      )}
      <style>{`
        @keyframes gs-cutin { 0% { opacity: 0; transform: translateX(-60px) } 15% { opacity: 1; transform: none } 85% { opacity: 1 } 100% { opacity: 0; transform: translateX(40px) } }
        @keyframes gs-surge { from { opacity: 0; transform: scale(0.6) } to { opacity: 1; transform: none } }
        @keyframes gs-gira { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

const painel: React.CSSProperties = { background: MARINHO, border: '1px solid rgba(232,194,106,0.45)', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }

/** Ícones pequenos do que está valendo no personagem (Haki ligado, Logia, efeitos). */
function Estados({ c }: { c: Combatente }) {
  const itens: [string, React.ReactNode][] = []
  if (c.armamentoLigado) itens.push(['Armamento ligado', <IconeHaki key="a" tipo="armamento" tam={12} cor="#cfd6e0" />])
  if (c.reiLigado) itens.push(['Rei imbuído', <IconeHaki key="r" tipo="rei" tam={12} cor="#d07bff" />])
  if (c.observando) itens.push(['Observação ligada', <IconeHaki key="o" tipo="observacao" tam={12} cor="#7fe3ff" />])
  if (c.logia && c.logia.cargas > 0) itens.push([`Logia: ${c.logia.cargas} cargas`, <span key="l" style={{ fontSize: 9, color: DOURADO }}>L{c.logia.cargas}</span>])
  if (c.atordoado) itens.push(['Atordoado: perde a próxima vez', <span key="t" style={{ fontSize: 9, color: '#d07bff' }}>✶</span>])
  if (c.queimadura) itens.push(['Queimando', <span key="q" style={{ fontSize: 9, color: '#ff8a3a' }}>♨</span>])
  if (c.akuma?.transformado) itens.push([`Transformado (${c.akuma.transformado})`, <span key="z" style={{ fontSize: 9, color: DOURADO }}>▲{c.akuma.transformado}</span>])
  if (!itens.length) return <div style={{ height: 14 }} />
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 14, marginBottom: 2 }}>
      {itens.map(([t, n]) => (
        <span key={t} title={t} style={{ width: 14, height: 14, borderRadius: 7, background: 'rgba(8,12,20,0.85)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {n}
        </span>
      ))}
    </div>
  )
}

function Barra({ v, cor, alt }: { v: number; cor: string; alt: number }) {
  return (
    <div style={{ height: alt, background: 'rgba(0,0,0,0.6)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.7)' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: cor, transition: 'width 0.35s' }} />
    </div>
  )
}

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

function BotaoRedondo({ tam, tecla, marcado, apagado, grande, onClick, onHover, children }: { tam: number; tecla?: string; marcado?: boolean; apagado?: boolean; grande?: boolean; onClick: (p?: { x: number; y: number }) => void; onHover?: (p: { x: number; y: number } | null) => void; children: React.ReactNode }) {
  return (
    <div
      onClick={(ev) => {
        const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
        onClick({ x: r.left, y: r.top + r.height / 2 })
      }}
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
      {children}
      {tecla && <span style={{ position: 'absolute', right: grande ? 4 : -4, top: grande ? 4 : -4, width: 20, height: 20, borderRadius: 10, background: '#1b1409', border: `1px solid ${DOURADO}`, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PERGAMINHO }}>{tecla}</span>}
    </div>
  )
}

function BotaoHaki({ tipo, ligado, conta, apagado, titulo, onClick }: { tipo: 'armamento' | 'rei' | 'observacao' | 'haoshoku'; ligado: boolean; conta?: number; apagado?: boolean; titulo: string; onClick: () => void }) {
  const cor = tipo === 'armamento' ? '#e6e9ef' : tipo === 'observacao' ? '#7fe3ff' : '#d07bff'
  return (
    <div title={titulo} onClick={onClick} style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', background: ligado ? 'radial-gradient(circle, #3a2a50, #120c1c)' : 'radial-gradient(circle, #1d2a40, #0b1220)', border: `2px solid ${ligado ? cor : 'rgba(232,194,106,0.4)'}`, boxShadow: ligado ? `0 0 12px ${cor}` : undefined, opacity: apagado ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconeHaki tipo={tipo} tam={22} cor={cor} />
      {conta !== undefined && <span style={{ position: 'absolute', right: -4, bottom: -4, minWidth: 16, height: 16, borderRadius: 8, background: '#1b1409', border: `1px solid ${DOURADO}`, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{conta}</span>}
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
