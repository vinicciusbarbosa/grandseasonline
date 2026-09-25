/**
 * Assa as ilhas modeladas em imagens prontas (WebP) para o jogo só carregar.
 *
 *   1. python3 frontend/scripts/gerar_mundo.py      (se mudou alguma ilha)
 *   2. npm --prefix frontend run dev                 (deixe rodando)
 *   3. node frontend/scripts/assar_ilhas.mjs [url]   (padrão: http://localhost:5173)
 *
 * Abre /navegacao?assar-ilhas num Chromium sem janela, espera a cena montar
 * as ilhas em 3D e salva cada faixa em public/mundo/ilhas/assadas/, com o
 * índice em src/navegacao/mundo/ilhas-assadas.json.
 *
 * Precisa do Playwright (npm i -D playwright, ou PLAYWRIGHT=<caminho do módulo>).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright')

const pasta = path.join(raiz, 'public', 'mundo', 'ilhas', 'assadas')
fs.rmSync(pasta, { recursive: true, force: true })
fs.mkdirSync(pasta, { recursive: true })

const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const pagina = await navegador.newPage({ viewport: { width: 800, height: 500 } })
pagina.on('pageerror', (e) => console.error('erro na página:', e.message))
await pagina.goto(`${url}/navegacao?assar-ilhas`)
console.log('assando as ilhas (no Chromium sem GPU leva um ou dois minutos)...')
await pagina.waitForFunction(() => window.cenaOceano?.ilhas?.prontas === true, null, { timeout: 15 * 60_000, polling: 1000 })

const ilhas = await pagina.evaluate(() =>
  window.cenaOceano.ilhas.em3d.map((ilha) => ({
    id: ilha.meta.id,
    nome: ilha.meta.nome,
    faixas: ilha.faixas.map((f) => ({
      ...f,
      dados: window.cenaOceano.textures.get(f.chave).getSourceImage().toDataURL('image/webp', 0.9),
    })),
  })),
)

const indice = []
let total = 0
for (const ilha of ilhas) {
  const faixas = []
  for (const f of ilha.faixas) {
    const arquivo = `${f.chave}.webp`
    const bytes = Buffer.from(f.dados.split(',')[1], 'base64')
    fs.writeFileSync(path.join(pasta, arquivo), bytes)
    total += bytes.length
    faixas.push({ chave: f.chave, arquivo, x: Math.round(f.x * 100) / 100, y: Math.round(f.y * 100) / 100, sul: f.sul })
  }
  indice.push({ id: ilha.id, faixas })
  console.log(`  ${ilha.nome}: ${faixas.length} faixas`)
}
fs.writeFileSync(path.join(raiz, 'src', 'navegacao', 'mundo', 'ilhas-assadas.json'), JSON.stringify(indice))
console.log(`pronto: ${indice.length} ilhas, ${(total / 1024 / 1024).toFixed(1)} MB em ${path.relative(process.cwd(), pasta)}`)
await navegador.close()
