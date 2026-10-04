/**
 * Imagens grandes (data URL: tokens e mapas) iam inteiras em TODA mensagem de estado — cada movimento de token mandava
 * ~1 MB a cada jogador e a mudança levava segundos para chegar. Aqui cada imagem vai uma única vez por conexão e, depois,
 * só uma referência curta (`@@img:<hash>`).
 */
const MIN_LENGTH = 2000;
const PREFIX = "@@img:";

function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${text.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

/** Troca as imagens grandes por referências, NO PRÓPRIO objeto (que já é uma cópia só do envio). Devolve as imagens ainda não enviadas a esta conexão. */
export function extractAssets(payload: unknown, alreadySent: Set<string>, knownHashes = new Map<string, string>()): Record<string, string> {
  const fresh: Record<string, string> = {};
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const value = node[i];
        if (typeof value === "string") { const ref = refFor(value); if (ref) node[i] = ref; } else walk(value);
      }
    } else if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const value = record[key];
        if (typeof value === "string") { const ref = refFor(value); if (ref) record[key] = ref; } else walk(value);
      }
    }
  };
  const refFor = (value: string): string | undefined => {
    if (value.length < MIN_LENGTH || !value.startsWith("data:")) return undefined;
    let hash = knownHashes.get(value);
    if (!hash) { hash = hashOf(value); knownHashes.set(value, hash); }
    if (!alreadySent.has(hash)) { fresh[hash] = value; alreadySent.add(hash); }
    return PREFIX + hash;
  };
  walk(payload);
  return fresh;
}

/** Recebe as imagens novas e devolve cada referência ao seu conteúdo. */
export function restoreAssets(payload: unknown, cache: Map<string, string>, assets?: Record<string, string>): unknown {
  if (assets) for (const [hash, data] of Object.entries(assets)) cache.set(hash, data);
  const back = (value: string): string => (value.startsWith(PREFIX) ? cache.get(value.slice(PREFIX.length)) ?? "" : value);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) { const value = node[i]; if (typeof value === "string") node[i] = back(value); else walk(value); }
    } else if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const key of Object.keys(record)) { const value = record[key]; if (typeof value === "string") record[key] = back(value); else walk(value); }
    }
  };
  walk(payload);
  return payload;
}
