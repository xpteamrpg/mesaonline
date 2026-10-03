import { applyTriggerOutcomes, evaluateEffectTriggers, evaluateTriggers, markEffectsFired } from "../../game/triggers";
import { runTriggerEffect } from "../../game/triggerEffects";
import { unitActions } from "../../game/actions";
import { activeGrid } from "../../game/distance";
import { fogSettings, visionForTokens } from "../../game/vision";
import { rangeM } from "./targeting";
import type { ActionKind, BoardToken, GameAction } from "../../game/types";
import { isTokenOwnedByPeer } from "../../game/permissions";
import {
  addToken,
  appendChat,
  endTurn,
  getBoard,
  getCombatState,
  getRuntimeSnapshot,
  moveToken,
  onTurnStarted,
  registerRemoteCommand,
  requestRemoteCommand,
  setExplored,
  setShapes,
  updateToken,
} from "../../game/vttBridge";
import { tacticalViewForToken } from "../../integration/modernRpgCharacterBridge";
import { resolveTacticalAction } from "./combat";
import { reachableCells, moverOf, EXPLORATION_BUDGET_M } from "./movement";
import "./conditionTicks";
import { spendCombatAction } from "./actionEconomy";
import { resolveSpellEffect } from "./spellEffects";
import { parseRangeM } from "../interpretation/modernRpgRules";
import { actionsForToken } from "../../game/actions";
import {
  buildCastInfo, computeCastPlan, findSpellEntry, sanitizeAugmentChoice, spellKeyOf, type AugmentChoice,
} from "../interpretation/spellCasting";
import { castCircleContext } from "../interpretation/castContext";
import { type MoveMode, sanitizeMoveMode } from "../../game/movementMode";
import { closeReactionWindow, consumeAiEndTurn, openReactionWindow } from "./reactionWindow";
import { spellAllowsTarget } from "../interpretation/spellTargeting";

interface TargetCell { x: number; y: number }

function requiredToken(tokenId: string): BoardToken {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  if (!token) throw new Error("Token não encontrado.");
  return token;
}

function assertPeerControls(peerId: string, tokenId: string): BoardToken {
  const token = requiredToken(tokenId);
  if (!isTokenOwnedByPeer(token, peerId)) throw new Error("Você não controla este personagem.");
  return token;
}

function assertActorCanAct(actor: BoardToken, kind?: ActionKind): void {
  const combat = getCombatState();
  if (!combat.active) throw new Error("O combate não está ativo.");
  // Reação responde a um evento: pode ser usada fora do turno (V3), uma por rodada.
  if (kind !== "reaction" && combat.activeTokenId !== actor.id) throw new Error("Aguarde o turno do seu personagem.");
  if (actor.defeated || actor.hp <= 0) throw new Error("Este personagem está derrotado.");
}

function canonicalAction(actor: BoardToken, actionId: string): GameAction {
  const action = unitActions(tacticalViewForToken(actor)).find((entry) => entry.id === actionId);
  if (!action) throw new Error("Ação não encontrada no personagem controlado.");
  return action;
}

function validTargetSide(action: GameAction, actor: BoardToken, target: BoardToken): boolean {
  const curated = spellAllowsTarget(action, actor, target);
  if (curated !== null) return curated;
  if (action.target === "self") return actor.id === target.id;
  if (action.target === "ally") return actor.side === target.side;
  if (action.target === "enemy") return actor.side !== target.side;
  if (action.effect === "heal" || action.effect === "buff") return actor.side === target.side;
  return actor.side !== target.side;
}

