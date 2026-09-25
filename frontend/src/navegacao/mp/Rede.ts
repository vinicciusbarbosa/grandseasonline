import type { DisparoMp, EstadoMp, JogadorMp, LadoMp, MsgCliente, MsgServidor, NavioMp } from './protocolo'

/**
 * Conexão com a sala do multiplayer beta (WebSocket em /mp, no mesmo
 * endereço do jogo). Mantém a lista de jogadores e o RELÓGIO DA SALA: o
 * tempo da cena vem daqui, então vento e ondas são os mesmos nas duas telas.
 */

export type EntradaMp = { nome: string; navio: NavioMp; ilha: string }

type Ouvinte = (m: MsgServidor) => void

export class Rede {
  id = ''
  jogadores: JogadorMp[] = []
  /** Ida e volta da última medição, em ms. */
  ping = 0
  private readonly ws: WebSocket
  private readonly ouvintes = new Set<Ouvinte>()
  /** relógio da sala − relógio local (s). */
  private diferenca = 0
  private melhorIdaEVolta = Infinity
  private temporizador = 0

  private constructor(ws: WebSocket) {
    this.ws = ws
  }

  /** Conecta e entra na sala. Resolve no "bem-vindo"; rejeita com o motivo. */
  static conectar(entrada: EntradaMp): Promise<Rede> {
    return new Promise((resolver, rejeitar) => {
      const protocolo = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocolo}://${location.host}/mp`)
      const rede = new Rede(ws)
      let pronta = false
      ws.onopen = () => rede.enviar({ t: 'entrar', ...entrada })
      ws.onerror = () => {
        if (!pronta) rejeitar(new Error('Não deu para falar com a sala. O jogo precisa estar rodando com "npm run dev" (o servidor multiplayer vem junto).'))
      }
      ws.onclose = () => {
        window.clearInterval(rede.temporizador)
        if (!pronta) rejeitar(new Error('A conexão com a sala caiu.'))
        else rede.emitir({ t: 'saiu', id: '__eu__', nome: '' })
      }
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data)) as MsgServidor
        if (m.t === 'cheio') {
          rejeitar(new Error('A sala está cheia (2 de 2). Espere alguém sair.'))
          return
        }
        if (m.t === 'bemvindo') {
          pronta = true
          rede.id = m.id
          rede.jogadores = m.jogadores
          rede.diferenca = m.relogio - performance.now() / 1000
          rede.medir()
          rede.temporizador = window.setInterval(() => rede.medir(), 2000)
          resolver(rede)
          return
        }
        if (m.t === 'pong') {
          const agora = performance.now()
          const idaEVolta = agora - m.c
          rede.ping = Math.round(idaEVolta)
          // Fica com a medição de menor atraso (a mais confiável), mas deixa
          // ela "envelhecer" para acompanhar mudanças da rede.
          rede.melhorIdaEVolta *= 1.05
          if (idaEVolta <= rede.melhorIdaEVolta) {
            rede.melhorIdaEVolta = idaEVolta
            rede.diferenca = m.relogio + idaEVolta / 2000 - agora / 1000
          }
          return
        }
        if (m.t === 'jogadores') rede.jogadores = m.jogadores
        rede.emitir(m)
      }
    })
  }

  /** Tempo da sala, em segundos (o mesmo para todos). */
  relogio() {
    return performance.now() / 1000 + this.diferenca
  }

  ouvir(f: Ouvinte) {
    this.ouvintes.add(f)
    return () => this.ouvintes.delete(f)
  }

  enviarEstado(e: EstadoMp) {
    this.enviar({ t: 'estado', e })
  }

  enviarSalva(lado: LadoMp, disparos: DisparoMp[]) {
    this.enviar({ t: 'salva', lado, disparos })
  }

  afundei(por: string | null) {
    this.enviar({ t: 'afundei', por })
  }

  fechar() {
    window.clearInterval(this.temporizador)
    this.ouvintes.clear()
    this.ws.close()
  }

  nome(id: string) {
    return this.jogadores.find((j) => j.id === id)?.nome ?? '???'
  }

  private medir() {
    this.enviar({ t: 'ping', c: performance.now() })
  }

  private enviar(m: MsgCliente) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m))
  }

  private emitir(m: MsgServidor) {
    for (const f of this.ouvintes) f(m)
  }
}
