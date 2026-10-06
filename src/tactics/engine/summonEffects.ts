import { pmSurcharge } from "./pmCost";
import type { BoardState, BoardToken, GameAction, ThreatTemplate } from "../../game/types";
import { addToken, appendCombatLog, getBoard, updateToken } from "../../game/vttBridge";
import { ensureSyntheticThreat } from "./customThreats";
import { spendCombatAction } from "./actionEconomy";

export interface SummonDefinition {
  key: string;
  aliases: string[];
  cost: number;
  rangeM: number;
  quantity: number;
  name: string;
  defense: number;
  hp: number;
  attack: { name: string; damage: string; damageType: string; rangeM: number };
  groupOrder: boolean;
}

export const SUMMON_REGISTRY: SummonDefinition[] = [{
  key: "conjurar-mortos-vivos",
  aliases: ["criar-mortos-vivos", "criar mortos-vivos", "conjurar mortos-vivos"],
  cost: 3,
  rangeM: 9,
  quantity: 6,
  name: "Esqueleto Capanga",
  defense: 18,
  hp: 1,
  attack: { name: "Golpe", damage: "1d6+2", damageType: "Trevas", rangeM: 1.5 },
  groupOrder: true,
}];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function summonDefinitionFor(name: string): SummonDefinition | null {
  const key = normalize(name);
  return SUMMON_REGISTRY.find((entry) => entry.key === key || entry.aliases.some((alias) => normalize(alias) === key)) || null;
}

function syntheticThreat(definition: SummonDefinition): ThreatTemplate {
  const action: GameAction = {
    id: `summon:${definition.key}:attack`, name: definition.attack.name, category: "weapon", kind: "standard",
    effect: "damage", target: "enemy", description: `Ataque da invocação. Dano de ${definition.attack.damageType}.`,
    pmCost: 0, rangeM: definition.attack.rangeM, attackSkill: "luta", damage: definition.attack.damage,
    damageType: definition.attack.damageType, crit: 20, critMultiplier: 2, color: "blood", source: "registry",
  };
  return ensureSyntheticThreat({
    id: `summon-template:${definition.key}`, name: definition.name, title: "Invocação · Morto-vivo capanga", symbol: "EC",
    pv: definition.hp, pm: 0, defense: definition.defense, initiative: 0, luta: 6, pontaria: 0,
    damage: definition.attack.damage, crit: 20, critMultiplier: 2, attackType: "melee", rangeM: definition.attack.rangeM,
    movementM: 9, level: 1, spellDC: 10, actions: [], customActions: [action], fortitude: 0, reflexes: 0, will: 0,
    custom: true, hidden: true,
  });
}

function availablePositions(board: BoardState, caster: BoardToken, rangeM: number, quantity: number) {
  const maxCells = Math.floor(rangeM / 1.5);
  const occupied = new Set(board.tokens.filter((token) => !token.hidden && !token.defeated).map((token) => `${token.gx},${token.gy}`));
  const candidates: Array<{ x: number; y: number; distance: number }> = [];
  for (let y = 0; y < board.map.rows; y += 1) {
    for (let x = 0; x < board.map.cols; x += 1) {
      const distance = Math.max(Math.abs(x - caster.gx), Math.abs(y - caster.gy));
      if (distance > maxCells || occupied.has(`${x},${y}`) || board.map.terrain[`${x},${y}`]?.type === "blocked") continue;
      candidates.push({ x, y, distance });
    }
  }
  return candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x).slice(0, quantity);
}

export interface ResolveSummonRequest {
  spellName: string;
  caster: BoardToken;
  board?: BoardState;
}

/** Invocações entram diretamente no único BOARD.tokens. */
export function resolveSummonEffect(request: ResolveSummonRequest): BoardToken[] {
  const definition = summonDefinitionFor(request.spellName);
  if (!definition) return [];
  const board = request.board || getBoard();
  if (request.caster.pm < definition.cost) throw new Error("PM insuficientes para a invocação.");
  const positions = availablePositions(board, request.caster, definition.rangeM, definition.quantity);
  if (positions.length < definition.quantity) throw new Error("Não há casas livres suficientes para a invocação.");
  const template = syntheticThreat(definition);
  const groupId = `summon-group-${crypto.randomUUID()}`;
  const tokens = positions.map((position, index): BoardToken => ({
    id: `summon-${crypto.randomUUID()}`,
    name: `${definition.name} ${index + 1}`,
    title: template.title,
    side: request.caster.side,
    gx: position.x,
    gy: position.y,
    symbol: template.symbol,
    imageUrl: template.portrait,
    sprite: template.sprite,
    accent: request.caster.side === "heroes" ? "#7eb8d8" : "#a83b43",
    hp: template.pv,
    hpMax: template.pv,
    pm: 0,
    pmMax: 0,
    defense: template.defense,
    initiative: 0,
    initiativeRoll: request.caster.initiativeRoll,
    luta: template.luta,
    pontaria: template.pontaria,
    damage: template.damage,
    crit: template.crit,
    critMultiplier: template.critMultiplier,
    attackType: template.attackType,
    rangeM: template.rangeM,
    movementM: template.movementM,
    level: template.level || 1,
    spellDC: 10,
    actionIds: [],
    tacticalActions: template.customActions,
    fortitude: 0,
    reflexes: 0,
    will: 0,
    conditions: [],
    bestiaryId: template.id,
    controlledBy: request.caster.controlledBy,
    summonGroup: groupId,
    summonedBy: request.caster.id,
    summonKey: definition.key,
  }));
  tokens.forEach(addToken);
  updateToken(request.caster.id, { pm: request.caster.pm - definition.cost - pmSurcharge(request.caster, definition.cost) });
  appendCombatLog({ type: "summon", title: request.spellName, detail: `${definition.quantity} ${definition.name}(s) foram criados em BOARD.tokens.`, tone: "success" });
  return tokens;
}

export function orderSummonGroup(casterId: string, groupId: string, kind: "move" | "attack"): BoardToken[] {
  spendCombatAction(casterId, kind === "move" ? "movement" : "standard");
  return getBoard().tokens.filter((token) => token.summonedBy === casterId && token.summonGroup === groupId && !token.defeated);
}
