/**
 * Magias criadas pela própria pessoa no Criador de magias (Homebrew). São PRIVADAS: só quem criou, logado na própria conta, vê.
 * Não entram no compêndio, no grimório nem em nenhuma lista pública.
 * Guarda: tabela `mrpg_my_spells` no Supabase (dono vê só as próprias, db/supabase-homebrew-magias.sql); enquanto a tabela não existe
 * ou sem rede, fica numa cópia deste navegador separada por conta (a cópia local é sempre gravada).
 */
import { supabase } from "../supabase/client";

export interface MySpellEnhancement { custo: number; desc: string }
export interface MySpell {
  id: string;
  name: string;
  circulo: 1 | 2 | 3 | 4 | 5;
  tipo: "Arcana" | "Divina" | "Universal";
  escola: string;
  execucao: string;
  alcance: string;
  alvo: string;
  duracao: string;
  resistencia: string;
  descricao: string;
  aprimoramentos: MySpellEnhancement[];
  createdAt: string;
  updatedAt: string;
}

/** Custo base em PM por círculo, como no catálogo de magias do site (95 magias de 1º círculo custam 1, as de 2º custam 3 e assim por diante). */
export const SPELL_COST_BY_CIRCLE: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };
export const SPELL_TYPES: MySpell["tipo"][] = ["Arcana", "Divina", "Universal"];
export const SPELL_EXECUTIONS = ["Padrão", "Movimento", "Livre", "Reação", "Completa"];
export const SPELL_RANGES = ["Pessoal", "Toque", "Curto", "Médio", "Longo", "Ilimitado"];
export const SPELL_DURATIONS = ["Instantânea", "1 rodada", "Cena", "Sustentada", "1 dia", "Permanente"];
export const SPELL_RESISTANCES = [
  "Nenhuma", "Vontade anula", "Vontade parcial", "Vontade desacredita",
  "Fortitude anula", "Fortitude parcial", "Fortitude reduz à metade",
  "Reflexos anula", "Reflexos parcial", "Reflexos reduz à metade",
];

const KEY = (userId: string) => `tormenta20_my_spells_v1:${userId}`;

const readLocal = (userId: string): MySpell[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY(userId)) || "[]");
    return Array.isArray(parsed) ? (parsed as MySpell[]).filter((s) => s && s.id && s.name) : [];
  } catch {
    return [];
  }
};
const writeLocal = (userId: string, list: MySpell[]) => {
  try { localStorage.setItem(KEY(userId), JSON.stringify(list)); } catch { /* armazenamento cheio ou bloqueado: vale só nesta sessão */ }
};

export const newSpellId = () => `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export type SaveWhere = "conta" | "navegador";

/** Magias da pessoa: junta a conta (se a tabela existir) com a cópia do navegador; a da conta vence quando o id é o mesmo. */
export async function loadMySpells(userId: string): Promise<{ spells: MySpell[]; where: SaveWhere }> {
  const local = readLocal(userId);
  if (!supabase) return { spells: local, where: "navegador" };
  const { data, error } = await supabase.from("mrpg_my_spells").select("id,data").eq("owner_id", userId).order("updated_at", { ascending: false });
  if (error) return { spells: local, where: "navegador" };
  const remote = (data ?? []).map((row) => ({ ...(row.data as MySpell), id: row.id as string }));
  const ids = new Set(remote.map((s) => s.id));
  const merged = [...remote, ...local.filter((s) => !ids.has(s.id))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeLocal(userId, merged);
  return { spells: merged, where: "conta" };
}

export async function saveMySpell(userId: string, spell: MySpell): Promise<SaveWhere> {
  const next = { ...spell, updatedAt: new Date().toISOString() };
  const list = readLocal(userId).filter((s) => s.id !== spell.id);
  writeLocal(userId, [next, ...list]);
  if (!supabase) return "navegador";
  const { error } = await supabase.from("mrpg_my_spells").upsert({ owner_id: userId, id: next.id, name: next.name, data: next, updated_at: next.updatedAt }, { onConflict: "owner_id,id" });
  return error ? "navegador" : "conta";
}

export async function deleteMySpell(userId: string, id: string): Promise<void> {
  writeLocal(userId, readLocal(userId).filter((s) => s.id !== id));
  if (!supabase) return;
  await supabase.from("mrpg_my_spells").delete().eq("owner_id", userId).eq("id", id);
}

/** Texto da magia no formato do livro, para copiar e usar na mesa. */
export function spellAsText(s: MySpell): string {
  const cost = SPELL_COST_BY_CIRCLE[s.circulo];
  return [
    `${s.name} — ${s.tipo} ${s.circulo} (${s.escola})`,
    `Execução: ${s.execucao}; Alcance: ${s.alcance}; Alvo: ${s.alvo || "—"}; Duração: ${s.duracao}; Resistência: ${s.resistencia}. Custo: ${cost} PM.`,
    s.descricao,
    ...s.aprimoramentos.map((a) => `+${a.custo} PM: ${a.desc}`),
  ].join("\n");
}
