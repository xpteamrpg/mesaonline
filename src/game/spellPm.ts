/**
 * Custo em PM de uma magia pelo círculo — Tormenta20 Jogo do Ano v1.3, Tabela 4-1 (p.170): 1º círculo 1 PM, 2º 3 PM, 3º 6 PM,
 * 4º 10 PM, 5º 15 PM. (O catálogo antigo do site tinha 5, 7 e 9 PM no 3º, 4º e 5º círculo: erro corrigido em 07/10/2026.)
 */
export const SPELL_PM_BY_CIRCLE: Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

export const spellPm = (circle: number): number => SPELL_PM_BY_CIRCLE[Math.min(5, Math.max(1, Math.round(circle) || 1))];

/** O valor errado que o catálogo antigo gravava nas fichas: 2×círculo−1 (5, 7 e 9 para o 3º, 4º e 5º círculo). */
const legacyWrong = (circle: number) => 2 * circle - 1;

/** Custo certo de uma magia já gravada numa ficha: só troca o valor errado do catálogo antigo; custo diferente disso (editado) fica como está. */
export function fixLegacySpellCost(circle: number, cost: number): number {
  return circle >= 3 && circle <= 5 && cost === legacyWrong(circle) ? SPELL_PM_BY_CIRCLE[circle] : cost;
}

/** Corrige o custo antigo das magias de uma ficha (3º ao 5º círculo). Devolve a mesma ficha se nada mudou. */
export function fixSheetSpellCosts<T extends { spells?: { circle: number; cost: number }[] }>(sheet: T): T {
  if (!sheet.spells?.some((spell) => fixLegacySpellCost(spell.circle, spell.cost) !== spell.cost)) return sheet;
  return { ...sheet, spells: sheet.spells.map((spell) => ({ ...spell, cost: fixLegacySpellCost(spell.circle, spell.cost) })) };
}
