/**
 * Controle da batalha na tela (protótipo de teste — vez da tripulação).
 *
 * Preparação: escolhe a Akuma no Mi e o Haki de cada personagem.
 * Sua vez: toque num pirata → casas azuis andam (gasta os 5 movimentos da
 * tripulação); escolha uma skill no painel → casas vermelhas são alvos
 * válidos; toque num alvo para ver a área e toque de novo para atacar —
 * o ataque gasta a energia, põe a skill em recarga e encerra a vez. Liga o Haki de armamento / do Rei no painel.
 * Vez da Marinha: a IA joga, uma ação de cada vez, animada.
 *
 * Não desenha nada sozinho: pede ao `Palco` (a cena).
 */

import * as THREE from 'three'
import { mesmaCasa, type Casa } from '../tabuleiro'
import type { Personagem } from '../cena/personagem'
import { recurso } from '../cena/visualFolhas'
import type { Paleta, TipoEfeito } from '../cena/efeitos'
import { direcaoEfeito, type DirEfeito } from '../cena/efeitoFolha'
import { FRUTAS, alvoValido, casasDaArea, distancia, type Skill, type TipoArma } from './armas'

/** skill usada em si mesmo (sem mirar): buff, em volta, mapa inteiro */
const semMira = (s: Skill) => s.area === 'si' || s.area === 'volta' || s.area === 'mapa'
import { TRIPULACOES, aplicarConfig, combatentesIniciais, configPadrao, type Config } from './elenco'
import { proximaAcao } from './ia'
import {
  HAOSHOKU,
  REI_IMBUIDO,
  hakiPreparacao,
  tempoDaVez,
  aplicar,
  criarBatalha,
  motivo,
  movimentos,
  porId,
  skillsDe,
  vivos,
  type Acao,
  type Combatente,
  type Estado,
  type Evento,
  type Lado,
} from './regras'

export type Marca = 'mover' | 'alcance' | 'alvo' | 'cura' | 'destino' | 'area'

/** Light Kick em andamento: cada etapa toca um efeito do Effekseer */
export type LightKick = {
  /** rastro de luz indo até `para` (acompanha o personagem) */
  avancar(para: THREE.Vector3): void
  /** fim do avanço: o rastro some */
  parar(): void
  /** arco da varredura da perna, virado para o alvo */
  arco(alvo: THREE.Vector3): void
  /** clarão no ponto do contato */
  impacto(onde: THREE.Vector3): void
  /** apaga a luz do pé */
  apagar(): void
}

export interface Palco {
  personagem(id: string): Personagem | undefined
  marcar(c: Casa, tipo: Marca): void
  limparMarcas(): void
  flutuar(p: Personagem, texto: string, cor: string, linha?: number): void
  sumir(p: Personagem): void
  /** efeito visual; resolve quando termina (ou o projétil chega) */
  efeito(tipo: TipoEfeito, paleta: Paleta, de: THREE.Vector3, op?: { para?: THREE.Vector3; dur?: number; escala?: number; alongar?: number; direcao?: THREE.Vector3 }): Promise<void>
  /** ponto do peito do personagem / centro da casa (mundo) */
  peito(p: Personagem): THREE.Vector3
  centro(c: Casa): THREE.Vector3
  hakiDoRei(p: Personagem): void
  tremer(s: number): void
  /** esquiva da observação: passo de lado com rastro */
  esquivar(p: Personagem, de: Personagem): Promise<void>
  /** Logia: o golpe atravessa (corpo vira elemento e volta) */
  atravessar(p: Personagem, elemento: string): Promise<void>
  /** aproxima a câmera nesses pontos (null volta ao que era) */
  focar(pontos: THREE.Vector3[] | null): void
  /** choque de dois Haki do Rei: explosão de raios negros e vermelhos */
  choqueRei(ponto: THREE.Vector3): void
  /** efeito desenhado à mão (spritesheet); resolve false se a folha não existe */
  efeitoFolha(nome: string, dir: DirEfeito, de: THREE.Vector3, op?: { para?: THREE.Vector3; largura?: number; voo?: [number, number]; aoChegar?: () => void; chao?: boolean; escala?: number; aoQuadro?: [number, () => void] }): Promise<boolean>
  /** Entei em fases (cena longa); resolve no impacto, a explosão continua sozinha */
  entei(p: Personagem, ate: THREE.Vector3, k: number): Promise<void>
  /**
   * Light Kick do Effekseer: luz no pé, rastro no avanço, arco na varredura e
   * clarão no contato; null sem o efeito
   */
  lightKick(p: Personagem): Promise<LightKick | null>
  /** Arma de Luz no atirador: rajada de joias de luz até o alvo; false sem os efeitos */
  rajadaLuz(p: Personagem, ate: THREE.Vector3, tiros: number): Promise<boolean>
  /**
   * Yasakani no Magatama do Effekseer: carga de luz em cada mão (braços
   * cruzados) e rajada de bolas de luz até os pontos; resolve quando metade
   * acerta, false sem o efeito
   */
  yasakani(p: Personagem, pontos: THREE.Vector3[]): Promise<boolean>
  /** Hotarubi do Effekseer: bolinhas voam até o alvo e detonam (Hidaruma); resolve na detonação, false sem o efeito */
  hotarubi(p: Personagem, ate: THREE.Vector3): Promise<boolean>
  /** corte básico de espada do Effekseer; resolve no golpe, false sem o efeito */
  corte(p: Personagem, ate: THREE.Vector3): Promise<boolean>
  /** Ice Time do Effekseer (contato + cristais no alvo); resolve no golpe, false sem o efeito */
  iceTime(p: Personagem, alvo: Personagem | null, ate: THREE.Vector3): Promise<boolean>
  /** Partisan do Effekseer: formação de lanças e disparo até o alvo; resolve quando metade acerta, false sem o efeito */
  partisan(p: Personagem, ate: THREE.Vector3): Promise<boolean>
  /** Pheasant Beak do Effekseer: a ave voa até o alvo e explode; resolve no impacto, false sem o efeito */
  pheasant(p: Personagem, ate: THREE.Vector3): Promise<boolean>
  /** Ice Age do Effekseer em volta de quem lança; resolve quando a expansão alcança longe (~0,8 s), false sem o efeito */
  iceAge(p: Personagem): Promise<boolean>
  /** Hiken do Effekseer: o punho de fogo vai até o alvo e explode; resolve no impacto, false sem o efeito */
  hiken(p: Personagem, ate: THREE.Vector3): Promise<boolean>
  /** Higan do Effekseer: rajada de balas do dedo até o alvo; resolve quando metade acerta, false sem o efeito */
  higan(p: Personagem, ate: THREE.Vector3): Promise<boolean>
  /** desliza o personagem até um ponto (null = volta ao lugar) */
  deslizar(p: Personagem, para: THREE.Vector3 | null, dur: number): Promise<void>
  /** congelou: o gelo do Ice Time cresce em volta do personagem (Effekseer) */
  congelar(p: Personagem): void
  /** choque de Haki do Rei desenhado na tela inteira (raios, anéis, clarão) */
  choqueTela(ponto: THREE.Vector3): void
  /** quadro de impacto do anime: a tela pisca (negro/vermelho ou branco) */
  lampejo(tipo: 'rei' | 'branco', dur: number): void
  avisar(): void
}

const JOGADOR: Lado = 'piratas'

