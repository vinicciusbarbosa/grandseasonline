/**
 * As duas tripulações do protótipo de teste: atributos, arma, Haki e
 * posição inicial. O `id` é também a pasta dos sprites (public/sprites/<id>/).
 *
 * Perfis de teste (cada um com um tipo de Haki, para comparar):
 *   Piratas — Espadachim: armamento; Lutador: armamento AVANÇADO;
 *   Atiradora: Haki do Rei (só em área); Capitão: Haki do Rei + armamento
 *   avançado (imbui o Rei no golpe) + observação.
 *   Marinha — Comandante: Haki do Rei + armamento avançado (imbui) +
 *   Logia; Oficial: armamento avançado + observação AVANÇADA (esquiva e
 *   revida); Soldado: armamento; Atirador: Haki do Rei (área).
 *   Akuma no Mi: Logia (Comandante, fumaça), Paramecia (Lutador pirata,
 *   borracha), Zoan (Soldado, bisão). Sem Haki (batem na Logia e não
 *   acertam): Médico e Enfermeira; o Atirador da Marinha só tem o Rei.
 */

import type { Direcao } from '../cena/personagem'
import type { TipoArma } from './armas'
import type { Atributos, Combatente, Haki, Lado } from './regras'

type Papel = 'capitao' | 'espadachim' | 'lutador' | 'atirador' | 'medico'

const PAPEIS: Record<Papel, { hp: number; at: Atributos; arma: TipoArma; profissao?: 'medico' }> = {
  capitao: { hp: 150, at: { atk: 26, def: 14, agl: 12, res: 12, pre: 12, dex: 12, con: 12 }, arma: 'espada' },
  espadachim: { hp: 125, at: { atk: 30, def: 8, agl: 16, res: 8, pre: 16, dex: 16, con: 8 }, arma: 'espada' },
  lutador: { hp: 175, at: { atk: 24, def: 20, agl: 8, res: 16, pre: 8, dex: 6, con: 18 }, arma: 'maca' },
  atirador: { hp: 100, at: { atk: 22, def: 6, agl: 14, res: 6, pre: 18, dex: 14, con: 6 }, arma: 'espingarda' },
  medico: { hp: 105, at: { atk: 14, def: 8, agl: 10, res: 8, pre: 10, dex: 8, con: 8 }, arma: 'adaga', profissao: 'medico' },
}

const semHaki: Haki = { overall: 0, armamento: null, observacao: null, rei: false }
const haki = (overall: number, arm: [number, boolean] | null, obs: [number, boolean] | null, rei = false): Haki => ({
  overall,
  armamento: arm && { usos: arm[0], max: arm[0], avancado: arm[1] },
  observacao: obs && { usos: obs[0], max: obs[0], avancado: obs[1] },
  rei,
})

export type Membro = {
  id: string
  nome: string
  papel: Papel
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
  { id: 'pirata-capitao', nome: 'Capitão', papel: 'capitao', lado: 'piratas', casa: { l: 3, c: 9 }, dir: 'S', haki: haki(65, [6, true], [3, false], true) },
  { id: 'pirata-espadachim', nome: 'Espadachim', papel: 'espadachim', lado: 'piratas', casa: { l: 4, c: 7 }, dir: 'S', haki: haki(35, [4, false], null) },
  { id: 'pirata-lutador', nome: 'Lutador', papel: 'lutador', lado: 'piratas', casa: { l: 4, c: 11 }, dir: 'S', haki: haki(45, [4, true], null), akuma: 'borracha' },
  { id: 'pirata-atiradora', nome: 'Atiradora', papel: 'atirador', lado: 'piratas', casa: { l: 2, c: 6 }, dir: 'S', haki: haki(50, null, null, true) },
  { id: 'pirata-medico', nome: 'Médico', papel: 'medico', lado: 'piratas', casa: { l: 2, c: 12 }, dir: 'S' },
  { id: 'marinha-almirante', nome: 'Comandante', papel: 'capitao', lado: 'marinha', casa: { l: 6, c: 9 }, dir: 'N', haki: haki(65, [6, true], [2, false], true), akuma: 'fumaca', cargasLogia: 3 },
  { id: 'marinha-oficial', nome: 'Oficial', papel: 'espadachim', lado: 'marinha', casa: { l: 5, c: 7 }, dir: 'N', haki: haki(45, [4, true], [2, true]) },
  { id: 'marinha-soldado', nome: 'Soldado', papel: 'lutador', lado: 'marinha', casa: { l: 5, c: 11 }, dir: 'N', haki: haki(30, [3, false], null), akuma: 'bisao' },
  { id: 'marinha-atirador', nome: 'Atirador', papel: 'atirador', lado: 'marinha', casa: { l: 7, c: 6 }, dir: 'N', haki: haki(50, null, null, true) },
  { id: 'marinha-enfermeira', nome: 'Enfermeira', papel: 'medico', lado: 'marinha', casa: { l: 7, c: 12 }, dir: 'N' },
]

export function combatentesIniciais(): Combatente[] {
  return TRIPULACOES.map((m) => {
    const p = PAPEIS[m.papel]
    return {
      id: m.id,
      nome: m.nome,
      papel: m.papel,
      lado: m.lado,
      casa: { ...m.casa },
      hp: p.hp,
      hpMax: p.hp,
      energia: 0,
      espirito: 0,
      at: { ...p.at },
      arma: p.arma,
      profissao: p.profissao,
      haki: structuredClone(m.haki ?? semHaki),
      akuma: m.akuma ? { fruta: m.akuma, transformado: 0 } : null,
      logia: m.cargasLogia ? { cargas: m.cargasLogia, max: m.cargasLogia } : null,
      observando: false,
      armamentoLigado: false,
      reiLigado: false,
      atordoado: false,
      recargas: {},
      queimadura: null,
    }
  })
}
