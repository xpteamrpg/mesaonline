import type { TravelEvent } from "./travel";
import type { StageMedia } from "./stageMedia";
import type { TravelState } from "./travel";
import type { GridSettings } from "./distance";
import type { AuraSpec, ShapeGeometry } from "./shapes";
import type { ShapeTrigger } from "./triggers";
import type { FogSettings, LightingType } from "./vision";
/**
 * Tipos compartilhados pela mesa e pelo motor tático.
 *
 * Regra de arquitetura: BoardToken é o token persistente de BOARD.tokens.
 * TacticalUnitView é somente uma projeção de renderização — nunca é salvo.
 */
export type Side = "heroes" | "threats";
export type ViewMode = "2d" | "isometric";
export type TerrainType = "normal" | "difficult" | "blocked" | "elevated" | "cover";
export type WeatherType = "clear" | "rain" | "snow" | "embers" | "fog" | "tormenta" | "storm";
export type ActionKind = "standard" | "movement" | "full" | "free" | "reaction";

export type ActionMode =
  | "select"
  | "move"
  | "target"
  | "spawn"
  | "terrain"
  | "fog-cover"
  | "fog-reveal";

export type ActionCategory = "weapon" | "spell" | "power" | "item" | "special";
export type ActionEffect = "damage" | "heal" | "buff" | "summon" | "text";
export type TargetKind = "enemy" | "ally" | "self" | "area" | "cell";
export type SaveType = "fortitude" | "reflexes" | "will";
export type SaveOutcome = "failure" | "success" | "half" | "negates" | "partial";

export interface GameAction {
  id: string;
  name: string;
  category: ActionCategory;
  kind?: ActionKind;
  effect: ActionEffect;
  target: TargetKind;
  description: string;
  pmCost: number;
  rangeM: number;
  areaM?: number;
  attackSkill?: "luta" | "pontaria";
  /** Investida (p.235): ação completa que avança em linha reta (até o dobro do deslocamento) e ataca no fim, com +2 no ataque e −2 na Defesa até o próximo turno */
  charge?: boolean;
  attackBonus?: number;
  damage?: string;
  extraDamage?: string;
  damageType?: string;
  healing?: string;
  crit?: number;
  critMultiplier?: number;
  repeats?: number;
  autoHit?: boolean;
  save?: SaveType;
  saveDC?: number;
  halfOnSave?: boolean;
  /** Condição aplicada quando a resistência falha, ou automaticamente sem resistência. */
  condition?: string;
  source?: "character" | "threat" | "registry" | "generic";
  sourceId?: string;
  color: "steel" | "gold" | "arcane" | "fire" | "nature" | "blood";
}

export interface TerrainCell {
  type: TerrainType;
  elevation: number;
}

export interface BattleMap {
  id: string;
  name: string;
  location: string;
  image: string;
  isoImage?: string;
  cols: number;
  rows: number;
  /** Posição da imagem em relação à grade, em células (alinhamento feito pelo Mestre). */
  offsetX?: number;
  offsetY?: number;
  /** Escala da imagem sobre a grade (1 = ajustada às colunas e linhas). */
  imageScale?: number;
  terrain: Record<string, TerrainCell>;
  custom?: boolean;
  isoGrid?: { x: number; y: number; tileWidth: number };
}

export type BoardWallType = "wall" | "door" | "window" | "invisible";
export interface BoardWall {
  id: string;
  /** andar da barreira; ausente = terreo */
  floor?: number;
  type: BoardWallType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  open?: boolean;
  locked?: boolean;
  name?: string;
  z?: number;
  /** CD base da fechadura: 20 simples, 25 média, 30 superior (game/chest.ts) */
  lockDc?: number;
  /** Tranca Arcana: +10 na CD; `magicBonus` soma +5 por aprimoramento que aumenta a CD */
  magicLocked?: boolean;
  magicBonus?: number;
  /** CD de Misticismo para detectar a magia da porta (definida pelo Mestre) */
  magicDc?: number;
  magicRevealed?: boolean;
  /** armadilha da porta: dispara em quem a abre (mesma do baú) */
  trap?: ObjectTrap;
  /** parede criada pela detecção automática (game/autoWalls.ts); pode ser removida de uma vez */
  auto?: boolean;
  /** carimbo (ms) que faz a porta tremer em todos os clientes */
  shakeAt?: number;
}

