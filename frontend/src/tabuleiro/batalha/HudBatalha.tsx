import type { ControleBatalha, RetratoBatalha } from './controle'
import { NOME_GOLPE, NOME_POSTURA } from './controle'
import { CUSTO, type Golpe, type Postura } from './regras'

/**
 * HUD da batalha: rodada e vontade no topo, a tripulação à esquerda, o
 * painel do pirata escolhido (golpe e postura) embaixo, o botão de
 * confirmar o turno e a tela de fim.
 */

const fonte = '700 12px/1.2 monospace'
const painel: React.CSSProperties = {
  background: 'rgba(12,16,28,0.86)',
  border: '1px solid #3a4a6a',
  borderRadius: 6,
  color: '#f3e3c3',
  font: fonte,
  pointerEvents: 'auto',
}

function Botao(props: { ativo?: boolean; desligado?: boolean; onClick: () => void; children: React.ReactNode; cor?: string; titulo?: string }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.desligado}
      title={props.titulo}
      style={{
        font: fonte,
        padding: '7px 9px',
        margin: 2,
        borderRadius: 4,
        border: `1px solid ${props.ativo ? (props.cor ?? '#ffd34a') : '#4a5a7a'}`,
        background: props.ativo ? 'rgba(255,211,74,0.18)' : 'rgba(30,38,58,0.9)',
        color: props.desligado ? '#666' : props.ativo ? (props.cor ?? '#ffd34a') : '#dfe6f3',
        cursor: props.desligado ? 'default' : 'pointer',
        minWidth: 64,
      }}
    >
      {props.children}
    </button>
  )
}

function Pontos({ n, cor }: { n: number; cor: string }) {
  return (
    <span style={{ letterSpacing: 1 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ color: i < n ? cor : '#333a4a' }}>
          ●
        </span>
      ))}
    </span>
  )
}

const DICA_GOLPE: Record<Golpe, string> = {
  comum: 'Normal. Bloqueio segura, aparar anula.',
  pesado: '×1,5 e quebra bloqueio/aparar, mas é fácil de esquivar.',
  finta: '×0,8, engana quem apara ou contra-ataca; não dá para esquivar.',
}
const DICA_POSTURA: Record<Postura, string> = {
  bloquear: 'Segura o golpe comum (35% passa). Pesado quebra.',
  esquivar: 'Chance de escapar (alta contra pesado). Finta sempre acerta.',
  aparar: 'Anula o golpe comum. Pesado quebra, finta engana. Custa 2.',
  contra: 'Recebe o golpe e revida de perto. Finta engana. Custa 3.',
}

