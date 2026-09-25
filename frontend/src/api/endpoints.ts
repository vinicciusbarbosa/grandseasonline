import { api } from './client'
import type {
  Inventario,
  EquipamentosDoPersonagem,
  SlotEquipamento,
  Atributo,
  CriarTripulacaoRequest,
  PersonagemStatus,
  Sessao,
  TripulacaoResumo,
} from './tipos'

export const authApi = {
  sessao: () => api.get<Sessao>('/sessao'),

  login: (email: string, senha: string) => api.post<Sessao>('/auth/login', { email, senha }),

  cadastrar: (nome: string, email: string, senha: string, padrinho?: string) =>
    api.post<Sessao>('/auth/cadastro', { nome, email, senha, padrinho: padrinho || null }),

  logout: () => api.post<void>('/auth/logout'),
}

export const tripulacoesApi = {
  listar: () => api.get<TripulacaoResumo[]>('/tripulacoes'),

  criar: (dados: CriarTripulacaoRequest) => api.post<Sessao>('/tripulacoes', dados),

  selecionar: (id: number) => api.post<Sessao>(`/tripulacoes/${id}/selecionar`),
}

export const personagensApi = {
  listar: () => api.get<PersonagemStatus[]>('/personagens'),

  obter: (cod: number) => api.get<PersonagemStatus>(`/personagens/${cod}`),

  distribuirPontos: (cod: number, atributo: Atributo, quantidade: number) =>
    api.post<PersonagemStatus>(`/personagens/${cod}/atributos`, { atributo, quantidade }),

  evoluir: (cod: number) => api.post<PersonagemStatus>(`/personagens/${cod}/evoluir`),
}

export const inventarioApi = {
  obter: () => api.get<Inventario>('/inventario'),

  descartar: (itemId: number, quantidade: number) =>
    api.post<Inventario>(`/inventario/${itemId}/descartar`, { quantidade }),
}

export const equipamentosApi = {
  obter: (personagemCod: number) =>
    api.get<EquipamentosDoPersonagem>(`/personagens/${personagemCod}/equipamentos`),

  equipar: (personagemCod: number, codEquipamento: number, slotDestino?: SlotEquipamento) =>
    api.post<EquipamentosDoPersonagem>(`/personagens/${personagemCod}/equipamentos`, {
      codEquipamento,
      slotDestino: slotDestino ?? null,
    }),

  desequipar: (personagemCod: number, slot: SlotEquipamento) =>
    api.del<EquipamentosDoPersonagem>(`/personagens/${personagemCod}/equipamentos/${slot}`),
}
