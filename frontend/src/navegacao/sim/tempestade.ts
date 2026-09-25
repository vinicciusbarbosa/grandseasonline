import type { Vetor } from '../mundo/Mundo'

/**
 * Zonas de tempestade. Por enquanto uma fixa, no sul do East Blue, no maior
 * trecho de mar aberto do recorte; depois viram dado do mundo (e podem andar).
 *
 * Dentro dela o vento gira em volta do olho (ciclone), o mar fica muito
 * mais alto, a visibilidade cai e caem raios.
 */
export type Tempestade = {
  /** Centro, em células do recorte. */
  cx: number
  cy: number
  /** Raio total e raio do núcleo (intensidade máxima), em células. */
  raio: number
  nucleo: number
}

export const TEMPESTADES: readonly Tempestade[] = [{ cx: 165, cy: 85, raio: 20, nucleo: 9 }]

/** 0 fora, 1 no núcleo, com transição suave na borda. */
export function intensidadeTempestade(p: Vetor, celula: number) {
  let maior = 0
  for (const t of TEMPESTADES) {
    const d = Math.hypot(p.x / celula - t.cx, p.y / celula - t.cy)
    const f = 1 - Math.min(1, Math.max(0, (d - t.nucleo) / (t.raio - t.nucleo)))
    maior = Math.max(maior, f * f * (3 - 2 * f))
  }
  return maior
}

/** A tempestade mais próxima, para o vento girar em volta dela. */
export function tempestadeMaisProxima(p: Vetor, celula: number) {
  let melhor = TEMPESTADES[0]
  let melhorD = Infinity
  for (const t of TEMPESTADES) {
    const d = Math.hypot(p.x / celula - t.cx, p.y / celula - t.cy)
    if (d < melhorD) {
      melhorD = d
      melhor = t
    }
  }
  return melhor
}
