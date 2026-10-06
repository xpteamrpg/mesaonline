/**
 * Motor de regras aplicado à ficha (CharacterSheet) — Tormenta 20.
 */
import {
  ATTR_KEYS,
  ATTR_NAMES,
  CLASS_BY_ID,
  findClassByName,
  findItemByName,
  findRaceByName,
  norm,
  ORIGIN_BY_ID,
  pathLabel,
  RACE_BY_ID,
  raceChoiceEffects,
  raceWithVariant,
  SKILL_BY_ID,
  SELECTABLE_POWERS,
  T20_EQUIPMENT,
  T20_SKILLS,
  T20_SPELLS,
  type AttrKey,
  type T20Item,
  type T20Origin,
  type T20Power,
  type T20Spell,
} from "./compendium";
import type { Ability, AttackItem, Attribute, BuilderMeta, CharacterSheet, EquipmentItem, PowerEntry, SkillState, SpellItem } from "../../types/sheet";
import { levelForXp } from "./xp";

export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const halfLevel = (level: number) => Math.floor(level / 2);
export const trainingBonus = (level: number) => (level >= 15 ? 6 : level >= 7 ? 4 : 2);

export function makeAttributes(values: Partial<Record<AttrKey, number>>): Record<AttrKey, Attribute> {
  const out = {} as Record<AttrKey, Attribute>;
  for (const k of ATTR_KEYS) {
    out[k] = { key: k, short: k.toUpperCase(), name: ATTR_NAMES[k], value: values[k] ?? 0 };
  }
  return out;
}

export const emptySkills = (): Record<string, SkillState> =>
  Object.fromEntries(T20_SKILLS.map((s) => [s.id, { trained: false }]));

/* --------------------------------- Equipamento -------------------------------- */

export const equippedArmor = (s: CharacterSheet) => s.equipment.find((i) => i.equipped && i.category === "Armadura");
export const equippedShield = (s: CharacterSheet) => s.equipment.find((i) => i.equipped && i.category === "Escudo");

export function armorPenalty(s: CharacterSheet): number {
  return s.equipment.filter((i) => i.equipped).reduce((acc, i) => acc + (i.armorPenalty ?? 0), 0);
}

/* ---------------------------------- Perícias --------------------------------- */

export interface SkillTotal {
  id: string;
  name: string;
  attr: AttrKey;
  trained: boolean;
  trainedOnly: boolean;
  half: number;
  attrValue: number;
  training: number;
  other: number;
  penalty: number;
  total: number;
  usable: boolean;
  formula: string;
}

export function skillTotal(s: CharacterSheet, skillId: string): SkillTotal | null {
  const def = SKILL_BY_ID.get(skillId);
  if (!def) return null;
  const state = s.skills[skillId] ?? { trained: false };
  const half = halfLevel(s.level);
  const attrKey = state.attr ?? def.atributo;
  const attrValue = s.attributes[attrKey]?.value ?? 0;
  const training = state.trained ? trainingBonus(s.level) : 0;
  const other = state.other ?? 0;
  const penalty = def.penalidadeArmadura ? armorPenalty(s) : 0;
  const total = half + attrValue + training + other + penalty;
  const parts = [
    `${half} (½ nível)`,
    `${sign(attrValue)} (${attrKey.toUpperCase()})`,
    training ? `${sign(training)} (treino)` : "",
    other ? `${sign(other)} (outros)` : "",
    penalty ? `${penalty} (armadura)` : "",
  ].filter(Boolean);
  return {
    id: def.id,
    name: def.nome,
    attr: attrKey,
    trained: state.trained,
    trainedOnly: def.somenteTreinado,
    half,
    attrValue,
    training,
    other,
    penalty,
    total,
    usable: !def.somenteTreinado || state.trained,
    formula: `${parts.join(" ")} = ${sign(total)}`,
  };
}

export const allSkills = (s: CharacterSheet) =>
  T20_SKILLS.map((d) => skillTotal(s, d.id)).filter((x): x is SkillTotal => !!x);

/* ----------------------------------- Defesa ---------------------------------- */

