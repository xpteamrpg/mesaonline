import { T20_EQUIPMENT, norm, type T20Item } from "../t20/compendium";

/**
 * Entende uma linha de inventário escrita pelo jogador: "2x Cimitarra Maciça", "Espada longa certeira", "Armadura completa (Reforçada)".
 * Separa a quantidade, o item do catálogo e as melhorias (categoria "Modificação" do catálogo); o que sobrar vira `leftover`
 * (para o jogador ver que o leitor não entendeu aquela palavra, em vez de sumir).
 */
export interface ParsedItemLine {
  quantity: number;
  base?: T20Item;
  modifications: T20Item[];
  leftover: string;
}

/** Radical da palavra: tolera gênero e número ("Maciça" = "maciço", "Certeiras" = "certeira"). */
const stem = (word: string) => norm(word).replace(/[^a-z0-9]/g, "").replace(/(?:as|os|es|a|o|e|s)$/, "");
const words = (text: string) => norm(text).split(/[^a-z0-9]+/).filter(Boolean);

const MODIFICATIONS = T20_EQUIPMENT.filter((item) => item.categoria === "Modificação" && item.subtipo === "Melhoria")
  .map((item) => ({ item, stems: words(item.nome.replace(/\(.*?\)/g, " ")).map(stem).filter(Boolean) }))
  .filter((entry) => entry.stems.length);
const BASES = T20_EQUIPMENT.filter((item) => item.categoria !== "Modificação" && item.categoria !== "Serviço")
  .map((item) => ({ item, stems: words(item.nome.replace(/\(.*?\)/g, " ")).map(stem).filter(Boolean) }))
  .filter((entry) => entry.stems.length);

function findSequence(haystack: string[], needle: string[], used: boolean[]): number {
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    if (needle.every((word, k) => haystack[i + k] === word && !used[i + k])) return i;
  }
  return -1;
}

export function parseItemLine(raw: string): ParsedItemLine {
  let text = String(raw ?? "").replace(/\.$/, "").trim();
  let quantity = 1;
  const lead = text.match(/^(\d+)\s*(?:x|×|un\.?|unid\.?)\s*/i) ?? text.match(/^(\d+)\s+(?=[A-Za-zÀ-ÿ])/);
  const tail = text.match(/\s*[x×]\s*(\d+)\s*$/i) ?? text.match(/\s*\(\s*[x×]?\s*(\d+)\s*\)\s*$/i);
  if (lead) { quantity = Number(lead[1]); text = text.slice(lead[0].length); }
  else if (tail) { quantity = Number(tail[1]); text = text.slice(0, tail.index); }
  quantity = Math.max(1, Math.min(999, quantity));

  const tokens = words(text).map(stem).filter(Boolean);
  const used = tokens.map(() => false);
  const markUsed = (start: number, length: number) => { for (let k = 0; k < length; k += 1) used[start + k] = true; };

  // Item-base: o do catálogo cujo nome inteiro aparece na linha (o mais comprido vence; Arma/Armadura/Escudo antes dos demais em empate).
  const priority = (item: T20Item) => (item.categoria === "Arma" || item.categoria === "Armadura" || item.categoria === "Escudo" ? 1 : 0);
  let base: T20Item | undefined;
  let baseAt = -1;
  let baseLength = 0;
  for (const entry of BASES) {
    const at = findSequence(tokens, entry.stems, used);
    if (at < 0) continue;
    if (entry.stems.length > baseLength || (entry.stems.length === baseLength && base && priority(entry.item) > priority(base))) {
      base = entry.item; baseAt = at; baseLength = entry.stems.length;
    }
  }
  if (base) markUsed(baseAt, baseLength);

  const modifications: T20Item[] = [];
  for (const entry of [...MODIFICATIONS].sort((a, b) => b.stems.length - a.stems.length)) {
    const at = findSequence(tokens, entry.stems, used);
    if (at < 0) continue;
    modifications.push(entry.item);
    markUsed(at, entry.stems.length);
  }

  const original = text.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean);
  const leftover = tokens.length === original.length ? original.filter((_, i) => !used[i]).filter((w) => !/^(de|da|do|e|com)$/i.test(w)).join(" ") : "";
  return { quantity, base, modifications, leftover };
}
