import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  NOMES_ANIM,
  VISTAS,
  carregarImagem,
  desenharPose,
  estadoVazio,
  matrizes,
  poseEm,
  projetoNovo,
  recortarPeca,
  type Animacao,
  type EstadoEncaixe,
  type NomeAnimacao,
  type NomeVista,
  type Peca,
  type Pose,
  type Projeto,
} from './projeto'

/**
 * Editor de animação recortada (estilo Wakfu/Flash), em /editor-animacao.
 *
 * 1. Folhas: arraste um retângulo em volta de uma parte (fundo magenta sai
 *    sozinho) e "Criar peça"; marque o pivô clicando na peça.
 * 2. Palco: escolha a peça de cada encaixe (troca de desenho) e monte a pose
 *    por cima da figura de referência — arrastar move, Alt/botão direito
 *    gira, Shift estica.
 * 3. Linha do tempo: quadros-chave da animação; entre eles o jogo interpola.
 * 4. "Salvar no projeto" grava public/sprites/<id>/animacao.json (o tabuleiro
 *    usa direto).
 */

const COR = { fundo: '#14171f', painel: '#1d212b', borda: '#2e3443', texto: '#e8e2d4', fraco: '#8a8f9c', ouro: '#e8c26a', sel: '#4fc3f7' }
const botao: React.CSSProperties = { background: '#2a3040', color: COR.texto, border: `1px solid ${COR.borda}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }
const campo: React.CSSProperties = { background: '#0f1218', color: COR.texto, border: `1px solid ${COR.borda}`, borderRadius: 4, padding: '2px 6px', fontSize: 13 }
const titulo: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: COR.fraco, margin: '10px 0 6px' }

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function animVazia(proj: Projeto): Animacao {
  const pose: Pose = {}
  for (const e of proj.encaixes) pose[e.id] = estadoVazio()
  return { duracao: 0.8, laco: true, chaves: [{ t: 0, pose }] }
}

export default function TelaEditor() {
  const personagem = useMemo(() => new URLSearchParams(location.search).get('p') ?? 'base', [])
  const base = `${import.meta.env.BASE_URL}sprites/${personagem}/`
  const chaveLocal = `editor-animacao:${personagem}`

  const [proj, setProj] = useState<Projeto>(() => {
    try {
      const s = localStorage.getItem(chaveLocal)
      if (s) return JSON.parse(s) as Projeto
    } catch {
      /* sem armazenamento */
    }
    return projetoNovo()
  })
  const desfazer = useRef<string[]>([])
  const refazer = useRef<string[]>([])
  const [vista, setVista] = useState<NomeVista>('frente')
  const [animNome, setAnimNome] = useState<NomeAnimacao>('parado')
  const [chaveSel, setChaveSel] = useState(0)
  const [encSel, setEncSel] = useState<string | null>('tronco')
  const [pecaSel, setPecaSel] = useState<string | null>(null)
  const [fase, setFase] = useState(0)
  const [tocando, setTocando] = useState(false)
  const [cebola, setCebola] = useState(true)
  const [aviso, setAviso] = useState('')
  const [folhaAtual, setFolhaAtual] = useState(proj.folhas[0] ?? '')
  const [folhas, setFolhas] = useState<Map<string, HTMLImageElement>>(new Map())
  const [versaoPecas, setVersaoPecas] = useState(0)
  const cachePecas = useRef(new Map<string, { chave: string; cv: HTMLCanvasElement }>())

  const avisar = useCallback((t: string) => {
    setAviso(t)
    setTimeout(() => setAviso((a) => (a === t ? '' : a)), 3500)
  }, [])

  // guarda no navegador a cada mudança (não perde nada ao recarregar)
  useEffect(() => {
    try {
      localStorage.setItem(chaveLocal, JSON.stringify(proj))
    } catch {
      /* sem armazenamento */
    }
  }, [proj, chaveLocal])

  // folhas
  useEffect(() => {
    let vivo = true
    void Promise.all(
      proj.folhas.map(async (f) => {
        if (folhas.has(f)) return [f, folhas.get(f)!] as const
        try {
          return [f, await carregarImagem(`${base}folhas/${f}`)] as const
        } catch {
          return null
        }
      }),
    ).then((lista) => {
      if (!vivo) return
      const m = new Map<string, HTMLImageElement>()
      for (const x of lista) if (x) m.set(x[0], x[1])
      setFolhas(m)
    })
    return () => {
      vivo = false
    }
  }, [proj.folhas.join('|'), base])

  // peças recortadas (refeitas quando o retângulo muda)
  const imagensPecas = useMemo(() => {
    const m = new Map<string, HTMLCanvasElement>()
    for (const [id, p] of Object.entries(proj.pecas)) {
      const img = folhas.get(p.folha)
      if (!img) continue
      const chave = `${p.folha}|${p.x}|${p.y}|${p.l}|${p.a}|${p.maior}`
      let c = cachePecas.current.get(id)
      if (!c || c.chave !== chave) {
        c = { chave, cv: recortarPeca(img, p) }
        cachePecas.current.set(id, c)
      }
      m.set(id, c.cv)
    }
    return m
  }, [proj.pecas, folhas, versaoPecas])

  /** Muda o projeto (com desfazer). */
  const mudar = useCallback((fn: (p: Projeto) => void) => {
    setProj((atual) => {
      desfazer.current.push(JSON.stringify(atual))
      if (desfazer.current.length > 200) desfazer.current.shift()
      refazer.current = []
      const novo = clonar(atual)
      fn(novo)
      return novo
    })
  }, [])

  const anim = proj.animacoes[vista]?.[animNome]
  const chave = anim?.chaves[Math.min(chaveSel, (anim?.chaves.length ?? 1) - 1)]

  /** Garante a animação e devolve a chave em edição (dentro de `mudar`). */
  const chaveEm = (p: Projeto) => {
    p.animacoes[vista] ??= {}
    let a = p.animacoes[vista][animNome]
    if (!a) a = p.animacoes[vista][animNome] = animVazia(p)
    const k = a.chaves[Math.min(chaveSel, a.chaves.length - 1)]
    for (const e of p.encaixes) k.pose[e.id] ??= estadoVazio()
    return k
  }

  // pose mostrada: a chave selecionada (editando) ou a interpolada (tocando / entre chaves)
  /** a agulha está em cima da chave selecionada? (só aí dá para editar) */
  const naChave = !!chave && Math.abs(fase - chave.t) < 0.003
  const poseMostrada: Pose = useMemo(() => {
    if (!anim) return {}
    if (tocando || !naChave) return poseEm(anim, fase)
    return chave?.pose ?? {}
  }, [anim, chave, tocando, fase, naChave])

  // play
  useEffect(() => {
    if (!tocando || !anim) return
    let id = 0
    let ant = performance.now()
    const passo = (t: number) => {
      const dt = (t - ant) / 1000
      ant = t
      setFase((f) => {
        const n = f + dt / Math.max(0.05, anim.duracao)
        return anim.laco ? n % 1 : Math.min(1, n)
      })
      id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [tocando, anim])

  const desfazerUm = useCallback(() => {
    const s = desfazer.current.pop()
    if (!s) return
    setProj((atual) => {
      refazer.current.push(JSON.stringify(atual))
      return JSON.parse(s) as Projeto
    })
  }, [])
  const refazerUm = useCallback(() => {
    const s = refazer.current.pop()
    if (!s) return
    setProj((atual) => {
      desfazer.current.push(JSON.stringify(atual))
      return JSON.parse(s) as Projeto
    })
  }, [])

  // ---------------------------------------------------------- ações
  const editarEncaixe = useCallback(
    (id: string, fn: (e: EstadoEncaixe) => void) =>
      mudar((p) => {
        const k = chaveEm(p)
        fn(k.pose[id])
      }),
    [mudar, vista, animNome, chaveSel],
  )

  const novaChave = () => {
    mudar((p) => {
      const a = (p.animacoes[vista][animNome] ??= animVazia(p))
      const t = Math.round(fase * 100) / 100
      const pose = clonar(poseEm(a, t))
      for (const e of p.encaixes) pose[e.id] ??= estadoVazio()
      const i = a.chaves.findIndex((c) => c.t > t)
      if (a.chaves.some((c) => Math.abs(c.t - t) < 0.005)) return
      const nova = { t, pose }
      if (i < 0) a.chaves.push(nova)
      else a.chaves.splice(i, 0, nova)
      setChaveSel(i < 0 ? a.chaves.length - 1 : i)
    })
  }
  const apagarChave = () => {
    if (!anim || anim.chaves.length <= 1) return
    mudar((p) => {
      const a = p.animacoes[vista][animNome]!
      a.chaves.splice(chaveSel, 1)
      if (a.chaves[0].t !== 0) a.chaves[0].t = 0
    })
    setChaveSel((i) => Math.max(0, i - 1))
  }
  const copiarDeOutra = (de: NomeAnimacao) => {
    const origem = proj.animacoes[vista][de]
    if (!origem) return
    mudar((p) => {
      p.animacoes[vista][animNome] = clonar(origem)
    })
    setChaveSel(0)
  }

  const salvarProjeto = async () => {
    try {
      const r = await fetch('/__editor/salvar', { method: 'POST', body: JSON.stringify({ arquivo: `sprites/${personagem}/animacao.json`, conteudo: proj }) })
      const j = (await r.json()) as { ok: boolean; erro?: string }
      avisar(j.ok ? `Salvo em public/sprites/${personagem}/animacao.json` : `Erro: ${j.erro}`)
    } catch {
      avisar('Sem servidor de desenvolvimento (npm run dev): use "Baixar JSON".')
    }
  }
  const carregarDoProjeto = async () => {
    try {
      const r = await fetch(`${base}animacao.json`, { cache: 'no-store' })
      if (!r.ok) throw new Error()
      const p = (await r.json()) as Projeto
      mudar((x) => Object.assign(x, p))
      avisar('Carregado do projeto.')
    } catch {
      avisar('Ainda não há animacao.json salvo no projeto.')
    }
  }
  const baixar = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(proj, null, 1)], { type: 'application/json' }))
    a.download = 'animacao.json'
    a.click()
  }
  const abrirArquivo = (f: File) => {
    void f.text().then((t) => {
      try {
        const p = JSON.parse(t) as Projeto
        mudar((x) => Object.assign(x, p))
        avisar('Projeto aberto.')
      } catch {
        avisar('Arquivo inválido.')
      }
    })
  }
  const enviarFolha = async (f: File) => {
    const nome = f.name.replace(/[^\w.-]/g, '_')
    try {
      const r = await fetch(`/__editor/folha?arquivo=${encodeURIComponent(`sprites/${personagem}/folhas/${nome}`)}`, { method: 'POST', body: f })
      if (!r.ok) throw new Error()
    } catch {
      avisar('Sem servidor de desenvolvimento: copie a folha para public/sprites/' + personagem + '/folhas/')
      return
    }
    mudar((p) => {
      if (!p.folhas.includes(nome)) p.folhas.push(nome)
    })
    setFolhaAtual(nome)
  }

  // atalhos
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT' || (ev.target as HTMLElement)?.tagName === 'SELECT') return
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault()
        if (ev.shiftKey) refazerUm()
        else desfazerUm()
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
        ev.preventDefault()
        refazerUm()
        return
      }
      if (ev.key === ' ') {
        ev.preventDefault()
        setTocando((t) => !t)
        return
      }
      if (!encSel || tocando) return
      const passo = ev.shiftKey ? 10 : 1
      const m: Record<string, (e: EstadoEncaixe) => void> = {
        ArrowLeft: (e) => (e.x -= passo),
        ArrowRight: (e) => (e.x += passo),
        ArrowUp: (e) => (e.y -= passo),
        ArrowDown: (e) => (e.y += passo),
        q: (e) => (e.rot -= passo),
        e: (e) => (e.rot += passo),
      }
      const f = m[ev.key] ?? m[ev.key.toLowerCase()]
      if (f) {
        ev.preventDefault()
        editarEncaixe(encSel, f)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [encSel, tocando, editarEncaixe, desfazerUm, refazerUm])

  const estadoSel = encSel ? chave?.pose[encSel] : undefined
  const pecasLista = Object.keys(proj.pecas).sort()

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateColumns: '360px 1fr 300px', gridTemplateRows: 'auto 1fr auto', background: COR.fundo, color: COR.texto, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      {/* barra de cima */}
      <div style={{ gridColumn: '1 / 4', display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderBottom: `1px solid ${COR.borda}`, background: COR.painel, flexWrap: 'wrap' }}>
        <b style={{ color: COR.ouro, fontSize: 15 }}>Editor de animação</b>
        <span style={{ color: COR.fraco }}>personagem: {personagem}</span>
        <span>Vista</span>
        <select style={campo} value={vista} onChange={(e) => (setVista(e.target.value as NomeVista), setChaveSel(0))}>
          {VISTAS.map((v) => (
            <option key={v} value={v}>
              {v === 'frente' ? '3/4 de frente' : '3/4 de costas'}
            </option>
          ))}
        </select>
        <span>olha para</span>
        <select style={campo} value={proj.olha[vista]} onChange={(e) => mudar((p) => (p.olha[vista] = Number(e.target.value) as 1 | -1))}>
          <option value={-1}>esquerda</option>
          <option value={1}>direita</option>
        </select>
        <span style={{ marginLeft: 8 }}>Animação</span>
        <select style={campo} value={animNome} onChange={(e) => (setAnimNome(e.target.value as NomeAnimacao), setChaveSel(0), setFase(0))}>
          {NOMES_ANIM.map((n) => (
            <option key={n} value={n}>
              {n}
              {proj.animacoes[vista]?.[n] ? '' : ' (vazia)'}
            </option>
          ))}
        </select>
        {anim && (
          <>
            <span>duração</span>
            <input style={{ ...campo, width: 56 }} type="number" step={0.05} min={0.1} value={anim.duracao} onChange={(e) => mudar((p) => (p.animacoes[vista][animNome]!.duracao = Math.max(0.1, Number(e.target.value))))} />
            <span>s</span>
            <label>
              <input type="checkbox" checked={anim.laco} onChange={(e) => mudar((p) => (p.animacoes[vista][animNome]!.laco = e.target.checked))} /> laço
            </label>
            {animNome === 'atacar' && (
              <>
                <span>golpe em</span>
                <input style={{ ...campo, width: 56 }} type="number" step={0.01} min={0} max={1} value={anim.impacto ?? 0.5} onChange={(e) => mudar((p) => (p.animacoes[vista][animNome]!.impacto = Number(e.target.value)))} />
              </>
            )}
          </>
        )}
        {!anim && (
          <>
            <button style={botao} onClick={() => mudar((p) => ((p.animacoes[vista] ??= {})[animNome] = animVazia(p)))}>
              Criar animação
            </button>
            <select style={campo} value="" onChange={(e) => e.target.value && copiarDeOutra(e.target.value as NomeAnimacao)}>
              <option value="">copiar de…</option>
              {NOMES_ANIM.filter((n) => proj.animacoes[vista]?.[n]).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button style={botao} onClick={desfazerUm} title="Ctrl+Z">
          ↶
        </button>
        <button style={botao} onClick={refazerUm} title="Ctrl+Shift+Z">
          ↷
        </button>
        <button style={{ ...botao, background: '#6b4f12', borderColor: COR.ouro }} onClick={() => void salvarProjeto()}>
          Salvar no projeto
        </button>
        <button style={botao} onClick={() => void carregarDoProjeto()}>
          Carregar do projeto
        </button>
        <button style={botao} onClick={baixar}>
          Baixar JSON
        </button>
        <label style={botao}>
          Abrir JSON
          <input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && abrirArquivo(e.target.files[0])} />
        </label>
      </div>

      {/* esquerda: folhas e peças */}
      <div style={{ borderRight: `1px solid ${COR.borda}`, background: COR.painel, overflow: 'auto', padding: 10 }}>
        <PainelFolhas
          proj={proj}
          folhas={folhas}
          folhaAtual={folhaAtual}
          setFolhaAtual={setFolhaAtual}
          enviarFolha={(f) => void enviarFolha(f)}
          pecaSel={pecaSel}
          setPecaSel={setPecaSel}
          criarPeca={(id, peca) =>
            mudar((p) => {
              p.pecas[id] = peca
            })
          }
          definirReferencia={(r) =>
            mudar((p) => {
              p.referencia ??= {}
              const ant = p.referencia[vista]
              p.referencia[vista] = { ...r, dx: ant?.dx ?? 0, dy: ant?.dy ?? 0, opacidade: ant?.opacidade ?? 0.35 }
            })
          }
        />
        {pecaSel && proj.pecas[pecaSel] && (
          <EditorPeca
            id={pecaSel}
            peca={proj.pecas[pecaSel]}
            img={imagensPecas.get(pecaSel)}
            mudarPeca={(fn) =>
              mudar((p) => {
                fn(p.pecas[pecaSel])
              })
            }
            renomear={(novo) => {
              if (!novo || proj.pecas[novo]) return
              mudar((p) => {
                p.pecas[novo] = p.pecas[pecaSel]
                delete p.pecas[pecaSel]
                for (const v of VISTAS) for (const a of Object.values(p.animacoes[v] ?? {})) for (const c of a!.chaves) for (const e of Object.values(c.pose)) if (e.peca === pecaSel) e.peca = novo
              })
              setPecaSel(novo)
            }}
            apagar={() => {
              mudar((p) => {
                delete p.pecas[pecaSel]
                for (const v of VISTAS) for (const a of Object.values(p.animacoes[v] ?? {})) for (const c of a!.chaves) for (const e of Object.values(c.pose)) if (e.peca === pecaSel) e.peca = null
              })
              setPecaSel(null)
            }}
            usarNoEncaixe={encSel ? () => editarEncaixe(encSel, (e) => (e.peca = pecaSel)) : undefined}
            encSel={encSel}
            refazerRecorte={() => {
              cachePecas.current.delete(pecaSel)
              setVersaoPecas((v) => v + 1)
            }}
          />
        )}
      </div>

      {/* centro: palco */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <Palco
          proj={proj}
          vista={vista}
          pose={poseMostrada}
          poseCebola={!tocando && cebola && anim && chaveSel > 0 ? anim.chaves[chaveSel - 1]?.pose : undefined}
          imagens={imagensPecas}
          folhas={folhas}
          encSel={encSel}
          setEncSel={setEncSel}
          editavel={!tocando && !!anim && naChave}
          editarEncaixe={editarEncaixe}
          mudarReferencia={(dx, dy) =>
            mudar((p) => {
              const r = p.referencia?.[vista]
              if (r) {
                r.dx = dx
                r.dy = dy
              }
            })
          }
        />
        <div style={{ position: 'absolute', left: 10, bottom: 8, color: COR.fraco, fontSize: 12, pointerEvents: 'none', lineHeight: 1.5 }}>
          Arrastar: move · Alt+arrastar ou botão direito: gira · Shift+arrastar: estica · Ctrl+arrastar no vazio: move a referência
          <br />
          Setas/Q/E: ajuste fino (Shift ×10) · Espaço: play · Ctrl+Z: desfazer · roda: zoom · botão do meio: arrasta a vista
        </div>
        {anim && !tocando && !naChave && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: '#000a', padding: '4px 10px', borderRadius: 6, color: COR.fraco }}>Entre chaves (só olhar) — clique numa chave ou “+ Chave” para editar aqui</div>
        )}
        {aviso && <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: '#000c', border: `1px solid ${COR.ouro}`, padding: '6px 14px', borderRadius: 6 }}>{aviso}</div>}
      </div>

      {/* direita: encaixes */}
      <div style={{ borderLeft: `1px solid ${COR.borda}`, background: COR.painel, overflow: 'auto', padding: 10 }}>
        <div style={titulo}>Encaixes (de trás para a frente)</div>
        {proj.encaixes.map((enc, i) => {
          const e = chave?.pose[enc.id]
          const sel = enc.id === encSel
          return (
            <div key={enc.id} onClick={() => setEncSel(enc.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', marginBottom: 2, borderRadius: 4, cursor: 'pointer', background: sel ? '#24425a' : 'transparent', border: `1px solid ${sel ? COR.sel : 'transparent'}` }}>
              <span style={{ flex: 1, paddingLeft: profundidade(proj, enc.id) * 8 }}>{enc.id}</span>
              <span style={{ color: e?.peca ? COR.ouro : COR.fraco, fontSize: 11, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e?.peca ?? '—'}</span>
              <button style={{ ...botao, padding: '0 5px' }} title="mais para trás" onClick={(ev) => (ev.stopPropagation(), i > 0 && mudar((p) => p.encaixes.splice(i - 1, 0, p.encaixes.splice(i, 1)[0])))}>
                ↑
              </button>
              <button style={{ ...botao, padding: '0 5px' }} title="mais para a frente" onClick={(ev) => (ev.stopPropagation(), i < proj.encaixes.length - 1 && mudar((p) => p.encaixes.splice(i + 1, 0, p.encaixes.splice(i, 1)[0])))}>
                ↓
              </button>
            </div>
          )
        })}
        <button
          style={{ ...botao, marginTop: 6 }}
          onClick={() => {
            const id = prompt('Nome do novo encaixe (ex.: capa, arma2):')?.trim()
            if (!id || proj.encaixes.some((e) => e.id === id)) return
            mudar((p) => p.encaixes.push({ id, pai: encSel }))
            setEncSel(id)
          }}
        >
          + Encaixe
        </button>

        {encSel && (
          <>
            <div style={titulo}>Encaixe: {encSel}</div>
            <Linha nome="peça">
              <select style={{ ...campo, width: '100%' }} value={estadoSel?.peca ?? ''} disabled={!anim} onChange={(e) => editarEncaixe(encSel, (x) => (x.peca = e.target.value || null))}>
                <option value="">— nenhuma —</option>
                {pecasLista.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Linha>
            <Linha nome="pai">
              <select
                style={{ ...campo, width: '100%' }}
                value={proj.encaixes.find((e) => e.id === encSel)?.pai ?? ''}
                onChange={(e) =>
                  mudar((p) => {
                    const enc = p.encaixes.find((x) => x.id === encSel)!
                    const novo = e.target.value || null
                    // não deixa virar filho de um descendente (laço)
                    let q = novo
                    while (q) {
                      if (q === encSel) return
                      q = p.encaixes.find((x) => x.id === q)?.pai ?? null
                    }
                    enc.pai = novo
                  })
                }
              >
                <option value="">— raiz (chão) —</option>
                {proj.encaixes
                  .filter((e) => e.id !== encSel)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id}
                    </option>
                  ))}
              </select>
            </Linha>
            {estadoSel && (
              <>
                {(['x', 'y', 'rot', 'sx', 'sy'] as const).map((k) => (
                  <Linha key={k} nome={{ x: 'x', y: 'y', rot: 'giro °', sx: 'escala x', sy: 'escala y' }[k]}>
                    <input style={{ ...campo, width: '100%' }} type="number" step={k === 'sx' || k === 'sy' ? 0.01 : 1} value={Math.round(estadoSel[k] * 100) / 100} onChange={(e) => editarEncaixe(encSel, (x) => (x[k] = Number(e.target.value)))} />
                  </Linha>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button style={botao} onClick={() => editarEncaixe(encSel, (x) => (x.sx = -x.sx))}>
                    Espelhar
                  </button>
                  <button style={botao} onClick={() => editarEncaixe(encSel, (x) => Object.assign(x, { rot: 0, sx: Math.sign(x.sx) || 1, sy: 1 }))}>
                    Zerar giro/escala
                  </button>
                  <button
                    style={botao}
                    title="Copia este encaixe para todas as chaves desta animação"
                    onClick={() =>
                      mudar((p) => {
                        const a = p.animacoes[vista][animNome]
                        const k = a?.chaves[chaveSel]
                        if (!a || !k) return
                        for (const c of a.chaves) c.pose[encSel] = clonar(k.pose[encSel])
                      })
                    }
                  >
                    Igual em todas as chaves
                  </button>
                </div>
              </>
            )}
            <button
              style={{ ...botao, marginTop: 10, color: '#ff8a80' }}
              onClick={() => {
                if (!confirm(`Apagar o encaixe ${encSel}?`)) return
                mudar((p) => {
                  for (const e of p.encaixes) if (e.pai === encSel) e.pai = p.encaixes.find((x) => x.id === encSel)?.pai ?? null
                  p.encaixes = p.encaixes.filter((e) => e.id !== encSel)
                })
                setEncSel(null)
              }}
            >
              Apagar encaixe
            </button>
          </>
        )}
        <div style={titulo}>Personagem</div>
        <Linha nome="altura (px da folha)">
          <input style={{ ...campo, width: '100%' }} type="number" value={proj.altura} onChange={(e) => mudar((p) => (p.altura = Math.max(50, Number(e.target.value))))} />
        </Linha>
        {proj.referencia?.[vista] && (
          <Linha nome="referência">
            <input type="range" min={0} max={1} step={0.05} value={proj.referencia[vista]!.opacidade} onChange={(e) => mudar((p) => (p.referencia![vista]!.opacidade = Number(e.target.value)))} />
          </Linha>
        )}
        <label style={{ display: 'block', marginTop: 6 }}>
          <input type="checkbox" checked={cebola} onChange={(e) => setCebola(e.target.checked)} /> papel de cebola (chave anterior)
        </label>
      </div>

      {/* baixo: linha do tempo */}
      <div style={{ gridColumn: '1 / 4', borderTop: `1px solid ${COR.borda}`, background: COR.painel, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={{ ...botao, width: 70 }} onClick={() => setTocando((t) => !t)} disabled={!anim}>
          {tocando ? '❚❚ Pausar' : '▶ Tocar'}
        </button>
        <LinhaTempo
          anim={anim}
          fase={fase}
          chaveSel={chaveSel}
          selecionar={(i) => {
            setTocando(false)
            setChaveSel(i)
            setFase(anim!.chaves[i].t)
          }}
          moverFase={(f) => {
            setTocando(false)
            setFase(f)
          }}
          moverChave={(i, t) =>
            mudar((p) => {
              const a = p.animacoes[vista][animNome]!
              if (i === 0) return
              const ant = a.chaves[i - 1]?.t ?? 0
              const prox = a.chaves[i + 1]?.t ?? 1
              a.chaves[i].t = Math.min(prox - 0.01, Math.max(ant + 0.01, Math.round(t * 100) / 100))
            })
          }
        />
        <span style={{ width: 70, textAlign: 'right', color: COR.fraco }}>{anim ? `${(fase * anim.duracao).toFixed(2)} s` : ''}</span>
        <button style={botao} onClick={novaChave} disabled={!anim} title="Nova chave no ponto da agulha (copia a pose de lá)">
          + Chave
        </button>
        <button style={botao} onClick={apagarChave} disabled={!anim || anim.chaves.length <= 1}>
          Apagar chave
        </button>
      </div>
    </div>
  )
}

function profundidade(p: Projeto, id: string) {
  let n = 0
  let q = p.encaixes.find((e) => e.id === id)?.pai
  while (q && n < 20) {
    n++
    q = p.encaixes.find((e) => e.id === q)?.pai
  }
  return n
}

function Linha({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ color: COR.fraco }}>{nome}</span>
      {children}
    </div>
  )
}

// ================================================================ folhas

function PainelFolhas(props: {
  proj: Projeto
  folhas: Map<string, HTMLImageElement>
  folhaAtual: string
  setFolhaAtual: (f: string) => void
  enviarFolha: (f: File) => void
  pecaSel: string | null
  setPecaSel: (id: string) => void
  criarPeca: (id: string, p: Peca) => void
  definirReferencia: (r: { folha: string; x: number; y: number; l: number; a: number }) => void
}) {
  const { proj, folhas, folhaAtual } = props
  const tela = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(0.22)
  const [pan, setPan] = useState<[number, number]>([0, 0])
  const [ret, setRet] = useState<[number, number, number, number] | null>(null)
  const arrasto = useRef<{ tipo: 'ret' | 'pan'; x: number; y: number; ini: [number, number] } | null>(null)
  const img = folhas.get(folhaAtual)
  const L = 340
  const A = 340

  useEffect(() => {
    const c = tela.current?.getContext('2d')
    if (!c) return
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = '#0d0f14'
    c.fillRect(0, 0, L, A)
    if (!img) return
    c.setTransform(zoom, 0, 0, zoom, pan[0], pan[1])
    c.imageSmoothingEnabled = zoom < 1
    c.drawImage(img, 0, 0)
    c.lineWidth = 1 / zoom
    for (const [id, p] of Object.entries(proj.pecas)) {
      if (p.folha !== folhaAtual) continue
      c.strokeStyle = id === props.pecaSel ? COR.sel : '#ffffff88'
      c.strokeRect(p.x, p.y, p.l, p.a)
    }
    if (ret) {
      c.strokeStyle = COR.ouro
      c.setLineDash([4 / zoom, 3 / zoom])
      c.strokeRect(ret[0], ret[1], ret[2], ret[3])
      c.setLineDash([])
    }
  }, [img, zoom, pan, ret, proj.pecas, folhaAtual, props.pecaSel])

  const ponto = (ev: React.MouseEvent): [number, number] => {
    const r = tela.current!.getBoundingClientRect()
    return [(ev.clientX - r.left - pan[0]) / zoom, (ev.clientY - r.top - pan[1]) / zoom]
  }

  return (
    <>
      <div style={titulo}>Folhas</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={campo} value={folhaAtual} onChange={(e) => (props.setFolhaAtual(e.target.value), setRet(null))}>
          {proj.folhas.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <label style={botao}>
          + Folha
          <input type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && props.enviarFolha(e.target.files[0])} />
        </label>
        <span style={{ color: COR.fraco, fontSize: 11 }}>fundo magenta</span>
      </div>
      <canvas
        ref={tela}
        width={L}
        height={A}
        style={{ marginTop: 6, border: `1px solid ${COR.borda}`, cursor: 'crosshair', display: 'block' }}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(ev) => {
          const r = tela.current!.getBoundingClientRect()
          const mx = ev.clientX - r.left
          const my = ev.clientY - r.top
          const nz = Math.min(8, Math.max(0.08, zoom * (ev.deltaY < 0 ? 1.2 : 1 / 1.2)))
          setPan([mx - ((mx - pan[0]) / zoom) * nz, my - ((my - pan[1]) / zoom) * nz])
          setZoom(nz)
        }}
        onMouseDown={(ev) => {
          if (ev.button === 1 || ev.button === 2) {
            arrasto.current = { tipo: 'pan', x: ev.clientX, y: ev.clientY, ini: pan }
            return
          }
          const [x, y] = ponto(ev)
          // clicar dentro de uma peça existente seleciona
          const achada = Object.entries(proj.pecas).find(([, p]) => p.folha === folhaAtual && x >= p.x && y >= p.y && x <= p.x + p.l && y <= p.y + p.a)
          if (achada && !ev.shiftKey) {
            props.setPecaSel(achada[0])
          }
          arrasto.current = { tipo: 'ret', x, y, ini: [x, y] }
          setRet(null)
        }}
        onMouseMove={(ev) => {
          const a = arrasto.current
          if (!a) return
          if (a.tipo === 'pan') {
            setPan([a.ini[0] + ev.clientX - a.x, a.ini[1] + ev.clientY - a.y])
            return
          }
          const [x, y] = ponto(ev)
          const x0 = Math.min(a.x, x)
          const y0 = Math.min(a.y, y)
          if (Math.abs(x - a.x) > 3 || Math.abs(y - a.y) > 3) setRet([Math.round(x0), Math.round(y0), Math.round(Math.abs(x - a.x)), Math.round(Math.abs(y - a.y))])
        }}
        onMouseUp={() => (arrasto.current = null)}
        onMouseLeave={() => (arrasto.current = null)}
      />
      <div style={{ color: COR.fraco, fontSize: 11, marginTop: 4 }}>Arraste um retângulo em volta da parte · roda: zoom · botão direito: mover</div>
      {ret && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <button
            style={{ ...botao, borderColor: COR.ouro }}
            onClick={() => {
              const id = prompt('Nome da peça (ex.: braco_dobrado_machado):')?.trim().replace(/\s+/g, '_')
              if (!id) return
              if (proj.pecas[id] && !confirm(`Já existe ${id}. Substituir?`)) return
              props.criarPeca(id, { folha: folhaAtual, x: ret[0], y: ret[1], l: ret[2], a: ret[3], maior: true, pivo: [Math.round(ret[2] / 2), Math.round(ret[3] * 0.1)] })
              props.setPecaSel(id)
              setRet(null)
            }}
          >
            Criar peça
          </button>
          <button
            style={botao}
            onClick={() => {
              props.definirReferencia({ folha: folhaAtual, x: ret[0], y: ret[1], l: ret[2], a: ret[3] })
              setRet(null)
            }}
          >
            Usar como referência (vista atual)
          </button>
          <button style={botao} onClick={() => setRet(null)}>
            Cancelar
          </button>
        </div>
      )}
      <div style={titulo}>Peças ({Object.keys(proj.pecas).length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {Object.keys(proj.pecas)
          .sort()
          .map((id) => (
            <button key={id} style={{ ...botao, padding: '2px 6px', fontSize: 12, borderColor: id === props.pecaSel ? COR.sel : COR.borda }} onClick={() => (props.setPecaSel(id), props.setFolhaAtual(proj.pecas[id].folha))}>
              {id}
            </button>
          ))}
      </div>
    </>
  )
}

function EditorPeca(props: {
  id: string
  peca: Peca
  img?: HTMLCanvasElement
  mudarPeca: (fn: (p: Peca) => void) => void
  renomear: (novo: string) => void
  apagar: () => void
  usarNoEncaixe?: () => void
  encSel: string | null
  refazerRecorte: () => void
}) {
  const { peca, img } = props
  const tela = useRef<HTMLCanvasElement>(null)
  const L = 340
  const A = 260
  const k = img ? Math.min(4, (L - 20) / img.width, (A - 20) / img.height) : 1
  const ox = img ? (L - img.width * k) / 2 : 0
  const oy = img ? (A - img.height * k) / 2 : 0

  useEffect(() => {
    const c = tela.current?.getContext('2d')
    if (!c) return
    c.setTransform(1, 0, 0, 1, 0, 0)
    // xadrez (transparência)
    for (let y = 0; y < A; y += 10) for (let x = 0; x < L; x += 10) {
      c.fillStyle = (x + y) % 20 ? '#2a2f3a' : '#22262f'
      c.fillRect(x, y, 10, 10)
    }
    if (!img) return
    c.imageSmoothingEnabled = false
    c.drawImage(img, ox, oy, img.width * k, img.height * k)
    const px = ox + peca.pivo[0] * k
    const py = oy + peca.pivo[1] * k
    c.strokeStyle = '#ff3b3b'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(px - 8, py)
    c.lineTo(px + 8, py)
    c.moveTo(px, py - 8)
    c.lineTo(px, py + 8)
    c.stroke()
    c.beginPath()
    c.arc(px, py, 4, 0, Math.PI * 2)
    c.stroke()
  }, [img, peca.pivo, k, ox, oy])

  return (
    <>
      <div style={titulo}>Peça: {props.id}</div>
      <canvas
        ref={tela}
        width={L}
        height={A}
        style={{ border: `1px solid ${COR.borda}`, cursor: 'crosshair', display: 'block' }}
        onMouseDown={(ev) => {
          const r = tela.current!.getBoundingClientRect()
          const x = Math.round((ev.clientX - r.left - ox) / k)
          const y = Math.round((ev.clientY - r.top - oy) / k)
          props.mudarPeca((p) => (p.pivo = [x, y]))
        }}
      />
      <div style={{ color: COR.fraco, fontSize: 11, marginTop: 4 }}>Clique para marcar o pivô (a junta onde a peça gira: ombro, cotovelo, pulso…)</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {props.usarNoEncaixe && (
          <button style={{ ...botao, borderColor: COR.ouro }} onClick={props.usarNoEncaixe}>
            Pôr em “{props.encSel}”
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Desligue se a peça tiver partes soltas (ex.: duas mãos)">
          <input type="checkbox" checked={peca.maior} onChange={(e) => props.mudarPeca((p) => (p.maior = e.target.checked))} /> só o maior pedaço
        </label>
        <button style={botao} onClick={() => props.renomear(prompt('Novo nome:', props.id)?.trim().replace(/\s+/g, '_') ?? '')}>
          Renomear
        </button>
        <button style={{ ...botao, color: '#ff8a80' }} onClick={() => confirm(`Apagar a peça ${props.id}?`) && props.apagar()}>
          Apagar
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 6 }}>
        {(['x', 'y', 'l', 'a'] as const).map((c) => (
          <label key={c} style={{ fontSize: 11, color: COR.fraco }}>
            {c}
            <input style={{ ...campo, width: '100%' }} type="number" value={peca[c]} onChange={(e) => props.mudarPeca((p) => (p[c] = Math.max(c === 'l' || c === 'a' ? 1 : 0, Number(e.target.value))))} />
          </label>
        ))}
      </div>
    </>
  )
}

// ================================================================ palco

function Palco(props: {
  proj: Projeto
  vista: NomeVista
  pose: Pose
  poseCebola?: Pose
  imagens: Map<string, HTMLCanvasElement>
  folhas: Map<string, HTMLImageElement>
  encSel: string | null
  setEncSel: (id: string | null) => void
  editavel: boolean
  editarEncaixe: (id: string, fn: (e: EstadoEncaixe) => void) => void
  mudarReferencia: (dx: number, dy: number) => void
}) {
  const { proj, pose, imagens } = props
  const caixa = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const [tam, setTam] = useState<[number, number]>([800, 600])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<[number, number]>([0, 0])
  /** arrasto em andamento: muda a pose ao vivo (sem desfazer a cada pixel) */
  const [ao, setAo] = useState<{ id: string; e: EstadoEncaixe } | null>(null)
  const [refAo, setRefAo] = useState<[number, number] | null>(null)
  const arrasto = useRef<
    | { tipo: 'mover' | 'girar' | 'esticar'; id: string; ini: EstadoEncaixe; mx: number; my: number; inv: DOMMatrix; origem: [number, number] }
    | { tipo: 'pan'; mx: number; my: number; ini: [number, number] }
    | { tipo: 'ref'; mx: number; my: number; ini: [number, number] }
    | null
  >(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setTam([Math.floor(e.contentRect.width), Math.floor(e.contentRect.height)]))
    if (caixa.current) ro.observe(caixa.current)
    return () => ro.disconnect()
  }, [])

  const vistaM = useMemo(() => new DOMMatrix().translate(tam[0] / 2 + pan[0], tam[1] * 0.86 + pan[1]).scale(zoom), [tam, pan, zoom])
  const poseViva = useMemo(() => (ao ? { ...pose, [ao.id]: ao.e } : pose), [pose, ao])
  const ref = props.proj.referencia?.[props.vista]

  useEffect(() => {
    const cv = tela.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    const dpr = window.devicePixelRatio || 1
    cv.width = tam[0] * dpr
    cv.height = tam[1] * dpr
    const tudo = new DOMMatrix().scale(dpr).multiply(vistaM)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.fillStyle = '#20242e'
    c.fillRect(0, 0, tam[0], tam[1])
    // chão e eixo
    c.setTransform(tudo)
    c.strokeStyle = '#3a4152'
    c.lineWidth = 1 / zoom
    c.beginPath()
    c.moveTo(-400, 0)
    c.lineTo(400, 0)
    c.moveTo(0, 20)
    c.lineTo(0, -proj.altura - 20)
    c.stroke()
    c.strokeStyle = '#4a5368'
    c.setLineDash([6 / zoom, 6 / zoom])
    c.beginPath()
    c.moveTo(-120, -proj.altura)
    c.lineTo(120, -proj.altura)
    c.stroke()
    c.setLineDash([])
    // referência
    if (ref) {
      const img = props.folhas.get(ref.folha)
      if (img) {
        const [dx, dy] = refAo ?? [ref.dx, ref.dy]
        c.globalAlpha = ref.opacidade
        c.drawImage(img, ref.x, ref.y, ref.l, ref.a, -ref.l / 2 + dx, -ref.a + dy, ref.l, ref.a)
        c.globalAlpha = 1
      }
    }
    c.imageSmoothingEnabled = true
    if (props.poseCebola) {
      c.globalAlpha = 0.25
      desenharPose(c, proj, props.poseCebola, tudo, imagens)
      c.globalAlpha = 1
    }
    const ms = desenharPose(c, proj, poseViva, tudo, imagens)
    // seleção: contorno da peça e pivô
    if (props.encSel) {
      const m = ms.get(props.encSel)
      const e = poseViva[props.encSel]
      if (m) {
        c.setTransform(m)
        const p = e?.peca ? proj.pecas[e.peca] : null
        if (p) {
          c.strokeStyle = COR.sel
          c.lineWidth = (1.5 * dpr) / Math.hypot(m.a, m.b)
          c.strokeRect(-p.pivo[0], -p.pivo[1], p.l, p.a)
        }
        c.setTransform(1, 0, 0, 1, 0, 0)
        const o = m.transformPoint(new DOMPoint(0, 0))
        c.fillStyle = '#ff3b3b'
        c.beginPath()
        c.arc(o.x, o.y, 5 * dpr, 0, Math.PI * 2)
        c.fill()
      }
    }
  }, [tam, vistaM, poseViva, props.poseCebola, proj, imagens, props.encSel, ref, refAo, props.folhas, zoom])

  /** encaixe sob o ponto (de cima para baixo, pelo alfa da peça) */
  const pegar = (x: number, y: number) => {
    const ms = matrizes(proj, poseViva, vistaM)
    for (let i = proj.encaixes.length - 1; i >= 0; i--) {
      const id = proj.encaixes[i].id
      const e = poseViva[id]
      if (!e?.peca) continue
      const p = proj.pecas[e.peca]
      const img = imagens.get(e.peca)
      if (!p || !img) continue
      const q = ms.get(id)!.inverse().transformPoint(new DOMPoint(x, y))
      const px = Math.floor(q.x + p.pivo[0])
      const py = Math.floor(q.y + p.pivo[1])
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue
      const a = img.getContext('2d')!.getImageData(px, py, 1, 1).data[3]
      if (a > 40) return id
    }
    return null
  }

  const local = (ev: React.MouseEvent) => {
    const r = tela.current!.getBoundingClientRect()
    return [ev.clientX - r.left, ev.clientY - r.top] as [number, number]
  }

  return (
    <div ref={caixa} style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={tela}
        style={{ width: tam[0], height: tam[1], display: 'block', cursor: 'default' }}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(ev) => {
          const [mx, my] = local(ev)
          const nz = Math.min(6, Math.max(0.2, zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)))
          const ox = tam[0] / 2 + pan[0]
          const oy = tam[1] * 0.86 + pan[1]
          setPan([mx - ((mx - ox) / zoom) * nz - tam[0] / 2, my - ((my - oy) / zoom) * nz - tam[1] * 0.86])
          setZoom(nz)
        }}
        onMouseDown={(ev) => {
          const [mx, my] = local(ev)
          if (ev.button === 1) {
            ev.preventDefault()
            arrasto.current = { tipo: 'pan', mx, my, ini: pan }
            return
          }
          const id = pegar(mx, my)
          if (!id && ev.ctrlKey && ref) {
            arrasto.current = { tipo: 'ref', mx, my, ini: [ref.dx, ref.dy] }
            return
          }
          if (!id) {
            if (ev.button === 0) props.setEncSel(null)
            return
          }
          props.setEncSel(id)
          if (!props.editavel) return
          const ms = matrizes(proj, poseViva, vistaM)
          const pai = proj.encaixes.find((e) => e.id === id)?.pai
          const mp = pai ? ms.get(pai)! : vistaM
          const o = ms.get(id)!.transformPoint(new DOMPoint(0, 0))
          const tipo = ev.button === 2 || ev.altKey ? 'girar' : ev.shiftKey ? 'esticar' : 'mover'
          arrasto.current = { tipo, id, ini: { ...poseViva[id] }, mx, my, inv: mp.inverse(), origem: [o.x, o.y] }
        }}
        onMouseMove={(ev) => {
          const a = arrasto.current
          if (!a) return
          const [mx, my] = local(ev)
          if (a.tipo === 'pan') {
            setPan([a.ini[0] + mx - a.mx, a.ini[1] + my - a.my])
            return
          }
          if (a.tipo === 'ref') {
            setRefAo([a.ini[0] + (mx - a.mx) / zoom, a.ini[1] + (my - a.my) / zoom])
            return
          }
          const e = { ...a.ini }
          if (a.tipo === 'mover') {
            const p0 = a.inv.transformPoint(new DOMPoint(a.mx, a.my))
            const p1 = a.inv.transformPoint(new DOMPoint(mx, my))
            e.x = Math.round(a.ini.x + p1.x - p0.x)
            e.y = Math.round(a.ini.y + p1.y - p0.y)
          } else if (a.tipo === 'girar') {
            const ang0 = Math.atan2(a.my - a.origem[1], a.mx - a.origem[0])
            const ang1 = Math.atan2(my - a.origem[1], mx - a.origem[0])
            // pai espelhado inverte o sentido do giro
            const det = Math.sign(a.inv.a * a.inv.d - a.inv.b * a.inv.c) || 1
            e.rot = Math.round((a.ini.rot + (((ang1 - ang0) * 180) / Math.PI) * det) * 10) / 10
          } else {
            const d0 = Math.hypot(a.mx - a.origem[0], a.my - a.origem[1])
            const d1 = Math.hypot(mx - a.origem[0], my - a.origem[1])
            const k = d0 > 2 ? d1 / d0 : 1
            e.sx = Math.round(a.ini.sx * k * 100) / 100
            e.sy = Math.round(a.ini.sy * k * 100) / 100
          }
          setAo({ id: a.id, e })
        }}
        onMouseUp={() => {
          const a = arrasto.current
          arrasto.current = null
          if (a?.tipo === 'ref' && refAo) {
            props.mudarReferencia(refAo[0], refAo[1])
            setRefAo(null)
            return
          }
          if (ao) {
            const final = ao.e
            props.editarEncaixe(ao.id, (x) => Object.assign(x, final))
            setAo(null)
          }
        }}
        onMouseLeave={() => {
          arrasto.current = null
          setAo(null)
          setRefAo(null)
        }}
      />
    </div>
  )
}

// ================================================================ linha do tempo

function LinhaTempo(props: { anim?: Animacao; fase: number; chaveSel: number; selecionar: (i: number) => void; moverFase: (f: number) => void; moverChave: (i: number, t: number) => void }) {
  const barra = useRef<HTMLDivElement>(null)
  const arrasto = useRef<{ tipo: 'agulha' } | { tipo: 'chave'; i: number } | null>(null)
  const fasePor = (x: number) => {
    const r = barra.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (x - r.left) / r.width))
  }
  useEffect(() => {
    const mover = (ev: MouseEvent) => {
      const a = arrasto.current
      if (!a) return
      if (a.tipo === 'agulha') props.moverFase(fasePor(ev.clientX))
      else props.moverChave(a.i, fasePor(ev.clientX))
    }
    const soltar = () => (arrasto.current = null)
    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
    return () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
  })
  const anim = props.anim
  return (
    <div
      ref={barra}
      style={{ flex: 1, height: 34, position: 'relative', background: '#0f1218', border: `1px solid ${COR.borda}`, borderRadius: 4, cursor: 'pointer' }}
      onMouseDown={(ev) => {
        if (!anim) return
        arrasto.current = { tipo: 'agulha' }
        props.moverFase(fasePor(ev.clientX))
      }}
    >
      {Array.from({ length: 11 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: `${i * 10}%`, top: 0, bottom: 0, width: 1, background: '#262c38' }} />
      ))}
      {anim?.impacto != null && <div title="golpe" style={{ position: 'absolute', left: `${anim.impacto * 100}%`, top: 0, bottom: 0, width: 2, background: '#ff5252' }} />}
      {anim?.chaves.map((c, i) => (
        <div
          key={i}
          title={`chave ${i + 1} (t = ${c.t})`}
          onMouseDown={(ev) => {
            ev.stopPropagation()
            props.selecionar(i)
            arrasto.current = { tipo: 'chave', i }
          }}
          style={{ position: 'absolute', left: `calc(${c.t * 100}% - 7px)`, top: 8, width: 14, height: 18, transform: 'rotate(45deg) scale(0.75)', background: i === props.chaveSel ? COR.ouro : '#9aa3b5', border: '1px solid #000', cursor: 'grab' }}
        />
      ))}
      <div style={{ position: 'absolute', left: `${props.fase * 100}%`, top: -3, bottom: -3, width: 2, background: COR.sel, pointerEvents: 'none' }} />
    </div>
  )
}
