import { attackDiceMode, effectBonus } from "./effectBonuses";
import type { BoardToken, DiceResolution, GameAction } from "../../game/types";
import { appendCombatLog, appendRoll, getBoard, updateToken } from "../../game/vttBridge";
import { rollFormula } from "./spellEffects";
import { spendCombatAction } from "./actionEconomy";
import { emitTacticalEvent, mitigateDamage, resolveIncomingAttackReaction, loseMirrorImage } from "./reactiveTriggers";
import { resolveSave } from "./saves";
import { isFlanking, targetDefense } from "./targeting";
import { pmSurcharge } from "./pmCost";
import { concealmentAgainst } from "./concealment";
import { weatherRule } from "../../game/weatherRules";
import { elevationAt } from "./targeting";
import { conditionMods } from "../../game/conditionEffects";

export interface ActionResolution {
  actorId: string;
  actionId: string;
  targets: Array<{ tokenId: string; hit: boolean; damage?: number; healing?: number; condition?: string }>;
  rolls: DiceResolution[];
}

export function resolveTacticalAction(actorId: string, action: GameAction, targetIds: string[]): ActionResolution {
  let actor = required(actorId);
  const pmTotal = action.pmCost + pmSurcharge(actor, action.pmCost);
  if (actor.pm < pmTotal) throw new Error(pmTotal > action.pmCost ? `PM insuficientes (Alquebrado: +1 PM, custo ${pmTotal}).` : "PM insuficientes.");
  spendCombatAction(actor.id, action.kind || "standard");
  actor = updateToken(actor.id, { pm: actor.pm - pmTotal });
  const board = getBoard();
  const results: ActionResolution["targets"] = [];
  const rolls: DiceResolution[] = [];
  const sharedDamage = !action.attackSkill && action.damage ? rollFormula(action.damage) : null;
  const sharedHealing = action.healing ? rollFormula(action.healing) : null;

  for (const targetId of targetIds) {
    let target = required(targetId);
    if (action.effect === "heal" || (action.effect === "buff" && action.healing)) {
      const healing = sharedHealing?.total || 0;
      target = updateToken(target.id, action.effect === "heal" ? { hp: Math.min(target.hpMax, target.hp + healing) } : { pm: Math.min(target.pmMax, target.pm + healing) });
      const roll = resolution(actor, target, action, "heal", healing, action.healing || "0", `+${healing} ${action.effect === "heal" ? "PV" : "PM"}`, true, sharedHealing?.rolls || []);
      appendRoll(roll); rolls.push(roll); results.push({ tokenId: target.id, hit: true, healing });
      continue;
    }

    if (action.category === "weapon") {
      const reaction = resolveIncomingAttackReaction(actor, target, action);
      if (reaction.roll) rolls.push(reaction.roll);
      if (reaction.prevented) {
        emitTacticalEvent("onAttackResolved", { attacker: actor, target, action, hit: false });
        results.push({ tokenId: target.id, hit: false });
        continue;
      }
    }

    let hit = true;
    let critical = false;
    if (action.attackSkill && !action.autoHit) {
      const mode = attackDiceMode(actor, target);
      const dice = mode === "normal" ? [die(20)] : [die(20), die(20)];
      const natural = mode === "best" ? Math.max(...dice) : mode === "worst" ? Math.min(...dice) : dice[0];
      const ranged = action.attackSkill === "pontaria";
      const attackMods = conditionMods(actor.conditions);
      // Livro p.239 (Tabela 5-3): flanquear +2 (só corpo a corpo), posição elevada +2; clima: vento/chuva/tempestade penalizam ataque à distância (p.267).
      const flank = !ranged && isFlanking(board, actor, target) ? 2 : 0;
      const high = elevationAt(board, actor) > elevationAt(board, target) ? 2 : 0;
      const weather = ranged ? weatherRule(board.weather).ranged : 0;
      const modifier = actor[action.attackSkill] + (action.attackBonus || 0) + effectBonus(actor, "attack", action.id) + flank + high + weather
        + attackMods.attack + (ranged ? 0 : attackMods.meleeAttack);
      const total = natural + modifier;
      const defense = targetDefense(board, actor, target, ranged);
      hit = natural === 20 || (natural !== 1 && total >= defense);
      // Camuflagem (p.238): d10 junto do d20; leve falha em 1–2, total em 1–5, mesmo que o ataque acertasse.
      const concealment = concealmentAgainst(board, actor, target);
      let concealedMiss = false;
      let concealRoll = 0;
      if (hit && concealment.level !== "none") {
        concealRoll = die(10);
        concealedMiss = concealRoll <= (concealment.level === "total" ? 5 : 2);
        if (concealedMiss) hit = false;
      }
      critical = hit && natural >= (action.crit || 20);
      const roll: DiceResolution = {
        id: `attack-${crypto.randomUUID()}`, actor: actor.name, target: target.name, action: action.name, kind: "attack",
        natural, modifier, total, dc: defense, formula: `1d20 [${dice.length > 1 ? `${dice.join(", ")} → ${natural}` : natural}] + ${modifier}${concealRoll ? ` · camuflagem d10: ${concealRoll}` : ""}`, rolls: dice,
        outcome: hit ? critical ? "ACERTO CRÍTICO" : "ACERTO" : concealedMiss ? `ERRO (camuflagem: ${concealment.reasons.join(", ")})` : "ERRO", success: hit, timestamp: Date.now(),
      };
      appendRoll(roll); rolls.push(roll);
      emitTacticalEvent("onAttackResolved", { attacker: actor, target, action, hit });
      if (!hit) loseMirrorImage(target.id);
    }
    if (!hit) { results.push({ tokenId: target.id, hit: false }); continue; }

    const repeats = Math.max(1, action.repeats || 1);
    // Bônus de dano de efeitos (Bênção, Arma Mágica...): vale em ataques e não é multiplicado no crítico.
    const effectDamage = action.attackSkill ? effectBonus(actor, "damage", action.id) : 0;
    let damage = 0;
    const damageRolls: number[] = [];
    for (let index = 0; index < repeats; index += 1) {
      const rolled = sharedDamage || rollFormula(action.damage || "0", critical ? action.critMultiplier || 2 : 1);
      damage += rolled.total + effectDamage;
      damageRolls.push(...rolled.rolls);
      // Dano extra de energia da arma (Arma Mágica): dados extras não são multiplicados no crítico.
      for (const effect of actor.effects || []) {
        if (effect.extraDamage && effect.weaponId === action.id) {
          const extra = rollFormula(effect.extraDamage.formula);
          damage += extra.total;
          damageRolls.push(...extra.rolls);
        }
      }
      if (action.extraDamage) {
        const extra = rollFormula(action.extraDamage);
        damage += extra.total;
        damageRolls.push(...extra.rolls);
      }
    }
    if (action.save) {
      const save = resolveSave({ target, type: action.save, dc: action.saveDC || actor.spellDC, halfOnSave: action.halfOnSave });
      if (save.passed) damage = action.halfOnSave ? Math.floor(damage / 2) : 0;
      const saveRoll: DiceResolution = {
        id: `save-${crypto.randomUUID()}`, actor: target.name, target: actor.name, action: save.label, kind: "save",
        natural: save.natural, modifier: save.modifier, total: save.total, dc: save.dc,
        formula: `1d20 [${save.natural}] + ${save.modifier}`, rolls: [save.natural], outcome: save.outcome, success: save.passed, timestamp: Date.now(),
      };
      appendRoll(saveRoll); rolls.push(saveRoll);
      if (!save.passed && action.condition) target = updateToken(target.id, { conditions: [...new Set([...(target.conditions || []), action.condition])] });
    } else if (action.condition) {
      target = updateToken(target.id, { conditions: [...new Set([...(target.conditions || []), action.condition])] });
    }
    // Dano mágico (magia ou arma com Arma Mágica) ignora RD "/mágico", como a do Instante Estoico.
    const magical = action.category === "spell" || (actor.effects || []).some((effect) => effect.weaponId === action.id);
    damage = mitigateDamage(target, damage, action.damageType, actor, magical).amount;
    if (damage > 0) {
      target = updateToken(target.id, { hp: target.hp - damage });
      emitTacticalEvent("onDamageApplied", { source: actor, target, action, amount: damage });
    }
    const damageRoll = resolution(actor, target, action, "damage", damage, [action.damage, action.extraDamage].filter(Boolean).join(" + ") || "0", `${damage} DANO`, damage > 0, damageRolls);
    appendRoll(damageRoll); rolls.push(damageRoll);
    results.push({ tokenId: target.id, hit: true, damage, condition: action.condition });
  }

  appendCombatLog({ type: action.effect === "heal" ? "heal" : "attack", title: `${actor.name}: ${action.name}`, detail: `${results.filter((entry) => entry.hit).length} alvo(s) afetado(s).`, tone: action.effect === "heal" ? "success" : "danger" });
  return { actorId, actionId: action.id, targets: results, rolls };
}

function required(tokenId: string): BoardToken {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  if (!token) throw new Error("Token não encontrado.");
  return token;
}

function die(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

function resolution(actor: BoardToken, target: BoardToken, action: GameAction, kind: "damage" | "heal", total: number, formula: string, outcome: string, success: boolean, rolls: number[]): DiceResolution {
  return { id: `${kind}-${crypto.randomUUID()}`, actor: actor.name, target: target.name, action: action.name, kind, total, formula, rolls, outcome, success, timestamp: Date.now() };
}