function validatedTargets(actor: BoardToken, action: GameAction, targetIds: string[], targetCell?: TargetCell | null): BoardToken[] {
  const board = getBoard();
  const targets = [...new Set(targetIds)].slice(0, 50).map(requiredToken).filter((token) => !token.hidden && !token.defeated);
  if (action.target === "self") {
    if (targets.length !== 1 || targets[0].id !== actor.id) throw new Error("Esta ação só pode afetar o próprio personagem.");
    return targets;
  }
  if (action.target === "area") {
    if (!targetCell || !Number.isInteger(targetCell.x) || !Number.isInteger(targetCell.y)) throw new Error("Centro da área inválido.");
    const center = { gx: targetCell.x, gy: targetCell.y };
    if (rangeM(actor, center) > action.rangeM + .001) throw new Error("Centro da área fora do alcance.");
    const radius = Math.max(activeGrid().scale, action.areaM || activeGrid().scale);
    if (targets.some((target) => rangeM(center, target) > radius + .001 || !validTargetSide(action, actor, target))) {
      throw new Error("A área contém um alvo inválido.");
    }
    return targets;
  }
  if (action.target === "cell") return targets;
  if (!targets.length) throw new Error("Selecione ao menos um alvo.");
  if (targets.some((target) => !validTargetSide(action, actor, target) || rangeM(actor, target) > action.rangeM + .001)) {
    throw new Error("Alvo inválido ou fora do alcance.");
  }
  return targets;
}

function resolveExplorationMove(actorId: string, x: number, y: number, requestedMode?: unknown): void {
  const actor = requiredToken(actorId);
  const mode = sanitizeMoveMode(actor, requestedMode);
  if (getCombatState().active) throw new Error("Use o movimento tático durante o combate.");
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error("Destino inválido.");
  const board = getBoard();
  const key = `${x},${y}`;
  if (!reachableCells(board, moverOf(board, actor), { mode, budgetM: EXPLORATION_BUDGET_M }).has(key)) throw new Error("Destino bloqueado ou fora do mapa.");
  const from = { x: actor.gx, y: actor.gy };
  const moved = moveToken(actor.id, x, y);
  const settings = fogSettings(getBoard().fogSettings);
  if (settings.exploreOnMove) {
    const seen = visionForTokens(getBoard(), [moved], settings).visible;
    setExplored(new Set([...board.explored, ...seen, key]));
  }
  runTriggersFor(actor.id, x, y, from);
}

/**
 * Executa os gatilhos da cena para o token que acabou de chegar em (x,y).
 * Usa o mesmo runtime — nao cria caminho paralelo.
 */
export function runTriggersFor(actorId: string, x: number, y: number, from?: { x: number; y: number }): void {
  const board = getBoard();
  const token = board.tokens.find((entry) => entry.id === actorId);
  if (!token) return;
  // Efeitos de cena (música, som, mensagem, macro) disparam na ENTRADA da área, por isso precisam da casa de origem.
  if (from) {
    const firings = evaluateEffectTriggers(board, token, from, { x, y });
    if (firings.length) {
      setShapes(markEffectsFired(getBoard().shapes, firings));
      for (const firing of firings) runTriggerEffect(firing.effect, token.name);
    }
  }
  const outcomes = evaluateTriggers(getBoard(), token, { x, y });
  if (!outcomes.length) return;
  const { token: proximo, shapes } = applyTriggerOutcomes(token, board.shapes, outcomes);
  updateToken(proximo.id, { conditions: proximo.conditions });
  setShapes(shapes);
  for (const outcome of outcomes) {
    appendChat({ author: "Gatilho", text: outcome.message, kind: "system" });
  }
}

// Reavalia a permanência ao começar o turno. Não cria dano periódico
// artificial: o motor atual tem condições; efeitos periódicos exigem uma ação
// configurada no gatilho e ficam explicitamente fora deste modelo.
onTurnStarted((tokenId) => {
  const token = getBoard().tokens.find((entry) => entry.id === tokenId);
  if (token) runTriggersFor(tokenId, token.gx, token.gy);
});

function assertNoPendingReaction(): void {
  if (getCombatState().pendingReaction) throw new Error("Aguarde a resposta da reação pendente.");
}

function resolveMove(actorId: string, x: number, y: number, requestedMode?: unknown): void {
  const actor = requiredToken(actorId);
  const mode = sanitizeMoveMode(actor, requestedMode);
  assertActorCanAct(actor);
  assertNoPendingReaction();
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error("Destino inválido.");
  const reachable = reachableCells(getBoard(), moverOf(getBoard(), actor), { mode });
  if (!reachable.has(`${x},${y}`)) throw new Error("Destino fora do deslocamento ou bloqueado.");
  spendCombatAction(actor.id, "movement");
  const from = { x: actor.gx, y: actor.gy };
  moveToken(actor.id, x, y);
  runTriggersFor(actor.id, x, y, from);
}