export function defense(s: CharacterSheet) {
  const armor = equippedArmor(s);
  const shield = equippedShield(s);
  const des = s.attributes.des.value;
  const armorBonus = armor?.defenseBonus ?? 0;
  const shieldBonus = shield?.defenseBonus ?? 0;
  const other = s.defenseOther ?? 0;
  const otherTemp = s.defenseOtherTemp ?? 0;
  const total = 10 + des + armorBonus + shieldBonus + other + otherTemp;
  return {
    total,
    des,
    armor,
    armorBonus,
    shield,
    shieldBonus,
    other,
    otherTemp,
    penalty: armorPenalty(s),
    formula: `10 ${sign(des)} (DES) +${armorBonus} (armadura) +${shieldBonus} (escudo) ${sign(other)} (outros permanentes) ${sign(otherTemp)} (temporários) = ${total}`,
  };
}

/* ---------------------------------- Ataques ---------------------------------- */

export function attackTotal(s: CharacterSheet, a: AttackItem) {
  const sk = skillTotal(s, a.skill === "Luta" ? "lut" : "pon");
  const bonus = (sk?.total ?? 0) + (a.bonus ?? 0);
  const dmgAttr = a.damageAttr ? s.attributes[a.damageAttr].value : 0;
  const dmgBonus = dmgAttr + (a.damageBonus ?? 0);
  const damage = dmgBonus ? `${a.damage}${sign(dmgBonus)}` : a.damage;
  return { bonus, damage, formula: `${a.skill} ${sign(sk?.total ?? 0)}${a.bonus ? ` ${sign(a.bonus)} (arma)` : ""}` };
}

/* ------------------------------------ Carga ---------------------------------- */

export function load(s: CharacterSheet) {
  const used = Math.round(s.equipment.reduce((acc, i) => acc + i.slots * i.quantity, 0) * 2) / 2;
  const backpack = s.equipment.some((i) => /mochila/i.test(i.name)) ? 2 : 0;
  // Tormenta 20: limite de carga = 10 espaços + 2 por ponto de Força (+2 com mochila)
  const max = Math.max(5, 10 + s.attributes.for.value * 2 + backpack);
  return { used, max, overloaded: used > max, backpack };
}

/* ------------------------------------ PV / PM --------------------------------- */

/** Bônus raciais de PV/PM lidos do texto das habilidades (ex.: "+3 PV no 1º nível e +1 por nível seguinte", "+1 PM por nível"). */
export function racialVitals(raceId?: string, raceName?: string, variantId?: string) {
  const base = (raceId && RACE_BY_ID.get(raceId)) || (raceName ? findRaceByName(raceName) : undefined);
  const race = base ? raceWithVariant(base, variantId) : undefined;
  let pv1 = 0, pvLvl = 0, pmLvl = 0;
  for (const h of race?.habilidades ?? []) {
    const d = h.descricao.toLowerCase();
    const m1 = d.match(/\+(\d+)\s*(?:pontos? de vida|pv)\s*no 1º n[ií]vel/);
    const m2 = d.match(/\+(\d+)\s*(?:pontos? de vida|pv)?\s*por n[ií]vel/);
    const m3 = d.match(/\+(\d+)\s*(?:pontos? de mana|pm)\s*(?:por n[ií]vel|a cada n[ií]vel)/);
    if (m1) pv1 += Number(m1[1]);
    if (m2 && /vida|pv/.test(d) && !m3) pvLvl += Number(m2[1]);
    if (m3) pmLvl += Number(m3[1]);
  }
  return { pv1, pvLvl, pmLvl };
}

/**
 * Poderes que somam PV/PM, lidos do texto do próprio catálogo (poderes.json). Só entram os de texto inequívoco: o padrão
 * genérico confundia custos e aprimoramentos ("gaste 3 PM", "+1 PM para aprimoramentos", PV do melhor amigo).
 * Fora da tabela, de propósito: Visconde (depende do caminho), Novo Rico, Treino Intensivo, Rainha da Selva (só recupera),
 * Triunfo do Amor (temporário) e a parte "soma Carisma nos PV iniciais" de Vitalidade das Fadas.
 */
