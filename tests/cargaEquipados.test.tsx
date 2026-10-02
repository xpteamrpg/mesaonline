import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterSheet as SheetPanel } from "../src/components/mesaSkin/components/Panels";
import { SkinRuntimeContext, type SkinRuntime } from "../src/components/mesaSkin/runtime";
import { cargaOf, equippedCounts, toggleEquipped } from "../src/game/carga";
import { boardTokenFromCharacter } from "../src/integration/modernRpgCharacterBridge";
import { loadReadyHeroSheets } from "../ficha-modernrpg/characterRoute";
import type { CharacterSheet, EquipmentItem } from "../ficha-modernrpg/sheet";

/** Carga (limite, sobrecarga −3 m) e itens em uso (2 empunhados, 4 vestidos): regras do livro básico, texto passado pelo usuário. */
const item = (id: string, category: EquipmentItem["category"], slots = 1, equipped = false): EquipmentItem =>
  ({ id, name: id, equipped, quantity: 1, slots, price: null, description: "", category }) as EquipmentItem;
const withItems = (equipment: EquipmentItem[], forca = 0): CharacterSheet => {
  const base = loadReadyHeroSheets()[0];
  return { ...base, equipment, attributes: { ...base.attributes, for: { ...base.attributes.for, value: forca } } } as CharacterSheet;
};

describe("carga", () => {
  it("passar do limite sobrecarrega (−3 m) e o dobro do limite é impossível", () => {
    const light = cargaOf(withItems([item("a", "Item Geral")], 0));
    expect(light.overloaded).toBe(false);
    expect(light.speedPenaltyM).toBe(0);
    const heavy = cargaOf(withItems([item("bau", "Item Geral", 14)], 0));
    expect(heavy.used).toBeGreaterThan(heavy.max);
    expect(heavy).toMatchObject({ overloaded: true, speedPenaltyM: 3, impossible: false });
    expect(cargaOf(withItems([item("bau", "Item Geral", heavy.max * 2 + 2)], 0)).impossible).toBe(true);
  });

  it("o token da ficha sobrecarregada anda 3 m a menos", () => {
    const base = withItems([item("a", "Item Geral")], 0);
    const heavy = withItems([item("bau", "Item Geral", 40)], 0);
    expect(boardTokenFromCharacter(heavy, { x: 1, y: 1 }).movementM).toBe(boardTokenFromCharacter(base, { x: 1, y: 1 }).movementM - 3);
  });
});

describe("itens em uso", () => {
  it("empunha no máximo 2 (armas e escudos) e veste no máximo 4", () => {
    let sheet = withItems([item("espada", "Arma"), item("adaga", "Arma"), item("escudo", "Escudo"), ...["a", "b", "c", "d", "e"].map((id) => item(id, "Vestuário"))]);
    for (const id of ["espada", "adaga"]) sheet = toggleEquipped(sheet, id).sheet;
    expect(equippedCounts(sheet.equipment)).toEqual({ hands: 2, worn: 0 });
    expect(toggleEquipped(sheet, "escudo").error).toMatch(/empunhar 2/);
    for (const id of ["a", "b", "c", "d"]) sheet = toggleEquipped(sheet, id).sheet;
    expect(equippedCounts(sheet.equipment)).toEqual({ hands: 2, worn: 4 });
    expect(toggleEquipped(sheet, "e").error).toMatch(/vestir 4/);
    // guardar libera a vaga
    sheet = toggleEquipped(sheet, "espada").sheet;
    expect(toggleEquipped(sheet, "escudo").error).toBeUndefined();
  });
});

describe("painel do personagem", () => {
  const runtime = (carga: SkinRuntime["carga"]) => ({
    campaign: "Mesa", scene: "Cena", isMaster: true, playerPortrait: "kael",
    focus: { name: "R", subtitle: "x", combatSubtitle: "x", portrait: "kael", hp: 1, hpMax: 1, pm: 1, pmMax: 1, defense: 10 },
    skills: [], spells: [], powers: [], saves: [], attacks: [], hotkeys: [], rolls: [], group: [], initiative: [], mapTokens: [], carga,
    equipment: [{ id: "e1", name: "Espada", label: "Espada", icon: () => null, tone: "#fff", marked: false, equipped: true }],
  }) as unknown as SkinRuntime;
  const html = (carga: SkinRuntime["carga"]) => renderToStaticMarkup(<SkinRuntimeContext.Provider value={runtime(carga)}><SheetPanel links={{}} onAction={() => undefined} /></SkinRuntimeContext.Provider>);

  it("mostra carga atual/máxima, itens em uso e o botão de usar/guardar", () => {
    const out = html({ used: 7, max: 14, overloaded: false, impossible: false, hands: 1, worn: 0, maxHands: 2, maxWorn: 4 });
    expect(out).toContain("7/14");
    expect(out).toContain("Empunhados 1/2");
    expect(out).toContain("Vestidos 0/4");
    expect(out).toContain("data-equip-toggle");
    expect(out).not.toContain("sobrecarregado");
  });

  it("avisa a sobrecarga", () => {
    const out = html({ used: 16, max: 14, overloaded: true, impossible: false, hands: 0, worn: 0, maxHands: 2, maxWorn: 4 });
    expect(out).toContain("sobrecarregado (deslocamento −3 m");
  });
});