/**
 * Recalcula o custo de uma magia aprimorada do lado de quem tem autoridade.
 *
 * O cliente manda só as ESCOLHAS (quais aprimoramentos, quantas vezes). O custo
 * em PM é sempre derivado aqui a partir do catálogo, então um payload adulterado
 * não consegue conjurar mais barato nem estourar o limite de PM por magia.
 */
function augmentedSpellAction(actor: BoardToken, action: GameAction, choice: AugmentChoice): { action: GameAction; maxTargets: number; mods: Record<string, number> } {
  const entry = findSpellEntry(action);
  if (!entry) throw new Error("Aprimoramento só existe para magia do catálogo oficial.");
  const info = buildCastInfo({ action, entry, level: actor.level || 1, currentPm: actor.pm, candidates: [], ...castCircleContext(actor, entry.circulo), racial: choice.racial });
  const plan = computeCastPlan(info, choice);
  if (plan.error) throw new Error(plan.error);
  const next: GameAction = { ...action, pmCost: plan.cost };
  // Aprimoramentos que mudam a execução, o alcance ou somam dados à cura e ao dano.
  if (plan.kind) next.kind = plan.kind;
  if (plan.alcance) next.rangeM = parseRangeM(plan.alcance, action.rangeM);
  // "Muda o alcance para pessoal e a área para explosão": vira área centrada em quem lança.
  if (plan.areaM) { next.target = "area"; next.areaM = plan.areaM; next.rangeM = 0; }
  if (plan.addHealing.length && action.healing) next.healing = [action.healing, ...plan.addHealing].join("+");
  if (plan.addDamage.length && action.damage) next.damage = [action.damage, ...plan.addDamage].join("+");
  return { action: next, maxTargets: plan.maxTargets, mods: plan.mods };
}

/** Magias cujo alvo é uma arma (Arma Mágica): vale a arma escolhida; sem escolha, a primeira arma do personagem. */
function weaponForSpell(actor: BoardToken, action: GameAction, choice: AugmentChoice | null): { id: string; name: string } | undefined {
  if (action.category !== "spell" || !/^\s*1 arma/i.test(findSpellEntry(action)?.alvo || "")) return undefined;
  const weapons = actionsForToken(actor).filter((entry) => entry.category === "weapon");
  const weapon = weapons.find((entry) => entry.id === choice?.weaponId) || weapons[0];
  if (!weapon) throw new Error("Este personagem não tem arma equipada para receber a magia.");
  return { id: weapon.id, name: weapon.name };
}

function resolveAction(actorId: string, actionId: string, targetIds: string[], targetCell?: TargetCell | null, augment?: AugmentChoice | null): void {
  const actor = requiredToken(actorId);
  let action = canonicalAction(actor, actionId);
  assertNoPendingReaction();
  let maxTargets = Number.POSITIVE_INFINITY;
  let augmentMods: Record<string, number> | undefined;
  if (augment && action.category === "spell") {
    // Marca (ou desmarca) a magia como racial no token, como o `castSpell` do ModernRPG.
    const key = spellKeyOf(action.sourceId || action.name);
    const previous = actor.tacticsRacial || [];
    if (previous.includes(key) !== Boolean(augment.racial)) {
      updateToken(actor.id, { tacticsRacial: augment.racial ? [...previous, key] : previous.filter((item) => item !== key) });
    }
  }
  if (augment && action.category === "spell" && (Object.keys(augment.counts).length || augment.racial)) {
    const augmented = augmentedSpellAction(actor, action, augment);
    action = augmented.action;
    maxTargets = augmented.maxTargets;
    augmentMods = augmented.mods;
  }
  // Magia de alvo contado ("1 criatura", "2 criaturas") não aceita mais alvos do que o catálogo diz.
  if (action.category === "spell" && maxTargets === Number.POSITIVE_INFINITY) {
    const counted = Number(findSpellEntry(action)?.alvo?.match(/^\s*(\d+)\s+[a-zà-ú]/i)?.[1]);
    if (counted > 0) maxTargets = counted;
  }
  // A ação que a magia gasta pode ter mudado com o aprimoramento (ex.: livre → padrão).
  assertActorCanAct(actor, action.kind);
  const weapon = weaponForSpell(actor, action, augment || null);
  // Área pessoal (explosão a partir de quem lança): o centro é o próprio personagem.
  if (action.target === "area" && !targetCell && action.rangeM <= 0) targetCell = { x: actor.gx, y: actor.gy };
  const targets = validatedTargets(actor, action, targetIds, targetCell);
  if (targets.length > maxTargets) throw new Error(`Esta magia afeta no máximo ${maxTargets} alvo(s) com os aprimoramentos escolhidos.`);
  const resolved = action;
  const proceed = () => {
    // Relê quem age e quem é alvo: uma reação escolhida antes pode ter mudado Defesa, PM e efeitos.
    const caster = requiredToken(actor.id);
    const fresh = targets.map((token) => requiredToken(token.id));
    if (resolved.category === "spell") {
      resolveSpellEffect({
        spell: { id: resolved.sourceId, name: resolved.name, description: resolved.description, effect: resolved.damage || resolved.healing, cost: resolved.pmCost },
        caster,
        targets: fresh,
        action: resolved,
        board: getBoard(),
        combatState: getCombatState(),
        augmentMods,
        weapon,
        element: augment?.element,
      });
    } else {
      resolveTacticalAction(caster.id, resolved, fresh.map((token) => token.id));
    }
  };
  // Prompt de reação: se um alvo herói/de jogador tem reação para escolher, pausa aqui.
  if (openReactionWindow(actor, resolved, targets, proceed)) return;
  proceed();
}

