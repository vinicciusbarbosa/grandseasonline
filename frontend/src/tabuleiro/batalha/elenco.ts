/**
 * As duas tripulações do protótipo de teste: classe, Haki, Akuma no Mi e
 * posição inicial. O `id` é também a pasta dos sprites (public/sprites/<id>/);
 * os nomes são sorteados a cada partida.
 *
 * Cada lado tem as quatro classes: piratas com dois espadachins, lutador,
 * atiradora e tank (é o médico); Marinha com dois espadachins (um é o
 * médico), lutador, tank e atirador.
 * Haki: o espadachim que comanda cada lado tem o Rei + armamento nível 3
 * (o Rei imbuído vai em todo golpe com o armamento ligado); lutador pirata: armamento avançado; o lutador
 * oficial da Marinha: armamento avançado + observação AVANÇADA (esquiva e
 * revida); atiradores: Rei (só em área); tank pirata (médico): armamento + observação. Akuma no Mi (só Logias): fumaça
 * (comandante da Marinha), fogo (lutador pirata), gelo (soldado). O médico da Marinha não tem Haki.
 * Tank: porrete de espinhos (as skills de maça), muita vida e defesa.
 */

import type { Direcao } from '../cena/personagem'
import type { TipoArma } from './armas'
import { FRUTAS } from './armas'
import type { Atributos, Combatente, Haki, Lado } from './regras'

/**
 * Classe = tipo de arma: espadachim (sabre/espada), lutador (artes
 * marciais: punhos e pernas), tank (porrete/maça), atirador (rifle e pistolas). Médico, cartógrafo
 * etc. são profissões, à parte da classe.
 */
export type Classe = 'espadachim' | 'lutador' | 'tank' | 'atirador'

/**
 * Atributos BASE de cada classe (antes da build). Cada tripulante ainda
 * distribui PONTOS_BUILD pontos por cima (a build padrão de cada classe
 * deixa os números do teste de antes). O AKM não é da classe: todo mundo
 * começa com AKM_BASE e o resto vem dos pontos (depois, da raridade da fruta).
 */
const CLASSES: Record<Classe, { hp: number; at: Omit<Atributos, 'akm'>; arma: TipoArma }> = {
  espadachim: { hp: 135, at: { atk: 20, def: 10, agl: 8, res: 10, pre: 14, dex: 8, con: 10 }, arma: 'espada' },
  lutador: { hp: 140, at: { atk: 19, def: 12, agl: 6, res: 14, pre: 10, dex: 10, con: 16 }, arma: 'punhos' },
  tank: { hp: 180, at: { atk: 21, def: 20, agl: 5, res: 14, pre: 6, dex: 5, con: 22 }, arma: 'maca' },
  atirador: { hp: 100, at: { atk: 16, def: 6, agl: 10, res: 6, pre: 12, dex: 10, con: 6 }, arma: 'espingarda' },
}

