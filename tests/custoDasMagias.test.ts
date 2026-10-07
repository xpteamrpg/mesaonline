import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { SPELL_PM_BY_CIRCLE, fixLegacySpellCost, fixSheetSpellCosts, spellPm } from "../src/game/spellPm";
import { T20_SPELLS } from "../src/portal/lib/t20/compendium";
import { makeSheet } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

/** Custo em PM por círculo: Livro Básico, Tabela 4-1 (p.170): 1, 3, 6, 10 e 15 PM. */
describe("custo em PM das magias pelo círculo", () => {
  it("a tabela é a do livro", () => {
    expect(SPELL_PM_BY_CIRCLE).toEqual({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });
    expect([1, 2, 3, 4, 5].map(spellPm)).toEqual([1, 3, 6, 10, 15]);
  });

  it("toda magia do compêndio custa o que o círculo diz, nas duas cópias", () => {
    expect(T20_SPELLS.length).toBeGreaterThan(250);
    for (const s of T20_SPELLS) expect(s.custo, `${s.nome} (${s.circulo}º)`).toBe(spellPm(s.circulo));
    expect(fs.readFileSync("src/portal/lib/t20/vtt/magias.json", "utf8")).toBe(fs.readFileSync("ficha-modernrpg/t20/vtt/magias.json", "utf8"));
  });

  it("o custo errado do catálogo antigo (5, 7 e 9 PM) é trocado nas fichas já gravadas; custo editado não é mexido", () => {
    expect(fixLegacySpellCost(3, 5)).toBe(6);
    expect(fixLegacySpellCost(4, 7)).toBe(10);
    expect(fixLegacySpellCost(5, 9)).toBe(15);
    expect(fixLegacySpellCost(2, 3)).toBe(3);
    expect(fixLegacySpellCost(3, 4)).toBe(4); // reduzido de propósito: fica
    expect(fixLegacySpellCost(1, 1)).toBe(1);
    const sheet = makeSheet({ spells: [{ id: "a", name: "A", circle: 3, cost: 5 }, { id: "b", name: "B", circle: 1, cost: 1 }] as never });
    const fixed = fixSheetSpellCosts(sheet);
    expect(fixed.spells.map((s) => s.cost)).toEqual([6, 1]);
    expect(fixSheetSpellCosts(fixed)).toBe(fixed); // sem nada para corrigir, devolve a mesma ficha
  });

  it("a Mesa lê a ficha antiga com o custo certo (ao carregar e ao montar a ação de magia)", async () => {
    const { saveCharacterSheets, loadCharacterSheets } = await import("../ficha-modernrpg/characterRoute");
    const sheet = makeSheet({ id: "velha", spells: [{ id: "x", name: "Magia Grande", circle: 4, cost: 7, school: "Evocação" }] as never });
    saveCharacterSheets([sheet]);
    expect(loadCharacterSheets()[0].spells[0].cost).toBe(10);
    const { actionsForCharacter } = await import("../src/tactics/interpretation/characterActionAdapter");
    const action = actionsForCharacter(sheet).find((a) => a.name.includes("Magia Grande"));
    expect(action?.pmCost).toBe(10);
  });
});
