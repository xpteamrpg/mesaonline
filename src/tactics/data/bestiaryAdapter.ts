import threatsJson from "../../../ficha-modernrpg/t20/vtt/ameacas.json";
import { spellPm } from "../../game/spellPm";
import campaignThreatsJson from "../../../ficha-modernrpg/t20/vtt/ameacas_campanhas.json";
import spellsJson from "../../../ficha-modernrpg/t20/vtt/magias.json";
import type { GameAction, SaveType, ThreatTemplate } from "../../game/types";
import { parseSize } from "../../game/tokenSize";
import {
  actionKindFromExecution,
  formulasIn,
  inferActionFields,
  normalizeRuleText,
  numberBonus,
  parseRangeM,
  parseSave,
} from "../interpretation/modernRpgRules";
import { threatImage } from "./threatImages";

export interface CanonicalThreat {
  id: string;
  nome: string;
  tipo?: string;
  nd?: string;
  iniciativa?: string;
  defesa?: number;
  fort?: string;
  ref?: string;
  von?: string;
  pv?: number;
  pm?: number;
  deslocamento?: string;
  ataques?: Array<{ nome: string; tipo?: string; bonus?: string; dano?: string; desc?: string }>;
  habilidades?: Array<{ nome: string; tipo?: string; desc?: string }>;
  atributos?: Partial<Record<"for" | "des" | "con" | "int" | "sab" | "car", number>>;
  pericias?: Array<{ nome: string; valor?: string }>;
  tesouro?: string;
  imagem?: string;
  custom?: boolean;
  hidden?: boolean;
  customPortrait?: string;
}

interface CanonicalSpell {
  id: string;
  nome: string;
  circulo: number;
  tipo?: string;
  escola?: string;
  execucao?: string;
  alcance?: string;
  alvo?: string;
  resistencia?: string;
  custo?: number;
  descricao?: string;
}

const spellCatalog = spellsJson as CanonicalSpell[];

function critical(text: string) {
  return {
    margin: Number(text.match(/(?:^|[,;(\s])(1[5-9]|20)(?=\s*[,/x)]|\s*$)/)?.[1]) || 20,
    multiplier: Number(text.match(/x\s*(\d+)/i)?.[1]) || 2,
  };
}

function attackRepeats(name: string) {
  if (/\b(?:duas|dois)\b/i.test(name)) return 2;
  if (/\btr[eê]s\b/i.test(name)) return 3;
  const explicit = Number(name.match(/^\s*(\d+)\b/)?.[1]);
  return explicit > 1 ? explicit : 1;
}

type ThreatAttack = NonNullable<CanonicalThreat["ataques"]>[number];

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Na ficha do livro um ataque pode trazer outro colado no texto ("Espada curta +9 (1d6+3, 19)" e, no campo de descrição, "E mordida +9 (1d6+3)").
 * São ataques DIFERENTES: cada um vira a sua ação em Agir (só habilidades como o Bote do gnoll fazem os dois juntos).
 */
export function splitCombinedAttacks(attacks: ThreatAttack[]): ThreatAttack[] {
  const out: ThreatAttack[] = [];
  for (const attack of attacks) {
    let current: ThreatAttack = { ...attack };
    let rest = String(attack.desc || "");
    out.push(current);
    for (let guard = 0; guard < 6; guard += 1) {
      const match = rest.match(/^\s*(?:e|ou)\s+([^+\-\d(]+?)\s*([+-]\d+)\s*\(([^)]*)\)\s*(.*)$/i);
      if (!match) break;
      current.desc = "";
      current = { nome: cap(match[1].trim()), tipo: attack.tipo, bonus: match[2], dano: match[3], desc: "" };
      out.push(current);
      rest = match[4];
    }
    if (current !== out[out.length - 1]) break;
    if (current === out[out.length - 1] && rest && current !== attack) current.desc = rest;
  }
  return out;
}

const plain = (text: string) => normalizeRuleText(text).replace(/[^a-z\s]/g, " ").replace(/\b(?:x\d+|duas?|dois|tres|tr[eê]s)\b/g, " ").replace(/\s+/g, " ").trim();
const stemWord = (word: string) => word.replace(/(?:es|s)$/, "");

/**
 * Habilidade do tipo "faz uma investida e ataca com A e B" (Bote, Rasante, Marrada): vira UMA ação completa de investida que faz esses ataques
 * juntos (+2 em todos, contra o mesmo alvo). O primeiro ataque citado é a ação principal; os demais saem em `combo`.
 */
