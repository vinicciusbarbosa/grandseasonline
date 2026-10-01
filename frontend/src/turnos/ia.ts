import { esperado } from '../tabuleiro/batalha/ia'
import { chanceHaki, HAOSHOKU, REI_IMBUIDO } from '../tabuleiro/batalha/regras'
import { alvosDe, miraDe, motivo, outro, porId, skillsDe, vivos, type Acao, type Estado } from './regras'

/**
 * IA do combate sem tabuleiro, para quem está na vez (Marinha, ou a nossa
 * tripulação no automático). Mesmas escolhas da IA do tabuleiro, sem andar:
 * liga a observação, transforma, solta o Haki do Rei se pega alguém, cura
 * quem está ferido, e escolhe o golpe (e o alvo) de mais dano esperado,
 * ligando o armamento contra a Logia ou em golpe forte.
 * Devolve UMA ação; as que não gastam a vez vêm antes do ataque.
 */
export function proximaAcao(e: Estado): Acao {
  if (!e.atual) return { t: 'passar' }
  const c = porId(e, e.atual)
  const inimigos = vivos(e, outro(c.lado))
  const aliados = vivos(e, c.lado)

  if (!c.observando && (c.haki.observacao?.usos ?? 0) > 0) return { t: 'observar', id: c.id, ligado: true }
  if (!c.akuma?.transformado) {
    const t = skillsDe(c).find((s) => s.transforma && s.livre)
    if (t && c.energia >= t.energia && !c.recargas[t.id]) return { t: 'skill', id: c.id, skill: t.id, alvos: [c.id] }
  }
  if (c.haki.rei && c.espirito >= HAOSHOKU.espirito && inimigos.some((i) => !i.atordoado && chanceHaki(c.haki.overall - i.haki.overall) >= 0.5)) return { t: 'haoshoku', id: c.id }

  let melhor: { v: number; acao: Acao; haki?: { armamento: boolean; rei: boolean } } | null = null
  for (const s of skillsDe(c)) {
    if (c.energia < s.energia || c.recargas[s.id] || s.transforma) continue
    const m = miraDe(s)
    if (m.tipo === 'aliado') {
      for (const a of aliados) {
        if (a.hp / a.hpMax > 0.65) continue
        const v = Math.min(s.cura!, a.hpMax - a.hp) * 1.2
        if (!melhor || v > melhor.v) melhor = { v, acao: { t: 'skill', id: c.id, skill: s.id, alvos: [a.id] } }
      }
      continue
    }
    const usos = c.haki.armamento?.usos ?? 0
    // opções de alvo: cada inimigo (um, área) ou os n de mais dano (vários)
    const opcoes: string[][] =
      m.tipo === 'todos'
        ? [inimigos.slice(0, 1).map((x) => x.id)]
        : m.tipo === 'varios'
          ? [[...inimigos].sort((x, y) => esperado(c, y, s.mult, s.golpes ?? 1, false) - esperado(c, x, s.mult, s.golpes ?? 1, false)).slice(0, m.n).map((x) => x.id)]
          : inimigos.map((x) => [x.id])
    for (const escolha of opcoes) {
      if (!escolha.length) continue
      const alvos = alvosDe(e, c, s, escolha).map((id) => porId(e, id))
      const logia = alvos.some((o) => o.logia && o.logia.cargas > 0)
      const armamento = usos > 0 && (logia || (usos > 1 && s.energia > 0))
      let v = alvos.reduce((t, o) => t + esperado(c, o, s.mult, s.golpes ?? 1, armamento), 0)
      v -= s.energia * 0.3
      const rei = armamento && c.haki.rei && !!c.haki.armamento?.avancado && c.espirito >= REI_IMBUIDO.espirito
      if (!melhor || v > melhor.v) melhor = { v, acao: { t: 'skill', id: c.id, skill: s.id, alvos: escolha }, haki: { armamento, rei } }
    }
  }
  if (melhor) {
    const h = melhor.haki
    if (h) {
      if (h.rei !== c.reiLigado) return { t: 'haki', id: c.id, tipo: 'rei', ligado: h.rei }
      if (h.armamento !== c.armamentoLigado) return { t: 'haki', id: c.id, tipo: 'armamento', ligado: h.armamento }
    }
    if (!motivo(e, melhor.acao)) return melhor.acao
  }
  return { t: 'passar' }
}
