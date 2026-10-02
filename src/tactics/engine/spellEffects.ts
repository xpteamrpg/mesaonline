import type { SpellItem } from "../../../ficha-modernrpg/sheet";
import type { BoardState, BoardToken, CombatState, GameAction, TacticalEffect } from "../../game/types";
import {
  appendCombatLog,
  appendRoll,
  getBoard,
  getCombatState,
  syncCombat,
  updateToken,
} from "../../game/vttBridge";
import { baseSpellText, inferActionFields, normalizeRuleText } from "../interpretation/modernRpgRules";
import { findSpellEntry } from "../interpretation/spellCasting";
import { spendCombatAction } from "./actionEconomy";
import { addTacticalEffect, emitTacticalEvent, mitigateDamage } from "./reactiveTriggers";
import { resolveSave } from "./saves";
import { resolveSummonEffect, summonDefinitionFor } from "./summonEffects";

interface KnownSpellEffect {
  cost: number;
  effect?: TacticalEffect["mods"];
  condition?: string | string[];
  reactiveKey?: string;
  duration?: "scene" | "rounds" | "sustained" | "long";
  rounds?: number;
  saveResult?: "negates" | "half" | "partial";
  damage?: string;
  cancels?: string[];
  /** a RD vale uma vez só (reduz o próximo dano e some) */
  once?: boolean;
  /** RD "/mágico": não vale contra dano de magia nem de arma mágica */
  notMagical?: boolean;
  /** a descrição diz que acumula com outras magias */
  stacks?: boolean;
  /** lançada como reação, os PV temporários viram RD contra o próximo dano (Campo de Força) */
  reactionTempHpAsRd?: boolean;
  /** vale uma vez só apenas quando a magia foi lançada como reação (Campo de Força: "RD 30 contra o próximo dano") */
  onceAsReaction?: boolean;
  /** o bônus fica preso à arma escolhida (Arma Mágica) */
  weaponBound?: boolean;
}

/** Registro específico portado de spell-effects.js (sem DOM e sem masterFicha). */
export const SPELL_EFFECTS: Record<string, KnownSpellEffect> = {
  bencao: { cost: 1, effect: { attack: 1, damage: 1 }, duration: "scene", cancels: ["perdicao"] },
  perdicao: { cost: 1, effect: { attack: -1, damage: -1 }, duration: "scene", cancels: ["bencao"] },
  santuario: { cost: 1, reactiveKey: "santuario", duration: "scene" },
  "arma-espiritual": { cost: 1, reactiveKey: "arma-espiritual", duration: "scene" },
  "arma-de-jade": { cost: 1, effect: { attack: 1, damage: 1 }, duration: "scene" },
  "arma-magica": { cost: 1, effect: { attack: 1, damage: 1 }, duration: "scene", weaponBound: true },
  "armadura-arcana": { cost: 1, effect: { defense: 5 }, duration: "scene", stacks: true },
  "protecao-divina": { cost: 1, effect: { saves: 2 }, duration: "scene" },
  "arsenal-de-allihanna": { cost: 1, effect: { attack: 1, damage: 1 }, duration: "scene" },
  "escudo-da-fe": { cost: 1, effect: { defense: 2 }, duration: "rounds", rounds: 1 },
  "percepcao-rubra": { cost: 1, effect: { attack: 1, defense: 1 }, duration: "scene" },
  "protecao-de-tauron": { cost: 1, effect: { defense: 2 }, duration: "scene" },
  "couraca-de-allihanna": { cost: 3, effect: { defense: 2 }, duration: "scene" },
  "vestimenta-da-fe": { cost: 3, effect: { defense: 2 }, duration: "long" },
  piscar: { cost: 3, effect: { attack: 2 }, duration: "scene" },
  hipnotismo: { cost: 1, condition: "Fascinado", duration: "rounds", rounds: 4, saveResult: "negates" },
  sono: { cost: 1, condition: "Exausto", duration: "rounds", rounds: 1, saveResult: "partial" },
  "controlar-plantas": { cost: 1, condition: "Enredado", duration: "scene", saveResult: "negates" },
  "amarras-etereas": { cost: 3, condition: "Agarrado", duration: "scene", saveResult: "negates" },
  "desespero-esmagador": { cost: 3, condition: ["Fraco", "Frustrado"], duration: "scene", saveResult: "partial" },
  "sussurros-insanos": { cost: 3, condition: "Confuso", duration: "scene", saveResult: "negates" },
  despedacar: { cost: 1, damage: "1d8+2", condition: "Atordoado", duration: "rounds", rounds: 1, saveResult: "half" },
  "sopro-das-uivantes": { cost: 3, damage: "4d6", condition: "Caído", duration: "rounds", rounds: 1, saveResult: "half" },
  "raio-solar": { cost: 3, damage: "4d8", condition: "Ofuscado", duration: "rounds", rounds: 1, saveResult: "half" },
  "miasma-mefitico": { cost: 3, damage: "5d6", condition: "Enjoado", duration: "rounds", rounds: 1, saveResult: "half" },
  "campo-de-forca": { cost: 3, effect: { tempHp: 30 }, duration: "scene", reactionTempHpAsRd: true },
  "instante-estoico": { cost: 1, effect: { rd: 10 }, duration: "rounds", rounds: 1, once: true, notMagical: true },
};