// ------------------------------------------------------------ build (pontos)
/** Poder da Akuma no Mi de todo mundo antes da build */
export const AKM_BASE = 12
/** pontos que cada tripulante distribui na preparação */
export const PONTOS_BUILD = 20
/** no máximo isto num atributo só */
export const MAX_POR_ATRIBUTO = 15
/** cada ponto em VIG dá esta vida */
export const VIDA_POR_VIG = 5
export type AtributoBuild = keyof Atributos | 'vig'
export type Build = Partial<Record<AtributoBuild, number>>
/** ordem e nome na tela de build */
export const ATRIBUTOS_BUILD: [AtributoBuild, string, string][] = [
  ['atk', 'ATK', 'Ataque: o dano das skills da ARMA (cortes, socos, tiros, porretadas). Dano = ATK × 1,4 × multiplicador da skill, menos a DEF do alvo. Não muda o dano das skills da Akuma no Mi.'],
  ['akm', 'AKM', 'Poder da Akuma no Mi: o dano das skills da FRUTA (Hiken, Lanças de Gelo, Raio de Luz...), na mesma conta do ATK. Sem fruta, não serve para nada.'],
  ['def', 'DEF', 'Defesa: cada ponto tira 1% do dano recebido (no máximo 60%). O Haki de armamento do atacante fura parte dela (15% no normal, 35% no avançado) e algumas skills ignoram uma parte (Esmagar, Estocada Perfurante).'],
  ['vig', 'VIG', `Vigor: +${VIDA_POR_VIG} de vida máxima por ponto. Com a vida em 0, o personagem cai.`],
  ['agl', 'AGL', 'Agilidade: chance de esquivar = (sua AGL − PRE do atacante) × 2 + 5%, até 45%. Também ajuda a observação a prever o golpe, e a tripulação com a maior AGL média começa a batalha.'],
  ['pre', 'PRE', 'Precisão: cada ponto acima da AGL do alvo tira 2% da chance de ele esquivar (e atrapalha a observação dele).'],
  ['dex', 'DEX', 'Destreza: chance de crítico = (sua DEX − CON do alvo) × 2 + 5%, até 75%. O crítico dá ×1,5 de dano.'],
  ['res', 'RES', 'Resistência: chance de bloquear = (sua RES − CON do atacante) × 2%, até 40%. O bloqueio corta o dano pela metade (não funciona contra o armamento avançado).'],
  ['con', 'CON', 'Constituição: diminui a chance de levar crítico (contra a DEX do atacante) e a chance de o seu golpe ser bloqueado (contra a RES do alvo).'],
]
const ehAtributo = (x: string): x is AtributoBuild => ATRIBUTOS_BUILD.some(([k]) => k === x)

/**
 * Build padrão de cada classe. Com fruta, 12 pontos vão para o AKM e o
 * resto segue a ordem da classe.
 */
export function buildPadrao(classe: Classe, fruta: boolean): Build {
  const b: Build = {
    espadachim: { atk: 8, agl: 6, dex: 6 },
    lutador: { atk: 6, def: 4, vig: 4, agl: 6 },
    tank: { def: 6, vig: 8, res: 6 },
    atirador: { pre: 6, atk: 6, agl: 4, dex: 4 },
  }[classe]
  if (!fruta) return { ...b }
  const out: Build = { akm: 12 }
  let resta = PONTOS_BUILD - 12
  for (const [k, v] of Object.entries(b) as [AtributoBuild, number][]) {
    const n = Math.min(v, resta)
    if (n) out[k] = n
    resta -= n
  }
  return out
}

/** pontos gastos (só os válidos) */
export const pontosGastos = (b: Build | undefined) => Object.values(b ?? {}).reduce<number>((t, v) => t + (v ?? 0), 0)

/** build que respeita as regras (o multiplayer recebe a do jogador): senão, nada */
export function buildValida(b: unknown): Build {
  if (!b || typeof b !== 'object') return {}
  const out: Build = {}
  for (const [k, v] of Object.entries(b)) {
    if (!ehAtributo(k) || !Number.isInteger(v) || (v as number) < 0 || (v as number) > MAX_POR_ATRIBUTO) return {}
    if (v) out[k] = v as number
  }
  return pontosGastos(out) <= PONTOS_BUILD ? out : {}
}

/** atributos e vida finais: base da classe + build */
export function comBuild(classe: Classe, b: Build) {
  const base = CLASSES[classe]
  const at: Atributos = { ...base.at, akm: AKM_BASE }
  for (const [k, v] of Object.entries(b)) if (k !== 'vig' && v) at[k as keyof Atributos] += v
  return { at, hp: base.hp + (b.vig ?? 0) * VIDA_POR_VIG }
}

/** vida e arma de cada classe (para a cena e a preparação) */
export const CLASSES_HUD: Record<Classe, { hp: number; arma: TipoArma }> = CLASSES

/** nome de cada classe na tela de preparação */
export const NOMES_CLASSE: Record<Classe, string> = { espadachim: 'Espadachim', lutador: 'Lutador', tank: 'Tank', atirador: 'Atirador' }
export const ehClasse = (x: unknown): x is Classe => typeof x === 'string' && Object.hasOwn(CLASSES, x)

/**
 * Pasta dos sprites de um tripulante: a dele quando está na classe de
 * origem; trocada a classe, a de quem tem essa classe no mesmo navio.
 */
