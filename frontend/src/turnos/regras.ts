/**
 * Combate por turnos estilo Honkai: Star Rail (protótipo).
 *
 * - Fila por velocidade: cada unidade tem um "valor de ação" (VA) que começa
 *   em 10000/vel; age quem tem o menor VA, o tempo anda para todos, e quem
 *   agiu volta para 10000/vel.
 * - Pontos de habilidade (PH) do time: o ataque básico dá 1, a habilidade
 *   gasta 1 (máx. 5).
 * - Energia: básico +20, habilidade +30, apanhar +10, derrubar +10. Cheia,
 *   o ultimate pode ser usado A QUALQUER MOMENTO, furando a fila.
 * - Escudo e fraquezas: o escudo do inimigo só cai com golpes do tipo a que
 *   ele é fraco. Quebrado, leva dano extra, perde 25% de avanço na fila e
 *   recebe mais dano até a vez dele.
 *
 * Módulo puro: nada de cena nem de React.
 */

export type Tipo = 'corte' | 'impacto' | 'fogo' | 'tiro' | 'haki'
export type Lado = 'tripulacao' | 'inimigos'
export type Alcance = 'um' | 'leque' | 'todos' | 'aliado'
export type Golpe = { nome: string; mult: number; alcance: Alcance; escudo: number; efeito?: string; cura?: number; atraso?: number; descricao: string }

export type Unidade = {
  id: string
  nome: string
  /** pasta em public/sprites */
  sprite: string
  lado: Lado
  hp: number
  hpMax: number
  atk: number
  def: number
  vel: number
  tipo: Tipo
  energia: number
  energiaMax: number
  escudo: number
  escudoMax: number
  fraquezas: Tipo[]
  quebrado: boolean
  va: number
  chefe?: boolean
  kit?: { basico: Golpe; habilidade: Golpe; ultimate: Golpe }
}

export type Estado = { unidades: Unidade[]; ph: number; phMax: number; rodada: number; vencedor: Lado | null }

export type Acerto = { alvo: string; dano: number; cura: number; quebrou: boolean; caiu: boolean; fraco: boolean }
export type Resultado = { ator: string; golpe: Golpe; tipoGolpe: 'basico' | 'habilidade' | 'ultimate' | 'inimigo'; acertos: Acerto[] }

export const NOMES_TIPO: Record<Tipo, string> = { corte: 'Corte', impacto: 'Impacto', fogo: 'Fogo', tiro: 'Tiro', haki: 'Haki' }

const g = (nome: string, mult: number, alcance: Alcance, escudo: number, descricao: string, extra: Partial<Golpe> = {}): Golpe => ({ nome, mult, alcance, escudo, descricao, ...extra })

function aliado(id: string, nome: string, hp: number, atk: number, def: number, vel: number, tipo: Tipo, energiaMax: number, kit: Unidade['kit']): Unidade {
  return { id, nome, sprite: id, lado: 'tripulacao', hp, hpMax: hp, atk, def, vel, tipo, energia: energiaMax * 0.5, energiaMax, escudo: 0, escudoMax: 0, fraquezas: [], quebrado: false, va: 0, kit }
}
function inimigo(id: string, nome: string, hp: number, atk: number, def: number, vel: number, tipo: Tipo, escudo: number, fraquezas: Tipo[], chefe = false): Unidade {
  return { id, nome, sprite: id, lado: 'inimigos', hp, hpMax: hp, atk, def, vel, tipo, energia: 0, energiaMax: 0, escudo, escudoMax: escudo, fraquezas, quebrado: false, va: 0, chefe }
}

