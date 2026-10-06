import type { BoardToken, TacticalEffect } from "../../game/types";

type Stat = "attack" | "damage" | "defense" | "saves" | "speed" | "skills";

const fromSpell = (effect: TacticalEffect) => /^spell:/i.test(effect.sourceId || "") && !effect.stacks;

/**
 * Bônus que os efeitos ativos do token dão a ataque, dano ou Defesa.
 * Regra (Tormenta 20, Acumulando Efeitos): efeitos de magias não acumulam entre si, só com outras fontes;
 * então entre as magias vale o maior bônus (e a pior penalidade); as demais fontes somam.
 * `weaponId`: o bônus preso a uma arma (Arma Mágica) só vale para ela.
 */
export function effectBonus(token: Pick<BoardToken, "effects">, stat: Stat, scopeId?: string): number {
  const active = (token.effects || []).filter((effect) => {
    const value = effect.mods?.[stat];
    if (!value) return false;
    // bônus preso a uma arma ou a uma perícia só vale para ela
    return (!effect.weaponId || effect.weaponId === scopeId) && (!effect.skillId || effect.skillId === scopeId) && (!effect.saveKind || effect.saveKind === scopeId);
  });
  const spells = active.filter(fromSpell).map((effect) => effect.mods![stat] as number);
  const best = Math.max(0, ...spells);
  const worst = Math.min(0, ...spells);
  const others = active.filter((effect) => !fromSpell(effect)).reduce((sum, effect) => sum + (effect.mods![stat] as number), 0);
  return best + worst + others;
}

/**
 * Como rolar o d20 de um ataque: Concentração de Combate (do atacante) rola dois dados e usa o melhor;
 * a versão de 3º círculo faz o inimigo rolar dois dados e usar o pior. Os dois juntos se anulam.
 */
export function attackDiceMode(attacker: Pick<BoardToken, "effects">, target: Pick<BoardToken, "effects">): "normal" | "best" | "worst" {
  const best = (attacker.effects || []).some((effect) => effect.attackRoll === "best");
  const worst = (target.effects || []).some((effect) => effect.incomingAttackRoll === "worst");
  return best && worst ? "normal" : best ? "best" : worst ? "worst" : "normal";
}
