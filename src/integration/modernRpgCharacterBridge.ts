import { visionTypeFromText } from "../game/vision";
import { parseSize } from "../game/tokenSize";
import { T20_RACES } from "../../ficha-modernrpg/t20/compendium";
/** Ponte única CharacterSheet oficial ↔ BOARD.tokens. */
import {
  getCharacterSheetById,
  loadCharacterSheets,
  setActiveCharacterId,
} from "../../ficha-modernrpg/characterRoute";
import type { CharacterSheet } from "../../ficha-modernrpg/sheet";
import type { BoardToken, TacticalUnitView } from "../game/types";
import { cargaOf } from "../game/carga";
import { powerSpellDC, withPassivePowers } from "../game/powerEffects";
import { actionsForCharacter, tokenToTacticalView } from "../tactics/interpretation/characterActionAdapter";

function attribute(sheet: CharacterSheet, key: keyof CharacterSheet["attributes"]): number {
  return sheet.attributes?.[key]?.value || 0;
}

export function sheetDefense(sheet: CharacterSheet): number {
  const equipment = (sheet.equipment || []).reduce((total, item) =>
    total + (item.equipped && (item.category === "Armadura" || item.category === "Escudo") ? item.defenseBonus || 0 : 0), 0);
  return 10 + attribute(sheet, "des") + (sheet.defenseOther || 0) + (sheet.defenseOtherTemp || 0) + equipment;
}

export function sheetSkillTotal(sheet: CharacterSheet, id: string, fallbackAttribute: keyof CharacterSheet["attributes"]): number {
  const level = sheet.level || 1;
  const training = level >= 15 ? 6 : level >= 7 ? 4 : 2;
  const state = sheet.skills?.[id];
  const attr = (state?.attr || fallbackAttribute) as keyof CharacterSheet["attributes"];
  return Math.floor(level / 2) + attribute(sheet, attr) + (state?.trained ? training : 0) + (state?.other || 0);
}

export function getModernRpgCharacter(characterId: string): CharacterSheet | null {
  return getCharacterSheetById(characterId);
}

/** Adaptador de compatibilidade para leitores VTT legados; não persiste nada. */
export function characterSheetToLegacyFullData(sheet: CharacterSheet) {
  return {
    id: sheet.id,
    charName: sheet.name,
    charRace: sheet.race,
    charClass: sheet.class,
    charLevel: sheet.level,
    avatar: sheet.avatar,
    hp: sheet.hp,
    pm: sheet.mp,
    defense: sheetDefense(sheet),
    movement: sheet.speed,
    flySpeed: sheet.flySpeed,
    burrowSpeed: sheet.burrowSpeed,
    attacks: sheet.attacks,
    spells: sheet.spells,
    powers: sheet.powers,
    equipment: sheet.equipment,
    conditions: sheet.conditions || [],
    modernRpgCharacterId: sheet.id,
  };
}

export function resolveFichaToken(token: BoardToken): { sheet: CharacterSheet | null; fullData: ReturnType<typeof characterSheetToLegacyFullData> | null; charName: string } {
  const sheet = token.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
  return {
    sheet,
    fullData: sheet ? characterSheetToLegacyFullData(sheet) : null,
    charName: sheet?.name || token.name,
  };
}

