/**
 * Leitura dos campos de formulário da ficha "Modelo de Heróis" (PDF editável do Adestrador de Ameaças T20):
 * atributos (`modFor`…), PV/PM (`vidaMax`, `manaMax`), defesa, perícias por posição (`treinado_prN`, `outros_prN`,
 * `modSelect_prN`), inventário (`itemN`/`slotN`), ataques (`ataqueN`…), poderes, magias e textos livres.
 *
 * Função pura (sem pdf.js): recebe o mapa nome→valor que `readPdf` extrai e completa o rascunho.
 */
import type { AttrKey } from "../t20/compendium";
import { parseItemLine } from "./itemLine";
import { ATTR_KEYS, T20_EQUIPMENT, T20_SKILLS, findClassByName, findPowerByName, findRaceByName, findSpellByName, norm, T20_POWERS, T20_SPELLS, editDistance } from "../t20/compendium";
import type { AttackItem, EquipmentItem, PowerEntry, SpellItem } from "../../types/sheet";
import { itemToEquipment, powerToEntry, spellToItem, uid } from "../t20/sheetRules";
import { levelForXp } from "../t20/xp";
import type { PdfDraft } from "./parseSheetText";

/** Posição (1..29) de cada perícia no formulário: ordem alfabética do T20, exceto Ofício (tem bloco próprio) e a posição 9, sem dados no modelo. */
const SKILL_SLOTS: Record<number, string> = {
  1: "acr", 2: "ade", 3: "atl", 4: "atu", 5: "cav", 6: "con", 7: "cur", 8: "dip", 10: "eng", 11: "for", 12: "fur", 13: "gue", 14: "ini",
  15: "int", 16: "intu", 17: "inv", 18: "jog", 19: "lad", 20: "lut", 21: "mis", 22: "nob", 23: "per", 24: "pil", 25: "pon", 26: "ref", 27: "rel", 28: "sob", 29: "von",
};
const MOD_ATTR: Record<string, AttrKey> = { modfor: "for", moddes: "des", modcon: "con", modint: "int", modsab: "sab", modcar: "car" };

const ALL_OFF = /^\/?(off|nao|não|no|false|0)$/i;
const isOn = (v: string | undefined) => !!v && v.trim() !== "" && !ALL_OFF.test(v.trim());

const toNum = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const t = String(v).trim().replace(/[\u2212\u2013]/g, "-").replace(/\.(?=\d{3}(?!\d))/g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && t !== "" ? n : undefined;
};

/** Campos do modelo de heróis? (nomes exclusivos dele) */
export function isHeroForm(fields: Record<string, string>): boolean {
  const keys = new Set(Object.keys(fields).map((k) => norm(k.split(".").pop() ?? k).replace(/\s/g, "")));
  return ["modfor", "moddes", "modcon", "modint", "modsab", "modcar"].filter((k) => keys.has(k)).length >= 3 || (keys.has("vidamax") && keys.has("manamax"));
}

/** Leitor tolerante: ignora caixa, acento, espaços e o prefixo hierárquico do campo ("Pagina1.Nome"). */
function reader(fields: Record<string, string>) {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(fields)) {
    const key = norm(k.split(".").pop() ?? k).replace(/\s/g, "");
    if (!map.has(key)) map.set(key, String(v));
  }
  const get = (name: string) => {
    const v = map.get(norm(name).replace(/\s/g, ""));
    return v === undefined || v.trim() === "" ? undefined : v.trim();
  };
  return { get, num: (name: string) => toNum(get(name)) };
}

const exactItem = (name: string) => {
  const n = norm(name.replace(/\.$/, "").replace(/\s*\((?:origem|comprado[^)]*|vendido[^)]*)\)\s*/gi, " ").trim());
  return n ? T20_EQUIPMENT.find((i) => norm(i.nome) === n) : undefined;
};

/** "x3/20" → "20/x3" (formato da ficha digital: margem/multiplicador). */
const critical = (raw: string | undefined) => {
  const t = (raw ?? "").trim();
  const m = t.match(/^x\s*(\d+)\s*\/\s*(\d+)$/i);
  if (m) return `${m[2]}/x${m[1]}`;
  return t || "x2";
};

