// Gera a lista de experimentos (jobs.json).
import { writeFileSync } from 'node:fs'
import { NADA, type Perfil } from './nucleo'
import { configPadrao } from '../../src/tabuleiro/batalha/elenco'

type Job = { grupo: string; nome: string; a: Perfil[]; b: Perfil[]; n: number; semente: number }
const jobs: Job[] = []
let sem = 1
const add = (grupo: string, nome: string, a: Perfil[], b: Perfil[], n: number) => jobs.push({ grupo, nome, a, b, n, semente: (sem += 100000) })
const base = (): Perfil[] => Array.from({ length: 5 }, () => ({ ...NADA }))
const PAPEIS = ['Capitão', 'Espadachim', 'Lutador', 'Atirador', 'Médico']

const FATORES: [string, Partial<Perfil>][] = [
  ['Logia Fumaça', { akuma: 'fumaca' }],
  ['Logia Fogo', { akuma: 'fogo' }],
  ['Logia Luz', { akuma: 'luz' }],
  ['Logia Gelo', { akuma: 'gelo' }],
  ['Paramecia Borracha', { akuma: 'borracha' }],
  ['Zoan Bisão', { akuma: 'bisao' }],
  ['Armamento', { armamento: 1 }],
  ['Armamento avançado', { armamento: 2 }],
  ['Observação', { observacao: 1 }],
  ['Observação avançada', { observacao: 2 }],
  ['Haki do Rei', { rei: true }],
  ['Rei + armamento avançado', { rei: true, armamento: 2 }],
]

// E0: espelho
add('espelho', 'base × base', base(), base(), 1000)
// E1: um fator num papel
for (let r = 0; r < 5; r++)
  for (const [nome, f] of FATORES) {
    const a = base()
    a[r] = { ...a[r], ...f }
    add('papel', `${PAPEIS[r]}: ${nome}`, a, base(), 300)
  }
// E2: o time inteiro com o fator
for (const [nome, f] of FATORES) add('time', nome, base().map((p) => ({ ...p, ...f })), base(), 300)
// E3: matriz — time inteiro com um fator contra time inteiro com outro
const M: [string, Partial<Perfil>][] = [
  ['Nada', {}],
  ['Logia Fumaça', { akuma: 'fumaca' }],
  ['Logia Fogo', { akuma: 'fogo' }],
  ['Logia Gelo', { akuma: 'gelo' }],
  ['Borracha', { akuma: 'borracha' }],
  ['Bisão', { akuma: 'bisao' }],
  ['Armamento', { armamento: 1 }],
  ['Arm. avançado', { armamento: 2 }],
  ['Obs. avançada', { observacao: 2 }],
  ['Rei + arm. av.', { rei: true, armamento: 2 }],
]
for (let i = 0; i < M.length; i++)
  for (let j = i + 1; j < M.length; j++)
    add('matriz', `${M[i][0]}|${M[j][0]}`, base().map((p) => ({ ...p, ...M[i][1] })), base().map((p) => ({ ...p, ...M[j][1] })), 200)
// E5: overall — capitães com Rei + arm. avançado, diferença de overall
for (let d = -12; d <= 12; d += 2) {
  const a = base(), b = base()
  a[0] = { akuma: '', armamento: 2, observacao: 0, rei: true, overall: 60 + d }
  b[0] = { akuma: '', armamento: 2, observacao: 0, rei: true, overall: 60 }
  add('overall', String(d), a, b, 300)
}
// E6: elenco de teste do jogo (como está na tela de preparação), sem trocar de lado
const cfg = configPadrao()
const perf = (ids: number[]) => ids.map((i) => ({ akuma: cfg[i].akuma, armamento: cfg[i].armamento, observacao: cfg[i].observacao, rei: cfg[i].rei, overall: cfg[i].overall }))
add('elenco', 'Piratas × Marinha (elenco de teste)', perf([0, 1, 2, 3, 4]), perf([5, 6, 7, 8, 9]), 1000)
// E4: confrontos aleatórios
const rnd = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })()
const FR = ['fumaca', 'fogo', 'luz', 'gelo', 'borracha', 'bisao']
const aleatorio = (): Perfil[] =>
  Array.from({ length: 5 }, () => {
    const p: Perfil = { akuma: rnd() < 0.4 ? FR[Math.floor(rnd() * FR.length)] : '', armamento: Math.floor(rnd() * 3) as 0 | 1 | 2, observacao: Math.floor(rnd() * 3) as 0 | 1 | 2, rei: rnd() < 0.25 }
    const o = p.armamento || p.observacao || p.rei ? 20 + p.armamento * 12 + p.observacao * 10 + (p.rei ? 20 : 0) : 0
    return { ...p, overall: Math.max(0, Math.round(o + (rnd() - 0.5) * 20)) }
  })
for (let i = 0; i < 2000; i++) add('aleatorio', String(i), aleatorio(), aleatorio(), 2)
writeFileSync('jobs.json', JSON.stringify(jobs))
console.log(jobs.length, 'jobs,', jobs.reduce((s, j) => s + j.n, 0), 'batalhas')
