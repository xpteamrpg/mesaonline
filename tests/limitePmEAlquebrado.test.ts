import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

async function sheetBase() {
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  return structuredClone(loadReadyHeroSheets()[1]);
}

describe("limite de PM por magia (p.224, p.171)", () => {
  it("Magia Ilimitada soma o atributo-chave; Canalizador (+1) e Potencializador (+2) só valem equipados", async () => {
    const { pmLimitBonusOf } = await import("../src/tactics/interpretation/castContext");
    const sheet = await sheetBase();
    sheet.class = "Arcanista";
    sheet.attributes.int.value = 4;
    sheet.powers = [];
    sheet.equipment = [];
    expect(pmLimitBonusOf(sheet)).toBe(0);
    sheet.powers = [{ id: "mi", name: "Magia Ilimitada", type: "Magia", description: "" }];
    expect(pmLimitBonusOf(sheet)).toBe(4);
    sheet.equipment = [
      { id: "e1", name: "Cajado arcano", equipped: true, quantity: 1, slots: 1, price: 0, description: "", category: "Item Geral", modifications: ["Canalizador", "Potencializador"] },
      { id: "e2", name: "Bolsa de pó", equipped: false, quantity: 1, slots: 1, price: 0, description: "", category: "Item Geral", modifications: ["Canalizador"] },
    ];
    expect(pmLimitBonusOf(sheet)).toBe(4 + 1 + 2);
  });

  it("o plano de conjuração usa nível + bônus como limite e a mensagem diz de onde veio", async () => {
    const { buildCastInfo, computeCastPlan, findSpellEntry } = await import("../src/tactics/interpretation/spellCasting");
    const entry = findSpellEntry({ name: "Bola de Fogo", category: "spell" })!;
    const action = { id: "a", source: "character", category: "spell", name: "Bola de Fogo", pmCost: entry.custo, kind: "standard" } as never;
    const augment = (entry.aprimoramentos ?? []) ? undefined : undefined; void augment;
    const info = buildCastInfo({ action, entry, level: 5, currentPm: 99, candidates: [], pmLimitBonus: 0 });
    const infoBonus = buildCastInfo({ action, entry, level: 5, currentPm: 99, candidates: [], pmLimitBonus: 3 });
    const idx = info.entry.aprimoramentos?.findIndex((a) => a.tipo === "aumenta") ?? -1;
    expect(idx).toBeGreaterThanOrEqual(0);
    const opt = info.entry.aprimoramentos![idx];
    // gasta até passar o limite de 5 sem bônus
    const times = Math.floor((5 - info.baseCost) / opt.custo) + 1;
    expect(computeCastPlan(info, { counts: { [idx]: times } }).error).toMatch(/Limite de PM em uma magia: 5/);
    expect(computeCastPlan(infoBonus, { counts: { [idx]: times } }).error).not.toMatch(/Limite de PM/);
  });
});

describe("Alquebrado (+1 PM em todo custo, p.394)", () => {
  it("o custo em PM sobe 1 quando o personagem está Alquebrado e não sobe se o custo é 0", async () => {
    const { pmSurcharge } = await import("../src/tactics/engine/pmCost");
    expect(pmSurcharge({ conditions: ["Alquebrado"] }, 3)).toBe(1);
    expect(pmSurcharge({ conditions: ["Alquebrado"] }, 0)).toBe(0);
    expect(pmSurcharge({ conditions: [] }, 3)).toBe(0);
  });
  it("ao agir, o PM debitado inclui o +1 e recusa se faltar PM por causa dele", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { resolveTacticalAction } = await import("../src/tactics/engine/combat");
    bridge.addToken(makeToken({ id: "m", name: "Mago", side: "heroes", gx: 4, gy: 4, pm: 3, pmMax: 10, conditions: ["Alquebrado"], initiative: 99 }));
    bridge.addToken(makeToken({ id: "o", name: "Alvo", side: "threats", gx: 5, gy: 4, hp: 500, hpMax: 500, initiative: 1 }));
    bridge.startCombat();
    const state = bridge.getCombatState();
    bridge.syncCombat({ ...state, activeTokenId: "m", resources: { ...state.resources, m: { standard: 1, movement: 1, full: 1, free: 99, reaction: 1 } } });
    const action = { id: "x", source: "character", category: "spell", name: "Teste", pmCost: 3, kind: "standard", target: "enemy", rangeM: 9, autoHit: true, damage: "1d4" } as never;
    expect(() => resolveTacticalAction("m", action, ["o"])).toThrow(/Alquebrado/); // 3 PM não bastam para custo 3 + 1
    bridge.updateToken("m", { pm: 4 });
    resolveTacticalAction("m", action, ["o"]);
    expect(bridge.getBoard().tokens.find((t) => t.id === "m")!.pm).toBe(0);
  });
});