/** Divide "- [Classe] ___: Briga, casca grossa" em pares (tipo, nome). Ignora modelos ("___" sozinho, "<...>"). */
function powersFromText(text: string): { tag: string; name: string }[] {
  const out: { tag: string; name: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*[-•·*]\s*\[([^\]]+)\]\s*_*\s*:?\s*(.*)$/);
    if (!m) continue;
    const body = m[2].replace(/^[^—–;,:]*[—–]\s*/, ""); // "Bárbaro — Fúria +2; …" → "Fúria +2; …"
    for (const part of body.split(/[,;]/)) {
      const name = part.replace(/:.*$/, "").replace(/\s*\+\d+\s*$/, "").replace(/^[\s_]+|[\s_.]+$/g, "").trim();
      if (name && !/^[<(]/.test(name) && !/^_+$/.test(name) && !/^nenhum/i.test(name)) out.push({ tag: m[1].trim(), name });
    }
  }
  return out;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Tira o que a pessoa escreve em volta do nome: [nível 1- Arcanista], {Escola}, <>, (anotação), "-1PM", "nível 4- ". */
function cleanSpellName(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[-–]\s*\d+\s*PM\b/gi, " ")
    .replace(/^\s*n[ií]vel\s*\d+\s*[-–:]?\s*/i, " ")
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Acha a magia no catálogo: nome limpo, depois tolerando 1-2 letras erradas, depois sem a(s) primeira(s) palavra(s) (ex.: origem "Arcanista Imagem espelhada"). */
function matchSpell(name: string) {
  const exact = findSpellByName(name);
  if (exact) return exact;
  const key = norm(name);
  if (key.length >= 5) {
    const limit = key.length >= 10 ? 2 : 1;
    let best: { spell: (typeof T20_SPELLS)[number]; d: number } | undefined;
    let tie = false;
    for (const spell of T20_SPELLS) {
      const d = editDistance(key, norm(spell.nome));
      if (d > limit) continue;
      if (!best || d < best.d) { best = { spell, d }; tie = false; } else if (d === best.d) tie = true;
    }
    if (best && !tie) return best.spell;
  }
  const words = name.split(" ");
  for (let drop = 1; drop <= 2 && words.length - drop >= 1; drop += 1) {
    const found = findSpellByName(words.slice(drop).join(" "));
    if (found) return found;
  }
  return undefined;
}

/**
 * Campo "Habilidades de Raça e Origem": seções "=====Racial=====" e "=====Origem=====" com linhas "Poderes: a, b" / "habilidades: a, b"
 * ou "Poderes:" seguido de um nome por linha. Devolve só os nomes de poderes (ignora Atributos, Visão, Itens, "+1 int", idade, desvantagens).
 */
function racialOriginPowers(text: string): Array<{ tag: string; name: string }> {
  const out: Array<{ tag: string; name: string }> = [];
  let section: "Racial" | "Origem" | null = null;
  let collecting = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const head = line.match(/^=+\s*([^=]+?)\s*=+$/);
    if (head) {
      const h = norm(head[1]);
      section = h.startsWith("racial") ? "Racial" : h.startsWith("origem") ? "Origem" : null;
      collecting = false;
      continue;
    }
    if (!section) continue;
    if (/^[=\-\s]*$/.test(line)) { collecting = false; continue; }
    const labeled = line.match(/^[-•*\s]*(poderes|habilidades|poder|habilidade)\s*:\s*(.*)$/i);
    let body: string;
    if (labeled) { body = labeled[2]; collecting = body.trim() === ""; }
    else if (collecting) body = line.replace(/^[-•*\s]+/, "");
    else continue;
    for (const part of body.split(/[,;]/)) {
      const name = part.replace(/:.*$/, "").replace(/\.$/, "").trim();
      if (name && !/\d/.test(name)) out.push({ tag: section, name });
      if (part.includes(":")) break; // "canção dos mares: Despedaçar, Amedrontar": o que vem depois dos dois pontos são as magias da habilidade
    }
  }
  return out;
}

/** Rótulos soltos (origem da magia) que a pessoa deixa numa linha: não são magias. */
/** Poder do catálogo para um nome com erro de digitação ("Redirecionar distino"): só se UM poder chega perto (1 letra, ou 2 em nomes longos). */
function nearPower(name: string) {
  const key = norm(name);
  if (key.length < 6) return undefined;
  const limit = key.length >= 12 ? 2 : 1;
  const near = T20_POWERS.filter((p) => editDistance(key, norm(p.nome)) <= limit);
  return near.length === 1 ? near[0] : undefined;
}

const SPELL_LABELS = /^(ra[cç]a|origem|classe|item|poder)$/i;

/**
 * Magias da ficha: linhas "[nível] | Nome | Escola" ou listas "Origem: magia, magia", sob separadores de círculo
 * "(N° Círculo)" ou "=====N° Círculo=====". Ignora o texto-modelo "<Nome da Magia>", custos soltos ("3 PM") e rótulos.
 */