function chargeComboAction(threat: CanonicalThreat, ability: NonNullable<CanonicalThreat["habilidades"]>[number], index: number, attackActions: GameAction[]): GameAction | null {
  const text = String(ability.desc || "");
  if (!/investida/i.test(text) || !/ataca/i.test(text)) return null;
  const after = normalizeRuleText(text.split(/ataca(?:ndo)?\s+com/i)[1] || "");
  const mentioned: GameAction[] = [];
  const positions: Array<{ at: number; action: GameAction; times: number }> = [];
  for (const action of attackActions) {
    const words = plain(action.name).split(" ").filter(Boolean).map(stemWord);
    const at = words.length ? after.search(new RegExp(words.join("\\w*\\s+") + "\\w*", "i")) : -1;
    if (at < 0) continue;
    const before = after.slice(Math.max(0, at - 12), at);
    positions.push({ at, action, times: /\b(?:duas|dois)\s+(?:suas\s+|seus\s+)?$/.test(before) ? 2 : 1 });
  }
  positions.sort((a, b) => a.at - b.at).forEach((entry) => { for (let n = 0; n < entry.times; n += 1) mentioned.push(entry.action); });
  if (!mentioned.length) return null;
  const [first, ...others] = mentioned;
  return {
    ...first,
    id: `threat:${threat.id}:ability:${index}`,
    name: ability.nome,
    kind: "full",
    charge: true,
    attackBonus: (first.attackBonus || 0) + 2,
    repeats: 1,
    combo: others.map((action) => action.id),
    description: ability.desc || "Investida: avança até o dobro do deslocamento em linha reta e ataca; +2 nos ataques, contra o mesmo alvo.",
  };
}

function actionForAttack(threat: CanonicalThreat, attack: NonNullable<CanonicalThreat["ataques"]>[number], index: number): GameAction {
  const ranged = /distância|distancia|arremesso|disparo/i.test(attack.tipo || "");
  const formulas = formulasIn(`${attack.dano || ""} ${attack.desc || ""}`);
  const crit = critical(`${attack.dano || ""} ${attack.desc || ""}`);
  return {
    id: `threat:${threat.id}:attack:${index}`,
    source: "threat",
    sourceId: threat.id,
    name: attack.nome || `Ataque ${index + 1}`,
    category: "weapon",
    kind: "standard",
    effect: "damage",
    target: "enemy",
    description: [attack.tipo, attack.dano, attack.desc].filter(Boolean).join(" · "),
    pmCost: 0,
    rangeM: parseRangeM(`${attack.tipo || ""} ${attack.desc || ""}`, ranged ? 9 : 1.5),
    attackSkill: ranged ? "pontaria" : "luta",
    attackBonus: numberBonus(attack.bonus),
    damage: formulas[0] || "1d6",
    extraDamage: formulas[1],
    repeats: attackRepeats(attack.nome),
    crit: crit.margin,
    critMultiplier: crit.multiplier,
    color: /fogo|ácido|acido|eletric|trevas|tormenta/i.test(`${attack.dano} ${attack.desc}`) ? "blood" : "steel",
  };
}

function actionForAbility(threat: CanonicalThreat, ability: NonNullable<CanonicalThreat["habilidades"]>[number], index: number): GameAction | null {
  const text = `${ability.nome}. ${ability.tipo || ""}. ${ability.desc || ""}`;
  const formulas = formulasIn(text);
  const active = /padr[aã]o|movimento|completa|livre|reação|reacao|gasta|\bPM\b/i.test(text);
  if (!active && !formulas.length) return null;
  const healing = /cura|recupera|regenera|pv tempor/i.test(text) && !/dano/i.test(text);
  const inferred = inferActionFields(text);
  const self = /pessoal|si mesmo|em si/i.test(text);
  return {
    id: `threat:${threat.id}:ability:${index}`,
    source: "threat",
    sourceId: threat.id,
    name: ability.nome,
    category: /magia|mágica|magica/i.test(text) ? "spell" : "power",
    kind: actionKindFromExecution(ability.tipo),
    effect: healing ? "heal" : formulas.length ? "damage" : "text",
    target: self ? "self" : inferred.areaM ? "area" : healing ? "ally" : "enemy",
    description: ability.desc || ability.tipo || "Habilidade de ameaça.",
    pmCost: Number(text.match(/(?:gasta|custo)\s*(\d+)\s*PM/i)?.[1]) || 0,
    rangeM: parseRangeM(text, self ? 0 : 9),
    damage: healing ? undefined : formulas[0],
    healing: healing ? formulas[0] || "1d8" : undefined,
    ...inferred,
    color: /fogo|chama|lava/i.test(text) ? "fire" : healing ? "gold" : /tormenta|trevas|sangue/i.test(text) ? "blood" : "arcane",
  };
}

