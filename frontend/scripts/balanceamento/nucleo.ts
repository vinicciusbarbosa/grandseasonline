// Núcleo das simulações de balanceamento: monta configs e roda batalhas IA × IA.
import { aplicar, criarBatalha } from '../../src/tabuleiro/batalha/regras'
import { aplicarConfig, combatentesIniciais, type Config } from '../../src/tabuleiro/batalha/elenco'
import { proximaAcao } from '../../src/tabuleiro/batalha/ia'

export const PIRATAS = ['pirata-capitao', 'pirata-espadachim', 'pirata-lutador', 'pirata-atiradora', 'pirata-medico']
export const MARINHA = ['marinha-almirante', 'marinha-oficial', 'marinha-soldado', 'marinha-atirador', 'marinha-enfermeira']
export const PAPEIS = ['capitao', 'espadachim', 'lutador', 'atirador', 'medico']

/** Haki/akuma de um papel (sem id). */
export type Perfil = { akuma: string; armamento: 0 | 1 | 2; observacao: 0 | 1 | 2; rei: boolean; overall?: number }
export const NADA: Perfil = { akuma: '', armamento: 0, observacao: 0, rei: false }
/** overall pelo Haki que tem (se não vier fixo) */
export const overallDe = (p: Perfil) => p.overall ?? (p.armamento || p.observacao || p.rei ? 20 + p.armamento * 12 + p.observacao * 10 + (p.rei ? 20 : 0) : 0)

export function montar(piratas: Perfil[], marinha: Perfil[]): Config[] {
  const f = (id: string, p: Perfil): Config => ({ id, akuma: p.akuma, armamento: p.armamento, observacao: p.observacao, rei: p.rei, overall: overallDe(p) })
  return [...PIRATAS.map((id, i) => f(id, piratas[i])), ...MARINHA.map((id, i) => f(id, marinha[i]))]
}

export function batalhar(cfg: Config[], semente: number) {
  let e = criarBatalha(aplicarConfig(combatentesIniciais(), cfg), semente)
  let n = 0
  while (!e.vencedor && e.turno < 90 && n++ < 4000) {
    const r = aplicar(e, proximaAcao(e))
    if ('erro' in r) {
      const r2 = aplicar(e, { t: 'passar' })
      if ('erro' in r2) break
      e = r2.estado
      continue
    }
    e = r.estado
  }
  const hp = (l: string) => e.combatentes.filter((c) => c.lado === l).reduce((s, c) => s + Math.max(0, c.hp), 0)
  return { vencedor: e.vencedor, vezes: e.turno, hpP: hp('piratas'), hpM: hp('marinha') }
}

/**
 * Taxa de vitória do lado A (perfil `a`) contra B (`b`), jogando metade das
 * batalhas de pirata e metade de Marinha (tira a vantagem de lado).
 */
export function duelo(a: Perfil[], b: Perfil[], n: number, semente0 = 1) {
  let vA = 0, emp = 0, vezes = 0
  for (let i = 0; i < n; i++) {
    const aPirata = i % 2 === 0
    const r = batalhar(aPirata ? montar(a, b) : montar(b, a), semente0 + i * 7919)
    vezes += r.vezes
    if (!r.vencedor) emp++
    else if ((r.vencedor === 'piratas') === aPirata) vA++
  }
  return { vitoria: vA / n, empates: emp / n, vezes: vezes / n }
}