function spellsFromText(text: string): SpellItem[] {
  const out: SpellItem[] = [];
  let circle = 1;
  for (const raw of text.split(/\r?\n/)) {
    const head = raw.match(/\((\d)\s*[°ºo]?\s*c[ií]rculo\)/i) ?? raw.match(/^[\s=\-]*(\d)\s*[°ºo]?\s*c[ií]rculo[\s=\-]*$/i);
    if (head) { circle = Number(head[1]); continue; }
    if (/^\s*\d+\s*PM\s*$/i.test(raw) || /^[\s=]*$/.test(raw) || /<\s*Nome da Magia\s*>/i.test(raw)) continue;
    const cols = raw.split("|").map((c) => c.trim());
    const nameCol = cols.length >= 3 ? cols[1] : cols[0].startsWith("[") ? cols[1] : cols[0];
    const candidates = cols.length >= 2 ? [nameCol] : raw.replace(/^[^:\[]*:/, "").split(/[,;]/);
    for (const candidate of candidates) {
      const name = cleanSpellName(candidate);
      if (!name || SPELL_LABELS.test(name) || out.some((x) => norm(x.name) === norm(name))) continue;
      const found = matchSpell(name);
      if (found && out.some((x) => norm(x.name) === norm(found.nome))) continue;
      out.push(found ? spellToItem(found) : { id: uid("sp"), name: capitalize(name), circle, school: cols[2] || undefined, cost: 0 });
    }
  }
  return out;
}

export function parseHeroForm(fields: Record<string, string>, draft: PdfDraft) {
  const f = reader(fields);
  const set = <K extends "name" | "race" | "class" | "origin" | "deity">(key: K, field: string) => {
    const v = f.get(field);
    if (v && !draft[key]) draft[key] = v;
  };
  set("name", "Nome"); set("race", "Raca"); set("origin", "Origem"); set("deity", "Divindade");
  const player = f.get("Jogador");
  if (player && !draft.player) draft.player = player;
  // "Arcanista ( Feiticeiro abençoada)": a classe é o que vem antes do parêntese; o resto fica nas anotações
  const classRaw = f.get("Classe");
  const classExtra = classRaw?.match(/\(([^)]*)\)/)?.[1]?.trim();
  if (classRaw && !draft.class) draft.class = classRaw.replace(/\s*\([^)]*\)\s*/g, " ").trim();

  const level = f.num("nivel");
  if (level !== undefined && draft.level === undefined) draft.level = level;
  const xp = f.num("pExp");
  if (xp !== undefined && draft.xp === undefined) draft.xp = xp;
  // Nível x PE: pela tabela do T20 os PE definem o nível. Se a ficha diz um nível menor que o dos PE, vale o dos PE.
  if (draft.level !== undefined && draft.xp !== undefined) {
    const byXp = levelForXp(draft.xp);
    if (byXp > draft.level) {
      draft.warnings.push(`O nível da ficha (${draft.level}) não bate com os ${draft.xp} PE (nível ${byXp} pela tabela); usei o nível ${byXp}.`);
      draft.level = byXp;
    } else if (byXp < draft.level) {
      draft.warnings.push(`A ficha está no nível ${draft.level}, mas os ${draft.xp} PE só chegam ao nível ${byXp}; mantive o nível da ficha.`);
    }
  }
  const money = f.num("T$");
  if (money !== undefined && draft.money === undefined) draft.money = money;

  const attrs: Partial<Record<AttrKey, number>> = {};
  for (const [field, key] of Object.entries(MOD_ATTR)) {
    const n = f.num(field);
    if (n !== undefined) attrs[key] = n;
  }
  for (const k of ATTR_KEYS) if (attrs[k] !== undefined && draft.attributes[k] === undefined) draft.attributes[k] = attrs[k];

  const hpMax = f.num("vidaMax");
  if (hpMax) draft.hp = { max: hpMax, current: f.num("vidaAtual") ?? hpMax };
  const mpMax = f.num("manaMax");
  if (mpMax) draft.mp = { max: mpMax, current: f.num("manaAtual") ?? mpMax };

  // Defesa: o total do modelo (Texto13); se faltar, soma as partes (10 + atributo + armadura + outros + apoio).
  const defAttr = MOD_ATTR[norm(f.get("modDef") ?? "").replace(/\s/g, "")];
  const defParts = f.num("defesa1") ?? 0;
  const defense = f.num("Texto13") ?? (defAttr && draft.attributes[defAttr] !== undefined ? 10 + draft.attributes[defAttr]! + defParts + (f.num("defesaOutros") ?? 0) + (f.num("apoioDef") ?? 0) : undefined);
  if (defense !== undefined && draft.defense === undefined) draft.defense = defense;
  const speed = f.num("deslocamento");
  if (speed !== undefined && draft.speed === undefined) draft.speed = speed;

  /* ------------------------------- perícias ------------------------------- */
  const trained = new Set(draft.trainedSkills);
  const skillOther: Record<string, number> = { ...(draft.skillOther ?? {}) };
  const skillAttr: Record<string, AttrKey> = { ...(draft.skillAttr ?? {}) };
  const byName = new Map(T20_SKILLS.map((s) => [norm(s.nome), s]));
  for (const word of norm(f.get("Pericias") ?? "").split(/[^a-z]+/)) {
    const sk = byName.get(word === "reflexo" ? "reflexos" : word);
    if (sk) trained.add(sk.id);
  }
  for (const [slot, id] of Object.entries(SKILL_SLOTS)) {
    const n = Number(slot);
    if (isOn(f.get(`treinado_pr${n}`))) trained.add(id);
    const other = f.num(`outros_pr${n}`);
    if (other) skillOther[id] = other;
    const sel = MOD_ATTR[norm(f.get(`modSelect_pr${n}`) ?? "").replace(/\s/g, "")];
    const def = T20_SKILLS.find((s) => s.id === id);
    if (sel && def && sel !== def.atributo) skillAttr[id] = sel;
  }
  // Ofício: até 10 linhas "nome" + treino/outros; "ND" = vazio.
  const oficios: string[] = [];
  let oficioOther = 0;
  for (let i = 1; i <= 10; i++) {
    const nm = f.get(`oficio${i}`);
    if (!nm || /^nd$/i.test(nm)) continue;
    oficios.push(nm);
    oficioOther = Math.max(oficioOther, f.num(`outros_of${i}`) ?? 0);
  }
  if (oficios.length) {
    trained.add("ofi");
    if (oficioOther) skillOther.ofi = oficioOther;
    draft.skillNotes = { ...(draft.skillNotes ?? {}), ofi: oficios.join(", ") };
  }
  draft.trainedSkills = [...trained];
  draft.skillOther = skillOther;
  draft.skillAttr = skillAttr;

  /* ------------------------------ inventário ------------------------------ */
  const bare = (n: string) => norm(n.replace(/\(.*?\)/g, ""));
  const equippedNames = new Set([f.get("equip1"), f.get("equip2"), f.get("equip3")].filter(Boolean).map((n) => bare(n!)));
  const equipment: EquipmentItem[] = [];
  for (let i = 1; i <= 40; i++) {
    const raw = f.get(`item${i}`);
    if (!raw || raw.startsWith("*")) continue; // "*…*" = instruções do modelo
    const line = parseItemLine(raw);
    const name = raw.replace(/\.$/, "").replace(/^\s*\d+\s*(?:x|×)\s*/i, "").trim();
    const found = exactItem(name) ?? line.base;
    const slots = f.num(`slot${i}`);
    const mods = line.modifications.map((m) => m.nome);
    const base: EquipmentItem = found
      ? itemToEquipment(found, line.quantity, false)
      : { id: uid("eq"), equipped: false, name, quantity: line.quantity, slots: slots ?? 1, price: null, description: "", category: "Item Geral" };
    // Já comprado: o preço do item-base fica como está, a melhoria só é registrada (nada é cobrado na importação).
    const notes = [mods.length ? `Melhorias: ${mods.join(", ")}` : "", line.leftover ? `Não identificado: ${line.leftover}` : ""].filter(Boolean).join(" · ");
    equipment.push({ ...base, name, slots: slots ?? base.slots, equipped: equippedNames.has(bare(name)), ...(mods.length ? { modifications: mods } : {}), description: [base.description, notes].filter(Boolean).join(" · ").slice(0, 320) });
  }
  // Armaduras/escudos informados no quadro de defesa (armadura1/defesa1/penalidade1…): valores da ficha valem mais que o catálogo.
  for (let i = 1; i <= 3; i++) {
    const an = f.get(`armadura${i}`);
    if (!an) continue;
    const found = exactItem(an);
    const cat = found?.categoria === "Escudo" || (!found && i >= 2) ? "Escudo" : "Armadura";
    const bonus = f.num(`defesa${i}`);
    const penalty = f.num(`penalidade${i}`);
    const existing = equipment.find((e) => bare(e.name) === bare(an));
    const patch = { equipped: true, category: cat as EquipmentItem["category"], defenseBonus: bonus ?? found?.defesa, armorPenalty: penalty ? -Math.abs(penalty) : found?.penalidade };
    if (existing) Object.assign(existing, patch);
    else equipment.push({ ...(found ? itemToEquipment(found, 1, true) : { id: uid("eq"), name: an, quantity: 1, slots: 1, price: null, description: "" }), ...patch, name: an } as EquipmentItem);
  }
  if (equipment.length) draft.equipment = equipment;

  /* -------------------------------- ataques -------------------------------- */
  const attacks: AttackItem[] = [];
  const attackTotals: Record<string, number> = {};
  for (let i = 1; i <= 20; i++) {
    const name = f.get(`ataque${i}`);
    if (!name) continue;
    const range = f.get(`alcance${i}`);
    const dmgRaw = (f.get(`dano${i}`) ?? "1d3").replace(/\s/g, "");
    const dice = dmgRaw.match(/^\d+d\d+/i)?.[0] ?? dmgRaw;
    const tail = dmgRaw.slice(dice.length);
    const attrTok = norm(tail.replace(/^\+/, "")).slice(0, 3) as AttrKey;
    const flat = tail.match(/^\+?(-?\d+)$/);
    const melee = !range || /pessoal|adjacente|corpo|toque/i.test(range);
    const atk: AttackItem = {
      id: uid("atk"),
      name,
      skill: melee ? "Luta" : "Pontaria",
      damage: dice,
      damageAttr: ATTR_KEYS.includes(attrTok) ? attrTok : null,
      critical: critical(f.get(`critico${i}`)),
      range: melee ? undefined : range,
      damageType: f.get(`tipo${i}`) ?? "Impacto",
      damageBonus: flat ? Number(flat[1]) : undefined,
    };
    attacks.push(atk);
    const total = f.get(`tAtak${i}`)?.match(/([+-]\s*\d+)\s*$/);
    if (total) attackTotals[atk.id] = Number(total[1].replace(/\s/g, ""));
  }
  if (attacks.length) { draft.attacks = attacks; draft.attackTotals = attackTotals; }

  /* --------------------------- poderes e magias ---------------------------- */
  const cls = draft.class ? findClassByName(draft.class) : undefined;
  const powers: PowerEntry[] = [];
  const seen = new Set<string>();
  const addPower = (tag: string, raw: string) => {
    const name = raw.replace(/\(.*?\)/g, "").trim() || raw;
    const key = norm(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const found = findPowerByName(name, cls?.id) ?? nearPower(name);
    powers.push(found ? powerToEntry(found) : { id: uid("pw"), name: capitalize(raw.trim()), type: tag, description: "" });
  };
  const listed = powersFromText(f.get("Poderes") ?? "");
  for (const p of listed) addPower(p.tag, p.name);
  // Os campos de poder do formulário (Poder1..12, PoderConcedido1..12) entram sempre, junto com a lista escrita em "Poderes"; poder repetido não duplica.
  for (let n = 1; n <= 12; n += 1) {
    for (const [prefix, tag] of [["PoderConcedido", "Concedido"], ["Poder", "Classe"]] as const) {
      for (const part of (f.get(`${prefix}${n}`) ?? "").split(/[,;]/)) if (part.trim()) addPower(tag, part.replace(/>>.*$/, "").trim());
    }
  }
  // Poderes de raça e de origem anotados à parte (o que a raça já dá de graça não é repetido).
  const freeByRace = new Set((draft.race ? findRaceByName(draft.race)?.habilidades ?? [] : []).map((h) => norm(h.nome)));
  for (const p of racialOriginPowers(f.get("Habilidades de Raça e Origem") ?? "")) {
    if (!freeByRace.has(norm(p.name))) addPower(p.tag, p.name);
  }
  if (powers.length) draft.powers = powers;
  const spells = spellsFromText(f.get("Magias") ?? "");
  if (spells.length) draft.spells = spells;

  /* ----------------------------- textos livres ----------------------------- */
  const blocks: string[] = [];
  if (classExtra) blocks.push(`Classe: ${classRaw!.replace(/\s+/g, " ")}`);
  const prof = f.get("proficiencias");
  if (prof) blocks.push(`Proficiências: ${prof}`);
  const hab = f.get("Habilidades de Raça e Origem");
  if (hab) blocks.push(`— Habilidades de Raça e Origem —\n${hab}`);
  const notes = f.get("Anotações") ?? f.get("Anotacoes");
  if (notes) blocks.push(`— Anotações —\n${notes}`);
  const missions = f.get("Missões") ?? f.get("Missoes");
  if (missions && !/Missão 00: Nome \(mestre\)/i.test(missions)) blocks.push(`— Missões —\n${missions}`);
  if (blocks.length) draft.notes = blocks.join("\n\n");
  const desc = f.get("Descrição") ?? f.get("Descricao");
  if (desc) draft.appearance = desc;
}
