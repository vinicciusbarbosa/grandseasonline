// Roda uma fatia dos jobs e grava resultados (uma linha JSON por job).
import { readFileSync, writeFileSync } from 'node:fs'
import { duelo } from './nucleo'
const [fatia, total] = process.argv.slice(2).map(Number)
const jobs = JSON.parse(readFileSync('jobs.json', 'utf8'))
const out: string[] = []
jobs.forEach((j: any, i: number) => {
  if (i % total !== fatia) return
  const r = duelo(j.a, j.b, j.n, j.semente)
  out.push(JSON.stringify({ i, grupo: j.grupo, nome: j.nome, ...r }))
  if (out.length % 200 === 0) writeFileSync(`res_${fatia}.jsonl`, out.join('\n'))
})
writeFileSync(`res_${fatia}.jsonl`, out.join('\n'))
console.log('fatia', fatia, 'ok', out.length)
