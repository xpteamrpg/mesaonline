import type { BoardToken } from "../../game/types";
import { appendCombatLog, appendRoll, getBoard, onTurnStarted, updateToken } from "../../game/vttBridge";
import { weatherRule } from "../../game/weatherRules";
import { mitigateDamage } from "./reactiveTriggers";
import { rollFormula } from "./spellEffects";

/**
 * Efeitos de clima que acontecem no INÍCIO de cada RODADA (Tormenta20 p.267): na Tempestade, 10% de chance de um raio (8d10 de eletricidade)
 * atingir uma criatura aleatória. `random` é injetável para os testes.
 */
let lastRound = 0;

export function applyWeatherRoundStart(random: () => number = Math.random): { struck?: BoardToken; damage?: number } {
  const board = getBoard();
  const lightning = weatherRule(board.weather).lightning;
  if (!lightning) return {};
  if (random() >= lightning.chance) return {};
  const candidates = board.tokens.filter((token) => !token.hidden && !token.defeated && token.hp > 0);
  if (!candidates.length) return {};
  const target = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  const rolled = rollFormula(lightning.damage);
  const amount = mitigateDamage(target, rolled.total, "Eletricidade").amount;
  const fresh = getBoard().tokens.find((token) => token.id === target.id) ?? target;
  updateToken(target.id, { hp: fresh.hp - amount });
  appendRoll({
    id: `weather-${crypto.randomUUID()}`, actor: "Tempestade", target: target.name, action: "Raio", kind: "damage",
    rolls: rolled.rolls, timestamp: Date.now(), total: amount, formula: lightning.damage, outcome: `${amount} DANO DE ELETRICIDADE`, success: amount > 0,
  });
  appendCombatLog({ type: "condition", title: `Raio atinge ${target.name}`, detail: `Tempestade: ${amount} de dano de eletricidade (${lightning.damage}).`, tone: "danger" });
  return { struck: target, damage: amount };
}

onTurnStarted((_tokenId, round) => {
  // O gancho dispara a cada turno: o clima só age na primeira vez que a rodada começa (rodada menor que a anterior = combate novo).
  if (round === lastRound) return;
  lastRound = round;
  applyWeatherRoundStart();
});