export interface ResolveSpellEffectRequest {
  spell: SpellItem | { id?: string; name: string; description?: string; effect?: string; resistance?: string; cost?: number };
  caster: BoardToken;
  targets: BoardToken[];
  action: GameAction;
  board?: BoardState;
  combatState?: CombatState;
  /** bônus do efeito já com os aprimoramentos (ex.: Bênção +3/+3); sobrepõe o efeito base */
  augmentMods?: Record<string, number>;
  /** arma escolhida para magias que afetam uma arma (Arma Mágica) */
  weapon?: { id: string; name: string };
}

export interface SpellTargetResult {
  tokenId: string;
  damage?: number;
  healing?: number;
  save?: ReturnType<typeof resolveSave>;
  conditions?: string[];
  text?: string;
}

export interface SpellEffectResolution {
  route: "specific" | "generic" | "fallback" | "summon";
  action: GameAction;
  results: SpellTargetResult[];
  createdTokenIds?: string[];
}

/**
 * Duração em rodadas lida do descritor da magia ("1 turno", "5 rodadas", "1d4 rodadas");
 * sem número no descritor, usa o valor padrão do registro.
 */
export function parseDurationRounds(text: string | undefined): number | null {
  const dice = String(text || "").match(/(\d+)d(\d+)\s*(?:rodada|turno)/i);
  if (dice) return rollFormula(`${dice[1]}d${dice[2]}`).total;
  const fixed = String(text || "").match(/(\d+)\s*(?:rodada|turno)/i);
  return fixed ? Number(fixed[1]) : null;
}

function descriptorRounds(spellName: string, fallback: number): number {
  const entry = findSpellEntry({ name: spellName, category: "spell" });
  return Math.max(1, parseDurationRounds(entry?.duracao) ?? fallback);
}

