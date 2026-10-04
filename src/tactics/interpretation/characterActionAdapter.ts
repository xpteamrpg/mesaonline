import { findSpellEntry } from "./spellCasting";
import { classifySpellEffect, spellDamageType } from "./spellClassification";
import { type CombatLoadout, readLoadout } from "../../game/combatLoadout";
import type { Ability, CharacterSheet, AttackItem, PowerEntry, SpellItem, EquipmentItem } from "../../../ficha-modernrpg/sheet";
import type { BoardToken, GameAction, TacticalUnitView } from "../../game/types";
import {
  actionKindFromExecution,
  baseSpellText,
  formulasIn,
  inferActionFields,
  normalizeRuleText,
  parseAreaM,
  parseRangeM,
  spellDiceFormula,
} from "./modernRpgRules";

function attackAction(sheet: CharacterSheet, attack: AttackItem): GameAction {
  const critical = String(attack.critical || "20/x2");
  const margin = Number(critical.match(/\b(1[5-9]|20)\b/)?.[1]) || 20;
  const multiplier = Number(critical.match(/x\s*(\d+)/i)?.[1]) || 2;
  const ranged = attack.skill === "Pontaria";
  const damageModifier = (attack.damageAttr ? sheet.attributes[attack.damageAttr]?.value ?? 0 : 0) + (attack.damageBonus ?? 0);
  return {
    id: `character:attack:${attack.id}`,
    source: "character",
    sourceId: attack.id,
    name: attack.name,
    category: "weapon",
    kind: "standard",
    effect: "damage",
    target: "enemy",
    description: [attack.properties, attack.damageType, attack.range].filter(Boolean).join(" · ") || "Ataque da ficha oficial.",
    pmCost: 0,
    rangeM: parseRangeM(attack.range, ranged ? 9 : 1.5),
    attackSkill: ranged ? "pontaria" : "luta",
    attackBonus: attack.bonus || 0,
    damage: attack.damage || "1d4",
    extraDamage: damageModifier ? String(damageModifier) : undefined,
    damageType: attack.damageType,
    crit: margin,
    critMultiplier: multiplier,
    color: "steel",
  };
}

/**
 * Poder ATIVO = tem ativação: custo em PM ("gaste/pague N PM") ou tipo de execução declarado
 * ("como uma ação…", "reação"). Palavra solta "ação" ou fórmula de dano não bastam: é passivo.
 * Usado pela lista de ações (Agir) e pela aba Poderes, para as duas concordarem.
 */
export function isActivePower(name: string, description: string | undefined, cost?: number | null): boolean {
  const normalized = normalizeRuleText(`${name}. ${description || ""}`);
  const activation = /\b(gast\w*|pag\w*)\b[^.]{0,40}\d+\s*pm\b|como uma (acao|reacao)|\b(acao|reacao) (padrao|de movimento|completa|livre)\b|\breacao\b/.test(normalized);
  return Boolean(cost) || activation;
}

function powerAction(power: PowerEntry): GameAction {
  const text = `${power.name}. ${power.description || ""}`;
  const formulas = formulasIn(text);
  const healing = /cura|recupera|restaura|regenera|pontos de vida|\bPV\b/i.test(text) && !/dano/i.test(text.split(".")[0]);
  const fields = inferActionFields(text);
  const self = /pessoal|você|voce|em si/i.test(text);
  // Só vira ação quem tem ativação (ver isActivePower); o passivo fica só na aba Poderes.
  const active = isActivePower(power.name, power.description, power.cost);
  const area = Boolean(fields.areaM);
  return {
    id: `character:power:${power.id}`,
    source: "character",
    sourceId: power.id,
    name: power.name,
    category: active ? "power" : "special",
    kind: actionKindFromExecution(text),
    effect: healing ? "heal" : formulas.length ? "damage" : "text",
    target: self ? "self" : area ? "area" : healing ? "ally" : "enemy",
    description: power.description || `${power.type}${power.requirement ? ` · ${power.requirement}` : ""}`,
    pmCost: (power.cost || Number(text.match(/(\d+)\s*PM/i)?.[1])) || 0,
    rangeM: parseRangeM(text, self ? 0 : 1.5),
    damage: healing ? undefined : formulas[0],
    healing: healing ? formulas[0] ?? "1d8" : undefined,
    ...fields,
    color: /tormenta|sangue|trevas|morte/i.test(text) ? "blood" : "gold",
  };
}

