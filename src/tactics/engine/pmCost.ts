import type { BoardToken } from "../../game/types";

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Alquebrado (Tormenta20 p.394): o custo em PM das habilidades do personagem aumenta em +1 (só vale para o que já custa PM). */
export function pmSurcharge(token: Pick<BoardToken, "conditions">, baseCost: number): number {
  return baseCost > 0 && (token.conditions || []).some((condition) => norm(condition).includes("alquebrad")) ? 1 : 0;
}
