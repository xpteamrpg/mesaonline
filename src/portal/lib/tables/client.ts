/**
 * Cliente do backend opcional de Mesas (ver server/). Criar e entrar em
 * mesa privativa não exigem conta — funciona só com código/link, como já
 * acontece ao abrir uma sala do VTT. O app continua funcionando sem esse
 * servidor; essas chamadas só rodam quando o usuário usa "Mesa Online".
 */
import type { TableDetails } from "./details";

export interface TableEntry {
  id: string;
  code: string;
  name: string;
  system: string;
  modality: "online" | "presencial";
  priceType: "gratuita" | "paga";
  priceValue: number;
  schedule: string;
  gmName: string;
  seatsTotal: number;
  seatsFilled: number;
  ageRating: string;
  vttPlatform: string;
  description: string;
  imageUrl: string;
  contactInfo: string;
  liveRoomCode: string;
  /** campanha (selo azul) ou one-shot (selo vermelho) */
  kind?: "campanha" | "oneshot";
  isPublic: boolean;
  /** página da mesa: horários, regras, cenário, avisos, segurança, requisitos, contato (coluna `details`) */
  details?: TableDetails;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
  managementToken?: string;
}

export type CreateTableInput = Partial<Omit<TableEntry, "id" | "code" | "ratingAvg" | "ratingCount" | "createdAt" | "managementToken">> & { name: string };

import { supabase } from "../supabase/client";

/**
 * As mesas ficam no Supabase (funções `mrpg_table_*` de db/supabase-mesas.sql, sem conta e sem expor o token).
 * Se o Supabase não está configurado, ou a migração ainda não foi aplicada, ou a rede falha, o Portal cai no servidor
 * local opcional (`server/`, porta 4000) e, sem ele, as telas criam a mesa só no navegador.
 */
async function viaSupabase<T>(fn: string, args: Record<string, unknown>): Promise<{ used: false } | { used: true; data: T }> {
  if (!supabase) return { used: false };
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      // Função inexistente (migração não aplicada) ou rede fora: tenta o próximo caminho. Erro de regra (mesa não encontrada...) sobe.
      if (error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST301" || !error.code) return { used: false };
      throw new Error(error.message);
    }
    return { used: true, data: data as T };
  } catch (cause) {
    if (cause instanceof TypeError) return { used: false };
    throw cause;
  }
}

const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) || "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined) } });
  } catch {
    throw new Error("Não foi possível falar com o servidor de mesas. Ele está rodando (`npm run server`)?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Erro ${res.status}`);
  return body as T;
}

export async function createTable(input: CreateTableInput): Promise<TableEntry> {
  const remote = await viaSupabase<TableEntry>("mrpg_table_create", { p: input });
  if (remote.used) return remote.data;
  const { table } = await request<{ table: TableEntry }>("/api/tables", { method: "POST", body: JSON.stringify(input) });
  return table;
}

export async function getTableByCode(code: string): Promise<TableEntry> {
  const remote = await viaSupabase<TableEntry>("mrpg_table_by_code", { p_code: code });
  if (remote.used) return remote.data;
  const { table } = await request<{ table: TableEntry }>(`/api/tables/code/${encodeURIComponent(code.trim().toUpperCase())}`);
  return table;
}

export interface ListTablesParams {
  system?: string;
  modality?: string;
  priceType?: string;
  q?: string;
  sort?: string;
  page?: number;
}

export async function listPublicTables(params: ListTablesParams = {}): Promise<{ tables: TableEntry[]; total: number; hasMore: boolean }> {
  const remote = await viaSupabase<{ tables: TableEntry[]; total: number; hasMore: boolean }>("mrpg_tables_list", {
    p_system: params.system ?? null, p_modality: params.modality ?? null, p_price: params.priceType ?? null, p_q: params.q ?? null, p_sort: params.sort ?? "relevancia", p_page: params.page ?? 1,
  });
  if (remote.used) return remote.data;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
  return request(`/api/tables?${qs.toString()}`);
}

export async function updateTable(id: string, managementToken: string, patch: Partial<TableEntry>): Promise<TableEntry> {
  const remote = await viaSupabase<TableEntry>("mrpg_table_update", { p_id: id, p_token: managementToken, p: patch });
  if (remote.used) return remote.data;
  const { table } = await request<{ table: TableEntry }>(`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify({ managementToken, patch }) });
  return table;
}

export async function rateTable(id: string, value: number): Promise<{ ratingAvg: number | null; ratingCount: number }> {
  const remote = await viaSupabase<{ ratingAvg: number | null; ratingCount: number }>("mrpg_table_rate", { p_id: id, p_value: value });
  if (remote.used) return remote.data;
  return request(`/api/tables/${id}/rate`, { method: "POST", body: JSON.stringify({ value }) });
}
