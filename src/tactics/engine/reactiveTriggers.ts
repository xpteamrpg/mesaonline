import { conditionMods } from "../../game/conditionEffects";
import { getCharacterSheetById } from "../../../ficha-modernrpg/characterRoute";
import type { BoardToken, DiceResolution, GameAction, TacticalEffect } from "../../game/types";
import { appendCombatLog, appendRoll, getBoard, getCombatState, onTurnStarted, updateToken } from "../../game/vttBridge";
import { resolveSave, type SaveResolution } from "./saves";
import { isFlanking } from "./targeting";
import { damageTypesMatch } from "../interpretation/spellClassification";

export interface TacticalEvents {
  onAttackResolved: { attacker: BoardToken; target: BoardToken; action: GameAction; hit: boolean };
  onDamageApplied: { source: BoardToken; target: BoardToken; action?: GameAction; amount: number };
  onConditionApplied: { source?: BoardToken; target: BoardToken; condition: string };
  onTurnStart: { token: BoardToken; round: number };
  onTurnEnd: { token: BoardToken; round: number };
  onMove: { token: BoardToken; from: { x: number; y: number }; to: { x: number; y: number } };
  onSpellResolved: { caster: BoardToken; targets: BoardToken[]; action: GameAction };
}

type EventName = keyof TacticalEvents;
type Handler<K extends EventName> = (payload: TacticalEvents[K]) => void;
const handlers = new Map<EventName, Set<(payload: never) => void>>();

/** Registro explícito portado de reactive-triggers.js (23/09). */
export const REACTIVE_TRIGGERS = {
  "aparencia-inofensiva": {
    event: "incoming-attack",
    save: "will",
    oncePerScenePerAttacker: true,
    effect: "cancel-attack",
  },
  "desprezar-os-covardes": {
    event: "passive-damage",
    conditions: ["caido", "desprevenido"],
    flanking: true,
    damageReduction: 5,
  },
  santuario: {
    event: "incoming-attack",
    save: "will",
    oncePerScenePerAttacker: true,
    effect: "cancel-attack",
  },
  "arma-espiritual": {
    event: "attack-resolved",
    meleeOnly: true,
    oncePerRound: true,
    damage: "2d6",
  },
} as const;

export interface IncomingAttackReaction {
  key?: "aparencia-inofensiva" | "santuario";
  prevented: boolean;
  save?: SaveResolution;
  roll?: DiceResolution;
}

export function onTacticalEvent<K extends EventName>(event: K, handler: Handler<K>): () => void {
  const set = handlers.get(event) || new Set();
  set.add(handler as (payload: never) => void);
  handlers.set(event, set);
  return () => set.delete(handler as (payload: never) => void);
}

export function emitTacticalEvent<K extends EventName>(event: K, payload: TacticalEvents[K]): void {
  handlers.get(event)?.forEach((handler) => handler(payload as never));
  runBuiltInTriggers(event, payload);
}

/**
 * Resolve reações que podem impedir um ataque antes da rolagem. A ação do
 * atacante já foi gasta pelo motor de combate, como exigem os dois efeitos.
 */
export function resolveIncomingAttackReaction(
  attacker: BoardToken,
  target: BoardToken,
  action: GameAction,
  options: { roll?: () => number } = {},
): IncomingAttackReaction {
  if (action.category !== "weapon") return { prevented: false };

  const sanctuary = (target.effects || []).find((effect) => effect.reactiveKey === "santuario");
  const innocent = hasReactivePower(target, "aparencia-inofensiva");
  const key = sanctuary ? "santuario" : innocent ? "aparencia-inofensiva" : undefined;
  if (!key) return { prevented: false };

  const markerId = `reaction-use:${key}:${attacker.id}`;
  if ((target.effects || []).some((effect) => effect.id === markerId)) return { key, prevented: false };

  const dc = key === "santuario"
    ? sanctuary?.saveDC || target.spellDC
    : 10 + characterAttribute(target, "car");
  const save = resolveSave({ target: attacker, type: "will", dc, roll: options.roll });
  const roll: DiceResolution = {
    id: `reaction-save-${crypto.randomUUID()}`,
    actor: attacker.name,
    target: target.name,
    action: key === "santuario" ? "Santuário" : "Aparência Inofensiva",
    kind: "save",
    natural: save.natural,
    modifier: save.modifier,
    total: save.total,
    dc: save.dc,
    formula: `1d20 [${save.natural}] + ${save.modifier}`,
    rolls: [save.natural],
    outcome: save.passed ? "RESISTIU" : "PERDEU A AÇÃO",
    success: save.passed,
    timestamp: Date.now(),
  };
  appendRoll(roll);

  addTacticalEffect(target.id, {
    id: markerId,
    name: `Uso: ${roll.action}`,
    sourceId: `reaction:${key}`,
    sourceName: roll.action,
    kind: "scene",
  });
  appendCombatLog({
    type: "reaction",
    title: roll.action,
    detail: save.passed
      ? `${attacker.name} venceu Vontade CD ${dc} e mantém o ataque.`
      : `${attacker.name} falhou em Vontade CD ${dc}, perde a ação e não realiza o ataque.`,
    tone: save.passed ? "neutral" : "success",
  });
  return { key, prevented: !save.passed, save, roll };
}

