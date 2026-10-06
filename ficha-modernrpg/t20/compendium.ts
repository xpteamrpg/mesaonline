/**
 * Compêndio de Tormenta 20 — fonte única de dados.
 *
 * Os JSON em ./vtt foram normalizados a partir do repositório
 * DaniloXPTEAM/VTTArmadaarena (Jogo Básico + Heróis de Arton, Ameaças de
 * Arton, Deuses de Arton, Jornadas, Atlas, Dragão Brasil e Ruff Ghanor).
 */
import magiasRaw from "./vtt/magias.json";
import poderesRaw from "./vtt/poderes.json";
import classesRaw from "./vtt/classes.json";
import distincoesRaw from "./vtt/distincoes.json";
import origensRaw from "./vtt/origens.json";
import itensRaw from "./vtt/itens.json";
import racasRaw from "./vtt/racas.json";
import racasDragoBrasilRaw from "./vtt/racas_dragaobrasil.json";
import ameacasRaw from "./vtt/ameacas.json";
import ameacasCampanhasRaw from "./vtt/ameacas_campanhas.json";

export type AttrKey = "for" | "des" | "con" | "int" | "sab" | "car";
export const ATTR_KEYS: AttrKey[] = ["for", "des", "con", "int", "sab", "car"];
export const ATTR_NAMES: Record<AttrKey, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

export const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/* ---------------------------------- Perícias --------------------------------- */

export interface T20Skill {
  id: string;
  nome: string;
  atributo: AttrKey;
  somenteTreinado: boolean;
  penalidadeArmadura: boolean;
}

export const T20_SKILLS: T20Skill[] = [
  { id: "acr", nome: "Acrobacia", atributo: "des", somenteTreinado: false, penalidadeArmadura: true },
  { id: "ade", nome: "Adestramento", atributo: "car", somenteTreinado: true, penalidadeArmadura: false },
  { id: "atl", nome: "Atletismo", atributo: "for", somenteTreinado: false, penalidadeArmadura: false },
  { id: "atu", nome: "Atuação", atributo: "car", somenteTreinado: true, penalidadeArmadura: false }, // livro p.116: "Car • Treinada"
  { id: "cav", nome: "Cavalgar", atributo: "des", somenteTreinado: false, penalidadeArmadura: false },
  { id: "con", nome: "Conhecimento", atributo: "int", somenteTreinado: true, penalidadeArmadura: false },
  { id: "cur", nome: "Cura", atributo: "sab", somenteTreinado: false, penalidadeArmadura: false },
  { id: "dip", nome: "Diplomacia", atributo: "car", somenteTreinado: false, penalidadeArmadura: false },
  { id: "eng", nome: "Enganação", atributo: "car", somenteTreinado: false, penalidadeArmadura: false },
  { id: "for", nome: "Fortitude", atributo: "con", somenteTreinado: false, penalidadeArmadura: false },
  { id: "fur", nome: "Furtividade", atributo: "des", somenteTreinado: false, penalidadeArmadura: true },
  { id: "gue", nome: "Guerra", atributo: "int", somenteTreinado: true, penalidadeArmadura: false },
  { id: "ini", nome: "Iniciativa", atributo: "des", somenteTreinado: false, penalidadeArmadura: false },
  { id: "int", nome: "Intimidação", atributo: "car", somenteTreinado: false, penalidadeArmadura: false },
  { id: "intu", nome: "Intuição", atributo: "sab", somenteTreinado: false, penalidadeArmadura: false },
  { id: "inv", nome: "Investigação", atributo: "int", somenteTreinado: false, penalidadeArmadura: false },
  { id: "jog", nome: "Jogatina", atributo: "car", somenteTreinado: true, penalidadeArmadura: false },
  { id: "lad", nome: "Ladinagem", atributo: "des", somenteTreinado: true, penalidadeArmadura: true },
  { id: "lut", nome: "Luta", atributo: "for", somenteTreinado: false, penalidadeArmadura: false },
  { id: "mis", nome: "Misticismo", atributo: "int", somenteTreinado: true, penalidadeArmadura: false },
  { id: "nob", nome: "Nobreza", atributo: "int", somenteTreinado: true, penalidadeArmadura: false },
  { id: "ofi", nome: "Ofício", atributo: "int", somenteTreinado: true, penalidadeArmadura: false },
  { id: "per", nome: "Percepção", atributo: "sab", somenteTreinado: false, penalidadeArmadura: false },
  { id: "pil", nome: "Pilotagem", atributo: "des", somenteTreinado: true, penalidadeArmadura: false },
  { id: "pon", nome: "Pontaria", atributo: "des", somenteTreinado: false, penalidadeArmadura: false },
  { id: "ref", nome: "Reflexos", atributo: "des", somenteTreinado: false, penalidadeArmadura: false },
  { id: "rel", nome: "Religião", atributo: "sab", somenteTreinado: true, penalidadeArmadura: false },
  { id: "sob", nome: "Sobrevivência", atributo: "sab", somenteTreinado: false, penalidadeArmadura: false },
  { id: "von", nome: "Vontade", atributo: "sab", somenteTreinado: false, penalidadeArmadura: false },
];
export const SKILL_BY_ID = new Map(T20_SKILLS.map((s) => [s.id, s]));
export const skillName = (id: string) => SKILL_BY_ID.get(id)?.nome ?? id;
export const RESISTANCE_IDS = ["for", "ref", "von"] as const;
export const findSkillByName = (name: string) => {
  const n = norm(name).replace(/[^a-z]/g, "");
  return T20_SKILLS.find((s) => norm(s.nome).replace(/[^a-z]/g, "") === n) ?? T20_SKILLS.find((s) => norm(s.nome).startsWith(norm(name)));
};

