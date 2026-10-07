/**
 * Magias publicadas no Homebrew. A pessoa decide publicar (antes disso a magia é só dela) e escolhe o que do perfil aparece:
 * nome, @identificador, bio curta, retrato pequeno e um contato opcional. Nunca o e-mail da conta.
 * Guarda: tabela `mrpg_public_spells` (db/supabase-homebrew-magias-publicas.sql): qualquer pessoa lê; só a dona publica e despublica.
 */
import { supabase } from "../supabase/client";
import { shrinkDataUrl } from "../imageFile";
import type { MagiaCriada } from "./spellText";

export interface SpellAuthor { name: string; handle?: string; bio?: string; avatar?: string; contact?: string }
export interface PublicSpell { ownerId: string; magia: MagiaCriada; author: SpellAuthor; publishedAt: string }

/** O que a pessoa autorizou mostrar no perfil da magia. */
export interface AuthorChoice { showHandle: boolean; showBio: boolean; showAvatar: boolean; contact: string }
export interface ProfileInfo { id: string; displayName?: string; nickname?: string; handle?: string; bio?: string; email?: string }

export const publishingAvailable = () => supabase !== null;
export const spellLink = (ownerId: string, id: string) => `${window.location.origin}${window.location.pathname}#/homebrew?magia=${encodeURIComponent(`${ownerId}~${id}`)}`;
export const parseSpellKey = (key: string): { ownerId: string; id: string } | null => { const [ownerId, ...rest] = key.split("~"); return ownerId && rest.length ? { ownerId, id: rest.join("~") } : null; };

/** Nome mostrado: o do perfil; sem ele, o apelido; sem nenhum, o começo do e-mail (nunca o e-mail inteiro). */
export const publicName = (p: ProfileInfo) => (p.displayName || p.nickname || (p.email ? p.email.split("@")[0] : "") || "Anônimo").slice(0, 60);

export async function buildAuthor(p: ProfileInfo, choice: AuthorChoice, avatarDataUrl: string): Promise<SpellAuthor> {
  const author: SpellAuthor = { name: publicName(p) };
  if (choice.showHandle && p.handle) author.handle = p.handle;
  if (choice.showBio && p.bio) author.bio = p.bio.slice(0, 280);
  if (choice.showAvatar && avatarDataUrl) { const small = await shrinkDataUrl(avatarDataUrl, 96, 0.8); if (small.startsWith("data:")) author.avatar = small; }
  if (choice.contact.trim()) author.contact = choice.contact.trim().slice(0, 200);
  return author;
}

export async function publishSpell(ownerId: string, magia: MagiaCriada, author: SpellAuthor): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "A publicação precisa da conta online." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("mrpg_public_spells").upsert(
    { owner_id: ownerId, id: magia.id, name: magia.nome, circulo: magia.circulo, data: magia, author, updated_at: now },
    { onConflict: "owner_id,id" },
  );
  return error ? { ok: false, error: /relation .* does not exist|schema cache/i.test(error.message) ? "A publicação ainda não está ligada neste site (falta criar a tabela)." : error.message } : { ok: true };
}

export async function unpublishSpell(ownerId: string, id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("mrpg_public_spells").delete().eq("owner_id", ownerId).eq("id", id);
  return !error;
}

const toPublic = (row: { owner_id: string; data: unknown; author: unknown; published_at: string }): PublicSpell => ({ ownerId: row.owner_id, magia: row.data as MagiaCriada, author: (row.author || { name: "Anônimo" }) as SpellAuthor, publishedAt: row.published_at });

/** Magias publicadas, as mais novas primeiro (leitura pública). Lista vazia se a tabela ainda não existe. */
export async function listPublicSpells(limit = 200): Promise<PublicSpell[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("mrpg_public_spells").select("owner_id,data,author,published_at").order("published_at", { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []).map(toPublic).filter((s) => s.magia && s.magia.eixos);
}

/** Ids (da própria pessoa) que já estão publicados. */
export async function myPublishedIds(ownerId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase.from("mrpg_public_spells").select("id").eq("owner_id", ownerId);
  return new Set(error ? [] : (data ?? []).map((r) => r.id as string));
}
