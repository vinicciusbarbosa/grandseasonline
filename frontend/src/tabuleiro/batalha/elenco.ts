/**
 * As duas tripulações do protótipo: atributos por papel e posição inicial.
 * O `id` é também a pasta dos sprites (public/sprites/<id>/).
 */

import type { Direcao } from '../cena/personagem'
import type { Atributos, Combatente, Lado } from './regras'

type Papel = 'capitao' | 'espadachim' | 'lutador' | 'atirador' | 'medico'

const PAPEIS: Record<Papel, { hp: number; at: Atributos; alcance: number; distancia?: boolean; cura?: { valor: number; alcance: number } }> = {
  capitao: { hp: 150, at: { atk: 26, def: 14, agl: 12, dex: 12, con: 12 }, alcance: 1 },
  espadachim: { hp: 125, at: { atk: 30, def: 8, agl: 16, dex: 16, con: 8 }, alcance: 1 },
  lutador: { hp: 175, at: { atk: 24, def: 20, agl: 8, dex: 6, con: 18 }, alcance: 1 },
  atirador: { hp: 100, at: { atk: 22, def: 6, agl: 14, dex: 14, con: 6 }, alcance: 4, distancia: true },
  medico: { hp: 105, at: { atk: 12, def: 8, agl: 10, dex: 6, con: 8 }, alcance: 1, cura: { valor: 32, alcance: 3 } },
}

export type Membro = { id: string; nome: string; papel: Papel; lado: Lado; casa: { l: number; c: number }; dir: Direcao }

/** 5 piratas no navio de cima (linhas 0–4) contra 5 da Marinha (5–9), em
 * formações espelhadas (a de cima deslocada uma coluna vencia 68% das vezes). */
export const TRIPULACOES: Membro[] = [
  { id: 'pirata-capitao', nome: 'Capitão', papel: 'capitao', lado: 'piratas', casa: { l: 3, c: 9 }, dir: 'S' },
  { id: 'pirata-espadachim', nome: 'Espadachim', papel: 'espadachim', lado: 'piratas', casa: { l: 4, c: 7 }, dir: 'S' },
  { id: 'pirata-lutador', nome: 'Lutador', papel: 'lutador', lado: 'piratas', casa: { l: 4, c: 11 }, dir: 'S' },
  { id: 'pirata-atiradora', nome: 'Atiradora', papel: 'atirador', lado: 'piratas', casa: { l: 2, c: 6 }, dir: 'S' },
  { id: 'pirata-medico', nome: 'Médico', papel: 'medico', lado: 'piratas', casa: { l: 2, c: 12 }, dir: 'S' },
  { id: 'marinha-almirante', nome: 'Comandante', papel: 'capitao', lado: 'marinha', casa: { l: 6, c: 9 }, dir: 'N' },
  { id: 'marinha-oficial', nome: 'Oficial', papel: 'espadachim', lado: 'marinha', casa: { l: 5, c: 7 }, dir: 'N' },
  { id: 'marinha-soldado', nome: 'Soldado', papel: 'lutador', lado: 'marinha', casa: { l: 5, c: 11 }, dir: 'N' },
  { id: 'marinha-atirador', nome: 'Atirador', papel: 'atirador', lado: 'marinha', casa: { l: 7, c: 6 }, dir: 'N' },
  { id: 'marinha-enfermeira', nome: 'Enfermeira', papel: 'medico', lado: 'marinha', casa: { l: 7, c: 12 }, dir: 'N' },
]

export const NOME_PAPEL: Record<Papel, string> = {
  capitao: 'Capitão',
  espadachim: 'Espadachim',
  lutador: 'Lutador',
  atirador: 'Atirador',
  medico: 'Médico',
}

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
      at: { ...p.at },
      movimento: 3,
      alcance: p.alcance,
      distancia: !!p.distancia,
      cura: p.cura,
    }
  })
}
