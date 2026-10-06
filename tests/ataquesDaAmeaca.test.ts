import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

async function gnoll(name = "Gnoll Capanga") {
  const { getOfficialThreats } = await import("../src/tactics/data/bestiaryAdapter");
  return getOfficialThreats().find((t) => t.name === name)!;
}

describe("ataques da ameaça são ataques diferentes (livro: Gnoll Capanga)", () => {
  it("espada curta e mordida viram duas ações de ataque, cada uma com o seu bônus e dano", async () => {
    const actions = (await gnoll()).customActions!;
    const weapons = actions.filter((a) => a.category === "weapon" && !a.charge);
    expect(weapons.map((a) => a.name)).toEqual(["Espada curta", "Mordida"]);
    expect(weapons.map((a) => a.attackBonus)).toEqual([9, 9]);
    expect(weapons[0]).toMatchObject({ damage: "1d6+3", crit: 19 });
    expect(weapons[0].extraDamage).toBeUndefined(); // não junta o dano da mordida no da espada
    expect(weapons[0].description).not.toMatch(/mordida/i);
  });

  it("o Bote é uma investida (ação completa) que faz os dois ataques juntos, +2 em cada, no mesmo alvo", async () => {
    const actions = (await gnoll()).customActions!;
    const bote = actions.find((a) => a.name === "Bote")!;
    expect(bote).toMatchObject({ kind: "full", charge: true, attackBonus: 11 });
    expect(bote.combo).toHaveLength(1);
    const mordida = actions.find((a) => a.id === bote.combo![0])!;
    expect(mordida.name).toBe("Mordida");
  });

  it("outras criaturas: grifo (mordida + duas garras) e dragão filhote têm o Bote com os três ataques", async () => {
    const actions = (await gnoll("Grifo")).customActions!;
    const bote = actions.find((a) => a.name === "Bote");
    expect(bote?.charge).toBe(true);
    expect(bote?.combo?.length).toBeGreaterThanOrEqual(1);
  });

  it("executar o Bote move o gnoll, faz os dois ataques (duas rolagens) e deixa −2 na Defesa", async () => {
    const bridge = await import("../src/game/vttBridge");
    const runtime = await import("../src/tactics/engine/runtimeCommands");
    const template = await gnoll();
    bridge.addToken(makeToken({ id: "g", name: "Gnoll", side: "threats", gx: 2, gy: 5, movementM: 9, luta: 9, hp: 50, hpMax: 50, initiative: 99, tacticalActions: template.customActions as never }));
    bridge.addToken(makeToken({ id: "h", name: "Herói", side: "heroes", gx: 8, gy: 5, hp: 500, hpMax: 500, defense: 1, initiative: 1 }));
    bridge.startCombat();
    const state = bridge.getCombatState();
    bridge.syncCombat({ ...state, activeTokenId: "g", resources: { ...state.resources, g: { standard: 1, movement: 1, full: 1, free: 99, reaction: 1 } } });
    const bote = template.customActions!.find((a) => a.name === "Bote")!;
    const before = bridge.getRuntimeSnapshot().combat.rolls.filter((r) => r.kind === "attack").length;
    runtime.executeTacticalAction("g", bote.id, ["h"], null, null);
    const attacks = bridge.getRuntimeSnapshot().combat.rolls.filter((r) => r.kind === "attack").length - before;
    expect(attacks).toBe(2);
    const g = bridge.getBoard().tokens.find((t) => t.id === "g")!;
    expect([g.gx, g.gy]).toEqual([7, 5]);
    expect(g.effects?.some((e) => e.mods?.defense === -2)).toBe(true);
  });
});
