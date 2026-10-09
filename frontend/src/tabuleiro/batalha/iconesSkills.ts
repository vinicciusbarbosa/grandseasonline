import type { CSSProperties } from 'react'

const atlas = {
  armas: { url: '/ui/skills/armas.png', colunas: 5, linhas: 3 },
  frutas: { url: '/ui/skills/frutas.png', colunas: 4, linhas: 4 },
  haki: { url: '/ui/skills/haki-suporte.png', colunas: 2, linhas: 2 },
  punhos: { url: '/ui/skills/punhos.png', colunas: 3, linhas: 2 },
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

export function arteSkill(id: string, arma?: string, indice = 0): CSSProperties | undefined {
  // Novas skills de punhos continuam com arte durante a transferência das classes.
  // As skills atuais de kanabo mantêm seus próprios ícones pelo id.
  const familias = { espada: ['armas', 0], sabre: ['armas', 0], maca: ['armas', 5], kanabo: ['armas', 5], espingarda: ['armas', 10], punho: ['punhos', 0], punhos: ['punhos', 0] } as const
  const familia = familias[arma as keyof typeof familias]
  const arte: ArteSkill | undefined = ARTE_SKILLS[id] ?? (familia ? { atlas: familia[0], indice: familia[1] + indice % (familia[0] === 'punhos' ? 6 : 5) } : undefined)
  if (!arte) return undefined
  const { url, colunas, linhas } = atlas[arte.atlas]
  const x = arte.indice % colunas
  const y = Math.floor(arte.indice / colunas)
  // A edição do atlas preservou alturas diferentes entre as três fileiras.
  const fileirasArmas = [{ inicio: 0, altura: 340 }, { inicio: 340, altura: 328 }, { inicio: 668, altura: 454 }]
  const fileira = arte.atlas === 'armas' ? fileirasArmas[y] : null
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${colunas * 100}% ${fileira ? 1122 / fileira.altura * 100 : linhas * 100}%`,
    backgroundPosition: `${x / (colunas - 1) * 100}% ${fileira ? fileira.inicio / (1122 - fileira.altura) * 100 : y / (linhas - 1) * 100}%`,
  }
}