function spellKey(value: string) {
  return normalizeRuleText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Ordem obrigatória: específico → parser V3 → fallback textual. */
export function resolveSpellEffect(request: ResolveSpellEffectRequest): SpellEffectResolution {
  const summon = summonDefinitionFor(request.spell.name);
  if (summon) {
    const created = resolveSummonEffect({ spellName: request.spell.name, caster: request.caster, board: request.board });
    emitTacticalEvent("onSpellResolved", { caster: request.caster, targets: created, action: request.action });
    return { route: "summon", action: request.action, results: [], createdTokenIds: created.map((token) => token.id) };
  }

  const key = spellKey(request.spell.name);
  if (key === "amedrontar") return resolveFear(request);
  const known = SPELL_EFFECTS[key];
  if (known) return resolveKnown(request, key, known);

  const text = `${baseSpellText(request.spell.description)} ${request.spell.effect || ""} ${request.spell.resistance || ""}`;
  const inferred = inferActionFields(text);
  const action: GameAction = {
    ...request.action,
    areaM: request.action.areaM ?? inferred.areaM,
    condition: request.action.condition ?? inferred.condition,
    autoHit: request.action.autoHit ?? inferred.autoHit,
    halfOnSave: request.action.halfOnSave ?? inferred.halfOnSave,
    extraDamage: request.action.extraDamage ?? inferred.extraDamage,
    save: request.action.save ?? inferred.save,
    saveDC: request.action.saveDC ?? inferred.saveDC,
  };
  if (action.damage || action.healing || action.condition || action.effect !== "text") {
    return resolveGeneric({ ...request, action });
  }

  spendAndPay(request.caster, request.action);
  const fallback = { tokenId: request.caster.id, text: request.spell.description || "Efeito narrativo registrado no chat." };
  appendCombatLog({ type: "spell", title: request.spell.name, detail: fallback.text, tone: "neutral" });
  emitTacticalEvent("onSpellResolved", { caster: request.caster, targets: request.targets, action: request.action });
  return { route: "fallback", action: request.action, results: [fallback] };
}

function resolveKnown(request: ResolveSpellEffectRequest, key: string, known: KnownSpellEffect): SpellEffectResolution {
  const action: GameAction = {
    ...request.action,
    pmCost: request.action.pmCost || known.cost,
    damage: known.damage || request.action.damage,
    condition: Array.isArray(known.condition) ? known.condition[0] : known.condition || request.action.condition,
    halfOnSave: known.saveResult === "half" || request.action.halfOnSave,
  };
  spendAndPay(request.caster, action);
  const results: SpellTargetResult[] = [];
  for (const original of request.targets) {
    let token = currentToken(original.id);
    const save = action.save ? resolveSave({ target: token, type: action.save, dc: action.saveDC || request.caster.spellDC, halfOnSave: known.saveResult === "half", partialOnSave: known.saveResult === "partial" }) : undefined;
    let damage = known.damage ? rollFormula(known.damage).total : 0;
    if (save?.passed && known.saveResult === "half") damage = Math.floor(damage / 2);
    if (save?.passed && known.saveResult === "negates") damage = 0;
    if (damage > 0) {
      const mitigated = mitigateDamage(token, damage, action.damageType, request.caster, true);
      damage = mitigated.amount;
      token = updateToken(token.id, { hp: token.hp - damage });
    }
    const appliesCondition = Boolean(known.condition && !(save?.passed && known.saveResult !== "partial"));
    const conditions = appliesCondition ? (Array.isArray(known.condition) ? known.condition : [known.condition!]) : [];
    if (known.effect || conditions.length || known.reactiveKey) {
      let mods: TacticalEffect["mods"] | undefined = known.effect ? { ...known.effect, ...(request.augmentMods || {}) } : known.effect;
      let once = known.once || undefined;
      let duration = known.duration || "scene";
      let rounds = known.rounds || 1;
      // Campo de Força em reação: em vez dos PV temporários, RD contra o próximo dano.
      if (known.reactionTempHpAsRd && action.kind === "reaction" && mods?.tempHp) {
        mods = { rd: mods.tempHp };
        once = true;
        duration = "rounds";
        rounds = 1;
      }
      // PV temporários: valem o maior (não acumulam), perdem-se primeiro e acabam com a cena.
      if (mods?.tempHp) {
        token = updateToken(token.id, { tempHp: Math.max(token.tempHp || 0, mods.tempHp) });
        const { tempHp: _applied, ...rest } = mods;
        mods = rest;
      }
      const effect: TacticalEffect = {
        id: `spell:${key}:${request.caster.id}`,
        name: known.weaponBound && request.weapon ? `${request.spell.name} (${request.weapon.name})` : request.spell.name,
        weaponId: known.weaponBound ? request.weapon?.id : undefined,
        once,
        notMagical: known.notMagical || undefined,
        stacks: known.stacks || undefined,
        sourceId: `spell:${key}`,
        sourceName: request.spell.name,
        kind: duration,
        expiresRound: duration === "rounds" ? getCombatState().round + descriptorRounds(request.spell.name, rounds) : undefined,
        casterId: request.caster.id,
        mods,
        condition: conditions,
        reactiveKey: known.reactiveKey,
        saveDC: action.saveDC || request.caster.spellDC,
      };
      if (!(save?.passed && known.saveResult === "negates")) token = addTacticalEffect(token.id, effect);
    }
    if (known.cancels?.length && token.effects?.length) {
      updateToken(token.id, { effects: token.effects.filter((effect) => !known.cancels!.some((cancel) => effect.id.includes(cancel))) });
    }
    syncCombatConditions(token.id, token.conditions || []);
    pushSaveRoll(request, token, save);
    conditions.forEach((condition) => emitTacticalEvent("onConditionApplied", { source: request.caster, target: token, condition }));
    if (damage) emitTacticalEvent("onDamageApplied", { source: request.caster, target: token, action, amount: damage });
    results.push({ tokenId: token.id, damage: damage || undefined, save, conditions });
  }
  appendCombatLog({ type: "spell", title: `${request.caster.name}: ${request.spell.name}`, detail: `${results.length} alvo(s) resolvido(s) pelo efeito específico.`, tone: "success" });
  emitTacticalEvent("onSpellResolved", { caster: request.caster, targets: request.targets, action });
  return { route: "specific", action, results };
}

function resolveGeneric(request: ResolveSpellEffectRequest): SpellEffectResolution {
  spendAndPay(request.caster, request.action);
  const sharedDamage = request.action.damage ? rollFormula(request.action.damage) : null;
  const results = request.targets.map((original): SpellTargetResult => {
    let target = currentToken(original.id);
    const save = request.action.save ? resolveSave({ target, type: request.action.save, dc: request.action.saveDC || request.caster.spellDC, halfOnSave: request.action.halfOnSave }) : undefined;
    let damage = sharedDamage?.total || 0;
    if (save?.passed) damage = request.action.halfOnSave ? Math.floor(damage / 2) : 0;
    if (request.action.extraDamage && damage > 0) damage += rollFormula(request.action.extraDamage).total;
    // A cura é rolada à parte para cada alvo (cada um recebe o seu resultado).
    const healRoll = request.action.healing ? rollFormula(request.action.healing) : null;
    let healing = healRoll?.total || 0;
    if (healRoll) {
      appendRoll({
        id: `heal-${crypto.randomUUID()}`, actor: request.caster.name, target: target.name, action: request.spell.name, kind: "heal",
        modifier: 0, total: healing, formula: request.action.healing!, rolls: healRoll.rolls, outcome: `+${healing} PV`, success: true, timestamp: Date.now(),
      });
    }
    if (damage > 0) {
      damage = mitigateDamage(target, damage, request.action.damageType, request.caster, true).amount;
      target = updateToken(target.id, { hp: target.hp - damage });
      emitTacticalEvent("onDamageApplied", { source: request.caster, target, action: request.action, amount: damage });
    }
    if (healing > 0) target = updateToken(target.id, { hp: Math.min(target.hpMax, target.hp + healing) });
    const conditions = request.action.condition && !save?.passed ? [request.action.condition] : [];
    if (conditions.length) {
      target = updateToken(target.id, { conditions: [...new Set([...(target.conditions || []), ...conditions])] });
      syncCombatConditions(target.id, target.conditions || []);
      emitTacticalEvent("onConditionApplied", { source: request.caster, target, condition: conditions[0] });
    }
    pushSaveRoll(request, target, save);
    return { tokenId: target.id, damage: damage || undefined, healing: healing || undefined, save, conditions };
  });
  appendCombatLog({ type: "spell", title: `${request.caster.name}: ${request.spell.name}`, detail: `${results.length} alvo(s) resolvido(s) pelo interpretador Tactics V3.`, tone: "success" });
  emitTacticalEvent("onSpellResolved", { caster: request.caster, targets: request.targets, action: request.action });
  return { route: "generic", action: request.action, results };
}

function spendAndPay(caster: BoardToken, action: GameAction) {
  if (caster.pm < action.pmCost) throw new Error("PM insuficientes.");
  spendCombatAction(caster.id, action.kind || "standard");
  updateToken(caster.id, { pm: caster.pm - action.pmCost });
}

function currentToken(tokenId: string) {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  if (!token) throw new Error("Alvo não encontrado em BOARD.tokens.");
  return token;
}

function syncCombatConditions(tokenId: string, conditions: string[]) {
  const state = getCombatState();
  if (!state.active) return;
  syncCombat({
    ...state,
    combatants: state.combatants.map((entry) => entry.tokenId === tokenId ? { ...entry, conditions: [...conditions] } : entry),
  });
}

function pushSaveRoll(request: ResolveSpellEffectRequest, target: BoardToken, save?: ReturnType<typeof resolveSave>) {
  if (!save) return;
  appendRoll({
    id: `save-${crypto.randomUUID()}`,
    actor: target.name,
    target: request.caster.name,
    action: save.label,
    kind: "save",
    natural: save.natural,
    modifier: save.modifier,
    total: save.total,
    dc: save.dc,
    formula: `1d20 [${save.natural}] + ${save.modifier}`,
    rolls: [save.natural],
    outcome: save.outcome,
    success: save.passed,
    timestamp: Date.now(),
  });
}

/** Rola fórmulas de um ou mais termos ("2d8+2", "2d8+2+1d8+1"); o multiplicador (crítico) vale só para os dados. */
export function rollFormula(formula: string, multiplier = 1): { total: number; rolls: number[] } {
  const clean = String(formula || "0").replace(/\s/g, "").replace(/^\+/, "");
  const terms = clean.match(/[+-]?\d*d\d+|[+-]?\d+/gi);
  if (!terms || terms.join("") !== clean) return { total: Number(clean) || 0, rolls: [] };
  const rolls: number[] = [];
  let total = 0;
  for (const term of terms) {
    const dice = term.match(/^([+-]?)(\d*)d(\d+)$/i);
    if (!dice) { total += Number(term); continue; }
    const amount = (Number(dice[2]) || 1) * multiplier;
    const sides = Number(dice[3]);
    const sign = dice[1] === "-" ? -1 : 1;
    for (let i = 0; i < amount; i += 1) {
      const value = Math.floor(Math.random() * sides) + 1;
      rolls.push(value);
      total += sign * value;
    }
  }
  return { rolls, total };
}

/**
 * Amedrontar (catálogo): Vontade parcial. Falhou: apavorado por 1 rodada (1d4+1 com o aprimoramento) e depois abalado pelo resto da cena.
 * Passou: abalado por 1d4 rodadas. O alvo rola o teste de verdade (aparece nas rolagens).
 */
function resolveFear(request: ResolveSpellEffectRequest): SpellEffectResolution {
  const action = request.action;
  spendAndPay(request.caster, action);
  const round = getCombatState().round;
  const dc = action.saveDC || request.caster.spellDC;
  const results: SpellTargetResult[] = [];
  const effect = (target: BoardToken, part: string, condition: string, kind: TacticalEffect["kind"], rounds?: number): BoardToken => addTacticalEffect(target.id, {
    id: `spell:amedrontar:${request.caster.id}:${part}`,
    name: `Amedrontar (${condition})`,
    sourceId: "spell:amedrontar",
    sourceName: "Amedrontar",
    kind,
    expiresRound: rounds ? round + rounds : undefined,
    casterId: request.caster.id,
    condition,
    saveDC: dc,
  });
  for (const original of request.targets) {
    let token = currentToken(original.id);
    const save = resolveSave({ target: token, type: "will", dc, partialOnSave: true });
    const conditions: string[] = [];
    if (!save.passed) {
      const frightRounds = request.augmentMods?.apavorado ? rollFormula("1d4+1").total : 1;
      token = effect(token, "apavorado", "Apavorado", "rounds", frightRounds);
      token = effect(token, "abalado", "Abalado", "scene");
      conditions.push("Apavorado", "Abalado");
    } else {
      token = effect(token, "abalado", "Abalado", "rounds", rollFormula("1d4").total);
      conditions.push("Abalado");
    }
    syncCombatConditions(token.id, token.conditions || []);
    pushSaveRoll(request, token, save);
    conditions.forEach((condition) => emitTacticalEvent("onConditionApplied", { source: request.caster, target: token, condition }));
    results.push({ tokenId: token.id, save, conditions });
  }
  appendCombatLog({ type: "spell", title: `${request.caster.name}: Amedrontar`, detail: `${results.length} alvo(s) fizeram Vontade (CD ${dc}).`, tone: "success" });
  emitTacticalEvent("onSpellResolved", { caster: request.caster, targets: request.targets, action });
  return { route: "specific", action, results };
}
