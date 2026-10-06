import { confusedBehavior, turnStartEffects } from "../../game/conditionEffects";
import type { BoardToken, DiceResolution } from "../../game/types";
import { appendCombatLog, appendRoll, endTurn, getBoard, getCombatState, getRuntimeSnapshot, onTurnStarted, updateToken } from "../../game/vttBridge";
import { mitigateDamage } from "./reactiveTriggers";
import { resolveSave } from "./saves";
import { rollFormula } from "./spellEffects";

const isBleeding = (name: string) => /sangrando/i.test(name.normalize("NFD").replace(/[̀-ͯ]/g, ""));

function current(tokenId: string): BoardToken | undefined {
  return getBoard().tokens.find((token) => token.id === tokenId);
}

function record(token: BoardToken, action: string, kind: DiceResolution["kind"], partial: Partial<DiceResolution> & Pick<DiceResolution, "total" | "formula" | "outcome" | "success">): void {
  appendRoll({
    id: `condition-${crypto.randomUUID()}`, actor: token.name, target: token.name, action, kind,
    rolls: [], timestamp: Date.now(), ...partial,
  });
}

/**
 * Efeitos de condição que acontecem no INÍCIO do turno (Em Chamas, Sangrando,
 * Confuso). Regras do catálogo do legado: `CONDITION_INFO` em `conditionInfo.ts`.
 */
export function applyTurnStartConditions(tokenId: string): void {
  const start = current(tokenId);
  if (!start || start.dead) return;
  for (const effect of turnStartEffects(start.conditions)) {
    // Quem está a 0 PV ou menos ainda sangra no início do turno (p.236); só a morte interrompe.
    const token = current(tokenId);
    if (!token || token.dead) return;

    if (effect === "fire") {
      const rolled = rollFormula("1d6");
      const amount = mitigateDamage(token, rolled.total, "Fogo").amount;
      updateToken(token.id, { hp: token.hp - amount });
      record(token, "Em Chamas", "damage", { total: amount, formula: "1d6", rolls: rolled.rolls, outcome: `${amount} DANO DE FOGO`, success: amount > 0 });
      appendCombatLog({ type: "condition", title: `${token.name}: Em Chamas`, detail: `Sofre ${amount} de dano de fogo no início do turno.`, tone: "danger" });
    }

    if (effect === "bleed") {
      // O teste de Constituição do texto usa a Fortitude do token (a Fortitude é baseada em Constituição).
      const save = resolveSave({ target: token, type: "fortitude", dc: 15 });
      record(token, "Sangrando (Constituição CD 15)", "save", {
        natural: save.natural, modifier: save.modifier, total: save.total, dc: save.dc,
        formula: `1d20 [${save.natural}] + ${save.modifier}`, rolls: [save.natural], outcome: save.passed ? "ESTANCOU" : "CONTINUA SANGRANDO", success: save.passed,
      });
      if (save.passed) {
        updateToken(token.id, { conditions: (token.conditions || []).filter((name) => !isBleeding(name)) });
        appendCombatLog({ type: "condition", title: `${token.name}: Sangrando`, detail: "Passou no teste e parou de sangrar.", tone: "success" });
      } else {
        const rolled = rollFormula("1d6");
        updateToken(token.id, { hp: token.hp - rolled.total });
        record(token, "Sangrando", "damage", { total: rolled.total, formula: "1d6", rolls: rolled.rolls, outcome: `${rolled.total} DANO`, success: true });
        appendCombatLog({ type: "condition", title: `${token.name}: Sangrando`, detail: `Falhou no teste e perdeu ${rolled.total} PV.`, tone: "danger" });
      }
    }

    if (effect === "confused") {
      const roll = Math.floor(Math.random() * 6) + 1;
      appendCombatLog({ type: "condition", title: `${token.name}: Confuso`, detail: `1d6 = ${roll}: ${confusedBehavior(roll)}.`, tone: "neutral" });
    }
  }
}

onTurnStarted((tokenId) => {
  applyTurnStartConditions(tokenId);
  // Inconsciente (0 PV ou menos): depois do sangramento o turno passa sozinho, desde que reste alguém para agir.
  const token = current(tokenId);
  if (!tokenId || !token || token.dead || token.hp > 0) return;
  if (getRuntimeSnapshot().multiplayer.role === "player") return;
  const someoneCanAct = getBoard().tokens.some((entry) => !entry.dead && !entry.hidden && entry.hp > 0 && getCombatState().order.includes(entry.id));
  if (someoneCanAct) queueMicrotask(() => { if (getCombatState().activeTokenId === tokenId) endTurn(); });
});
