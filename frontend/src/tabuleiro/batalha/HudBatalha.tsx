import { useState } from 'react'
import type { ControleBatalha, FichaHud, RetratoBatalha } from './controle'
import { ACOES_POR_VEZ, MOVIMENTO_POR_VEZ } from './regras'

/**
 * HUD da batalha (protótipo de teste, vez da tripulação):
 *   preparação — Akuma no Mi, Haki e overall de cada personagem;
 *   em jogo — vez, cronômetro, ações e movimento no topo; as duas
 *   tripulações nos lados; o painel do pirata escolhido (skills com custo,
 *   Haki de armamento / do Rei, observação, Haki do Rei em área) embaixo;
 *   o registro do que aconteceu; e a tela de fim.
 */

const fonte = '700 12px/1.25 monospace'
const painel: React.CSSProperties = {
  background: 'rgba(12,16,28,0.88)',
  border: '1px solid #3a4a6a',
  borderRadius: 6,
  color: '#f3e3c3',
  font: fonte,
  pointerEvents: 'auto',
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

function Botao(props: { ativo?: boolean; desligado?: boolean; onClick: () => void; children: React.ReactNode; cor?: string; titulo?: string; grande?: boolean }) {
  const cor = props.cor ?? '#ffd34a'
  return (
    <button
      onClick={props.onClick}
      disabled={props.desligado}
      title={props.titulo}
      style={{
        font: props.grande ? '700 14px monospace' : fonte,
        padding: props.grande ? '10px 14px' : '6px 8px',
        margin: 2,
        borderRadius: 4,
        border: `1px solid ${props.ativo ? cor : '#4a5a7a'}`,
        background: props.ativo ? 'rgba(255,211,74,0.16)' : 'rgba(30,38,58,0.92)',
        color: props.desligado ? '#5a6070' : props.ativo ? cor : '#dfe6f3',
        cursor: props.desligado ? 'default' : 'pointer',
      }}
    >
      {props.children}
    </button>
  )
}

function Barra({ v, max, cor, alto = 4 }: { v: number; max: number; cor: string; alto?: number }) {
  return (
    <div style={{ height: alto, background: '#1a1420', marginTop: 1 }}>
      <div style={{ width: `${(100 * Math.max(0, v)) / max}%`, height: '100%', background: cor }} />
    </div>
  )
}

function Ficha({ f, sel, onClick }: { f: FichaHud; sel: boolean; onClick?: () => void }) {
  const morto = f.hp <= 0
  const hakis = [f.armamento && `A ${f.armamento}`, f.observacao && `O ${f.observacao}${f.observando ? '●' : ''}`, f.rei && 'Rei'].filter(Boolean).join(' · ')
  return (
    <div onClick={onClick} style={{ padding: '3px 2px', cursor: onClick ? 'pointer' : 'default', opacity: morto ? 0.35 : 1, color: sel ? '#ffd34a' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{f.nome}</span>
        <span style={{ color: '#9aa6bc', fontWeight: 400 }}>{f.hp}</span>
      </div>
      <Barra v={f.hp} max={f.hpMax} cor={f.hp / f.hpMax > 0.4 ? '#5fd35a' : '#e8503a'} />
      <Barra v={f.energia} max={100} cor="#4ab0ff" alto={2} />
      <Barra v={f.espirito} max={100} cor="#ff4a5a" alto={2} />
      <div style={{ fontWeight: 400, fontSize: 10, color: '#aab4c8', marginTop: 1 }}>
        {f.fruta && <div style={{ color: '#ffcf6a' }}>{f.fruta}{f.logia ? ` (${f.logia})` : ''}</div>}
        {hakis && <div>{hakis} · {f.overall}</div>}
        {f.estados.length > 0 && <div style={{ color: '#ff8a7a' }}>{f.estados.join(', ')}</div>}
      </div>
    </div>
  )
}

function Preparar({ b, c }: { b: RetratoBatalha; c: ControleBatalha }) {
  const sel: React.CSSProperties = { font: fonte, background: '#1e263a', color: '#dfe6f3', border: '1px solid #4a5a7a', borderRadius: 3, padding: '2px' }
  const linha = (k: RetratoBatalha['config'][number]) => (
    <tr key={k.id}>
      <td style={{ padding: '2px 4px', color: k.lado === 'piratas' ? '#ffd34a' : '#8ac4ff' }}>{k.nome}</td>
      <td>
        <select value={k.akuma} onChange={(ev) => c.mudarConfig(k.id, 'akuma', ev.target.value)} style={sel}>
          {FRUTAS_OP.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={k.armamento} onChange={(ev) => c.mudarConfig(k.id, 'armamento', Number(ev.target.value))} style={sel}>
          {NIVEL.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={k.observacao} onChange={(ev) => c.mudarConfig(k.id, 'observacao', Number(ev.target.value))} style={sel}>
          {NIVEL.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
      </td>
      <td style={{ textAlign: 'center' }}>
        <input type="checkbox" checked={k.rei} onChange={(ev) => c.mudarConfig(k.id, 'rei', ev.target.checked)} />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <Botao onClick={() => c.mudarConfig(k.id, 'overall', Math.max(0, k.overall - 5))}>−</Botao>
        {k.overall}
        <Botao onClick={() => c.mudarConfig(k.id, 'overall', Math.min(100, k.overall + 5))}>+</Botao>
      </td>
    </tr>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', pointerEvents: 'auto' }}>
      <div style={{ ...painel, padding: 10, maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
        <div style={{ fontSize: 15, marginBottom: 4 }}>Preparar batalha (teste)</div>
        <div style={{ fontWeight: 400, color: '#aab4c8', marginBottom: 6, maxWidth: 520 }}>
          Escolha a Akuma no Mi e o Haki de cada um. Overall decide duelos de Haki: observação esquiva 100% de quem tem menos; Haki do Rei atordoa quem tem menos;
          dois Rei imbuídos se chocam (diferença até 3 = empate, o golpe se anula).
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#9aa6bc', fontWeight: 400 }}>
              <td></td>
              <td>Akuma</td>
              <td>Armamento</td>
              <td>Observação</td>
              <td>Rei</td>
              <td>Overall</td>
            </tr>
          </thead>
          <tbody>{b.config.map(linha)}</tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Botao grande ativo onClick={() => c.comecar()}>
            Começar batalha
          </Botao>
        </div>
      </div>
    </div>
  )
}

export function HudBatalha({ b, c, velocidade, mudarVelocidade }: { b: RetratoBatalha; c: ControleBatalha; velocidade: number; mudarVelocidade: (v: number) => void }) {
  const [verLog, setVerLog] = useState(false)
  if (b.fase === 'preparar') return <Preparar b={b} c={c} />
  const s = b.selecionado
  const minha = b.fase === 'minha' && !b.animando && !b.auto
  const skill = s?.skills.find((k) => k.id === s.skill)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* topo: vez, tempo, ações e movimento */}
      <div style={{ ...painel, position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '5px 12px', textAlign: 'center', maxWidth: 'calc(100% - 300px)', minWidth: 200 }}>
        <div style={{ fontSize: 14, color: b.vez === 'piratas' ? '#ffd34a' : '#8ac4ff' }}>
          {b.vez === 'piratas' ? 'Sua vez' : 'Vez da Marinha'} · {b.turno}
          {b.fase === 'minha' && <span style={{ color: b.tempo <= 20 ? '#ff6a5a' : '#dfe6f3' }}> · {Math.floor(b.tempo / 60)}:{String(b.tempo % 60).padStart(2, '0')}</span>}
        </div>
        <div>
          Ações{' '}
          {Array.from({ length: ACOES_POR_VEZ }, (_, i) => (
            <span key={i} style={{ color: i < b.acoes ? '#ffd34a' : '#333a4a' }}>
              ◆
            </span>
          ))}{' '}
          · Movimento {b.movimento}/{MOVIMENTO_POR_VEZ}
        </div>
        <div style={{ color: '#b8c4da', fontWeight: 400, marginTop: 2 }}>{b.dica}</div>
      </div>

      {/* tripulações */}
      <div style={{ ...painel, position: 'absolute', left: 8, top: 8, padding: 5, width: 128, maxHeight: 'calc(100% - 16px)', overflow: 'auto' }}>
        {b.tripulacao.map((t) => (
          <Ficha key={t.id} f={t} sel={s?.id === t.id} onClick={minha && t.hp > 0 ? () => c.selecionar(s?.id === t.id ? null : t.id) : undefined} />
        ))}
      </div>
      <div style={{ ...painel, position: 'absolute', right: 8, top: 8, padding: 5, width: 128, maxHeight: 'calc(100% - 130px)', overflow: 'auto' }}>
        {b.inimigos.map((t) => (
          <Ficha key={t.id} f={t} sel={false} />
        ))}
      </div>

      {/* pirata escolhido */}
      {s && minha && (
        <div style={{ ...painel, position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', padding: 6, width: 'min(560px, calc(100% - 290px))', minWidth: 260, textAlign: 'center' }}>
          <div style={{ fontSize: 13 }}>
            {s.nome} · <span style={{ color: '#4ab0ff' }}>energia {s.energia}</span> · <span style={{ color: '#ff6a7a' }}>espírito {s.espirito}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
            {s.skills.map((k) => (
              <Botao
                key={k.id}
                ativo={s.skill === k.id}
                cor={k.fruta ? '#ffcf6a' : undefined}
                desligado={!!k.motivo}
                titulo={`${k.descricao}${k.motivo ? ` — ${k.motivo}` : ''}`}
                onClick={() => c.escolherSkill(k.id)}
              >
                {k.nome}
                <span style={{ color: '#4ab0ff', fontWeight: 400 }}> {k.energia}</span>
              </Botao>
            ))}
          </div>
          {skill && (
            <div style={{ color: '#9aa6bc', fontWeight: 400 }}>
              {skill.descricao} (alcance {skill.alcance}, área {skill.area})
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
            {s.armamento && (
              <Botao ativo={s.usarArmamento} cor="#c890ff" desligado={!s.podeArmamento && !s.usarArmamento} onClick={() => c.alternarArmamento()} titulo="Haki de armamento no próximo golpe (gasta 1 uso)">
                Armamento {s.armamento}
              </Botao>
            )}
            {s.rei && s.armamento?.startsWith('avançado') && (
              <Botao ativo={s.usarRei} cor="#ff5a6a" desligado={!s.podeRei && !s.usarRei} onClick={() => c.alternarRei()} titulo="Haki do Rei imbuído no golpe (40 de espírito)">
                Rei imbuído
              </Botao>
            )}
            {s.observacao && (
              <Botao ativo={s.observando} cor="#9fe0ff" onClick={() => c.observar()} titulo="Liga a observação: gasta um uso a cada golpe recebido e tenta esquivar">
                Observação {s.observacao}
              </Botao>
            )}
            {s.rei && (
              <Botao cor="#ff5a6a" desligado={!s.podeHaoshoku} onClick={() => c.haoshoku()} titulo="Haki do Rei em área (70 de espírito, 1 ação): atordoa quem tem overall menor">
                Haki do Rei (área)
              </Botao>
            )}
            {skill && (skill.area === 'si' || skill.area === 'volta') && (
              <Botao ativo onClick={() => c.usarPrevia()}>
                Usar
              </Botao>
            )}
          </div>
        </div>
      )}

      {/* registro */}
      <div style={{ ...painel, position: 'absolute', left: 8, bottom: 8, padding: 4, width: verLog ? 300 : 'auto', maxWidth: 'calc(100% - 16px)' }} onClick={() => setVerLog(!verLog)}>
        {verLog ? (
          <div style={{ fontWeight: 400, fontSize: 11, maxHeight: 160, overflow: 'auto' }}>
            {b.log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        ) : (
          <span style={{ cursor: 'pointer' }}>Registro ▸</span>
        )}
      </div>

      {/* passar e velocidade */}
      {b.fase !== 'fim' && (
        <div style={{ position: 'absolute', right: 8, bottom: 8, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div>
            <Botao ativo={b.auto} onClick={() => c.alternarAuto()} titulo="A IA joga pelos piratas também">
              Auto
            </Botao>
            <Botao onClick={() => mudarVelocidade(velocidade === 1 ? 2 : 1)} titulo="Velocidade das animações">
              {velocidade}×
            </Botao>
          </div>
          <Botao grande ativo={minha} desligado={!minha} onClick={() => c.passar()}>
            {b.fase === 'minha' ? 'Passar a vez' : 'Marinha jogando…'}
          </Botao>
        </div>
      )}

      {/* fim */}
      {b.fase === 'fim' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', pointerEvents: 'auto' }}>
          <div style={{ ...painel, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12, color: b.vencedor === 'piratas' ? '#ffd34a' : '#ff8a7a' }}>{b.vencedor === 'piratas' ? 'Vitória!' : 'Derrota'}</div>
            <div style={{ marginBottom: 12 }}>{b.turno} vezes</div>
            <Botao grande ativo onClick={() => c.novaBatalha()}>
              Nova batalha
            </Botao>
          </div>
        </div>
      )}
    </div>
  )
}
