import type { ReactNode } from 'react'

/** A arte do jogo legado é servida pela API em /imagens. */
export const ARTE = '/imagens'

/**
 * Cores de raridade, uma por quantidade de estrelas. É o sinal visual mais forte
 * de um inventário de jogo: antes de ler o nome, a cor do card já diz o quanto o
 * item vale.
 */
export const CORES_RARIDADE: Record<number, { fundo: string; borda: string; faixa: string }> = {
  1: { fundo: 'linear-gradient(160deg, #7c8494 0%, #4d5564 100%)', borda: '#8d95a5', faixa: '#5c6474' },
  2: { fundo: 'linear-gradient(160deg, #4f8f6d 0%, #2f5b45 100%)', borda: '#6bab88', faixa: '#3d7256' },
  3: { fundo: 'linear-gradient(160deg, #4b86b4 0%, #2d5476 100%)', borda: '#6ba3cd', faixa: '#396a92' },
  4: { fundo: 'linear-gradient(160deg, #9a6cb8 0%, #5f417a 100%)', borda: '#b389cc', faixa: '#7a539b' },
  5: { fundo: 'linear-gradient(160deg, #c08f43 0%, #8a5f2a 100%)', borda: '#e0b464', faixa: '#a5762f' },
}

export function corDaRaridade(estrelas: number) {
  return CORES_RARIDADE[Math.min(5, Math.max(1, estrelas))]
}

/**
 * Estrelas de raridade. A `categoria` do legado vai de 1 a 9 (é o que a fórmula
 * de bônus permite, já que divide por `10 - categoria`); aqui ela é comprimida
 * na escala de 1 a 5 estrelas, que é como jogador lê raridade.
 */
export function estrelasDaCategoria(categoria: number | undefined): number {
  if (!categoria || categoria < 1) return 1

  return Math.min(5, Math.max(1, Math.ceil((categoria * 5) / 9)))
}

export function Estrelas({ quantidade, tamanho = 9 }: { quantidade: number; tamanho?: number }) {
  return (
    <span className="flex gap-[1px]" aria-label={`Raridade ${quantidade} de 5`}>
      {Array.from({ length: quantidade }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 10 10"
          aria-hidden="true"
          style={{ width: tamanho, height: tamanho }}
          fill="#f3c74d"
          className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
        >
          <path d="M5 0.4 6.3 3.6 9.7 3.8 7.1 6 7.9 9.3 5 7.5 2.1 9.3 2.9 6 0.3 3.8 3.7 3.6Z" />
        </svg>
      ))}
    </span>
  )
}

interface MolduraItemProps {
  img?: number
  formato?: string
  quantidade?: number
  novo?: boolean
  rotulo?: string
  selecionado?: boolean
  pequeno?: boolean
  vazio?: ReactNode
  onClick?: () => void
  /** Estrelas de raridade sob o sprite. Zero esconde a fileira. */
  estrelas?: number
  /** Nível de refino, mostrado como "+N" no canto. */
  upgrade?: number
}

/**
 * Slot de item: sprite do jogo dentro da moldura ornamentada, com a quantidade
 * no canto. É o tijolo do inventário e da ficha de equipamento.
 */
