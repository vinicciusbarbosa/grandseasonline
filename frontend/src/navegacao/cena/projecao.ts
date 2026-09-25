/**
 * Câmera "um pouco isométrica": o plano do mar é visto inclinado, não de
 * cima. É uma projeção oblíqua com a câmera a ~57° do horizonte:
 *
 *   tela.x = mundo.x
 *   tela.y = mundo.y · ACHATAMENTO − altura · ELEVACAO
 *
 * A lógica (sim/) continua num plano 2D comum; só o desenho passa por aqui.
 * Tudo que fica deitado no mar (esteira, rota, zonas) vai num container com
 * scaleY = ACHATAMENTO; o que tem altura (navio, raios, nomes) é projetado
 * ponto a ponto.
 */
export const ACHATAMENTO = 0.84
export const ELEVACAO = 0.55

export function projetar(x: number, y: number, z = 0) {
  return { x, y: y * ACHATAMENTO - z * ELEVACAO }
}
