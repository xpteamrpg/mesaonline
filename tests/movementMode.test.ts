import { beforeEach, describe, expect, it, vi } from "vitest";
import { availableMoveModes, effectiveMoveMode, sanitizeMoveMode, speedFor } from "../src/game/movementMode";
import { getOfficialThreats } from "../src/tactics/data/bestiaryAdapter";

const OFFICIAL_THREATS = getOfficialThreats();
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const bird = { name: "Grifo", movementM: 3, flyM: 18, burrowM: 6 };

describe("modos de movimento (regras)", () => {
  it("andar sempre existe; voar e escavar só com deslocamento", () => {
    expect(availableMoveModes({ movementM: 9 })).toEqual(["walk"]);
    expect(availableMoveModes(bird)).toEqual(["walk", "fly", "burrow"]);
    expect(speedFor(bird, "fly")).toBe(18);
    expect(effectiveMoveMode(bird, "burrow")).toBe("burrow");
    expect(effectiveMoveMode({ movementM: 9 }, "fly")).toBe("walk");
    expect(effectiveMoveMode(undefined, "fly")).toBe("walk");
  });

  it("o Mestre recusa modo que o token não tem", () => {
    expect(sanitizeMoveMode(bird, "fly")).toBe("fly");
    expect(sanitizeMoveMode(bird, "qualquer")).toBe("walk");
    expect(() => sanitizeMoveMode({ name: "Anão", movementM: 6 }, "fly")).toThrow(/não voa/);
    expect(() => sanitizeMoveMode({ name: "Anão", movementM: 6 }, "burrow")).toThrow(/não escava/);
  });
});

describe("voo e escavação nos comandos", () => {
  async function setup(overrides = {}) {
    const bridge = await import("../src/game/vttBridge");
    const commands = await import("../src/tactics/engine/runtimeCommands");
    bridge.addToken(makeToken({ id: "grifo", name: "Grifo", gx: 2, gy: 2, movementM: 3, flyM: 18, burrowM: 6, ...overrides }));
    return { bridge, commands };
  }

  it("na exploração o movimento é livre (andando ou voando); no combate o deslocamento limita", async () => {
    const { bridge, commands } = await setup();
    commands.executeExplorationMove("grifo", 10, 2, "walk"); // exploração: sem limite de distância
    expect(bridge.getBoard().tokens.find((token) => token.id === "grifo")?.gx).toBe(10);
    commands.executeExplorationMove("grifo", 2, 2, "fly");
    expect(bridge.getBoard().tokens.find((token) => token.id === "grifo")?.gx).toBe(2);
    bridge.startCombat();
    expect(() => commands.executeTacticalMove("grifo", 10, 2, "walk")).toThrow(/deslocamento/);
  });

  it("voar ignora terreno bloqueado e baú fechado; andar não", async () => {
    const { bridge, commands } = await setup({ movementM: 9 });
    bridge.setTerrain(["4,2"], "blocked");
    bridge.setObjects([{ id: "bau", kind: "chest", name: "Baú", x: 3, y: 2, opened: false, locked: false, contents: [] }]);
    const { reachableCells } = await import("../src/tactics/engine/movement");
    const token = bridge.getBoard().tokens.find((entry) => entry.id === "grifo")!;
    expect(reachableCells(bridge.getBoard(), token, { mode: "walk" }).has("4,2")).toBe(false);
    expect(reachableCells(bridge.getBoard(), token, { mode: "fly" }).has("4,2")).toBe(true);
    expect(() => commands.executeExplorationMove("grifo", 4, 2, "fly")).not.toThrow();
  });

  it("escavar passa por baixo de parede; pedir um modo que o token não tem é erro", async () => {
    const { bridge, commands } = await setup();
    bridge.upsertWall({ id: "muro", type: "wall", x1: 3, y1: 0, x2: 3, y2: 8 });
    const { reachableCells } = await import("../src/tactics/engine/movement");
    const token = bridge.getBoard().tokens.find((entry) => entry.id === "grifo")!;
    expect(reachableCells(bridge.getBoard(), token, { mode: "burrow" }).has("4,2")).toBe(true);
    bridge.updateToken("grifo", { burrowM: 0 });
    expect(() => commands.executeExplorationMove("grifo", 4, 2, "burrow")).toThrow(/não escava/);
  });
});

describe("bestiário: escavação chega ao token", () => {
  it("ameaças com \"escavação\" no deslocamento têm burrowM e as com \"voo\" têm flyM", () => {
    const burrowers = OFFICIAL_THREATS.filter((threat) => threat.burrowM);
    expect(burrowers.length).toBeGreaterThanOrEqual(8);
    expect(OFFICIAL_THREATS.filter((threat) => threat.flyM).length).toBeGreaterThan(80);
  });
});
