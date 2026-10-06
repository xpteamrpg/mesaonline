import type { BoardToken } from "../../game/types";
import { appendCombatLog, appendRoll, getBoard, getCombatState, onTurnStarted, showWeatherRoll, updateToken } from "../../game/vttBridge";
import { weatherRule } from "../../game/weatherRules";
import { mitigateDamage } from "./reactiveTriggers";
import { rollFormula } from "./spellEffects";

/**
 * Raio da tempestade (Tormenta20 p.267): NO COMBATE, no início de cada rodada, rola-se 1d10; com 1 (10%) um raio de 8d10 de eletricidade
 * atinge uma criatura aleatória. Toda rodada de tempestade mostra uma janelinha com o d10 (inclusive "nesta rodada não houve raios").
 * `rollD10` e `random` são injetáveis para os testes.
 */
let lastRound = 0;

export function applyWeatherRoundStart(options: { rollD10?: () => number; random?: () => number; round?: number } = {}): { d10?: number; struck?: BoardToken; damage?: number } {
  const board = getBoard();
  const lightning = weatherRule(board.weather).lightning;
  if (!lightning || !getCombatState().active) return {}; // só em combate
  const random = options.random ?? Math.random;
  const d10 = (options.rollD10 ?? (() => Math.floor(random() * 10) + 1))();
  const round = options.round ?? getCombatState().round;
  if (d10 !== 1) {
    showWeatherRoll({ round, d10 });
    appendCombatLog({ type: "condition", title: "Tempestade", detail: `Rodada ${round}: 1d10 = ${d10}. Nesta rodada não houve raios (só com 1).`, tone: "neutral" });
    return { d10 };
  }
  const candidates = board.tokens.filter((token) => !token.hidden && !token.dead);
  if (!candidates.length) { showWeatherRoll({ round, d10 }); return { d10 }; }
  const target = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  const rolled = rollFormula(lightning.damage);
  const amount = mitigateDamage(target, rolled.total, "Eletricidade").amount;
  const fresh = getBoard().tokens.find((token) => token.id === target.id) ?? target;
  updateToken(target.id, { hp: fresh.hp - amount });
  showWeatherRoll({ round, d10, struck: target.name, damage: amount });
  appendRoll({
    id: `weather-${crypto.randomUUID()}`, actor: "Tempestade", target: target.name, action: "Raio", kind: "damage",
    rolls: rolled.rolls, timestamp: Date.now(), total: amount, formula: lightning.damage, outcome: `${amount} DANO DE ELETRICIDADE`, success: amount > 0,
  });
  appendCombatLog({ type: "condition", title: `Raio atinge ${target.name}`, detail: `Tempestade, rodada ${round}: 1d10 = 1. ${amount} de dano de eletricidade (${lightning.damage}).`, tone: "danger" });
  return { d10, struck: target, damage: amount };
}

onTurnStarted((_tokenId, round) => {
  // O gancho dispara a cada turno: o clima só age na primeira vez que a rodada começa (rodada menor que a anterior = combate novo).
  if (round === lastRound) return;
  lastRound = round;
  applyWeatherRoundStart({ round });
});
