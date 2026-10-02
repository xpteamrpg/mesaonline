import { objectForPlayer, wallForPlayer } from "./chest";
import { coveredCells, tokenCovers } from "./tokenSize";
import { deliverSignal, sanitizeSignal, signalAllowedFrom, type Signal } from "./signals";
import { jukeboxSignal } from "./jukeboxSync";
import { jukeboxState } from "./jukebox";
import { chunksFor, receiveAudioChunk, sharedIdForBlobUrl, sharedIdFromUrl } from "./sharedAudio";
import type { StageMedia } from "./stageMedia";
import { type FogSettings, fogForVision, fogSettings, visionForTokens } from "./vision";
import { DEFAULT_MAPS } from "./data";
import { ArmadaMultiplayer, type RuntimeCommand, type RuntimeCommandContext } from "./multiplayer";
import { readSession } from "./peerIdentity";
import { isTokenOwnedByPeer } from "./permissions";
import type {
  BattleLogEntry,
  BattleMap,
  BoardLight,
  BoardObject,
  BoardShape,
  BoardState,
  BoardToken,
  BoardWall,
  ChatMessage,
  CombatState,
  DiceResolution,
  MultiplayerState,
  RemoteCommandResult,
  RuntimeSnapshot,
  SceneState,
  TerrainType,
  TurnResources,
} from "./types";
import { type GridSettings, setActiveGrid } from "./distance";
import { floorOf, moveTokenToFloor as moveTokenAcrossFloors } from "./floors";
import { advanceDay, resetAfterEncounter, travelState , startTrip, type TravelEvent } from "./travel";
import { captureHistory, popRedo, popUndo, runWithoutHistory } from "./history";
import { persistTokenVitalsToSheet, syncAllTokensFromSheets } from "../integration/tokenVitalsSync";

export const ARMADA_BRIDGE_VERSION = 2;
export const RUNTIME_STORAGE_KEY = "modernrpg_armada_runtime_v1";
const RECENT_TABLES_KEY = "modernrpg_armada_recent_tables_v1";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

function defaultResources(): TurnResources {
  return { standard: 1, movement: 1, full: 1, free: 99, reaction: 1 };
}

function createBoard(map: BattleMap = DEFAULT_MAPS[0]): BoardState {
  return {
    id: `board-${map.id}`,
    map: clone(map),
    tokens: [],
    walls: [],
    lights: [],
    shapes: [],
    objects: [],
    fog: [],
    explored: [],
    weather: "clear",
    chat: [{ id: uid("chat"), author: "Armada", text: "Mesa pronta para explorar.", kind: "system", timestamp: Date.now() }],
    selectedTokenIds: [],
    targetedTokenIds: [],
    revision: 1,
  };
}

function createCombatState(): CombatState {
  return {
    active: false,
    round: 0,
    activeTokenId: null,
    order: [],
    combatants: [],
    resources: {},
    log: [],
    rolls: [],
    revision: 1,
  };
}

function defaultScene(): SceneState {
  const board = createBoard();
  return { id: "scene-taverna", name: board.map.name, board, updatedAt: new Date().toISOString() };
}

interface PersistedRuntime {
  scenes: SceneState[];
  activeSceneId: string;
  combat: CombatState;
  revision: number;
}

function loadRuntime(): PersistedRuntime {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(RUNTIME_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<PersistedRuntime>;
        if (Array.isArray(data.scenes) && data.scenes.length) {
          // A mídia mostrada no palco é de uma sessão só: o arquivo dela não sobrevive a recarregar a página.
          const scenes = data.scenes.map((scene) => normalizeScene({ ...scene, board: { ...scene.board, stageMedia: undefined, travelEvent: undefined } }));
          const activeSceneId = scenes.some((scene) => scene.id === data.activeSceneId) ? data.activeSceneId! : scenes[0].id;
          return {
            scenes,
            activeSceneId,
            combat: normalizeCombat(data.combat),
            revision: Number(data.revision) || 1,
          };
        }
      }
    } catch (error) {
      console.warn("Estado da mesa inválido; uma mesa limpa foi aberta.", error);
    }
  }
  const scene = defaultScene();
  return { scenes: [scene], activeSceneId: scene.id, combat: createCombatState(), revision: 1 };
}

function normalizeScene(scene: SceneState): SceneState {
  const fallback = createBoard(scene?.board?.map || DEFAULT_MAPS[0]);
  const board = scene?.board || fallback;
  return {
    id: scene?.id || uid("scene"),
    name: scene?.name || board.map?.name || "Cena",
    group: typeof scene?.group === "string" && scene.group.trim() ? scene.group.trim() : undefined,
    updatedAt: scene?.updatedAt || new Date().toISOString(),
    board: {
      ...fallback,
      ...board,
      map: { ...fallback.map, ...(board.map || {}) },
      tokens: Array.isArray(board.tokens) ? board.tokens : [],
      walls: Array.isArray(board.walls) ? board.walls : [],
      lights: Array.isArray(board.lights) ? board.lights : [],
      shapes: Array.isArray(board.shapes) ? board.shapes : [],
      objects: Array.isArray(board.objects) ? board.objects : [],
      fog: Array.isArray(board.fog) ? board.fog : [],
      explored: Array.isArray(board.explored) ? board.explored : [],
      chat: Array.isArray(board.chat) ? board.chat : [],
      selectedTokenIds: Array.isArray(board.selectedTokenIds) ? board.selectedTokenIds : [],
      targetedTokenIds: Array.isArray(board.targetedTokenIds) ? board.targetedTokenIds : [],
    },
  };
}

function normalizeCombat(value?: Partial<CombatState>): CombatState {
  const fallback = createCombatState();
  return {
    ...fallback,
    ...(value || {}),
    order: Array.isArray(value?.order) ? value!.order! : [],
    combatants: Array.isArray(value?.combatants) ? value!.combatants! : [],
    resources: value?.resources && typeof value.resources === "object" ? value.resources : {},
    log: Array.isArray(value?.log) ? value!.log! : [],
    rolls: Array.isArray(value?.rolls) ? value!.rolls! : [],
  };
}

const loaded = loadRuntime();
/** Único BOARD efetivo do app final. */
export let BOARD: BoardState = loaded.scenes.find((scene) => scene.id === loaded.activeSceneId)!.board;
/** Único conjunto SCENES; BOARD aponta para board da cena ativa. */
export let SCENES: SceneState[] = loaded.scenes;
/** Único combatState compartilhado entre exploração e Tactics. */
export let combatState: CombatState = loaded.combat;
let activeSceneId = loaded.activeSceneId;
let runtimeRevision = loaded.revision;
let multiplayerState: MultiplayerState = { role: "local", status: "disconnected", roomCode: "", peerId: "", peers: [], commandLog: [] };
let applyingRemote = false;
const listeners = new Set<() => void>();
type RemoteCommandHandler = (args: unknown[], context: RuntimeCommandContext) => unknown;
const remoteCommandHandlers = new Map<string, RemoteCommandHandler>();
let cachedSnapshot: RuntimeSnapshot;

