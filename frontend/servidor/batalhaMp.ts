import type { Logger, ViteDevServer } from 'vite'
import { WebSocketServer, type WebSocket } from 'ws'
import { aplicarConfig, combatentesIniciais, configPadrao, ehClasse, renomear, sortearNomes, type Config } from '../src/tabuleiro/batalha/elenco.ts'
import { FOLGA_VEZ_MP, PREPARO_HAKI_MP, PREPARO_MP, type HakiMp, type MsgClienteBatalha, type MsgServidorBatalha } from '../src/tabuleiro/batalha/protocoloMp.ts'
import { aplicar, criarBatalha, hakiPreparacao, tempoDaVez, type Estado, type Lado } from '../src/tabuleiro/batalha/regras.ts'

/**
 * Sala da batalha multiplayer (WebSocket em /mpb): dois jogadores, um em
 * cada navio (o primeiro fica com os piratas, de cima; o segundo com o
 * navio de baixo). O servidor guarda o estado e roda as mesmas regras do
 * jogo: valida cada ação, repassa as aceitas aos dois na mesma ordem e
 * cuida do tempo da vez (com folga para as animações).
 */
type Jogador = { ws: WebSocket; nome: string; lado: Lado; pronto: boolean; config: Config[] | null; haki: HakiMp[] | null }