export interface BoardLight {
  id: string;
  /** andar da luz; ausente = terreo */
  floor?: number;
  x: number;
  y: number;
  type: "torch" | "campfire" | "lantern" | "magic";
  name: string;
  radius: number;
  color: string;
  intensity: number;
  enabled: boolean;
}

export interface BoardShape {
  id: string;
  /** andar da forma; ausente = térreo */
  floor?: number;
  kind: "area" | "trigger";
  cells: string[];
  /** geometria editável que originou as células; cenas antigas só têm cells */
  geometry?: ShapeGeometry;
  color?: string;
  hidden?: boolean;
  message?: string;
  /** configuracao de gatilho executavel (game/triggers.ts) */
  trigger?: ShapeTrigger;
}

/** Armadilha de um baú (game/chest.ts, tactics/engine/objectCommands.ts). Só o Mestre vê os números. */
export interface ObjectTrap {
  name: string;
  /** dispara ao abrir; some depois de disparar ou de ser desarmada */
  armed: boolean;
  /** um teste de Percepção bem-sucedido revela que ela existe e libera Desarmar (Ladinagem) */
  revealed?: boolean;
  /** CD de Percepção para achar a armadilha (definida pelo Mestre) */
  detectDc: number;
  /** CD de Ladinagem para desarmar */
  disarmDc: number;
  /** dano rolado em quem abre (ex.: 2d6); opcional */
  damage?: string;
  damageType?: string;
  /** teste de resistência de quem abre; passar reduz o dano à metade e evita a condição */
  save?: SaveType;
  saveDc?: number;
  /** condição aplicada em quem abre (nome de uma condição da mesa) */
  condition?: string;
}

export interface BoardObject {
  id: string;
  /** andar do objeto; ausente = térreo */
  floor?: number;
  kind: "item" | "chest" | "treasure";
  name: string;
  /** texto do item solto no chão (descrição da ficha do personagem que o largou) */
  description?: string;
  x: number;
  y: number;
  opened: boolean;
  locked: boolean;
  contents: string[];
  image?: string;
  /** CD base da fechadura: 20 simples, 25 média, 30 superior (Ladinagem para arrombar, Força para forçar) */
  lockDc?: number;
  /** Tranca Arcana: +10 na CD; `magicBonus` soma +5 por aprimoramento que aumenta a CD */
  magicLocked?: boolean;
  magicBonus?: number;
  /** CD de Misticismo para detectar a magia do objeto (definida pelo Mestre) */
  magicDc?: number;
  /** um teste de Misticismo bem-sucedido já mostrou aos jogadores que há magia aqui */
  magicRevealed?: boolean;
  trap?: ObjectTrap;
  /** carimbos de hora (ms) que disparam a animação de tremer e a de revelar o conteúdo em todos os clientes */
  shakeAt?: number;
  revealAt?: number;
}

