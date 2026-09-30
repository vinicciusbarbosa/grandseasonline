// Testa variações do elenco de teste (Piratas × Marinha como na tela), sem trocar de lado.
import { configPadrao, type Config } from '../../src/tabuleiro/batalha/elenco'
import { batalhar } from './nucleo'
const variantes: Record<string, (c: Config[]) => void> = {
  'espadachim arm. avançado': (c) => { c[1].armamento = 2; c[1].overall = 45 },
  'espadachim arm. av. + comandante sem obs': (c) => { c[1].armamento = 2; c[1].overall = 45; c[5].observacao = 0 },
  'espadachim arm. av. + obs': (c) => { c[1].armamento = 2; c[1].observacao = 1; c[1].overall = 55 },
  'comandante sem obs + médico obs': (c) => { c[5].observacao = 0; c[4].observacao = 1; c[4].overall = 30 },
}
const n = Number(process.argv[2] ?? 300)
for (const [nome, f] of Object.entries(variantes)) {
  const cfg = configPadrao(); f(cfg)
  let v = 0
  for (let i = 0; i < n; i++) if (batalhar(cfg, 1 + i * 7919).vencedor === 'piratas') v++
  console.log(nome.padEnd(40), Math.round((100 * v) / n) + '%')
}
