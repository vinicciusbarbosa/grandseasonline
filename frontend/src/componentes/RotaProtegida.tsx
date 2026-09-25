import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSessao } from '../auth/SessaoContext'
import { Carregando } from './ui/controles'

/**
 * Guarda de rota.
 *
 * @param exigeTripulacao
 * Quando verdadeiro, além de estar logado o jogador precisa ter uma tripulação
 * ativa — é o mesmo que o PHP fazia em Protector::need_tripulacao(), mandando
 * quem não tem para a tela de seleção.
 */
export function RotaProtegida({ exigeTripulacao = false }: { exigeTripulacao?: boolean }) {
  const { sessao, carregando } = useSessao()
  const local = useLocation()

  if (carregando) {
    return <Carregando texto="Verificando sessão" />
  }

  if (!sessao) {
    return <Navigate to="/login" state={{ de: local.pathname }} replace />
  }

  if (exigeTripulacao && !sessao.tripulacaoAtiva) {
    return <Navigate to="/tripulacoes" replace />
  }

  return <Outlet />
}
