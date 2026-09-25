/**
 * Espelho dos DTOs da API (backend/src/SugoiGame.Application).
 * Enums viajam como texto porque a API serializa com JsonStringEnumConverter.
 */

export type Faccao = 'Marinha' | 'Pirata'

export type Atributo = 'Atk' | 'Def' | 'Agl' | 'Res' | 'Pre' | 'Dex' | 'Con' | 'Vit'

export interface Conta {
  id: number
  nome: string
  email: string
  /** Código de indicação da conta, usado no cadastro de novos jogadores. */
  idEncriptado: string
  gold: number
  dobroes: number
  medalhasRecrutamento: number
  ativada: boolean
}

export interface CapitaoResumo {
  cod: number
  nome: string
  img: number
  lvl: number
  xp: number
  xpMax: number
  hp: number
  hpMax: number
  famaAmeaca: number
}

export interface TripulacaoResumo {
  id: number
  nome: string
  faccao: Faccao
  berries: number
  reputacao: number
  x: number
  y: number
  capitao: CapitaoResumo | null
}

export interface Sessao {
  conta: Conta
  tripulacaoAtiva: TripulacaoResumo | null
  tripulacoes: TripulacaoResumo[]
}

export interface AtributoFicha {
  atributo: Atributo
  sigla: string
  nome: string
  descricao: string
  valor: number
  /** Somatório de equipamentos, acessório e Haki. Fracionário. */
  bonus: number
}

export interface Haki {
  lvl: number
  xp: number
  xpMax: number
  pontosDisponiveis: number
  esquiva: number
  bloqueio: number
  critico: number
  hdr: number
}

export interface Profissao {
  codigo: number
  lvl: number
  xp: number
  xpMax: number
}

export interface PersonagemStatus {
  cod: number
  nome: string
  img: number
  skinCorpo: number
  skinRosto: number
  sexo: number
  lvl: number
  xp: number
  xpMax: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  famaAmeaca: number
  tituloCod: number | null
  classe: number
  akumaCod: number | null
  ativo: boolean
  ehCapitao: boolean
  podeEvoluir: boolean
  pontosDisponiveis: number
  atributos: AtributoFicha[]
  haki: Haki
  profissao: Profissao
}

export interface CriarTripulacaoRequest {
  nomeTripulacao: string
  nomeCapitao: string
  faccao: Faccao
  iconeCapitao: number
  oceano: number
}

// ── Inventário e equipamentos ────────────────────────────────────────────────

export type TipoItem =
  | 'Acessorio'
  | 'Comida'
  | 'Mapa'
  | 'Casco'
  | 'Leme'
  | 'Velas'
  | 'Pose'
  | 'Remedio'
  | 'Canhao'
  | 'BalaDeCanhao'
  | 'Equipamento'
  | 'Reagente'
  | 'IscaNormal'
  | 'IscaDourada'
  | 'Missao'
  | 'Akuma'

export type SlotEquipamento =
  | 'Cabeca'
  | 'Colete'
  | 'Calcas'
  | 'Botas'
  | 'Luvas'
  | 'Capa'
  | 'PrimeiraMao'
  | 'SegundaMao'
  | 'UmaMao'
  | 'DuasMaos'

export interface BonusEquipamento {
  atributo: Atributo
  sigla: string
  nome: string
  valor: number
}

export interface Equipamento {
  cod: number
  itemBase: number
  categoria: number
  lvl: number
  upgrade: number
  slot: SlotEquipamento
  slotNome: string
  requisito: number
  categoriaDano: number
  bonusPrimario: BonusEquipamento | null
  bonusSecundario: BonusEquipamento | null
}

export interface ItemInventario {
  id: number
  tipo: TipoItem
  codItem: number
  quantidade: number
  novo: boolean
  nome: string
  descricao: string
  img: number
  imgFormato: string
  equipamento: Equipamento | null
}

export interface Inventario {
  itens: ItemInventario[]
  ocupado: number
  capacidade: number
  temNavio: boolean
}

export interface SlotEquipado {
  slot: SlotEquipamento
  slotNome: string
  nome: string | null
  descricao: string | null
  img: number
  equipamento: Equipamento | null
  /** A segunda mão apenas reflete a arma de duas mãos segurada pela primeira. */
  espelhaArmaDeDuasMaos: boolean
}

export interface EquipamentosDoPersonagem {
  personagemCod: number
  slots: SlotEquipado[]
}
