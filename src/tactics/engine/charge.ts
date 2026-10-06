import type { BoardToken, TacticalEffect } from "../../game/types";
import { getBoard, getCombatState } from "../../game/vttBridge";
import { weatherRule } from "../../game/weatherRules";
import { effectBonus } from "./effectBonuses";
import { reachableWithPaths } from "./movement";
import { cellDistance } from "./targeting";

/**
 * Investida (Tormenta20 p.235): ação completa; avança até o DOBRO do deslocamento (mínimo 3 m) em LINHA RETA e faz um ataque corpo a corpo no fim.
 * +2 no ataque e −2 na Defesa até o próximo turno; não pode ser feita em terreno difícil.
 * `chargePath` devolve a casa onde o atacante termina (ou lança o erro que o jogador vê).
 */
export function chargePath(actor: BoardToken, target: BoardToken): { x: number; y: number; steps: number } {
  const board = getBoard();
  if (weatherRule(board.weather).difficultTerrain) throw new Error("Não dá para investir com o terreno difícil (neve).");
  const speed = Math.max(3, actor.movementM + effectBonus(actor, "speed"));
  const reach = reachableWithPaths(board, actor, { budgetM: speed * 2 });
  const chainOf = (key: string): Array<[number, number]> => {
    const cells: Array<[number, number]> = [];
    for (let k: string | null = key; k; k = reach.get(k)?.from ?? null) { const [x, y] = k.split(",").map(Number); cells.unshift([x, y]); }
    return cells;
  };
  let best: { x: number; y: number; steps: number } | null = null;
  for (const key of reach.keys()) {
    const [x, y] = key.split(",").map(Number);
    if (cellDistance({ ...actor, gx: x, gy: y }, target) > 1) continue; // termina adjacente ao alvo
    const cells = chainOf(key);
    const stepsDir = cells.slice(1).map((cell, i) => `${Math.sign(cell[0] - cells[i][0])},${Math.sign(cell[1] - cells[i][1])}`);
    if (new Set(stepsDir).size > 1) continue; // todas as passadas na mesma direção = linha reta
    if (cells.some(([cx, cy]) => board.map.terrain[`${cx},${cy}`]?.type === "difficult")) continue; // sem terreno difícil
    if (!best || cells.length - 1 < best.steps) best = { x, y, steps: cells.length - 1 };
  }
  if (!best) throw new Error("Investida: não há caminho em linha reta, sem terreno difícil e dentro do dobro do deslocamento até o alvo.");
  return best;
}

/** Efeito de Investida: −2 na Defesa até o próximo turno de quem investiu. */
export function chargeEffect(actor: BoardToken): TacticalEffect {
  return {
    id: `charge:${actor.id}`, name: "Investida (−2 Defesa)", sourceId: "charge", sourceName: "Investida",
    kind: "rounds", expiresRound: getCombatState().round + 1, casterId: actor.id, mods: { defense: -2 },
  };
}
