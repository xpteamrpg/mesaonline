import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe("largar item no chão", () => {
  it("vira objeto 'item' com nome e descrição, na casa pedida ou ao lado, e conta no Diário", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { executeDropItem } = await import("../src/tactics/engine/objectCommands");
    bridge.addToken(makeToken({ id: "h1", name: "Aro", side: "heroes", gx: 4, gy: 4 }));
    executeDropItem("h1", { name: "Corda de cânhamo", description: "10 m de corda", quantity: 1 });
    executeDropItem("h1", { name: "Poção de cura", quantity: 2 }, { x: 6, y: 4 });
    const objects = bridge.getRuntimeSnapshot().board.objects;
    expect(objects).toHaveLength(2);
    expect(objects[0]).toMatchObject({ kind: "item", name: "Corda de cânhamo", description: "10 m de corda", contents: ["Corda de cânhamo"], opened: false });
    expect(Math.abs(objects[0].x - 4) + Math.abs(objects[0].y - 4)).toBeLessThanOrEqual(2);
    expect(objects[1]).toMatchObject({ name: "Poção de cura", x: 6, y: 4, contents: ["Poção de cura x2"] });
    expect(bridge.getRuntimeSnapshot().board.chat.some((entry) => /Largou .*Corda de cânhamo/.test(entry.text))).toBe(true);
  });

  it("recusa casa fora do mapa e personagem caído", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { executeDropItem } = await import("../src/tactics/engine/objectCommands");
    bridge.addToken(makeToken({ id: "h1", name: "Aro", side: "heroes", gx: 1, gy: 1 }));
    expect(() => executeDropItem("h1", { name: "Adaga" }, { x: 999, y: 1 })).toThrow(/fora do mapa/);
    bridge.updateToken("h1", { hp: 0, defeated: true });
    expect(() => executeDropItem("h1", { name: "Adaga" })).toThrow(/não pode agir/);
  });
});

describe("pegar item do chão", () => {
  it("pegou tudo: o item some do mapa e vai para o que o personagem pegou", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { executeDropItem, executeObjectAction } = await import("../src/tactics/engine/objectCommands");
    bridge.addToken(makeToken({ id: "h1", name: "Aro", side: "heroes", gx: 4, gy: 4 }));
    executeDropItem("h1", { name: "Tomo da Harmonia", quantity: 1 });
    const object = bridge.getRuntimeSnapshot().board.objects[0];
    executeObjectAction("h1", object.id, "open");
    executeObjectAction("h1", object.id, "take");
    expect(bridge.getRuntimeSnapshot().board.objects).toHaveLength(0);
    expect(bridge.getRuntimeSnapshot().board.tokens.find((t) => t.id === "h1")!.pendingLoot).toEqual(["Tomo da Harmonia"]);
  });
});
