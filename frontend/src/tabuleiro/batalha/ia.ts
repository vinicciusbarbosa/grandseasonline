/**
 * IA simples para a vez de um lado: decide uma ação de cada vez — anda
 * (dentro dos 5 movimentos) e ataca uma vez, o que encerra a vez. Liga a observação de
 * quem está perto do inimigo, solta o Haki do Rei quando pega vários,
 * escolhe o golpe de mais dano esperado (andando antes, se precisar), usa o
 * armamento contra a Logia e a médica cura quem está ferido.
 */

import type { Casa } from '../tabuleiro'
import { alvoValido, casasDaArea } from './armas'
import {
  HAOSHOKU,
  custoArmamento,
  chanceHaki,
  FORCA,
  distancia,
  motivo,
  movimentos,
  outro,
  skillsDe,
  vivos,
  type Acao,
  type Combatente,
  type Estado,
} from './regras'

/** Dano esperado (bem grosseiro) de um golpe. */
export function esperado(c: Combatente, alvo: Combatente, mult: number, golpes: number, armamento: boolean) {
  const def = Math.min(60, alvo.at.def)
  let d = c.at.atk * FORCA * mult * golpes * (1 - def / 100)
  if (armamento) d *= c.haki.armamento?.avancado ? 1.4 : 1.25
  // prefere terminar quem está quase caindo
  if (d >= alvo.hp) d = alvo.hp + 25
  // Logia com cargas (sem Haki) ou observação ligada: cada carga/uso é um
  // escudo que absorve um golpe inteiro. Quebrar o escudo vale quase o mesmo
  // que causar o dano (senão ninguém bate nele e ele vence sozinho).
  if (alvo.logia && alvo.logia.cargas > 0 && (!armamento || (c.haki.armamento?.usos ?? 0) < 2)) d *= 0.85
  const obs = alvo.haki.observacao
  if (alvo.observando && obs && obs.usos > 0 && alvo.haki.overall > c.haki.overall) d *= 0.85
  return d
}

type Opcao = { valor: number; acao: Acao; andar?: Casa[]; haki?: { armamento: boolean } }

function melhorGolpe(e: Estado, c: Combatente, de: Casa): Opcao | null {
  let melhor: Opcao | null = null
  const inimigos = vivos(e, outro(c.lado))
  const aliados = vivos(e, c.lado)
  for (const s of skillsDe(c)) {
    if (c.energia < s.energia || c.recargas[s.id]) continue
    // casas candidatas: inimigos (e aliados, para curar) e, para área, a própria casa
    const alvos: Casa[] = s.area === 'volta' || s.area === 'mapa' ? [de] : s.cura ? aliados.map((a) => a.casa) : inimigos.map((i) => i.casa)
    for (const alvo of alvos) {
      if (!alvoValido(s, de, alvo)) continue
      if (s.cura) {
        const a = aliados.find((x) => x.casa.l === alvo.l && x.casa.c === alvo.c)!
        const falta = a.hpMax - a.hp
        if (a.hp / a.hpMax > 0.65) continue
        const v = Math.min(s.cura, falta) * 1.2
        if (!melhor || v > melhor.valor) melhor = { valor: v, acao: { t: 'skill', id: c.id, skill: s.id, alvo } }
        continue
      }
      const casas = casasDaArea(s, de, alvo)
      let v = 0
      let logia = false
      for (const x of casas) {
        const o = [...inimigos, ...aliados].find((p) => p.casa.l === x.l && p.casa.c === x.c)
        if (!o || o === c) continue
        if (o.lado === c.lado) continue // companheiros não se ferem
        if (o.logia && o.logia.cargas > 0) logia = true
        v += esperado(c, o, s.mult, s.golpes ?? 1, false)
      }
      if (v <= 0) continue
      // armamento: contra Logia com cargas, ou em golpe forte se sobra uso
      const usos = c.haki.armamento?.usos ?? 0
      // (custa energia a mais: só se ainda sobra energia depois)
      const armamento = usos > 0 && c.energia >= s.energia + custoArmamento(c) && (logia || (usos > 1 && s.energia > 0))
      if (armamento) {
        v = 0
        for (const x of casas) {
          const o = inimigos.find((p) => p.casa.l === x.l && p.casa.c === x.c)
          if (o) v += esperado(c, o, s.mult, s.golpes ?? 1, true)
        }
      }
      v -= s.energia * 0.3 // guarda energia
      if (!melhor || v > melhor.valor) melhor = { valor: v, acao: { t: 'skill', id: c.id, skill: s.id, alvo }, haki: { armamento } }
    }
  }
  return melhor
}