function snapshotNow(): RuntimeSnapshot {
  return {
    board: clone(BOARD),
    scenes: clone(SCENES),
    activeSceneId,
    combat: clone(combatState),
    multiplayer: { ...multiplayerState, peers: [...multiplayerState.peers], commandLog: [...multiplayerState.commandLog] },
    revision: runtimeRevision,
  };
}

cachedSnapshot = snapshotNow();

function persisted(): PersistedRuntime {
  return { scenes: SCENES, activeSceneId, combat: combatState, revision: runtimeRevision };
}

function saveAndNotify(options: { broadcast?: boolean; persist?: boolean } = {}) {
  runtimeRevision += 1;
  cachedSnapshot = snapshotNow();
  if (options.persist !== false && typeof window !== "undefined") {
    try { localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(persisted())); }
    catch (error) { console.warn("Não foi possível persistir a mesa.", error); }
  }
  listeners.forEach((listener) => listener());
  if (!applyingRemote && options.broadcast !== false) multiplayer.broadcast();
}

function replaceActiveBoard(next: BoardState, options?: { persistVitals?: BoardToken[]; skipHistory?: boolean; historyLabel?: string }) {
  // Funil unico de escrita: e aqui que o historico captura o estado anterior.
  if (!options?.skipHistory) captureHistory(BOARD, options?.historyLabel);
  BOARD = { ...next, revision: (next.revision || 0) + 1 };
  setActiveGrid(BOARD.grid);
  SCENES = SCENES.map((scene) => scene.id === activeSceneId
    ? { ...scene, name: BOARD.map.name || scene.name, board: BOARD, updatedAt: new Date().toISOString() }
    : scene);
  options?.persistVitals?.forEach(persistTokenVitalsToSheet);
  saveAndNotify();
}

function mutateBoard(mutator: (board: BoardState) => BoardState, vitals: BoardToken[] = []) {
  replaceActiveBoard(mutator(BOARD), { persistVitals: vitals });
}

function forward(command: string, args: unknown[]): boolean {
  return multiplayer.request(command, ...args);
}

/** Registra operações compostas executadas autoritativamente pelo Mestre. */
export function registerRemoteCommand(name: string, handler: RemoteCommandHandler): () => void {
  remoteCommandHandlers.set(name, handler);
  return () => { if (remoteCommandHandlers.get(name) === handler) remoteCommandHandlers.delete(name); };
}

/** Envia uma operação composta quando esta instância é Jogador. */
export function requestRemoteCommand(name: string, ...args: unknown[]): boolean {
  return forward(name, args);
}

export function subscribeRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRuntimeSnapshot(): RuntimeSnapshot {
  return cachedSnapshot;
}

/** Desfaz a ultima edicao de cena do Mestre. */
export function undoBoard(): boolean {
  // Segurança no runtime: desabilitar o botão não basta para uma aba Jogador.
  if (multiplayerState.role === "player") return false;
  const entrada = popUndo(BOARD);
  if (!entrada) return false;
  runWithoutHistory(() => replaceActiveBoard(entrada.board, { skipHistory: true }));
  return true;
}

/** Refaz a edicao desfeita. */
export function redoBoard(): boolean {
  if (multiplayerState.role === "player") return false;
  const entrada = popRedo(BOARD);
  if (!entrada) return false;
  runWithoutHistory(() => replaceActiveBoard(entrada.board, { skipHistory: true }));
  return true;
}

export function getBoard(): BoardState {
  return BOARD;
}

export function getTokens(): BoardToken[] {
  return BOARD.tokens;
}

export function getScenes(): SceneState[] {
  return SCENES;
}

export function getCombatState(): CombatState {
  return combatState;
}

export function getActiveSceneId(): string {
  return activeSceneId;
}

export function syncBoard(next?: BoardState): BoardState {
  if (next) replaceActiveBoard(normalizeScene({ id: activeSceneId, name: next.map.name, board: next, updatedAt: "" }).board);
  else saveAndNotify();
  return BOARD;
}

export function syncCombat(next?: CombatState): CombatState {
  if (next) combatState = normalizeCombat(next);
  combatState = { ...combatState, revision: combatState.revision + 1 };
  saveAndNotify();
  return combatState;
}

export function moveToken(tokenId: string, gx: number, gy: number): BoardToken {
  if (forward("moveToken", [tokenId, gx, gy])) return getRequiredToken(tokenId);
  if (!Number.isInteger(gx) || !Number.isInteger(gy) || gx < 0 || gy < 0 || gx >= BOARD.map.cols || gy >= BOARD.map.rows) {
    throw new Error("Destino fora do mapa.");
  }
  const token = getRequiredToken(tokenId);
  const partnerId = token.mountId || token.riderId;
  // O bloco que ocupa é o da montaria quando o cavaleiro anda (Grande 2x2, Enorme 3x3, Colossal 6x6).
  const bearer = (token.mountId && BOARD.tokens.find((entry) => entry.id === token.mountId)) || token;
  const footprint = coveredCells(bearer, { x: gx, y: gy });
  if (footprint.some((cell) => cell.x >= BOARD.map.cols || cell.y >= BOARD.map.rows)) throw new Error("O token não cabe nesse ponto do mapa.");
  if (BOARD.tokens.some((entry) => entry.id !== tokenId && entry.id !== partnerId && floorOf(entry) === floorOf(token) && !entry.hidden && !entry.defeated && footprint.some((cell) => tokenCovers(entry, cell.x, cell.y)))) {
    throw new Error("A célula está ocupada.");
  }
  if (BOARD.objects.some((object) => object.kind === "chest" && !object.opened && floorOf(object) === floorOf(token) && footprint.some((cell) => cell.x === object.x && cell.y === object.y))) {
    throw new Error("Há um baú fechado nessa célula.");
  }
  const moved = { ...token, gx, gy };
  // Montaria: o par anda junto (legado: seguirMontaria).
  mutateBoard((board) => ({ ...board, tokens: board.tokens.map((entry) => entry.id === tokenId ? moved : entry.id === partnerId ? { ...entry, gx, gy } : entry) }));
  return moved;
}

/**
 * Transição espacial entre níveis. O token mantém as coordenadas do plano,
 * mas passa a pertencer a outro conjunto de colisão, visão, luz e fog.
 */
export function moveTokenToFloor(tokenId: string, floor: number): BoardToken {
  if (forward("moveTokenToFloor", [tokenId, floor])) return getRequiredToken(tokenId);
  if (multiplayerState.role === "player") throw new Error("Somente o Mestre pode mover tokens entre andares.");
  if (!Number.isInteger(floor)) throw new Error("Andar inválido.");
  const current = getRequiredToken(tokenId);
  const next = moveTokenAcrossFloors(current, floor);
  mutateBoard((board) => ({ ...board, tokens: board.tokens.map((token) => token.id === tokenId ? next : token) }));
  return next;
}