type VitalsRule = { pvPerLevel?: number; pvFlat?: number; pvFrom2nd?: number; pmPerLevel?: number; pmPerTwoLevels?: number; pmOddLevels?: number; pmFlat?: number; onlyClass?: RegExp };
const POWER_VITALS: Record<string, VitalsRule> = {
  vitalidade: { pvPerLevel: 1 }, // "Recebe +1 PV por nível de personagem e +2 em Fortitude."
  "vontade de ferro": { pmPerTwoLevels: 1 }, // "+1 PM para cada dois níveis de personagem e +2 em Vontade."
  "coracao de dragao": { pvFlat: 2, pmFlat: 2 }, // "Você recebe +2 PV e +2 PM."
  "coracao de pedra": { pvPerLevel: 1 }, // "+1 PV por nível e imunidade a petrificação."
  "quase anao": { pvPerLevel: 1 }, // "... e +1 PV por nível."
  "vitalidade das fadas": { pvFrom2nd: 1 }, // "Recebe +1 PV por nível a partir do 2º."
  "poder magico": { pmPerLevel: 1, onlyClass: /arcanista/i }, // "+1 ponto de mana por nível de arcanista."
  "xama mistico": { pmPerLevel: 1 }, // "+1 PM por nível" (por nível de druida na versão do Compêndio)
  "bencao do mana": { pmOddLevels: 1 }, // "+1 PM a cada nível ímpar."
  espiritualista: { pmOddLevels: 1 }, // "+1 PM por nível ímpar."
  "sangue elfico": { pmOddLevels: 1 }, // "+1 ponto de mana a cada nível ímpar (incluindo o 1º)."
};
const powerKey = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();

/** PV e PM extras que os poderes da ficha dão (cada poder conta uma vez). */
export function powerVitals(s: Pick<CharacterSheet, "powers" | "level" | "class">) {
  let pv = 0, pm = 0;
  const seen = new Set<string>();
  for (const power of s.powers ?? []) {
    const key = powerKey(power.name);
    const rule = POWER_VITALS[key];
    if (!rule || seen.has(key)) continue;
    if (rule.onlyClass && !rule.onlyClass.test(s.class || "")) continue;
    seen.add(key);
    const lvl = Math.max(1, s.level || 1);
    pv += (rule.pvPerLevel ?? 0) * lvl + (rule.pvFlat ?? 0) + (rule.pvFrom2nd ?? 0) * (lvl - 1);
    pm += (rule.pmPerLevel ?? 0) * lvl + Math.floor(lvl / 2) * (rule.pmPerTwoLevels ?? 0) + Math.ceil(lvl / 2) * (rule.pmOddLevels ?? 0) + (rule.pmFlat ?? 0);
  }
  return { pv, pm };
}

export function maxHp(s: CharacterSheet) {
  const cls = s.classId ? CLASS_BY_ID.get(s.classId) : findClassByName(s.class);
  if (!cls) return s.hp.max;
  const con = s.attributes.con.value;
  const r = racialVitals(s.raceId, s.race, s.raceVariantId);
  return Math.max(1, cls.pvInicial + con + r.pv1 + (s.level - 1) * (cls.pvPorNivel + con + r.pvLvl) + powerVitals(s).pv);
}

export function maxMp(s: CharacterSheet) {
  const cls = s.classId ? CLASS_BY_ID.get(s.classId) : findClassByName(s.class);
  if (!cls) return s.mp.max;
  const r = racialVitals(s.raceId, s.race, s.raceVariantId);
  return cls.pmInicial + cls.pmPorNivel * (s.level - 1) + r.pmLvl * s.level + powerVitals(s).pm;
}

/* ------------------------------- Conversões --------------------------------- */

export function itemToEquipment(it: T20Item, quantity = 1, equipped = false): EquipmentItem {
  return {
    id: uid("eq"),
    equipped,
    name: it.nome,
    quantity,
    slots: it.slots,
    price: it.preco,
    description: [it.proficiencia, it.empunhadura, it.descricao].filter(Boolean).join(" · ").slice(0, 220),
    category: it.categoria,
    defenseBonus: it.defesa,
    armorPenalty: it.penalidade,
  };
}

export function itemToAttack(it: T20Item): AttackItem | null {
  if (it.categoria !== "Arma") return null;
  const ranged = it.combate === "distancia";
  return {
    id: uid("atk"),
    name: it.nome,
    skill: ranged ? "Pontaria" : "Luta",
    damage: it.dano || "1d4",
    damageAttr: !ranged || it.danoAtributo ? it.danoAtributo ?? "for" : null,
    critical: it.critico ?? "x2",
    range: it.alcance,
    damageType: it.danoTipo || "Impacto",
    properties: [it.proficiencia, it.empunhadura, it.arremesso ? "arremesso" : ""].filter(Boolean).join(", "),
  };
}

