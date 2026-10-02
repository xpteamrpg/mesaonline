import { SKILL_BY_ID } from "../../../ficha-modernrpg/t20/compendium";
import {
  DEFAULT_CHEST_LOCK_DC, DEFAULT_DOOR_LOCK_DC, DEFAULT_MAGIC_DC, NO_LOCKPICK_PENALTY, effectiveLockDc, withinReach,
} from "../../game/chest";
import { conditionSkillPenalty } from "../../game/conditionEffects";
import { isTokenOwnedByPeer } from "../../game/permissions";
import { rollFormula } from "../../game/rules";
import type { BoardObject, BoardToken, BoardWall, DiceResolution, ObjectTrap } from "../../game/types";
import {
  appendChat, appendCombatLog, appendRoll, getBoard, getCombatState, getRuntimeSnapshot, registerRemoteCommand, requestRemoteCommand,
  setObjects, updateBoardObject, updateToken, upsertWall,
} from "../../game/vttBridge";
import { freeObjectSpot, newBoardObject } from "../../game/objectPlacement";
import "../../game/espolio/threatLoot";
import { getModernRpgCharacter, sheetSkillTotal } from "../../integration/modernRpgCharacterBridge";
import { findSpellEntry } from "../interpretation/spellCasting";
import { spendCombatAction } from "./actionEconomy";
import { mitigateDamage } from "./reactiveTriggers";
import { resolveSave } from "./saves";

/**
 * Interação com baús e portas (o baú é uma mini-macro configurada pelo Mestre). O Mestre é a
 * autoridade: os testes são rolados aqui e o jogador só pede a ação. Regras do Tormenta20 usadas
 * (perícia Ladinagem "Abrir Fechadura" e magia Tranca Arcana, ver `game/chest.ts`):
 *
 *  - abrir: trancado não abre (treme e avisa, sem rolar nada); destrancado abre, revela o conteúdo e
 *    dispara a armadilha armada em quem abriu;
 *  - arrombar: teste de Ladinagem (só treinado) contra a CD da fechadura, ação completa, e sem gazua –5;
 *  - forçar: teste de Força (atributo) contra a mesma CD;
 *  - Tranca Arcana: +10 na CD (mais o extra dos aprimoramentos); só a própria magia ajuda: "abrir com
 *    Tranca Arcana" (aprimoramento que abre o que está trancado) e "trancar com Tranca Arcana", pagos em PM
 *    por quem conhece a magia;
 *  - procurar armadilha: Percepção contra a CD da armadilha; detectar magia: Misticismo contra a CD de magia
 *    (mostra se o objeto tem magia, como a Tranca Arcana); todas as CDs são do Mestre;
 *  - desarmar: Ladinagem contra a CD da armadilha (só se ela já foi revelada); errar por 5 ou mais dispara;
 *  - pegar: o que está no baú aberto vai para a mochila da ficha de quem pegou (ver `game/espolio/lootToSheet.ts`);
 *  - fechar: só o Mestre (baú); a porta qualquer um fecha.
 * A exigência de treinamento vem de `ficha-modernrpg/t20/compendium.ts`; as CDs, do Mestre.
 */
export type ObjectAction = "open" | "unlock" | "force" | "search" | "recognize" | "disarm" | "close" | "arcane-open" | "arcane-lock" | "take";
export type DoorAction = "open" | "close" | "unlock" | "force" | "recognize" | "arcane-open" | "arcane-lock" | "search" | "disarm";

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function skillBonus(actor: BoardToken, skillId: string): number {
  const skill = SKILL_BY_ID.get(skillId);
  if (!skill) throw new Error("Perícia desconhecida.");
  const sheet = actor.modernRpgCharacterId ? getModernRpgCharacter(actor.modernRpgCharacterId) : null;
  if (sheet && skill.somenteTreinado && !sheet.skills?.[skillId]?.trained) throw new Error(`${skill.nome} exige treinamento.`);
  const base = sheet ? sheetSkillTotal(sheet, skill.id, skill.atributo) : Math.floor((actor.level || 1) / 2);
  return base + conditionSkillPenalty(actor.conditions, skill.atributo, skill.id);
}