export function damageReductionFor(token: BoardToken, damageType?: string, source?: BoardToken, magical = false): number {
  const effects = token.effects || [];
  const eligible = effects.filter((effect) => {
    const rd = effect.mods?.rd || 0;
    return rd > 0 && damageTypesMatch(effect.damageType, damageType) && !(magical && effect.notMagical);
  });
  // RDs de magia não acumulam entre si; poderes/itens acumulam.
  const spell = Math.max(0, ...eligible.filter((effect) => /^spell:|magia/i.test(effect.sourceId || effect.sourceName || "")).map((effect) => effect.mods?.rd || 0));
  const other = eligible.filter((effect) => !/^spell:|magia/i.test(effect.sourceId || effect.sourceName || "")).reduce((sum, effect) => sum + (effect.mods?.rd || 0), 0);
  const despisesCowards = hasReactivePower(token, "desprezar-os-covardes")
    && ((token.conditions || []).some((condition) => REACTIVE_TRIGGERS["desprezar-os-covardes"].conditions.includes(normalize(condition) as "caido" | "desprevenido"))
      || Boolean(source && isFlanking(getBoard(), source, token)));
  return spell + other + conditionMods(token.conditions).damageReduction + (despisesCowards ? REACTIVE_TRIGGERS["desprezar-os-covardes"].damageReduction : 0);
}

/**
 * Dano que chega aos PV: primeiro a RD (que não vale contra dano mágico quando a RD é "/mágico"), depois os PV temporários.
 * `magical`: o dano vem de magia ou de arma mágica.
 */
export function mitigateDamage(token: BoardToken, amount: number, damageType?: string, source?: BoardToken, magical = false): { amount: number; reduced: number } {
  const reduced = Math.min(Math.max(0, amount), damageReductionFor(token, damageType, source, magical));
  if (reduced > 0) {
    // RD "contra o próximo dano" (Instante Estoico, Campo de Força em reação): some depois de reduzir um dano.
    const spent = (token.effects || []).filter((effect) => effect.once && (effect.mods?.rd || 0) > 0 && damageTypesMatch(effect.damageType, damageType) && !(magical && effect.notMagical));
    if (spent.length) updateToken(token.id, { effects: (token.effects || []).filter((effect) => !spent.includes(effect)) });
  }
  let remaining = Math.max(0, amount - reduced);
  const temp = getBoard().tokens.find((entry) => entry.id === token.id)?.tempHp ?? token.tempHp ?? 0;
  if (remaining > 0 && temp > 0) {
    const absorbed = Math.min(temp, remaining);
    remaining -= absorbed;
    updateToken(token.id, { tempHp: temp - absorbed || undefined });
  }
  return { amount: remaining, reduced };
}

/** Imagem Espelhada: um ataque que erra desfaz uma cópia e o bônus de Defesa cai 2; sem cópias, o efeito acaba. */
export function loseMirrorImage(tokenId: string): void {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  const effect = token?.effects?.find((entry) => entry.mirrorImages);
  if (!token || !effect) return;
  const defense = Math.max(0, (effect.mods?.defense || 0) - 2);
  const effects = defense > 0
    ? (token.effects || []).map((entry) => entry === effect ? { ...entry, mods: { ...entry.mods, defense } } : entry)
    : (token.effects || []).filter((entry) => entry !== effect);
  updateToken(token.id, { effects });
  appendCombatLog({ type: "spell", title: `${token.name}: Imagem Espelhada`, detail: defense > 0 ? `Uma cópia desapareceu (Defesa +${defense}).` : "A última cópia desapareceu.", tone: "neutral" });
}

export function addTacticalEffect(tokenId: string, effect: TacticalEffect): BoardToken {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  if (!token) throw new Error("Alvo do efeito não encontrado.");
  const effects = [...(token.effects || []).filter((entry) => entry.id !== effect.id), effect];
  const conditions = [...new Set([
    ...(token.conditions || []),
    ...(Array.isArray(effect.condition) ? effect.condition : effect.condition ? [effect.condition] : []),
  ])];
  return updateToken(tokenId, { effects, conditions });
}

