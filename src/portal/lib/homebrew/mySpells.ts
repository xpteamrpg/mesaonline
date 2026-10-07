/**
 * Magias criadas pela própria pessoa no Criador de magias (Homebrew). São PRIVADAS: só quem criou, logado na própria conta, vê.
 * Não entram no compêndio, no grimório nem em nenhuma lista pública.
 * Guarda: tabela `mrpg_my_spells` no Supabase, junto das fichas (dono vê só as próprias, db/supabase-homebrew-magias.sql); sem a tabela
 * ou sem rede, fica numa cópia deste navegador separada por conta (a cópia local é sempre gravada).
 */
import { supabase } from "../supabase/client";
import type { MagiaCriada } from "./spellText";

export type { MagiaCriada };

const KEY = (userId: string) => `tormenta20_my_spells_v2:${userId}`;

export const novoId = () => `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const novaMagia = (): MagiaCriada => ({
  id: novoId(), nome: "", tipo: "Arcana", escola: "Evocação", circulo: 1, descricao: "",
  eixos: { execucao: "padrao", alcance: "curto", duracao: "instantanea", resistencia: "nenhuma", teste: "Reflexos", alvo: { tipo: "alvos", qtd: 1, restrito: null } },
  efeitos: {}, aprimoramentos: [], criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString(),
});

const readLocal = (userId: string): MagiaCriada[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY(userId)) || "[]");
    return Array.isArray(parsed) ? (parsed as MagiaCriada[]).filter((s) => s && s.id && s.eixos) : [];
  } catch {
    return [];
  }
};
const writeLocal = (userId: string, list: MagiaCriada[]) => {
  try { localStorage.setItem(KEY(userId), JSON.stringify(list)); } catch { /* armazenamento cheio ou bloqueado: vale só nesta sessão */ }
};

export type SaveWhere = "conta" | "navegador";

/** Magias da pessoa: junta a conta (se a tabela existir) com a cópia do navegador; a da conta vence quando o id é o mesmo. */
export async function loadMySpells(userId: string): Promise<{ spells: MagiaCriada[]; where: SaveWhere }> {
  const local = readLocal(userId);
  if (!supabase) return { spells: local, where: "navegador" };
  const { data, error } = await supabase.from("mrpg_my_spells").select("id,data").eq("owner_id", userId).order("updated_at", { ascending: false });
  if (error) return { spells: local, where: "navegador" };
  const remote = (data ?? []).map((row) => ({ ...(row.data as MagiaCriada), id: row.id as string })).filter((s) => s.eixos);
  const ids = new Set(remote.map((s) => s.id));
  const merged = [...remote, ...local.filter((s) => !ids.has(s.id))].sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
  writeLocal(userId, merged);
  return { spells: merged, where: "conta" };
}

export async function saveMySpell(userId: string, spell: MagiaCriada): Promise<SaveWhere> {
  const next = { ...spell, atualizadaEm: new Date().toISOString() };
  writeLocal(userId, [next, ...readLocal(userId).filter((s) => s.id !== spell.id)]);
  if (!supabase) return "navegador";
  const { error } = await supabase.from("mrpg_my_spells").upsert({ owner_id: userId, id: next.id, name: next.nome, data: next, updated_at: next.atualizadaEm }, { onConflict: "owner_id,id" });
  return error ? "navegador" : "conta";
}

export async function deleteMySpell(userId: string, id: string): Promise<void> {
  writeLocal(userId, readLocal(userId).filter((s) => s.id !== id));
  if (!supabase) return;
  await supabase.from("mrpg_my_spells").delete().eq("owner_id", userId).eq("id", id);
}
