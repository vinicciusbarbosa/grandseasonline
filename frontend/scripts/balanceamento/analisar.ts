import { readFileSync, readdirSync } from 'node:fs'
const jobs = JSON.parse(readFileSync('jobs.json', 'utf8'))
const res: any[] = readdirSync('.').filter((f) => f.startsWith('res_')).flatMap((f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
const por = (g: string) => res.filter((r) => r.grupo === g)
const pct = (v: number) => `${Math.round(v * 100)}%`
console.log('resultados:', res.length, '/', jobs.length)

for (const r of por('espelho')) console.log('ESPELHO', r.nome, pct(r.vitoria), 'vezes', r.vezes.toFixed(1))
for (const r of por('elenco')) console.log('ELENCO', r.nome, pct(r.vitoria), 'vezes', r.vezes.toFixed(1))

console.log('\n== UM FATOR NUM PAPEL (vitória do time com o fator; base = ninguém com nada) ==')
const papel = por('papel')
const fatores = [...new Set(papel.map((r) => r.nome.split(': ')[1]))]
const papeis = ['Capitão', 'Espadachim', 'Lutador', 'Atirador', 'Médico']
console.log(['fator'.padEnd(26), ...papeis.map((p) => p.padStart(10))].join(''))
for (const f of fatores) console.log([f.padEnd(26), ...papeis.map((p) => { const r = papel.find((x) => x.nome === `${p}: ${f}`); return (r ? pct(r.vitoria) : '-').padStart(10) })].join(''))

console.log('\n== TIME INTEIRO COM O FATOR × TIME SEM NADA ==')
for (const r of por('time').sort((a, b) => b.vitoria - a.vitoria)) console.log(r.nome.padEnd(28), pct(r.vitoria).padStart(5), 'vezes', r.vezes.toFixed(1))

console.log('\n== MATRIZ (linha vence coluna) ==')
const mat = por('matriz')
const nomes = [...new Set(mat.flatMap((r) => r.nome.split('|')))]
const v = (a: string, b: string) => { if (a === b) return '  —  '; const r = mat.find((x) => x.nome === `${a}|${b}`); if (r) return pct(r.vitoria).padStart(5); const s = mat.find((x) => x.nome === `${b}|${a}`); return s ? pct(1 - s.vitoria - s.empates).padStart(5) : '  ?  ' }
console.log(''.padEnd(16) + nomes.map((n) => n.slice(0, 7).padStart(8)).join(''))
for (const a of nomes) console.log(a.padEnd(16) + nomes.map((b) => v(a, b).padStart(8)).join(''))
// força média de cada estratégia na matriz
const media = nomes.map((a) => { const vs = nomes.filter((b) => b !== a).map((b) => parseInt(v(a, b))); return [a, vs.reduce((s, x) => s + x, 0) / vs.length] as const }).sort((x, y) => y[1] - x[1])
console.log('média:', media.map(([n, m]) => `${n} ${m.toFixed(0)}%`).join(' | '))

console.log('\n== OVERALL: capitães com Rei + arm. av.; diferença de overall do lado A ==')
for (const r of por('overall').sort((a, b) => +a.nome - +b.nome)) console.log(`d=${r.nome.padStart(3)}`, pct(r.vitoria))

// aleatório: regressão logística nas diferenças A − B
const al = por('aleatorio')
const feat = (t: any[]) => {
  const n = (f: (p: any) => boolean) => t.filter(f).length
  return [n((p) => ['fumaca', 'fogo', 'luz', 'gelo'].includes(p.akuma)), n((p) => p.akuma === 'borracha'), n((p) => p.akuma === 'bisao'), n((p) => p.armamento === 1), n((p) => p.armamento === 2), n((p) => p.observacao === 1), n((p) => p.observacao === 2), n((p) => p.rei), t.reduce((s: number, p: any) => s + (p.overall ?? 0), 0) / 50, t[0].rei && t[0].armamento === 2 ? 1 : 0]
}
const NOMES = ['Logia', 'Borracha', 'Bisão', 'Armamento', 'Arm. avançado', 'Observação', 'Obs. avançada', 'Haki do Rei', 'overall (+10 médio)', 'Capitão Rei+arm.av.']
const X: number[][] = [], Y: number[] = []
for (const r of al) { const j = jobs[r.i]; const fa = feat(j.a), fb = feat(j.b); X.push(fa.map((x, k) => x - fb[k])); Y.push(r.vitoria) }
const w = new Array(NOMES.length).fill(0)
for (let it = 0; it < 3000; it++) {
  const gr = new Array(w.length).fill(0)
  X.forEach((x, i) => { const p = 1 / (1 + Math.exp(-x.reduce((s, xi, k) => s + xi * w[k], 0))); x.forEach((xi, k) => (gr[k] += (Y[i] - p) * xi)) })
  gr.forEach((g, k) => (w[k] += (0.5 * g) / X.length))
}
console.log('\n== ALEATÓRIO (', al.length, 'confrontos): quanto cada coisa a mais muda a chance de vencer (partindo de 50%) ==')
NOMES.map((n, k) => [n, w[k]] as const).sort((a, b) => b[1] - a[1]).forEach(([n, wk]) => console.log(n.padEnd(22), `${wk >= 0 ? '+' : ''}${Math.round((1 / (1 + Math.exp(-wk)) - 0.5) * 100)} p.p.`))
const lado = al.reduce((s, r) => s + r.vitoria, 0) / al.length
console.log('A (começa como pirata na 1ª de cada par) venceu', pct(lado))
