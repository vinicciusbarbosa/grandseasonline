/**
 * Cliente HTTP da API do Sugoi Game.
 *
 * A sessão vive em cookies HttpOnly (sg_c/sg_k), os mesmos que o jogo em PHP usa,
 * então toda chamada precisa de `credentials: 'include'` e não há token para o
 * JavaScript guardar.
 */

/** Falha devolvida pela API, já com o código estável do ProblemDetails. */
export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
  }

  /** A sessão não existe ou expirou. */
  get naoAutenticado() {
    return this.status === 401
  }

  /** Autenticado, mas ainda sem tripulação selecionada. */
  get semTripulacao() {
    return this.codigo === 'sem_tripulacao_ativa'
  }
}

interface ProblemDetails {
  title?: string
  detail?: string
  codigo?: string
}

async function extrairErro(resposta: Response): Promise<ErroApi> {
  let corpo: ProblemDetails = {}

  try {
    corpo = (await resposta.json()) as ProblemDetails
  } catch {
    // Resposta sem corpo JSON (502 de proxy, API fora do ar): cai na mensagem padrão.
  }

  const mensagem =
    corpo.detail ??
    corpo.title ??
    (resposta.status === 0 ? 'Não foi possível falar com o servidor.' : `Erro ${resposta.status}.`)

  return new ErroApi(resposta.status, corpo.codigo ?? 'erro_desconhecido', mensagem)
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response

  try {
    resposta = await fetch(`/api${caminho}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new ErroApi(0, 'sem_conexao', 'Não foi possível falar com o servidor. Ele está no ar?')
  }

  if (!resposta.ok) {
    throw await extrairErro(resposta)
  }

  if (resposta.status === 204) {
    return undefined as T
  }

  return (await resposta.json()) as T
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>(caminho),

  post: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, {
      method: 'POST',
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }),

  del: <T>(caminho: string) => requisitar<T>(caminho, { method: 'DELETE' }),
}