/** Nomes de magia já normalizados (sem acento, minúsculos), calculados uma vez: antes eram refeitos para cada ameaça × cada magia no carregamento. */
let spellNameIndex: Array<{ spell: (typeof spellCatalog)[number]; key: string }> | undefined;
function spellNames() {
  spellNameIndex ??= spellCatalog.filter((spell) => spell.nome.length >= 4).map((spell) => ({ spell, key: normalizeRuleText(spell.nome) }));
  return spellNameIndex;
}

function mentionedSpellActions(threat: CanonicalThreat): GameAction[] {
  const source = JSON.stringify(threat);
  const normalized = normalizeRuleText(source);
  return spellNames()
    .filter(({ key }) => normalized.includes(key))
    .map(({ spell }) => spell)
    .filter((spell, index, list) => list.findIndex((entry) => entry.id === spell.id) === index)
    .slice(0, 30)
    .map((spell): GameAction => {
      const text = `${spell.nome}. ${spell.execucao || ""}. ${spell.alcance || ""}. ${spell.alvo || ""}. ${spell.resistencia || ""}. ${spell.descricao || ""}`;
      const formulas = formulasIn(text);
      const healing = /cura|recupera|restaura/i.test(text) && !/dano/i.test((spell.descricao || "").split(".")[0]);
      const inferred = inferActionFields(text);
      const self = /pessoal/i.test(spell.alcance || "");
      return {
        id: `threat:${threat.id}:spell:${spell.id}`,
        source: "threat", sourceId: threat.id, name: spell.nome, category: "spell",
        kind: actionKindFromExecution(spell.execucao), effect: healing ? "heal" : formulas.length ? "damage" : "text",
        target: self ? "self" : inferred.areaM ? "area" : healing ? "ally" : "enemy",
        description: spell.descricao || `${spell.tipo || "Magia"} · ${spell.escola || ""}`,
        pmCost: spell.custo || spellPm(spell.circulo), rangeM: parseRangeM(spell.alcance, self ? 0 : 9),
        damage: healing ? undefined : formulas[0], healing: healing ? formulas[0] || "1d8" : undefined,
        ...inferred, color: /fogo|chama/i.test(text) ? "fire" : healing ? "gold" : "arcane",
      };
    });
}

function parseLoot(text?: string): string[] {
  if (!text || /^(nenhum|metade|padr[aã]o|—|-)$/i.test(text.trim())) return text && !/nenhum|—|-/.test(text) ? [text] : [];
  return text.split(/[,;]|\s+e\s+/i).map((part) => part.trim()).filter(Boolean);
}

/** Perícias treinadas da ameaça por nome minúsculo ("furtividade" → 5). */
function skillBonusesOf(list?: Array<{ nome: string; valor?: string }>): Record<string, number> | undefined {
  if (!Array.isArray(list) || !list.length) return undefined;
  const pairs = list.filter((entry) => entry && typeof entry.nome === "string").map((entry) => [entry.nome.toLocaleLowerCase("pt-BR"), numberBonus(entry.valor)] as const);
  return pairs.length ? Object.fromEntries(pairs) : undefined;
}