/** Registro do Diário: não entra na pilha de desfazer (desfazer deve desfazer a ação, não a mensagem). */
function logToJournal(text: string): void {
  runWithoutHistory(() => { appendChat({ author: "Sistema", text, kind: "system" }); });
}

export function updateToken(tokenId: string, patch: Partial<BoardToken>): BoardToken {
  if (forward("updateToken", [tokenId, patch])) return getRequiredToken(tokenId);
  const current = getRequiredToken(tokenId);
  const next: BoardToken = {
    ...current,
    ...patch,
    id: current.id,
    modernRpgCharacterId: patch.modernRpgCharacterId ?? current.modernRpgCharacterId,
    hp: Math.max(0, Number(patch.hp ?? current.hp)),
    hpMax: Math.max(0, Number(patch.hpMax ?? current.hpMax)),
    pm: Math.max(0, Number(patch.pm ?? current.pm)),
    pmMax: Math.max(0, Number(patch.pmMax ?? current.pmMax)),
  };
  next.defeated = next.hp <= 0;
  const shouldSyncVitals = Boolean(next.modernRpgCharacterId && (
    next.hp !== current.hp || next.hpMax !== current.hpMax || next.pm !== current.pm || next.pmMax !== current.pmMax
    || JSON.stringify(next.conditions || []) !== JSON.stringify(current.conditions || [])
  ));
  mutateBoard(
    (board) => ({ ...board, tokens: board.tokens.map((token) => token.id === tokenId ? next : token) }),
    shouldSyncVitals ? [next] : [],
  );
  // Diário: tudo o que acontece com o token fica registrado (condições e queda).
  const before = new Set(current.conditions || []);
  const after = new Set(next.conditions || []);
  for (const condition of after) if (!before.has(condition)) logToJournal(`${next.name} ganhou a condição ${condition}.`);
  for (const condition of before) if (!after.has(condition)) logToJournal(`${next.name} perdeu a condição ${condition}.`);
  if (!current.defeated && next.defeated) logToJournal(`${next.name} caiu (0 PV).`);
  if (current.defeated && !next.defeated) logToJournal(`${next.name} se recuperou.`);
  if (!current.defeated && next.defeated) defeatListeners.forEach((listener) => listener(next));
  return next;
}

type DefeatListener = (token: BoardToken) => void;
const defeatListeners = new Set<DefeatListener>();

/** Avisa quando um token passa a derrotado (PV chegou a 0), no lado que aplicou a mudança. */
export function onTokenDefeated(listener: DefeatListener): () => void {
  defeatListeners.add(listener);
  return () => { defeatListeners.delete(listener); };
}

export function addToken(token: BoardToken): BoardToken {
  if (forward("addToken", [token])) return token;
  if (BOARD.tokens.some((entry) => entry.id === token.id)) throw new Error("Já existe um token com esse ID.");
  mutateBoard((board) => ({ ...board, tokens: [...board.tokens, token] }));
  logToJournal(`${token.name} entrou na cena.`);
  return token;
}

/**
 * Mestre: esvazia a mesa. "tokens" tira só os personagens e criaturas; "tudo" também tira objetos (itens, baús, armadilhas),
 * áreas, gatilhos e luzes e encerra o combate. O mapa, as paredes e o terreno ficam. Pode ser desfeito em Desfazer.
 */
export function clearTable(what: "tokens" | "tudo" = "tudo"): void {
  if (multiplayerState.role === "player") throw new Error("Somente o Mestre limpa a mesa.");
  if (combatState.active) endCombat();
  mutateBoard((board) => ({
    ...board,
    tokens: [],
    selectedTokenIds: [],
    targetedTokenIds: [],
    ...(what === "tudo" ? { objects: [], shapes: [], lights: [] } : {}),
  }));
  logToJournal(what === "tudo" ? "O Mestre limpou a mesa (tokens, objetos, áreas e luzes)." : "O Mestre removeu todos os tokens da mesa.");
}

export function removeToken(tokenId: string): void {
  if (forward("removeToken", [tokenId])) return;
  const leaving = BOARD.tokens.find((token) => token.id === tokenId);
  if (leaving) logToJournal(`${leaving.name} saiu da cena.`);
  mutateBoard((board) => ({
    ...board,
    tokens: board.tokens.filter((token) => token.id !== tokenId),
    selectedTokenIds: board.selectedTokenIds.filter((id) => id !== tokenId),
    targetedTokenIds: board.targetedTokenIds.filter((id) => id !== tokenId),
  }));
  if (combatState.order.includes(tokenId)) {
    combatState = {
      ...combatState,
      order: combatState.order.filter((id) => id !== tokenId),
      combatants: combatState.combatants.filter((entry) => entry.tokenId !== tokenId),
      resources: Object.fromEntries(Object.entries(combatState.resources).filter(([id]) => id !== tokenId)),
    };
    syncCombat(combatState);
  }
}

export function selectToken(tokenId: string | null): void {
  const selectedTokenIds = tokenId ? [tokenId] : [];
  mutateBoard((board) => ({ ...board, selectedTokenIds }));
}

export function targetTokens(tokenIds: string[]): void {
  mutateBoard((board) => ({ ...board, targetedTokenIds: [...new Set(tokenIds)] }));
}

export function updateMap(map: BattleMap): void {
  if (forward("updateMap", [map])) return;
  mutateBoard((board) => ({ ...board, map: clone(map), id: board.id || `board-${map.id}` }));
}

export function setFog(cells: Iterable<string>): void {
  const fog = [...new Set(cells)];
  if (forward("setFog", [fog])) return;
  mutateBoard((board) => ({ ...board, fog }));
}

export function setExplored(cells: Iterable<string>): void {
  const explored = [...new Set(cells)];
  if (forward("setExplored", [explored])) return;
  mutateBoard((board) => ({ ...board, explored }));
}

export function upsertWall(wall: BoardWall): void {
  if (forward("upsertWall", [wall])) return;
  mutateBoard((board) => ({ ...board, walls: [...board.walls.filter((entry) => entry.id !== wall.id), wall] }));
}

/** Troca todas as paredes automáticas do andar pelas novas (uma única ação no histórico). Sem `segments`, só remove as antigas. */
export function setAutoWalls(segments: Array<{ x1: number; y1: number; x2: number; y2: number }>, floor = 0): number {
  if (forward("setAutoWalls", [segments, floor])) return segments.length;
  const stamp = Date.now();
  mutateBoard((board) => ({
    ...board,
    walls: [
      ...board.walls.filter((wall) => !(wall.auto && Math.trunc(wall.floor ?? 0) === floor)),
      ...segments.map((segment, index): BoardWall => ({ id: `wall-auto-${stamp}-${index}`, floor, type: "wall", name: "Parede (auto)", auto: true, ...segment })),
    ],
  }));
  return segments.length;
}

export function removeWall(wallId: string): void {
  if (forward("removeWall", [wallId])) return;
  mutateBoard((board) => ({ ...board, walls: board.walls.filter((entry) => entry.id !== wallId) }));
}

