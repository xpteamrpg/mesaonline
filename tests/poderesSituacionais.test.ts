import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSheet, makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const arma = (name: string) => ({ id: "w1", name, category: "weapon", kind: "standard", effect: "damage", target: "enemy", description: "", pmCost: 0, rangeM: 1.5, attackSkill: "luta", damage: "1d4", crit: 20, critMultiplier: 2, damageType: "corte" });

/** Ataca `name` com `power` na ficha e devolve o modificador de ataque da rolagem e a fórmula de dano. */
async function attack(power: string, weapon: string, targetConditions: string[], target: Partial<Parameters<typeof makeToken>[0]> = {}, level = 5) {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const { upsertCharacterSheet } = await import("../ficha-modernrpg/characterRoute");
  const sheet = makeSheet({
    id: "heroi-1", level, powers: power ? [{ id: "p", name: power, type: "classe", description: "" }] : [],
    attacks: [{ id: "attack-1", name: weapon, skill: "Luta", bonus: 2, damage: "1d4", critical: "20/x2", damageType: "Corte" }],
  });
  upsertCharacterSheet(sheet);
  const { actionsForCharacter } = await import("../src/tactics/interpretation/characterActionAdapter");
  const actionId = actionsForCharacter(sheet).find((a) => a.category === "weapon" && !a.charge)!.id;
  bridge.addToken(makeToken({ id: "g", name: "Guerreiro", side: "heroes", modernRpgCharacterId: "heroi-1", gx: 2, gy: 5, luta: 5, hp: 40, hpMax: 40, initiative: 99 }));
  bridge.addToken(makeToken({ id: "o", name: "Ogro", side: "threats", gx: 3, gy: 5, hp: 500, hpMax: 500, defense: 1, initiative: 1, conditions: targetConditions, ...target }));
  bridge.startCombat();
  const state = bridge.getCombatState();
  bridge.syncCombat({ ...state, activeTokenId: "g", resources: { ...state.resources, g: { standard: 1, movement: 1, full: 1, free: 99, reaction: 1 } } });
  runtime.executeTacticalAction("g", actionId, ["o"], null, null);
  const rolls = bridge.getCombatState().rolls;
  const atk = rolls.find((r) => r.kind === "attack")!;
  const dmg = rolls.find((r) => r.kind === "damage");
  return { modifier: atk.modifier, damageFormula: dmg?.formula || "" };
}

describe("poderes situacionais", () => {
  it("Valentão: +2 no ataque contra alvo Caído, nada contra alvo em pé", async () => {
    const base = await attack("", "Espada", ["Caído"]);
    vi.resetModules(); localStorage.clear();
    const caido = await attack("Valentão", "Espada", ["Caído"]);
    vi.resetModules(); localStorage.clear();
    const emPe = await attack("Valentão", "Espada", []);
    expect(caido.modifier - base.modifier).toBe(2);
    expect(emPe.modifier).toBe(base.modifier);
  });

  it("Valentão vale contra Desprevenido e Indefeso (que implica Desprevenido)", async () => {
    const base = await attack("", "Espada", []);
    vi.resetModules(); localStorage.clear();
    const indefeso = await attack("Valentão", "Espada", ["Indefeso"]);
    expect(indefeso.modifier - base.modifier).toBe(2);
  });

  it("Executor: +1d6 só abaixo da metade dos PV do alvo (d8 a partir do 5º nível)", async () => {
    const { upsertCharacterSheet } = await import("../ficha-modernrpg/characterRoute");
    const { situationalPowerBonus } = await import("../src/game/situationalPowers");
    const bridge = await import("../src/game/vttBridge");
    upsertCharacterSheet(makeSheet({ id: "heroi-1", level: 3, powers: [{ id: "p", name: "Executor", type: "classe", description: "" }] }));
    const actor = makeToken({ id: "g", side: "heroes", modernRpgCharacterId: "heroi-1", gx: 2, gy: 5 });
    const full = makeToken({ id: "o", side: "threats", gx: 3, gy: 5, hp: 100, hpMax: 100 });
    const hurt = makeToken({ id: "o2", side: "threats", gx: 3, gy: 5, hp: 49, hpMax: 100 });
    const action = arma("Espada") as never;
    const board = bridge.getBoard();
    expect(situationalPowerBonus(actor, full, action, board).extraDice).toEqual([]);
    expect(situationalPowerBonus(actor, hurt, action, board).extraDice).toEqual(["1d6"]);
  });

  it("Lanceiro: só com lança, e não com lança montada", async () => {
    const base = await attack("", "Lança", []);
    vi.resetModules(); localStorage.clear();
    const lanca = await attack("Lanceiro", "Lança", []);
    vi.resetModules(); localStorage.clear();
    const montada = await attack("Lanceiro", "Lança montada", []);
    vi.resetModules(); localStorage.clear();
    const espada = await attack("Lanceiro", "Espada", []);
    expect(lanca.modifier - base.modifier).toBe(2);
    expect(montada.modifier).toBe(base.modifier);
    expect(espada.modifier).toBe(base.modifier);
  });
});