export function criarBatalha(): Estado {
  const unidades = [
    aliado('pirata-capitao', 'Capitão', 1150, 95, 60, 101, 'haki', 120, {
      basico: g('Golpe de Espada', 1, 'um', 10, 'Um corte com Haki no alvo.'),
      habilidade: g('Haki do Rei', 1.1, 'leque', 20, 'Pressão do Rei no alvo e nos vizinhos (metade do dano).'),
      ultimate: g('Rei Imbuído', 1.9, 'todos', 30, 'Golpe imbuído com o Rei em todos os inimigos; atrasa a fila deles.', { atraso: 0.15 }),
    }),
    aliado('pirata-espadachim', 'Espadachim', 950, 120, 45, 110, 'corte', 110, {
      basico: g('Corte Rápido', 1, 'um', 10, 'Um corte no alvo.'),
      habilidade: g('Corte Duplo', 2.2, 'um', 20, 'Dois cortes fortes no alvo.'),
      ultimate: g('Três Espadas', 4, 'um', 30, 'Ataque devastador num único alvo.'),
    }),
    aliado('pirata-lutador', 'Lutador', 1300, 105, 70, 96, 'fogo', 130, {
      basico: g('Soco', 1, 'um', 10, 'Um soco no alvo.'),
      habilidade: g('Hiken', 1.3, 'leque', 20, 'Punho de fogo no alvo e nos vizinhos (metade do dano).', { efeito: 'hiken-perto' }),
      ultimate: g('Entei', 2.1, 'todos', 30, 'O sol de fogo: cresce, é arremessado e explode em todos.', { efeito: 'entei' }),
    }),
    aliado('pirata-atiradora', 'Atiradora', 900, 100, 40, 105, 'tiro', 100, {
      basico: g('Disparo', 1, 'um', 10, 'Um tiro no alvo.'),
      habilidade: g('Rajada', 0.75, 'todos', 10, 'Tiros em todos os inimigos.'),
      ultimate: g('Tiro Certeiro', 3.2, 'um', 30, 'Um tiro perfurante num único alvo.'),
    }),
    inimigo('marinha-oficial', 'Oficial', 1500, 70, 50, 100, 'corte', 30, ['impacto', 'tiro']),
    inimigo('marinha-soldado', 'Soldado', 1700, 65, 60, 88, 'impacto', 30, ['corte', 'fogo']),
    inimigo('marinha-almirante', 'Comandante', 4200, 90, 70, 92, 'haki', 90, ['fogo', 'haki'], true),
    inimigo('marinha-atirador', 'Atirador', 1300, 75, 40, 98, 'tiro', 30, ['corte', 'impacto']),
    inimigo('marinha-enfermeira', 'Enfermeira', 1200, 55, 40, 94, 'impacto', 30, ['tiro', 'haki']),
  ]
  for (const u of unidades) u.va = 10000 / u.vel
  return { unidades, ph: 3, phMax: 5, rodada: 1, vencedor: null }
}

export const vivos = (e: Estado, lado: Lado) => e.unidades.filter((u) => u.lado === lado && u.hp > 0)
export const porId = (e: Estado, id: string) => e.unidades.find((u) => u.id === id)!

/** Quem age agora (sem andar o tempo). */
export function atual(e: Estado) {
  return e.unidades.filter((u) => u.hp > 0).reduce((a, b) => (b.va < a.va ? b : a))
}

/** Anda o tempo até o próximo da fila e devolve quem age. */
export function proximo(e: Estado) {
  const u = atual(e)
  const passo = u.va
  for (const x of e.unidades) if (x.hp > 0) x.va -= passo
  // inimigo quebrado se recupera no começo da vez dele
  if (u.lado === 'inimigos' && u.quebrado) {
    u.quebrado = false
    u.escudo = u.escudoMax
  }
  return u
}

/** Prévia da fila: os próximos `n` a agir (simulado, sem mexer no estado). */
export function fila(e: Estado, n: number) {
  const va = new Map(e.unidades.filter((u) => u.hp > 0).map((u) => [u.id, u.va]))
  const out: string[] = []
  while (out.length < n && va.size) {
    let id = ''
    let min = Infinity
    for (const [k, v] of va) if (v < min) (min = v), (id = k)
    out.push(id)
    for (const [k, v] of va) va.set(k, v - min)
    va.set(id, 10000 / porId(e, id).vel)
  }
  return out
}

/** Os vizinhos (na linha dos vivos) do alvo, para o golpe em leque. */
export function vizinhos(e: Estado, alvo: string) {
  const linha = vivos(e, porId(e, alvo).lado)
  const i = linha.findIndex((u) => u.id === alvo)
  return [linha[i - 1], linha[i + 1]].filter(Boolean).map((u) => u!.id)
}

