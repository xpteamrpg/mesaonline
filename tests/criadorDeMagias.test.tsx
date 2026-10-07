import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Nada de rede: sem Supabase a guarda fica no navegador, separada por conta.
vi.mock("../src/portal/lib/supabase/client", () => ({ supabase: null, supabaseConfigured: false }));
const auth = vi.hoisted(() => ({ id: "u1" }));
vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: auth.id }, requireLogin: () => true }) }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); auth.id = "u1"; vi.resetModules(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const setValue = async (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
};
const button = (text: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

async function mountCreator() {
  const { SpellCreator } = await import("../src/portal/components/views/SpellCreator");
  await act(async () => { root.render(<SpellCreator onClose={() => undefined} />); });
  await flush();
}

describe("criador de magias (privado)", () => {
  it("cria uma magia, mostra o cartão ao vivo com o custo do círculo e guarda só para essa conta", async () => {
    await mountCreator();
    await setValue(host.querySelector('input[placeholder="Ex.: Lança de Cinzas"]') as HTMLInputElement, "Lança de Cinzas");
    await setValue(host.querySelector("textarea") as HTMLTextAreaElement, "Causa 2d6 de fogo no alvo.");
    const circle = host.querySelectorAll("select")[0] as HTMLSelectElement;
    await setValue(circle, "2");
    const card = host.querySelector("[data-spell-card]")!;
    expect(card.textContent).toContain("Lança de Cinzas");
    expect(card.textContent).toContain("Arcana 2");
    expect(card.textContent).toContain("3 PM"); // 2º círculo = 3 PM, como no catálogo
    await act(async () => { button("Guardar magia").click(); });
    await flush();
    expect(host.querySelector("[data-my-spells]")!.textContent).toContain("Minhas magias (1)");
    const stored = JSON.parse(localStorage.getItem("tormenta20_my_spells_v1:u1") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: "Lança de Cinzas", circulo: 2 });
    expect(localStorage.getItem("tormenta20_my_spells_v1:u2")).toBeNull();
  });

  it("exige nome e descrição", async () => {
    await mountCreator();
    await act(async () => { button("Guardar magia").click(); });
    expect(host.textContent).toContain("Dê um nome para a magia.");
    expect(host.textContent).toContain("Escreva a descrição da magia.");
    expect(localStorage.getItem("tormenta20_my_spells_v1:u1")).toBeNull();
  });

  it("outra conta no mesmo navegador não vê as magias", async () => {
    const { saveMySpell, loadMySpells, newSpellId } = await import("../src/portal/lib/homebrew/mySpells");
    await saveMySpell("u1", { id: newSpellId(), name: "Só minha", circulo: 1, tipo: "Arcana", escola: "Evocação", execucao: "Padrão", alcance: "Curto", alvo: "", duracao: "Instantânea", resistencia: "Nenhuma", descricao: "x", aprimoramentos: [], createdAt: "", updatedAt: "" });
    expect((await loadMySpells("u1")).spells.map((s) => s.name)).toEqual(["Só minha"]);
    expect((await loadMySpells("u2")).spells).toEqual([]);
  });

  it("aprimoramentos entram no cartão e no texto copiável", async () => {
    await mountCreator();
    await setValue(host.querySelector('input[placeholder="Ex.: Lança de Cinzas"]') as HTMLInputElement, "Raio Teste");
    await setValue(host.querySelector('input[placeholder^="O que muda"]') as HTMLInputElement, "aumenta o dano em +1d6");
    await act(async () => { button("+ Aprimoramento").click(); });
    expect(host.querySelector("[data-spell-card]")!.textContent).toContain("+1 PM: aumenta o dano em +1d6");
  });

  it("o botão do Homebrew abre o criador", async () => {
    const { HomebrewView } = await import("../src/portal/components/views/HomebrewView");
    await act(async () => { root.render(<HomebrewView onNavigate={() => undefined} />); });
    expect(host.querySelector("[data-spell-creator]")).toBeNull();
    await act(async () => { button("Criar magia").click(); });
    expect(host.querySelector("[data-spell-creator]")).toBeTruthy();
    expect(host.textContent).toContain("só suas");
  });
});