export function powerToEntry(p: T20Power): PowerEntry {
  const type =
    p.categoria === "Classe"
      ? `Classe · ${p.subtipo}${p.caminho ? ` (${pathLabel(p.caminho)})` : ""}`
      : p.categoria === "Racial"
        ? `Racial · ${p.subtipo}`
        : p.categoria === "Concedido"
          ? `Concedido · ${p.subtipo}`
          : p.categoria;
  const costM = p.descricao.match(/gast(?:e|ar|a)\s+(\d+)\s*PM/i);
  return { id: p.id, name: p.nome, type, description: p.descricao, requirement: p.requisito || undefined, cost: costM ? Number(costM[1]) : null };
}

export function spellToItem(sp: T20Spell): SpellItem {
  const dice = sp.descricao.match(/\d+d\d+(?:\s*[+-]\s*\d+)?/)?.[0]?.replace(/\s/g, "");
  return {
    id: sp.id,
    name: sp.nome,
    circle: sp.circulo,
    school: sp.escola,
    type: sp.tipo,
    cost: sp.custo,
    execution: sp.execucao,
    range: sp.alcance,
    duration: sp.duracao,
    resistance: sp.resistencia,
    effect: dice,
    description: sp.descricao + (sp.aprimoramentos?.length ? "\n\nAprimoramentos: " + sp.aprimoramentos.map((a) => `+${a.custo} PM: ${a.desc}`).join(" ") : ""),
  };
}

/* ------------------------------- Habilidades ------------------------------- */

export function racialAbilitiesFor(raceId?: string, raceName?: string, variantId?: string): Ability[] {
  const base = (raceId && RACE_BY_ID.get(raceId)) || (raceName ? findRaceByName(raceName) : undefined);
  if (!base) return [];
  const race = raceWithVariant(base, variantId);
  return race.habilidades.map((t, i) => ({ id: `ra-${race.id}-${i}`, name: t.nome, description: t.descricao, source: race.nome }));
}

export function classAbilitiesFor(classId?: string, className?: string, level = 20, path?: string): Ability[] {
  const cls = (classId && CLASS_BY_ID.get(classId)) || (className ? findClassByName(className) : undefined);
  if (!cls) return [];
  const pathKey = path ? Object.keys(cls.habilidadesCaminho).find((k) => k === path || pathLabel(k).toLowerCase() === path.toLowerCase()) : undefined;
  const base = cls.habilidades.map((h, i) => ({ id: `ca-${cls.id}-${i}`, name: h.nome, description: h.descricao, level: h.nivel, source: cls.nome }));
  const fromPath = pathKey ? cls.habilidadesCaminho[pathKey].map((h, i) => ({ id: `cp-${cls.id}-${pathKey}-${i}`, name: h.nome, description: h.descricao, level: h.nivel, source: `${cls.nome} · ${pathLabel(pathKey)}` })) : [];
  return [...base, ...fromPath].filter((h) => (h.level ?? 1) <= level).sort((a, b) => (a.level ?? 1) - (b.level ?? 1));
}

/** Deslocamento de voo natural da raça (ex.: Sílfide 12m), lido do texto das habilidades raciais; 0 se não voa. */
export function racialFlySpeed(raceId?: string, raceName?: string, variantId?: string): number {
  for (const ab of racialAbilitiesFor(raceId, raceName, variantId)) {
    const m = ab.description.match(/voar[^.]{0,40}?(\d+)\s?m/i) ?? ab.description.match(/voo[^.]{0,30}?(\d+)\s?m/i);
    if (m) return Number(m[1]);
  }
  return 0;
}

/* ------------------------------ Itens de origem ------------------------------- */

const splitOutsideParens = (text: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/\.$/, "").trim()).filter(Boolean);
};

const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3 };

const ORIGIN_ITEM_POOL = T20_EQUIPMENT.filter((i) => !(["Encanto", "Maldição", "Modificação"] as string[]).includes(i.categoria));

const oNorm = (s: string) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();

function matchCatalogItem(name: string): T20Item | undefined {
  const base = oNorm(name).replace(/^(um|uma|dois|duas|tres|o|a|os|as)\s+/, "");
  const cands = [...new Set([base, base.replace(/coes$/, "cao"), base.replace(/oes$/, "ao"), base.replace(/es$/, ""), base.replace(/s$/, "")])];
  if (cands.includes("racao")) cands.push("racao de viagem por dia");
  return ORIGIN_ITEM_POOL.find((i) => cands.includes(oNorm(i.nome).replace(/ 20$/, "")));
}