export function abrirSalaBatalha(http: ViteDevServer['httpServer'], logger: Logger) {
  if (!http) return
  const wss = new WebSocketServer({ noServer: true })
  const log = (texto: string) => logger.info(`\x1b[35m[batalha]\x1b[0m ${texto}`, { timestamp: true })
  http.on('upgrade', (req, socket, cabeca) => {
    if (!req.url?.startsWith('/mpb')) return
    wss.handleUpgrade(req, socket, cabeca, (ws) => wss.emit('connection', ws, req))
  })

  let jogadores: Jogador[] = []
  let fase: 'sala' | 'preparar' | 'haki' | 'batalha' = 'sala'
  let fimPreparo = 0
  let nomes = sortearNomes()
  let estado: Estado | null = null
  let n = 0
  let inicioVez = 0
  let timer: ReturnType<typeof setInterval> | null = null

  const enviar = (ws: WebSocket, m: MsgServidorBatalha) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
  }
  const todos = (m: MsgServidorBatalha) => jogadores.forEach((j) => enviar(j.ws, m))
  const sala = () =>
    todos({ t: 'sala', jogadores: jogadores.map((j) => ({ nome: j.nome, lado: j.lado, pronto: j.pronto })), restam: fase === 'preparar' ? Math.max(0, Math.ceil((fimPreparo - Date.now()) / 1000)) : null })

  const reiniciar = () => {
    fase = 'sala'
    estado = null
    n = 0
    nomes = sortearNomes()
    for (const j of jogadores) Object.assign(j, { pronto: false, config: null, haki: null })
  }

  /** preparação acabou: junta a montagem dos dois lados e começa a de Haki */
  const comecar = () => {
    const padrao = configPadrao()
    const config = padrao.map((k) => {
      const lado: Lado = k.id.startsWith('pirata') ? 'piratas' : 'marinha'
      const dono = jogadores.find((j) => j.lado === lado)
      const dele = dono?.config?.find((x) => x.id === k.id)
      // classe que não existe: fica a de origem
      return dele ? { ...dele, classe: ehClasse(dele.classe) ? dele.classe : k.classe } : k
    })
    const semente = Math.floor(Math.random() * 2147483646) + 1
    estado = criarBatalha(renomear(aplicarConfig(combatentesIniciais(), config), nomes), semente)
    fase = 'haki'
    fimPreparo = Date.now() + (PREPARO_HAKI_MP + 2) * 1000
    todos({ t: 'comecar', config, semente })
    log('preparação de Haki')
  }

  /** Haki escolhido pelos dois (ou o tempo acabou): a batalha começa */
  const iniciar = () => {
    if (!estado) return
    const haki = jogadores.flatMap((j) => (j.haki ?? []).filter((h) => estado!.combatentes.find((c) => c.id === h.id)?.lado === j.lado))
    for (const h of haki) {
      if (h.armamento) estado = hakiPreparacao(estado, h.id, 'armamento', true)
      if (h.observacao) estado = hakiPreparacao(estado, h.id, 'observacao', true)
    }
    fase = 'batalha'
    inicioVez = Date.now()
    todos({ t: 'iniciar', haki })
    log('batalha começou')
  }

  const aceitar = (acao: Parameters<typeof aplicar>[1]) => {
    if (!estado) return 'Sem batalha.'
    const r = aplicar(estado, acao)
    if ('erro' in r) return r.erro
    const vezAntes = estado.vez
    estado = r.estado
    if (estado.vez !== vezAntes) inicioVez = Date.now()
    todos({ t: 'acao', n: n++, acao })
    if (estado.vencedor) {
      log(`fim: venceu ${estado.vencedor}`)
      fase = 'sala'
    }
    return null
  }

  const tique = () => {
    if (fase === 'preparar') {
      if (Date.now() >= fimPreparo) comecar()
      else sala()
    } else if (fase === 'haki') {
      if (Date.now() >= fimPreparo) iniciar()
    } else if (fase === 'batalha' && estado && !estado.vencedor) {
      // o cliente da vez manda o 'tempo' quando o relógio dele zera; isto é só a garantia
      if (Date.now() - inicioVez > (tempoDaVez(estado) + FOLGA_VEZ_MP) * 1000) aceitar({ t: 'tempo' })
    }
  }

  wss.on('connection', (ws) => {
    let eu: Jogador | null = null
    ws.on('message', (bruto) => {
      let m: MsgClienteBatalha
      try {
        m = JSON.parse(String(bruto)) as MsgClienteBatalha
      } catch {
        return
      }
      if (m.t === 'entrar') {
        if (eu) return
        if (jogadores.length >= 2) {
          enviar(ws, { t: 'cheio' })
          ws.close()
          return
        }
        const lado: Lado = jogadores.some((j) => j.lado === 'piratas') ? 'marinha' : 'piratas'
        const nome = String(m.nome ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || 'Pirata'
        eu = { ws, nome, lado, pronto: false, config: null, haki: null }
        jogadores.push(eu)
        enviar(ws, { t: 'bemvindo', lado, nomes })
        log(`${nome} entrou (${lado})`)
        if (jogadores.length === 2 && fase === 'sala') {
          fase = 'preparar'
          fimPreparo = Date.now() + PREPARO_MP * 1000
          timer ??= setInterval(tique, 1000)
          log('preparação começou')
        }
        sala()
        return
      }
      if (!eu) return
      switch (m.t) {
        case 'config':
          if (fase === 'preparar') eu.config = (m.config ?? []).filter((k) => k.id.startsWith(eu!.lado === 'piratas' ? 'pirata' : 'marinha'))
          break
        case 'pronto':
          if (fase !== 'preparar') break
          eu.pronto = !!m.pronto
          if (jogadores.length === 2 && jogadores.every((j) => j.pronto)) comecar()
          else sala()
          break
        case 'haki':
          if (fase !== 'haki') break
          eu.haki = m.haki ?? []
          if (jogadores.every((j) => j.haki)) iniciar()
          break
        case 'acao': {
          if (fase !== 'batalha' || !estado) {
            enviar(ws, { t: 'erro', texto: 'A batalha ainda não começou.' })
            break
          }
          if (estado.vez !== eu.lado) {
            enviar(ws, { t: 'erro', texto: 'Não é a sua vez.' })
            break
          }
          let erro: string | null
          try {
            erro = aceitar(m.acao)
          } catch (e) {
            log(`erro ao aplicar: ${(e as Error).stack}`)
            erro = 'Erro no servidor.'
          }
          if (erro) enviar(ws, { t: 'erro', texto: erro })
          break
        }
      }
    })
    ws.on('close', () => {
      if (!eu) return
      jogadores = jogadores.filter((j) => j !== eu)
      todos({ t: 'saiu', nome: eu.nome })
      log(`${eu.nome} saiu`)
      // a partida não continua com um só: quem ficar volta para a sala
      reiniciar()
      if (!jogadores.length && timer) {
        clearInterval(timer)
        timer = null
      }
      sala()
    })
  })
}