/** Como cada skill aparece: animação do corpo e efeito. */
type Visual = { efeito: TipoEfeito; modo: 'perto' | 'projetil' | 'area' | 'si' | 'especial'; escala?: number; tiros?: number }
const VISUAL: Record<string, Visual> = {
  corte: { efeito: 'impacto', modo: 'especial' },
  'corte-duplo': { efeito: 'impacto', modo: 'perto' },
  'corte-voador': { efeito: 'corte', modo: 'projetil', escala: 1.1 },
  'estocada-perfurante': { efeito: 'impacto', modo: 'area' },
  'tornado-laminas': { efeito: 'tornado', modo: 'si', escala: 2.6 },
  pancada: { efeito: 'impacto', modo: 'perto' },
  esmagar: { efeito: 'impacto', modo: 'perto', escala: 1.3 },
  'onda-choque': { efeito: 'onda', modo: 'si', escala: 3.2 },
  tremor: { efeito: 'onda', modo: 'area' },
  'martelada-titanica': { efeito: 'impacto', modo: 'perto', escala: 1.8 },
  tiro: { efeito: 'bala', modo: 'projetil', escala: 0.6 },
  'tiro-certeiro': { efeito: 'bala', modo: 'projetil', escala: 0.8 },
  'chumbo-grosso': { efeito: 'bala', modo: 'projetil', escala: 0.5, tiros: 3 },
  rajada: { efeito: 'bala', modo: 'projetil', escala: 0.55, tiros: 3 },
  'tiro-perfurante': { efeito: 'bala', modo: 'projetil', escala: 0.9 },
  estocada: { efeito: 'impacto', modo: 'perto', escala: 0.8 },
  'corte-rapido': { efeito: 'impacto', modo: 'perto', escala: 0.8 },
  arremesso: { efeito: 'adaga', modo: 'projetil', escala: 0.6 },
  'golpe-vital': { efeito: 'impacto', modo: 'perto' },
  'danca-laminas': { efeito: 'tornado', modo: 'si', escala: 2.4 },
  'primeiros-socorros': { efeito: 'aura', modo: 'area', escala: 1.2 },
  'nuvem-fumaca': { efeito: 'fumaca', modo: 'area', escala: 1.2 },
  'prisao-fumaca': { efeito: 'fumaca', modo: 'area', escala: 1.3 },
  // Mera Mera (Ace)
  hiken: { efeito: 'explosaoFogo', modo: 'especial', escala: 1.2 },
  hotarubi: { efeito: 'explosaoFogo', modo: 'especial', escala: 1 },
  higan: { efeito: 'chama', modo: 'especial', escala: 1 },
  'pheasant-beak': { efeito: 'gelo', modo: 'especial', escala: 1 },
  entei: { efeito: 'explosaoFogo', modo: 'especial', escala: 1.6 },
  // Pika Pika (Kizaru)
  'sabre-luz': { efeito: 'orbeLuz', modo: 'si', escala: 1.4 },
  yasakani: { efeito: 'orbeLuz', modo: 'especial', escala: 0.5 },
  'chute-luz': { efeito: 'feixeLuz', modo: 'especial', escala: 1 },
  'raio-luz': { efeito: 'feixeLuz', modo: 'especial', escala: 0.8 },
  // Hie Hie (Aokiji)
  'lanca-gelo': { efeito: 'espinhoGelo', modo: 'especial', escala: 1.4 },
  'ice-saber': { efeito: 'corte', modo: 'perto', escala: 1.2 },
  'ice-time': { efeito: 'espinhoGelo', modo: 'especial', escala: 1.6 },
  'era-gelo': { efeito: 'espinhoGelo', modo: 'especial', escala: 1.6 },
  // Gomu Gomu (Luffy)
  pistola: { efeito: 'punho', modo: 'projetil', escala: 0.9 },
  gatling: { efeito: 'punho', modo: 'especial', escala: 0.7 },
  'gear-second': { efeito: 'vapor', modo: 'si', escala: 2 },
  'forma-hibrida': { efeito: 'poeira', modo: 'si', escala: 2 },
  'forma-lobisomem': { efeito: 'poeira', modo: 'si', escala: 2 },
  'corpo-chamas': { efeito: 'fogo', modo: 'si', escala: 2 },
  garras: { efeito: 'impacto', modo: 'perto' },
  uivo: { efeito: 'poeira', modo: 'si', escala: 2.4 },
}
/** tamanho dos efeitos de Akuma no Mi (os desenhados por código) */
const ESCALA_FRUTA = 1
const ESCALA_ULTIMATE = 1.3
/** poderes máximos de cada fruta */
const ULTIMATES = new Set(['entei', 'era-gelo', 'yasakani', 'prisao-fumaca'])
/** segundos de preparação (ligar o Haki) antes da batalha */
const PREPARO = 10
/** aparência de cada transformação/buff */
const FORMAS: Record<string, 'zoan' | 'gear' | 'sabre' | 'lobo' | 'agni'> = { bisao: 'zoan', borracha: 'gear', luz: 'sabre', lobo: 'lobo', fogo: 'agni' }
/**
 * Efeitos desenhados (folhas do Ragnarok, só teste) por skill: onde tocam —
 * em quem usa ('si'), no alvo ('alvo') ou em cada casa atingida ('casas');
 * `chao`: preso no chão (senão na altura do peito).
 */
type FxFolha = { folha: string; onde: 'si' | 'alvo' | 'casas'; chao?: boolean; largura?: number }
const FOLHA_SKILL: Record<string, FxFolha[]> = {
  'corte-duplo': [{ folha: 'corte-arco', onde: 'alvo' }],
  'estocada-perfurante': [{ folha: 'corte-arco', onde: 'casas' }],
  garras: [{ folha: 'garra', onde: 'alvo', largura: 1.1 }],
  esmagar: [{ folha: 'explosao-terra', onde: 'alvo', chao: true }],
  'martelada-titanica': [{ folha: 'explosao-terra', onde: 'alvo', chao: true, largura: 2.2 }, { folha: 'tremor', onde: 'alvo', chao: true }],
  'onda-choque': [{ folha: 'tremor', onde: 'si', chao: true, largura: 3 }, { folha: 'anel-poeira', onde: 'si', chao: true, largura: 3.2 }],
  tremor: [{ folha: 'tremor', onde: 'casas', chao: true, largura: 1.6 }],
  uivo: [{ folha: 'anel-poeira', onde: 'si', chao: true, largura: 3.2 }, { folha: 'tremor', onde: 'si', chao: true, largura: 2.6 }],
  'nuvem-fumaca': [{ folha: 'nuvem-veneno', onde: 'casas', largura: 1.5 }],
  'prisao-fumaca': [{ folha: 'nuvem-veneno', onde: 'casas', largura: 1.7 }],
  'lanca-gelo': [{ folha: 'estrela-gelo', onde: 'alvo' }],
  'ice-saber': [{ folha: 'estrela-gelo', onde: 'alvo' }],
  'ice-time': [{ folha: 'estrela-gelo', onde: 'alvo', largura: 1.3 }],
  'corpo-chamas': [{ folha: 'pilar-fogo', onde: 'si', chao: true, largura: 1.8 }],
  'forma-lobisomem': [{ folha: 'anel-poeira', onde: 'si', chao: true, largura: 2.6 }],
}
/** Efeitos de fruta não mudam de cor com o Haki; os de arma sim. */
const ELEMENTAIS = new Set<TipoEfeito>(['fogo', 'luz', 'gelo', 'fumaca', 'aura', 'chama', 'bolaFogo', 'explosaoFogo', 'pilarFogo', 'vagalume', 'orbeLuz', 'feixeLuz', 'sabreLuz', 'espinhoGelo', 'vapor', 'poeira'])

// ------------------------------------------------------------ preparação
// ------------------------------------------------------------ HUD
export type SkillHud = { id: string; nome: string; descricao: string; energia: number; recarga: number; espera: number; alcance: number; area: string; raio: number; livre: boolean; motivo: string | null; fruta: boolean }
export type RetratoBatalha = {
  fase: 'preparar' | 'haki' | 'minha' | 'inimiga' | 'fim'
  /** segundos que faltam da preparação de Haki */
  tempoHaki: number
  animando: boolean
  auto: boolean
  /** modo treino: um pirata e um boneco alvo, para testar skills e sprites */
  treino: { fruta: string; arma: TipoArma; alvoFruta: string; armamento: 0 | 1 | 2; rei: boolean } | null
  config: (Config & { nome: string; lado: Lado })[]
  turno: number
  vez: Lado
  tempoMax: number
  movimento: number
  tempo: number
  vencedor: Lado | null
  tripulacao: FichaHud[]
  inimigos: FichaHud[]
  selecionado: (FichaHud & { skills: SkillHud[]; skill: string | null; previa: boolean; usarArmamento: boolean; usarRei: boolean; podeArmamento: boolean; podeRei: boolean; podeHaoshoku: boolean }) | null
  log: { t: number; texto: string }[]
  dica: string
}
export type HakiHud = { usos: number; max: number; avancado: boolean; ligado: boolean }
export type FichaHud = {
  id: string
  nome: string
  lado: Lado
  /** imagem parada (virada para a frente), para o retrato */
  retrato: string
  hp: number
  hpMax: number
  energia: number
  espirito: number
  fruta: { nome: string; tipo: string } | null
  logia: { cargas: number; max: number } | null
  armamento: HakiHud | null
  observacao: HakiHud | null
  /** tem Haki do Rei (ligado = imbuído no armamento) */
  rei: { ligado: boolean } | null
  overall: number
  atordoado: boolean
  queimando: boolean
  transformado: number
  /** dá para ligar o Rei imbuído / soltar o Haki do Rei em área agora */
  podeRei: boolean
  podeHaoshoku: boolean
}

export class ControleBatalha {
  private estado: Estado
  private config: Config[] = configPadrao()
  private fase: RetratoBatalha['fase'] = 'preparar'
  private animando = false
  private sel: string | null = null
  private skill: string | null = null
  private previa: Casa | null = null
  private mov: ReturnType<typeof movimentos> | null = null
  private dica = ''
  private log: { t: number; texto: string }[] = []
  private inicioBatalha = 0
  private fimPreparo = 0
  private inicioVez = 0
  private relogio = 0
  private readonly palco: Palco

