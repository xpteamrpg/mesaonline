import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { novaMagia } from "../src/portal/lib/homebrew/mySpells";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Supabase de mentira, em memória: só o que as telas de magia usam. */
const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("../src/portal/lib/supabase/client", () => {
  const builder = (table: string) => {
    let filters: [string, unknown][] = [];
    let op: "select" | "delete" = "select";
    const run = () => {
      const match = (r: Record<string, unknown>) => filters.every(([k, v]) => r[k] === v);
      if (table === "mrpg_public_spells") {
        if (op === "delete") { db.rows = db.rows.filter((r) => !match(r)); return { data: null, error: null }; }
        return { data: db.rows.filter(match), error: null };
      }
      return { data: [], error: null };
    };
    const api: Record<string, unknown> = {
      upsert: (row: Record<string, unknown>) => { if (table === "mrpg_public_spells") db.rows = [...db.rows.filter((r) => !(r.owner_id === row.owner_id && r.id === row.id)), { ...row, published_at: "2026-10-07T12:00:00Z" }]; return Promise.resolve({ error: null }); },
      select: () => api, order: () => api, limit: () => api,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return api; },
      delete: () => { op = "delete"; return api; },
      then: (ok: (v: unknown) => unknown) => Promise.resolve(run()).then(ok),
    };
    return api;
  };
  return { supabase: { from: builder }, supabaseConfigured: true };
});
vi.mock("../src/portal/lib/imageFile", async (original) => ({ ...(await original<typeof import("../src/portal/lib/imageFile")>()), shrinkDataUrl: async (d: string) => d }));
const auth = vi.hoisted(() => ({ user: { id: "u1", email: "dona@exemplo.com", nickname: "dona", displayName: "Maga Dona", handle: "maga_dona", bio: "Mestra de Arton há 10 anos." } }));
vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: auth.user, requireLogin: () => true }) }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); db.rows = []; vi.resetModules(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const button = (text: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;

describe("publicar magias no Homebrew", () => {
  it("o perfil público leva só o que a pessoa autorizou e nunca o e-mail da conta", async () => {
    const { buildAuthor, publishSpell, listPublicSpells, spellLink, parseSpellKey } = await import("../src/portal/lib/homebrew/publicSpells");
    const magia = { ...novaMagia(), nome: "Lança de Cinzas" };
    const author = await buildAuthor(auth.user, { showHandle: true, showBio: false, showAvatar: true, contact: " Discord dona#1 " }, "data:image/png;base64,AAAA");
    expect(author).toEqual({ name: "Maga Dona", handle: "maga_dona", avatar: "data:image/png;base64,AAAA", contact: "Discord dona#1" });
    expect(JSON.stringify(author)).not.toContain("exemplo.com");
    const semNome = await buildAuthor({ id: "x", email: "fulano@exemplo.com" }, { showHandle: true, showBio: true, showAvatar: false, contact: "" }, "");
    expect(semNome.name).toBe("fulano"); // sem perfil, o começo do e-mail; nunca o endereço inteiro
    expect((await publishSpell("u1", magia, author)).ok).toBe(true);
    const list = await listPublicSpells();
    expect(list).toHaveLength(1);
    expect(list[0].author.name).toBe("Maga Dona");
    expect(list[0].magia.nome).toBe("Lança de Cinzas");
    expect(parseSpellKey(new URL(spellLink("u1", magia.id)).hash.split("magia=")[1] ? decodeURIComponent(new URL(spellLink("u1", magia.id)).hash.split("magia=")[1]) : "")).toEqual({ ownerId: "u1", id: magia.id });
  });

  it("no criador: publicar pelo diálogo mostra a magia publicada, e despublicar tira", async () => {
    const { SpellCreator } = await import("../src/portal/components/views/SpellCreator");
    await act(async () => { root.render(<SpellCreator onClose={() => undefined} />); });
    await flush();
    const setName = async (value: string) => { const el = host.querySelector('input[placeholder="Ex.: Lança de Cinzas"]') as HTMLInputElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); }); };
    await setName("Lança de Cinzas");
    for (let i = 0; i < 8 && host.querySelector("[data-next-step]"); i += 1) await act(async () => { (host.querySelector("[data-next-step]") as HTMLButtonElement).click(); });
    expect(host.querySelector("[data-ai-suggestions]")!.hasAttribute("disabled")).toBe(true); // a IA vem com o agente do site
    await act(async () => { (host.querySelector("[data-publish]") as HTMLButtonElement).click(); });
    await flush();
    const dialog = host.querySelector("[data-publish-dialog]")!;
    expect(dialog.textContent).toContain("Maga Dona");
    expect(dialog.textContent).toContain("@maga_dona");
    expect(dialog.textContent).not.toContain("dona@exemplo.com");
    await act(async () => { (dialog.querySelector("[data-confirm-publish]") as HTMLButtonElement).click(); });
    await flush();
    expect(db.rows).toHaveLength(1);
    expect((db.rows[0].author as { name: string }).name).toBe("Maga Dona");
    expect(host.querySelector("[data-publish-dialog]")).toBeNull();
    expect(host.querySelector("[data-unpublish]")).toBeTruthy();
    await act(async () => { (host.querySelector("[data-unpublish]") as HTMLButtonElement).click(); });
    await flush();
    expect(db.rows).toHaveLength(0);
    expect(host.querySelector("[data-publish]")).toBeTruthy();
  });

  it("no Homebrew a magia publicada aparece com o perfil de quem criou e o contato só abre ao clicar", async () => {
    const { buildAuthor, publishSpell } = await import("../src/portal/lib/homebrew/publicSpells");
    const magia = { ...novaMagia(), nome: "Lança de Cinzas", descricao: "Causa {dano}." };
    await publishSpell("u1", magia, await buildAuthor(auth.user, { showHandle: true, showBio: true, showAvatar: false, contact: "Discord dona#1" }, ""));
    const { HomebrewView } = await import("../src/portal/components/views/HomebrewView");
    await act(async () => { root.render(<HomebrewView onNavigate={() => undefined} />); });
    await flush();
    const section = host.querySelector("[data-public-spells]")!;
    expect(section.textContent).toContain("Lança de Cinzas");
    const author = section.querySelector("[data-spell-author]")!;
    expect(author.textContent).toContain("Maga Dona");
    expect(author.textContent).toContain("@maga_dona");
    expect(author.textContent).toContain("Mestra de Arton há 10 anos.");
    expect(author.querySelector("[data-author-contact-text]")).toBeNull();
    await act(async () => { (author.querySelector("[data-author-contact]") as HTMLButtonElement).click(); });
    expect(author.querySelector("[data-author-contact-text]")!.textContent).toBe("Discord dona#1");
    expect(section.textContent).toContain("Despublicar"); // é a dona
  });

  it("sem magias publicadas a seção nem aparece", async () => {
    const { HomebrewView } = await import("../src/portal/components/views/HomebrewView");
    await act(async () => { root.render(<HomebrewView onNavigate={() => undefined} />); });
    await flush();
    expect(host.querySelector("[data-public-spells]")).toBeNull();
    expect(button("Criar magia")).toBeTruthy();
  });
});
