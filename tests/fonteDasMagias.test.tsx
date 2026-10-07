import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import { T20_SPELLS } from "../src/portal/lib/t20/compendium";
import { SpellCard } from "../src/portal/components/sheet/SheetCatalogModals";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const FONTES = ["Tormenta 20 — Jogo Básico", "Heróis de Arton", "Deuses de Arton", "Ameaças de Arton", "Dragão Brasil", "Outras fontes"];
const spell = (nome: string) => T20_SPELLS.find((s) => s.nome === nome)!;

describe("fonte de cada magia", () => {
  it("toda magia do compêndio tem fonte, com os mesmos rótulos dos poderes", () => {
    expect(T20_SPELLS.length).toBeGreaterThan(250);
    for (const s of T20_SPELLS) expect(FONTES, s.nome).toContain(s.fonte);
  });

  it("as duas cópias do compêndio de magias são idênticas", () => {
    expect(fs.readFileSync("src/portal/lib/t20/vtt/magias.json", "utf8")).toBe(fs.readFileSync("ficha-modernrpg/t20/vtt/magias.json", "utf8"));
  });

  it("exemplos conferidos: Bola de Fogo é do Jogo Básico, Armadura Elemental de Heróis de Arton", () => {
    expect(spell("Bola de Fogo").fonte).toBe("Tormenta 20 — Jogo Básico");
    expect(spell("Armadura Elemental").fonte).toBe("Heróis de Arton");
    expect(spell("Relâmpago Flamejante").fonte).toBe("Tormenta 20 — Jogo Básico");
    // informado pelo usuário: as três são do suplemento Deuses de Arton
    for (const nome of ["Soco do Mestre", "Cólera do Deus-Sol", "Bola de Fogo Flamejante"]) expect(spell(nome).fonte, nome).toBe("Deuses de Arton");
  });

  it("o cartão da magia mostra a fonte", async () => {
    await act(async () => { root.render(<SpellCard s={spell("Armadura Elemental")} />); });
    expect(host.querySelector("[data-spell-source]")!.textContent).toBe("Heróis de Arton");
  });

  it("o Grimório tem o filtro de fonte", async () => {
    const { SpellsView } = await import("../src/portal/components/views/CompendiumView");
    await act(async () => { root.render(<SpellsView />); });
    expect(host.textContent).toContain("Fonte");
    expect(host.textContent).toContain("Heróis de Arton");
    const pill = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Heróis de Arton") as HTMLButtonElement;
    await act(async () => { pill.click(); });
    expect(host.querySelectorAll("[data-spell-source]").length).toBeGreaterThan(0);
    expect(Array.from(host.querySelectorAll("[data-spell-source]")).every((e) => e.textContent === "Heróis de Arton")).toBe(true);
  });
});
