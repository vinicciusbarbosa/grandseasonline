/**
 * As duas tripulações do protótipo de teste: classe, Haki, Akuma no Mi e
 * posição inicial. O `id` é também a pasta dos sprites (public/sprites/<id>/);
 * os nomes são sorteados a cada partida.
 *
 * Cada lado tem as três classes e repetidas: piratas com dois espadachins,
 * lutador e dois atiradores (um é o médico); Marinha com dois espadachins
 * (um é o médico), dois lutadores e atirador.
 * Haki: o espadachim que comanda cada lado tem o Rei + armamento nível 3
 * (o Rei imbuído vai em todo golpe com o armamento ligado); lutador pirata: armamento avançado; o lutador
 * oficial da Marinha: armamento avançado + observação AVANÇADA (esquiva e
 * revida); atiradores: Rei (só em área). Akuma no Mi (só Logias): fumaça
 * (comandante da Marinha), fogo (lutador pirata), gelo (soldado). O médico da Marinha não tem Haki.
 */

import type { Direcao } from '../cena/personagem'
import type { TipoArma } from './armas'
import { FRUTAS } from './armas'
import type { Atributos, Combatente, Haki, Lado } from './regras'

/**
 * Classe = tipo de arma: espadachim (sabre/espada), lutador (punhos e
 * pernas), atirador (rifle e pistolas). Médico, cartógrafo
 * etc. são profissões, à parte da classe.
 */
type Classe = 'espadachim' | 'lutador' | 'atirador'

const CLASSES: Record<Classe, { hp: number; at: Atributos; arma: TipoArma }> = {
  espadachim: { hp: 135, at: { atk: 28, def: 10, agl: 14, res: 10, pre: 14, dex: 14, con: 10 }, arma: 'espada' },
  lutador: { hp: 175, at: { atk: 24, def: 20, agl: 8, res: 16, pre: 8, dex: 6, con: 18 }, arma: 'maca' },
  atirador: { hp: 100, at: { atk: 22, def: 6, agl: 14, res: 6, pre: 18, dex: 14, con: 6 }, arma: 'espingarda' },
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
  { id: 'pirata-medico', nome: nome(4), classe: 'atirador', profissao: 'medico', lado: 'piratas', casa: { l: 2, c: 12 }, dir: 'S', haki: haki(30, null, [3, false]) },
  { id: 'marinha-almirante', nome: nome(5), classe: 'espadachim', lado: 'marinha', casa: { l: 6, c: 9 }, dir: 'N', haki: haki(65, [6, true, true], null, true), akuma: 'fumaca', cargasLogia: 3 },
  { id: 'marinha-oficial', nome: nome(6), classe: 'lutador', lado: 'marinha', casa: { l: 5, c: 7 }, dir: 'N', haki: haki(45, [4, true], [3, true]) },
  { id: 'marinha-soldado', nome: nome(7), classe: 'lutador', lado: 'marinha', casa: { l: 5, c: 11 }, dir: 'N', haki: haki(30, [3, false], null), akuma: 'gelo' },
  { id: 'marinha-atirador', nome: nome(8), classe: 'atirador', lado: 'marinha', casa: { l: 7, c: 6 }, dir: 'N', haki: haki(50, null, null, true) },
  { id: 'marinha-enfermeira', nome: nome(9), classe: 'espadachim', profissao: 'medico', lado: 'marinha', casa: { l: 7, c: 12 }, dir: 'N' },
]

export function combatentesIniciais(): Combatente[] {
  return TRIPULACOES.map((m) => {
    const p = CLASSES[m.classe]
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

export type Config = { id: string; akuma: string; armamento: 0 | 1 | 2 | 3; observacao: 0 | 1 | 2; rei: boolean; overall: number }

/** Config inicial a partir do elenco de teste. */
export function configPadrao(): Config[] {
  return TRIPULACOES.map((m) => ({
    id: m.id,
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
