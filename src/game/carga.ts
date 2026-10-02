import type { CharacterSheet, EquipmentItem } from "../../ficha-modernrpg/sheet";
import { load } from "../../ficha-modernrpg/t20/sheetRules";

/**
 * Carga e itens em uso (Tormenta 20, livro básico, capítulo de Equipamento, texto passado pelo usuário em 02/10/2026):
 * - o limite de carga é o da ficha (`load`); passar dele deixa o personagem sobrecarregado: deslocamento −3 m (e penalidade de armadura −5);
 * - ninguém carrega mais do que o dobro do limite;
 * - empunhar: no máximo 2 itens (um em cada mão); vestir: no máximo 4 itens com benefício mecânico.
 * Convenção nossa (o livro não lista as categorias): armas e escudos contam como empunhados; os demais itens marcados, como vestidos.
 */
export const OVERLOAD_SPEED_PENALTY_M = 3;
export const MAX_HANDS = 2;
export const MAX_WORN = 4;

export interface Carga {
  used: number;
  max: number;
  overloaded: boolean;
  /** passou do dobro do limite: o personagem não consegue carregar tanto */
  impossible: boolean;
  speedPenaltyM: number;
}

export function cargaOf(sheet: Pick<CharacterSheet, "equipment" | "attributes">): Carga {
  const { used, max } = load(sheet as CharacterSheet);
  const overloaded = used > max;
  return { used, max, overloaded, impossible: used > max * 2, speedPenaltyM: overloaded ? OVERLOAD_SPEED_PENALTY_M : 0 };
}

export const isHandItem = (item: Pick<EquipmentItem, "category">) => item.category === "Arma" || item.category === "Escudo";

export function equippedCounts(equipment: readonly EquipmentItem[]): { hands: number; worn: number } {
  const equipped = equipment.filter((item) => item.equipped);
  const hands = equipped.filter(isHandItem).length;
  return { hands, worn: equipped.length - hands };
}

/** Marca ou desmarca um item como em uso. Recusa passar de 2 empunhados ou de 4 vestidos. */
export function toggleEquipped(sheet: CharacterSheet, itemId: string): { sheet: CharacterSheet; error?: string } {
  const item = sheet.equipment.find((entry) => entry.id === itemId);
  if (!item) return { sheet, error: "Item não encontrado na mochila." };
  if (!item.equipped) {
    const { hands, worn } = equippedCounts(sheet.equipment);
    if (isHandItem(item) && hands >= MAX_HANDS) return { sheet, error: `Só dá para empunhar ${MAX_HANDS} itens (um em cada mão). Guarde um antes.` };
    if (!isHandItem(item) && worn >= MAX_WORN) return { sheet, error: `Só dá para vestir ${MAX_WORN} itens com benefício ao mesmo tempo. Tire um antes.` };
  }
  return { sheet: { ...sheet, equipment: sheet.equipment.map((entry) => entry.id === itemId ? { ...entry, equipped: !entry.equipped } : entry) } };
}