/** Resposta ao prompt: usa a reação escolhida (ou nenhuma) e retoma o ataque/magia pausado. */
function answerReaction(reactionId: string, chosenActionId: string | null, peerId?: string): void {
  const pending = getCombatState().pendingReaction;
  if (!pending || pending.id !== reactionId) throw new Error("Não há reação pendente com esse código.");
  const reactor = requiredToken(pending.reactorId);
  if (peerId !== undefined && !isTokenOwnedByPeer(reactor, peerId)) throw new Error("Você não controla este personagem.");
  if (chosenActionId && !pending.options.some((option) => option.actionId === chosenActionId)) throw new Error("Reação inválida.");
  const proceed = closeReactionWindow();
  let failure: unknown = null;
  try {
    if (chosenActionId) resolveAction(reactor.id, chosenActionId, [reactor.id]);
  } catch (error) {
    failure = error;
  }
  try {
    if (proceed) proceed();
    else appendChat({ author: "Combate", text: "A ação pausada foi perdida (a mesa foi recarregada). Refaça-a.", kind: "system" });
  } finally {
    const aiActor = consumeAiEndTurn();
    if (aiActor && getCombatState().activeTokenId === aiActor) {
      try { endTurn(); } catch { /* o Mestre encerra à mão */ }
    }
  }
  if (failure) throw failure;
}

registerRemoteCommand("answerReaction", (args, context) => answerReaction(String(args[0] || ""), args[1] ? String(args[1]) : null, context.peerId));

export function executeAnswerReaction(reactionId: string, actionId: string | null): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") {
    requestRemoteCommand("answerReaction", reactionId, actionId);
    return;
  }
  answerReaction(reactionId, actionId);
}

registerRemoteCommand("explorationMove", (args, context) => {
  const [actorId, x, y, mode] = args;
  assertPeerControls(context.peerId, String(actorId || ""));
  resolveExplorationMove(String(actorId), Number(x), Number(y), mode);
});

/**
 * O jogador entra na mesa com o personagem da conta dele ("Meus personagens → Usar"). Só o Mestre coloca tokens no mapa, então o pedido vem
 * como comando: o Mestre cria o token numa casa livre, como aliado e já controlado por quem pediu. Um personagem já na mesa só é reassumido
 * se estiver sem dono ou for da mesma pessoa.
 */
const MAX_CHARACTERS_PER_PLAYER = 4;
const finite = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

