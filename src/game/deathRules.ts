import type { BoardToken } from "./types";
import { isDead } from "./death";
import { getCharacterSheetById } from "../../ficha-modernrpg/characterRoute";

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Está em Fúria? (condição ou efeito chamado Fúria no token.) */
export const isInFury = (token: Pick<BoardToken, "conditions" | "effects">) =>
  (token.conditions || []).some((name) => norm(name).includes("furia")) || (token.effects || []).some((effect) => norm(effect.name).includes("furia"));

/** Espírito Inquebrável (bárbaro): enquanto em Fúria, não fica inconsciente a 0 PV ou menos (ainda morre no limite de morte). */
export function keepsConsciousAtZero(token: Pick<BoardToken, "conditions" | "effects" | "modernRpgCharacterId">): boolean {
  if (!isInFury(token) || !token.modernRpgCharacterId) return false;
  const sheet = getCharacterSheetById(token.modernRpgCharacterId);
  return Boolean(sheet?.powers?.some((power) => norm(power.name) === "espirito inquebravel"));
}

/**
 * Morreu? Heróis, aliados, chefes e mini chefes seguem a regra do livro (p.236: morrem em −10 ou −metade dos PV totais, antes disso ficam
 * inconscientes e sangrando). Inimigos comuns (ameaças que não são boss nem mini boss) morrem ao chegar a 0 PV ou menos (regra do usuário, 06/10).
 */
export function diesAt(token: Pick<BoardToken, "side" | "boss" | "hp" | "hpMax">): boolean {
  if (token.side === "threats" && !token.boss) return token.hp <= 0;
  return isDead(token.hp, token.hpMax);
}