export type OriginItemEntry = { kind: "fixed"; text: string } | { kind: "choice"; options: string[] };

const WEAPON_TYPE_RE = /^\s*(uma?\s+)?arma\b.*\bou\s+(marcial|exótica|exotica|simples)\b/i;

/** Divide por " ou " fora de parênteses. */
function splitOu(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /^\s+ou\s+/i.test(text.slice(i))) {
      out.push(cur);
      cur = "";
      i += text.slice(i).match(/^\s+ou\s+/i)![0].length - 1;
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Separa o texto de itens iniciais em itens fixos e grupos de escolha ("A ou B", "A, B ou C (escolha um)"). */
export function originItemPlan(origin: T20Origin): OriginItemEntry[] {
  const parts = splitOutsideParens(origin.itens ?? "");
  const plan: OriginItemEntry[] = [];
  const groupEnd = parts.findIndex((p) => /\(escolh(a|er) um\)/i.test(p));
  let from = 0;
  if (groupEnd >= 0) {
    const options = parts.slice(0, groupEnd + 1).flatMap((p) => splitOu(p.replace(/\s*\(escolh(a|er) um\)/i, "")));
    plan.push({ kind: "choice", options });
    from = groupEnd + 1;
  }
  for (const part of parts.slice(from)) {
    const noParen = part.replace(/\([^)]*\)/g, "");
    if (/^um ou mais\b/i.test(part) || WEAPON_TYPE_RE.test(part) || !/\s+ou\s+/i.test(noParen)) plan.push({ kind: "fixed", text: part });
    else plan.push({ kind: "choice", options: splitOu(part) });
  }
  return plan;
}

function equipmentFromText(part: string, origin: T20Origin, source: string): { item?: EquipmentItem; money: number } {
  const onlyMoney = part.match(/^T\$\s*(\d+)$/i);
  if (onlyMoney) return { money: Number(onlyMoney[1]) };
  const qtyParen = part.match(/\(x(\d+)\)/i);
  let qty = qtyParen ? Number(qtyParen[1]) : 1;
  let name = part.replace(/\s*\(x\d+\)/i, "").trim();
  const lead = name.match(/^(\d+)\s+(.*)$/);
  if (lead) { qty = Number(lead[1]); name = lead[2]; }
  const word = name.match(/^(dois|duas|tres|três)\s+/i);
  if (word) qty = NUMBER_WORDS[norm(word[1])] ?? qty;
  const hit = matchCatalogItem(name);
  if (hit) {
    const package20 = /\(\d+\)$/.test(hit.nome);
    return { item: { ...itemToEquipment(hit, package20 ? 1 : qty, false), source }, money: 0 };
  }
  const price = part.match(/T\$\s*(\d+)/i);
  const bare = name.replace(/^(um|uma)s+/i, "");
  const label = bare.charAt(0).toUpperCase() + bare.slice(1);
  return { item: { id: uid("eq"), equipped: false, name: label, quantity: qty, slots: 1, price: price ? Number(price[1]) : null, description: `Item da origem ${origin.nome}: ${part}`, category: "Item Geral", source }, money: 0 };
}

/** Converte os itens iniciais de uma origem em equipamento (marcado como "Item de origem") e tibares. `picks` = opção escolhida em cada grupo de escolha. */
export function originItemsFor(origin: T20Origin, picks: Record<number, number> = {}): { items: EquipmentItem[]; money: number } {
  const items: EquipmentItem[] = [];
  let money = 0;
  const source = `Origem: ${origin.nome}`;
  originItemPlan(origin).forEach((entry, i) => {
    const text = entry.kind === "fixed" ? entry.text : picks[i] !== undefined ? entry.options[picks[i]] : undefined;
    if (!text) return;
    const r = equipmentFromText(text, origin, source);
    if (r.item) items.push(r.item);
    money += r.money;
  });
  return { items, money };
}

/* ------------------------------- Fábrica de ficha ----------------------------- */