export function MolduraItem({
  img,
  formato = 'png',
  quantidade,
  novo = false,
  rotulo,
  selecionado = false,
  pequeno = false,
  vazio,
  onClick,
  estrelas = 0,
  upgrade = 0,
}: MolduraItemProps) {
  const lado = pequeno ? 'var(--sg-slot-pequeno)' : 'var(--sg-slot)'
  const Tag = onClick ? 'button' : 'div'
  const cor = corDaRaridade(estrelas || 1)

  return (
    <Tag
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={onClick ? selecionado : undefined}
      style={{ width: lado, height: lado }}
      className={`group relative shrink-0 transition-transform ${
        onClick ? 'hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ouro' : ''
      }`}
    >
      {/* Fundo de raridade: a cor é o primeiro sinal, antes mesmo do nome. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg"
        style={{ background: img ? cor.fundo : 'rgba(18,24,36,0.65)' }}
      />

      {/* Brilho suave no topo, que dá o acabamento plástico dos cards do gênero. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 45%)' }}
      />

      {img ? (
        <img
          src={`${ARTE}/Itens/${img}.${formato}`}
          alt=""
          className="absolute inset-x-0 top-[6%] mx-auto max-h-[62%] max-w-[72%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]"
          loading="lazy"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-creme/25">{vazio}</span>
      )}

      {/* Faixa inferior com as estrelas, mais escura que o corpo do card. */}
      {estrelas > 0 && (
        <span className="absolute inset-x-0 bottom-0 flex h-[19px] items-center justify-center rounded-b-lg bg-black/30">
          <Estrelas quantidade={estrelas} tamanho={pequeno ? 6 : 8} />
        </span>
      )}

      {upgrade > 0 && (
        <span className="numero-ficha absolute top-1 left-1 rounded bg-black/45 px-1 text-[0.6rem] text-white">
          +{upgrade}
        </span>
      )}

      {quantidade !== undefined && quantidade > 1 && (
        <span
          className={`numero-ficha absolute right-1 text-[0.7rem] text-white drop-shadow-[0_1px_2px_#000] ${
            estrelas > 0 ? 'bottom-[21px]' : 'bottom-1'
          }`}
        >
          {quantidade}
        </span>
      )}

      {novo && (
        <span
          aria-label="novo"
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-black/40 bg-[#e8504a] shadow-[0_0_6px_#e8504a]"
        />
      )}

      {/* Contorno: sempre presente na cor da raridade, branco quando selecionado. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg border transition-colors"
        style={{
          borderColor: selecionado ? '#ffffff' : cor.borda,
          boxShadow: selecionado ? '0 0 0 2px rgba(255,255,255,0.35), 0 0 18px -2px rgba(255,255,255,0.4)' : 'none',
        }}
      />
    </Tag>
  )
}

/**
 * Nome do arquivo de ícone de um atributo.
 *
 * Quase sempre é a própria sigla da coluna, mas Percepção é a exceção: a coluna
 * se chama `con` e o ícone, `per.png` — é o que nome_atributo_img() devolve em
 * Funcoes/atributos.php. Usar a sigla direto pedia um `con.png` que não existe;
 * pior, "con" é nome de dispositivo reservado no Windows, então nem dava para
 * criar o arquivo para contornar.
 */
export function iconeDoAtributo(sigla: string) {
  const arquivo = sigla === 'con' ? 'per' : sigla

  return `${ARTE}/Icones/${arquivo}.png`
}

/** Ícone de atributo, vindo do acervo do jogo (Icones/atk.png, def.png, …). */
export function IconeAtributo({ sigla, className = 'size-6' }: { sigla: string; className?: string }) {
  return (
    <img
      src={`${ARTE}/Icones/${sigla}.png`}
      alt=""
      aria-hidden="true"
      className={`opacity-80 invert ${className}`}
      loading="lazy"
    />
  )
}

/**
 * Barra de recurso fina com moldura dourada e bisel interno — o formato das
 * barras de HP/XP em jogos, não a barra de progresso arredondada da web.
 */
export function Barra({
  valor,
  maximo,
  rotulo,
  cor = 'var(--color-experiencia)',
  compacta = false,
}: {
  valor: number
  maximo: number
  rotulo: string
  cor?: string
  compacta?: boolean
}) {
  const pct = maximo > 0 ? Math.min(100, Math.max(0, (valor / maximo) * 100)) : 0

  return (
    <div className="flex flex-col gap-1.5">
      {!compacta && (
        <div className="flex items-baseline justify-between text-[0.72rem] tracking-[0.1em] uppercase">
          <span className="text-creme/60">{rotulo}</span>
          <span className="numero-ficha text-creme/90">
            {valor.toLocaleString('pt-BR')}
            <span className="text-creme/40"> / {maximo.toLocaleString('pt-BR')}</span>
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={rotulo}
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={maximo}
        className="h-2 border border-ouro/30 bg-abissal/80 p-px"
      >
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${cor} 70%, white) 0%, ${cor} 55%, color-mix(in srgb, ${cor} 75%, black) 100%)`,
          }}
        />
      </div>
    </div>
  )
}

/**
 * Caminho de um retrato no acervo legado. O padrão vem dos componentes Blade do
 * PHP (Componentes/Personagem/Rosto.blade.php e BigImg.blade.php): o código do
 * sprite vai com 4 dígitos e a skin entre parênteses.
 */
export function retratoDoPersonagem(img: number, skin: number, corpoInteiro = false) {
  const pasta = corpoInteiro ? 'Big' : 'Icons'

  return `${ARTE}/Personagens/${pasta}/${String(img).padStart(4, '0')}(${skin}).jpg`
}

/** Retrato do personagem com moldura dourada, como o card de perfil das referências. */
export function Retrato({
  img,
  skin = 0,
  nome,
  tamanho = 84,
  corpoInteiro = false,
}: {
  img: number
  skin?: number
  nome: string
  tamanho?: number
  corpoInteiro?: boolean
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden border border-ouro/60 bg-gradient-to-b from-painel-claro to-abissal"
      style={{
        width: tamanho,
        height: corpoInteiro ? tamanho * 1.5 : tamanho,
        borderRadius: 'var(--sg-raio)',
      }}
    >
      <img
        src={retratoDoPersonagem(img, skin, corpoInteiro)}
        alt={nome}
        className="size-full object-cover"
        loading="lazy"
        onError={(e) => {
          // Nem toda combinação de sprite e skin existe no acervo: some em vez de
          // mostrar o ícone de imagem quebrada.
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_14px_rgba(0,0,0,0.65)]"
      />
    </div>
  )
}