const FOLHA_CLASSE: Record<Lado, Record<Classe, string>> = {
  piratas: { espadachim: 'pirata-espadachim', lutador: 'pirata-lutador', tank: 'pirata-medico', atirador: 'pirata-atiradora' },
  marinha: { espadachim: 'marinha-almirante', lutador: 'marinha-oficial', tank: 'marinha-soldado', atirador: 'marinha-atirador' },
}
export function folhaDe(id: string, classe: Classe) {
  const m = TRIPULACOES.find((x) => x.id === id)
  if (!m || m.classe === classe) return id
  return FOLHA_CLASSE[m.lado][classe]
}

/** nomes sorteados a cada partida (piratas e Marinha), sem repetir */
const NOMES = ['Dorian', 'Yuki', 'Brutus', 'Sven', 'Kenzo', 'Vargas', 'Hector', 'Ivo', 'Lucan', 'Akira', 'Rurik', 'Tomás', 'Kael', 'Bento', 'Mira', 'Otto', 'Ravi', 'Saga', 'Teodoro', 'Zeca', 'Iori', 'Gunnar', 'Lia', 'Marco']
const sorteados = [...NOMES].sort(() => Math.random() - 0.5)
const nome = (k: number) => sorteados[k % sorteados.length]
/** 10 nomes sem repetir (no multiplayer o servidor sorteia, para os dois verem os mesmos) */
export const sortearNomes = () => [...NOMES].sort(() => Math.random() - 0.5).slice(0, 10)

const semHaki: Haki = { overall: 0, armamento: null, observacao: null, rei: false }
/** arm: [usos, avançado, Rei imbuído (nível 3)] */
const haki = (overall: number, arm: [number, boolean, boolean?] | null, obs: [number, boolean] | null, rei = false): Haki => ({
  overall,
  armamento: arm && { usos: arm[0], max: arm[0], avancado: arm[1] || !!arm[2], imbuido: !!arm[2] },
  observacao: obs && { usos: obs[0], max: obs[0], avancado: obs[1] },
  rei,
})

export type Membro = {
  id: string
  nome: string
  classe: Classe
  profissao?: 'medico'
  lado: Lado
  casa: { l: number; c: number }
  dir: Direcao
  haki?: Haki
  /** id em FRUTAS; Logia ganha cargas de intangibilidade */
  akuma?: string
  cargasLogia?: number
}

/** 5 piratas no navio de cima (linhas 0–4) contra 5 da Marinha (5–9), em
 * formações espelhadas (a de cima deslocada uma coluna vencia 68% das vezes). */
export const TRIPULACOES: Membro[] = [
  { id: 'pirata-capitao', nome: nome(0), classe: 'espadachim', lado: 'piratas', casa: { l: 3, c: 9 }, dir: 'S', haki: haki(70, [6, true, true], [3, false], true) },
  { id: 'pirata-espadachim', nome: nome(1), classe: 'espadachim', lado: 'piratas', casa: { l: 4, c: 7 }, dir: 'S', haki: haki(35, [4, false], null) },
  { id: 'pirata-lutador', nome: nome(2), classe: 'lutador', lado: 'piratas', casa: { l: 4, c: 11 }, dir: 'S', haki: haki(45, [4, true], null), akuma: 'fogo' },
  { id: 'pirata-atiradora', nome: nome(3), classe: 'atirador', lado: 'piratas', casa: { l: 2, c: 6 }, dir: 'S', haki: haki(50, null, null, true) },
  { id: 'pirata-medico', nome: nome(4), classe: 'tank', profissao: 'medico', lado: 'piratas', casa: { l: 2, c: 12 }, dir: 'S', haki: haki(30, [3, false], [3, false]) },
  { id: 'marinha-almirante', nome: nome(5), classe: 'espadachim', lado: 'marinha', casa: { l: 6, c: 9 }, dir: 'N', haki: haki(65, [6, true, true], null, true), akuma: 'fumaca', cargasLogia: 3 },
  { id: 'marinha-oficial', nome: nome(6), classe: 'lutador', lado: 'marinha', casa: { l: 5, c: 7 }, dir: 'N', haki: haki(45, [4, true], [3, true]) },
  { id: 'marinha-soldado', nome: nome(7), classe: 'tank', lado: 'marinha', casa: { l: 5, c: 11 }, dir: 'N', haki: haki(30, [3, false], null), akuma: 'gelo' },
  { id: 'marinha-atirador', nome: nome(8), classe: 'atirador', lado: 'marinha', casa: { l: 7, c: 6 }, dir: 'N', haki: haki(50, null, null, true) },
  { id: 'marinha-enfermeira', nome: nome(9), classe: 'espadachim', profissao: 'medico', lado: 'marinha', casa: { l: 7, c: 12 }, dir: 'N' },
]