export function setWalls(walls: BoardWall[]): void {
  if (forward("setWalls", [walls])) return;
  mutateBoard((board) => ({ ...board, walls: clone(walls) }));
}

export function upsertLight(light: BoardLight): void {
  if (forward("upsertLight", [light])) return;
  mutateBoard((board) => ({ ...board, lights: [...board.lights.filter((entry) => entry.id !== light.id), light] }));
}

export function removeLight(lightId: string): void {
  if (forward("removeLight", [lightId])) return;
  mutateBoard((board) => ({ ...board, lights: board.lights.filter((entry) => entry.id !== lightId) }));
}

export function setShapes(shapes: BoardShape[]): void {
  if (forward("setShapes", [shapes])) return;
  mutateBoard((board) => ({ ...board, shapes: clone(shapes) }));
}

export function setObjects(objects: BoardObject[]): void {
  if (forward("setObjects", [objects])) return;
  mutateBoard((board) => ({ ...board, objects: clone(objects) }));
}

/** Atualiza uma entidade de mapa persistida (baú, tesouro ou item). */
export function updateBoardObject(objectId: string, patch: Partial<BoardObject>): BoardObject {
  if (forward("updateBoardObject", [objectId, patch])) {
    const current = BOARD.objects.find((entry) => entry.id === objectId);
    if (!current) throw new Error("Objeto não encontrado.");
    return current;
  }
  if (multiplayerState.role === "player") throw new Error("Somente o Mestre pode editar objetos da cena.");
  const current = BOARD.objects.find((entry) => entry.id === objectId);
  if (!current) throw new Error("Objeto não encontrado.");
  const next: BoardObject = { ...current, ...patch, id: current.id, floor: patch.floor ?? current.floor };
  mutateBoard((board) => ({ ...board, objects: board.objects.map((entry) => entry.id === objectId ? next : entry) }));
  return next;
}

/** Abre/fecha objeto interativo, recusando um baú trancado. */
export function interactBoardObject(objectId: string): BoardObject {
  const current = BOARD.objects.find((entry) => entry.id === objectId);
  if (!current) throw new Error("Objeto não encontrado.");
  if (current.locked) throw new Error(`${current.name} está trancado.`);
  return updateBoardObject(objectId, current.opened ? { opened: false } : { opened: true, revealAt: Date.now() });
}

/** Mestre: mostra uma imagem ou vídeo para todos, por cima do mapa. O Diário registra o que foi mostrado. */
export function showStageMedia(media: StageMedia): void {
  if (multiplayerState.role === "player") throw new Error("Só o Mestre mostra mídia no palco.");
  mutateBoard((board) => ({ ...board, stageMedia: media }));
  logToJournal(media.kind === "video" ? `Foi mostrado o vídeo “${media.name}”.` : `Foi mostrada a imagem “${media.name}”.`);
}

/** Mestre: fecha a mídia do palco para todos. */
export function closeStageMedia(): void {
  if (multiplayerState.role === "player") throw new Error("Só o Mestre fecha a mídia do palco.");
  if (!BOARD.stageMedia) return;
  mutateBoard((board) => ({ ...board, stageMedia: undefined }));
}

export function setWeather(weather: BoardState["weather"]): void {
  if (forward("setWeather", [weather])) return;
  mutateBoard((board) => ({ ...board, weather }));
}

/** Pinta terreno/elevacao nas celulas. O motor de movimento ja consome isso. */
export function setTerrain(cells: Iterable<string>, type: TerrainType, elevation?: number): void {
  const list = Array.from(cells);
  if (forward("setTerrain", [list, type, elevation])) return;
  mutateBoard((board) => {
    const terrain = { ...board.map.terrain };
    for (const key of list) {
      if (type === "normal" && !elevation) delete terrain[key];
      else terrain[key] = { type, elevation: elevation ?? terrain[key]?.elevation ?? 0 };
    }
    return { ...board, map: { ...board.map, terrain } };
  });
}

/** Escala/metrica/tipo da grade. Vale para regua, movimento, alcance e areas. */
export function setGridSettings(partial: Partial<GridSettings>): void {
  if (forward("setGridSettings", [partial])) return;
  mutateBoard((board) => {
    const proximo = { ...(board.grid || {}), ...partial };
    setActiveGrid(proximo);
    return { ...board, grid: proximo };
  });
}

/** Avanca um dia de viagem e registra no diario. */
export function advanceTravelDay(): void {
  if (forward("advanceTravelDay", [])) return;
  const { next, message } = advanceDay(travelState(BOARD.travel));
  mutateBoard((board) => ({ ...board, travel: next }));
  appendChat({ author: "Viagem", text: message, kind: "system" });
}

/** Mestre: começa uma viagem de N dias, com o mapa (cena) já preparado para o encontro. */
export function startTravel(plannedDays: number, sceneId?: string): void {
  if (forward("startTravel", [plannedDays, sceneId])) return;
  const next = startTrip(travelState(BOARD.travel), plannedDays, sceneId);
  mutateBoard((board) => ({ ...board, travel: next }));
  appendChat({ author: "Viagem", text: `A viagem de ${next.planned} dias começou.`, kind: "system" });
}

/** Mestre: escolhe o mapa do encontro da viagem. */
export function setTravelScene(sceneId?: string): void {
  if (forward("setTravelScene", [sceneId])) return;
  mutateBoard((board) => ({ ...board, travel: { ...travelState(board.travel), sceneId } }));
}

/** Mestre: mostra no palco, para todos, que houve um encontro na viagem. */
export function showTravelEvent(event: Omit<TravelEvent, "id">): void {
  if (multiplayerState.role === "player") throw new Error("Só o Mestre mostra o encontro da viagem.");
  mutateBoard((board) => ({ ...board, travelEvent: { ...event, id: uid("viagem") } }));
}

export function closeTravelEvent(): void {
  if (multiplayerState.role === "player") throw new Error("Só o Mestre fecha o encontro da viagem.");
  if (!BOARD.travelEvent) return;
  mutateBoard((board) => ({ ...board, travelEvent: undefined }));
}

/** Zera o contador apos um encontro. */
export function resetTravelEncounter(): void {
  if (forward("resetTravelEncounter", [])) return;
  const { next, message } = resetAfterEncounter(travelState(BOARD.travel));
  mutateBoard((board) => ({ ...board, travel: next }));
  appendChat({ author: "Viagem", text: message, kind: "system" });
}

/** Troca o andar visivel da cena. */
export function setActiveFloor(floor: number): void {
  if (forward("setActiveFloor", [floor])) return;
  mutateBoard((board) => ({ ...board, activeFloor: Math.trunc(floor) }));
}

export function setLighting(lighting: BoardState["lighting"]): void {
  if (forward("setLighting", [lighting])) return;
  mutateBoard((board) => ({ ...board, lighting }));
}

