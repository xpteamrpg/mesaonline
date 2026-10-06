import { T20_EQUIPMENT, norm, type T20Item } from "./compendium";
import type { EquipmentItem } from "../../types/sheet";

/**
 * Melhorias de itens (itens superiores) — Tormenta20 Jogo do Ano v1.3, p.164–167.
 * O preço e a CD de fabricação dependem do NÚMERO de melhorias (valores totais, não por melhoria): Tabela 3-7.
 * Cada melhoria só pode ser aplicada uma vez ao mesmo item; só armas, armaduras/escudos, ferramentas, vestuário e esotéricos recebem melhorias.
 */
export const IMPROVEMENT_PRICE_TABLE: ReadonlyArray<{ price: number; cd: number }> = [
  { price: 0, cd: 0 },
  { price: 300, cd: 5 },
  { price: 3000, cd: 10 },
  { price: 9000, cd: 15 },
  { price: 18000, cd: 20 },
];
export const MAX_IMPROVEMENTS = 4;

export type ItemKind = "arma" | "disparo" | "armadura" | "pesada" | "escudo" | "ferramenta" | "vestuario" | "esoterico" | "municao";

/** Tipo(s) do item para decidir quais melhorias ele aceita. */
export function itemKinds(item: Pick<EquipmentItem, "name" | "category">, catalog?: T20Item): Set<ItemKind> {
  const found = catalog ?? T20_EQUIPMENT.find((entry) => norm(entry.nome) === norm(item.name));
  const kinds = new Set<ItemKind>();
  const category = item.category;
  if (category === "Arma") { kinds.add("arma"); if (found?.combate === "distancia" && !found.arremesso) kinds.add("disparo"); }
  else if (category === "Armadura") { kinds.add("armadura"); if (/pesad/i.test(found?.tipoArmadura ?? "")) kinds.add("pesada"); }
  else if (category === "Escudo") kinds.add("escudo");
  else if (category === "Ferramenta") kinds.add("ferramenta");
  else if (category === "Vestuário") kinds.add("vestuario");
  else if (category === "Munição") kinds.add("municao");
  if (/esot[eé]ric/i.test(found?.subtipo ?? "")) kinds.add("esoterico");
  return kinds;
}

const MODIFICATIONS = T20_EQUIPMENT.filter((item) => item.categoria === "Modificação" && item.subtipo === "Melhoria");

/** Alvos de uma melhoria, lidos do texto do catálogo ("Melhoria para Armas…", "Aplicável em: Armaduras/Escudos…"). */
function targetsOf(mod: T20Item): Set<ItemKind> | "todos" {
  const text = norm(mod.descricao);
  const match = text.match(/melhoria para ([^.]*?)(?: que | e |\.|$)/) ?? text.match(/aplicavel em:? ([^.]*?)(?:\.|$)/);
  const target = match?.[1] ?? "";
  if (/todos/.test(target)) return "todos";
  const out = new Set<ItemKind>();
  if (/\barmas?\b/.test(target)) { out.add("arma"); if (/disparo/.test(target)) { out.delete("arma"); out.add("disparo"); } }
  if (/\barmaduras? pesadas?\b/.test(target)) out.add("pesada");
  else if (/\barmaduras?\b/.test(target)) out.add("armadura");
  if (/escudo/.test(target)) out.add("escudo");
  if (/ferramenta/.test(target)) out.add("ferramenta");
  if (/vestuario/.test(target)) out.add("vestuario");
  if (/esoteric/.test(target)) out.add("esoterico");
  if (/municao|municoes/.test(target)) out.add("municao");
  return out;
}

/** Melhorias que o item aceita (texto do catálogo; a decisão final de casos raros é do Mestre). */
export function eligibleImprovements(item: Pick<EquipmentItem, "name" | "category">): T20Item[] {
  const kinds = itemKinds(item);
  if (!kinds.size) return [];
  return MODIFICATIONS.filter((mod) => {
    const targets = targetsOf(mod);
    return targets === "todos" || [...targets].some((kind) => kinds.has(kind));
  });
}

/** Pré-requisitos e exclusões escritos no texto ("Requer: Cruel", "Não pode ser Precisa"). */
export function improvementProblem(mod: T20Item, chosen: string[]): string | undefined {
  const has = (name: string) => chosen.some((entry) => norm(entry) === norm(name));
  const text = mod.descricao;
  const req = text.match(/(?:Requer|Pr[eé]-?requisito|Pr[eé]-req):?\s*([^.(]+)/i)?.[1]?.trim();
  if (req) {
    if (/outra melhoria/i.test(req)) { if (!chosen.length) return "exige outra melhoria"; }
    else { const names = req.split(/\s+ou\s+|,/).map((part) => part.trim()).filter(Boolean); if (names.length && !names.some(has)) return `exige ${names.join(" ou ")}`; }
  }
  const forbid = text.match(/N[aã]o pode ser ([A-Za-zÀ-ÿ]+)/i)?.[1];
  if (forbid && has(forbid)) return `não pode ser ${forbid}`;
  return undefined;
}

export const improvementCost = (count: number) => IMPROVEMENT_PRICE_TABLE[Math.max(0, Math.min(MAX_IMPROVEMENTS, count))];

/**
 * Recalcula o preço do item com as melhorias escolhidas. `freeModifications` = quantas já vieram pagas (importação): só o que passar
 * disso é cobrado. Preço = preço-base + (valor da Tabela 3-7 para o novo total − o das já pagas).
 */
export function withImprovements(item: EquipmentItem, modifications: string[]): EquipmentItem {
  const base = item.basePrice ?? item.price;
  const free = Math.min(item.freeModifications ?? 0, modifications.length);
  const extra = Math.max(0, improvementCost(modifications.length).price - improvementCost(free).price);
  return { ...item, modifications, basePrice: base, price: base === null ? null : base + extra };
}