export function boardTokenFromCharacter(sheet: CharacterSheet, at: { x: number; y: number } = { x: 1, y: 1 }, existing?: BoardToken): BoardToken {
  const primary = sheet.attacks?.[0];
  const ranged = primary?.skill === "Pontaria";
  const critical = String(primary?.critical || "20/x2");
  const spellAttribute = sheet.spells?.some((spell) => /divina/i.test(spell.type || "")) ? "sab" : "int";
  return {
    id: existing?.id || `token-${sheet.id}-${crypto.randomUUID().slice(0, 8)}`,
    modernRpgCharacterId: sheet.id,
    name: sheet.name,
    title: `${sheet.race || ""} ${sheet.class || ""} · Nv ${sheet.level || 1}`.trim(),
    side: existing?.side || "heroes",
    gx: existing?.gx ?? at.x,
    gy: existing?.gy ?? at.y,
    z: existing?.z || 0,
    symbol: sheet.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PJ",
    imageUrl: sheet.avatar || existing?.imageUrl,
    sprite: sheet.avatar || existing?.sprite,
    accent: existing?.accent || "#c99a45",
    hp: sheet.hp?.current ?? existing?.hp ?? 0,
    hpMax: sheet.hp?.max ?? existing?.hpMax ?? 0,
    pm: sheet.mp?.current ?? existing?.pm ?? 0,
    pmMax: sheet.mp?.max ?? existing?.pmMax ?? 0,
    defense: sheetDefense(sheet),
    initiative: sheetSkillTotal(sheet, "ini", "des"),
    initiativeRoll: existing?.initiativeRoll || 0,
    luta: sheetSkillTotal(sheet, "lut", "for"),
    pontaria: sheetSkillTotal(sheet, "pon", "des"),
    damage: primary?.damage || "1d4",
    crit: Number(critical.match(/\b(1[5-9]|20)\b/)?.[1]) || 20,
    critMultiplier: Number(critical.match(/x\s*(\d+)/i)?.[1]) || 2,
    attackType: ranged ? "ranged" : "melee",
    rangeM: ranged ? 9 : 1.5,
    movementM: Math.max(0, (sheet.speed || 9) - cargaOf(sheet).speedPenaltyM),
    flyM: sheet.flySpeed,
    burrowM: sheet.burrowSpeed,
    level: sheet.level || 1,
    spellDC: 10 + Math.floor((sheet.level || 1) / 2) + attribute(sheet, spellAttribute) + powerSpellDC(sheet),
    actionIds: [],
    tacticalActions: actionsForCharacter(sheet),
    fortitude: sheetSkillTotal(sheet, "for", "con"),
    reflexes: sheetSkillTotal(sheet, "ref", "des"),
    will: sheetSkillTotal(sheet, "von", "sab"),
    conditions: [...(sheet.conditions || [])],
    // Visao no Escuro / Penumbra vem do texto da raca e das habilidades da ficha,
    // nunca de valor fixo (game/vision.ts).
    visionType: visionTypeFromText(
      sheet.race,
      ...(sheet.racialAbilities || []).map((ability) => `${ability.name} ${ability.description}`),
      ...(sheet.classAbilities || []).map((ability) => `${ability.name} ${ability.description}`),
      ...(sheet.powers || []).map((power) => `${power.name} ${power.description}`),
    ),
    mountId: existing?.mountId,
    riderId: existing?.riderId,
    // Tamanho: o da raça no compêndio (Goblin e Hynne Pequenos, Gigante e Ogro Grandes...); sem raça conhecida, Médio.
    size: parseSize(T20_RACES.find((race) => race.nome === sheet.race)?.tamanho) ?? existing?.size,
    loot: existing?.loot,
    defeated: (sheet.hp?.current || 0) <= 0,
    hidden: existing?.hidden,
    controlledBy: existing?.controlledBy,
    effects: withPassivePowers(existing?.effects, sheet),
  };
}

export function characterForToken(token: BoardToken): CharacterSheet | null {
  return token.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
}

export function tacticalViewForToken(token: BoardToken): TacticalUnitView {
  return tokenToTacticalView(token, characterForToken(token));
}

export function openModernRpgCharacter(characterId: string): void {
  const sheet = getModernRpgCharacter(characterId);
  if (!sheet) throw new Error("CharacterSheet não encontrado no armazenamento oficial.");
  setActiveCharacterId(sheet.id);
  window.location.hash = `#/ficha?characterId=${encodeURIComponent(sheet.id)}`;
}

export { loadCharacterSheets };