export interface BuildSheetInput {
  name: string;
  avatar?: string;
  avatarPos?: string;
  raceId: string;
  raceVariantId?: string;
  classId: string;
  path?: string;
  originId?: string;
  deityId?: string;
  deityName?: string;
  level?: number;
  xp?: number;
  campaign?: string;
  attributes: Partial<Record<AttrKey, number>>;
  trainedSkills?: string[];
  /** benefícios escolhidos da origem (perícias treinadas / poder) */
  originBenefits?: { tipo: string; nome: string; descricao: string; skillId?: string }[];
  builder?: BuilderMeta;
  /** escolhas raciais (perícias, opções, atributo sorteado) */
  raceExtra?: Record<string, string[]>;
  /** opção escolhida em cada grupo de itens iniciais da origem */
  originItemPicks?: Record<number, number>;
  powers?: PowerEntry[];
  spells?: SpellItem[];
  equipment?: EquipmentItem[];
  attacks?: AttackItem[];
  money?: number;
  languages?: string;
  appearance?: string;
  personality?: string;
  history?: string;
  notes?: string;
}

export function buildSheet(input: BuildSheetInput): CharacterSheet {
  const baseRace = RACE_BY_ID.get(input.raceId);
  const race = baseRace ? raceWithVariant(baseRace, input.raceVariantId) : undefined;
  const cls = CLASS_BY_ID.get(input.classId);
  const origin = input.originId ? ORIGIN_BY_ID.get(input.originId) : undefined;
  const level = input.level ?? (input.xp !== undefined ? levelForXp(input.xp) : 1);

  const skills = emptySkills();
  for (const id of [...(cls?.pericias.fixas ?? []), ...(input.trainedSkills ?? [])]) {
    if (skills[id]) skills[id] = { trained: true };
  }

  const raceEff = race ? raceChoiceEffects(race, input.raceExtra) : { trained: [] as string[], bonuses: {} as Record<string, number>, attrs: [] as AttrKey[], notes: [] as { name: string; description: string }[] };
  for (const id of raceEff.trained) if (skills[id]) skills[id] = { ...skills[id], trained: true };
  for (const [id, n] of Object.entries(raceEff.bonuses)) if (skills[id]) skills[id] = { ...skills[id], other: (skills[id].other ?? 0) + n };

  const powers: PowerEntry[] = [...(input.powers ?? [])];
  for (const b of input.originBenefits ?? []) {
    if (b.tipo === "skill" && b.skillId && skills[b.skillId]) skills[b.skillId] = { trained: true };
    else if (b.tipo !== "skill" && !powers.some((p) => p.name === b.nome)) powers.push({ id: uid("pw"), name: b.nome, type: `Origem · ${origin?.nome ?? ""}`, description: b.descricao });
  }

  let equipment = input.equipment ?? [];
  const originStuff = origin ? originItemsFor(origin, input.originItemPicks) : { items: [] as EquipmentItem[], money: 0 };
  if (!equipment.length) {
    const defaults = ["Mochila", "Traje de viajante", "Saco de dormir", "Ração de viagem", "Tocha", "Corda"];
    equipment = defaults
      .map((n) => findItemByName(n))
      .filter((x): x is T20Item => !!x)
      .map((it) => itemToEquipment(it, /ração|tocha/i.test(it.nome) ? 3 : 1));
  }
  equipment = [...originStuff.items, ...equipment];

  const attacks: AttackItem[] = input.attacks ?? [
    {
      id: uid("atk"),
      name: "Desarmado",
      skill: "Luta",
      damage: "1d3",
      damageAttr: "for",
      critical: "x2",
      damageType: "Impacto",
      properties: "Ataque desarmado",
    },
  ];

  const now = new Date().toISOString();
  const sheet: CharacterSheet = {
    id: uid("pj"),
    name: input.name || "Aventureiro",
    avatar: input.avatar,
    avatarPos: input.avatarPos,
    race: race?.nome ?? input.raceId,
    raceId: race?.id,
    raceVariantId: input.raceVariantId || undefined,
    class: cls?.nome ?? input.classId,
    classId: cls?.id,
    path: input.path,
    origin: origin?.nome,
    originId: origin?.id,
    deity: input.deityName,
    deityId: input.deityId,
    level,
    campaign: input.campaign ?? "Campanha livre",
    attributes: makeAttributes(input.attributes),
    hp: { current: 0, max: 0 },
    mp: { current: 0, max: 0 },
    defenseOther: 0,
    speed: race?.deslocamento ?? 9,
    skills,
    attacks,
    racialAbilities: [...racialAbilitiesFor(race?.id, undefined, input.raceVariantId), ...raceEff.notes.map((n, i) => ({ id: `rc-${race?.id}-${i}`, name: n.name, description: n.description, source: race?.nome }))],
    classAbilities: classAbilitiesFor(cls?.id, undefined, level, input.path),
    powers,
    spells: input.spells ?? [],
    money: (input.money ?? 120) + originStuff.money,
    equipment,
    languages: input.languages ?? "Comum",
    appearance: input.appearance,
    personality: input.personality,
    history: input.history,
    xp: input.xp ?? 0,
    notes: input.notes ?? "",
    builder: input.builder,
    createdAt: now,
    updatedAt: now,
  };
  const hp = maxHp(sheet);
  const mp = maxMp(sheet);
  sheet.hp = { current: hp, max: hp };
  sheet.mp = { current: mp, max: mp };
  return sheet;
}