export function threatToTemplate(threat: CanonicalThreat): ThreatTemplate {
  const attacks = splitCombinedAttacks(threat.ataques || []).map((attack, index) => actionForAttack(threat, attack, index));
  const abilities = (threat.habilidades || []).map((ability, index) => chargeComboAction(threat, ability, index, attacks) ?? actionForAbility(threat, ability, index)).filter((action): action is GameAction => Boolean(action));
  // Ataques e habilidades são baratos; a busca de magias citadas no texto (varre o catálogo inteiro) só roda quando alguém pede as ações.
  const actions: GameAction[] = [...attacks, ...abilities];
  if (!actions.some((action) => action.category === "weapon")) {
    actions.unshift({ id: `threat:${threat.id}:fallback`, name: "Ataque natural", category: "weapon", kind: "standard", effect: "damage", target: "enemy", description: `Ataque básico de ${threat.nome}.`, pmCost: 0, rangeM: 1.5, attackSkill: "luta", attackBonus: Math.max(0, numberBonus(threat.iniciativa)), damage: "1d6", crit: 20, critMultiplier: 2, color: "steel", source: "threat", sourceId: threat.id });
  }
  const primary = actions.find((action) => action.category === "weapon")!;
  const ranged = primary.attackSkill === "pontaria";
  const movement = Number(threat.deslocamento?.match(/\d+/)?.[0]) || 9;
  // Investidas da própria criatura (Bote, Rasante...) alcançam o dobro do deslocamento dela, mais o alcance do golpe.
  for (let i = 0; i < actions.length; i += 1) if (actions[i].charge) actions[i] = { ...actions[i], rangeM: movement * 2 + 1.5 };
  const fly = Number(threat.deslocamento?.match(/voo\s*(\d+)/i)?.[1]) || undefined;
  const burrow = Number(threat.deslocamento?.match(/escava[^\d]*(\d+)/i)?.[1]) || undefined;
  let everything: GameAction[] | undefined;
  const allActions = () => (everything ??= [...actions, ...mentionedSpellActions(threat)]);
  return {
    id: threat.id,
    name: threat.nome,
    title: `${threat.tipo || "Ameaça"} · ND ${threat.nd || "—"}`,
    symbol: threat.nome.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    // resolvedor unico em tactics/data/threatImages.ts
    portrait: threatImage({ sprite: threat.customPortrait, portrait: threat.imagem }),
    sprite: threatImage({ sprite: threat.customPortrait, portrait: threat.imagem }),
    pv: threat.pv || 1,
    pm: threat.pm || 0,
    defense: threat.defesa || 10,
    initiative: numberBonus(threat.iniciativa),
    luta: ranged ? 0 : primary.attackBonus || numberBonus(threat.iniciativa),
    pontaria: ranged ? primary.attackBonus || numberBonus(threat.iniciativa) : 0,
    damage: primary.damage || "1d6",
    crit: primary.crit || 20,
    critMultiplier: primary.critMultiplier || 2,
    attackType: ranged ? "ranged" : "melee",
    rangeM: primary.rangeM,
    movementM: movement,
    flyM: fly,
    burrowM: burrow,
    level: Math.max(1, Math.round((threat.pv || 10) / 12)),
    get spellDC() { return Math.max(10, ...allActions().map((action) => action.saveDC || 0)); },
    actions: [],
    get customActions() { return allActions(); },
    actionCount: actions.length,
    loot: parseLoot(threat.tesouro),
    treasure: threat.tesouro || undefined,
    fortitude: numberBonus(threat.fort),
    reflexes: numberBonus(threat.ref),
    will: numberBonus(threat.von),
    attrs: threat.atributos,
    skillBonuses: skillBonusesOf(threat.pericias),
    size: parseSize(threat.tipo),
    abilities: (Array.isArray(threat.habilidades) ? threat.habilidades : []).filter((ability) => ability && ability.nome).map((ability) => ({ name: ability.nome, type: ability.tipo, description: ability.desc })),
    custom: Boolean(threat.custom),
    hidden: Boolean(threat.hidden),
  };
}

/** Bestiário principal (620) + ameaças das campanhas Duelo de Dragões, Guerra Artoniana e Breves Jornadas (244). */
let officialThreats: ThreatTemplate[] | undefined;
/** Montado na primeira vez que alguém pede o bestiário (antes rodava no carregamento da Mesa e travava o celular por segundos). */
export function getOfficialThreats(): ThreatTemplate[] {
  officialThreats ??= [...(threatsJson as unknown as CanonicalThreat[]), ...(campaignThreatsJson as unknown as CanonicalThreat[])].map(threatToTemplate);
  return officialThreats;
}

export function actionsForThreat(threat: ThreatTemplate | CanonicalThreat): GameAction[] {
  if ("name" in threat && "customActions" in threat) return threat.customActions || [];
  return threatToTemplate(threat as CanonicalThreat).customActions || [];
}

export function parseThreatSave(value: string): SaveType | undefined {
  return parseSave(value);
}
