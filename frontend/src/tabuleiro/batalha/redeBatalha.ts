import type { MsgClienteBatalha, MsgServidorBatalha } from './protocoloMp'

/** Conexão com a sala da batalha multiplayer (WebSocket em /mpb, no mesmo endereço do jogo). */
export class RedeBatalha {
  private readonly ws: WebSocket
  conectado = false

  constructor(nome: string, aoReceber: (m: MsgServidorBatalha) => void, aoFechar: () => void) {
    const protocolo = location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${protocolo}://${location.host}/mpb`)
    this.ws.onopen = () => {
      this.conectado = true
      this.enviar({ t: 'entrar', nome })
    }
    this.ws.onmessage = (ev) => {
      try {
        aoReceber(JSON.parse(String(ev.data)) as MsgServidorBatalha)
      } catch {
        /* mensagem quebrada: ignora */
      }
    }
    this.ws.onclose = () => {
      this.conectado = false
      aoFechar()
    }
  }

  enviar(m: MsgClienteBatalha) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m))
  }
}