export interface BoardToken {
  id: string;
  name: string;
  title: string;
  side: Side;
  gx: number;
  gy: number;
  z?: number;
  symbol: string;
  imageUrl?: string;
  sprite?: string;
  accent: string;
  hp: number;
  /** PV temporários: perdem-se primeiro e acabam com a cena (Campo de Força) */
  tempHp?: number;
  /** chefe: não morre a 0 PV como os inimigos comuns (segue a regra dos heróis: inconsciente e sangrando; morre em −10/−metade) */
  boss?: "boss" | "miniboss";
  /** morreu (PV ≤ −10 ou −metade dos PV totais, p.236); com 0 PV ou menos e ainda vivo, o personagem está inconsciente e sangrando */
  dead?: boolean;
  /** a condição Inconsciente/Sangrando veio de cair a 0 PV (sai quando voltar a ter PV) */
  fallenByHp?: boolean;
  /** quando os PV temporários acabam: "scene" (termina com a cena/combate; ex.: Campo de Força) ou, sem valor, no fim do dia (regra do livro, p.106) */
  tempHpScope?: "scene" | "day";
  hpMax: number;
  pm: number;
  pmMax: number;
  /** cor da borda do token escolhida no menu de botão direito (vazio = a do lado: herói ou ameaça) */
  ringColor?: string;
  defense: number;
  initiative: number;
  initiativeRoll: number;
  luta: number;
  pontaria: number;
  damage: string;
  crit: number;
  critMultiplier: number;
  attackType: "melee" | "ranged";
  rangeM: number;
  movementM: number;
  flyM?: number;
  burrowM?: number;
  level: number;
  spellDC: number;
  actionIds: string[];
  tacticalActions?: GameAction[];
  fortitude: number;
  reflexes: number;
  will: number;
  /** Ameaça do bestiário: modificadores de atributo e perícias treinadas (total já somado), para a ficha da direita. */
  attrs?: Partial<Record<"for" | "des" | "con" | "int" | "sab" | "car", number>>;
  skillBonuses?: Record<string, number>;
  /** Habilidades da ameaça do bestiário (nome, tipo de ação, texto) para a lista de Poderes da ficha. */
  abilities?: Array<{ name: string; type?: string; description?: string }>;
  /** Categoria de tamanho (game/tokenSize.ts); ausente = Médio. */
  size?: import("./tokenSize").SizeCategory;
  conditions?: string[];
  /** aura do token (game/shapes.ts) — raio em metros, pode iluminar */
  aura?: AuraSpec;
  /** andar em que o token esta; ausente = terreo */
  floor?: number;
  /** travado pelo Mestre: nao se move (recuperado do cadeado do VTT antigo) */
  locked?: boolean;
  /** tipo de visao: normal, penumbra ou "dark" (Visao no Escuro / darkvision) */
  visionType?: "normal" | "penumbra" | "dark" | "magic";
  /** alcance de visao em casas; sem valor usa o padrao das FogSettings */
  visionCells?: number;
  /** cavaleiro: id da montaria em que está (game/mount.ts) */
  mountId?: string;
  /** montaria: id de quem a monta */
  riderId?: string;
  loot?: string[];
  /** o espólio desta ameaça já caiu em um baú (game/espolio/threatLoot.ts) */
  lootDropped?: boolean;
  /** itens que este personagem pegou de um baú e ainda vão para a mochila da ficha (quem tem a ficha aplica e limpa) */
  pendingLoot?: string[];
  defeated?: boolean;
  hidden?: boolean;
  controlledBy?: string;
  bestiaryId?: string;
  customThreatId?: string;
  modernRpgCharacterId?: string;
  /** magias marcadas como raciais (concedidas pela raça, não pela classe); chave = nome normalizado */
  tacticsRacial?: string[];
  summonGroup?: string;
  summonedBy?: string;
  summonKey?: string;
  effects?: TacticalEffect[];
}

/** Projeção efêmera consumida por BattleBoard/CommandMenu. */
export interface TacticalUnitView {
  id: string;
  name: string;
  title: string;
  side: Side;
  x: number;
  y: number;
  symbol: string;
  portrait?: string;
  sprite?: string;
  accent: string;
  pv: number;
  pvMax: number;
  pm: number;
  pmMax: number;
  defense: number;
  initiative: number;
  initiativeRoll: number;
  luta: number;
  pontaria: number;
  damage: string;
  crit: number;
  critMultiplier: number;
  attackType: "melee" | "ranged";
  rangeM: number;
  movementM: number;
  flyM?: number;
  burrowM?: number;
  level: number;
  spellDC: number;
  actions: string[];
  customActions?: GameAction[];
  fortitude: number;
  reflexes: number;
  will: number;
  conditions?: string[];
  mountId?: string;
  loot?: string[];
  defeated?: boolean;
  controlled?: boolean;
  controlledBy?: string;
  modernRpgCharacterId?: string;
  sourceThreatId?: string;
  effects?: TacticalEffect[];
}

