import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

/** Token colocado com o combate em andamento: rola iniciativa na hora, entra na ordem e na lista, e pode ser selecionado e agir (sem reiniciar o combate). */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe("token novo durante o combate", () => {
  it("entra na iniciativa sem reiniciar o combate", async () => {
    const bridge = await import("../src/game/vttBridge");
    bridge.addToken(makeToken({ id: "h1", name: "Herói", side: "heroes", gx: 2, gy: 2, initiative: 5 }));
    bridge.addToken(makeToken({ id: "a1", name: "Ameaça", side: "threats", gx: 6, gy: 2, initiative: 1 }));
    bridge.startCombat();
    const before = bridge.getCombatState();
    bridge.addToken(makeToken({ id: "n1", name: "Novo", side: "threats", gx: 7, gy: 3, initiative: 3 }));
    const after = bridge.getCombatState();
    expect(after.active).toBe(true);
    expect(after.round).toBe(before.round);
    expect(after.activeTokenId).toBe(before.activeTokenId);
    expect(after.order).toHaveLength(3);
    expect(after.order).toContain("n1");
    expect(after.combatants.find((c) => c.tokenId === "n1")!.initiative).toBeGreaterThanOrEqual(4);
    expect(after.resources.n1).toBeDefined();
    expect(bridge.getBoard().tokens.find((t) => t.id === "n1")!.initiativeRoll).toBe(after.combatants.find((c) => c.tokenId === "n1")!.initiative);
    expect(after.rolls.some((r) => r.actor === "Novo" && r.action === "Iniciativa")).toBe(true);
  });

  it("fora do combate, token novo não rola iniciativa; token escondido não entra", async () => {
    const bridge = await import("../src/game/vttBridge");
    bridge.addToken(makeToken({ id: "x", name: "X", side: "heroes", gx: 1, gy: 1 }));
    expect(bridge.getCombatState().combatants).toHaveLength(0);
    bridge.addToken(makeToken({ id: "y", name: "Y", side: "heroes", gx: 2, gy: 1 }));
    bridge.startCombat();
    bridge.addToken(makeToken({ id: "oculto", name: "Oculto", side: "threats", gx: 3, gy: 1, hidden: true }));
    expect(bridge.getCombatState().order).not.toContain("oculto");
  });
});