export function proximaAcao(e: Estado): Acao {
  const lado = e.vez
  // (modo fila: só quem está na vez age)
  const meus = vivos(e, lado).filter((c) => !c.atordoado && (e.modo !== 'fila' || c.id === e.ativo))
  const inimigos = vivos(e, outro(lado))
  const perto = (c: Combatente, r: number) => inimigos.some((i) => distancia(i.casa, c.casa) <= r)

  // observação: liga em quem está perto do inimigo (não gasta ação)
  for (const c of vivos(e, lado).filter((x) => e.modo !== 'fila' || x.id === e.ativo)) {
    if (!c.observando && (c.haki.observacao?.usos ?? 0) > 0 && perto(c, 4)) return { t: 'observar', id: c.id, ligado: true }
  }
  {
    // buffs/transformação não gastam a vez: usa quando o inimigo está perto
    for (const c of meus) {
      if (c.akuma?.transformado) continue
      const t = skillsDe(c).find((s) => s.transforma && s.livre)
      if (t && c.energia >= t.energia && !c.recargas[t.id] && perto(c, 5)) return { t: 'skill', id: c.id, skill: t.id, alvo: c.casa }
    }
    // Haki do Rei em área, se pega pelo menos dois mais fracos
    for (const c of meus) {
      if (!c.haki.rei || c.espirito < HAOSHOKU.espirito) continue
      const pega = inimigos.filter((i) => distancia(i.casa, c.casa) <= HAOSHOKU.raio && chanceHaki(c.haki.overall - i.haki.overall) >= 0.5 && !i.atordoado)
      // não gasta a vez: vale soltar se pega pelo menos um
      if (pega.length >= 1) return { t: 'haoshoku', id: c.id }
    }
    let melhor: Opcao | null = null
    for (const c of meus) {
      const aqui = melhorGolpe(e, c, c.casa)
      if (aqui && (!melhor || aqui.valor > melhor.valor)) melhor = aqui
      if (e.movimento <= 0) continue
      const m = movimentos(e, c)
      for (const casa of m.casas) {
        const op = melhorGolpe(e, c, casa)
        if (!op) continue
        const cam = m.caminho(casa)!
        const v = op.valor - cam.length * 2
        if (!melhor || v > melhor.valor) melhor = { valor: v, acao: op.acao, andar: cam }
      }
    }
    if (melhor && melhor.valor > 0) {
      if (melhor.andar) {
        const id = (melhor.acao as { id: string }).id
        return { t: 'mover', id, caminho: melhor.andar }
      }
      // liga/desliga o Haki antes (não gasta a vez)
      const c = meus.find((x) => x.id === (melhor!.acao as { id: string }).id)!
      const h = melhor.haki
      if (h) {
        if (h.armamento !== c.armamentoLigado) return { t: 'haki', id: c.id, tipo: 'armamento', ligado: h.armamento }
      }
      if (!motivo(e, melhor.acao)) return melhor.acao
    }
  }
  // ninguém alcança: aproxima o mais perto do inimigo mais próximo
  if (e.movimento > 0 && inimigos.length) {
    let melhor: { d: number; acao: Acao } | null = null
    for (const c of meus) {
      const m = movimentos(e, c)
      for (const casa of m.casas) {
        const d = Math.min(...inimigos.map((i) => distancia(i.casa, casa)))
        const atual = Math.min(...inimigos.map((i) => distancia(i.casa, c.casa)))
        if (d >= atual || d < 1) continue
        if (!melhor || d < melhor.d) melhor = { d, acao: { t: 'mover', id: c.id, caminho: m.caminho(casa)! } }
      }
    }
    if (melhor) return melhor.acao
  }
  return { t: 'passar' }
}
