import type { Logger, Plugin, ViteDevServer } from 'vite'
import { WebSocketServer, type WebSocket } from 'ws'
import { MAX_JOGADORES, type JogadorMp, type MsgCliente, type MsgServidor } from '../src/navegacao/mp/protocolo.ts'

/**
 * Servidor do multiplayer beta, embutido no servidor de desenvolvimento do
 * Vite: o mesmo `npm run dev` serve o jogo e a sala, no mesmo endereço e
 * porta (WebSocket em /mp). Uma sala só, com até 2 jogadores.
 *
 * Ele guarda o relógio da sala (vento e ondas dependem do tempo: os dois
 * precisam do MESMO tempo para verem o mesmo vento), repassa o estado dos
 * navios e as salvas, e conta os abates.
 */
export function multiplayer(): Plugin {
  return {
    name: 'sugoi-multiplayer',
    // No `npm run dev` e também no `vite preview` (a versão compilada: carrega
    // muito mais rápido para quem entra de fora, por túnel ou VPN).
    configureServer: (servidor) => abrirSala(servidor.httpServer, servidor.config.logger),
    configurePreviewServer: (servidor) => abrirSala(servidor.httpServer, servidor.config.logger),
  }
}

function abrirSala(http: ViteDevServer['httpServer'], logger: Logger) {
  if (!http) return
  const wss = new WebSocketServer({ noServer: true })
  const inicio = Date.now()
  const relogio = () => (Date.now() - inicio) / 1000
  const sala = new Map<WebSocket, JogadorMp>()

  http.on('upgrade', (req, socket, cabeca) => {
    if (!req.url?.startsWith('/mp')) return // o resto (HMR do Vite) não é conosco
    wss.handleUpgrade(req, socket, cabeca, (ws) => wss.emit('connection', ws, req))
  })

  const enviar = (ws: WebSocket, m: MsgServidor) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
  }
  const paraTodos = (m: MsgServidor, exceto?: WebSocket) => {
    for (const ws of sala.keys()) if (ws !== exceto) enviar(ws, m)
  }
  const jogadores = () => [...sala.values()]
  const log = (texto: string) => logger.info(`\x1b[36m[multiplayer]\x1b[0m ${texto}`, { timestamp: true })

  wss.on('connection', (ws) => {
    let eu: JogadorMp | null = null

    ws.on('message', (bruto) => {
      let m: MsgCliente
      try {
        m = JSON.parse(String(bruto)) as MsgCliente
      } catch {
        return
      }
      if (m.t === 'ping') {
        enviar(ws, { t: 'pong', c: m.c, relogio: relogio() })
        return
      }
      if (m.t === 'entrar') {
        if (eu) return
        if (sala.size >= MAX_JOGADORES) {
          enviar(ws, { t: 'cheio' })
          ws.close()
          return
        }
        const nome = String(m.nome ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || 'Marujo'
        eu = {
          id: Math.random().toString(36).slice(2, 10),
          nome,
          navio: m.navio === 'marinha' ? 'marinha' : 'pirata',
          ilha: String(m.ilha ?? '').slice(0, 40),
          abates: 0,
        }
        sala.set(ws, eu)
        enviar(ws, { t: 'bemvindo', id: eu.id, relogio: relogio(), jogadores: jogadores() })
        paraTodos({ t: 'jogadores', jogadores: jogadores() }, ws)
        log(`${eu.nome} entrou (${sala.size}/${MAX_JOGADORES})`)
        return
      }
      if (!eu) return
      switch (m.t) {
        case 'estado':
          paraTodos({ t: 'estado', id: eu.id, e: m.e }, ws)
          break
        case 'salva':
          paraTodos({ t: 'salva', id: eu.id, lado: m.lado, disparos: m.disparos.slice(0, 8) }, ws)
          break
        case 'afundei': {
          const matador = jogadores().find((j) => j.id === m.por && j.id !== eu!.id)
          if (matador) matador.abates++
          paraTodos({ t: 'afundou', id: eu.id, por: matador?.id ?? null })
          paraTodos({ t: 'jogadores', jogadores: jogadores() })
          log(matador ? `${matador.nome} afundou ${eu.nome}` : `${eu.nome} afundou`)
          break
        }
      }
    })

    ws.on('close', () => {
      if (!eu) return
      sala.delete(ws)
      paraTodos({ t: 'saiu', id: eu.id, nome: eu.nome })
      paraTodos({ t: 'jogadores', jogadores: jogadores() })
      log(`${eu.nome} saiu (${sala.size}/${MAX_JOGADORES})`)
    })
  })
}