/**
 * Fim de efeito por rodadas no início do turno. Por padrão vale o turno de quem
 * conjurou (`casterId`), como o `tickEffects` do ModernRPG; efeito sem conjurador
 * conhecido (ou cujo conjurador saiu do mapa) vence no turno de quem o carrega.
 */
export function expireEffectsAtTurn(turnTokenId: string, round: number): void {
  const board = getBoard();
  for (const token of board.tokens) {
    const expiresNow = (effect: TacticalEffect) => {
      if (effect.expiresRound === undefined || effect.expiresRound > round) return false;
      const casterOnBoard = effect.casterId && board.tokens.some((entry) => entry.id === effect.casterId);
      return casterOnBoard ? effect.casterId === turnTokenId : token.id === turnTokenId;
    };
    if ((token.effects || []).some(expiresNow)) removeExpired(token, expiresNow);
  }
}

function removeExpired(token: BoardToken, expiresNow: (effect: TacticalEffect) => boolean): void {
  const effects = (token.effects || []).filter((effect) => !expiresNow(effect));
  const activeEffectConditions = new Set(effects.flatMap((effect) => Array.isArray(effect.condition) ? effect.condition : effect.condition ? [effect.condition] : []));
  const conditions = (token.conditions || []).filter((condition) => activeEffectConditions.has(condition) || !(token.effects || []).some((effect) => (Array.isArray(effect.condition) ? effect.condition : [effect.condition]).includes(condition)));
  updateToken(token.id, { effects, conditions });
}

function runBuiltInTriggers<K extends EventName>(event: K, payload: TacticalEvents[K]) {
  if (event === "onAttackResolved") {
    const attack = payload as TacticalEvents["onAttackResolved"];
    if (!attack.hit) return;
    const spiritual = (attack.target.effects || []).find((effect) => effect.reactiveKey === "arma-espiritual");
    const round = getCombatState().round;
    const markerId = `reaction-use:arma-espiritual:${attack.attacker.id}:round:${round}`;
    const alreadyUsed = (attack.target.effects || []).some((effect) => effect.id === markerId);
    if (spiritual && !alreadyUsed && cellDistance(attack.attacker, attack.target) <= 1) {
      const rolled = roll("2d6");
      const damage = mitigateDamage(attack.attacker, rolled, spiritual.damageType, attack.target, true).amount;
      updateToken(attack.attacker.id, { hp: attack.attacker.hp - damage });
      addTacticalEffect(attack.target.id, {
        id: markerId,
        name: "Uso: Arma Espiritual",
        sourceId: "reaction:arma-espiritual",
        sourceName: "Arma Espiritual",
        kind: "rounds",
        expiresRound: round + 1,
      });
      appendCombatLog({ type: "reaction", title: "Arma Espiritual", detail: `${attack.attacker.name} sofre ${damage} de dano fora do turno.`, tone: "danger" });
    }
  }
  if (event === "onTurnStart") {
    const turn = payload as TacticalEvents["onTurnStart"];
    expireEffectsAtTurn(turn.token.id, turn.round);
  }
}

function hasReactivePower(token: BoardToken, key: "aparencia-inofensiva" | "desprezar-os-covardes"): boolean {
  return (token.tacticalActions || []).some((action) => normalize(action.name) === key || normalize(action.sourceId || "") === key);
}

function characterAttribute(token: BoardToken, attribute: "car"): number {
  if (!token.modernRpgCharacterId) return 0;
  return getCharacterSheetById(token.modernRpgCharacterId)?.attributes?.[attribute]?.value || 0;
}

function cellDistance(a: BoardToken, b: BoardToken) {
  return Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));
}

function roll(formula: string) {
  const match = formula.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return Number(formula) || 0;
  return Array.from({ length: Number(match[1]) }, () => Math.floor(Math.random() * Number(match[2])) + 1)
    .reduce((sum, value) => sum + value, Number(match[3] || 0));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Liga o início de turno do runtime ao bus tático.
 *
 * Sem esta inscrição, `emitTacticalEvent("onTurnStart", …)` nunca era disparado
 * e `expireEffectsAtTurn` nunca rodava — efeitos com duração em rodadas
 * (Escudo da Fé, Despedaçar, o marcador de uso da Arma Espiritual) duravam
 * para sempre. O registro acontece no carregamento do módulo, que já é
 * importado por combat.ts e spellEffects.ts.
 */
onTurnStarted((tokenId, round) => {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  if (!token) return;
  emitTacticalEvent("onTurnStart", { token, round });
});
