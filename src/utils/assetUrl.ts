/**
 * Endereço de arquivos da pasta public/. O site pode ficar numa subpasta (GitHub Pages: /mesaonline/), então um
 * caminho que começa com "/" precisa levar o caminho base na frente. Em desenvolvimento a base é "/" e nada muda.
 */
const BASE = ((import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/").replace(/\/$/, "");

/** "/ui/x.webp" → "/mesaonline/ui/x.webp" (links externos, data: e blob: passam direto). */
export function withBase(url: string): string;
export function withBase(url: string | undefined): string | undefined;
export function withBase(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return url;
  return BASE && url.startsWith(`${BASE}/`) ? url : `${BASE}${url}`;
}

/** Raiz do site ("/" ou "/mesaonline/"), sempre com a barra no fim. */
export const SITE_ROOT = `${BASE}/`;