function spellAction(spell: SpellItem): GameAction {
  const dice = spellDiceFormula(spell);
  const text = `${spell.name}. ${spell.execution || ""}. ${spell.range || ""}. ${spell.resistance || ""}. ${baseSpellText(spell.description)}`;
  const formulas = dice ? [dice] : [];
  const healing = /cura|curar|recupera|restaura|regenera/i.test(text) && !/causa[^.]*dano/i.test(text);
  const fields = inferActionFields(text);
  const personal = /pessoal/i.test(spell.range || "") || /você mesmo|voce mesmo/i.test(text);
  // O texto da ficha pode vir sem o campo "alvo" ("esfera com 6m de raio"): ele está no catálogo da magia.
  const catalogTarget = findSpellEntry({ sourceId: spell.id, name: spell.name, category: "spell" })?.alvo ?? "";
  const areaM = (catalogTarget ? parseAreaM(catalogTarget) : undefined) ?? fields.areaM ?? parseAreaM(text);
  return {
    id: `character:spell:${spell.id}`,
    source: "character",
    sourceId: spell.id,
    name: spell.name,
    category: "spell",
    kind: actionKindFromExecution(spell.execution),
    effect: classifySpellEffect({ name: spell.name, description: spell.description, effect: dice }),
    target: personal ? "self" : areaM ? "area" : healing ? "ally" : "enemy",
    description: spell.description || `${spell.circle}º círculo · ${spell.school || spell.type || "Magia"}`,
    pmCost: spell.cost || Math.max(1, spell.circle * 2 - 1),
    rangeM: parseRangeM(spell.range, personal ? 0 : 9),
    damage: healing ? undefined : dice,
    damageType: healing ? undefined : spellDamageType(`${spell.effect || ""} ${spell.description || ""}`),
    healing: healing ? dice || "1d8" : undefined,
    ...fields,
    areaM,
    color: /fogo|chama|lava/i.test(text) ? "fire" : healing ? "gold" : /trevas|morte|necrom|sangue/i.test(text) ? "blood" : "arcane",
  };
}

/** `forced`: o jogador marcou o item no Inventário, então ele vira ação mesmo sem parecer item de combate. */
function equipmentAction(item: EquipmentItem, forced = false): GameAction | null {
  if (!item || item.quantity <= 0) return null;
  const text = `${item.name}. ${item.description || ""}`;
  const normalized = normalizeRuleText(text);
  const formulas = formulasIn(text);
  const combatRelevant = formulas.length > 0 || /po[cç][aã]o|bomba|granada|elixir|cura|ant[ií]doto|veneno|pergaminho|varinha|kit|muni[cç][aã]o|óleo|oleo/i.test(normalized);
  if (!combatRelevant && !forced) return null;
  const healing = /cura|recupera|restaura|antidoto/i.test(normalized) && !/dano/i.test(normalized);
  const fields = inferActionFields(text);
  return {
    id: `character:item:${item.id}`,
    source: "character",
    sourceId: item.id,
    name: item.name,
    category: "item",
    kind: "standard",
    effect: healing ? "heal" : formulas.length ? "damage" : "text",
    target: fields.areaM ? "area" : healing ? "ally" : "enemy",
    description: item.description || `${item.category} · ${item.quantity} disponível(is)`,
    pmCost: 0,
    rangeM: parseRangeM(text, /bomba|granada|arremesso/i.test(normalized) ? 9 : 1.5),
    damage: healing ? undefined : formulas[0],
    healing: healing ? formulas[0] ?? "1d8" : undefined,
    ...fields,
    color: healing ? "nature" : "steel",
  };
}