export function firstFreeCell(board: { tokens: BoardToken[]; map: { cols: number; rows: number } }): { x: number; y: number } {
  const taken = new Set(board.tokens.map((token) => `${token.gx},${token.gy}`));
  for (let y = 1; y < board.map.rows; y += 1) for (let x = 1; x < board.map.cols; x += 1) if (!taken.has(`${x},${y}`)) return { x, y };
  return { x: 0, y: 0 };
}

registerRemoteCommand("claimCharacter", (args, context) => {
  const raw = args[0] as Partial<BoardToken> | undefined;
  if (!raw || typeof raw !== "object" || typeof raw.modernRpgCharacterId !== "string" || !raw.modernRpgCharacterId) throw new Error("Personagem inválido.");
  const board = getBoard();
  const existing = board.tokens.find((token) => token.modernRpgCharacterId === raw.modernRpgCharacterId);
  if (existing) {
    if (existing.controlledBy && existing.controlledBy !== context.peerId) throw new Error(`${existing.name} já está sendo usado por outro jogador.`);
    updateToken(existing.id, { controlledBy: context.peerId });
    return;
  }
  if (board.tokens.filter((token) => token.controlledBy === context.peerId).length >= MAX_CHARACTERS_PER_PLAYER) throw new Error(`Cada jogador pode ter até ${MAX_CHARACTERS_PER_PLAYER} personagens na mesa.`);
  const spot = firstFreeCell(board);
  const hpMax = Math.max(1, finite(raw.hpMax, 10));
  const pmMax = Math.max(0, finite(raw.pmMax, 0));
  const token = {
    ...raw,
    id: `token-${crypto.randomUUID()}`,
    name: String(raw.name || "Personagem").slice(0, 80),
    side: "heroes",
    gx: spot.x, gy: spot.y,
    hp: Math.min(hpMax, Math.max(0, finite(raw.hp, hpMax))), hpMax,
    pm: Math.min(pmMax, Math.max(0, finite(raw.pm, pmMax))), pmMax,
    controlledBy: context.peerId,
    hidden: false, defeated: false, locked: false,
    effects: undefined, loot: undefined, pendingLoot: undefined, mountId: undefined, riderId: undefined,
  } as BoardToken;
  addToken(token);
});

registerRemoteCommand("tacticalMove", (args, context) => {
  const [actorId, x, y, mode] = args;
  assertPeerControls(context.peerId, String(actorId || ""));
  resolveMove(String(actorId), Number(x), Number(y), mode);
});

registerRemoteCommand("tacticalAction", (args, context) => {
  const [actorId, actionId, targetIds, targetCell, augment] = args;
  assertPeerControls(context.peerId, String(actorId || ""));
  resolveAction(
    String(actorId),
    String(actionId || ""),
    Array.isArray(targetIds) ? targetIds.map(String) : [],
    targetCell && typeof targetCell === "object" ? targetCell as TargetCell : null,
    augment ? sanitizeAugmentChoice(augment) : null,
  );
});

registerRemoteCommand("tacticalEndTurn", (args, context) => {
  const actorId = String(args[0] || "");
  const actor = assertPeerControls(context.peerId, actorId);
  assertActorCanAct(actor);
  endTurn();
});

export function executeExplorationMove(actorId: string, x: number, y: number, mode?: MoveMode): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") {
    requestRemoteCommand("explorationMove", actorId, x, y, mode || "walk");
    return;
  }
  resolveExplorationMove(actorId, x, y, mode);
}

export function executeTacticalMove(actorId: string, x: number, y: number, mode?: MoveMode): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") {
    requestRemoteCommand("tacticalMove", actorId, x, y, mode || "walk");
    return;
  }
  resolveMove(actorId, x, y, mode);
}

export function executeTacticalAction(actorId: string, actionId: string, targetIds: string[], targetCell?: TargetCell | null, augment?: AugmentChoice | null): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") {
    requestRemoteCommand("tacticalAction", actorId, actionId, targetIds, targetCell || null, augment || null);
    return;
  }
  resolveAction(actorId, actionId, targetIds, targetCell, augment ? sanitizeAugmentChoice(augment) : null);
}

export function executeTacticalEndTurn(actorId: string): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") {
    requestRemoteCommand("tacticalEndTurn", actorId);
    return;
  }
  const actor = requiredToken(actorId);
  assertActorCanAct(actor);
  endTurn();
}
