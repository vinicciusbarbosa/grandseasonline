// Balanceamento por composição de time (misto x times de uma classe só), nos dois modos de vez:
//   N=40 npx tsx scripts/balanceamento/composicoes.ts          (sem fruta, Haki igual)
//   NEUTRO=0 N=40 npx tsx scripts/balanceamento/composicoes.ts (fruta e Haki do elenco)
import { aplicar, criarBatalha, type ModoVez } from '../../src/tabuleiro/batalha/regras'
import { TRIPULACOES, aplicarConfig, buildSugerida, combatentesIniciais, configPadrao, type Classe, type Config } from '../../src/tabuleiro/batalha/elenco'
import { proximaAcao } from '../../src/tabuleiro/batalha/ia'

const N = Number(process.env.N ?? 30)
const NEUTRO = process.env.NEUTRO !== '0'
const MISTO: Classe[] = ['espadachim', 'espadachim', 'lutador', 'atirador', 'tank']
const COMPS: Record<string, Classe[]> = {
  misto: MISTO,
  espadachim: Array(5).fill('espadachim'),
  lutador: Array(5).fill('lutador'),
  tank: Array(5).fill('tank'),
  atirador: Array(5).fill('atirador'),
}

function config(pir: Classe[], mar: Classe[]): Config[] {
  const piratas = TRIPULACOES.filter((m) => m.lado === 'piratas').map((m) => m.id)
  const marinha = TRIPULACOES.filter((m) => m.lado === 'marinha').map((m) => m.id)
  return configPadrao().map((k) => {
    const ip = piratas.indexOf(k.id)
    const classe = ip >= 0 ? pir[ip] : mar[marinha.indexOf(k.id)]
    const lider = ip === 0 || marinha.indexOf(k.id) === 0
    const base = NEUTRO ? { akuma: '', armamento: (lider ? 2 : 1) as 0 | 1 | 2 | 3, observacao: 1 as 0 | 1 | 2, rei: lider, overall: lider ? 60 : 40 } : {}
    const c = { ...k, ...base, classe }
    return { ...c, build: buildSugerida(classe, !!c.akuma) }
  })
}

type Res = { vitorias: number; total: number; vezes: number }
const danoClasse: Record<string, number> = {}
const ataquesClasse: Record<string, number> = {}
function lutar(pir: Classe[], mar: Classe[], modo: ModoVez, semente: number) {
  let e = criarBatalha(aplicarConfig(combatentesIniciais(), config(pir, mar)), semente, modo)
  for (const c of e.combatentes) c.armamentoLigado = !!c.haki.armamento
  let k = 0
  while (!e.vencedor && e.turno < 600 && k++ < 6000) {
    const a = proximaAcao(e)
    const r = aplicar(e, a)
    if ('erro' in r) { const p = aplicar(e, { t: 'passar' }); if ('erro' in p) break; e = p.estado; continue }
    for (const v of r.eventos as any[]) {
      if (v.t === 'golpe' && v.dano > 0) { const c = e.combatentes.find((x) => x.id === v.de)!; danoClasse[c.papel] = (danoClasse[c.papel] ?? 0) + v.dano }
      if (v.t === 'skill') { const c = e.combatentes.find((x) => x.id === v.id)!; ataquesClasse[c.papel] = (ataquesClasse[c.papel] ?? 0) + 1 }
    }
    e = r.estado
  }
  return { vencedor: e.vencedor, turno: e.turno }
}

for (const modo of ['tripulacao', 'fila'] as ModoVez[]) {
  const nomes = Object.keys(COMPS)
  const placar: Record<string, Res> = {}
  for (const n of nomes) placar[n] = { vitorias: 0, total: 0, vezes: 0 }
  const linhas: string[] = []
  for (let i = 0; i < nomes.length; i++)
    for (let j = i + 1; j < nomes.length; j++) {
      const A = nomes[i], B = nomes[j]
      let va = 0, vezes = 0
      for (let s = 0; s < N; s++) {
        // metade com A em cima, metade com A embaixo
        const aPir = s % 2 === 0
        const r = aPir ? lutar(COMPS[A], COMPS[B], modo, 1000 + s) : lutar(COMPS[B], COMPS[A], modo, 1000 + s)
        const ganhouA = r.vencedor === (aPir ? 'piratas' : 'marinha')
        if (ganhouA) va++
        vezes += r.turno
      }
      placar[A].vitorias += va; placar[A].total += N
      placar[B].vitorias += N - va; placar[B].total += N
      linhas.push(`${A.padEnd(10)} x ${B.padEnd(10)} ${((va / N) * 100).toFixed(0).padStart(3)}%  (${(vezes / N).toFixed(0)} vezes)`)
    }
  // espelho: misto x misto (lado de cima vs baixo)
  let vp = 0, vz = 0
  for (let s = 0; s < N * 2; s++) { const r = lutar(MISTO, MISTO, modo, 5000 + s); if (r.vencedor === 'piratas') vp++; vz += r.turno }
  console.log(`\n=== modo ${modo} (${NEUTRO ? 'sem fruta, Haki igual' : 'fruta/Haki do elenco'}) ===`)
  console.log(linhas.join('\n'))
  console.log('vitórias totais:', Object.entries(placar).map(([k, v]) => `${k} ${((v.vitorias / v.total) * 100).toFixed(0)}%`).join(' | '))
  console.log(`misto x misto: lado de cima ${((vp / (N * 2)) * 100).toFixed(0)}%, ${(vz / (N * 2)).toFixed(0)} vezes`)
}
console.log('\ndano médio por ataque:', Object.entries(danoClasse).map(([k, v]) => `${k} ${(v / (ataquesClasse[k] ?? 1)).toFixed(0)}`).join(' | '))
