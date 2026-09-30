/**
 * IA simples para um lado da batalha: escolhe para onde cada um anda, quem
 * ataca (o inimigo mais perto e mais ferido), com que golpe, e a postura —
 * gastando a vontade do lado com cuidado. A médica cura quem está ferido.
 */

import { mesmaCasa, type Casa } from '../tabuleiro'
import { CUSTO, casasDeMovimento, distancia, inimigo, vivos, type Combatente, type Estado, type Golpe, type Lado, type Plano, type Postura } from './regras'

function sortearPeso<T extends string>(pesos: [T, number][], r: number): T {
  const total = pesos.reduce((s, [, p]) => s + p, 0)
  let x = r * total
  for (const [v, p] of pesos) {
    x -= p
    if (x <= 0) return v
  }
  return pesos[pesos.length - 1][0]
}

/** Casas possíveis no fim do movimento (inclui ficar parado), com o caminho. */
function opcoes(e: Estado, c: Combatente, bloqueadas: Casa[]) {
  const a = casasDeMovimento(e, c, bloqueadas)
  const livres = a.casas.filter((x) => !bloqueadas.some((b) => mesmaCasa(b, x)))
  return [{ casa: c.casa, caminho: [] as Casa[] }, ...livres.map((x) => ({ casa: x, caminho: a.caminho(x) ?? [] }))]
}

export function planejarIA(e: Estado, lado: Lado, rnd: () => number): Record<string, Plano> {
  const planos: Record<string, Plano> = {}
  const destinos: Casa[] = []
  const inimigos = vivos(e, inimigo(lado))
  const aliados = vivos(e, lado)
  let vontade = e.vontade[lado]
  // quem cura planeja por último (vê onde os outros vão ficar)
  const fila = [...aliados].sort((a, b) => Number(!!a.cura) - Number(!!b.cura))
  for (const c of fila) {
    const ops = opcoes(e, c, destinos)
    const perigo = (x: Casa) => Math.min(...inimigos.map((i) => distancia(x, i.casa)))
    let escolha = ops[0]
    let acao: Plano['acao'] = null

    const ferido = c.cura ? [...aliados].filter((a) => a.hp / a.hpMax < 0.65).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] : undefined
    if (c.cura && ferido) {
      const alcancaveis = ops.filter((o) => distancia(o.casa, ferido.casa) <= c.cura!.alcance)
      if (alcancaveis.length) {
        escolha = alcancaveis.sort((a, b) => perigo(b.casa) - perigo(a.casa))[0]
        acao = { tipo: 'curar', alvo: ferido.id }
      }
    }
    if (!acao && inimigos.length) {
      // alvo: perto e ferido
      const alvo = [...inimigos].sort((a, b) => distancia(c.casa, a.casa) + (a.hp / a.hpMax) * 4 - (distancia(c.casa, b.casa) + (b.hp / b.hpMax) * 4))[0]
      const noAlcance = ops.filter((o) => distancia(o.casa, alvo.casa) <= c.alcance)
      if (noAlcance.length) {
        // de perto: o caminho mais curto; de longe: a casa mais segura
        escolha = c.distancia
          ? noAlcance.sort((a, b) => perigo(b.casa) - perigo(a.casa) || a.caminho.length - b.caminho.length)[0]
          : noAlcance.sort((a, b) => a.caminho.length - b.caminho.length)[0]
      } else {
        escolha = [...ops].sort((a, b) => distancia(a.casa, alvo.casa) - distancia(b.casa, alvo.casa))[0]
      }
      const golpe = sortearPeso<Golpe>([['comum', 5], ['pesado', 3], ['finta', 2]], rnd())
      acao = { tipo: 'atacar', alvo: alvo.id, golpe }
    }
    destinos.push(escolha.casa)

    // postura: gasta a vontade do lado aos poucos
    const pesos: [Postura, number][] = [
      ['bloquear', 5],
      ['esquivar', c.at.agl >= 14 ? 5 : 3],
      ['aparar', vontade >= CUSTO.aparar ? 2 : 0],
      ['contra', vontade >= CUSTO.contra && !c.distancia ? 1.5 : 0],
    ]
    const postura = sortearPeso(pesos.filter(([, p]) => p > 0), rnd())
    vontade -= CUSTO[postura]
    planos[c.id] = { caminho: escolha.caminho, acao, postura }
  }
  return planos
}