/** Tem uma gazua na mochila? (item "Gazua" da ficha oficial; sem ficha, não). */
export function hasLockpick(actor: BoardToken): boolean {
  const sheet = actor.modernRpgCharacterId ? getModernRpgCharacter(actor.modernRpgCharacterId) : null;
  return Boolean(sheet?.equipment?.some((item) => item.quantity > 0 && /gazua/.test(norm(item.name))));
}

/** Conhece a magia Tranca Arcana? (na lista de magias da ficha ou entre as ações do token). */
export function knowsArcaneLock(actor: BoardToken): boolean {
  const sheet = actor.modernRpgCharacterId ? getModernRpgCharacter(actor.modernRpgCharacterId) : null;
  return Boolean(sheet?.spells?.some((spell) => norm(spell.name) === "tranca arcana"))
    || Boolean(actor.tacticalActions?.some((action) => action.category === "spell" && norm(action.name) === "tranca arcana"));
}

/** Custo em PM da Tranca Arcana: trancar = custo base; abrir = custo base + o aprimoramento que abre. */
export function arcaneLockCost(kind: "lock" | "open"): number {
  const entry = findSpellEntry({ name: "Tranca Arcana", category: "spell" });
  const base = entry?.custo ?? 1;
  const opening = entry?.aprimoramentos?.[0]?.custo ?? 1;
  return kind === "lock" ? base : base + opening;
}

