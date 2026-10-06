import type { BoardToken, GameAction } from "./types";

/**
 * Investida (Tormenta20 p.235): uma versão de cada ataque corpo a corpo como ação completa. O alcance da ação é o do avanço
 * (dobro do deslocamento + 1,5 m do golpe); o caminho em linha reta é conferido ao executar (runtimeCommands).
 */
export function withCharges(token: Pick<BoardToken, "movementM">, actions: GameAction[]): GameAction[] {
  const speed = Math.max(3, token.movementM || 9);
  const charges = actions
    .filter((action) => action.category === "weapon" && action.attackSkill === "luta" && !action.charge && !action.id.startsWith("charge:"))
    .map((action): GameAction => ({
      ...action,
      id: `charge:${action.id}`,
      name: `Investida — ${action.name}`,
      kind: "full",
      attackBonus: (action.attackBonus || 0) + 2,
      rangeM: speed * 2 + 1.5,
      charge: true,
      description: "Ação completa: avança até o dobro do deslocamento (mín. 3 m) em linha reta e ataca no fim. +2 no ataque, −2 na Defesa até o próximo turno. Não vale em terreno difícil. Pode atropelar como ação livre (não o mesmo alvo).",
    }));
  return charges.length ? [...actions, ...charges] : actions;
}
