// Teste rápido: batalhas aleatórias com todas as frutas, conta erros e skills usadas.
import { aplicar, criarBatalha } from '../../src/tabuleiro/batalha/regras'
import { aplicarConfig, combatentesIniciais } from '../../src/tabuleiro/batalha/elenco'
import { proximaAcao } from '../../src/tabuleiro/batalha/ia'
import { montar, type Perfil } from './nucleo'
const FR = ['fumaca', 'fogo', 'luz', 'gelo', 'borracha', 'bisao']
let s = 99; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
const time = (): Perfil[] => Array.from({ length: 5 }, () => ({ akuma: FR[Math.floor(r() * 6)], armamento: Math.floor(r() * 3) as 0 | 1 | 2, observacao: Math.floor(r() * 3) as 0 | 1 | 2, rei: r() < 0.3 }))
const usos: Record<string, number> = {}; let erros = 0, vez = 0, pir = 0
const N = Number(process.argv[2] ?? 300)
for (let i = 0; i < N; i++) {
  let e = criarBatalha(aplicarConfig(combatentesIniciais(), montar(time(), time())), i + 1)
  let k = 0
  while (!e.vencedor && e.turno < 90 && k++ < 4000) {
    const res = aplicar(e, proximaAcao(e))
    if ('erro' in res) { erros++; e = (aplicar(e, { t: 'passar' }) as any).estado; continue }
    for (const v of res.eventos) if (v.t === 'skill') usos[v.skill] = (usos[v.skill] ?? 0) + 1
    e = res.estado
  }
  vez += e.turno; if (e.vencedor === 'piratas') pir++
}
console.log('erros', erros, 'vezes', (vez / N).toFixed(1), 'piratas', pir / N)
console.log(Object.entries(usos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '))
