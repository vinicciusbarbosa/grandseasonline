import type { Aparencia, Encaixe } from './boneco'

export type { Encaixe }

/**
 * Catálogo de peças por encaixe (o que o jogador poderá trocar). Cada peça
 * é só dado: o boneco sabe vesti-la. Os dois capitães usam peças daqui.
 */
type Catalogo = { [E in Encaixe]: { nome: string; valor: Aparencia[E] }[] }

export const PECAS: Catalogo = {
  corpo: [
    { nome: 'Forte, pele clara', valor: { tipo: 'forte', pele: 0xe8a878 } },
    { nome: 'Forte, pele morena', valor: { tipo: 'forte', pele: 0xdca070 } },
    { nome: 'Forte, pele escura', valor: { tipo: 'forte', pele: 0x9a6440 } },
    { nome: 'Magro, pele clara', valor: { tipo: 'magro', pele: 0xf0bc90 } },
    { nome: 'Magro, pele morena', valor: { tipo: 'magro', pele: 0xc88858 } },
  ],
  cabelo: [
    { nome: 'Curto verde', valor: { estilo: 'curto', cor: 0x3f5a3a } },
    { nome: 'Longo castanho', valor: { estilo: 'longo', cor: 0x2a1c16 } },
    { nome: 'Curto preto', valor: { estilo: 'curto', cor: 0x1c1820 } },
    { nome: 'Longo loiro', valor: { estilo: 'longo', cor: 0xe8c060 } },
    { nome: 'Curto ruivo', valor: { estilo: 'curto', cor: 0xc04a24 } },
    { nome: 'Careca', valor: { estilo: 'careca', cor: 0x2a1c16 } },
  ],
  barba: [
    { nome: 'Cheia escura', valor: { estilo: 'cheia', cor: 0x3a2a24 } },
    { nome: 'Bigode castanho', valor: { estilo: 'bigode', cor: 0x2a1c16 } },
    { nome: 'Bigode loiro', valor: { estilo: 'bigode', cor: 0xe8c060 } },
    { nome: 'Sem barba', valor: null },
  ],
  chapeu: [
    { nome: 'Pirata vermelho', valor: { estilo: 'pirata', cor: 0xb0222a, debrum: 0xe0a83a, caveira: true, pluma: 0x3a3450 } },
    { nome: 'Tricórnio negro', valor: { estilo: 'tricornio', cor: 0x262228, debrum: 0xeae6ea, caveira: false, pluma: null } },
    { nome: 'Tricórnio azul', valor: { estilo: 'tricornio', cor: 0x223a78, debrum: 0xe0a83a, caveira: false, pluma: null } },
    { nome: 'Pirata negro', valor: { estilo: 'pirata', cor: 0x1e1a20, debrum: 0xdcdcdc, caveira: true, pluma: 0xb02030 } },
    { nome: 'Sem chapéu', valor: null },
  ],
  camisa: [
    { nome: 'Peito nu', valor: null },
    { nome: 'Camisa branca aberta', valor: { estilo: 'aberta', cor: 0xece6da } },
    { nome: 'Camisa listrada', valor: { estilo: 'fechada', cor: 0x3a5a9a } },
  ],
  casaca: [
    { nome: 'Curta vermelha', valor: { estilo: 'curta', cor: 0xb0242a, forro: 0x5a1418, debrum: 0xe0a83a, dragonas: false } },
    { nome: 'Longa negra com dragonas', valor: { estilo: 'longa', cor: 0x2c2a30, forro: 0x7a1420, debrum: 0xe8b43c, dragonas: true } },
    { nome: 'Longa azul da Marinha', valor: { estilo: 'longa', cor: 0x223a78, forro: 0xe8e8ec, debrum: 0xe0a83a, dragonas: true } },
    { nome: 'Sem casaca', valor: null },
  ],
  capa: [
    { nome: 'Capa vermelha', valor: { cor: 0xa81e26, forro: 0x3a1a24, debrum: 0xe0a83a } },
    { nome: 'Capa branca da Marinha', valor: { cor: 0xeeeef2, forro: 0x223a78, debrum: 0xe0a83a } },
    { nome: 'Capa negra', valor: { cor: 0x1e1a22, forro: 0x7a1420, debrum: 0xb0a080 } },
    { nome: 'Sem capa', valor: null },
  ],
  cintura: [
    { nome: 'Cinto escuro', valor: { estilo: 'cinto', cor: 0x2a2226 } },
    { nome: 'Faixa vermelha', valor: { estilo: 'faixa', cor: 0xb0202c } },
    { nome: 'Faixa azul', valor: { estilo: 'faixa', cor: 0x2a4a9a } },
    { nome: 'Nada', valor: null },
  ],
  calca: [
    { nome: 'Laranja', valor: { cor: 0xe88a2c } },
    { nome: 'Branca', valor: { cor: 0xeceaf2 } },
    { nome: 'Azul', valor: { cor: 0x2a3a6a } },
    { nome: 'Marrom', valor: { cor: 0x6a4a30 } },
  ],
  botas: [
    { nome: 'Curtas com punho', valor: { estilo: 'curta', cor: 0x7a4a2a, punho: 0xe8e4f0 } },
    { nome: 'Altas negras', valor: { estilo: 'alta', cor: 0x2a2428, punho: null } },
    { nome: 'Altas marrons', valor: { estilo: 'alta', cor: 0x6a3e22, punho: 0xc8a060 } },
  ],
  arma: [
    { nome: 'Sabre (fogo)', valor: { estilo: 'sabre', lamina: 0xd8dde6, guarda: 0xe0a83a, efeito: [0xfff6d0, 0xffb340, 0xd8401c] } },
    { nome: 'Sabre (gelo)', valor: { estilo: 'sabre', lamina: 0xdfe4ec, guarda: 0xe8b43c, efeito: [0xf0fbff, 0x8cd0ff, 0x2a6ae0] } },
    { nome: 'Sem arma', valor: null },
  ],
}