function record(actor: BoardToken, label: string, action: string, natural: number, modifier: number, total: number, dc: number): boolean {
  const passed = total >= dc;
  const resolution: DiceResolution = {
    id: `objeto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    actor: actor.name, target: action, action: `${label} (${action})`, kind: "system",
    natural, modifier, total, formula: `1d20${modifier >= 0 ? "+" : ""}${modifier}`, rolls: [natural],
    outcome: passed ? "passou" : "falhou", success: passed, timestamp: Date.now(),
  };
  appendRoll(resolution);
  return passed;
}

/** Teste de perícia contra uma CD; registra a rolagem e diz só "passou" ou "falhou". */
function check(actor: BoardToken, skillId: string, dc: number, action: string, extra = 0): { passed: boolean; margin: number } {
  const skill = SKILL_BY_ID.get(skillId)!;
  const modifier = skillBonus(actor, skillId) + extra;
  const natural = Math.floor(Math.random() * 20) + 1;
  const total = natural + modifier;
  return { passed: record(actor, skill.nome, action, natural, modifier, total, dc), margin: total - dc };
}

/** Teste de atributo (Força): 1d20 + modificador do atributo, sem treinamento nem nível. */
function attributeCheck(actor: BoardToken, attribute: "for", dc: number, action: string): { passed: boolean; margin: number } {
  const sheet = actor.modernRpgCharacterId ? getModernRpgCharacter(actor.modernRpgCharacterId) : null;
  const modifier = (sheet?.attributes?.[attribute]?.value || 0) + conditionSkillPenalty(actor.conditions, attribute);
  const natural = Math.floor(Math.random() * 20) + 1;
  const total = natural + modifier;
  return { passed: record(actor, "Força", action, natural, modifier, total, dc), margin: total - dc };
}

function spendPm(actor: BoardToken, cost: number): void {
  if (actor.pm < cost) throw new Error(`PM insuficientes: ${cost} PM.`);
  updateToken(actor.id, { pm: actor.pm - cost });
}

/** O que baú e porta têm em comum para trancar, arrombar e usar a Tranca Arcana. */
interface LockTarget {
  label: string;
  /** para o chat: "a Porta de ferro se abriu" */
  noun: string;
  locked: boolean;
  lockDc?: number;
  magicLocked?: boolean;
  magicBonus?: number;
  magicDc?: number;
  fallbackDc: number;
  patch: (change: { locked?: boolean; magicLocked?: boolean; magicBonus?: number; magicRevealed?: boolean; shakeAt?: number }) => void;
}

/** Arrombar, forçar e Tranca Arcana. Devolve `true` se tratou a ação. */
function applyLockAction(actor: BoardToken, target: LockTarget, action: string): boolean {
  const dc = effectiveLockDc(target, target.fallbackDc);
  const say = (text: string) => appendChat({ author: target.label, text, kind: "system" });
  const shake = () => target.patch({ shakeAt: Date.now() });
  const unlocked = { locked: false, magicLocked: false, magicBonus: 0 };

  if (action === "recognize") {
    // Misticismo mostra se há magia (Tranca Arcana); a resposta é a mesma quando não há, para não entregar a informação.
    const found = check(actor, "mis", target.magicDc || DEFAULT_MAGIC_DC, "detectar magia");
    if (found.passed && target.magicLocked) { target.patch({ magicRevealed: true }); say(`${actor.name} detecta magia em ${target.noun}: Tranca Arcana.`); }
    else say(`${actor.name} não detecta magia em ${target.noun}.`);
    return true;
  }

  if (action === "unlock") {
    if (!target.locked) throw new Error(`${target.label} não está trancado.`);
    if (getCombatState().active) spendCombatAction(actor.id, "full"); // abrir fechadura exige ação completa
    const lockpick = hasLockpick(actor);
    const result = check(actor, "lad", dc, lockpick ? "arrombar" : "arrombar sem gazua", lockpick ? 0 : NO_LOCKPICK_PENALTY);
    if (result.passed) { target.patch(unlocked); say(`${actor.name} arrombou a fechadura${lockpick ? "" : " (sem gazua, –5)"}.`); }
    else { shake(); say(`${actor.name} não conseguiu arrombar${lockpick ? "" : " (sem gazua, –5)"}.`); }
    return true;
  }
  if (action === "force") {
    if (!target.locked) throw new Error(`${target.label} não está trancado.`);
    const result = attributeCheck(actor, "for", dc, "forçar");
    if (result.passed) { target.patch(unlocked); say(`${actor.name} forçou a tranca.`); }
    else { shake(); say(`${actor.name} não conseguiu forçar a tranca.`); }
    return true;
  }
  if (action === "arcane-open" || action === "arcane-lock") {
    if (!knowsArcaneLock(actor)) throw new Error("Você não conhece a magia Tranca Arcana.");
    const opening = action === "arcane-open";
    const cost = arcaneLockCost(opening ? "open" : "lock");
    if (opening && !target.locked) throw new Error(`${target.label} não está trancado.`);
    if (!opening && target.locked && target.magicLocked) throw new Error(`${target.label} já tem uma Tranca Arcana.`);
    if (actor.pm < cost) throw new Error(`PM insuficientes: ${cost} PM.`);
    if (getCombatState().active) spendCombatAction(actor.id, "standard"); // execução padrão
    spendPm(actor, cost);
    if (opening) { target.patch(unlocked); say(`${actor.name} usou Tranca Arcana e ${target.noun} se abriu (${cost} PM).`); }
    else { target.patch({ locked: true, magicLocked: true, magicBonus: 0 }); say(`${actor.name} trancou ${target.noun} com Tranca Arcana (${cost} PM).`); }
    return true;
  }
  return false;
}

function requiredObject(id: string): BoardObject {
  const object = getBoard().objects.find((entry) => entry.id === id);
  if (!object) throw new Error("Objeto não encontrado.");
  return object;
}

function objectTarget(object: BoardObject): LockTarget {
  return {
    label: object.name, noun: object.name, locked: object.locked, lockDc: object.lockDc, magicLocked: object.magicLocked, magicBonus: object.magicBonus, magicDc: object.magicDc,
    fallbackDc: DEFAULT_CHEST_LOCK_DC, patch: (change) => { updateBoardObject(object.id, change); },
  };
}

/** Quem carrega a armadilha: o baú (objeto da cena) ou a porta (parede). */
interface TrapHolder { label: string; trap?: ObjectTrap; setTrap: (trap: ObjectTrap) => void }

function objectHolder(object: BoardObject): TrapHolder {
  return { label: object.name, trap: object.trap, setTrap: (trap) => { updateBoardObject(object.id, { trap }); } };
}

function doorHolder(door: BoardWall): TrapHolder {
  return { label: door.name || (door.type === "window" ? "Janela" : "Porta"), trap: door.trap, setTrap: (trap) => upsertWall({ ...getBoard().walls.find((entry) => entry.id === door.id)!, trap }) };
}

/** Dispara a armadilha em quem a acionou: dano (metade se passar na resistência) e condição. */
function fireTrap(holder: TrapHolder, victim: BoardToken): void {
  const trap = holder.trap;
  if (!trap || !trap.armed) return;
  let damage = trap.damage ? rollFormula(trap.damage).total : 0;
  let passed = false;
  if (trap.save) {
    passed = resolveSave({ target: victim, type: trap.save, dc: trap.saveDc || 15, halfOnSave: true }).passed;
    if (passed) damage = Math.floor(damage / 2);
  }
  const dealt = damage > 0 ? mitigateDamage(victim, damage, trap.damageType, undefined).amount : 0;
  const conditions = trap.condition && !passed ? [...new Set([...(victim.conditions || []), trap.condition])] : victim.conditions;
  updateToken(victim.id, { hp: Math.max(0, victim.hp - dealt), conditions });
  holder.setTrap({ ...trap, armed: false });
  const parts = [dealt ? `${dealt} de dano${trap.damageType ? ` de ${trap.damageType}` : ""}` : "", trap.condition && !passed ? trap.condition : "", passed ? "resistiu" : ""].filter(Boolean);
  appendChat({ author: holder.label, text: `Armadilha "${trap.name}"! ${victim.name}${parts.length ? `: ${parts.join(", ")}` : " escapou"}.`, kind: "system" });
  appendCombatLog({ type: "damage", title: `Armadilha: ${trap.name}`, detail: `${victim.name} ${parts.length ? parts.join(", ") : "escapou"}.`, tone: "danger" });
}

/** Procurar (Percepção) e desarmar (Ladinagem) a armadilha; vale para baú e porta. Devolve `true` se tratou a ação. */
function applyTrapAction(actor: BoardToken, holder: TrapHolder, action: string): boolean {
  const say = (text: string) => appendChat({ author: holder.label, text, kind: "system" });
  const trap = holder.trap;
  if (action === "search") {
    const found = trap && trap.armed && !trap.revealed ? check(actor, "per", trap.detectDc, "procurar armadilha") : null;
    if (found?.passed && trap) { holder.setTrap({ ...trap, revealed: true }); say(`${actor.name} percebeu uma armadilha: ${trap.name}.`); }
    // Mesma resposta com ou sem armadilha, para não entregar a informação.
    else say(`${actor.name} não encontra nenhuma armadilha.`);
    return true;
  }
  if (action === "disarm") {
    if (!trap || !trap.armed || !trap.revealed) throw new Error("Você não conhece nenhuma armadilha aqui.");
    const result = check(actor, "lad", trap.disarmDc, "desarmar armadilha");
    if (result.passed) { holder.setTrap({ ...trap, armed: false }); say(`${actor.name} desarmou a armadilha.`); }
    else if (result.margin <= -5) { say(`${actor.name} errou feio ao desarmar.`); fireTrap(holder, actor); }
    else say(`${actor.name} não conseguiu desarmar a armadilha.`);
    return true;
  }
  return false;
}

/** Resolve quem age e valida permissão, vida e distância (casa adjacente). */
function resolveActor(actorId: string | null, peerId: string | undefined, at: { x: number; y: number }): { actor: BoardToken | null; asMaster: boolean } {
  const asMaster = peerId === undefined;
  const actor = actorId ? getBoard().tokens.find((entry) => entry.id === actorId) || null : null;
  if (actorId && !actor) throw new Error("Personagem não encontrado.");
  if (!actor && !asMaster) throw new Error("Escolha o personagem que vai interagir.");
  if (actor) {
    if (!asMaster && !isTokenOwnedByPeer(actor, peerId as string)) throw new Error("Você não controla este personagem.");
    if (actor.defeated || actor.hp <= 0) throw new Error(`${actor.name} não pode agir.`);
    if (!withinReach(actor, at)) throw new Error("Chegue perto (casa adjacente).");
  }
  return { actor, asMaster };
}

function applyObjectAction(actorId: string | null, objectId: string, action: ObjectAction, peerId?: string, indexes?: number[]): void {
  const object = requiredObject(objectId);
  const { actor, asMaster } = resolveActor(actorId, peerId, object);

  if (action === "close") {
    if (!asMaster) throw new Error("Só o Mestre fecha.");
    updateBoardObject(object.id, { opened: false });
    return;
  }
  // O Mestre sem personagem abre e fecha à vontade, sem teste nem armadilha.
  if (!actor) {
    if (action !== "open") throw new Error("Escolha o personagem que vai fazer o teste.");
    updateBoardObject(object.id, { opened: !object.opened, locked: false, ...(object.opened ? {} : { revealAt: Date.now() }) });
    return;
  }

  if (action === "take") {
    if (!object.opened) throw new Error(`${object.name} está fechado.`);
    const wanted = new Set((indexes && indexes.length ? indexes : object.contents.map((_, index) => index)).filter((index) => Number.isInteger(index) && index >= 0 && index < object.contents.length));
    if (!wanted.size) throw new Error("Não há nada para pegar.");
    const taken = object.contents.filter((_, index) => wanted.has(index));
    if (getCombatState().active) spendCombatAction(actor.id, "movement"); // pegar item em combate gasta a ação de movimento
    const rest = object.contents.filter((_, index) => !wanted.has(index));
    // Item solto no chão: pegou tudo, o item some do mapa (baú e tesouro continuam, vazios).
    if (object.kind === "item" && !rest.length) setObjects(getBoard().objects.filter((entry) => entry.id !== object.id));
    else updateBoardObject(object.id, { contents: rest });
    updateToken(actor.id, { pendingLoot: [...(actor.pendingLoot || []), ...taken] });
    appendChat({ author: object.name, text: `${actor.name} pegou: ${taken.join("; ")}.`, kind: "system" });
    return;
  }

  if (action === "open") {
    if (object.opened) throw new Error(`${object.name} já está aberto.`);
    if (object.locked) {
      updateBoardObject(object.id, { shakeAt: Date.now() });
      appendChat({ author: object.name, text: `${actor.name} tenta abrir, mas está trancado.`, kind: "system" });
      return;
    }
    updateBoardObject(object.id, { opened: true, revealAt: Date.now() });
    appendChat({ author: object.name, text: `${actor.name} abriu ${object.name}.`, kind: "system" });
    fireTrap(objectHolder(requiredObject(object.id)), getBoard().tokens.find((entry) => entry.id === actor.id) || actor);
    return;
  }

  if (applyLockAction(actor, objectTarget(object), action)) return;

  applyTrapAction(actor, objectHolder(object), action);
}

registerRemoteCommand("objectAction", (args, context) => applyObjectAction(args[0] ? String(args[0]) : null, String(args[1]), String(args[2]) as ObjectAction, context.peerId, Array.isArray(args[3]) ? args[3].map(Number) : undefined));

/** Jogador pede ao Mestre; o Mestre executa aqui mesmo. `actorId` nulo = o Mestre agindo sem personagem. */
export function executeObjectAction(actorId: string | null, objectId: string, action: ObjectAction, indexes?: number[]): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") { requestRemoteCommand("objectAction", actorId, objectId, action, indexes || null); return; }
  applyObjectAction(actorId, objectId, action, undefined, indexes);
}

/** Item que um personagem larga no chão: vira um objeto do tipo "item" com o nome e a descrição do item da ficha. */
export interface DroppedItem { name: string; description?: string; quantity?: number }

function applyDropItem(actorId: string, drop: DroppedItem, cell: { x: number; y: number } | null, peerId?: string): BoardObject {
  const board = getBoard();
  const actor = board.tokens.find((entry) => entry.id === actorId);
  if (!actor) throw new Error("Personagem não encontrado.");
  const asMaster = peerId === undefined;
  if (!asMaster && !isTokenOwnedByPeer(actor, peerId as string)) throw new Error("Você não controla este personagem.");
  if (actor.defeated || actor.hp <= 0) throw new Error(`${actor.name} não pode agir.`);
  const target = cell ?? { x: actor.gx, y: actor.gy };
  if (!asMaster && !withinReach(actor, target) && !(target.x === actor.gx && target.y === actor.gy)) throw new Error("Só dá para soltar o item na casa do personagem ou numa casa ao lado.");
  if (target.x < 0 || target.y < 0 || target.x >= board.map.cols || target.y >= board.map.rows) throw new Error("Essa casa está fora do mapa.");
  if (getCombatState().active) spendCombatAction(actor.id, "movement"); // soltar item em combate gasta a ação de movimento
  const floor = Math.trunc(board.activeFloor ?? 0);
  const quantity = Math.max(1, Math.min(99, Math.trunc(drop.quantity ?? 1)));
  const object = {
    ...newBoardObject("item", floor, freeObjectSpot(board, floor, target, true), drop.name.slice(0, 60)),
    ...(drop.description ? { description: drop.description.slice(0, 400) } : {}),
    contents: [quantity > 1 ? `${drop.name} x${quantity}` : drop.name],
  };
  setObjects([...board.objects, object]);
  appendChat({ author: actor.name, text: `Largou ${quantity > 1 ? `${quantity}× ` : ""}${drop.name} no chão.`, kind: "system" });
  return object;
}

registerRemoteCommand("dropItem", (args, context) => { applyDropItem(String(args[0]), args[1] as DroppedItem, args[2] ? (args[2] as { x: number; y: number }) : null, context.peerId); });

/** Largar um item no chão. Jogador pede ao Mestre; o Mestre executa aqui. A ficha (tirar o item da mochila) quem muda é o chamador. */
export function executeDropItem(actorId: string, drop: DroppedItem, cell?: { x: number; y: number }): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") { requestRemoteCommand("dropItem", actorId, drop, cell ?? null); return; }
  applyDropItem(actorId, drop, cell ?? null);
}

// O que foi pego fica no token até quem tem a ficha aplicá-lo na mochila e limpar (ver `LootClaimer`).
registerRemoteCommand("claimLoot", (args, context) => {
  const token = getBoard().tokens.find((entry) => entry.id === String(args[0]));
  if (!token) throw new Error("Personagem não encontrado.");
  if (!isTokenOwnedByPeer(token, context.peerId)) throw new Error("Você não controla este personagem.");
  updateToken(token.id, { pendingLoot: [] });
});

/** Quem aplicou o que pegou na ficha avisa o Mestre para limpar a pendência. */
export function executeClaimLoot(tokenId: string): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") { requestRemoteCommand("claimLoot", tokenId); return; }
  updateToken(tokenId, { pendingLoot: [] });
}

// ---- Portas e janelas: mesma arquitetura do baú ------------------------------------------------

function requiredDoor(id: string): BoardWall {
  const wall = getBoard().walls.find((entry) => entry.id === id);
  if (!wall || (wall.type !== "door" && wall.type !== "window")) throw new Error("Porta não encontrada.");
  return wall;
}

function applyDoorAction(actorId: string | null, wallId: string, action: DoorAction, peerId?: string): void {
  const door = requiredDoor(wallId);
  const label = door.name || (door.type === "window" ? "Janela" : "Porta");
  const cell = { x: Math.round(door.x1), y: Math.round(door.y1) };
  const { actor } = resolveActor(actorId, peerId, cell);
  const save = (patch: Partial<BoardWall>) => upsertWall({ ...door, ...patch });

  if (!actor) {
    if (action !== "open" && action !== "close") throw new Error("Escolha o personagem que vai fazer o teste.");
    save({ open: action === "open", locked: false, magicLocked: false, magicBonus: 0 });
    return;
  }
  if (action === "close") {
    if (!door.open) throw new Error(`${label} já está fechada.`);
    save({ open: false });
    return;
  }
  if (action === "open") {
    if (door.open) throw new Error(`${label} já está aberta.`);
    if (door.locked) {
      save({ shakeAt: Date.now() });
      appendChat({ author: label, text: `${actor.name} tenta abrir, mas está trancada.`, kind: "system" });
      return;
    }
    save({ open: true });
    appendChat({ author: label, text: `${actor.name} abriu ${label.toLowerCase()}.`, kind: "system" });
    fireTrap(doorHolder(requiredDoor(door.id)), getBoard().tokens.find((entry) => entry.id === actor.id) || actor);
    return;
  }
  if (applyTrapAction(actor, doorHolder(door), action)) return;
  applyLockAction(actor, {
    label, noun: label.toLowerCase(), locked: Boolean(door.locked), lockDc: door.lockDc, magicLocked: door.magicLocked, magicBonus: door.magicBonus, magicDc: door.magicDc,
    fallbackDc: DEFAULT_DOOR_LOCK_DC,
    patch: (change) => save({ ...change, ...(change.locked ? { open: false } : {}) }),
  }, action);
}

registerRemoteCommand("doorAction", (args, context) => applyDoorAction(args[0] ? String(args[0]) : null, String(args[1]), String(args[2]) as DoorAction, context.peerId));

/** Jogador pede ao Mestre; o Mestre executa aqui. `actorId` nulo = o Mestre agindo sem personagem. */
export function executeDoorAction(actorId: string | null, wallId: string, action: DoorAction): void {
  if (getRuntimeSnapshot().multiplayer.role === "player") { requestRemoteCommand("doorAction", actorId, wallId, action); return; }
  applyDoorAction(actorId, wallId, action);
}