export function HudBatalha({ b, c, velocidade, mudarVelocidade }: { b: RetratoBatalha; c: ControleBatalha; velocidade: number; mudarVelocidade: (v: number) => void }) {
  const s = b.selecionado
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* topo: rodada e vontade */}
      <div style={{ ...painel, position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '6px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 14 }}>Rodada {b.rodada}</div>
        <div>
          Piratas <Pontos n={b.fase === 'planejar' ? b.vontadeLivre : b.vontade.piratas} cor="#c58bff" />
          {'  '}Marinha <Pontos n={b.vontade.marinha} cor="#7fb2ff" />
        </div>
        <div style={{ color: '#b8c4da', fontWeight: 400, marginTop: 2, whiteSpace: 'normal', maxWidth: 360 }}>{b.dica}</div>
      </div>

      {/* tripulação */}
      <div style={{ ...painel, position: 'absolute', left: 8, top: 8, padding: 6, width: 132 }}>
        {b.tripulacao.map((t) => (
          <div
            key={t.id}
            onClick={() => b.fase === 'planejar' && t.hp > 0 && c.selecionar(t.id)}
            style={{ padding: '3px 2px', cursor: 'pointer', opacity: t.hp > 0 ? 1 : 0.35, color: s?.id === t.id ? '#ffd34a' : undefined }}
          >
            {t.planejado ? '✓ ' : '· '}
            {t.nome}
            <div style={{ height: 4, background: '#1a0d0a', marginTop: 2 }}>
              <div style={{ width: `${(100 * Math.max(0, t.hp)) / t.hpMax}%`, height: '100%', background: t.hp / t.hpMax > 0.4 ? '#5fd35a' : '#e8503a' }} />
            </div>
          </div>
        ))}
      </div>

      {/* pirata escolhido */}
      {s && b.fase === 'planejar' && (
        <div style={{ ...painel, position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', padding: 8, maxWidth: 'calc(100% - 16px)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            {s.nome} · {s.hp}/{s.hpMax} · {s.acao === 'curar' ? 'vai curar' : s.acao === 'atacar' ? 'vai atacar' : 'sem ação'}
          </div>
          {s.acao !== 'curar' && (
            <div>
              Golpe:
              {(['comum', 'pesado', 'finta'] as Golpe[]).map((g) => (
                <Botao key={g} ativo={s.golpe === g} onClick={() => c.escolherGolpe(g)} titulo={DICA_GOLPE[g]}>
                  {NOME_GOLPE[g]}
                </Botao>
              ))}
            </div>
          )}
          <div>
            Postura:
            {(['bloquear', 'esquivar', 'aparar', 'contra'] as Postura[]).map((p) => (
              <Botao
                key={p}
                ativo={s.postura === p}
                cor="#9fe0ff"
                desligado={s.postura !== p && CUSTO[p] > b.vontadeLivre + CUSTO[s.postura]}
                onClick={() => c.escolherPostura(p)}
                titulo={DICA_POSTURA[p]}
              >
                {NOME_POSTURA[p]}
                {CUSTO[p] ? ` (${CUSTO[p]})` : ''}
              </Botao>
            ))}
          </div>
          <div style={{ color: '#9aa6bc', fontWeight: 400, marginTop: 2 }}>
            {s.acao !== 'curar' ? DICA_GOLPE[s.golpe] + ' ' : ''}
            {DICA_POSTURA[s.postura]}
          </div>
          <div>
            <Botao onClick={() => c.limparPlano()}>Limpar</Botao>
            <Botao onClick={() => c.selecionar(null)}>OK</Botao>
          </div>
        </div>
      )}

      {/* confirmar e velocidade */}
      {b.fase !== 'fim' && (
        <div style={{ position: 'absolute', right: 8, bottom: 8, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Botao onClick={() => mudarVelocidade(velocidade === 1 ? 2 : 1)} titulo="Velocidade das animações">
            {velocidade}×
          </Botao>
          <button
            onClick={() => void c.confirmar()}
            disabled={b.fase !== 'planejar'}
            style={{
              font: '700 15px monospace',
              padding: '12px 16px',
              marginTop: 4,
              borderRadius: 6,
              border: '2px solid #ffd34a',
              background: b.fase === 'planejar' ? '#8a2a1a' : '#333',
              color: '#fff1c8',
              cursor: b.fase === 'planejar' ? 'pointer' : 'default',
            }}
          >
            {b.fase === 'planejar' ? 'Confirmar turno' : 'Resolvendo…'}
          </button>
        </div>
      )}

      {/* fim */}
      {b.fase === 'fim' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', pointerEvents: 'auto' }}>
          <div style={{ ...painel, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12, color: b.vencedor === 'piratas' ? '#ffd34a' : '#ff8a7a' }}>
              {b.vencedor === 'piratas' ? 'Vitória!' : b.vencedor === 'marinha' ? 'Derrota' : 'Empate'}
            </div>
            <div style={{ marginBottom: 12 }}>{b.rodada} rodadas</div>
            <Botao onClick={() => c.novaBatalha()}>Nova batalha</Botao>
          </div>
        </div>
      )}
    </div>
  )
}
