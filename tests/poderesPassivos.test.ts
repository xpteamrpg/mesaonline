import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Poderes de classe passivos (sem condição no texto do catálogo) viram efeitos "poder:" no token da ficha e entram nas contas:
 * Defesa, deslocamento, perícia, resistência, RD e CD das magias.
 */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

async function tokenWith(entries: { name: string; level?: number; equip?: { name: string; category: "Armadura"; defenseBonus: number }[]; con?: number }[]) {
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { effectBonus } = await import("../src/tactics/engine/effectBonuses");
  const { saveModifier } = await import("../src/tactics/engine/saves");
  const base = loadReadyHeroSheets()[0];
  const first = entries[0];
  const sheet = {
    ...base,
    level: first.level ?? 3,
    attributes: { ...base.attributes, con: { ...base.attributes.con, value: first.con ?? 2 } },
    equipment: (first.equip || []).map((item, index) => ({ id: `e${index}`, equipped: true, quantity: 1, slots: 1, price: 0, description: "", ...item })),
    powers: entries.map((entry, index) => ({ id: `p${index}`, name: entry.name, type: "classe", description: "" })),
    racialAbilities: [],
    classAbilities: [],
  } as typeof base;
  const token = boardTokenFromCharacter(sheet, { x: 1, y: 1 });
  return { token, sheet, effectBonus, saveModifier };
}

describe("poderes passivos aplicados", () => {
  it("Instinto Selvagem: +1 dano, Percepção e Reflexos (só Reflexos entre as resistências)", async () => {
    const { token, effectBonus, saveModifier } = await tokenWith([{ name: "Instinto Selvagem" }]);
    expect(effectBonus(token, "damage")).toBe(1);
    expect(effectBonus(token, "skills", "per")).toBe(1);
    expect(effectBonus(token, "skills", "atl")).toBe(0);
    expect(saveModifier(token, "reflexes")).toBe(token.reflexes + 1);
    expect(saveModifier(token, "fortitude")).toBe(token.fortitude);
  });

  it("deslocamento +3 m e RD da Resiliência Primal (nível 5 = RD 3)", async () => {
    const a = await tokenWith([{ name: "Fúria da Savana" }]);
    expect(a.effectBonus(a.token, "speed")).toBe(3);
    const b = await tokenWith([{ name: "Resiliência Primal", level: 5 }]);
    expect(b.effectBonus(b.token, "rd")).toBe(3);
    const c = await tokenWith([{ name: "Resiliência Primal", level: 4 }]);
    expect(c.effectBonus(c.token, "rd")).toBe(0);
  });

  it("Pele de Ferro: +4 na Defesa, menos com armadura pesada; Casca Grossa soma Constituição até o nível", async () => {
    const livre = await tokenWith([{ name: "Pele de Ferro" }]);
    expect(livre.effectBonus(livre.token, "defense")).toBe(4);
    const pesada = await tokenWith([{ name: "Pele de Ferro", equip: [{ name: "Brunea", category: "Armadura", defenseBonus: 5 }] }]);
    expect(pesada.effectBonus(pesada.token, "defense")).toBe(0);
    const casca = await tokenWith([{ name: "Casca Grossa", level: 3, con: 4 }]);
    expect(casca.effectBonus(casca.token, "defense")).toBe(3);
  });

  it("aceita o nome com marcação de importação e não duplica", async () => {
    const { token, effectBonus } = await tokenWith([{ name: "Poder de Classe: Pernas do Mar (bucaneiro)" }, { name: "Pernas do Mar" }]);
    expect(effectBonus(token, "skills", "acr")).toBe(2);
    expect(effectBonus(token, "skills", "atl")).toBe(2);
  });

  it("Fortalecimento Arcano soma na CD das magias", async () => {
    const sem = await tokenWith([{ name: "Magias", level: 5 }]);
    const com = await tokenWith([{ name: "Fortalecimento Arcano", level: 5 }]);
    expect(com.token.spellDC).toBe(sem.token.spellDC + 1);
  });

  it("atualizar o token pela ficha recalcula os poderes e mantém os ajustes do Mestre", async () => {
    const { token, sheet } = await tokenWith([{ name: "Gatuno" }]);
    const { withPassivePowers } = await import("../src/game/powerEffects");
    const mestre = { id: "mestre:def", name: "Mestre", kind: "long" as const, mods: { defense: 1 } };
    const merged = withPassivePowers([mestre, ...(token.effects || [])], sheet) || [];
    expect(merged.filter((e) => e.id.startsWith("poder:"))).toHaveLength(1);
    expect(merged.some((e) => e.id === "mestre:def")).toBe(true);
  });
});
