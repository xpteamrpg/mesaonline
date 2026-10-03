/**
 * Cliente do catálogo público de livros (ver server/). Ler/baixar não exige
 * conta; publicar exige (o autor precisa ser identificável). O app continua
 * funcionando sem esse servidor — só o catálogo público fica indisponível.
 */
import { getToken } from "../auth/client";
import { supabase } from "../supabase/client";

export interface PublicBook {
  id: string;
  title: string;
  authorName: string;
  system: string;
  coverUrl: string;
  fileUrl: string;
  priceType: "gratuita" | "paga";
  priceValue: number;
  description: string;
  createdAt: string;
  ownerId: string;
  /** quantas pessoas adquiriram (colocaram na conta) */
  downloadCount?: number;
  /** quando a pessoa adquiriu (só em "meus livros adquiridos") */
  acquiredAt?: string;
}

/**
 * O acervo mora no Supabase (funções `mrpg_book*` de db/supabase-livros.sql). Sem Supabase configurado, ou com a migração ainda
 * não aplicada, cai no servidor local opcional (`server/`).
 */
async function viaSupabase<T>(fn: string, args: Record<string, unknown>): Promise<{ used: false } | { used: true; data: T }> {
  if (!supabase) return { used: false };
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST301" || !error.code) return { used: false };
      throw new Error(error.message);
    }
    return { used: true, data: data as T };
  } catch (cause) {
    if (cause instanceof TypeError) return { used: false };
    throw cause;
  }
}

export interface PublishBookInput {
  title: string;
  authorName?: string;
  system?: string;
  coverUrl?: string;
  fileUrl: string;
  priceType?: "gratuita" | "paga";
  priceValue?: number;
  description?: string;
  declaresOriginal: boolean;
}

const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) || "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Não foi possível falar com o servidor. Ele está rodando (`npm run server`)?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Erro ${res.status}`);
  return body as T;
}

export interface ListBooksParams {
  q?: string;
  system?: string;
  priceType?: string;
  page?: number;
}

export async function listPublicBooks(params: ListBooksParams = {}): Promise<{ books: PublicBook[]; total: number; hasMore: boolean }> {
  const remote = await viaSupabase<{ books: PublicBook[]; total: number; hasMore: boolean }>("mrpg_books_list", { p_q: params.q ?? null, p_system: params.system ?? null, p_price: params.priceType ?? null, p_page: params.page ?? 1 });
  if (remote.used) return remote.data;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
  return request(`/api/books?${qs.toString()}`);
}

/** Meus livros: os que publiquei (com o contador de aquisições) e os que adquiri (estão na conta). */
export async function listMyBooks(): Promise<{ published: PublicBook[]; acquired: PublicBook[] }> {
  const remote = await viaSupabase<{ published: PublicBook[]; acquired: PublicBook[] }>("mrpg_my_books", {});
  if (remote.used) return remote.data;
  const { books } = await request<{ books: PublicBook[] }>("/api/books/mine");
  return { published: books, acquired: [] };
}

export async function listMyPublishedBooks(): Promise<PublicBook[]> {
  return (await listMyBooks()).published;
}

export async function publishBook(input: PublishBookInput): Promise<PublicBook> {
  const remote = await viaSupabase<PublicBook>("mrpg_book_publish", { p: input });
  if (remote.used) return remote.data;
  const { book } = await request<{ book: PublicBook }>("/api/books", { method: "POST", body: JSON.stringify(input) });
  return book;
}

export async function deletePublicBook(id: string): Promise<void> {
  const remote = await viaSupabase<boolean>("mrpg_book_delete", { p_id: id });
  if (remote.used) return;
  await request(`/api/books/${id}`, { method: "DELETE" });
}

/** Adquirir = colocar o livro na conta (gratuito ou pago, sem cobrança por enquanto). Conta +1 uma vez por pessoa. Devolve o livro com o link do arquivo. */
export async function acquireBook(id: string): Promise<PublicBook> {
  const remote = await viaSupabase<PublicBook>("mrpg_book_acquire", { p_id: id });
  if (remote.used) return remote.data;
  throw new Error("Para adquirir livros, o acervo online precisa estar ligado.");
}
