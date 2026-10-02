import type { GameAction, SaveType } from "../../game/types";

export function normalizeRuleText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Fórmulas de dado do texto, sem as que são duração ou distância ("1d4 rodadas", "1d4 dias", "2d6 metros"): essas não são dano nem cura. */
export function formulasIn(value: unknown): string[] {
  return [...String(value ?? "").matchAll(/(\d+d\d+(?:\s*[+-]\s*\d+)?)(\s*(?:de\s+)?(?:rodadas?|horas?|dias?|metros?)\b)?/gi)]
    .filter((match) => !match[2])
    .map((match) => match[1].replace(/\s/g, ""));
}

/** Texto da magia sem o bloco "Aprimoramentos:" que a ficha anexa à descrição (os aprimoramentos não fazem parte do efeito base). */
export function baseSpellText(value: unknown): string {
  return String(value ?? "").split(/\n*\s*Aprimoramentos\s*:/i)[0];
}

/** Dado de dano ou cura da magia: o campo `effect` da ficha só vale se aparecer no texto base (o importador antigo gravava "1d4" de "1d4 rodadas"). */
export function spellDiceFormula(spell: { effect?: string; description?: string }): string | undefined {
  const base = formulasIn(baseSpellText(spell.description));
  const effect = String(spell.effect ?? "").replace(/\s/g, "");
  if (effect && (!spell.description || base.includes(effect))) return effect;
  return base[0];
}

export function numberBonus(value: unknown, fallback = 0): number {
  return Number(String(value ?? "").match(/[+-]?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".")) || fallback;
}

export function parseRangeM(value: unknown, fallback = 1.5): number {
  const text = String(value ?? "");
  const explicit = Number(text.match(/(\d+(?:[.,]\d+)?)\s*m\b/i)?.[1]?.replace(",", "."));
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  if (/pessoal/i.test(text)) return 0;
  if (/toque|adjacente|corpo a corpo/i.test(text)) return 1.5;
  if (/curto/i.test(text)) return 9;
  if (/m[eé]dio/i.test(text)) return 30;
  if (/longo/i.test(text)) return 90;
  return fallback;
}

export function parseAreaM(value: unknown): number | undefined {
  const text = String(value ?? "");
  if (!/área|area|cone|linha|esfera|explos|quadrado|cubo|raio/i.test(text)) return undefined;
  const explicit = Number(text.match(/(?:raio|cone|linha|esfera|quadrado|cubo|explos[aã]o)(?:\s+de)?\s*(\d+(?:[.,]\d+)?)\s*m/i)?.[1]?.replace(",", "."));
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 3;
}

export function parseSave(value: unknown): SaveType | undefined {
  const text = normalizeRuleText(value);
  if (/fort(?:itude)?/.test(text)) return "fortitude";
  if (/ref(?:lexos)?/.test(text)) return "reflexes";
  if (/von(?:tade)?/.test(text)) return "will";
  return undefined;
}

export function parseCondition(value: unknown): string | undefined {
  const normalized = normalizeRuleText(value);
  const conditions = [
    "abalado", "agarrado", "apavorado", "atordoado", "caído", "cego", "confuso",
    "debilitado", "enjoado", "enredado", "esmorecido", "exausto", "fascinado",
    "fatigado", "fraco", "frustrado", "imóvel", "inconsciente", "lento", "ofuscado",
    "paralisado", "pasmo", "surdo", "vulnerável",
  ];
  return conditions.find((condition) => normalized.includes(normalizeRuleText(condition)));
}

export function inferActionFields(textValue: unknown): Pick<GameAction,
  "areaM" | "condition" | "autoHit" | "halfOnSave" | "extraDamage" | "save" | "saveDC"
> {
  const text = String(textValue ?? "");
  const formulas = formulasIn(text);
  const save = parseSave(text);
  return {
    areaM: parseAreaM(text),
    condition: parseCondition(text),
    autoHit: Boolean(formulas.length) && !save && !/teste de ataque|ataque corpo|ataque à distância|ataque a distancia/i.test(text),
    halfOnSave: Boolean(save && /metade|reduz[^.]*metade/i.test(text)),
    extraDamage: formulas[1],
    save,
    saveDC: Number(text.match(/\bCD\s*(\d+)/i)?.[1]) || undefined,
  };
}

export function actionKindFromExecution(value: unknown): GameAction["kind"] {
  const text = normalizeRuleText(value);
  if (/reacao/.test(text)) return "reaction";
  if (/movimento/.test(text)) return "movement";
  if (/completa/.test(text)) return "full";
  if (/livre/.test(text)) return "free";
  return "standard";
}
