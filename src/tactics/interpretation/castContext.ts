import type { BoardToken } from "../../game/types";
import type { CharacterSheet } from "../../../ficha-modernrpg/sheet";
import { findClassByName } from "../../../ficha-modernrpg/t20/compendium";
import { getModernRpgCharacter } from "../../integration/modernRpgCharacterBridge";
import { maxCircleFor } from "./castCircle";

/**
 * Contexto de conjuração do token (lógica do `castContext` de `armada-tactics.js`,
 * ModernRPG-2026-09-23): círculo máximo pela classe da ficha oficial e magia racial
 * marcada no token. Token sem ficha (ameaça do bestiário) usa o círculo da própria magia.
 */
export function castCircleContext(token: BoardToken, spellCircle: number): { maxCircle: number; pmLimitBonus: number; pmSurcharge: number } {
  const sheet = token.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
  const pmSurcharge = (token.conditions || []).some((condition) => norm(condition).includes("alquebrad")) ? 1 : 0;
  if (!sheet) return { maxCircle: Math.max(1, spellCircle), pmLimitBonus: 0, pmSurcharge };
  const known = (sheet.spells || []).map((spell) => spell.circle);
  return { maxCircle: maxCircleFor(sheet.class, token.level || sheet.level || 1, known, spellCircle), pmLimitBonus: pmLimitBonusOf(sheet), pmSurcharge };
}

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * PM a mais no limite que se pode gastar numa magia (o limite base é o nível; Tormenta20 p.224 e p.171):
 * - poder Magia Ilimitada: soma o atributo-chave da classe (valor negativo não reduz);
 * - melhorias de esotéricos equipados: Canalizador (+1) e Potencializador (+2; Heróis de Arton).
 * Fora daqui, de propósito: Celebrar Ritual (dobra, mas muda a execução para 1 hora e custa T$) e Sangue Mágico (quebra o limite por turno).
 */
export function pmLimitBonusOf(sheet: CharacterSheet): number {
  let bonus = 0;
  if ((sheet.powers || []).some((power) => norm(power.name) === "magia ilimitada")) {
    const key = findClassByName(sheet.class || "")?.atributoChave as keyof CharacterSheet["attributes"] | undefined;
    bonus += Math.max(0, key ? sheet.attributes?.[key]?.value ?? 0 : 0);
  }
  for (const item of sheet.equipment || []) {
    if (!item.equipped) continue;
    const mods = (item.modifications || []).map(norm);
    if (mods.includes("canalizador")) bonus += 1;
    if (mods.includes("potencializador")) bonus += 2;
  }
  return bonus;
}

/** A magia foi marcada como racial neste token? (persistido em `tacticsRacial`, chave = nome normalizado). */
export function isRacialSpell(token: BoardToken, spellKey: string): boolean {
  return Boolean(token.tacticsRacial?.includes(spellKey));
}
