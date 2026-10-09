import type { CSSProperties } from 'react'

const atlas = {
  armas: { url: '/ui/skills/armas.png', colunas: 5, linhas: 3 },
  frutas: { url: '/ui/skills/frutas.png', colunas: 4, linhas: 4 },
  haki: { url: '/ui/skills/haki-suporte.png', colunas: 2, linhas: 2 },
} as const

type ArteSkill = { atlas: keyof typeof atlas; indice: number }

/** Ordem das pinturas nos atlas; a HUD usa as imagens originais, sem recortes extras. */
export const ARTE_SKILLS: Record<string, ArteSkill> = Object.fromEntries([
  ...[
    'corte', 'corte-duplo', 'corte-voador', 'estocada-perfurante', 'tornado-laminas',
    'pancada', 'esmagar', 'onda-choque', 'tremor', 'martelada-titanica',
    'tiro', 'tiro-certeiro', 'chumbo-grosso', 'rajada', 'tiro-perfurante',
  ].map((id, indice) => [id, { atlas: 'armas', indice }]),
  ...[
    'nuvem-fumaca', 'prisao-fumaca', 'hiken', 'hotarubi',
    'higan', 'corpo-chamas', 'entei', 'yata',
    'yasakani', 'chute-luz', 'raio-luz', 'lanca-gelo',
    'ice-saber', 'ice-time', 'pheasant-beak', 'era-gelo',
  ].map((id, indice) => [id, { atlas: 'frutas', indice }]),
  ...['haoshoku', 'primeiros-socorros', 'armamento', 'observacao']
    .map((id, indice) => [id, { atlas: 'haki', indice }]),
])

export function arteSkill(id: string): CSSProperties | undefined {
  const arte = ARTE_SKILLS[id]
  if (!arte) return undefined
  const { url, colunas, linhas } = atlas[arte.atlas]
  const x = arte.indice % colunas
  const y = Math.floor(arte.indice / colunas)
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${colunas * 100}% ${linhas * 100}%`,
    backgroundPosition: `${x / (colunas - 1) * 100}% ${y / (linhas - 1) * 100}%`,
  }
}
