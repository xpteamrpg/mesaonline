import type { CharacterSheet } from "../../ficha-modernrpg/sheet";

/**
 * Descanso (Tormenta20 Jogo do Ano v1.3, p.106): com uma noite de sono (8 h) o personagem recupera PV e PM de acordo com o nível e a condição de descanso:
 * ruim = metade do nível (dormir ao relento sem saco de dormir e acampamento), normal = nível (estalagem comum), confortável = dobro, luxuosa = triplo.
 * Nunca passa do máximo. Poderes, itens e complicações da ficha mudam a categoria (lista curada abaixo, lida do texto do catálogo).
 */
export type RestCondition = "ruim" | "normal" | "confortavel" | "luxuosa";
export type RestPlace = "ermos" | "urbano";

export const REST_LABEL: Record<RestCondition, string> = { ruim: "Ruim (½ nível)", normal: "Normal (nível)", confortavel: "Confortável (2× nível)", luxuosa: "Luxuosa (3× nível)" };
const ORDER: RestCondition[] = ["ruim", "normal", "confortavel", "luxuosa"];

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface RestInput {
  level: number;
  condition: RestCondition;
  place: RestPlace;
  sheet?: Pick<CharacterSheet, "powers" | "racialAbilities" | "classAbilities" | "equipment"> | null;
  /** quanto falta de PV e de PM (só desempata o Sono Reparador, que melhora um dos dois) */
  missingPv?: number;
  missingPm?: number;
}
export interface RestResult { pv: number; pm: number; condition: RestCondition; notes: string[] }

export function restRecovery(input: RestInput): RestResult {
  const level = Math.max(1, Math.trunc(input.level || 1));
  const names = new Set<string>();
  for (const entry of [...(input.sheet?.powers || []), ...(input.sheet?.racialAbilities || []), ...(input.sheet?.classAbilities || [])]) names.add(norm(entry.name));
  const has = (name: string) => names.has(norm(name));
  const worn = (name: string) => (input.sheet?.equipment || []).some((item) => item.equipped && norm(item.name) === norm(name));
  const notes: string[] = [];
  const amount = (condition: RestCondition) => condition === "ruim" ? Math.max(1, Math.floor(level / 2)) : level * (condition === "normal" ? 1 : condition === "confortavel" ? 2 : 3);
  const bonusPv = has("Rainha da Selva") ? level : 0;
  if (bonusPv) notes.push(`Rainha da Selva: +${level} PV (+1 por nível)`);

  // Seres que descansam sempre em condição normal (não são afetados por condições boas ou ruins).
  if (has("Preço da Não Vida") || has("Chamado das Trevas") || has("Tipo: Morto-Vivo")) {
    notes.push("Não é afetado por condições de descanso (conta como normal)");
    return { pv: amount("normal") + bonusPv, pm: amount("normal"), condition: "normal", notes };
  }

  let index = ORDER.indexOf(input.condition);
  let worseThanRuim = false;
  const worse = (reason: string) => { if (index === 0) worseThanRuim = true; else index -= 1; notes.push(`${reason}: uma categoria pior`); };
  if (input.place === "ermos" && has("Descanso Natural") && index < 2) { index = 2; notes.push("Descanso Natural: ao relento conta como confortável"); }
  if (worn("Berço das Fadas") && index < 2) { index = 2; notes.push("Berço das Fadas: descanso confortável mesmo ao relento"); }
  if (has("Pajem") && index < 3) { index += 1; notes.push("Pajem: uma categoria acima do padrão"); }
  if (input.place === "ermos" && has("Criado na cidade")) worse("Criado na cidade (nos ermos)");
  if (input.place === "urbano" && has("Matugo")) worse("Matugo (em ambiente urbano)");
  if (has("Paranoico")) worse("Paranoico");
  if (worseThanRuim) return { pv: 1 + bonusPv, pm: 1, condition: "ruim", notes: [...notes, "Já era ruim: recupera apenas 1 PV e 1 PM"] };
  if (index === 2 && worn("Camisolão")) { index = 3; notes.push("Camisolão: confortável vira luxuosa"); }

  let pvIndex = index;
  let pmIndex = index;
  if (has("Sono Reparador") && index >= 1) {
    // Melhora um passo a recuperação de PV OU de PM: aplica no que falta mais (PM no empate).
    if ((input.missingPv ?? 0) > (input.missingPm ?? 0)) pvIndex = Math.min(3, index + 1); else pmIndex = Math.min(3, index + 1);
    notes.push(`Sono Reparador: ${pvIndex > index ? "PV" : "PM"} melhora um passo`);
  }
  return { pv: amount(ORDER[pvIndex]) + bonusPv, pm: amount(ORDER[pmIndex]), condition: ORDER[index], notes };
}
