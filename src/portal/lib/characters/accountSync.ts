/**
 * Fichas na conta (tabela mrpg_characters, db/supabase-fichas.sql). Cada pessoa vê só as próprias.
 * O navegador guarda uma cópia (a Mesa lê dela); a conta é a fonte de verdade quando há login.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase/client";
import type { CharacterSheet } from "../../types/sheet";
import { INITIAL_CHARACTERS } from "../../data/characters";
import { fixSheetSpellCosts } from "../../../game/spellPm";

export const STORAGE_KEY = "tormenta20_online_characters_v2";
const OWNER_KEY = `${STORAGE_KEY}:owner`;
const LEGACY_KEY = `${STORAGE_KEY}:legacy`;
const OFFERED_KEY = (userId: string) => `${STORAGE_KEY}:legacy-offered:${userId}`;
const EXAMPLE_IDS = new Set(INITIAL_CHARACTERS.map((c) => c.id));

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* sem espaço */ } };

function parseList(raw: string | null): CharacterSheet[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CharacterSheet[]).filter((c) => c && c.id && c.name).map(fixSheetSpellCosts) : [];
  } catch { return []; }
}

/** Fichas feitas pela pessoa neste navegador antes de existir conta (sem os heróis de exemplo). */
export const readLegacyCharacters = (): CharacterSheet[] => parseList(read(LEGACY_KEY)).filter((c) => !EXAMPLE_IDS.has(c.id));

/**
 * Lista inicial da tela. Só reaproveita a cópia do navegador se ela já pertence a uma conta; a cópia antiga, de antes das contas,
 * vai para um backup (nada é perdido) e a lista começa vazia: heróis de exemplo não aparecem mais em "Meus Personagens".
 */
export function loadInitialCharacters(): CharacterSheet[] {
  const cached = parseList(read(STORAGE_KEY));
  if (read(OWNER_KEY)) return cached;
  const mine = cached.filter((c) => !EXAMPLE_IDS.has(c.id));
  if (mine.length && !read(LEGACY_KEY)) write(LEGACY_KEY, JSON.stringify(mine));
  return [];
}

async function fetchAccount(): Promise<CharacterSheet[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("mrpg_characters").select("id,data").order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => fixSheetSpellCosts({ ...(row.data as CharacterSheet), id: row.id as string }));
}

async function saveAccount(userId: string, list: CharacterSheet[]) {
  if (!supabase || !list.length) return;
  const rows = list.map((c) => ({ owner_id: userId, id: c.id, name: c.name, data: c, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("mrpg_characters").upsert(rows, { onConflict: "owner_id,id" });
  if (error) throw new Error(error.message);
}

async function deleteAccount(userId: string, ids: string[]) {
  if (!supabase || !ids.length) return;
  const { error } = await supabase.from("mrpg_characters").delete().eq("owner_id", userId).in("id", ids);
  if (error) throw new Error(error.message);
}

interface Options {
  userId: string | null;
  authLoading: boolean;
  characters: CharacterSheet[];
  setCharacters: (list: CharacterSheet[]) => void;
}

/** Mantém a lista de fichas igual à da conta: carrega ao entrar, grava o que muda e esvazia ao sair. */
export function useAccountCharacters({ userId, authLoading, characters, setCharacters }: Options) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const saved = useRef(new Map<string, string>());
  const loadedFor = useRef<string | null>(null);

  // Entrou, trocou de conta ou saiu.
  useEffect(() => {
    if (authLoading) return;
    if (!userId || !supabase) {
      loadedFor.current = null; saved.current = new Map(); setReady(false);
      if (!userId) { try { localStorage.removeItem(OWNER_KEY); } catch { /* ok */ } setCharacters([]); }
      return;
    }
    let alive = true;
    setReady(false); setError("");
    (async () => {
      try {
        let list = await fetchAccount();
        const legacy = readLegacyCharacters();
        if (!list.length && legacy.length && !read(OFFERED_KEY(userId))) {
          write(OFFERED_KEY(userId), "1");
          if (window.confirm(`Encontramos ${legacy.length} personagem(ns) salvo(s) neste navegador, de antes das contas. Enviar para a sua conta?`)) {
            await saveAccount(userId, legacy);
            list = legacy;
          }
        }
        if (!alive) return;
        saved.current = new Map(list.map((c) => [c.id, JSON.stringify(c)]));
        loadedFor.current = userId;
        write(OWNER_KEY, userId);
        setCharacters(list);
        setReady(true);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar os personagens da conta.");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading]);

  // Grava na conta o que mudou (com um pequeno atraso para juntar várias edições seguidas).
  useEffect(() => {
    if (!ready || !userId || loadedFor.current !== userId) return;
    const timer = window.setTimeout(async () => {
      const current = new Map(characters.map((c) => [c.id, JSON.stringify(c)]));
      const changed = characters.filter((c) => saved.current.get(c.id) !== current.get(c.id));
      const removed = [...saved.current.keys()].filter((id) => !current.has(id));
      if (!changed.length && !removed.length) return;
      try {
        await saveAccount(userId, changed);
        await deleteAccount(userId, removed);
        saved.current = current;
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível salvar na conta.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [characters, ready, userId]);

  return { ready, error };
}
