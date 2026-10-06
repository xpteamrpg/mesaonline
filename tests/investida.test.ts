import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const espada = { id: "w1", name: "Espada", category: "weapon", kind: "standard", effect: "damage", target: "enemy", description: "", pmCost: 0, rangeM: 1.5, attackSkill: "luta", damage: "1d8", crit: 20, critMultiplier: 2 };

async function setup(targetX: number, extra: (bridge: typeof import("../src/game/vttBridge")) => void = () => undefined) {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  bridge.addToken(makeToken({ id: "g", name: "Guerreiro", side: "heroes", gx: 2, gy: 5, movementM: 9, luta: 5, hp: 40, hpMax: 40, initiative: 99, tacticalActions: [espada] as never }));
  bridge.addToken(makeToken({ id: "o", name: "Ogro", side: "threats", gx: targetX, gy: 5, hp: 500, hpMax: 500, defense: 5, initiative: 1 }));
  extra(bridge);
  bridge.startCombat();
  const state = bridge.getCombatState();
  bridge.syncCombat({ ...state, activeTokenId: "g", resources: { ...state.resources, g: { standard: 1, movement: 1, full: 1, free: 99, reaction: 1 } } });
  return { bridge, runtime };
}

describe("Investida (Tormenta20 p.235)", () => {
  it("só aparece para ataques corpo a corpo, como ação completa, +2 no ataque", async () => {
    const { actionsForToken } = await import("../src/game/actions");
    const token = makeToken({ id: "g", tacticalActions: [espada, { ...espada, id: "arco", name: "Arco", attackSkill: "pontaria", rangeM: 30 }] as never });
    const charges = actionsForToken(token).filter((a) => a.charge);
    expect(charges.map((a) => a.id)).toEqual(["charge:w1"]);
    expect(charges[0]).toMatchObject({ kind: "full", attackBonus: 2 });
  });

  it("avança em linha reta, termina ao lado do alvo, ataca, gasta a ação completa e fica com −2 na Defesa", async () => {
    const { bridge, runtime } = await setup(8); // 6 quadrados de distância (deslocamento 9 m = 6 quadrados; dobro = 12)
    runtime.executeTacticalAction("g", "charge:w1", ["o"], null, null);
    const g = bridge.getBoard().tokens.find((t) => t.id === "g")!;
    expect([g.gx, g.gy]).toEqual([7, 5]);
    const res = bridge.getCombatState().resources.g;
    expect(res.standard + res.movement + res.full).toBe(0);
    const { targetDefense } = await import("../src/tactics/engine/targeting");
    const ogre = bridge.getBoard().tokens.find((t) => t.id === "o")!;
    expect(targetDefense(bridge.getBoard(), ogre, g)).toBe(g.defense - 2);
  });

  it("recusa quando o alvo está além do dobro do deslocamento", async () => {
    const { runtime } = await setup(20); // 18 quadrados: além de 12
    expect(() => runtime.executeTacticalAction("g", "charge:w1", ["o"], null, null)).toThrow();
  });

  it("recusa quando o terreno difícil corta a linha reta", async () => {
    const { runtime } = await setup(8, (bridge) => { bridge.setTerrain(["4,5", "4,4", "4,6"], "difficult"); });
    expect(() => runtime.executeTacticalAction("g", "charge:w1", ["o"], null, null)).toThrow(/linha reta|terreno difícil/i);
  });
});
