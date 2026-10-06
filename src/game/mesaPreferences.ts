import { useSyncExternalStore } from "react";
import { DEFAULT_GAME_SYSTEM, isAvailableSystem, type GameSystemId } from "./systems";

/**
 * Preferências pessoais da Mesa (só deste navegador): escala do mapa e modo da mesa.
 * Minimalista = a Mesa dourada e sóbria; Expandido = a versão com mais arte (azul-marinho, moldura de lava, dragões).
 * O modo vai para `<html data-table-mode>`: as cores de superfície trocam por variáveis CSS (src/modeColors.css) e a arte extra
 * do Expandido aparece só nele.
 */
export type TableMode = "minimal" | "expanded";

export interface MesaPreferences {
  /** mostra a régua de escala no canto do mapa (desligada por padrão) */
  showScale: boolean;
  tableMode: TableMode;
  /** sistema de RPG da mesa; só os disponíveis valem (hoje Tormenta 20) */
  gameSystem: GameSystemId;
}

const KEY = "mesa-preferences-v1";
const DEFAULTS: MesaPreferences = { showScale: false, tableMode: "minimal", gameSystem: DEFAULT_GAME_SYSTEM };

function read(): MesaPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      showScale: value.showScale === true,
      tableMode: value.tableMode === "expanded" ? "expanded" : "minimal",
      gameSystem: isAvailableSystem(value.gameSystem) ? value.gameSystem : DEFAULT_GAME_SYSTEM,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let current: MesaPreferences = read();

function applyTableMode(mode: TableMode): void {
  if (typeof document !== "undefined") document.documentElement.dataset.tableMode = mode;
}
applyTableMode(current.tableMode);

const listeners = new Set<() => void>();

export function getPreferences(): MesaPreferences {
  return current;
}

export function setPreferences(patch: Partial<MesaPreferences>): MesaPreferences {
  current = { ...current, ...patch };
  applyTableMode(current.tableMode);
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* armazenamento cheio */ }
  listeners.forEach((listener) => listener());
  return current;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function usePreferences(): MesaPreferences {
  return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences);
}
