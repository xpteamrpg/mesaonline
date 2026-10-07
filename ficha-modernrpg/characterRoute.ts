/**
 * characterRoute — persistência e rota OFICIAIS do personagem ModernRPG.
 *
 * Fonte única de verdade do personagem:
 *
 *   Armazenamento (localStorage):
 *     tormenta20_online_characters_v2         → CharacterSheet[]
 *     tormenta20_online_characters_v2:active  → CharacterSheet.id ativo
 *
 *   Rota oficial da ficha:
 *     /#/ficha?characterId=<CharacterSheet.id>
 *
 * Regras da integração com o VTT:
 *   - O VTT NÃO cria uma segunda lista de personagens: lê/grava nestas chaves.
 *   - O vínculo do token é `token.modernRpgCharacterId = CharacterSheet.id`.
 *   - Nunca vincular personagem por nome.
 *   - O único vínculo persistente é `modernRpgCharacterId`.
 *   - Com `characterId` na rota: localizar o CharacterSheet exato, torná-lo
 *     ativo e abrir a ficha oficial — jamais abrir OUTRO personagem por
 *     fallback silencioso. Sem `characterId`, comportamento normal.
 */
import type { CharacterSheet } from "./sheet";
import { fixSheetSpellCosts } from "../src/game/spellPm";
import { READY_HEROES, isReadyHeroId } from "../src/portal/data/readyHeroes";

export const CHARACTERS_STORAGE_KEY = "tormenta20_online_characters_v2";
export const ACTIVE_CHARACTER_STORAGE_KEY = `${CHARACTERS_STORAGE_KEY}:active`;
export const FICHA_ROUTE_PATH = "/ficha";

/* ------------------------------- Armazenamento ------------------------------- */

/** Lista oficial de personagens (CharacterSheet[]) — nunca uma cópia paralela. */
export function loadCharacterSheets(): CharacterSheet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHARACTERS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c): c is CharacterSheet => !!c && typeof c === "object" && typeof (c as CharacterSheet).id === "string").map(fixSheetSpellCosts) : [];
  } catch {
    return [];
  }
}

export function saveCharacterSheets(list: CharacterSheet[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("modernrpg-characters-changed"));
  } catch {
    /* armazenamento indisponível */
  }
}

/**
 * Mudanças que o Mestre faz nas fichas dos heróis prontos durante o jogo (largar item, pegar do chão, ajustes): ficam só neste navegador,
 * em chave própria; o modelo original (`READY_HEROES`) nunca é alterado e nada disso vai para a conta.
 */
export const READY_EDITS_STORAGE_KEY = "tormenta20_online_ready_edits_v1";

function readReadyEdits(): Record<string, CharacterSheet> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(READY_EDITS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Heróis prontos do playtest: à disposição do Mestre na Mesa, mesmo fora de qualquer campanha. Nunca entram na lista da conta. */
export function loadReadyHeroSheets(): CharacterSheet[] {
  const edits = readReadyEdits();
  return READY_HEROES.map((hero) => edits[hero.sheet.id as string] ?? (hero.sheet as unknown as CharacterSheet));
}

/** Volta um herói pronto ao modelo original (descarta as mudanças feitas na Mesa). */
export function resetReadyHeroSheet(id: string): void {
  if (typeof window === "undefined") return;
  const edits = readReadyEdits();
  delete edits[id];
  try {
    window.localStorage.setItem(READY_EDITS_STORAGE_KEY, JSON.stringify(edits));
    window.dispatchEvent(new CustomEvent("modernrpg-characters-changed"));
  } catch { /* armazenamento indisponível */ }
}

export function getCharacterSheetById(id: string): CharacterSheet | null {
  if (!id) return null;
  return loadCharacterSheets().find((c) => c.id === id) ?? loadReadyHeroSheets().find((c) => c.id === id) ?? null;
}

/** Insere ou substitui (por id) um personagem na lista oficial. */
export function upsertCharacterSheet(sheet: CharacterSheet): void {
  if (isReadyHeroId(sheet.id)) {
    // herói pronto: a mudança fica só neste navegador (nunca vai para a conta nem para a lista de personagens)
    try {
      window.localStorage.setItem(READY_EDITS_STORAGE_KEY, JSON.stringify({ ...readReadyEdits(), [sheet.id]: { ...sheet, updatedAt: new Date().toISOString() } }));
      window.dispatchEvent(new CustomEvent("modernrpg-characters-changed"));
    } catch { /* armazenamento indisponível */ }
    return;
  }
  const list = loadCharacterSheets();
  const idx = list.findIndex((c) => c.id === sheet.id);
  const next = { ...sheet, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveCharacterSheets(list);
}

export function removeCharacterSheetById(id: string): void {
  saveCharacterSheets(loadCharacterSheets().filter((c) => c.id !== id));
  if (getActiveCharacterId() === id) setActiveCharacterId(null);
}

/* ------------------------------ Personagem ativo ----------------------------- */

export function getActiveCharacterId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_CHARACTER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveCharacterId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_CHARACTER_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_CHARACTER_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("modernrpg-active-changed"));
  } catch {
    /* armazenamento indisponível */
  }
}

export function getActiveCharacterSheet(): CharacterSheet | null {
  const id = getActiveCharacterId();
  return id ? getCharacterSheetById(id) : null;
}

/* ------------------------------------ Rota ----------------------------------- */

/**
 * Extrai `characterId` da rota oficial `#/ficha?characterId=<id>`.
 * Aceita também `?characterId=` no search como conveniência.
 */
export function parseCharacterIdFromRoute(hash: string = typeof window !== "undefined" ? window.location.hash : ""): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const qIdx = raw.indexOf("?");
  if (qIdx >= 0) {
    const id = new URLSearchParams(raw.slice(qIdx + 1)).get("characterId");
    if (id) return id;
  }
  if (typeof window !== "undefined") {
    const fromSearch = new URLSearchParams(window.location.search).get("characterId");
    if (fromSearch) return fromSearch;
  }
  return null;
}

/**
 * URL oficial para abrir um personagem pelo id real:
 * `<base>/#/ficha?characterId=<id>` — mesmo formato usado pelo VTT.
 */
export function buildCharacterSheetUrl(characterId: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== "undefined" ? `${window.location.origin}/` : "/");
  return `${base.replace(/\/+$/, "/")}#${FICHA_ROUTE_PATH}?characterId=${encodeURIComponent(characterId)}`;
}

export type RoutedCharacter =
  /** Sem `characterId` na rota → preservar o comportamento normal da ficha. */
  | { mode: "no-characterId" }
  /** Personagem localizado; já marcado como ativo; abrir a ficha oficial. */
  | { mode: "found"; sheet: CharacterSheet }
  /** Id inexistente — NUNCA abrir outro personagem por fallback silencioso. */
  | { mode: "not-found"; characterId: string };

/**
 * Resolve a rota atual:
 *   1. localiza o CharacterSheet com o id exato;
 *   2. torna esse personagem o ativo no armazenamento oficial;
 *   3. devolve a ficha para a UI oficial abrir.
 */
export function resolveRoutedCharacter(): RoutedCharacter {
  const characterId = parseCharacterIdFromRoute();
  if (!characterId) return { mode: "no-characterId" };
  const sheet = getCharacterSheetById(characterId);
  if (!sheet) return { mode: "not-found", characterId };
  setActiveCharacterId(sheet.id);
  return { mode: "found", sheet };
}

/** Observa mudanças de rota (hashchange). Retorna função de unsubscribe. */
export function onCharacterRouteChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