/* ----------------------------------- Raças ----------------------------------- */

export interface T20Race {
  id: string;
  nome: string;
  tipo: string;
  tamanho: string;
  tipoCriatura?: string;
  atributos: Partial<Record<AttrKey, number>>;
  escolhas: { quantidade: number; valor: number; maxPorAtributo?: number; bloqueados?: AttrKey[] };
  bonusTexto: string;
  deslocamento: number;
  habilidades: { nome: string; descricao: string }[];
  imagem?: string;
  fonte: string;
  /** rótulo da escolha de variante (ex.: "Chassi", "Herança animal") */
  varianteRotulo?: string;
  variantes?: T20RaceVariant[];
  escolhasExtras?: RaceChoice[];
  /** se verdadeiro, é preciso escolher uma variante (ex.: Golem, Moreau, Suraggel); senão a raça base já é jogável */
  varianteObrigatoria?: boolean;
}

/** Escolha feita na criação por causa de uma habilidade da raça ou da variante (perícias, opção de uma lista ou atributo sorteado). */
export interface RaceChoice {
  id: string;
  rotulo: string;
  tipo: "pericias" | "opcao" | "atributo-aleatorio";
  /** quantas perícias/opções escolher (padrão 1) */
  quantidade?: number;
  /** pericias: ids de perícia permitidos (padrão: todas); opcao: rótulos */
  opcoes?: string[];
  /** pericias: bônus numérico aplicado em "outros" de cada perícia escolhida (pode ser negativo) */
  bonus?: number;
  /** pericias: as escolhidas ficam treinadas */
  treinada?: boolean;
  /** vale escolher menos que a quantidade ("até N") */
  ateQuantidade?: boolean;
  /** descrição de cada opção (rótulo → texto), mostrada na escolha e gravada na ficha */
  descricoes?: Record<string, string>;
  /** opção → atributo que recebe +1 ao ser escolhida (ex.: bênção "Duro Como Pedra" → Constituição) */
  atributos?: Record<string, AttrKey>;
  /** só aparece quando outra escolha tem o valor indicado */
  dependeDe?: { id: string; valor: string };
}

/** Variante de uma raça (chassi do Golem, herança do Moreau...): soma atributos e habilidades à raça base. */
export interface T20RaceVariant {
  id: string;
  nome: string;
  atributos?: Partial<Record<AttrKey, number>>;
  escolhas?: T20Race["escolhas"];
  bonusTexto?: string;
  deslocamento?: number;
  habilidades: { nome: string; descricao: string }[];
  imagem?: string;
  fonte?: string;
  /** os atributos da variante substituem os da base (sub-raças) em vez de somar */
  substituiAtributos?: boolean;
  /** as habilidades da variante substituem as da base em vez de somar */
  substituiHabilidades?: boolean;
  /** as escolhas da variante substituem as da base (ex.: Soterrado não tem a Memória Póstuma do Osteon) */
  substituiEscolhas?: boolean;
  escolhasExtras?: RaceChoice[];
  tamanho?: string;
  tipoCriatura?: string;
}