export interface ThreatTemplate {
  id: string;
  name: string;
  title: string;
  symbol: string;
  portrait?: string;
  sprite?: string;
  pv: number;
  pm: number;
  defense: number;
  initiative: number;
  luta: number;
  pontaria: number;
  damage: string;
  crit: number;
  critMultiplier: number;
  attackType: "melee" | "ranged";
  rangeM: number;
  movementM: number;
  flyM?: number;
  burrowM?: number;
  level?: number;
  spellDC?: number;
  actions?: string[];
  customActions?: GameAction[];
  /** quantidade de ataques e habilidades (a lista de ações completa só é montada quando precisa) */
  actionCount?: number;
  loot?: string[];
  /** texto do campo Tesouro da ficha da ameaça (o legado mostrava na ficha e nas notas) */
  treasure?: string;
  fortitude: number;
  reflexes: number;
  will: number;
  /** Ameaça do bestiário: modificadores de atributo e perícias treinadas (total já somado), para a ficha da direita. */
  attrs?: Partial<Record<"for" | "des" | "con" | "int" | "sab" | "car", number>>;
  skillBonuses?: Record<string, number>;
  /** Habilidades da ameaça do bestiário (nome, tipo de ação, texto) para a lista de Poderes da ficha. */
  abilities?: Array<{ name: string; type?: string; description?: string }>;
  /** Categoria de tamanho (game/tokenSize.ts); ausente = Médio. */
  size?: import("./tokenSize").SizeCategory;
  custom?: boolean;
  hidden?: boolean;
}

export interface TacticalEffect {
  id: string;
  name: string;
  sourceId?: string;
  sourceName?: string;
  kind: "scene" | "rounds" | "sustained" | "long";
  expiresRound?: number;
  /** quem conjurou: por padrão o efeito por rodadas termina no início do turno dele (regra do ModernRPG) */
  casterId?: string;
  mods?: Partial<Record<"attack" | "damage" | "defense" | "rd" | "saves" | "tempHp" | "speed" | "skills", number>>;
  damageType?: string;
  condition?: string | string[];
  reactiveKey?: string;
  /** CD capturada no momento em que o efeito reativo foi aplicado. */
  saveDC?: number;
  /** o bônus vale só para esta arma (id da ação de ataque), como Arma Mágica */
  weaponId?: string;
  /** o bônus de perícia vale só para esta perícia (id da perícia) */
  skillId?: string;
  /** vale uma vez só: some depois de reduzir um dano (Instante Estoico, RD "contra o próximo dano") */
  once?: boolean;
  /** RD "/mágico": não reduz dano mágico (de magia ou de arma mágica), como no Instante Estoico */
  notMagical?: boolean;
  /** a descrição da magia diz que acumula com outras magias (Armadura Arcana): soma em vez de valer só o maior */
  stacks?: boolean;
  /** quem carrega o efeito rola o d20 dos próprios ataques duas vezes e usa o melhor (Concentração de Combate) */
  attackRoll?: "best";
  /** quem ataca o portador rola o d20 duas vezes e usa o pior (Concentração de Combate, 3º círculo) */
  incomingAttackRoll?: "worst";
  /** dano extra de energia nos ataques da arma (Arma Mágica: +1d6 de ácido, eletricidade, fogo ou frio) */
  extraDamage?: { formula: string; type: string };
  /** Imagem Espelhada: cada ataque que erra desfaz uma cópia (−2 na Defesa) */
  mirrorImages?: boolean;
}

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  kind?: "chat" | "system" | "roll" | "combat";
  timestamp: number;
  /** peerId do destinatario; ausente = publico (sussurro, do VTT antigo) */
  whisperTo?: string;
  /** peerId de quem enviou, para o remetente ver o proprio sussurro */
  whisperFrom?: string;
}

export interface BoardState {
  id: string;
  map: BattleMap;
  tokens: BoardToken[];
  walls: BoardWall[];
  lights: BoardLight[];
  shapes: BoardShape[];
  objects: BoardObject[];
  fog: string[];
  explored: string[];
  weather: WeatherType;
  /** iluminacao ambiente; sem valor e derivada do clima (game/vision.ts) */
  lighting?: LightingType;
  /** a iluminação foi escolhida à mão na gaveta Luz (vale como escuridão do livro, com camuflagem); sem isso ela vem do clima (regra da casa) */
  lightingManual?: boolean;
  /** escala, unidade, metrica e tipo de grade (game/distance.ts) */
  grid?: Partial<GridSettings>;
  /** andar visivel da cena; ausente = terreo (game/floors.ts) */
  activeFloor?: number;
  /** viagem: dias sem encontro e total (game/travel.ts) */
  travel?: TravelState;
  /** configuracao de fog por papel (game/vision.ts) */
  fogSettings?: FogSettings;
  /** apelido de cada jogador conectado (peerId → nome), para mostrar quem controla cada token */
  playerNames?: Record<string, string>;
  /** encontro da viagem mostrado no palco para todos (game/travel.ts); o Mestre fecha */
  travelEvent?: TravelEvent;
  /** resultado do raio da tempestade no início da rodada atual (mostrado numa janelinha para todos) */
  weatherRoll?: WeatherRoll;
  /** imagem ou vídeo que o Mestre mostrou para todos, por cima do mapa (game/stageMedia.ts); some ao recarregar a página */
  stageMedia?: StageMedia;
  chat: ChatMessage[];
  selectedTokenIds: string[];
  targetedTokenIds: string[];
  revision: number;
}

