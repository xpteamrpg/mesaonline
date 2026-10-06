import { T20_SKILLS, isHeavyArmorName } from "../../ficha-modernrpg/t20/compendium";
import type { CharacterSheet } from "../../ficha-modernrpg/sheet";
import type { TacticalEffect } from "./types";

/**
 * Efeitos passivos de poderes de classe (até o 5º nível) que valem sempre, sem condição no texto: viram efeitos "poder:" do token
 * (`kind: "long"`), somados por `effectBonus` como qualquer outra fonte. Só entram poderes cujo texto do catálogo
 * (`ficha-modernrpg/t20/vtt/poderes.json`) não depende de situação (contra X, com arma Y, uma vez por cena, gastando PM...).
 * O que depende de situação continua só como texto (lista em docs/PODERES_APLICADOS.md).
 */

type Stat = "attack" | "damage" | "defense" | "rd" | "saves" | "speed" | "skills";
interface Piece {
  mods?: Partial<Record<Stat, number>>;
  /** perícia (nome) a que o bônus se limita */
  skill?: string;
  /** resistência a que o bônus se limita */
  save?: "fortitude" | "reflexes" | "will";
  /** soma na CD das magias */
  spellDC?: number;
}
interface Rule { names: string[]; pieces: (level: number, sheet: CharacterSheet) => Piece[] }

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const skills = (names: string[], bonus: number): Piece[] => names.map((skill) => ({ skill, mods: { skills: bonus } }));
/** 1 no nível `from`, +1 a cada `every` níveis depois */
const steps = (level: number, from: number, every: number) => (level >= from ? 1 + Math.floor((level - from) / every) : 0);
const con = (sheet: CharacterSheet) => sheet.attributes?.con?.value || 0;

/** Armadura pesada vestida (pelo `tipoArmadura` do catálogo de itens). */
export function wearsHeavyArmor(sheet: CharacterSheet): boolean {
  return (sheet.equipment || []).some((item) => item.equipped && item.category === "Armadura" && isHeavyArmorName(item.name));
}
const wearsArmor = (sheet: CharacterSheet) => (sheet.equipment || []).some((item) => item.equipped && item.category === "Armadura");

const RULES: Rule[] = [
  { names: ["Necrologia"], pieces: (l) => { const b = 2 + Math.floor((l - 3) / 5); return [...skills(["Cura"], b), { save: "fortitude", mods: { saves: b } }]; } },
  { names: ["Instinto Selvagem"], pieces: (l) => { const b = steps(l, 3, 6); return b ? [{ mods: { damage: b } }, ...skills(["Percepção"], b), { save: "reflexes", mods: { saves: b } }] : []; } },
  { names: ["Resiliência Primal"], pieces: (l) => (l >= 5 ? [{ mods: { rd: Math.min(15, 3 * steps(l, 5, 3)) } }] : []) },
  { names: ["Fúria da Savana", "Soldado de Infantaria", "Mais Alto e Mais Rápido", "Demônio de Areia: Raposa"], pieces: () => [{ mods: { speed: 3 } }] },
  { names: ["Pele de Ferro"], pieces: (_l, s) => (wearsHeavyArmor(s) ? [] : [{ mods: { defense: 4 } }]) },
  { names: ["Tanga de Peles"], pieces: (l, s) => (wearsArmor(s) ? [] : [{ mods: { defense: con(s) + steps(l, 3, 4) } }]) },
  { names: ["Casca Grossa"], pieces: (l, s) => (l < 3 || wearsHeavyArmor(s) ? [] : [{ mods: { defense: Math.min(con(s), l) + (l >= 7 ? steps(l, 7, 4) : 0) } }]) },
  { names: ["Pernas do Mar"], pieces: () => skills(["Acrobacia", "Atletismo"], 2) },
  { names: ["Rastreador"], pieces: () => skills(["Sobrevivência"], 2) },
  { names: ["Gatuno"], pieces: () => skills(["Atletismo"], 2) },
  { names: ["Discrição Divina"], pieces: (l) => { const b = steps(l, 3, 6); return b ? [...skills(["Furtividade"], b), { mods: { saves: b } }] : []; } },
  { names: ["Pajem"], pieces: () => skills(["Diplomacia"], 2) },
  { names: ["Voz Poderosa"], pieces: () => skills(["Diplomacia", "Intimidação"], 2) },
  { names: ["Tranquilidade dos Lagos", "Coração de Trovão"], pieces: () => [{ save: "will", mods: { saves: 2 } }] },
  { names: ["Análise Tática"], pieces: () => skills(["Guerra"], 2) },
  { names: ["Tradição Oral"], pieces: (l) => skills(["Misticismo"], 2 + (l >= 9 ? 2 : 0) + (l >= 13 ? 2 : 0)) },
  { names: ["Visão Noturna"], pieces: () => skills(["Percepção"], 2) },
  { names: ["Olhar Assustador"], pieces: (l) => { const b = steps(l, 3, 6); return b ? skills(["Intimidação", "Intuição"], b) : []; } },
  { names: ["Herói do Povo"], pieces: (l) => (l >= 5 ? [{ mods: { defense: 2, saves: 2 } }] : []) },
  { names: ["Fortalecimento Arcano"], pieces: (l) => (l >= 5 ? [{ spellDC: l >= 7 ? 2 : 1 }] : []) },
];
const BY_NAME = new Map(RULES.flatMap((rule) => rule.names.map((name) => [norm(name), rule] as const)));