export function raceWithVariant(race: T20Race, variantId?: string): T20Race {
  const v = variantId ? race.variantes?.find((x) => x.id === variantId) : undefined;
  if (!v) return race;
  const atributos: T20Race["atributos"] = v.substituiAtributos ? {} : { ...race.atributos };
  for (const [k, n] of Object.entries(v.atributos ?? {})) {
    const key = k as AttrKey;
    atributos[key] = (atributos[key] ?? 0) + (n ?? 0);
  }
  const escolhas = v.escolhas ?? race.escolhas;
  const partes = (Object.entries(atributos) as [AttrKey, number][]).filter(([, n]) => n).map(([k, n]) => `${ATTR_NAMES[k]} ${n > 0 ? "+" : "−"}${Math.abs(n)}`);
  if (escolhas.quantidade > 0) partes.push(`+${escolhas.valor} em ${escolhas.quantidade === 1 ? "um atributo" : `${escolhas.quantidade} atributos`} à escolha`);
  return {
    ...race,
    nome: `${race.nome} — ${v.nome}`,
    atributos,
    escolhas,
    deslocamento: v.deslocamento ?? race.deslocamento,
    escolhasExtras: v.substituiEscolhas ? v.escolhasExtras ?? [] : [...(race.escolhasExtras ?? []), ...(v.escolhasExtras ?? [])],
    tamanho: v.tamanho ?? race.tamanho,
    tipoCriatura: v.tipoCriatura ?? race.tipoCriatura,
    habilidades: v.substituiHabilidades ? v.habilidades : [...race.habilidades, ...v.habilidades],
    bonusTexto: partes.join(", "),
    imagem: v.imagem ?? race.imagem,
    fonte: v.fonte ?? race.fonte,
  };
}
/** A escolha só aparece quando a escolha da qual depende tem o valor indicado. */
export const raceChoiceActive = (c: RaceChoice, extra: Record<string, string[]> = {}) => !c.dependeDe || (extra[c.dependeDe.id] ?? []).includes(c.dependeDe.valor);

/** Opções de uma escolha racial, com a descrição de cada uma quando existir. */
export function raceChoiceOptions(c: RaceChoice): { v: string; l: string; d?: string }[] {
  if (c.tipo === "pericias") return (c.opcoes ?? T20_SKILLS.map((s) => s.id)).map((id) => ({ v: id, l: T20_SKILLS.find((s) => s.id === id)?.nome ?? id }));
  if (c.opcoes?.[0] === "@habilidades-outra-raca") {
    const pool = T20_RACES.filter((r) => r.tipoCriatura === "Humanoide");
    const dup = new Set(pool.map((r) => r.nome).filter((n, i, all) => all.indexOf(n) !== i));
    return pool.flatMap((r) => r.habilidades.map((h) => ({ v: `${r.nome}${dup.has(r.nome) ? ` (${r.fonte.replace("Tormenta 20 — ", "")})` : ""} — ${h.nome}`, l: `${r.nome}${dup.has(r.nome) ? ` (${r.fonte.replace("Tormenta 20 — ", "")})` : ""} — ${h.nome}`, d: h.descricao })));
  }
  return (c.opcoes ?? []).map((o) => ({ v: o, l: o, d: c.descricoes?.[o] }));
}