export interface SceneState {
  id: string;
  name: string;
  /** "Cena" a que este mapa pertence (game/sceneGroups.ts); sem valor = Cena 1. */
  group?: string;
  board: BoardState;
  updatedAt: string;
}

export interface TurnResources {
  standard: number;
  movement: number;
  full: number;
  free: number;
  reaction: number;
}

export interface CombatantState {
  tokenId: string;
  initiative: number;
  conditions: string[];
}

/** Reação à espera de escolha do dono do alvo (tactics/engine/reactionWindow.ts). */
export interface PendingReaction {
  id: string;
  actorId: string;
  actorName: string;
  actionName: string;
  reactorId: string;
  reactorName: string;
  options: { actionId: string; name: string; pmCost: number }[];
}

export interface CombatState {
  active: boolean;
  round: number;
  activeTokenId: string | null;
  order: string[];
  combatants: CombatantState[];
  resources: Record<string, TurnResources>;
  log: BattleLogEntry[];
  rolls: DiceResolution[];
  revision: number;
  pendingReaction?: PendingReaction;
}

export interface BattleLogEntry {
  id: string;
  type: "initiative" | "move" | "attack" | "damage" | "heal" | "condition" | "reaction" | "spell" | "summon" | "system";
  title: string;
  detail: string;
  tone?: "success" | "danger" | "neutral";
  timestamp?: number;
}

export interface DiceResolution {
  id: string;
  actor: string;
  target: string;
  action: string;
  kind: "attack" | "save" | "damage" | "heal" | "system";
  natural?: number;
  modifier?: number;
  total: number;
  dc?: number;
  formula: string;
  rolls: number[];
  outcome: string;
  success: boolean;
  timestamp: number;
}

export interface RuntimeSnapshot {
  board: BoardState;
  scenes: SceneState[];
  activeSceneId: string;
  combat: CombatState;
  multiplayer: MultiplayerState;
  revision: number;
}

/**
 * Resultado devolvido pelo Mestre para um comando remoto.
 *
 * Fica acumulado em `MultiplayerState.commandLog`: ao contrário de
 * `MultiplayerState.error` — que é transitório e zerado a cada novo comando —
 * este registro é durável e permite observar com determinismo qual comando foi
 * recusado e por quê.
 */
export interface RemoteCommandResult {
  requestId: string;
  /** Nome do comando enviado (ex.: "endCombat"). */
  name: string;
  ok: boolean;
  /** Motivo exato da recusa, preenchido apenas quando `ok` é falso. */
  error?: string;
  at: number;
}

export interface MultiplayerState {
  role: "local" | "master" | "player";
  status: "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
  roomCode: string;
  /**
   * ID do PeerJS desta instância. Persistido por sala em
   * `modernrpg_armada_peer_identity_v1` para que `controlledBy` sobreviva a um
   * F5; nunca entra na persistência do BOARD nem é aceito vindo do cliente.
   */
  peerId: string;
  peers: string[];
  /** Último aviso de recusa para a UI. Transitório: some no próximo comando. */
  error?: string;
  /** Histórico durável dos resultados de comandos enviados ao Mestre. */
  commandLog: RemoteCommandResult[];
}

export interface PendingPower {
  id: "golpe-divino" | "ataque-especial";
  name: string;
  pmCost: number;
  attackBonus: number;
  extraDamage?: string;
}

/** Rolagem do raio da tempestade: 1d10, raio só no 1 (10%). */
export interface WeatherRoll { id: string; round: number; d10: number; struck?: string; damage?: number }
