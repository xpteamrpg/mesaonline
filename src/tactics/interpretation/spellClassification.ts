import type { ActionEffect, GameAction } from "../../game/types";
import { summonDefinitionFor } from "../engine/summonEffects";
import { actionKindFromExecution, baseSpellText, formulasIn, normalizeRuleText, parseRangeM } from "./modernRpgRules";
import enhancementsJson from "../data/spellEnhancements.json";
import { spellKeyOf } from "./spellCasting";

/**
 * Classificação de magia. Fonte: regras e registro do ModernRPG-2026-09-23
 * (`spell-effects.js`, `armada-tactics.js`: `range`, `execKind`, `tipoDano`), com o
 * dado das magias em `ficha-modernrpg/t20/vtt/magias.json` e das armas em `itens.json` (`danoTipo`).
 */

// ---- Tipo de dano ---------------------------------------------------------
/** Físicos (armas), elementais (magias) e os demais tipos que aparecem nos dados. */
export const DAMAGE_TYPES = {
  fisico: ["Corte", "Perfuração", "Impacto"],
  elemental: ["Ácido", "Eletricidade", "Fogo", "Frio"],
  outro: ["Luz", "Trevas", "Essência", "Veneno"],
} as const;

const ALL_TYPES = [...DAMAGE_TYPES.fisico, ...DAMAGE_TYPES.elemental, ...DAMAGE_TYPES.outro];

/** Tipos canônicos citados num texto ("Corte/Perfuração", "Impacto e Perfuração"...). */
export function damageTypesOf(raw: unknown): string[] {
  const text = normalizeRuleText(raw);
  return ALL_TYPES.filter((type) => new RegExp(`(^|[^a-z])${normalizeRuleText(type)}([^a-z]|$)`).test(text));
}

export function damageCategory(type: string): keyof typeof DAMAGE_TYPES | null {
  const found = (Object.keys(DAMAGE_TYPES) as (keyof typeof DAMAGE_TYPES)[]).find((key) => (DAMAGE_TYPES[key] as readonly string[]).includes(type));
  return found || null;
}

/**
 * RD/resistência com tipo (ex.: RD 5 a corte, resistência a fogo 15) só vale contra dano
 * exatamente desse tipo; dano sem tipo ou de outro tipo não é reduzido. RD sem tipo é geral.
 * Ataque com dois tipos (Corte/Perfuração) é reduzido se qualquer um deles combinar.
 */
export function damageTypesMatch(reduction: unknown, attack: unknown): boolean {
  if (!String(reduction ?? "").trim()) return true;
  const wanted = damageTypesOf(reduction);
  if (!wanted.length) return normalizeRuleText(reduction).trim() === normalizeRuleText(attack).trim();
  return damageTypesOf(attack).some((type) => wanted.includes(type));
}

/** Tipo de dano de uma magia lido do texto (o catálogo não traz o campo estruturado). */
export function spellDamageType(text: unknown): string | undefined {
  const source = String(text ?? "");
  const explicit = source.match(/dano(?:s)? (?:de|do tipo) ([A-Za-zÀ-ú]+)/i)?.[1];
  const fromExplicit = explicit ? damageTypesOf(explicit)[0] : undefined;
  if (fromExplicit) return fromExplicit;
  const near = source.match(/\d+d\d+[^.]{0,30}?(?:de |dano de )?([A-Za-zÀ-ú]+)/i)?.[1];
  return near ? damageTypesOf(near)[0] : undefined;
}

// ---- Alcance --------------------------------------------------------------
export type RangeCategory = "pessoal" | "toque" | "curto" | "medio" | "longo" | "ilimitado" | "outro";
export function classifyRange(raw: unknown): { categoria: RangeCategory; metros: number } {
  const text = normalizeRuleText(raw);
  const categoria: RangeCategory = /pessoal/.test(text) ? "pessoal"
    : /toque|adjacente/.test(text) ? "toque"
    : /curto/.test(text) ? "curto"
    : /medio/.test(text) ? "medio"
    : /longo/.test(text) ? "longo"
    : /ilimitado/.test(text) ? "ilimitado"
    : "outro";
  return { categoria, metros: parseRangeM(raw, categoria === "outro" ? 0 : 1.5) };
}

// ---- Execução -------------------------------------------------------------
export function classifyExecution(raw: unknown): { kind: GameAction["kind"]; prolongada?: string } {
  const text = String(raw ?? "");
  const prolongada = text.match(/\d+\s*(?:hora|minuto|dia)s?|duas rodadas|\d+\s*rodadas?/i)?.[0];
  return { kind: actionKindFromExecution(text), prolongada };
}

// ---- Duração --------------------------------------------------------------
export type DurationKind = "instantanea" | "rodadas" | "cena" | "sustentada" | "longa" | "permanente" | "especial";
export function classifyDuration(raw: unknown): { tipo: DurationKind; rodadas?: number } {
  const text = normalizeRuleText(raw);
  if (/instantane/.test(text)) return { tipo: "instantanea" };
  if (/sustentad/.test(text)) return { tipo: "sustentada" };
  if (/permanente/.test(text)) return { tipo: "permanente" };
  const dice = text.match(/(\d+)d(\d+)\s*(?:rodada|turno)/);
  if (dice) return { tipo: "rodadas" };
  const rounds = text.match(/(\d+)\s*(?:rodada|turno)/) || (/duas rodadas/.test(text) ? [null, "2"] : null);
  if (rounds) return { tipo: "rodadas", rodadas: Number(rounds[1]) };
  if (/cena/.test(text)) return { tipo: "cena" };
  if (/hora|dia|semana|mes|ano/.test(text)) return { tipo: "longa" };
  return { tipo: "especial" };
}

// ---- Natureza da magia (classificação INTERNA da aplicação) -----------------
// Não é regra do T20 nem definição oficial do ModernRPG: no código original só existem
// `ActionEffect` (damage | heal | buff | summon | text) e os registros próprios
// `ArmadaSpellEffects`, `ArmadaReactiveTriggers` e `ArmadaSummonSpells`. "Utilitário" é apenas o
// nome de conveniência para `text` (efeito narrado pelo Mestre). Não usar como filtro oficial.
const REGISTRY = enhancementsJson as unknown as Record<string, { baseMods?: Record<string, number> }>;

/**
 * Natureza interna da ação da magia (mapeia para `ActionEffect`); ver o aviso acima.
 */
export function classifySpellEffect(spell: { name: string; description?: string; effect?: string }): ActionEffect {
  if (summonDefinitionFor(spell.name)) return "summon";
  // Só o texto base conta: o bloco "Aprimoramentos:" não define o efeito da magia.
  const text = `${spell.name}. ${baseSpellText(spell.description)}. ${spell.effect || ""}`;
  const formulas = formulasIn(`${spell.effect || ""} ${baseSpellText(spell.description)}`);
  const healing = /cura|curar|recupera|restaura|regenera/i.test(text) && !/causa[^.]*dano/i.test(text);
  if (healing) return "heal";
  if (formulas.length || spell.effect) return "damage";
  if (REGISTRY[spellKeyOf(spell.name)]?.baseMods) return "buff";
  return "text";
}