/**
 * Habilidades raciais e de classe viram acoes pela MESMA heuristica dos poderes.
 * Sem gancho mecanico (custo, formula ou palavra de acao) a habilidade cai em
 * "Acao especial" — que e onde uma passiva deve aparecer, sem virar botao de
 * ataque. Antes estes dois campos eram simplesmente ignorados: mesmo uma ficha
 * integra da Oficina perdia raciais e habilidades de classe.
 */
function abilityAction(ability: Ability, origin: "racial" | "class"): GameAction {
  const base = powerAction({
    id: ability.id,
    name: ability.name,
    type: origin === "racial" ? "Racial" : "Classe",
    description: ability.description || "",
    requirement: undefined,
    cost: 0,
  });
  return { ...base, id: `character:${origin}:${ability.id}`, sourceId: ability.id };
}

/** Fonte real do CommandMenu para personagens. */
export function actionsForCharacter(sheet: CharacterSheet, loadout: CombatLoadout = readLoadout(sheet?.id)): GameAction[] {
  // Sem marca num grupo, aparece tudo; com marcas, só o marcado (Inventário e Ficha do painel de combate).
  const pick = <T extends { id: string }>(list: readonly T[], marked: readonly string[]) => (marked.length ? list.filter((entry) => marked.includes(entry.id)) : list);
  return [
    ...pick(sheet.attacks || [], loadout.attacks).map((attack) => attackAction(sheet, attack)),
    ...(sheet.spells || []).map(spellAction),
    ...pick(sheet.powers || [], loadout.powers).map(powerAction),
    ...pick(sheet.racialAbilities || [], loadout.powers).map((ability) => abilityAction(ability, "racial")),
    ...pick(sheet.classAbilities || [], loadout.powers).map((ability) => abilityAction(ability, "class")),
    ...pick(sheet.equipment || [], loadout.items).map((item) => equipmentAction(item, loadout.items.includes(item.id))).filter((action): action is GameAction => Boolean(action)),
  ];
}

/**
 * BOARD.tokens → TacticalUnitView. A ficha só enriquece a projeção; posição,
 * IDs e vitais continuam vindo do token real.
 */
export function tokenToTacticalView(token: BoardToken, sheet?: CharacterSheet | null): TacticalUnitView {
  const actions = sheet ? actionsForCharacter(sheet) : token.tacticalActions ?? [];
  return {
    id: token.id,
    modernRpgCharacterId: token.modernRpgCharacterId,
    sourceThreatId: token.bestiaryId || token.customThreatId,
    name: sheet?.name || token.name,
    title: sheet ? `${sheet.race || ""} ${sheet.class || ""} · Nv ${sheet.level || 1}`.trim() : token.title,
    side: token.side,
    x: token.gx,
    y: token.gy,
    symbol: token.symbol,
    portrait: sheet?.avatar || token.imageUrl,
    sprite: token.sprite || sheet?.avatar || token.imageUrl,
    accent: token.accent,
    pv: token.hp,
    pvMax: token.hpMax,
    pm: token.pm,
    pmMax: token.pmMax,
    defense: token.defense,
    initiative: token.initiative,
    initiativeRoll: token.initiativeRoll,
    luta: token.luta,
    pontaria: token.pontaria,
    damage: token.damage,
    crit: token.crit,
    critMultiplier: token.critMultiplier,
    attackType: token.attackType,
    rangeM: token.rangeM,
    movementM: sheet?.speed || token.movementM,
    flyM: sheet?.flySpeed ?? token.flyM,
    burrowM: sheet?.burrowSpeed ?? token.burrowM,
    level: sheet?.level || token.level,
    spellDC: token.spellDC,
    actions: token.actionIds,
    customActions: actions,
    fortitude: token.fortitude,
    reflexes: token.reflexes,
    will: token.will,
    conditions: [...new Set([...(token.conditions || []), ...(sheet?.conditions || [])])],
    mountId: token.mountId,
    loot: token.loot,
    defeated: token.defeated || token.hp <= 0,
    controlled: true,
    controlledBy: token.controlledBy,
    effects: token.effects,
  };
}