export function setFogSettings(settings: Partial<FogSettings>): void {
  if (forward("setFogSettings", [settings])) return;
  mutateBoard((board) => ({ ...board, fogSettings: { ...fogSettings(board.fogSettings), ...settings } }));
}

/** Marca celulas como exploradas (usado quando "Explorar ao mover" esta ativo). */
export function markExplored(cells: Iterable<string>): void {
  if (forward("markExplored", [Array.from(cells)])) return;
  mutateBoard((board) => ({ ...board, explored: Array.from(new Set([...board.explored, ...cells])) }));
}

export function appendChat(message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage {
  const entry: ChatMessage = { ...message, id: uid("chat"), timestamp: Date.now() };
  if (forward("appendChat", [message])) return entry;
  mutateBoard((board) => ({ ...board, chat: [...board.chat, entry].slice(-200) }));
  return entry;
}

export function appendCombatLog(entry: Omit<BattleLogEntry, "id" | "timestamp">): BattleLogEntry {
  const complete: BattleLogEntry = { ...entry, id: uid("log"), timestamp: Date.now() };
  combatState = { ...combatState, log: [complete, ...combatState.log].slice(0, 100), revision: combatState.revision + 1 };
  saveAndNotify();
  return complete;
}

export function appendRoll(resolution: DiceResolution): void {
  combatState = { ...combatState, rolls: [resolution, ...combatState.rolls].slice(0, 100), revision: combatState.revision + 1 };
  // Em mesa online o Jogador encaminha o registro ao Mestre pelo chat. Também
  // notificamos a UI local para a rolagem aparecer imediatamente no histórico
  // daquela aba, sem permitir que o cliente publique um snapshot autoritativo.
  saveAndNotify({ persist: false, broadcast: false });
  appendChat({ author: resolution.actor, text: `${resolution.action}: ${resolution.formula} → ${resolution.total} (${resolution.outcome})`, kind: "roll" });
}

/** Limpa apenas registros de rolagem; logs de combate e narrativa permanecem. */
export function clearRollHistory(): void {
  if (multiplayerState.role === "player") {
    appendChat({ author: "Sistema", text: "Somente o Mestre pode limpar o histórico compartilhado de rolagens.", kind: "system" });
    return;
  }
  BOARD = { ...BOARD, chat: BOARD.chat.filter((entry) => entry.kind !== "roll"), revision: BOARD.revision + 1 };
  SCENES = SCENES.map((scene) => scene.id === activeSceneId ? { ...scene, board: BOARD, updatedAt: new Date().toISOString() } : scene);
  combatState = { ...combatState, rolls: [], revision: combatState.revision + 1 };
  saveAndNotify();
}

export function startCombat(): CombatState {
  if (forward("startCombat", [])) return combatState;
  const eligible = BOARD.tokens.filter((token) => !token.hidden && !token.defeated);
  if (!eligible.length) throw new Error("Adicione tokens antes de iniciar o combate.");
  const rolled = eligible.map((token) => ({ token, initiative: rollDie(20) + token.initiative }));
  rolled.sort((a, b) => b.initiative - a.initiative || a.token.name.localeCompare(b.token.name));
  const order = rolled.map((entry) => entry.token.id);
  const resources = Object.fromEntries(order.map((id) => [id, defaultResources()]));
  const initiativeById = new Map(rolled.map((entry) => [entry.token.id, entry.initiative]));
  // Iniciar combate sempre recomeça do zero: rolagens, registro, reações e efeitos de um combate anterior saem de cena
  // (só os efeitos de longa duração continuam), e todos os tokens visíveis e vivos rolam iniciativa.
  BOARD = {
    ...BOARD,
    tokens: BOARD.tokens.map((token) => initiativeById.has(token.id)
      ? { ...token, initiativeRoll: initiativeById.get(token.id)!, effects: token.effects?.filter((effect) => effect.kind === "long") }
      : token),
    selectedTokenIds: order[0] ? [order[0]] : [],
  };
  SCENES = SCENES.map((scene) => scene.id === activeSceneId ? { ...scene, board: BOARD } : scene);
  combatState = {
    active: true,
    round: 1,
    activeTokenId: order[0] || null,
    order,
    combatants: rolled.map((entry) => ({ tokenId: entry.token.id, initiative: entry.initiative, conditions: [...(entry.token.conditions || [])] })),
    resources,
    log: [{ id: uid("log"), type: "initiative", title: "Combate iniciado", detail: `${rolled[0]?.token.name || "—"} age primeiro.`, tone: "success", timestamp: Date.now() }],
    rolls: [
      ...rolled.map((entry): DiceResolution => ({
        id: uid("initiative"), actor: entry.token.name, target: "Ordem de iniciativa", action: "Iniciativa", kind: "system",
        modifier: entry.token.initiative, total: entry.initiative, formula: `1d20 + ${entry.token.initiative}`,
        rolls: [entry.initiative - entry.token.initiative], outcome: `Iniciativa ${entry.initiative}`, success: true, timestamp: Date.now(),
      })),
    ],
    pendingReaction: undefined,
    revision: combatState.revision + 1,
  };
  notifyTurnStarted(combatState.activeTokenId, combatState.round);
  saveAndNotify();
  return combatState;
}

/**
 * Mestre: corrige o número da iniciativa de um combatente. A ordem do combate se reorganiza
 * pelo novo valor (empate desempata pelo nome, como no início do combate); quem está no turno continua nele.
 */
export function setInitiativeRoll(tokenId: string, value: number): void {
  if (multiplayerState.role === "player") throw new Error("Somente o Mestre pode editar a iniciativa.");
  if (!BOARD.tokens.some((token) => token.id === tokenId)) return;
  const initiative = Math.max(-99, Math.min(99, Math.trunc(Number(value) || 0)));
  BOARD = { ...BOARD, tokens: BOARD.tokens.map((token) => (token.id === tokenId ? { ...token, initiativeRoll: initiative } : token)) };
  SCENES = SCENES.map((scene) => (scene.id === activeSceneId ? { ...scene, board: BOARD } : scene));
  if (combatState.active) {
    const combatants = combatState.combatants.map((entry) => (entry.tokenId === tokenId ? { ...entry, initiative } : entry));
    const valueOf = new Map(combatants.map((entry) => [entry.tokenId, entry.initiative]));
    const nameOf = (id: string) => BOARD.tokens.find((token) => token.id === id)?.name || "";
    const order = [...combatState.order].sort((a, b) => (valueOf.get(b) ?? -999) - (valueOf.get(a) ?? -999) || nameOf(a).localeCompare(nameOf(b)));
    combatState = { ...combatState, combatants, order, revision: combatState.revision + 1 };
  }
  saveAndNotify();
}

/**
 * Início de turno.
 *
 * O bus de eventos táticos vive em tactics/engine/reactiveTriggers, que já
 * importa este módulo. Para não criar um ciclo de import, quem precisa reagir
 * ao início do turno se inscreve aqui; o bridge não conhece a camada tática.
 */
type TurnStartListener = (tokenId: string, round: number) => void;
const turnStartListeners = new Set<TurnStartListener>();

export function onTurnStarted(listener: TurnStartListener): () => void {
  turnStartListeners.add(listener);
  return () => { turnStartListeners.delete(listener); };
}

function notifyTurnStarted(tokenId: string | null, round: number): void {
  if (!tokenId) return;
  // Um assinante com defeito não pode travar a passagem de turno.
  turnStartListeners.forEach((listener) => { try { listener(tokenId, round); } catch { /* ignorado de propósito */ } });
}

export function endTurn(): CombatState {
  if (forward("endTurn", [])) return combatState;
  if (!combatState.active || !combatState.order.length) return combatState;
  if (combatState.pendingReaction) throw new Error("Aguarde a resposta da reação antes de encerrar o turno.");
  const living = combatState.order.filter((id) => {
    const token = BOARD.tokens.find((entry) => entry.id === id);
    return token && !token.defeated && token.hp > 0;
  });
  const index = Math.max(0, living.indexOf(combatState.activeTokenId || ""));
  const nextIndex = (index + 1) % living.length;
  const nextId = living[nextIndex] || null;
  const nextRound = nextIndex === 0 ? combatState.round + 1 : combatState.round;
  const resources = { ...combatState.resources, ...(nextId ? { [nextId]: defaultResources() } : {}) };
  combatState = { ...combatState, activeTokenId: nextId, round: nextRound, order: living, resources, revision: combatState.revision + 1 };
  // Antes de notificar a UI: é aqui que efeitos com duração em rodadas expiram.
  notifyTurnStarted(nextId, nextRound);
  if (nextId) selectToken(nextId); else saveAndNotify();
  return combatState;
}

export function endCombat(): CombatState {
  if (forward("endCombat", [])) return combatState;
  combatState = {
    ...combatState,
    active: false,
    round: 0,
    activeTokenId: null,
    order: [],
    combatants: [],
    resources: {},
    pendingReaction: undefined,
    revision: combatState.revision + 1,
  };
  BOARD = { ...BOARD, tokens: BOARD.tokens.map((token) => ({ ...token, effects: token.effects?.filter((effect) => effect.kind === "long") })) };
  SCENES = SCENES.map((scene) => scene.id === activeSceneId ? { ...scene, board: BOARD } : scene);
  saveAndNotify();
  return combatState;
}

export function switchScene(sceneId: string): BoardState {
  if (forward("switchScene", [sceneId])) return BOARD;
  const scene = SCENES.find((entry) => entry.id === sceneId);
  if (!scene) throw new Error("Cena não encontrada.");
  activeSceneId = scene.id;
  BOARD = scene.board;
  combatState = createCombatState();
  saveAndNotify();
  return BOARD;
}

export function createScene(map: BattleMap, name = map.name, group?: string): SceneState {
  if (forward("createScene", [map, name, group])) return { id: "pending", name, group, board: createBoard(map), updatedAt: new Date().toISOString() };
  const scene: SceneState = { id: uid("scene"), name, group: group?.trim() || undefined, board: createBoard({ ...map, id: map.id || uid("map") }), updatedAt: new Date().toISOString() };
  SCENES = [...SCENES, scene];
  activeSceneId = scene.id;
  BOARD = scene.board;
  combatState = createCombatState();
  saveAndNotify();
  return scene;
}

export function renameScene(sceneId: string, name: string): void {
  if (forward("renameScene", [sceneId, name])) return;
  const clean = name.trim();
  if (!clean) return;
  SCENES = SCENES.map((scene) => scene.id === sceneId ? { ...scene, name: clean, updatedAt: new Date().toISOString() } : scene);
  saveAndNotify();
}

/** Renomeia uma "cena" (grupo de mapas): todos os mapas dela passam para o novo nome. */
export function renameSceneGroup(oldName: string, newName: string): void {
  if (forward("renameSceneGroup", [oldName, newName])) return;
  const clean = newName.trim();
  if (!clean) return;
  SCENES = SCENES.map((scene) => ((scene.group?.trim() || "Cena 1") === oldName ? { ...scene, group: clean, updatedAt: new Date().toISOString() } : scene));
  saveAndNotify();
}

export function removeScene(sceneId: string): void {
  if (forward("removeScene", [sceneId])) return;
  if (SCENES.length <= 1) throw new Error("A mesa precisa manter ao menos uma cena.");
  SCENES = SCENES.filter((scene) => scene.id !== sceneId);
  if (activeSceneId === sceneId) {
    activeSceneId = SCENES[0].id;
    BOARD = SCENES[0].board;
    combatState = createCombatState();
  }
  saveAndNotify();
}

export function refreshLinkedCharacters(): void {
  const tokens = syncAllTokensFromSheets(BOARD.tokens);
  mutateBoard((board) => ({ ...board, tokens }));
}

export async function hostMultiplayer(code?: string): Promise<string> {
  const roomCode = await multiplayer.host(code);
  rememberTable(roomCode);
  return roomCode;
}

export async function joinMultiplayer(code: string): Promise<void> {
  await multiplayer.join(code);
  rememberTable(code.toUpperCase());
}

/** Mestre: expulsa um jogador conectado da sala. */
export function kickPlayer(peerId: string): boolean {
  return multiplayer.kick(peerId);
}

export function leaveMultiplayer(): void {
  multiplayer.disconnect();
}

/**
 * Último resultado devolvido pelo Mestre — registro durável, não apagado pelo
 * comando seguinte (diferente de `snapshot.multiplayer.error`).
 */
export function lastRemoteCommandResult(name?: string): RemoteCommandResult | null {
  return multiplayer.lastCommandResult(name);
}

let restoringSession: Promise<boolean> | null = null;

/**
 * Reentra sozinho na mesa depois de um F5, usando a identidade persistida.
 * É o que faz `controlledBy` continuar valendo sem reatribuição manual.
 * Sem sessão salva (ou já conectado) não faz nada.
 */
export function restoreMultiplayerSession(): Promise<boolean> {
  if (restoringSession) return restoringSession;
  if (multiplayerState.role !== "local") return Promise.resolve(false);
  const session = readSession();
  if (!session) return Promise.resolve(false);
  restoringSession = (async () => {
    try {
      if (session.role === "master") await multiplayer.host(session.roomCode);
      else await multiplayer.join(session.roomCode);
      return true;
    } catch {
      // Sala encerrada ou fora do ar: segue em mesa local em vez de travar.
      return false;
    } finally {
      restoringSession = null;
    }
  })();
  return restoringSession;
}

export function recentTables(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_TABLES_KEY) || "[]") as string[]; }
  catch { return []; }
}

