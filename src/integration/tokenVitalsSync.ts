import { getCharacterSheetById, upsertCharacterSheet } from "../../ficha-modernrpg/characterRoute";
import type { BoardToken } from "../game/types";
import { boardTokenFromCharacter, sheetDefense } from "./modernRpgCharacterBridge";

/** Token → CharacterSheet. É a única escrita de vitais feita pelo motor. */
export function persistTokenVitalsToSheet(token: BoardToken): void {
  if (!token.modernRpgCharacterId) return;
  const sheet = getCharacterSheetById(token.modernRpgCharacterId);
  if (!sheet) return;
  const hp = Math.max(0, Math.min(token.hpMax, token.hp));
  const pm = Math.max(0, Math.min(token.pmMax, token.pm));
  const conditions = [...new Set(token.conditions || [])];
  const unchanged = sheet.hp.current === hp
    && sheet.hp.max === token.hpMax
    && sheet.mp.current === pm
    && sheet.mp.max === token.pmMax
    && JSON.stringify(sheet.conditions || []) === JSON.stringify(conditions);
  if (unchanged) return;
  upsertCharacterSheet({
    ...sheet,
    hp: { ...sheet.hp, current: hp, max: token.hpMax },
    mp: { ...sheet.mp, current: pm, max: token.pmMax },
    conditions,
  });
}

/** CharacterSheet → token, preservando ID e posição lógica do token. */
export function refreshTokenFromSheet(token: BoardToken): BoardToken {
  if (!token.modernRpgCharacterId) return token;
  const sheet = getCharacterSheetById(token.modernRpgCharacterId);
  if (!sheet) return token;
  const refreshed = boardTokenFromCharacter(sheet, { x: token.gx, y: token.gy }, token);
  return {
    ...refreshed,
    id: token.id,
    gx: token.gx,
    gy: token.gy,
    z: token.z,
    defense: sheetDefense(sheet),
    effects: refreshed.effects,
  };
}

export function syncAllTokensFromSheets(tokens: BoardToken[]): BoardToken[] {
  return tokens.map(refreshTokenFromSheet);
}