/** Efeitos das escolhas raciais: perícias treinadas, bônus em perícias, atributos sorteados e anotações para a ficha. */
export function raceChoiceEffects(race: T20Race, extra: Record<string, string[]> = {}) {
  const trained: string[] = [];
  const bonuses: Record<string, number> = {};
  const attrs: AttrKey[] = [];
  const notes: { name: string; description: string }[] = [];
  for (const c of race.escolhasExtras ?? []) {
    const picked = extra[c.id] ?? [];
    if (!picked.length || !raceChoiceActive(c, extra)) continue;
    if (c.tipo === "pericias") {
      for (const id of picked) {
        if (c.treinada) trained.push(id);
        if (c.bonus) bonuses[id] = (bonuses[id] ?? 0) + c.bonus;
      }
      const names = picked.map((id) => T20_SKILLS.find((s) => s.id === id)?.nome ?? id).join(", ");
      notes.push({ name: c.rotulo, description: `Perícias escolhidas: ${names}${c.bonus ? ` (${c.bonus > 0 ? "+" : "−"}${Math.abs(c.bonus)})` : ""}${c.treinada ? " — treinadas" : ""}.` });
    } else if (c.tipo === "opcao") {
      const opts = raceChoiceOptions(c);
      const partes = picked.map((v) => { const o = opts.find((x) => x.v === v); return o?.d ? `${o.l}: ${o.d}` : o?.l ?? v; });
      for (const v of picked) { const a = c.atributos?.[v]; if (a) attrs.push(a); }
      notes.push({ name: c.rotulo, description: `Escolhido: ${partes.join(" • ")}` });
    } else {
      attrs.push(picked[0] as AttrKey);
      notes.push({ name: c.rotulo, description: `Atributo sorteado: ${ATTR_NAMES[picked[0] as AttrKey]} (+1).` });
    }
  }
  return { trained, bonuses, attrs, notes };
}

/** As escolhas raciais obrigatórias (ativas) foram todas feitas? */
export function raceChoicesDone(race: T20Race, extra: Record<string, string[]> = {}) {
  return (race.escolhasExtras ?? []).filter((c) => raceChoiceActive(c, extra)).every((c) => {
    const n = (extra[c.id] ?? []).length;
    const q = c.tipo === "atributo-aleatorio" ? 1 : c.quantidade ?? 1;
    return c.ateQuantidade ? n <= q : n === q;
  });
}

export const T20_RACES: T20Race[] = [...(racasRaw as T20Race[]), ...(racasDragoBrasilRaw as T20Race[])].map((r) => ({ ...r }));
export const RACE_BY_ID = new Map(T20_RACES.map((r) => [r.id, r]));
export const findRaceByName = (name: string) => {
  const n = norm(name);
  return (
    T20_RACES.find((r) => norm(r.nome) === n) ??
    T20_RACES.find((r) => norm(r.nome).split(/[\/ ]/)[0] === n.split(/[\/ ]/)[0]) ??
    T20_RACES.find((r) => n.includes(norm(r.nome)) || norm(r.nome).includes(n))
  );
};
export const RACE_SOURCES = [...new Set(T20_RACES.map((r) => r.fonte))];

/* ---------------------------------- Classes ---------------------------------- */