function rememberTable(code: string) {
  try {
    const next = [code, ...recentTables().filter((entry) => entry !== code)].slice(0, 6);
    localStorage.setItem(RECENT_TABLES_KEY, JSON.stringify(next));
  } catch { /* sem armazenamento */ }
}

function getRequiredToken(tokenId: string): BoardToken {
  const token = BOARD.tokens.find((entry) => entry.id === tokenId);
  if (!token) throw new Error("Token não encontrado.");
  return token;
}

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

interface RuntimeWireState {
  scenes: SceneState[];
  activeSceneId: string;
  combat: CombatState;
  revision: number;
}

function wireState(): RuntimeWireState {
  return clone({ scenes: SCENES, activeSceneId, combat: combatState, revision: runtimeRevision });
}

/**
 * Recorte autoritativo enviado a UM jogador.
 *
 * Fog não pode depender de simplesmente esconder elementos no React: o BOARD
 * bruto contém inimigos, gatilhos, objetos e cenas que o peer não deveria nem
 * receber. Esta projeção é produzida no Mestre, antes do `DataConnection`.
 */
export function wireStateForPeer(peerId?: string): RuntimeWireState {
  if (!peerId) return wireState();
  const source = BOARD;
  const settings = fogSettings(source.fogSettings);
  const floor = Math.trunc(source.activeFloor ?? 0);
  const eyes = source.tokens.filter((token) => token.controlledBy === peerId && Math.trunc(token.floor ?? 0) === floor && !token.hidden && !token.defeated);
  const vision = visionForTokens(source, eyes, settings);
  const visible = vision.visible;
  const visibleCell = (x: number, y: number) => visible.has(`${x},${y}`);
  const isOwn = (token: BoardToken) => token.controlledBy === peerId;
  const tokenAllowed = (token: BoardToken) => Math.trunc(token.floor ?? 0) === floor
    && !token.hidden && (isOwn(token) || visibleCell(token.gx, token.gy));
  const visibleTokens = source.tokens.filter(tokenAllowed);
  const isVisibleShape = (shape: BoardState["shapes"][number]) =>
    Math.trunc(shape.floor ?? 0) === floor && shape.kind !== "trigger" && shape.cells.some((cell) => visible.has(cell));
  const covered = new Set(source.fog);
  if (settings.playerFogEnabled) for (const cell of fogForVision(source, visible, settings)) covered.add(cell);

  // Não revele áreas exploradas, paredes fora da visão, gatilhos nem objetos
  // ocultos. Mesmo inspeção de DevTools no cliente fica limitada a este estado.
  const board: BoardState = {
    ...clone(source),
    tokens: clone(visibleTokens),
    walls: clone(source.walls.filter((wall) => Math.trunc(wall.floor ?? 0) === floor && (visibleCell(Math.floor(wall.x1), Math.floor(wall.y1)) || visibleCell(Math.floor(wall.x2), Math.floor(wall.y2)))).map(wallForPlayer)),
    lights: clone(source.lights.filter((light) => Math.trunc(light.floor ?? 0) === floor && visibleCell(light.x, light.y))),
    shapes: clone(source.shapes.filter(isVisibleShape).map((shape) => ({ ...shape, cells: shape.cells.filter((cell) => visible.has(cell)), trigger: undefined }))),
    // Sem CD, sem conteúdo enquanto fechado e sem números da armadilha (game/chest.ts).
    objects: clone(source.objects.filter((object) => Math.trunc(object.floor ?? 0) === floor && visibleCell(object.x, object.y)).map(objectForPlayer)),
    fog: [...covered],
    explored: [],
    selectedTokenIds: [],
    targetedTokenIds: [],
    map: {
      ...clone(source.map),
      terrain: Object.fromEntries(Object.entries(source.map.terrain).filter(([cell]) => visible.has(cell))),
    },
    chat: clone(source.chat.filter((entry) => !entry.whisperTo || entry.whisperTo === peerId || entry.whisperFrom === peerId)),
  };
  const allowedIds = new Set(visibleTokens.map((token) => token.id));
  const combat: CombatState = {
    ...clone(combatState),
    activeTokenId: combatState.activeTokenId && allowedIds.has(combatState.activeTokenId) ? combatState.activeTokenId : null,
    order: combatState.order.filter((id) => allowedIds.has(id)),
    combatants: combatState.combatants.filter((entry) => allowedIds.has(entry.tokenId)),
    resources: Object.fromEntries(Object.entries(combatState.resources).filter(([id]) => allowedIds.has(id))),
    // Uma rolagem/log de criatura oculta também é informação oculta.
    log: [],
    rolls: [],
  };
  const scene: SceneState = { ...clone(SCENES.find((entry) => entry.id === activeSceneId)!), board };
  return { scenes: [scene], activeSceneId, combat, revision: runtimeRevision };
}

