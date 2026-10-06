import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe("ferimentos e morte (Tormenta20 p.236)", () => {
  it("limite de morte: −10 ou −metade dos PV totais, o que for mais baixo (12 PV → −10; 30 PV → −15)", async () => {
    const { deathLimit, isDead } = await import("../src/game/death");
    expect(deathLimit(12)).toBe(10);
    expect(deathLimit(30)).toBe(15);
    expect(isDead(-9, 12)).toBe(false);
    expect(isDead(-10, 12)).toBe(true);
    expect(isDead(-14, 30)).toBe(false);
    expect(isDead(-15, 30)).toBe(true);
  });

  it("a 0 PV cai inconsciente e sangrando; PV ficam negativos até a morte; voltar a ter PV recobra a consciência", async () => {
    const bridge = await import("../src/game/vttBridge");
    bridge.addToken(makeToken({ id: "h", name: "Herói", side: "heroes", gx: 2, gy: 2, hp: 12, hpMax: 12 }));
    const get = () => bridge.getBoard().tokens.find((t) => t.id === "h")!;
    bridge.updateToken("h", { hp: get().hp - 12 });
    expect(get()).toMatchObject({ hp: 0, defeated: true });
    expect(get().dead).toBeFalsy();
    expect(get().conditions).toEqual(expect.arrayContaining(["Inconsciente", "Sangrando"]));
    bridge.updateToken("h", { hp: -9 });
    expect(get().hp).toBe(-9);
    expect(get().dead).toBe(false);
    bridge.updateToken("h", { hp: -10 });
    expect(get().dead).toBe(true);
    bridge.updateToken("h", { hp: 3 }); // cura (efeito de ressurreição do teste) — quem voltou a ter PV acorda
    expect(get().conditions).not.toContain("Inconsciente");
    expect(get().conditions).not.toContain("Sangrando");
  });

  it("quem está a 0 PV continua na ordem, sangra no turno dele e o turno passa sozinho; quem morreu sai da ordem", async () => {
    const bridge = await import("../src/game/vttBridge");
    await import("../src/tactics/engine/conditionTicks");
    bridge.addToken(makeToken({ id: "a", name: "Caído", side: "heroes", gx: 1, gy: 1, hp: 12, hpMax: 12, initiative: 50 }));
    bridge.addToken(makeToken({ id: "b", name: "Em pé", side: "heroes", gx: 2, gy: 1, hp: 20, hpMax: 20, initiative: 10 }));
    bridge.startCombat();
    bridge.updateToken("a", { hp: 0 });
    const state = bridge.getCombatState();
    expect(state.order).toEqual(expect.arrayContaining(["a", "b"]));
    bridge.syncCombat({ ...state, activeTokenId: "b" });
    bridge.endTurn(); // vai para o "a" (0 PV): sangra e passa
    await Promise.resolve();
    await Promise.resolve();
    expect(bridge.getCombatState().activeTokenId).toBe("b");
    const snap = bridge.getRuntimeSnapshot();
    expect(JSON.stringify(snap.combat.rolls) + JSON.stringify(snap.combat.log)).toMatch(/Sangrando/);
    bridge.updateToken("a", { hp: -10 });
    bridge.endTurn();
    expect(bridge.getCombatState().order).not.toContain("a");
  });
});
