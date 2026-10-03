import { useSyncExternalStore } from "react";
import type { BrushMode, LightPreset, MapToolId, TerrainBrush } from "../../game/mapTools";
import { nextRotation, type StageRotation, type StageViewMode } from "../../game/isoView";
import type { MoveMode } from "../../game/movementMode";

/**
 * Estado compartilhado entre o palco do mapa (MapStage) e a gaveta
 * Macros → Mapa e objetos: a gaveta escolhe a ferramenta, o palco a executa.
 * Fica fora da máscara para que ela não precise de nenhum controle novo.
 */
interface StageControl {
  tool: MapToolId;
  brush: BrushMode;
  terrain: TerrainBrush;
  /** tipo de luz que a ferramenta Luz coloca no próximo clique */
  lightPreset: LightPreset;
  /** Visão 2D ou isométrica e giro do mapa; é escolha de cada jogador, não sincroniza. */
  view: StageViewMode;
  rotation: StageRotation;
  /** objeto (baú) aberto no diálogo de interação */
  focusedObjectId: string | null;
  /** porta aberta no diálogo de interação */
  focusedDoorId: string | null;
  /** objeto que o Mestre pediu para configurar (o painel Ambientação abre o editor dele) */
  editObjectId: string | null;
  /** modo de movimento preferido (andar, voar, escavar); vale para o token que o tem */
  moveMode: MoveMode;
  /** Mestre: token pelos olhos do qual o mapa é mostrado (visão e neblina dele); só local, não sincroniza */
  viewAsTokenId: string | null;
}

let state: StageControl = { tool: "select", brush: "add", terrain: { type: "difficult", elevation: 0 }, lightPreset: "torch", view: "2d", rotation: 0, focusedObjectId: null, focusedDoorId: null, editObjectId: null, moveMode: "walk", viewAsTokenId: null };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach((listener) => listener());

export const getStageControl = () => state;
export function setStageTool(tool: MapToolId) { if (state.tool !== tool) { state = { ...state, tool }; emit(); } }
export function setStageBrush(brush: BrushMode) { state = { ...state, brush }; emit(); }
export function setStageTerrain(terrain: TerrainBrush) { state = { ...state, terrain }; emit(); }
export function setLightPreset(lightPreset: LightPreset) { if (state.lightPreset !== lightPreset) { state = { ...state, lightPreset }; emit(); } }
export function openObjectDialog(id: string) { state = { ...state, focusedObjectId: id }; emit(); }
export function closeObjectDialog() { if (state.focusedObjectId) { state = { ...state, focusedObjectId: null }; emit(); } }
/** Mestre: do diálogo do objeto vai para o editor dele na gaveta Ambientação. */
export function requestObjectEdit(id: string) { state = { ...state, focusedObjectId: null, editObjectId: id }; emit(); window.dispatchEvent(new CustomEvent("mesa:open-panel", { detail: "map-context" })); }
export function clearObjectEditRequest() { if (state.editObjectId) { state = { ...state, editObjectId: null }; emit(); } }
export function openDoorDialog(id: string) { state = { ...state, focusedDoorId: id }; emit(); }
export function closeDoorDialog() { if (state.focusedDoorId) { state = { ...state, focusedDoorId: null }; emit(); } }
export function setViewAs(viewAsTokenId: string | null) { if (state.viewAsTokenId !== viewAsTokenId) { state = { ...state, viewAsTokenId }; emit(); } }
export function setMoveMode(moveMode: MoveMode) { if (state.moveMode !== moveMode) { state = { ...state, moveMode }; emit(); } }
export function setStageView(view: StageViewMode) { if (state.view !== view) { state = { ...state, view }; emit(); } }
export function rotateStage(direction: 1 | -1) { state = { ...state, rotation: nextRotation(state.rotation, direction) }; emit(); }
export function useStageControl(): StageControl { return useSyncExternalStore(subscribe, getStageControl, getStageControl); }

export type CameraCommand = "zoomIn" | "zoomOut" | "fit" | "focus";
const cameraListeners = new Set<(command: CameraCommand) => void>();
export function sendCameraCommand(command: CameraCommand) { cameraListeners.forEach((listener) => listener(command)); }
export function onCameraCommand(listener: (command: CameraCommand) => void) { cameraListeners.add(listener); return () => { cameraListeners.delete(listener); }; }
