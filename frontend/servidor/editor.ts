import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * Salvar do editor de animação direto no projeto (só no `npm run dev`):
 * - POST /__editor/salvar { arquivo: 'sprites/<id>/animacao.json', conteudo }
 *   grava o JSON em public/ (só .json dentro de public/sprites/);
 * - POST /__editor/folha?arquivo=sprites/<id>/folhas/x.png (corpo = a imagem)
 *   guarda uma folha nova (png/webp/jpg dentro de public/sprites/<id>/folhas/).
 */
export function editorAnimacao(): Plugin {
  return {
    name: 'sugoi-editor-animacao',
    configureServer(servidor) {
      const publico = path.resolve(servidor.config.root, 'public')
      servidor.middlewares.use('/__editor/salvar', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let corpo = ''
        req.on('data', (c) => (corpo += c))
        req.on('end', () => {
          try {
            const { arquivo, conteudo } = JSON.parse(corpo) as { arquivo: string; conteudo: unknown }
            const destino = path.resolve(publico, arquivo)
            if (!destino.startsWith(path.join(publico, 'sprites') + path.sep) || !destino.endsWith('.json')) throw new Error('caminho não permitido')
            fs.mkdirSync(path.dirname(destino), { recursive: true })
            fs.writeFileSync(destino, JSON.stringify(conteudo, null, 1))
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, arquivo }))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, erro: String(e) }))
          }
        })
      })
      servidor.middlewares.use('/__editor/folha', (req, res) => {
        const arquivo = new URL(req.url ?? '', 'http://x').searchParams.get('arquivo') ?? ''
        const destino = path.resolve(publico, arquivo)
        const ok = req.method === 'POST' && destino.startsWith(path.join(publico, 'sprites') + path.sep) && /[\\/]folhas[\\/][^\\/]+\.(png|webp|jpe?g)$/i.test(destino)
        if (!ok) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, erro: 'caminho não permitido' }))
          return
        }
        const partes: Buffer[] = []
        req.on('data', (c: Buffer) => partes.push(c))
        req.on('end', () => {
          fs.mkdirSync(path.dirname(destino), { recursive: true })
          fs.writeFileSync(destino, Buffer.concat(partes))
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: true, arquivo }))
        })
      })
    },
  }
}
