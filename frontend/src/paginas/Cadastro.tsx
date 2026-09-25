import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/endpoints'
import { ErroApi } from '../api/client'
import { useSessao } from '../auth/SessaoContext'
import { Painel } from '../componentes/ui/ornamentos'
import { Aviso, Botao, Campo } from '../componentes/ui/controles'
import { PortaoShell } from './PortaoShell'

export function Cadastro() {
  const { definirSessao } = useSessao()
  const navegar = useNavigate()

  // O código de indicação chega pela URL do link que o padrinho compartilha.
  const [parametros] = useSearchParams()
  const padrinho = parametros.get('padrinho') ?? ''

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  const cadastrar = useMutation({
    mutationFn: () => authApi.cadastrar(nome, email, senha, padrinho),
    onSuccess: (sessao) => {
      definirSessao(sessao)
      navegar('/tripulacoes', { replace: true })
    },
  })

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    cadastrar.mutate()
  }

  return (
    <PortaoShell
      titulo="Nova Jornada"
      subtitulo="Sua história começa aqui"
      rodape={
        <>
          Já navega conosco?{' '}
          <Link to="/login" className="text-ouro-claro underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <Painel>
        <form onSubmit={aoEnviar} className="flex flex-col gap-5">
          <Campo
            rotulo="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            dica="Pelo menos 5 caracteres."
            autoComplete="name"
            required
          />
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
            dica="Pelo menos 5 caracteres."
            autoComplete="new-password"
            required
          />

          {padrinho && <Aviso tom="info">Indicação registrada — seu padrinho será creditado.</Aviso>}

          {cadastrar.error instanceof ErroApi && <Aviso>{cadastrar.error.message}</Aviso>}

          <Botao type="submit" carregando={cadastrar.isPending} className="mt-1 w-full">
            Criar conta
          </Botao>
        </form>
      </Painel>
    </PortaoShell>
  )
}