function applyWireState(payload: unknown) {
  const data = payload as Partial<RuntimeWireState>;
  if (!Array.isArray(data.scenes) || !data.scenes.length) return;
  applyingRemote = true;
  // Seleção e alvos são estado de UI DESTA aba, não do Mestre: sem preservá-los
  // qualquer broadcast (inclusive o eco do próprio patch do jogador) fechava o
  // painel de contexto ou o trocava pelo token selecionado no Mestre.
  const keptSelection = [...BOARD.selectedTokenIds];
  const keptTargets = [...BOARD.targetedTokenIds];
  try {
    SCENES = data.scenes.map(normalizeScene);
    activeSceneId = SCENES.some((scene) => scene.id === data.activeSceneId) ? data.activeSceneId! : SCENES[0].id;
    BOARD = SCENES.find((scene) => scene.id === activeSceneId)!.board;
    const alive = (id: string) => BOARD.tokens.some((token) => token.id === id);
    BOARD.selectedTokenIds = keptSelection.filter(alive);
    BOARD.targetedTokenIds = keptTargets.filter(alive);
    combatState = normalizeCombat(data.combat);
    runtimeRevision = Number(data.revision) || runtimeRevision;
    cachedSnapshot = snapshotNow();
    try { localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(persisted())); } catch { /* sem storage */ }
    listeners.forEach((listener) => listener());
  } finally {
    applyingRemote = false;
  }
}

function assertOwnedToken(peerId: string, tokenId: unknown): BoardToken {
  const token = getRequiredToken(String(tokenId || ""));
  if (!isTokenOwnedByPeer(token, peerId)) throw new Error("Você não controla este personagem.");
  return token;
}

function playerTokenPatch(value: unknown): Partial<BoardToken> {
  if (!value || typeof value !== "object") throw new Error("Atualização de token inválida.");
  const source = value as Partial<BoardToken>;
  const patch: Partial<BoardToken> = {};
  if (source.hp !== undefined) {
    const hp = Number(source.hp);
    if (!Number.isFinite(hp)) throw new Error("PV inválido.");
    patch.hp = hp;
  }
  if (source.pm !== undefined) {
    const pm = Number(source.pm);
    if (!Number.isFinite(pm)) throw new Error("PM inválido.");
    patch.pm = pm;
  }
  if (source.conditions !== undefined) {
    patch.conditions = Array.isArray(source.conditions)
      ? source.conditions.map((condition) => String(condition).trim().slice(0, 80)).filter(Boolean).slice(0, 30)
      : [];
  }
  if (!Object.keys(patch).length) throw new Error("Jogadores só podem atualizar PV, PM e condições do próprio personagem.");
  return patch;
}

