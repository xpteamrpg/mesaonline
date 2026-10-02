/**
 * Membros, convites, expulsão e personagens ligados às mesas (funções `mrpg_*` de db/supabase-campanhas.sql).
 * Tudo exige conta (Supabase Auth). Sem Supabase configurado, as funções falham com uma mensagem clara.
 */
import { supabase } from "../supabase/client";
import type { TableEntry } from "../tables/client";
import type { CharacterSheet } from "../../types/sheet";
import { shrinkDataUrl } from "../imageFile";

export interface MyTable { table: TableEntry; role: "mestre" | "jogador"; members: number }
export interface TableInvite { inviteId: string; table: TableEntry; invitedBy: string; createdAt: string }
export interface TableMember { userId: string; name: string; role: "mestre" | "jogador"; joinedAt: string }
export interface CharacterSummary { name: string; race?: string; class?: string; level?: number; /** miniatura do retrato (data URL pequena) */ avatar?: string }
export interface PartyMember { id: string; characterId: string; summary: CharacterSummary; ownerId: string; ownerName: string; hasSheet: boolean }
export interface LinkRequest { id: string; characterId: string; summary: CharacterSummary; status: "solicitado" | "aceito" | "recusado"; ownerId: string; ownerName: string; createdAt: string }
export interface MyCharacterLink { id: string; characterId: string; status: "solicitado" | "aceito" | "recusado"; tableId: string; tableName: string; kind: "campanha" | "oneshot"; code: string }

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error("Contas e campanhas ficam indisponíveis sem o servidor do site.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const summaryOf = (c: CharacterSheet): CharacterSummary => ({ name: c.name, race: c.race, class: c.class, level: c.level });

export const claimTable = (id: string, token: string) => rpc<TableEntry>("mrpg_table_claim", { p_id: id, p_token: token });
export const joinTable = (code: string) => rpc<TableEntry>("mrpg_table_join", { p_code: code });
export const myTables = () => rpc<MyTable[]>("mrpg_my_tables");
export const tableMembers = (id: string) => rpc<TableMember[]>("mrpg_table_members_list", { p_id: id });
export const inviteToTable = (id: string, who: { email?: string; nickname?: string }) => rpc<{ ok: boolean; hasAccount: boolean }>("mrpg_table_invite", { p_id: id, p_email: who.email ?? "", p_nickname: who.nickname ?? "" });
export const myInvites = () => rpc<TableInvite[]>("mrpg_my_invites");
export const answerInvite = (inviteId: string, accept: boolean) => rpc<{ ok: boolean }>("mrpg_invite_answer", { p_invite: inviteId, p_accept: accept });
export const kickMember = (id: string, userId: string) => rpc<boolean>("mrpg_table_kick", { p_id: id, p_user: userId });
export const leaveTable = (id: string) => rpc<boolean>("mrpg_table_leave", { p_id: id });
/** Resumo com miniatura do retrato + cópia da ficha (sem retrato nem diário) que o Mestre e o dono podem abrir depois. */
async function linkPayload(c: CharacterSheet) {
  let avatar: string | undefined;
  if (c.avatar) {
    const thumb = await shrinkDataUrl(c.avatar, 96, 0.8);
    avatar = thumb.startsWith("data:") ? thumb : undefined;
  }
  const { avatar: _drop, journal: _journal, ...snapshot } = c as CharacterSheet & { journal?: unknown };
  return { summary: { ...summaryOf(c), avatar }, sheet: snapshot };
}
export async function requestCharacter(tableId: string, c: CharacterSheet) {
  const { summary, sheet } = await linkPayload(c);
  return rpc<{ id: string; status: string }>("mrpg_character_request", { p_table: tableId, p_character: c.id, p_summary: summary, p_sheet: sheet });
}
export async function linkCharacterByCode(code: string, c: CharacterSheet) {
  const { summary, sheet } = await linkPayload(c);
  return rpc<{ id: string; status: string; table: TableEntry }>("mrpg_character_link_by_code", { p_code: code, p_character: c.id, p_summary: summary, p_sheet: sheet });
}
export const tableParty = (id: string) => rpc<PartyMember[]>("mrpg_table_party", { p_id: id });
export const characterSheetOf = (linkId: string) => rpc<CharacterSheet | null>("mrpg_character_sheet", { p_link: linkId });
export const characterRequests = (id: string) => rpc<LinkRequest[]>("mrpg_character_requests", { p_id: id });
export const decideCharacter = (linkId: string, accept: boolean) => rpc<{ ok: boolean }>("mrpg_character_decide", { p_link: linkId, p_accept: accept });
export const unlinkCharacter = (linkId: string) => rpc<boolean>("mrpg_character_unlink", { p_link: linkId });
export const myCharacterLinks = () => rpc<MyCharacterLink[]>("mrpg_my_character_links");

/**
 * Escolhas feitas na aba "Convites de campanha" enquanto a ficha ainda está sendo criada ou editada.
 * Só valem quando a ficha é salva (`applyCampaignDraft`), para o personagem aparecer em "Mesas Online" com a campanha.
 */
export interface CampaignDraft { codes: string[]; invites: Array<{ inviteId: string; tableId: string }>; tables: string[] }
const emptyDraft = (): CampaignDraft => ({ codes: [], invites: [], tables: [] });
let draft: CampaignDraft = emptyDraft();
export const getCampaignDraft = () => draft;
export const setCampaignDraft = (next: CampaignDraft) => { draft = next; };
export const clearCampaignDraft = () => { draft = emptyDraft(); };
export const hasCampaignDraft = () => draft.codes.length + draft.invites.length + draft.tables.length > 0;

/** Aplica o rascunho à ficha salva e devolve o que não deu certo (para avisar a pessoa). */
export async function applyCampaignDraft(sheet: CharacterSheet): Promise<string[]> {
  const todo = draft;
  clearCampaignDraft();
  const problems: string[] = [];
  for (const code of todo.codes) { try { await linkCharacterByCode(code, sheet); } catch (e) { problems.push(`Código ${code}: ${e instanceof Error ? e.message : "falhou"}`); } }
  for (const inv of todo.invites) { try { await answerInvite(inv.inviteId, true); await requestCharacter(inv.tableId, sheet); } catch (e) { problems.push(e instanceof Error ? e.message : "Convite falhou"); } }
  for (const id of todo.tables) { try { await requestCharacter(id, sheet); } catch (e) { problems.push(e instanceof Error ? e.message : "Pedido falhou"); } }
  return problems;
}
