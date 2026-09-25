import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/endpoints'
import { ErroApi } from '../api/client'
import { useSessao } from '../auth/SessaoContext'
import { Painel } from '../componentes/ui/ornamentos'
import { Aviso, Botao, Campo, Carregando } from '../componentes/ui/controles'
import { PortaoShell } from './PortaoShell'

export function Login() {
  const { sessao, carregando, definirSessao } = useSessao()
  const navegar = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  const entrar = useMutation({
    mutationFn: () => authApi.login(email, senha),
    onSuccess: (novaSessao) => {
      definirSessao(novaSessao)
      navegar(novaSessao.tripulacaoAtiva ? '/status' : '/tripulacoes', { replace: true })
    },
  })

  if (carregando) {
    return <Carregando texto="Verificando sessão" />
  }

  if (sessao) {
    return <Navigate to={sessao.tripulacaoAtiva ? '/status' : '/tripulacoes'} replace />
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    entrar.mutate()
  }

  return (
    <PortaoShell
      titulo="Sugoi Game"
      subtitulo="Pirata ou Marinheiro"
      rodape={
        <>
          Ainda sem tripulação?{' '}
          <Link to="/cadastro" className="text-ouro-claro underline-offset-4 hover:underline">
            Crie sua conta
          </Link>
        </>
      }
    >
      <Painel>
        <form onSubmit={aoEnviar} className="flex flex-col gap-5">
          <Campo
            rotulo="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Campo
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />

          {entrar.error instanceof ErroApi && <Aviso>{entrar.error.message}</Aviso>}

          <Botao type="submit" carregando={entrar.isPending} className="mt-1 w-full">
            Zarpar
          </Botao>
        </form>
      </Painel>
    </PortaoShell>
  )
}
