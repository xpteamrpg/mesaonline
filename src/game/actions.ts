import { withCharges } from "./chargeActions";
import type { CharacterSheet } from "../../ficha-modernrpg/sheet";
import type { BoardToken, GameAction, TacticalUnitView, ThreatTemplate } from "./types";
import { getModernRpgCharacter } from "../integration/modernRpgCharacterBridge";
import { actionsForCharacter } from "../tactics/interpretation/characterActionAdapter";
import { actionsForThreat } from "../tactics/data/bestiaryAdapter";
import { getThreat } from "../tactics/engine/customThreats";

export { actionsForCharacter, actionsForThreat };

/** Resolve ações a partir das fontes autoritativas, nunca de um elenco fictício. */
export function actionsForToken(token: BoardToken): GameAction[] {
  return withCharges(token, baseActionsForToken(token));
}

function baseActionsForToken(token: BoardToken): GameAction[] {
  if (token.modernRpgCharacterId) {
    const character = getModernRpgCharacter(token.modernRpgCharacterId);
    if (character) return actionsForCharacter(character);
  }
  const threatId = token.bestiaryId || token.customThreatId;
  if (threatId) {
    const threat = getThreat(threatId);
    if (threat) return actionsForThreat(threat);
  }
  return token.tacticalActions || [];
}


/** Compatibilidade de apresentação; TacticalUnitView nunca é persistido. */
export function unitActions(unit: TacticalUnitView, category?: GameAction["category"]): GameAction[] {
  const actions = unit.customActions || [];
  return category ? actions.filter((action) => action.category === category) : actions;
}

export function actionForCharacter(sheet: CharacterSheet, actionId: string): GameAction | null {
  return actionsForCharacter(sheet).find((action) => action.id === actionId) || null;
}

export function actionForThreat(threat: ThreatTemplate, actionId: string): GameAction | null {
  return actionsForThreat(threat).find((action) => action.id === actionId) || null;
}
