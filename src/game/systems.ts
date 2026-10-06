/**
 * Sistemas de RPG que o site vai abordar. Hoje só Tormenta 20 tem regras implementadas; D&D e Old Dragon aparecem
 * nas configurações como "em breve" (nenhuma regra deles foi trazida ainda, e nenhuma deve ser presumida).
 */
export type GameSystemId = "t20" | "dnd" | "olddragon";

export const GAME_SYSTEMS: ReadonlyArray<{ id: GameSystemId; name: string; available: boolean }> = [
  { id: "t20", name: "Tormenta 20", available: true },
  { id: "dnd", name: "D&D", available: false },
  { id: "olddragon", name: "Old Dragon", available: false },
];

export const DEFAULT_GAME_SYSTEM: GameSystemId = "t20";
export const isAvailableSystem = (id: unknown): id is GameSystemId => GAME_SYSTEMS.some((system) => system.id === id && system.available);
