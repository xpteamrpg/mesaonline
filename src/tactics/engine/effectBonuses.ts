import type { BoardToken, TacticalEffect } from "../../game/types";

type Stat = "attack" | "damage" | "defense" | "saves";

const fromSpell = (effect: TacticalEffect) => /^spell:/i.test(effect.sourceId || "") && !effect.stacks;

/**
 * Bônus que os efeitos ativos do token dão a ataque, dano ou Defesa.
 * Regra (Tormenta 20, Acumulando Efeitos): efeitos de magias não acumulam entre si, só com outras fontes;
 * então entre as magias vale o maior bônus (e a pior penalidade); as demais fontes somam.
 * `weaponId`: o bônus preso a uma arma (Arma Mágica) só vale para ela.
 */
export function effectBonus(token: Pick<BoardToken, "effects">, stat: Stat, weaponId?: string): number {
  const active = (token.effects || []).filter((effect) => {
    const value = effect.mods?.[stat];
    if (!value) return false;
    return !effect.weaponId || effect.weaponId === weaponId;
  });
  const spells = active.filter(fromSpell).map((effect) => effect.mods![stat] as number);
  const best = Math.max(0, ...spells);
  const worst = Math.min(0, ...spells);
  const others = active.filter((effect) => !fromSpell(effect)).reduce((sum, effect) => sum + (effect.mods![stat] as number), 0);
  return best + worst + others;
}