/** O peer remetente vem da conexão mantida pelo Mestre, não do payload. */
function runRemoteCommand(command: RuntimeCommand, context: RuntimeCommandContext) {
  const registered = remoteCommandHandlers.get(command.name);
  if (registered) {
    registered(command.args, context);
    return;
  }
  if (command.name === "updateToken") {
    const [tokenId, patch] = command.args;
    assertOwnedToken(context.peerId, tokenId);
    updateToken(String(tokenId), playerTokenPatch(patch));
    return;
  }
  if (command.name === "appendChat") {
    const message = command.args[0] as Partial<ChatMessage> | undefined;
    const text = String(message?.text || "").trim().slice(0, 2000);
    if (!text) throw new Error("Mensagem vazia.");
    const kind = message?.kind === "roll" ? "roll" : "chat";
    const whisperTo = typeof message?.whisperTo === "string" && multiplayerState.peers.includes(message.whisperTo)
      ? message.whisperTo
      : undefined;
    appendChat({
      author: `Jogador ${context.peerId.slice(-6)}`,
      text,
      kind,
      ...(whisperTo ? { whisperTo, whisperFrom: context.peerId } : {}),
    });
    return;
  }
  throw new Error("Este comando exige autoridade do Mestre.");
}

/** Sinais efêmeros (ping e faixa): mostra aqui e manda pela conexão da sala. */
export function sendSignal(signal: Signal): void {
  deliverSignal(signal);
  multiplayer.signal(signal);
}

/** Mestre: manda o áudio escolhido no computador para todos os jogadores da sala. */
export async function shareAudioWithRoom(id: string): Promise<void> {
  await multiplayer.sendAudio(id, await chunksFor(id));
}

const multiplayer = new ArmadaMultiplayer({
  onAudio: (chunk) => receiveAudioChunk(chunk),
  initialAudio: async () => {
    // Quem entra na sala depois recebe a faixa que está tocando e a mídia que está no palco.
    const tracks = (() => { const id = sharedIdForBlobUrl(jukeboxState().url); return id ? chunksFor(id) : Promise.resolve([]); })();
    const mediaId = BOARD.stageMedia ? sharedIdFromUrl(BOARD.stageMedia.src) : null;
    return [...(await tracks), ...(mediaId ? await chunksFor(mediaId) : [])];
  },
  onSignal: (raw, fromMaster) => {
    const signal = sanitizeSignal(raw);
    if (!signal) return false;
    // No Mestre `fromMaster` é falso: quem manda é um jogador, que só pode dar ping.
    if (!signalAllowedFrom(signal, fromMaster)) return false;
    deliverSignal(signal);
    return true;
  },
  initialSignals: () => {
    const signal = jukeboxSignal();
    return signal ? [signal] : [];
  },
  getSnapshot: wireStateForPeer,
  applySnapshot: applyWireState,
  runCommand: runRemoteCommand,
  onState: (state) => {
    multiplayerState = state;
    cachedSnapshot = snapshotNow();
    listeners.forEach((listener) => listener());
  },
});

if (typeof window !== "undefined") {
  window.addEventListener("modernrpg-characters-changed", refreshLinkedCharacters);
  window.addEventListener("storage", (event) => {
    if (event.key === "tormenta20_online_characters_v2") refreshLinkedCharacters();
  });
}

/* ---------------- Compatibilidade de snapshots VTT importados ---------------- */
export interface ArmadaTokenSnapshot {
  id: string;
  name: string;
  gx: number;
  gy: number;
  hp: number;
  hpMax: number;
  pm: number;
  pmMax: number;
  defense: number;
  imageUrl?: string;
  conditions?: string[];
  controlledBy?: string;
  disposition?: string | number;
  isEnemy?: boolean;
  hidden?: boolean;
  modernRpgCharacterId?: string;
}

export interface ArmadaSceneSnapshot {
  version: number;
  sceneId: string;
  sceneName: string;
  roomId?: string;
  map: { image: string; cols: number; rows: number; scaleValue: number; scaleUnit: string };
  tokens: ArmadaTokenSnapshot[];
  fog?: string[];
}

export function isArmadaOpenMessage(value: unknown): value is { type: "vttarmada:tactics:open"; payload: ArmadaSceneSnapshot } {
  return Boolean(value && typeof value === "object" && (value as { type?: string }).type === "vttarmada:tactics:open");
}

export function importArmadaScene(snapshot: ArmadaSceneSnapshot): { map: BattleMap; tokens: BoardToken[]; fog: Set<string> } {
  const map: BattleMap = {
    id: `armada-${snapshot.sceneId}`,
    name: snapshot.sceneName || "Cena importada",
    location: snapshot.roomId ? `Sala ${snapshot.roomId}` : "ModernRPG Armada",
    image: snapshot.map.image,
    cols: Math.max(4, snapshot.map.cols || 20),
    rows: Math.max(4, snapshot.map.rows || 20),
    terrain: {},
    custom: true,
  };
  const tokens = snapshot.tokens.filter((token) => !token.hidden).map((token, index): BoardToken => ({
    id: token.id || uid("token"), name: token.name || `Token ${index + 1}`, title: token.isEnemy ? "Ameaça importada" : "Personagem importado",
    side: token.isEnemy || token.disposition === "hostile" || token.disposition === -1 ? "threats" : "heroes",
    gx: token.gx || 0, gy: token.gy || 0, symbol: (token.name || "TK").slice(0, 2).toUpperCase(), imageUrl: token.imageUrl,
    accent: token.isEnemy ? "#d2474d" : "#4ea6dc", hp: token.hp ?? 10, hpMax: token.hpMax ?? token.hp ?? 10,
    pm: token.pm ?? 0, pmMax: token.pmMax ?? token.pm ?? 0, defense: token.defense || 10,
    initiative: 0, initiativeRoll: 0, luta: 4, pontaria: 2, damage: "1d6+2", crit: 20, critMultiplier: 2,
    attackType: "melee", rangeM: 1.5, movementM: 9, level: 1, spellDC: 13, actionIds: [], tacticalActions: [],
    fortitude: 2, reflexes: 2, will: 2, conditions: token.conditions || [], controlledBy: token.controlledBy,
    modernRpgCharacterId: token.modernRpgCharacterId,
  }));
  return { map, tokens, fog: new Set(snapshot.fog || []) };
}

export function exportArmadaResult(sceneId: string, tokens: BoardToken[] = BOARD.tokens) {
  return {
    version: ARMADA_BRIDGE_VERSION,
    sceneId,
    tokens: tokens.map((token) => ({
      id: token.id, gx: token.gx, gy: token.gy, hp: token.hp, hpMax: token.hpMax,
      pm: token.pm, pmMax: token.pmMax, conditions: token.conditions || [], defeated: Boolean(token.defeated),
      controlledBy: token.controlledBy,
      modernRpgCharacterId: token.modernRpgCharacterId,
    })),
  };
}