export interface T20ClassAbility {
  nivel: number;
  nome: string;
  descricao: string;
}
export interface T20ClassVariant {
  id: string;
  nome: string;
  fonte: string;
  url?: string;
  flavor?: string;
  pvInicial?: number;
  pvPorNivel?: number;
  pm?: number;
  skills?: string;
  proficiencias?: string;
}
export interface T20Class {
  id: string;
  nome: string;
  fonte: string;
  descricao: string;
  atributoTexto: string;
  atributoChave?: AttrKey;
  pvInicial: number;
  pvPorNivel: number;
  pmInicial: number;
  pmPorNivel: number;
  pericias: { fixas: string[]; escolha: string[][]; extras: number; pool: string[] };
  periciasTexto: string;
  proficiencias: string;
  caminhos: string[];
  habilidades: T20ClassAbility[];
  habilidadesCaminho: Record<string, T20ClassAbility[]>;
  variantes: T20ClassVariant[];
}
export const T20_CLASSES: T20Class[] = classesRaw as unknown as T20Class[];
export const CLASS_BY_ID = new Map(T20_CLASSES.map((c) => [c.id, c]));
export const findClassByName = (name: string) => {
  const n = norm(name);
  return T20_CLASSES.find((c) => norm(c.nome) === n) ?? T20_CLASSES.find((c) => n.includes(norm(c.nome)) || norm(c.nome).includes(n.split(/[\s(]/)[0]));
};
export const pathLabel = (id: string) => {
  const map: Record<string, string> = { machadodepedra: "Machado de Pedra", magimarcialista: "Magimarcialista", melhoramigo: "Melhor Amigo", ermitao: "Ermitão", burgues: "Burguês" };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
};

/* ---------------------------------- Poderes ---------------------------------- */

export interface T20Power {
  id: string;
  nome: string;
  /** Combate · Destino · Magia · Tormenta · Concedido · Racial · Grupo · Complicação · Classe */
  categoria: string;
  /** deus, raça, classe ou "Geral" */
  subtipo: string;
  classe?: string;
  caminho?: string;
  /** habilidade automática de classe por nível (não é escolha) */
  habilidade?: boolean;
  nivel?: number;
  requisito: string;
  descricao: string;
  fonte: string;
}
export const T20_POWERS: T20Power[] = poderesRaw as T20Power[];
export const POWER_BY_ID = new Map(T20_POWERS.map((p) => [p.id, p]));
/**
 * Variações de um nome de poder escrito do jeito da pessoa: sem parênteses, sem "Poder:"/"Poderes de Arcanista:" na frente,
 * sem bônus no fim ("+1 sab"), e as partes de "Caminho do Arcanista: Mago" (a última, depois a primeira).
 */
export const powerNameVariants = (name: string): string[] => {
  const noParens = name.replace(/\(.*?\)/g, " ");
  const noBonus = noParens.replace(/\s*[+-]\s*\d+.*$/, "");
  const parts = noBonus.split(":").map((part) => part.trim()).filter(Boolean);
  return [name, noParens, noBonus, ...(parts.length > 1 ? [parts[parts.length - 1], parts[0]] : [])]
    .map((variant) => norm(variant))
    .filter((variant, index, all) => variant && all.indexOf(variant) === index);
};
export const findPowerByName = (name: string, classId?: string) => {
  for (const n of powerNameVariants(name)) {
    const found = (classId ? T20_POWERS.find((p) => norm(p.nome) === n && p.classe === classId) : undefined) ?? T20_POWERS.find((p) => norm(p.nome) === n && !p.habilidade) ?? T20_POWERS.find((p) => norm(p.nome) === n);
    if (found) return found;
  }
  return undefined;
};
/** Só os poderes escolhíveis (exclui habilidades automáticas de classe). */
export const SELECTABLE_POWERS = T20_POWERS.filter((p) => !p.habilidade);

export const POWER_CATEGORIES = [
  { id: "", label: "Todos" },
  { id: "Combate", label: "Combate" },
  { id: "Destino", label: "Destino" },
  { id: "Magia", label: "Magia" },
  { id: "Tormenta", label: "Tormenta" },
  { id: "Concedido", label: "Concedidos" },
  { id: "Classe", label: "De Classe" },
  { id: "Racial", label: "Raciais" },
  { id: "Grupo", label: "De Grupo" },
  { id: "Complicação", label: "Complicações" },
];
export const powerMatchesCategory = (p: T20Power, cat: string) => !cat || p.categoria === cat;
export const powersForClass = (classId: string, path?: string) =>
  SELECTABLE_POWERS.filter((p) => p.classe === classId && (!p.caminho || !path || p.caminho === path));
export const powersForRace = (raceName: string) => {
  const n = norm(raceName).split(/[\/ (]/)[0];
  return SELECTABLE_POWERS.filter((p) => p.categoria === "Racial" && norm(p.subtipo).includes(n));
};
export const powersForDeity = (deityName: string) => SELECTABLE_POWERS.filter((p) => p.categoria === "Concedido" && norm(p.subtipo).includes(norm(deityName)));

/* -------------------------------- Distinções --------------------------------- */

export interface T20Distinction {
  id: string;
  nome: string;
  fonte: string;
  exclusiva: boolean;
  admissao: string;
  marca?: { nome: string; descricao: string };
  detalhes?: { titulo: string; conteudo: string };
  poderes: { nome: string; requisito: string; descricao: string }[];
}
export const T20_DISTINCTIONS: T20Distinction[] = distincoesRaw as T20Distinction[];
export const DISTINCTION_BY_ID = new Map(T20_DISTINCTIONS.map((d) => [d.id, d]));

/* ----------------------------------- Magias ---------------------------------- */

export interface T20Spell {
  id: string;
  nome: string;
  circulo: number;
  tipo: string;
  escola: string;
  execucao: string;
  alcance: string;
  alvo: string;
  duracao: string;
  resistencia: string;
  custo: number;
  descricao: string;
  aprimoramentos: { custo: number; desc: string }[];
}
export const T20_SPELLS: T20Spell[] = magiasRaw as T20Spell[];
export const SPELL_BY_ID = new Map(T20_SPELLS.map((s) => [s.id, s]));
export const SPELL_SCHOOLS = [...new Set(T20_SPELLS.map((s) => s.escola).filter(Boolean))].sort();
export const findSpellByName = (name: string) => T20_SPELLS.find((s) => norm(s.nome) === norm(name));

/* -------------------------------- Equipamento -------------------------------- */

export type ItemCategory = "Arma" | "Armadura" | "Escudo" | "Munição" | "Item Geral" | "Ferramenta" | "Vestuário" | "Consumível" | "Montaria" | "Serviço" | "Item Mágico" | "Encanto" | "Maldição" | "Modificação";

export interface T20Item {
  id: string;
  nome: string;
  categoria: ItemCategory;
  subtipo?: string;
  preco: number | null;
  precoTexto?: string;
  slots: number;
  dano?: string;
  critico?: string;
  danoTipo?: string;
  alcance?: string;
  proficiencia?: string;
  empunhadura?: string;
  combate?: "corpo" | "distancia";
  arremesso?: boolean;
  danoAtributo?: AttrKey;
  defesa?: number;
  penalidade?: number;
  tipoArmadura?: string;
  descricao: string;
}
export const T20_EQUIPMENT: T20Item[] = itensRaw as T20Item[];

const HEAVY_ARMOR_NAMES = new Set((itensRaw as { nome: string; categoria: string; tipoArmadura?: string }[])
  .filter((item) => item.categoria === "Armadura" && item.tipoArmadura === "Armadura Pesada")
    .map((item) => norm(item.nome)));
/** O item é uma armadura pesada do catálogo (campo `tipoArmadura`)? */
export const isHeavyArmorName = (name: string) => HEAVY_ARMOR_NAMES.has(norm(name));
export const ITEM_BY_ID = new Map(T20_EQUIPMENT.map((i) => [i.id, i]));
export const ITEM_CATEGORIES: ItemCategory[] = ["Arma", "Armadura", "Escudo", "Munição", "Item Geral", "Ferramenta", "Vestuário", "Consumível", "Montaria", "Serviço", "Item Mágico", "Encanto", "Maldição", "Modificação"];
export const findItemByName = (name: string) => {
  const n = norm(name);
  return (
    T20_EQUIPMENT.find((i) => norm(i.nome) === n) ??
    T20_EQUIPMENT.find((i) => norm(i.nome) === n + " (20)") ??
    T20_EQUIPMENT.find((i) => norm(i.nome).startsWith(n) && i.categoria !== "Item Mágico") ??
    T20_EQUIPMENT.find((i) => norm(i.nome).includes(n) && i.categoria !== "Item Mágico")
  );
};

/* ---------------------------------- Origens ---------------------------------- */

export interface T20OriginBenefit {
  tipo: string; // skill | power | ...
  nome: string;
  descricao: string;
  skillId?: string;
}
export interface T20Origin {
  id: string;
  nome: string;
  tipo: string; // normal | atlas
  fonte: string;
  regiao?: string;
  descricao: string;
  itens: string;
  escolhas: number;
  beneficios: T20OriginBenefit[];
  treinoAutomatico?: unknown;
  beneficioUnico?: { nome: string; descricao: string };
}
export const T20_ORIGINS: T20Origin[] = origensRaw as T20Origin[];
export const ORIGIN_BY_ID = new Map(T20_ORIGINS.map((o) => [o.id, o]));
export const findOriginByName = (name: string) => T20_ORIGINS.find((o) => norm(o.nome) === norm(name));

/* -------------------------------- Divindades --------------------------------- */

export interface T20Deity {
  id: string;
  nome: string;
  epiteto: string;
  energia: "Positiva" | "Negativa" | "Qualquer";
  arma: string;
  devotos: string;
  obrigacoes: string[];
  poderesConcedidos: T20Power[];
}
const DEITY_BASE: Omit<T20Deity, "poderesConcedidos">[] = [
  { id: "aharadak", nome: "Aharadak", epiteto: "A Tormenta", energia: "Negativa", arma: "Nenhuma", devotos: "Lefeu, cultistas", obrigacoes: ["Espalhar a Tormenta", "Nunca ajudar quem a combate"] },
  { id: "allihanna", nome: "Allihanna", epiteto: "A Deusa da Natureza", energia: "Positiva", arma: "Bordão", devotos: "Druidas, dahllan, caçadores", obrigacoes: ["Respeitar a natureza", "Não usar armaduras de metal"] },
  { id: "arsenal", nome: "Arsenal", epiteto: "O Deus da Guerra", energia: "Qualquer", arma: "Machado de batalha", devotos: "Guerreiros, mercenários, minotauros", obrigacoes: ["Nunca recuar de um combate justo", "Honrar oponentes dignos"] },
  { id: "azgher", nome: "Azgher", epiteto: "O Deus do Sol", energia: "Positiva", arma: "Cimitarra", devotos: "Paladinos, povos do deserto", obrigacoes: ["Nunca mentir sob a luz do sol", "Destruir mortos-vivos"] },
  { id: "hyninn", nome: "Hyninn", epiteto: "O Deus da Trapaça", energia: "Qualquer", arma: "Adaga", devotos: "Ladinos, hynne, bardos", obrigacoes: ["Nunca recusar um bom golpe"] },
  { id: "kallyadranoch", nome: "Kallyadranoch", epiteto: "O Deus dos Dragões", energia: "Negativa", arma: "Lança", devotos: "Dragões, trogs, tiranos", obrigacoes: ["Acumular tesouro", "Jamais servir a um não-dragão"] },
  { id: "khalmyr", nome: "Khalmyr", epiteto: "O Deus da Justiça", energia: "Positiva", arma: "Espada longa", devotos: "Paladinos, juízes, cavaleiros", obrigacoes: ["Nunca mentir", "Punir criminosos e proteger inocentes"] },
  { id: "lena", nome: "Lena", epiteto: "A Deusa da Vida", energia: "Positiva", arma: "Bordão", devotos: "Curandeiros, parteiras", obrigacoes: ["Nunca recusar cura a um inocente", "Jamais matar sem necessidade"] },
  { id: "lin-wu", nome: "Lin-Wu", epiteto: "O Deus da Honra", energia: "Positiva", arma: "Katana", devotos: "Samurais, lutadores", obrigacoes: ["Seguir um código rígido", "Nunca atacar pelas costas"] },
  { id: "marah", nome: "Marah", epiteto: "A Deusa da Paz", energia: "Positiva", arma: "Adaga", devotos: "Diplomatas, curandeiros", obrigacoes: ["Nunca iniciar um combate", "Buscar sempre a negociação"] },
  { id: "megalokk", nome: "Megalokk", epiteto: "O Deus dos Monstros", energia: "Negativa", arma: "Machado grande", devotos: "Monstros, bárbaros, trogs", obrigacoes: ["Nunca demonstrar piedade", "Caçar sempre a maior presa"] },
  { id: "nimb", nome: "Nimb", epiteto: "O Deus do Caos", energia: "Qualquer", arma: "Adaga", devotos: "Loucos, artistas, qareen", obrigacoes: ["Nunca fazer a mesma coisa duas vezes do mesmo jeito"] },
  { id: "oceano", nome: "Oceano", epiteto: "O Deus dos Mares", energia: "Qualquer", arma: "Tridente", devotos: "Marujos, sereias, bucaneiros", obrigacoes: ["Nunca poluir as águas", "Ajudar náufragos"] },
  { id: "sszzaas", nome: "Sszzaas", epiteto: "O Deus da Traição", energia: "Negativa", arma: "Adaga", devotos: "Espiões, assassinos, medusas", obrigacoes: ["Trair alguém que confia em você"] },
  { id: "tanna-toh", nome: "Tanna-Toh", epiteto: "A Deusa do Conhecimento", energia: "Positiva", arma: "Bordão", devotos: "Acadêmicos, inventores, kliren", obrigacoes: ["Registrar tudo o que descobrir", "Nunca destruir conhecimento"] },
  { id: "tenebra", nome: "Tenebra", epiteto: "A Deusa da Escuridão", energia: "Negativa", arma: "Foice", devotos: "Osteon, necromantes, ladinos", obrigacoes: ["Proteger a noite e os mortos-vivos inteligentes"] },
  { id: "thwor", nome: "Thwor", epiteto: "O Deus dos Duyshidakk", energia: "Qualquer", arma: "Machado de batalha", devotos: "Orcs, goblinoides, bárbaros", obrigacoes: ["Fortalecer seu clã", "Nunca abandonar um irmão de guerra"] },
  { id: "thyatis", nome: "Thyatis", epiteto: "O Deus da Ressurreição", energia: "Positiva", arma: "Bordão", devotos: "Clérigos, osteon redimidos", obrigacoes: ["Nunca deixar um aliado morrer sem tentar salvá-lo"] },
  { id: "valkaria", nome: "Valkaria", epiteto: "A Deusa da Ambição", energia: "Positiva", arma: "Espada longa", devotos: "Aventureiros, humanos", obrigacoes: ["Nunca recusar um desafio", "Buscar sempre superar seus limites"] },
  { id: "wynna", nome: "Wynna", epiteto: "A Deusa da Magia", energia: "Positiva", arma: "Adaga", devotos: "Arcanistas, elfos, bardos", obrigacoes: ["Nunca recusar ensinar magia a quem deseja aprender"] },
];
export const T20_DEITIES: T20Deity[] = DEITY_BASE.map((d) => ({ ...d, poderesConcedidos: powersForDeity(d.nome) }));
export const DEITY_BY_ID = new Map(T20_DEITIES.map((d) => [d.id, d]));
export const findDeityByName = (name: string) => T20_DEITIES.find((d) => norm(d.nome) === norm(name) || norm(name).includes(norm(d.nome)));

/* ---------------------------------- Ameaças ---------------------------------- */

export interface T20Threat {
  id: string;
  nome: string;
  tipo: string;
  nd: string;
  ndOrdem: number;
  iniciativa: string;
  percepcao: string;
  sentidos: string;
  defesa: number | null;
  defesaObs: string;
  fort: string;
  ref: string;
  von: string;
  pv: number | null;
  pm: number | null;
  deslocamento: string;
  atributos: Partial<Record<AttrKey, number>>;
  ataques: { nome: string; tipo: string; bonus: string; dano: string; desc: string }[];
  habilidades: { nome: string; tipo: string; desc: string }[];
  pericias: { nome: string; valor: string }[];
  equipamento: string;
  tesouro: string;
  observacao: string;
  fonte: string;
  imagem?: string;
}
export const T20_THREATS: T20Threat[] = [...(ameacasRaw as T20Threat[]), ...(ameacasCampanhasRaw as unknown as T20Threat[])];
export const THREAT_TYPES = [...new Set(T20_THREATS.map((t) => t.tipo.split(" ")[0]))].sort();
export const THREAT_NDS = [...new Set(T20_THREATS.map((t) => t.nd))].sort((a, b) => (T20_THREATS.find((t) => t.nd === a)?.ndOrdem ?? 0) - (T20_THREATS.find((t) => t.nd === b)?.ndOrdem ?? 0));

/* ---------------------------------- Resumo ----------------------------------- */

export const COMPENDIUM_COUNTS = {
  racas: T20_RACES.length,
  classes: T20_CLASSES.length,
  distincoes: T20_DISTINCTIONS.length,
  pericias: T20_SKILLS.length,
  origens: T20_ORIGINS.length,
  divindades: T20_DEITIES.length,
  poderes: SELECTABLE_POWERS.length,
  magias: T20_SPELLS.length,
  equipamentos: T20_EQUIPMENT.length,
  ameacas: T20_THREATS.length,
};