export function combatentesIniciais(): Combatente[] {
  return TRIPULACOES.map((m) => {
    const p = { ...CLASSES[m.classe], ...comBuild(m.classe, buildPadrao(m.classe, !!m.akuma)) }
    return {
      id: m.id,
      nome: m.nome,
      papel: m.classe,
      lado: m.lado,
      casa: { ...m.casa },
      hp: p.hp,
      hpMax: p.hp,
      energia: 0,
      espirito: 0,
      at: { ...p.at },
      arma: p.arma,
      profissao: m.profissao,
      haki: structuredClone(m.haki ?? semHaki),
      akuma: m.akuma ? { fruta: m.akuma, transformado: 0 } : null,
      logia: m.cargasLogia ? { cargas: m.cargasLogia, max: m.cargasLogia } : null,
      observando: false,
      armamentoLigado: false,
      atordoado: false,
      recargas: {},
      queimadura: null,
    }
  })
}

// ------------------------------------------------------------ preparação (tela e simulações)
/** cargas de intangibilidade da Logia no teste */
export const CARGAS_LOGIA = 3

export type Config = { id: string; classe: Classe; build: Build; akuma: string; armamento: 0 | 1 | 2 | 3; observacao: 0 | 1 | 2; rei: boolean; overall: number }

/** Config inicial a partir do elenco de teste. */
export function configPadrao(): Config[] {
  return TRIPULACOES.map((m) => ({
    id: m.id,
    classe: m.classe,
    build: buildPadrao(m.classe, !!m.akuma),
    akuma: m.akuma ?? '',
    armamento: m.haki?.armamento ? (m.haki.armamento.imbuido ? 3 : m.haki.armamento.avancado ? 2 : 1) : 0,
    observacao: m.haki?.observacao ? (m.haki.observacao.avancado ? 2 : 1) : 0,
    rei: !!m.haki?.rei,
    overall: m.haki?.overall ?? 0,
  }))
}

export function aplicarConfig(cs: Combatente[], cfg: Config[]) {
  for (const k of cfg) {
    const c = cs.find((x) => x.id === k.id)!
    // classe (o multiplayer manda a do jogador: só vale se existir)
    // e a build por cima da base da classe (inválida: sem pontos)
    const classe = ehClasse(k.classe) ? k.classe : (c.papel as Classe)
    const { at, hp } = comBuild(classe, buildValida(k.build))
    c.papel = classe
    c.arma = CLASSES[classe].arma
    c.hp = c.hpMax = hp
    c.at = at
    c.akuma = k.akuma ? { fruta: k.akuma, transformado: 0 } : null
    c.logia = k.akuma && FRUTAS[k.akuma].tipo === 'logia' ? { cargas: CARGAS_LOGIA, max: CARGAS_LOGIA } : null
    const usosA = k.armamento >= 2 ? 6 : 4
    c.haki = {
      overall: k.overall,
      armamento: k.armamento ? { usos: usosA, max: usosA, avancado: k.armamento >= 2, imbuido: k.armamento === 3 } : null,
      observacao: k.observacao ? { usos: 3, max: 3, avancado: k.observacao === 2 } : null,
      rei: k.rei,
    }
  }
  return cs
}

/** Troca os nomes (na ordem de TRIPULACOES): os do multiplayer vêm do servidor. */
export function renomear<T extends { id: string; nome: string }>(cs: T[], nomes: string[]) {
  TRIPULACOES.forEach((m, i) => {
    const c = cs.find((x) => x.id === m.id)
    if (c && nomes[i]) c.nome = nomes[i]
  })
  return cs
}
