/**
 * Cores das ilhas. Tons saturados e claros, de cenário de anime: grama viva,
 * areia quente, telhados vermelhos. Os índices dos materiais do terreno são os
 * mesmos de scripts/ilhas/kit.py.
 */

export const MATERIAL = {
  AREIA: 1,
  GRAMA: 2,
  FLORESTA: 3,
  ROCHA: 4,
  TERRA_BATIDA: 5,
  CALCADA: 6,
  LIXO: 7,
  CAMPO: 8,
  RIO: 9,
  CAMPINA: 10,
  POMAR: 11,
  PENHASCO: 12,
} as const

/** Cor base e variação (quanto o ruído mexe) de cada material do chão. */
export const CHAO: Record<number, { cor: number; variacao: number; escura?: number }> = {
  [MATERIAL.AREIA]: { cor: 0xf1dfa8, variacao: 0.05 },
  [MATERIAL.GRAMA]: { cor: 0x6fbf4a, variacao: 0.1, escura: 0x4a9a3a },
  [MATERIAL.FLORESTA]: { cor: 0x3f8a36, variacao: 0.1, escura: 0x2d6b2c },
  [MATERIAL.ROCHA]: { cor: 0xa99478, variacao: 0.12, escura: 0x7f6d58 },
  [MATERIAL.TERRA_BATIDA]: { cor: 0xd8bb82, variacao: 0.06 },
  [MATERIAL.CALCADA]: { cor: 0xc9c0ad, variacao: 0.06 },
  [MATERIAL.LIXO]: { cor: 0x8a7760, variacao: 0.2, escura: 0x5f5244 },
  [MATERIAL.CAMPO]: { cor: 0xe2c75a, variacao: 0.08, escura: 0xc9a844 },
  [MATERIAL.RIO]: { cor: 0x4fb3d9, variacao: 0.04 },
  [MATERIAL.CAMPINA]: { cor: 0x8fcf58, variacao: 0.1 },
  [MATERIAL.POMAR]: { cor: 0x5fae45, variacao: 0.08 },
  [MATERIAL.PENHASCO]: { cor: 0x9c8468, variacao: 0.1, escura: 0x6e5c49 },
}

/** Fachadas e telhados por estilo de cidade. */
export const ESTILOS: Record<string, { paredes: number[]; telhados: number[]; madeira?: number[] }> = {
  // Vila Foosha: casas de reboco claro, telhas vermelhas e marrons.
  foosha: {
    paredes: [0xf4ead2, 0xefe0bd, 0xfaf3e3, 0xe8d6b0, 0xf2e4c8],
    telhados: [0xc0503a, 0xa9442f, 0xd0683e, 0x8e5a3c, 0x5f7fa0],
    madeira: [0x8a5a34, 0x6f4526],
  },
  // Goa (cidade baixa): sobrados estreitos de pedra, telhados escuros.
  goa: {
    paredes: [0xe2d6bf, 0xd6c7aa, 0xeae1cf, 0xcdbd9f, 0xe6d3b4],
    telhados: [0x8f3e2e, 0x7a4a36, 0x5a6478, 0xa45a3a, 0x6b4a3a],
  },
  // High Town: casarões brancos, telhados azuis e verdes.
  nobre: {
    paredes: [0xfbf8f0, 0xf4efe4, 0xfffaf0],
    telhados: [0x3f6fa8, 0x2f5f8f, 0x4f8f8a, 0xc4613f],
  },
  // Shells Town: casas brancas de porto, telhados azuis e laranjas.
  shells: {
    paredes: [0xf7f3ea, 0xeef0f2, 0xf3e8d2, 0xe9eef3],
    telhados: [0x3f78b5, 0xd96f3c, 0x2f6ca0, 0xc85d3a],
  },
  // Orange Town: tijolo alaranjado.
  orange: {
    paredes: [0xf0c08a, 0xe8a86e, 0xf4d2a4, 0xe29e6a, 0xf6dcb6],
    telhados: [0xb8442c, 0xd05a2e, 0x8e3a26, 0xe07a36],
  },
  // Vila Syrup: casinhas de campo, telhados vermelhos e azuis.
  syrup: {
    paredes: [0xfbf1dc, 0xf1e2c2, 0xe9dcc0, 0xfff6e6],
    telhados: [0xc8453a, 0x3f73b0, 0xd7803a, 0x7a9a4a],
  },
  // Cocoyashi: casas tropicais claras, telhados laranja e vermelhos.
  cocoyashi: {
    paredes: [0xfff4dc, 0xf6e6c6, 0xfbead8, 0xefe2cc],
    telhados: [0xe0703a, 0xc8503a, 0xb9632e, 0x4f8fb0],
  },
  // Loguetown: prédios altos europeus, pedra clara e telhados vermelhos.
  logue: {
    paredes: [0xf2e6cf, 0xe6d6b8, 0xd9c7a6, 0xf6efe0, 0xe0cfb2],
    telhados: [0xa6402e, 0x8a3526, 0xb85a36, 0x5a6a80, 0x7a4430],
  },
}

export const COR = {
  pedra: 0xe8e2d4,
  pedraEscura: 0xb8ae9c,
  madeira: 0x8a5a34,
  madeiraEscura: 0x5e3a20,
  madeiraClara: 0xb98a55,
  janela: 0x2f4058,
  janelaLuz: 0xf6d88a,
  porta: 0x6b4226,
  folha: 0x3f9a3a,
  folhaClara: 0x6cc24a,
  folhaEscura: 0x2c6e2c,
  tronco: 0x7a5232,
  palha: 0xd9b45a,
  lona: 0xefe6d0,
  telhaVermelha: 0xc0503a,
  telhaLaranja: 0xe07a36,
  ferro: 0x4a4e56,
  marinhaAzul: 0x2f64a8,
}
