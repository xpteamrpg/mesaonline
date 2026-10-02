import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

/** Ajustes manuais do Mestre sobre um personagem (editor do Elenco): deslocamento, Defesa, ataque, dano, resistência, perícia, dano extra e itens. */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

async function setup() {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const master = await import("../src/components/mesa/MasterAdjustments");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const sheet = loadReadyHeroSheets()[1];
  const hero = { ...boardTokenFromCharacter(sheet, { x: 5, y: 5 }), initiative: 99, pm: 99, pmMax: 99 };
  bridge.addToken(hero);
  bridge.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 5000, hpMax: 5000, defense: 1, initiative: -50 }));
  const current = () => bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
  return { bridge, runtime, master, hero, current };
}

describe("ajustes do Mestre", () => {
  it("deslocamento +9 m: o token anda mais no combate e o ajuste sobrevive ao início do combate; remover desfaz", async () => {
    const { bridge, master, hero, current } = await setup();
    const { reachableCells } = await import("../src/tactics/engine/movement");
    const { effectBonus } = await import("../src/tactics/engine/effectBonuses");
    const before = reachableCells(bridge.getBoard(), current()).size;
    master.addAdjustment(current(), { mods: { speed: 9 } }, "Primor Atlético");
    expect(effectBonus(current(), "speed")).toBe(9);
    bridge.startCombat();
    expect(effectBonus(current(), "speed")).toBe(9); // não some ao começar o combate
    expect(reachableCells(bridge.getBoard(), current()).size).toBeGreaterThan(before);
    const id = current().effects!.find(master.isMasterEffect)!.id;
    bridge.updateToken(hero.id, { effects: current().effects!.filter((e) => e.id !== id) });
    expect(effectBonus(current(), "speed")).toBe(0);
  });

  it("Defesa, resistência e perícia (geral ou de uma só)", async () => {
    const { master, current } = await setup();
    const { effectBonus } = await import("../src/tactics/engine/effectBonuses");
    const { saveModifier } = await import("../src/tactics/engine/saves");
    const defBefore = current().defense;
    const willBefore = saveModifier(current(), "will");
    master.addAdjustment(current(), { mods: { saves: 2 } }, "x");
    master.addAdjustment(current(), { mods: { skills: 3 }, skillId: "atle" }, "y");
    master.addAdjustment(current(), { mods: { skills: -1 } }, "z");
    expect(saveModifier(current(), "will")).toBe(willBefore + 2);
    expect(effectBonus(current(), "skills", "atle")).toBe(2); // +3 só em Atletismo, −1 em todas
    expect(effectBonus(current(), "skills", "furt")).toBe(-1);
    // Defesa: o atacante precisa vencer o valor com o ajuste
    const { targetDefense } = await import("../src/tactics/engine/targeting");
    const bridge = await import("../src/game/vttBridge");
    const foe = bridge.getBoard().tokens.find((t) => t.id === "alvo")!;
    const base = targetDefense(bridge.getBoard(), foe, current());
    master.addAdjustment(current(), { mods: { defense: 4 } }, "d");
    expect(targetDefense(bridge.getBoard(), foe, current())).toBe(base + 4);
    expect(defBefore).toBeGreaterThan(0);
  });

  it("bônus de ataque e dano valem só na arma escolhida e o dano extra de fogo entra no dano", async () => {
    const { bridge, runtime, master, hero, current } = await setup();
    const attack = (hero.tacticalActions ?? []).find((a) => a.category === "weapon" && a.attackSkill && (a.rangeM ?? 0) >= 1.5 && !a.pmCost)!;
    master.addAdjustment(current(), { mods: { attack: 2 }, weaponId: attack.id }, "a");
    master.addAdjustment(current(), { weaponId: attack.id, extraDamage: { formula: "1d6", type: "Fogo" } }, "b");
    expect(master.describeAdjustment(current().effects![0], () => attack.name)).toContain(`Ataque +2 · ${attack.name}`);
    expect(master.describeAdjustment(current().effects![1], () => attack.name)).toContain("Dano extra 1d6 de Fogo");
    bridge.startCombat();
    for (let n = 0; n < 20; n += 1) {
      const state = bridge.getCombatState();
      bridge.syncCombat({ ...state, activeTokenId: hero.id, resources: { ...state.resources, [hero.id]: { standard: 1, movement: 1, full: 1, free: 1, reaction: 1 } } });
      runtime.executeTacticalAction(hero.id, attack.id, ["alvo"], null, null);
      const roll = bridge.getCombatState().rolls.find((r) => r.kind === "attack" && r.action === attack.name)!;
      expect(roll.modifier).toBe(hero[attack.attackSkill!] + (attack.attackBonus || 0) + 2);
      const dmg = bridge.getCombatState().rolls.find((r) => r.kind === "damage" && r.action === attack.name);
      if (dmg) {
        const base = (attack.damage || "").match(/(\d+)d\d+/);
        expect(dmg.rolls.length).toBeGreaterThanOrEqual((base ? Number(base[1]) : 0) + 1);
        return;
      }
    }
    throw new Error("nenhum ataque acertou");
  });

  it("dar e tirar item da mochila muda a ficha (herói pronto fica salvo no navegador)", async () => {
    const { getCharacterSheetById, upsertCharacterSheet } = await import("../ficha-modernrpg/characterRoute");
    const { hero } = await setup();
    const sheet = getCharacterSheetById(hero.modernRpgCharacterId!)!;
    const n = sheet.equipment.length;
    upsertCharacterSheet({ ...sheet, equipment: [...sheet.equipment, { id: "eq-x", equipped: false, name: "Poção da Mestre", quantity: 1, slots: 0.5, price: null, description: "", category: "Item Geral" } as never] });
    expect(getCharacterSheetById(hero.modernRpgCharacterId!)!.equipment).toHaveLength(n + 1);
    upsertCharacterSheet({ ...getCharacterSheetById(hero.modernRpgCharacterId!)!, equipment: sheet.equipment });
    expect(getCharacterSheetById(hero.modernRpgCharacterId!)!.equipment).toHaveLength(n);
  });
});
