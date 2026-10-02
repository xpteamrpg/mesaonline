/**
 * JSON de outra ficha online de Tormenta 20 (campos `charName`, `charRace`, `attrs`, `skills`, `attacks`, `inventory`,
 * `raceAbilities`, `classAbilities`, `charImage`...). Vira o mesmo rascunho do PDF/JSON de herói e passa pela mesma montagem de ficha,
 * então o resultado se comporta como qualquer personagem importado.
 */
import type { CharacterSheet, EquipmentItem } from "../../types/sheet";
import type { AttackItem, PowerEntry } from "../../types/sheet";
import { ATTR_KEYS, T20_SKILLS, findClassByName, findItemByName, findPowerByName, findRaceByName, norm, type AttrKey } from "../t20/compendium";
import { itemToEquipment, powerToEntry, uid } from "../t20/sheetRules";
import type { PdfDraft } from "./parseSheetText";
import { sheetFromDraft } from "./heroJson";

type Any = Record<string, any>;

export const isLegacyFicha = (o: unknown): o is Any => {
  const x = o as Any | null;
  return !!x && typeof x === "object" && typeof x.charName === "string" && !!x.attrs && typeof x.attrs === "object" && Array.isArray(x.skills);
};

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim().replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
/** "Kallyanach (Ameaças)": o que vem entre parênteses é a fonte, não faz parte do nome. */
const withoutParens = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();

const DAMAGE = /^\s*(\d+\s*d\s*\d+)\s*(?:([+-])\s*(\d+))?/i;

