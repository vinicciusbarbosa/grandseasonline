import { createContext, use, useCallback, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ErroApi } from '../api/client'
import { authApi } from '../api/endpoints'
import type { Sessao } from '../api/tipos'

interface ValorSessao {
  sessao: Sessao | null
  carregando: boolean
  /** Substitui a sessão em cache — usar após login, cadastro ou troca de tripulação. */
  definirSessao: (sessao: Sessao) => void
  sair: () => Promise<void>
}

const SessaoContext = createContext<ValorSessao | null>(null)

export const chaveSessao = ['sessao'] as const

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: chaveSessao,
    queryFn: authApi.sessao,

    // Sem cookie válido a API responde 401: isso significa "visitante", não erro.
    retry: (falhas, erro) => !(erro instanceof ErroApi && erro.naoAutenticado) && falhas < 2,
    staleTime: 30_000,
  })

  const definirSessao = useCallback(
    (sessao: Sessao) => queryClient.setQueryData(chaveSessao, sessao),
    [queryClient],
  )

  const sair = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      // Mesmo se o logout falhar no servidor, o cliente não deve seguir achando
      // que está logado.
      queryClient.setQueryData(chaveSessao, null)
      await queryClient.invalidateQueries()
    }
  }, [queryClient])

  const valor = useMemo<ValorSessao>(
    () => ({ sessao: data ?? null, carregando: isPending, definirSessao, sair }),
    [data, isPending, definirSessao, sair],
  )

  return <SessaoContext value={valor}>{children}</SessaoContext>
}

export function useSessao() {
  const valor = use(SessaoContext)

  if (!valor) {
    throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.')
  }

  return valor
}