function rolar() {
  return 0.95 + Math.random() * 0.1
}

function bater(ator: Unidade, alvo: Unidade, golpe: Golpe, fator: number): Acerto {
  const fraco = alvo.fraquezas.includes(ator.tipo)
  let quebrou = false
  if (fraco && alvo.escudoMax > 0 && !alvo.quebrado) {
    alvo.escudo = Math.max(0, alvo.escudo - golpe.escudo * fator)
    if (alvo.escudo === 0) {
      quebrou = true
      alvo.quebrado = true
      alvo.va += (10000 / alvo.vel) * 0.25
    }
  }
  const reducao = 100 / (100 + alvo.def)
  const bonus = alvo.quebrado ? 1.2 : 1
  let dano = Math.round(ator.atk * golpe.mult * fator * 10 * reducao * bonus * rolar())
  if (quebrou) dano += Math.round(ator.atk * 4 * reducao)
  alvo.hp = Math.max(0, alvo.hp - dano)
  if (alvo.lado === 'tripulacao') alvo.energia = Math.min(alvo.energiaMax, alvo.energia + 10)
  const caiu = alvo.hp === 0
  if (caiu && ator.lado === 'tripulacao') ator.energia = Math.min(ator.energiaMax, ator.energia + 10)
  if (golpe.atraso && !caiu) alvo.va += (10000 / alvo.vel) * golpe.atraso
  return { alvo: alvo.id, dano, cura: 0, quebrou, caiu, fraco }
}

/** Ação de um tripulante. `alvo` é um inimigo (ou um aliado, para cura). */
export function agir(e: Estado, atorId: string, tipoGolpe: 'basico' | 'habilidade' | 'ultimate', alvoId: string): Resultado {
  const ator = porId(e, atorId)
  const golpe = ator.kit![tipoGolpe]
  const acertos: Acerto[] = []
  const alvos: [string, number][] =
    golpe.alcance === 'todos'
      ? vivos(e, 'inimigos').map((u) => [u.id, 1])
      : golpe.alcance === 'leque'
        ? [[alvoId, 1], ...vizinhos(e, alvoId).map((v) => [v, 0.5] as [string, number])]
        : [[alvoId, 1]]
  for (const [id, f] of alvos) acertos.push(bater(ator, porId(e, id), golpe, f))
  if (tipoGolpe === 'basico') {
    e.ph = Math.min(e.phMax, e.ph + 1)
    ator.energia = Math.min(ator.energiaMax, ator.energia + 20)
  } else if (tipoGolpe === 'habilidade') {
    e.ph -= 1
    ator.energia = Math.min(ator.energiaMax, ator.energia + 30)
  } else ator.energia = 5
  // ultimate não mexe na fila; básico e habilidade gastam a vez
  if (tipoGolpe !== 'ultimate') ator.va = 10000 / ator.vel
  conferir(e)
  return { ator: atorId, golpe, tipoGolpe, acertos }
}

/** Vez de um inimigo: o chefe solta um golpe em todos a cada 3 rodadas. */
export function agirInimigo(e: Estado, atorId: string): Resultado {
  const ator = porId(e, atorId)
  const alvosVivos = vivos(e, 'tripulacao')
  const emArea = ator.chefe && e.rodada % 3 === 0
  const golpe = emArea ? g('Punho de Fumaça', 0.7, 'todos', 0, '') : g('Ataque', 1, 'um', 0, '')
  const alvos = emArea ? alvosVivos : [alvosVivos[Math.floor(Math.random() * alvosVivos.length)]]
  const acertos = alvos.map((a) => bater(ator, a, golpe, 1))
  ator.va = 10000 / ator.vel
  if (ator.chefe) e.rodada++
  conferir(e)
  return { ator: atorId, golpe, tipoGolpe: 'inimigo', acertos }
}

function conferir(e: Estado) {
  if (!vivos(e, 'inimigos').length) e.vencedor = 'tripulacao'
  else if (!vivos(e, 'tripulacao').length) e.vencedor = 'inimigos'
}