export function legacyFichaToDraft(o: Any): PdfDraft {
  const draft: PdfDraft = { attributes: {}, skills: {}, trainedSkills: [], rawText: "", formFields: {}, warnings: [] };
  draft.name = text(o.charName);
  draft.player = text(o.playerName);
  draft.race = text(o.charRace) ? withoutParens(String(o.charRace)) : undefined;
  draft.class = text(o.charClass);
  draft.origin = text(o.charOrigin);
  draft.deity = text(o.charDeity);
  draft.level = num(o.charLevel);
  draft.xp = num(o.extras?.xp);
  draft.money = num(o.extras?.cash);
  draft.speed = num(o.extras?.speed);
  if (draft.race) draft.raceId = findRaceByName(draft.race)?.id;
  if (draft.class) draft.classId = findClassByName(draft.class)?.id;
  if (draft.race && !draft.raceId) draft.warnings.push(`Raça não reconhecida ("${draft.race}").`);
  if (draft.class && !draft.classId) draft.warnings.push(`Classe não reconhecida ("${draft.class}").`);

  for (const key of ATTR_KEYS) {
    const v = num(o.attrs?.[key.toUpperCase()]);
    if (v !== undefined) draft.attributes[key] = v;
  }

  const st = o.status ?? {};
  if (num(st.pvM)) draft.hp = { max: num(st.pvM), current: num(st.pvC) ?? num(st.pvM) };
  if (num(st.pmM)) draft.mp = { max: num(st.pmM), current: num(st.pmC) ?? num(st.pmM) };

  // Defesa: 10 + atributo configurado + armadura + escudo + os "outros" listados, como a ficha de origem soma.
  const df = o.defense ?? {};
  const defAttr = String(df.config?.attr ?? "DES").toLowerCase() as AttrKey;
  const others = Array.isArray(df.other) ? df.other.reduce((sum: number, x: Any) => sum + (num(x?.bonus) ?? 0), 0) : 0;
  if (draft.attributes[defAttr] !== undefined) {
    const half = o.armorHalfLevel ? Math.floor((draft.level ?? 1) / 2) : 0; // "armadura + 1/2 nível" da ficha de origem
    draft.defense = 10 + (df.config?.apply === false ? 0 : draft.attributes[defAttr]!) + (num(df.armor?.bonus) ?? 0) + half + (num(df.shield?.bonus) ?? 0) + others;
  }

  // Perícias: treinadas, "outros" e atributo trocado, casando o nome com o catálogo.
  const skillOther: Record<string, number> = {};
  const skillAttr: Record<string, AttrKey> = {};
  const skillNotes: Record<string, string> = {};
  for (const s of o.skills as Any[]) {
    const name = norm(withoutParens(String(s?.n ?? "")));
    const def = T20_SKILLS.find((x) => norm(x.nome) === name) ?? T20_SKILLS.find((x) => name && norm(x.nome).startsWith(name));
    if (!def) continue;
    if (s.trained) draft.trainedSkills.push(def.id);
    const other = num(s.other);
    if (other) skillOther[def.id] = other;
    const attr = String(s.a ?? "").toLowerCase() as AttrKey;
    if (ATTR_KEYS.includes(attr) && attr !== def.atributo) skillAttr[def.id] = attr;
    if (text(s.specialty)) skillNotes[def.id] = String(s.specialty).trim();
  }
  if (Object.keys(skillOther).length) draft.skillOther = skillOther;
  if (Object.keys(skillAttr).length) draft.skillAttr = skillAttr;
  if (Object.keys(skillNotes).length) draft.skillNotes = skillNotes;

  // Inventário: item do catálogo quando existe; armadura e escudo da ficha mandam no bônus e na penalidade.
  const equipment: EquipmentItem[] = [];
  for (const it of Array.isArray(o.inventory) ? (o.inventory as Any[]) : []) {
    const name = String(it?.name ?? "").trim();
    if (!name) continue;
    const quantity = num(it.qtd) ?? 1;
    const equipped = !!it.equipped;
    const def = findItemByName(withoutParens(name));
    equipment.push(def
      ? { ...itemToEquipment(def, quantity, equipped), name: name }
      : { id: uid("eq"), equipped, name, quantity, slots: num(it.slots) ?? 0, price: null, description: text(it.note) ?? "", category: "Item Geral" });
  }
  for (const [part, category] of [["armor", "Armadura"], ["shield", "Escudo"]] as const) {
    const piece = df[part] as Any | undefined;
    const bonus = num(piece?.bonus);
    if (!text(piece?.name) || bonus === undefined) continue;
    const key = norm(String(piece!.name));
    const penalty = num(piece?.penalty);
    const patch = { equipped: true, category, defenseBonus: bonus, armorPenalty: penalty ? -Math.abs(penalty) : undefined } as const;
    const found = equipment.find((e) => norm(e.name) === key);
    if (found) Object.assign(found, patch);
    else equipment.push({ id: uid("eq"), name: String(piece!.name).trim(), quantity: 1, slots: 0, price: null, description: text(piece?.desc) ?? "", ...patch });
  }
  if (equipment.length) draft.equipment = equipment;

  // Ataques: "bonus" é o total do teste de ataque (o resto vira bônus extra depois de somar a perícia).
  const attacks: AttackItem[] = [];
  const attackTotals: Record<string, number> = {};
  for (const a of Array.isArray(o.attacks) ? (o.attacks as Any[]) : []) {
    const name = text(a?.name);
    if (!name) continue;
    const m = String(a.dmg ?? "").match(DAMAGE);
    const range = String(a.critRange ?? "20");
    const item: AttackItem = {
      id: uid("atk"),
      name,
      skill: a.skill === "Pontaria" ? "Pontaria" : "Luta",
      damage: m ? m[1].replace(/\s/g, "") : text(a.dmg) ?? "—",
      damageBonus: m?.[3] ? (m[2] === "-" ? -1 : 1) * Number(m[3]) : undefined,
      critical: range === "20" || !range ? String(a.crit || "x2") : `${range}/${a.crit || "x2"}`,
      damageType: text(a.type) ?? "",
      range: text(a.range),
      properties: text(a.desc),
    };
    attacks.push(item);
    const total = num(a.bonus);
    if (total !== undefined) attackTotals[item.id] = total;
  }
  if (attacks.length) { draft.attacks = attacks; draft.attackTotals = attackTotals; }

  // Habilidades de raça e de classe da ficha (com o texto que a pessoa guardou); o que a raça/classe já dá de graça é tirado depois.
  const powers: PowerEntry[] = [];
  const seen = new Set<string>();
  const add = (tag: string, raw: Any) => {
    const name = text(raw?.name);
    if (!name || seen.has(norm(name))) return;
    seen.add(norm(name));
    const found = findPowerByName(withoutParens(name));
    powers.push(found ? { ...powerToEntry(found), name } : { id: uid("pw"), name, type: tag, description: text(raw?.desc) ?? "" });
  };
  for (const r of Array.isArray(o.raceAbilities) ? (o.raceAbilities as Any[]) : []) add("Raça", r);
  for (const c of Array.isArray(o.classAbilities) ? (o.classAbilities as Any[]) : []) add("Classe", c);
  if (powers.length) draft.powers = powers;

  draft.notes = [text(o.notes), text(o.notesCampanha), text(o.notesOutros), text(o.extras?.profs) ? `Proficiências: ${String(o.extras.profs).trim()}` : undefined].filter(Boolean).join("\n\n") || undefined;
  return draft;
}

/** Ficha digital pronta a partir desse JSON. O retrato (muitas vezes um PNG enorme) vai em `avatar` e deve ser reduzido por quem importa. */
export function legacyFichaToSheet(o: Any, campaign?: string): CharacterSheet {
  const sheet = sheetFromDraft(legacyFichaToDraft(o), campaign, "JSON da ficha");
  // Poder repetido: se a raça ou a classe já entregam a mesma habilidade, ela não entra também em "poderes".
  const free = new Set([...sheet.racialAbilities, ...sheet.classAbilities].map((a) => norm(a.name)));
  sheet.powers = sheet.powers.filter((p) => !free.has(norm(p.name)));
  if (typeof o.charImage === "string" && o.charImage.startsWith("data:image")) sheet.avatar = o.charImage;
  if (text(o.charImagePos)) sheet.avatarPos = String(o.charImagePos);
  return sheet;
}