  constructor(palco: Palco) {
    this.palco = palco
    this.estado = criarBatalha(combatentesIniciais())
    this.relogio = window.setInterval(() => this.checarTempo(), 500)
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('treino')) this.treino = { fruta: 'fogo', arma: 'espada', alvoFruta: '', armamento: 0, rei: false }
  }

  // ------------------------------------------------------------ treino
  /** modo treino (?treino na URL): um pirata contra um boneco alvo que não morre */
  private treino: { fruta: string; arma: TipoArma; alvoFruta: string; armamento: 0 | 1 | 2; rei: boolean } | null = null
  static readonly TREINO_JOGADOR = 'pirata-capitao'
  static readonly TREINO_ALVO = 'marinha-soldado'

  /**
   * Botão Treino: entra no treino na mesma página (mudar a URL e recarregar
   * não funciona quando o jogo roda dentro de outra página, como no celular)
   */
  entrarTreino() {
    if (this.animando) return
    this.treino = { fruta: 'fogo', arma: 'espada', alvoFruta: '', armamento: 0, rei: false }
    this.comecarTreino()
    this.palco.avisar()
  }

  /** Sai do treino: recarrega a página (sem o ?treino) e volta à batalha */
  sairTreino() {
    try {
      if (location.search) history.replaceState(null, '', location.pathname + location.hash)
    } catch {
      /* sem histórico: só recarrega */
    }
    location.reload()
  }

  /** Começa o treino: some com os outros, arruma o pirata e o boneco. */
  comecarTreino() {
    if (!this.treino) return
    const J = ControleBatalha.TREINO_JOGADOR
    const A = ControleBatalha.TREINO_ALVO
    const cs = combatentesIniciais().filter((c) => c.id === J || c.id === A)
    const alvo = cs.find((c) => c.id === A)!
    alvo.nome = 'Boneco alvo'
    alvo.casa = { l: 6, c: 9 }
    alvo.at = { ...alvo.at, agl: 0 } // não esquiva: dá para ver todo golpe
    for (const p of TRIPULACOES) if (p.id !== J && p.id !== A) {
      const per = this.palco.personagem(p.id)
      if (per) this.palco.sumir(per)
    }
    const pa = this.palco.personagem(A)
    if (pa) {
      ;(pa as { nome: string }).nome = 'Boneco alvo'
      pa.casa = { ...alvo.casa }
      const cc = this.palco.centro(alvo.casa)
      pa.pos.set(cc.x, 0, cc.z)
    }
    this.estado = criarBatalha(cs)
    this.estado.vez = JOGADOR
    this.inicioBatalha = performance.now()
    this.log = []
    this.aplicarTreino()
    this.registrar('Treino: escolha fruta e arma no painel; o boneco não morre.')
    this.novaVez()
  }

  /** Muda a fruta/arma/Haki no treino (a qualquer momento). */
  mudarTreino(campo: 'fruta' | 'arma' | 'alvoFruta' | 'armamento' | 'rei', valor: string | number | boolean) {
    if (!this.treino || this.animando) return
    ;(this.treino as Record<string, unknown>)[campo] = valor
    this.aplicarTreino()
    this.skill = null
    this.previa = null
    this.redesenhar()
  }

  /** Recarrega tudo: vida do boneco, energia, espírito, recargas, Haki. */
  private aplicarTreino() {
    const t = this.treino
    if (!t) return
    const e = this.estado
    e.vez = JOGADOR
    e.vencedor = null
    e.movimento = 6
    for (const c of e.combatentes) {
      const jogador = c.lado === JOGADOR
      const fruta = jogador ? t.fruta : t.alvoFruta
      if ((c.akuma?.fruta ?? '') !== fruta) c.akuma = fruta ? { fruta, transformado: 0 } : null
      c.logia = fruta && FRUTAS[fruta].tipo === 'logia' ? { cargas: 99, max: 99 } : null
      c.hp = c.hpMax
      c.energia = 100
      c.espirito = 100
      c.recargas = {}
      c.atordoado = false
      c.queimadura = null
      if (jogador) {
        c.arma = t.arma
        c.haki = {
          overall: 80,
          armamento: t.armamento ? { usos: 9, max: 9, avancado: t.armamento === 2 } : null,
          observacao: null,
          rei: t.rei,
        }
        if (!t.armamento) c.armamentoLigado = c.reiLigado = false
        if (!t.rei || t.armamento !== 2) c.reiLigado = false
      } else c.haki = { overall: 0, armamento: null, observacao: null, rei: false }
      const p = this.palco.personagem(c.id)
      if (p) {
        p.vida = c.hp
        p.haki = c.reiLigado ? 'rei' : c.armamentoLigado ? 'armamento' : false
        p.forma = c.akuma?.transformado ? (FORMAS[c.akuma.fruta] ?? null) : null
      }
    }
    this.palco.avisar()
  }

  get combatentes() {
    return this.estado.combatentes
  }

  destruir() {
    clearInterval(this.relogio)
  }

  // ------------------------------------------------------------ preparação
  mudarConfig(id: string, campo: 'akuma' | 'armamento' | 'observacao' | 'rei' | 'overall', valor: string | number | boolean) {
    const k = this.config.find((x) => x.id === id)
    if (!k || this.fase !== 'preparar') return
    ;(k as Record<string, unknown>)[campo] = valor
    this.palco.avisar()
  }

  /** Sorteia Akuma no Mi e Haki de todo mundo (para testar combinações). */
  aleatorizar() {
    if (this.fase !== 'preparar') return
    const frutas = Object.keys(FRUTAS)
    const r = Math.random
    for (const k of this.config) {
      k.akuma = r() < 0.45 ? frutas[Math.floor(r() * frutas.length)] : ''
      k.armamento = Math.floor(r() * 3) as 0 | 1 | 2
      k.observacao = Math.floor(r() * 3) as 0 | 1 | 2
      k.rei = r() < 0.25
      const base = k.armamento || k.observacao || k.rei ? 20 + k.armamento * 12 + k.observacao * 10 + (k.rei ? 20 : 0) : 0
      k.overall = base ? Math.max(5, Math.min(100, Math.round((base + (r() - 0.5) * 20) / 5) * 5)) : 0
    }
    this.palco.avisar()
  }

  /** Volta ao elenco de teste. */
  restaurarConfig() {
    if (this.fase !== 'preparar') return
    this.config = configPadrao()
    this.palco.avisar()
  }

  /** Começa a preparação: 10 s para ligar (ou não) o Haki de cada um. */
  comecar() {
    this.estado = criarBatalha(aplicarConfig(combatentesIniciais(), this.config))
    this.inicioBatalha = performance.now()
    this.log = []
    this.registrar('Preparação: liguem o Haki (10 s).')
    this.fase = 'haki'
    this.fimPreparo = performance.now() + PREPARO * 1000
    // a Marinha (IA) liga o que tem
    for (const c of this.estado.combatentes.filter((x) => x.lado !== JOGADOR)) {
      if (c.haki.armamento) this.estado = hakiPreparacao(this.estado, c.id, 'armamento', true)
      if (c.haki.observacao) this.estado = hakiPreparacao(this.estado, c.id, 'observacao', true)
    }
    this.sincronizar()
    this.dica = 'Preparação: ligue o Haki de cada pirata (ou não) antes da batalha.'
    this.palco.avisar()
  }

  /** Fim da preparação: a batalha começa de verdade. */
  pronto() {
    if (this.fase !== 'haki') return
    this.registrar(`Batalha começa: ${this.estado.vez === JOGADOR ? 'os piratas' : 'a Marinha'} (mais ágil) começa.`)
    this.novaVez()
  }

  /** Haki e forma de cada personagem na cena, pelo estado. */
  private sincronizar() {
    for (const c of this.estado.combatentes) {
      const p = this.palco.personagem(c.id)
      if (!p) continue
      p.haki = c.reiLigado ? 'rei' : c.armamentoLigado ? 'armamento' : false
      p.forma = c.akuma?.transformado ? (FORMAS[c.akuma.fruta] ?? null) : null
    }
  }

  private alternarPreparo(id: string | undefined, tipo: 'armamento' | 'rei' | 'observacao') {
    const c = id ? porId(this.estado, id) : null
    if (!c || c.lado !== JOGADOR) return
    const ligado = tipo === 'armamento' ? c.armamentoLigado : tipo === 'rei' ? c.reiLigado : c.observando
    this.estado = hakiPreparacao(this.estado, c.id, tipo, !ligado)
    this.sincronizar()
    const p = this.palco.personagem(c.id)
    if (p && !ligado) this.palco.flutuar(p, tipo === 'armamento' ? 'Busoshoku!' : tipo === 'rei' ? 'Haki do Rei!' : 'Kenbunshoku!', tipo === 'armamento' ? '#c890ff' : tipo === 'rei' ? '#ff5a6a' : '#9fe0ff', 1)
    this.palco.avisar()
  }

  novaBatalha() {
    location.reload()
  }

  // ------------------------------------------------------------ vez
  private novaVez() {
    this.inicioVez = performance.now()
    this.sel = null
    this.skill = null
    this.previa = null
    if (this.estado.vencedor) {
      this.fase = 'fim'
      this.redesenhar()
      return
    }
    this.fase = this.estado.vez === JOGADOR ? 'minha' : 'inimiga'
    this.dica = this.fase === 'minha' ? 'Sua vez: toque num pirata.' : 'Vez da Marinha…'
    this.redesenhar()
    if (this.fase === 'inimiga' || this.auto) void this.jogarIA()
  }

  /** a IA joga pelos piratas também (para assistir e testar) */
  auto = false
  alternarAuto() {
    this.auto = !this.auto
    if (this.auto && this.fase === 'minha' && !this.animando) void this.jogarIA()
    this.palco.avisar()
  }

  private async jogarIA() {
    await new Promise((r) => setTimeout(r, 700))
    let guarda = 0
    const lado = this.estado.vez
    while (this.estado.vez === lado && (lado !== JOGADOR || this.auto) && !this.estado.vencedor && guarda++ < 80) {
      const a = proximaAcao(this.estado)
      const ok = await this.executar(a)
      if (!ok) await this.executar({ t: 'passar' })
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  private checarTempo() {
    if (this.fase === 'haki') {
      if (performance.now() >= this.fimPreparo) this.pronto()
      else this.palco.avisar()
      return
    }
    if (this.fase !== 'minha' || this.animando || this.auto || this.treino) return
    if (this.tempo() <= 0) void this.executar({ t: 'tempo' })
    else this.palco.avisar()
  }

  private tempo() {
    return Math.max(0, Math.ceil(tempoDaVez(this.estado) - (performance.now() - this.inicioVez) / 1000))
  }

  /** Aplica uma ação e anima. Devolve se deu certo. */
  /** de onde veio o "perde a vez" de cada um (o estado só guarda atordoado) */
  private readonly tipoStatus = new Map<string, 'stun' | 'gelo'>()

  private async executar(a: Acao) {
    const r = aplicar(this.estado, a)
    if ('erro' in r) {
      this.dica = r.erro
      this.palco.avisar()
      return false
    }
    const vezAntes = this.estado.vez
    this.animando = true
    this.palco.limparMarcas()
    this.palco.avisar()
    await this.animar(this.estado, r.eventos)
    this.estado = r.estado
    for (const c of this.estado.combatentes) {
      const p = this.palco.personagem(c.id)
      if (!p) continue
      p.vida = c.hp
      // o Haki ligado fica aparecendo na arma
      p.haki = c.reiLigado ? 'rei' : c.armamentoLigado ? 'armamento' : false
      p.forma = c.akuma?.transformado ? (FORMAS[c.akuma.fruta] ?? null) : null
      // estrelinhas (atordoado) ou cristais (congelado) até a vez dele acabar
      p.status = c.atordoado && c.hp > 0 ? (this.tipoStatus.get(c.id) ?? 'stun') : null
    }
    this.animando = false
    if (this.treino) {
      // treino: nunca passa a vez; tudo volta ao cheio
      this.aplicarTreino()
      this.previa = null
      this.skill = null
      this.fase = 'minha'
      this.inicioVez = performance.now()
      this.redesenhar()
      return true
    }
    if (this.estado.vez !== vezAntes || this.estado.vencedor) this.novaVez()
    else {
      // continua com o mesmo personagem escolhido
      this.previa = null
      if (a.t === 'skill') this.skill = null
      if (this.sel && (porId(this.estado, this.sel)?.hp ?? 0) <= 0) this.sel = null
      this.redesenhar()
    }
    return true
  }

  // ------------------------------------------------------------ toques
  /** mouse (passa por cima mostra a área; um clique ataca) ou toque (dois toques) */
  private readonly umClique = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches

  /** Skill em uso: a escolhida no painel ou o golpe básico da arma. */
  private efetiva(c: Combatente): Skill | undefined {
    const ss = skillsDe(c)
    return (this.skill ? ss.find((x) => x.id === this.skill) : undefined) ?? ss.find((x) => x.energia === 0 && !x.cura && x.area === 'alvo')
  }

  private acaoEm(c: Combatente, s: Skill, casa: Casa): Acao {
    return { t: 'skill', id: c.id, skill: s.id, alvo: casa }
  }

  /** Mouse passando por cima: mostra a área do golpe naquela casa. */
  sobre(casa: Casa | null) {
    if (this.fase !== 'minha' || this.animando || !this.sel) return
    const c = porId(this.estado, this.sel)!
    const s = this.efetiva(c)
    if (!s || semMira(s)) return
    const nova = casa && !motivo(this.estado, this.acaoEm(c, s, casa)) ? casa : null
    if ((nova && this.previa && mesmaCasa(nova, this.previa)) || (!nova && !this.previa)) return
    this.previa = nova
    this.redesenhar()
  }

  clique(alvo: { casa: Casa; personagem: Personagem | null } | null) {
    if (this.fase !== 'minha' || this.animando) {
      if (alvo?.personagem) this.inspecionar(alvo.personagem.id)
      return
    }
    if (!alvo) return this.selecionar(null)
    const sel = this.sel ? porId(this.estado, this.sel) : null
    const quem = alvo.personagem ? porId(this.estado, alvo.personagem.id) : null
    const casa = quem ? quem.casa : alvo.casa
    if (!sel) {
      if (quem && quem.hp > 0 && quem.lado === JOGADOR) return this.selecionar(quem.id)
      if (quem) this.inspecionar(quem.id)
      return
    }
    const s = this.efetiva(sel)
    const acao = s ? this.acaoEm(sel, s, casa) : null
    const erro = acao ? motivo(this.estado, acao) : 'Sem skill.'
    // pode atacar/curar ali: ataca (mouse) ou mostra a área e confirma (toque)
    if (acao && !erro) {
      if (this.umClique || (this.previa && mesmaCasa(this.previa, casa)) || semMira(s!)) return void this.executar(acao)
      this.previa = casa
      this.dica = `Toque de novo no alvo (ou em Atacar) para usar ${s!.nome}.`
      return this.redesenhar()
    }
    // outro pirata: troca a seleção
    if (quem && quem.lado === JOGADOR && quem.hp > 0) return this.selecionar(quem.id === sel.id ? null : quem.id)
    // casa livre ao alcance do movimento: anda
    const cam = !quem ? this.mov?.caminho(casa) : null
    if (cam) return void this.executar({ t: 'mover', id: sel.id, caminho: cam })
    // inimigo que não dá para atacar: diz por quê em cima dele
    if (quem && quem.hp > 0) {
      const p = this.palco.personagem(quem.id)
      const d = distancia(sel.casa, quem.casa)
      const txt = erro === 'Fora de alcance.' ? `Fora de alcance (${d} > ${s?.alcance})` : (erro ?? '')
      if (p) this.palco.flutuar(p, txt, '#ff8a7a', 1)
      this.dica = `${s?.nome ?? ''}: ${txt}. Aproxime-se (casas azuis) ou escolha outra skill.`
      return this.palco.avisar()
    }
    this.previa = null
    this.dica = erro === 'Fora de alcance.' || !erro ? 'Casa fora do movimento e do alcance.' : erro
    this.redesenhar()
  }

  private inspecionar(id: string) {
    const c = porId(this.estado, id)
    if (!c) return
    this.dica = `${c.nome}: ${c.hp}/${c.hpMax} de vida, energia ${c.energia}, espírito ${c.espirito}${c.akuma ? `, ${FRUTAS[c.akuma.fruta].nome}` : ''}.`
    this.palco.avisar()
  }

  selecionar(id: string | null) {
    // atordoado (Haki do Rei, gelo): não dá para escolher nesta vez
    const atordoado = id ? porId(this.estado, id) : null
    if (atordoado?.atordoado) {
      this.dica = `${atordoado.nome} está atordoado e não age nesta vez.`
      const p = this.palco.personagem(atordoado.id)
      if (p) this.palco.flutuar(p, 'Atordoado!', '#ff5a6e', 1)
      id = null
    }
    this.sel = id
    this.skill = null
    this.previa = null
    if (id) {
      const c = porId(this.estado, id)!
      this.dica = `${c.nome}: casas azuis andam; inimigo marcado em vermelho dá para atacar (${this.umClique ? 'clique nele' : 'toque nele'}).`
    } else if (!atordoado?.atordoado) this.dica = this.fase === 'minha' ? 'Sua vez: toque num pirata.' : ''
    this.redesenhar()
  }

  escolherSkill(id: string | null) {
    if (!this.sel) return
    const c = porId(this.estado, this.sel)!
    this.skill = this.skill === id ? null : id
    this.previa = null
    const s = this.efetiva(c)
    if (s && (semMira(s))) this.previa = c.casa
    this.dica = !s
      ? ''
      : semMira(s)
        ? 'Toque no personagem ou em Atacar para usar.'
        : s.area === 'alvo'
          ? 'Inimigo marcado em vermelho forte = dá para acertar.'
          : 'Mire numa casa vermelha: a área em laranja mostra quem é atingido.'
    this.redesenhar()
  }

  /** Liga/desliga o Haki de armamento (não gasta a vez; cada ataque ligado gasta 1 uso). */
  alternarArmamento(id?: string) {
    if (this.fase === 'minha' && (this.animando || this.auto)) return
    if (this.fase === 'haki') return this.alternarPreparo(id ?? this.sel ?? undefined, 'armamento')
    const c = (id ?? this.sel) ? porId(this.estado, (id ?? this.sel)!) : null
    if (c) void this.executar({ t: 'haki', id: c.id, tipo: 'armamento', ligado: !c.armamentoLigado })
  }

  /** Liga/desliga o Haki do Rei imbuído (liga o armamento junto; cada ataque gasta espírito). */
  alternarRei(id?: string) {
    if (this.fase === 'minha' && (this.animando || this.auto)) return
    if (this.fase === 'haki') return this.alternarPreparo(id ?? this.sel ?? undefined, 'rei')
    const c = (id ?? this.sel) ? porId(this.estado, (id ?? this.sel)!) : null
    if (c) void this.executar({ t: 'haki', id: c.id, tipo: 'rei', ligado: !c.reiLigado })
  }

  observar(id?: string) {
    if (this.fase === 'minha' && (this.animando || this.auto)) return
    if (this.fase === 'haki') return this.alternarPreparo(id ?? this.sel ?? undefined, 'observacao')
    const alvo = id ?? this.sel
    if (!alvo) return
    const c = porId(this.estado, alvo)!
    void this.executar({ t: 'observar', id: c.id, ligado: !c.observando })
  }

  haoshoku(id?: string) {
    const quem = id ?? this.sel
    if (quem && this.fase === 'minha' && !this.animando) void this.executar({ t: 'haoshoku', id: quem })
  }

  usarPrevia() {
    if (this.previa) void this.usar(this.previa)
  }

  passar() {
    if (this.fase === 'minha' && !this.animando) void this.executar({ t: 'passar' })
  }

  private async usar(alvo: Casa) {
    const c = this.sel ? porId(this.estado, this.sel) : null
    const s = c && this.efetiva(c)
    if (c && s) await this.executar(this.acaoEm(c, s, alvo))
  }

  private redesenhar() {
    this.palco.limparMarcas()
    this.mov = null
    const sel = this.sel ? porId(this.estado, this.sel) : null
    if (sel && this.fase === 'minha' && !sel.atordoado) {
      const s = this.efetiva(sel)
      // skill de área escolhida: só a mira (clicar numa casa livre não anda)
      const soMira = !!this.skill && !!s && s.area !== 'alvo'
      if (!soMira && this.estado.movimento > 0) {
        this.mov = movimentos(this.estado, sel)
        for (const c of this.mov.casas) this.palco.marcar(c, 'mover')
      }
      if (s) {
        const mira = semMira(s)
        if (!mira)
          for (let l = 0; l < 10; l++)
            for (let c = 0; c < 20; c++) {
              const casa = { l, c }
              if (alvoValido(s, sel.casa, casa)) this.palco.marcar(casa, 'alcance')
            }
        // quem dá para acertar (ou curar) agora
        for (const o of vivos(this.estado)) {
          if (o === sel && !mira) continue
          if (!motivo(this.estado, this.acaoEm(sel, s, o.casa))) this.palco.marcar(o.casa, s.cura ? 'cura' : 'alvo')
        }
        if (this.previa) for (const x of casasDaArea(s, sel.casa, this.previa)) this.palco.marcar(x, 'area')
      }
    }
    this.palco.avisar()
  }

  // ------------------------------------------------------------ animação
  private registrar(texto: string) {
    this.log = [...this.log.slice(-60), { t: this.inicioBatalha ? Math.floor((performance.now() - this.inicioBatalha) / 1000) : 0, texto }]
  }

  private async animar(antes: Estado, eventos: Evento[]) {
    const P = (id: string) => this.palco.personagem(id)
    const nome = (id: string) => porId(antes, id)?.nome ?? id
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (let i = 0; i < eventos.length; i++) {
      const e = eventos[i]
      switch (e.t) {
        case 'mover': {
          const p = P(e.id)
          if (p) await new Promise<void>((r) => p.andar(e.caminho, r))
          break
        }
        case 'skill': {
          // junta os eventos desta skill (até a próxima skill/mover/vez)
          let j = i + 1
          while (j < eventos.length && !['skill', 'mover', 'vez', 'haoshoku'].includes(eventos[j].t)) j++
          const resto = eventos.slice(i + 1, j)
          i = j - 1
          await this.animarSkill(antes, e, resto)
          break
        }
        case 'haoshoku': {
          const p = P(e.id)
          if (!p) break
          this.registrar(`${nome(e.id)} solta o Haki do Rei!`)
          this.palco.flutuar(p, 'Haki do Rei!', '#ff4a5a', 1)
          this.palco.hakiDoRei(p)
          await esperar(900)
          break
        }
        case 'atordoou':
        case 'resistiu':
        case 'congelou':
        case 'caiu':
        case 'cura':
        case 'golpe':
        case 'contra':
        case 'clash':
          await this.resultado(antes, e)
          break
        case 'queimou': {
          const p = P(e.id)
          if (p) {
            this.palco.flutuar(p, `Queimadura -${e.dano}`, '#ff9a4a')
            void this.palco.efeito('fogo', 'normal', this.palco.peito(p), { dur: 0.5, escala: 0.8 })
            p.vida = Math.max(1, p.vida - e.dano)
          }
          this.registrar(`${nome(e.id)} sofre ${e.dano} de queimadura.`)
          await esperar(400)
          break
        }
        case 'transformou': {
          const p = P(e.id)
          if (p) {
            const fr = porId(antes, e.id)?.akuma?.fruta ?? ''
            p.forma = FORMAS[fr] ?? null
            this.palco.flutuar(p, fr === 'borracha' ? 'Gear Second!' : fr === 'luz' ? 'Espada de Luz!' : fr === 'fogo' ? 'Corpo de Chamas!' : fr === 'lobo' ? 'Lobisomem!' : 'Forma Híbrida!', fr === 'borracha' || fr === 'fogo' ? '#ff6a5a' : '#ffcf6a', 1)
            await this.palco.efeito('aura', 'normal', this.palco.peito(p), { dur: 0.8, escala: 1.8 })
          }
          this.registrar(`${nome(e.id)} se transforma (${e.vezes} vezes).`)
          break
        }
        case 'haki': {
          const p = P(e.id)
          const rei = e.tipo === 'rei'
          if (p) {
            p.haki = e.ligado ? (rei ? 'rei' : 'armamento') : false
            this.palco.flutuar(p, e.ligado ? (rei ? 'Haki do Rei imbuído!' : 'Busoshoku!') : 'Haki desligado', e.ligado ? (rei ? '#ff5a6a' : '#c890ff') : '#c9c9c9', 1)
            if (e.ligado) {
              if (rei) this.palco.tremer(0.2)
              await this.palco.efeito(rei ? 'raio' : 'impacto', rei ? 'rei' : 'armamento', this.palco.peito(p), { dur: 0.45, escala: 1 })
            }
          }
          this.registrar(`${nome(e.id)} ${e.ligado ? 'liga' : 'desliga'} o ${rei ? 'Haki do Rei imbuído' : 'Haki de armamento'}.`)
          break
        }
        case 'recuperou': {
          const p = P(e.id)
          if (p) this.palco.flutuar(p, `Armamento +1 (${e.usos})`, '#c890ff', 1)
          this.registrar(`${nome(e.id)} recupera 1 uso de armamento com espírito (${e.usos}).`)
          await esperar(250)
          break
        }
        case 'tempo':
          this.registrar('Tempo esgotado! A vez passa.')
          break
        case 'vez':
          if (this.treino) break
          this.registrar(`— Vez ${e.turno}: ${e.lado === JOGADOR ? 'piratas' : 'Marinha'} —`)
          break
        case 'fim':
          this.registrar(e.vencedor === JOGADOR ? 'Vitória dos piratas!' : 'A Marinha venceu.')
          break
      }
    }
  }

  private async animarSkill(antes: Estado, e: Extract<Evento, { t: 'skill' }>, resto: Evento[]) {
    const a = this.palco.personagem(e.id)
    if (!a) return
    const c = porId(antes, e.id)!
    const s = skillsDe(c).find((x) => x.id === e.skill) as Skill
    const v0 = VISUAL[s.id] ?? { efeito: 'impacto', modo: 'perto' }
    const daFruta = !!c.akuma && FRUTAS[c.akuma.fruta].skills.some((x) => x.id === s.id)
    const v: Visual = daFruta && v0.modo !== 'especial' ? { ...v0, escala: (v0.escala ?? 1) * (ULTIMATES.has(s.id) ? ESCALA_ULTIMATE : ESCALA_FRUTA) } : v0
    const paleta: Paleta = ELEMENTAIS.has(v.efeito) ? 'normal' : e.rei ? 'rei' : e.armamento ? 'armamento' : 'normal'
    const comHaki = !s.livre && s.mult > 0
    this.registrar(`${c.nome} usa ${s.nome}${comHaki && e.rei ? ' com Haki do Rei' : comHaki && e.armamento ? ' com Haki de armamento' : ''}.`)
    this.palco.flutuar(a, s.nome, e.rei ? '#ff5a6a' : e.armamento ? '#c890ff' : '#ffffff', 2)
    a.haki = e.rei ? 'rei' : e.armamento ? 'armamento' : false
    const alvoCasa = e.alvo
    // choque de Haki do Rei: antes do golpe
    const clash = resto.find((x) => x.t === 'clash') as Extract<Evento, { t: 'clash' }> | undefined
    if (clash) {
      await this.animarClash(antes, clash)
      if (clash.resultado !== 'venceu' && s.area === 'alvo') {
        for (const r of resto) if (r !== clash) await this.resultado(antes, r)
        a.haki = false
        return
      }
    }
    // vira para o alvo e toca o golpe
    const primeiro = resto.find((x) => x.t === 'golpe' || x.t === 'cura') as { alvo: string } | undefined
    const pAlvo = primeiro ? this.palco.personagem(primeiro.alvo) : undefined
    const destino = pAlvo ?? null
    await new Promise<void>((r) => {
      if (destino && destino !== a) a.atacar(destino, r)
      else {
        if (!mesmaCasa(alvoCasa, c.casa)) a.olharPara(alvoCasa)
        a.atacar(a, r)
      }
    })
    // efeito da skill
    const origem = this.palco.peito(a)
    const fim = e.casas.length ? e.casas[e.casas.length - 1] : alvoCasa
    const ate = pAlvo ? this.palco.peito(pAlvo) : this.palco.centro(v.modo === 'projetil' && s.area === 'linha' ? fim : alvoCasa)
    for (const fx of FOLHA_SKILL[s.id] ?? []) {
      const pts =
        fx.onde === 'si' ? [fx.chao ? a.pos.clone() : this.palco.peito(a)]
        : fx.onde === 'casas' ? e.casas.map((x) => this.palco.centro(x))
        : [pAlvo ? (fx.chao ? pAlvo.pos.clone() : this.palco.peito(pAlvo)) : this.palco.centro(alvoCasa)]
      for (const pt of pts) void this.palco.efeitoFolha(fx.folha, 'S', fx.chao ? pt.clone().setY(0.02) : pt, { largura: fx.largura })
    }
    // Haki do Rei imbuído: chama roxa no alvo
    if (e.rei && pAlvo) void this.palco.efeitoFolha('fogo-roxo', 'S', pAlvo.pos.clone().setY(0.02), { largura: 1.4 })
    if (v.modo === 'especial') {
      const hits = resto.filter((x) => x.t === 'golpe').map((x) => this.palco.personagem((x as { alvo: string }).alvo)).filter((p): p is Personagem => !!p)
      await this.especial(s.id, a, origem, ate, e.casas.map((x) => this.palco.centro(x)), hits, direcaoEfeito(alvoCasa.l - c.casa.l, alvoCasa.c - c.casa.c))
    } else if (v.modo === 'projetil' && v.efeito === 'bala' && a.forma === 'sabre' && (await this.palco.rajadaLuz(a, ate, v.tiros ?? 1))) {
      // Arma de Luz ligada: o rifle atira joias de luz
    } else if (v.modo === 'projetil') {
      const tiros = v.tiros ?? 1
      const alvos = s.area === 'leque' ? e.casas.map((x) => this.palco.centro(x)) : Array(tiros).fill(ate)
      await Promise.all(
        alvos.map((p, k) => new Promise<void>((r) => setTimeout(() => void this.palco.efeito(v.efeito, paleta, origem, { para: p, dur: 0.12 + origem.distanceTo(p) * 0.05, escala: v.escala }).then(r), k * 120))),
      )
    } else if (v.modo === 'si') {
      void this.palco.efeito(v.efeito, paleta, origem, { dur: 0.7, escala: v.escala })
      await new Promise((r) => setTimeout(r, 250))
    } else if (v.modo === 'area') {
      for (const x of e.casas) void this.palco.efeito(v.efeito, paleta, this.palco.centro(x).setY(0.5), { dur: 0.6, escala: v.escala })
      await new Promise((r) => setTimeout(r, 300))
    }
    if (e.rei) {
      this.palco.tremer(0.35)
      void this.palco.efeito('raio', 'rei', ate, { dur: 0.6, escala: 2.2 })
    } else if (e.armamento) this.palco.tremer(0.15)
    // resultados, um por um
    for (const r of resto) if (r !== clash) await this.resultado(antes, r, v, paleta)
    a.haki = false
  }

  /** Animações próprias das skills de Akuma no Mi (como no anime). */
  private async especial(id: string, a: Personagem, origem: THREE.Vector3, ate: THREE.Vector3, casas: THREE.Vector3[], hits: Personagem[], dirF: DirEfeito): Promise<void> {
    // poderes de Akuma no Mi maiores que os personagens; os ultimates, bem maiores
    const k = ULTIMATES.has(id) ? ESCALA_ULTIMATE : ESCALA_FRUTA
    const P: Palco = { ...this.palco, efeito: (t, pal, de, op) => this.palco.efeito(t, pal, de, { ...op, escala: (op?.escala ?? 1) * k }) }
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const chao = (v: THREE.Vector3) => v.clone().setY(0.55)
    const dir = ate.clone().sub(origem)
    switch (id) {
      case 'hiken': {
        // efeito do Effekseer (punho de fogo + impacto); sem ele, as folhas desenhadas
        if (await P.hiken(a, casas.length ? casas[casas.length - 1] : ate)) {
          P.tremer(0.45)
          break
        }
        // uma skill só: a 1 casa, o punho explode à queima-roupa; mais longe, é arremessado
        if (origem.distanceTo(ate) > 1.6) return this.especial('hiken-distancia', a, origem, ate, casas, hits, dirF)
        // Hiken de perto: só a arte desenhada (sem efeito a mais)
        const pt = origem.clone().lerp(ate, 0.62)
        void P.efeitoFolha('hiken-perto', dirF, pt, { largura: 2.2 })
        await esperar(380)
        break
      }
      case 'hiken-distancia': {
        // Hiken à distância: o punho de fogo (arte desenhada) voa até o alvo
        const alvoFim = casas.length ? casas[casas.length - 1] : ate
        const desenhado = await P.efeitoFolha('hiken-distancia', dirF, origem, { para: alvoFim, largura: 2.2 })
        if (desenhado) break
        // sem a folha: jato de fogo por código
        const n = 12
        for (let i = 0; i < n; i++) {
          const pt = origem.clone().lerp(alvoFim, (i + 1) / n)
          void P.efeito('chama', 'normal', pt, { dur: 0.55, escala: 0.9 + i * 0.06, direcao: dir })
          await esperar(28)
        }
        await esperar(300)
        break
      }
      case 'hotarubi': {
        // vaga-lumes verdes saem de quem lança e voam até a área; lá giram
        // devagar, a fumaça escurece, acende e explode (folha com tempo por
        // quadro); o golpe acerta no quadro da explosão (6)
        const centro = casas.length ? casas.reduce((m, c) => m.add(c), new THREE.Vector3()).multiplyScalar(1 / casas.length) : ate
        // corpo (folha 'empurrar'): junta as mãos, abre as palmas para a frente
        // e segura enquanto os vaga-lumes voam; no estouro, empurra e volta
        const pose = (q: number) => a.posar('empurrar', q)
        if (pose(1)) {
          await esperar(200)
          pose(2)
          await esperar(120)
          pose(3)
        }
        // efeito feito no Effekseer (bolinhas + Hidaruma); sem ele, a folha antiga
        if (await P.hotarubi(a, centro.clone().setY(0))) {
          P.tremer(0.5)
          pose(4)
          setTimeout(() => {
            pose(5)
            setTimeout(() => a.soltarPose(), 220)
          }, 260)
          break
        }
        const voos = Array.from({ length: 10 }, () => centro.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2)))
        await Promise.all(voos.map((c, i) => new Promise<void>((r) => setTimeout(() => void P.efeito('vagalume', 'normal', origem.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.5, 0)), { para: c, dur: 0.75 + Math.random() * 0.25, escala: 0.3 }).then(r), i * 45))))
        const golpe = new Promise<void>((r) => {
          void P.efeitoFolha('hotarubi', dirF, centro.clone().setY(0.02), {
            aoQuadro: [6, () => {
              P.tremer(0.5)
              pose(4)
              r()
            }],
          }).then((tem) => {
            if (!tem) r()
          })
        })
        await golpe
        setTimeout(() => {
          pose(5)
          setTimeout(() => a.soltarPose(), 220)
        }, 260)
        break
      }
      case 'higan': {
        // rajada de balas de fogo do dedo (efeitos do Effekseer); sem eles,
        // chamas voando em linha. O dano entra quando a rajada chega.
        const pose = (q: number) => a.posar('empurrar', q)
        pose(2)
        if (!(await P.higan(a, ate))) {
          for (let i = 0; i < 6; i++) {
            void P.efeito('chama', 'normal', origem, { para: ate.clone().setY(0.6), dur: 0.15, escala: 0.4 })
            await esperar(70)
          }
        }
        P.tremer(0.25)
        setTimeout(() => {
          pose(5)
          setTimeout(() => a.soltarPose(), 200)
        }, 300)
        break
      }
      case 'entei': {
        // cena longa em fases (cena/entei.ts): círculo de fogo no chão, fogo
        // subindo em espiral, bola crescendo e girando sobre a cabeça, voo em
        // arco, impacto (aqui o dano aparece) e a explosão seguindo sozinha
        const centro = casas.length ? casas.reduce((m, c) => m.add(c), new THREE.Vector3()).multiplyScalar(1 / casas.length) : ate
        await P.entei(a, centro.clone().setY(0), k)
        break
      }
      case 'yasakani': {
        // corpo (folha 'cruzar'): abre os braços e cruza na frente do peito; a
        // luz carrega em cada mão e a rajada sai delas (efeitos do Effekseer)
        const pose = (q: number) => a.posar('cruzar', q)
        if (pose(1)) {
          await esperar(110)
          pose(2)
          await esperar(220)
          pose(3)
          await esperar(110)
          pose(4)
          await esperar(90)
          pose(5)
        }
        const pontos = (casas.length ? casas : [ate]).map((c) => c.clone().setY(0))
        if (await P.yasakani(a, pontos)) {
          P.tremer(0.3)
          setTimeout(() => a.soltarPose(), 700)
          break
        }
        // sem o efeito: bolas de luz caindo na área
        const cima = a.pos.clone().setY(a.visual.altura + 1)
        const tiros = Array.from({ length: 22 }, () => casas[Math.floor(Math.random() * casas.length)] ?? ate)
        await Promise.all(
          tiros.map((c, i) => new Promise<void>((r) => setTimeout(() => {
            const pt = chao(c).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0, (Math.random() - 0.5) * 0.7))
            void P.efeito('orbeLuz', 'normal', cima, { para: pt, dur: 0.22, escala: 0.5 }).then(() => {
              void P.efeito('luz', 'normal', pt, { dur: 0.35, escala: 0.8 })
              r()
            })
          }, i * 40))),
        )
        P.tremer(0.3)
        a.soltarPose()
        break
      }
      case 'chute-luz': {
        // Light Kick (Effekseer): a luz acende no pé, avança num instante com o
        // rastro, o arco sai na varredura da perna e o clarão no contato; volta.
        // Corpo (folha 'chutar'): dobra a perna, chuta (quadro 3) e recolhe
        const alvo = hits[0]
        const para = alvo ? alvo.pos.clone().lerp(a.pos, 0.35) : ate
        const casa = origem.clone().setY(0)
        const pose = (q: number) => a.posar('chutar', q)
        const lk = await P.lightKick(a)
        pose(1)
        if (lk) await esperar(250)
        lk?.avancar(para)
        await P.deslizar(a, para, 0.07)
        lk?.parar()
        if (pose(2)) await esperar(70)
        lk?.arco(ate)
        pose(3)
        lk?.impacto(ate)
        P.tremer(0.3)
        await esperar(160)
        if (pose(4)) await esperar(80)
        lk?.apagar()
        pose(5)
        lk?.avancar(casa)
        await P.deslizar(a, null, 0.07)
        lk?.parar()
        a.soltarPose()
        break
      }
      case 'raio-luz': {
        const fim = casas.length ? casas[casas.length - 1] : ate
        const meio = origem.clone().lerp(fim, 0.5)
        void P.efeito('feixeLuz', 'normal', meio, { dur: 0.45, escala: 0.6, alongar: Math.max(1, origem.distanceTo(fim) / 0.9), direcao: fim.clone().sub(origem) })
        for (const h of hits) void P.efeito('luz', 'normal', P.peito(h), { dur: 0.4, escala: 1 })
        await esperar(250)
        break
      }
      case 'lanca-gelo': {
        // Partisan (Effekseer): cinco lanças se formam em arco atrás de quem lança e disparam até o alvo
        if (await P.partisan(a, ate)) {
          P.tremer(0.3)
          setTimeout(() => a.soltarPose(), 250)
          break
        }
        await esperar(280)
        break
      }
      case 'pheasant-beak': {
        // ave de gelo (Effekseer) voa até o alvo e explode em cristais; sem o efeito, lança de gelo
        const pose = (q: number) => a.posar('empurrar', q)
        pose(2)
        if (!(await P.pheasant(a, ate))) await esperar(400)
        P.tremer(0.35)
        setTimeout(() => a.soltarPose(), 250)
        break
      }
      case 'corte': {
        // ataque básico de espada: só o corte feito no Effekseer (sem ele, um impacto simples)
        if (!(await P.corte(a, ate))) {
          void P.efeito('impacto', 'normal', ate, { dur: 0.4, escala: 0.9 })
          await esperar(150)
        }
        break
      }
      case 'ice-time': {
        // Effekseer: clarão de contato na mão; os cristais crescem no alvo quando
        // ele congela (evento 'congelou') e ficam até a vez do congelado acabar
        if (!(await P.iceTime(a, hits[0] ?? null, ate))) await esperar(300)
        break
      }
      case 'era-gelo': {
        // Ice Age (Effekseer): o gelo se espalha a partir de quem lança; cada
        // inimigo atingido congela com o gelo do Ice Time (evento 'congelou')
        await P.iceAge(a)
        P.lampejo('branco', 0.25)
        P.tremer(0.5)
        await esperar(600)
        break
      }
      case 'gatling': {
        // chuva de socos esticados
        for (let i = 0; i < 18; i++) {
          const pt = ate.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3))
          void P.efeito('punho', 'normal', origem, { para: pt, dur: 0.1, escala: 0.6 }).then(() => {
            if (i % 3 === 0) void P.efeito('impacto', 'normal', pt, { dur: 0.25, escala: 0.6 })
          })
          await esperar(45)
        }
        P.tremer(0.2)
        break
      }
    }
  }

  /**
   * Choque de Haki do Rei: a câmera aproxima os dois, cada um golpeia na
   * direção do outro sem as armas se tocarem, e entre eles o Haki explode
   * em raios negros e vermelhos. Ganha o maior overall.
   */
  private async animarClash(antes: Estado, k: Extract<Evento, { t: 'clash' }>) {
    const a = this.palco.personagem(k.de)
    const b = this.palco.personagem(k.alvo)
    if (!a || !b) return
    const nome = (id: string) => porId(antes, id)?.nome ?? id
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    this.palco.flutuar(b, 'Haki do Rei!', '#ff4a5a', 2)
    await esperar(350)
    a.haki = 'rei'
    b.haki = 'rei'
    const meio = this.palco.peito(a).lerp(this.palco.peito(b), 0.5)
    // os dois golpeiam um na direção do outro; as armas não chegam a se tocar
    await Promise.all([new Promise<void>((r) => a.atacar(b, r)), new Promise<void>((r) => setTimeout(() => b.atacar(a, r), 60))])
    // quadros de impacto: a tela pisca negra e vermelha, e o Haki explode no meio
    this.palco.lampejo('rei', 0.5)
    this.palco.choqueRei(meio.clone().setY(0))
    this.palco.tremer(0.9)
    this.palco.choqueTela(meio)
    await esperar(750)
    this.palco.lampejo('rei', 0.25)
    this.palco.tremer(0.5)
    await esperar(750)
    b.haki = false
    if (k.resultado === 'empate') {
      this.palco.lampejo('branco', 0.25)
      this.palco.tremer(0.6)
      void this.palco.efeito('impacto', 'rei', meio, { dur: 0.6, escala: 3 })
      this.palco.flutuar(a, 'Anulou!', '#ffd34a', 1)
      this.palco.flutuar(b, 'Anulou!', '#ffd34a', 1)
      this.registrar(`Choque de Haki do Rei entre ${nome(k.de)} e ${nome(k.alvo)}: empate, o golpe se anula.`)
      a.haki = false
      await esperar(700)
    } else if (k.resultado === 'venceu') {
      this.palco.flutuar(a, 'Venceu o choque!', '#ff5a6a', 1)
      this.registrar(`${nome(k.de)} vence o choque de Haki do Rei contra ${nome(k.alvo)} (golpe mais forte).`)
      await esperar(300)
    } else {
      this.palco.lampejo('branco', 0.2)
      void this.palco.efeito('impacto', 'rei', this.palco.peito(a), { dur: 0.5, escala: 1.8 })
      a.sofrer(k.dano, b)
      this.palco.flutuar(a, `Perdeu o choque! -${k.dano}`, '#ff5a6a', 1)
      this.registrar(`${nome(k.alvo)} vence o choque de Haki do Rei: ${nome(k.de)} leva o próprio golpe (${k.dano}).`)
      a.haki = false
      await esperar(700)
    }
  }


  private async resultado(antes: Estado, e: Evento, v?: Visual, paleta: Paleta = 'normal') {
    const P = (id: string) => this.palco.personagem(id)
    const nome = (id: string) => porId(antes, id)?.nome ?? id
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    switch (e.t) {
      case 'golpe': {
        const a = P(e.de)
        const b = P(e.alvo)
        if (!a || !b) return
        if (e.efeito === 'atravessou') {
          const fruta = porId(antes, e.alvo)?.akuma?.fruta ?? 'fumaca'
          this.palco.flutuar(b, 'Atravessou!', '#dfe6f3', 1)
          this.registrar(`O golpe atravessa ${nome(e.alvo)} (Logia).`)
          await this.palco.atravessar(b, FRUTAS[fruta]?.elemento ?? 'fumaca')
          return
        }
        if (e.efeito === 'observou') {
          this.palco.flutuar(b, 'Observação!', '#9fe0ff', 1)
          this.registrar(`${nome(e.alvo)} prevê o golpe (Haki de observação) e esquiva.`)
          await this.palco.esquivar(b, a)
          return
        }
        if (e.efeito === 'esquivou') {
          this.palco.flutuar(b, 'Esquivou!', '#9fe0ff', 1)
          this.registrar(`${nome(e.alvo)} esquiva.`)
          await this.palco.esquivar(b, a)
          return
        }
        if (v && (v.modo === 'perto' || v.modo === 'projetil')) void this.palco.efeito(v.efeito === 'corte' || v.efeito === 'bala' || v.efeito === 'adaga' || v.efeito === 'punho' ? 'impacto' : v.efeito, paleta, this.palco.peito(b), { dur: 0.4, escala: (v.escala ?? 1) * 0.9 })
        b.sofrer(e.dano, a)
        const txt: Record<string, string> = { critico: 'Crítico! ', bloqueou: 'Bloqueou ', desgastado: 'Desgastado! ' }
        this.palco.flutuar(b, `${txt[e.efeito] ?? ''}-${e.dano}`, e.efeito === 'critico' ? '#ff5a4a' : '#ffe27a')
        this.registrar(`${nome(e.de)} acerta ${nome(e.alvo)}: ${e.dano}${e.efeito === 'critico' ? ' (crítico)' : e.efeito === 'bloqueou' ? ' (bloqueou)' : e.efeito === 'desgastado' ? ' (Logia desgastada)' : ''}.`)
        await esperar(260)
        return
      }
      case 'contra': {
        const a = P(e.de)
        const b = P(e.alvo)
        if (!a || !b) return
        this.palco.flutuar(a, 'Contra-ataque!', '#ff9a7a', 2)
        await new Promise<void>((r) =>
          a.atacar(b, () => {
            b.sofrer(e.dano, a)
            this.palco.flutuar(b, `-${e.dano}`, '#ffe27a')
            r()
          }),
        )
        this.registrar(`${nome(e.de)} revida na hora (observação avançada): ${e.dano}.`)
        await esperar(300)
        return
      }
      case 'cura': {
        const b = P(e.alvo)
        if (!b) return
        b.vida = Math.min(b.vidaMax, b.vida + e.valor)
        this.palco.flutuar(b, `+${e.valor}`, '#7dff8a')
        this.registrar(`${nome(e.de)} cura ${nome(e.alvo)}: +${e.valor}.`)
        await esperar(400)
        return
      }
      case 'atordoou':
      case 'congelou': {
        const b = P(e.id)
        if (!b) return
        this.tipoStatus.set(e.id, e.t === 'congelou' ? 'gelo' : 'stun')
        b.status = e.t === 'congelou' ? 'gelo' : 'stun'
        if (e.t === 'congelou') this.palco.congelar(b)
        this.palco.flutuar(b, e.t === 'congelou' ? 'Congelado!' : 'Atordoado!', e.t === 'congelou' ? '#a8ecff' : '#ff5a6e', 1)
        this.registrar(`${nome(e.id)} ${e.t === 'congelou' ? 'congela' : 'fica atordoado pelo Haki do Rei'} e perde a próxima vez.`)
        await esperar(350)
        return
      }
      case 'clash': {
        // choque com um alvo que não foi o principal (golpe em área)
        await this.animarClash(antes, e)
        return
      }
      case 'resistiu': {
        const b = P(e.id)
        if (b) this.palco.flutuar(b, 'Resistiu!', '#ffd34a', 1)
        this.registrar(`${nome(e.id)} resiste ao Haki do Rei.`)
        return
      }
      case 'caiu': {
        const b = P(e.id)
        if (b) {
          this.palco.flutuar(b, 'Caiu!', '#ff6a6a', 1)
          this.palco.sumir(b)
        }
        this.registrar(`${nome(e.id)} caiu.`)
        await esperar(450)
        return
      }
      default:
        return
    }
  }

  // ------------------------------------------------------------ retrato
  private ficha(c: Combatente): FichaHud {
    const p = this.palco.personagem(c.id)
    const arm = c.haki.armamento
    const obs = c.haki.observacao
    return {
      id: c.id,
      nome: c.nome,
      lado: c.lado,
      retrato: recurso(`${import.meta.env.BASE_URL}sprites/${c.id}/parado_S.png`),
      hp: this.animando ? (p?.vida ?? c.hp) : c.hp,
      hpMax: c.hpMax,
      energia: c.energia,
      espirito: c.espirito,
      fruta: c.akuma ? { nome: FRUTAS[c.akuma.fruta].nome, tipo: FRUTAS[c.akuma.fruta].tipo } : null,
      logia: c.logia ? { ...c.logia } : null,
      armamento: arm ? { ...arm, ligado: c.armamentoLigado } : null,
      observacao: obs ? { ...obs, ligado: c.observando } : null,
      rei: c.haki.rei ? { ligado: c.reiLigado } : null,
      overall: c.haki.overall,
      atordoado: c.atordoado,
      queimando: !!c.queimadura,
      transformado: c.akuma?.transformado ?? 0,
      podeRei: c.haki.rei && !!c.haki.armamento?.avancado && c.espirito >= REI_IMBUIDO.espirito && (c.haki.armamento?.usos ?? 0) > 0,
      podeHaoshoku: this.fase === 'minha' && c.haki.rei && c.espirito >= HAOSHOKU.espirito && !motivo(this.estado, { t: 'haoshoku', id: c.id }),
    }
  }


  retrato(): RetratoBatalha {
    const e = this.estado
    const s = this.sel ? porId(e, this.sel) : null
    const nomes = new Map(TRIPULACOES.map((m) => [m.id, m]))
    return {
      fase: this.fase,
      animando: this.animando,
      auto: this.auto,
      treino: this.treino ? { ...this.treino } : null,
      config: this.config.map((k) => ({ ...k, nome: nomes.get(k.id)!.nome, lado: nomes.get(k.id)!.lado })),
      turno: e.turno,
      vez: e.vez,
      movimento: e.movimento,
      tempo: this.fase === 'minha' ? this.tempo() : tempoDaVez(e),
      tempoMax: tempoDaVez(e),
      vencedor: e.vencedor,
      tripulacao: e.combatentes.filter((c) => c.lado === JOGADOR).map((c) => this.ficha(c)),
      inimigos: e.combatentes.filter((c) => c.lado !== JOGADOR).map((c) => this.ficha(c)),
      selecionado: s
        ? {
            ...this.ficha(s),
            skills: skillsDe(s).map((k) => ({
              id: k.id,
              nome: k.nome,
              descricao: k.descricao,
              energia: k.energia,
              alcance: k.alcance,
              area: k.area,
              fruta: !!s.akuma && FRUTAS[s.akuma.fruta].skills.includes(k),
              recarga: s.recargas[k.id] ?? 0,
              espera: k.recarga ?? 0,
              raio: k.raio ?? 1,
              livre: !!k.livre,
              motivo: s.recargas[k.id] ? `Recarga: ${s.recargas[k.id]} vez(es)` : s.energia < k.energia ? 'Energia insuficiente' : s.atordoado ? 'Atordoado' : null,
            })),
            skill: this.efetiva(s)?.id ?? null,
            previa: !!this.previa,
            usarArmamento: s.armamentoLigado,
            usarRei: s.reiLigado,
            podeArmamento: (s.haki.armamento?.usos ?? 0) > 0,
            podeRei: s.haki.rei && !!s.haki.armamento?.avancado && s.espirito >= REI_IMBUIDO.espirito,
            podeHaoshoku: s.haki.rei && s.espirito >= HAOSHOKU.espirito && !motivo(e, { t: 'haoshoku', id: s.id }),
          }
        : null,
      log: this.log.slice(-40),
      tempoHaki: this.fase === 'haki' ? Math.max(0, Math.ceil((this.fimPreparo - performance.now()) / 1000)) : 0,
      dica: this.dica,
    }
  }
}

export { vivos }