/**
 * Aplica sobre uma ficha existente o que a Oficina controla (identidade, raça, classe, origem, atributos, perícias treinadas,
 * poderes/magias do compêndio, equipamento e dinheiro), mantendo diário, anotações, condições, ataques e bônus digitados à mão.
 */
export function mergeEditedSheet(orig: CharacterSheet, built: CharacterSheet, money: number): CharacterSheet {
  const powerIds = new Set(SELECTABLE_POWERS.map((p) => p.id));
  const spellIds = new Set(T20_SPELLS.map((s) => s.id));
  const keptPowers = orig.powers.filter((p) => !powerIds.has(p.id) && !p.id.startsWith("dist-") && !p.type.startsWith("Origem ·"));
  const keptSpells = orig.spells.filter((s) => !spellIds.has(s.id));
  const skills: Record<string, SkillState> = {};
  const baseOf = (raceId?: string) => (raceId ? RACE_BY_ID.get(raceId) : undefined);
  const prevBase = baseOf(orig.raceId);
  const prevEff = prevBase ? raceChoiceEffects(raceWithVariant(prevBase, orig.raceVariantId), orig.builder?.raceExtra) : { bonuses: {} as Record<string, number> };
  const newBase = baseOf(built.raceId);
  const newEff = newBase ? raceChoiceEffects(raceWithVariant(newBase, built.raceVariantId), built.builder?.raceExtra) : { bonuses: {} as Record<string, number> };
  for (const id of Object.keys(built.skills)) {
    const other = (orig.skills[id]?.other ?? 0) - (prevEff.bonuses[id] ?? 0) + (newEff.bonuses[id] ?? 0);
    skills[id] = { ...orig.skills[id], trained: built.skills[id].trained, ...(other ? { other } : { other: undefined }) };
  }
  const attackNames = new Set(orig.attacks.map((a) => a.name));
  const newAttacks = built.attacks.filter((a) => a.name !== "Desarmado" && !attackNames.has(a.name));
  return recalc({
    ...orig,
    name: built.name,
    avatar: built.avatar,
    avatarPos: built.avatarPos,
    race: built.race,
    raceId: built.raceId,
    raceVariantId: built.raceVariantId,
    class: built.class,
    classId: built.classId,
    path: built.path,
    origin: built.origin,
    originId: built.originId,
    deity: built.deity,
    deityId: built.deityId,
    level: built.level,
    campaign: built.campaign,
    attributes: built.attributes,
    skills,
    speed: orig.raceId === built.raceId && orig.raceVariantId === built.raceVariantId ? orig.speed : built.speed,
    racialAbilities: built.racialAbilities,
    classAbilities: built.classAbilities,
    powers: [...built.powers, ...keptPowers],
    spells: [...built.spells, ...keptSpells],
    equipment: built.equipment,
    attacks: [...orig.attacks, ...newAttacks],
    money,
    languages: built.languages,
    appearance: built.appearance,
    personality: built.personality,
    history: built.history,
    builder: built.builder,
  });
}

/** Recalcula PV/PM máximos e habilidades de classe após edição (mantém o atual proporcional). */
export function recalc(s: CharacterSheet): CharacterSheet {
  const hp = maxHp(s);
  const mp = maxMp(s);
  return {
    ...s,
    hp: { ...s.hp, max: hp, current: Math.min(s.hp.current, hp) },
    mp: { ...s.mp, max: mp, current: Math.min(s.mp.current, mp) },
    classAbilities: s.classId ? classAbilitiesFor(s.classId, undefined, s.level, s.path) : s.classAbilities,
    updatedAt: new Date().toISOString(),
  };
}