/** Nome da ficha com as marcações comuns de importação: "Poder: X", "X (nota)". */
const nameKeys = (name: string) => [norm(name), norm(name.replace(/\(.*?\)/g, "")), norm(name.split(":").pop() || "")];

function appliedPieces(sheet: CharacterSheet): { name: string; piece: Piece }[] {
  const level = sheet.level || 1;
  const seen = new Set<Rule>();
  const out: { name: string; piece: Piece }[] = [];
  for (const entry of [...(sheet.powers || []), ...(sheet.racialAbilities || []), ...(sheet.classAbilities || [])]) {
    const rule = nameKeys(entry.name).map((key) => BY_NAME.get(key)).find(Boolean);
    if (!rule || seen.has(rule)) continue;
    seen.add(rule);
    for (const piece of rule.pieces(level, sheet)) out.push({ name: rule.names[0], piece });
  }
  return out;
}

/** Efeitos "poder:" derivados da ficha (recalculados a cada atualização do token). */
export function passivePowerEffects(sheet: CharacterSheet): TacticalEffect[] {
  return appliedPieces(sheet)
    .filter(({ piece }) => piece.mods)
    .map(({ name, piece }, index) => {
      const skillId = piece.skill ? T20_SKILLS.find((def) => norm(def.nome) === norm(piece.skill!))?.id : undefined;
      return {
        id: `poder:${norm(name)}:${index}`,
        name: `Poder: ${name}`,
        sourceId: `poder:${norm(name)}`,
        kind: "long" as const,
        mods: piece.mods,
        ...(skillId ? { skillId } : {}),
        ...(piece.save ? { saveKind: piece.save } : {}),
      };
    });
}

/** Bônus de CD das magias vindo de poderes. */
export const powerSpellDC = (sheet: CharacterSheet): number => appliedPieces(sheet).reduce((sum, { piece }) => sum + (piece.spellDC || 0), 0);

/** Mantém os efeitos do token que não são de poder e troca os de poder pelos atuais da ficha. */
export function withPassivePowers(existing: TacticalEffect[] | undefined, sheet: CharacterSheet): TacticalEffect[] | undefined {
  const kept = (existing || []).filter((effect) => !effect.id.startsWith("poder:"));
  const merged = [...kept, ...passivePowerEffects(sheet)];
  return merged.length ? merged : existing;
}
