import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe("sistemas de jogo", () => {
  it("lista Tormenta 20, D&D e Old Dragon; só Tormenta 20 está disponível", async () => {
    const { GAME_SYSTEMS, isAvailableSystem } = await import("../src/game/systems");
    expect(GAME_SYSTEMS.map((s) => s.name)).toEqual(["Tormenta 20", "D&D", "Old Dragon"]);
    expect(GAME_SYSTEMS.filter((s) => s.available).map((s) => s.id)).toEqual(["t20"]);
    expect(isAvailableSystem("dnd")).toBe(false);
  });
  it("a preferência começa em Tormenta 20 e ignora sistema indisponível gravado", async () => {
    localStorage.setItem("mesa-preferences-v1", JSON.stringify({ gameSystem: "dnd" }));
    const { getPreferences } = await import("../src/game/mesaPreferences");
    expect(getPreferences().gameSystem).toBe("t20");
  });
});
