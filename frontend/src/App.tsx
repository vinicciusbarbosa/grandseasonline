import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProvedorSessao } from './auth/SessaoContext'
import { RotaProtegida } from './componentes/RotaProtegida'
import { LayoutJogo } from './layout/LayoutJogo'
import { Login } from './paginas/Login'
import { Cadastro } from './paginas/Cadastro'
import { SelecionarTripulacao } from './paginas/SelecionarTripulacao'
import { Status } from './paginas/Status'
import { Inventario } from './paginas/Inventario'
import { ErroApi } from './api/client'
import { Carregando } from './componentes/ui/controles'

// O Phaser pesa ~1 MB: só baixa quem abrir a navegação.
const TelaNavegacao = lazy(() => import('./navegacao/TelaNavegacao'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401 e erros de validação não melhoram com repetição.
      retry: (falhas, erro) =>
        !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && falhas < 2,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* A carta náutica do jogo, fixa atrás de tudo. */}
      <div className="fundo-carta" aria-hidden="true" />

      <BrowserRouter>
        <ProvedorSessao>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            {/* Protótipo da navegação: roda sem API nem login, para testar direto. */}
            <Route
              path="/navegacao"
              element={
                <Suspense fallback={<Carregando texto="Içando as velas…" />}>
                  <TelaNavegacao />
                </Suspense>
              }
            />

            <Route element={<RotaProtegida />}>
              <Route element={<LayoutJogo />}>
                <Route path="/tripulacoes" element={<SelecionarTripulacao />} />

                <Route element={<RotaProtegida exigeTripulacao />}>
                  <Route path="/status" element={<Status />} />
                  <Route path="/inventario" element={<Inventario />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/status" replace />} />
          </Routes>
        </ProvedorSessao>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
