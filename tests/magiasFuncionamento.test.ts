import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

/**
 * Funcionamento das magias dos heróis do playtest (regras: Tormenta 20, cap. 4 e 5; texto de cada magia no catálogo magias.json):
 * aprimoramentos que mudam a ação, cura em vários alvos com dados rolados por alvo, Arma Mágica presa a uma arma,
 * Instante Estoico (RD do próximo dano), Amedrontar (Vontade parcial) e acúmulo de efeitos de magia.
 */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const RENARD = 0, ASTOLFO = 1, LAGRIMA = 3;

async function setup(index: number, extra: (bridge: typeof import("../src/game/vttBridge")) => void = () => undefined) {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const casting = await import("../src/tactics/interpretation/spellCasting");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const sheet = loadReadyHeroSheets()[index];
  const hero = { ...boardTokenFromCharacter(sheet, { x: 5, y: 5 }), initiative: 99, pm: 99, pmMax: 99, level: 10 };
  bridge.addToken(hero);
  extra(bridge);
  bridge.startCombat();
  const action = (name: string) => (hero.tacticalActions ?? []).find((a) => a.name === name)!;
  /** índice do aprimoramento do catálogo que tem a propriedade pedida */
  const augmentIndex = (spellName: string, pick: (a: ReturnType<typeof casting.normalizeAugments>[number]) => unknown) => {
    const entry = casting.findSpellEntry({ name: spellName, category: "spell" })!;
    return casting.normalizeAugments(entry).findIndex(pick);
  };
  return { bridge, runtime, hero, action, augmentIndex };
}

describe("regras gerais de leitura", () => {
  it("duração e distância não viram dano ('1d4 rodadas', '1d4 dias', '2d6 metros')", async () => {
    const { formulasIn, spellDiceFormula } = await import("../src/tactics/interpretation/modernRpgRules");
    expect(formulasIn("fica abalado por 1d4 rodadas")).toEqual([]);
    expect(formulasIn("dura 1d4 dias, alcança 2d6 metros, causa 6d6 pontos de dano")).toEqual(["6d6"]);
    // o campo `effect` gravado errado pelo importador antigo ("1d4" de "1d4 rodadas") é ignorado
    expect(spellDiceFormula({ effect: "1d4", description: "Se passar, fica abalado por 1d4 rodadas.\n\nAprimoramentos: +2 PM: +1d6." })).toBeUndefined();
    expect(spellDiceFormula({ effect: "2d8+2", description: "recupera 2d8+2 pontos de vida" })).toBe("2d8+2");
  });

  it("rola fórmulas com vários termos", async () => {
    const { rollFormula } = await import("../src/tactics/engine/spellEffects");
    for (let n = 0; n < 50; n += 1) {
      const r = rollFormula("2d8+2+1d8+1");
      expect(r.rolls).toHaveLength(3);
      expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0) + 3);
    }
    expect(rollFormula("1d6", 2).rolls).toHaveLength(2);
  });

  it("efeitos de magia não acumulam entre si, só com outras fontes", async () => {
    const { effectBonus } = await import("../src/tactics/engine/effectBonuses");
    const spell = (id: string, attack: number) => ({ id, name: id, sourceId: `spell:${id}`, kind: "scene" as const, mods: { attack } });
    expect(effectBonus({ effects: [spell("bencao", 1), spell("arma-magica", 1)] }, "attack")).toBe(1);
    expect(effectBonus({ effects: [spell("bencao", 1), spell("percepcao-rubra", 2)] }, "attack")).toBe(2);
    expect(effectBonus({ effects: [spell("bencao", 1), { id: "item", name: "item", kind: "scene" as const, mods: { attack: 2 } }] }, "attack")).toBe(3);
    expect(effectBonus({ effects: [spell("perdicao", -1), spell("bencao", 1)] }, "attack")).toBe(0);
  });
});

describe("rótulos das magias da ficha", () => {
  it("Arma Mágica, Instante Estoico e Amedrontar não aparecem como magias de dano", async () => {
    for (const [index, name] of [[LAGRIMA, "Arma Mágica"], [LAGRIMA, "Instante Estoico"], [ASTOLFO, "Amedrontar"]] as const) {
      vi.resetModules(); localStorage.clear();
      const { action } = await setup(index);
      expect(action(name).damage, name).toBeUndefined();
      expect(action(name).effect, name).not.toBe("damage");
    }
  });
});

describe("Curar Ferimentos", () => {
  it("com os aprimoramentos cura vários alvos, soma os dados e rola a cura de cada um à parte", async () => {
    const { bridge, runtime, hero, action, augmentIndex } = await setup(LAGRIMA, (b) => {
      for (const id of ["a1", "a2", "a3"]) b.addToken(makeToken({ id, name: id, side: "heroes", gx: 4, gy: id === "a1" ? 5 : id === "a2" ? 4 : 6, hp: 1, hpMax: 80, initiative: -10 }));
    });
    const heal = augmentIndex("Curar Ferimentos", (a) => Boolean(a.addHealing));
    const all = augmentIndex("Curar Ferimentos", (a) => Boolean(a.todosOsAlvos));
    expect(heal).toBeGreaterThanOrEqual(0);
    expect(all).toBeGreaterThanOrEqual(0);
    const before = bridge.getBoard().tokens.find((t) => t.id === hero.id)!.pm;
    runtime.executeTacticalAction(hero.id, action("Curar Ferimentos").id, ["a1", "a2", "a3"], null, { counts: { [heal]: 2, [all]: 1 }, racial: false });
    const board = bridge.getBoard();
    // 1 PM da magia + 2 x 1 PM (+1d8+1 duas vezes) + 5 PM (vários alvos, alcance curto)
    expect(before - board.tokens.find((t) => t.id === hero.id)!.pm).toBe(1 + 2 + 5);
    const heals = bridge.getCombatState().rolls.filter((r) => r.kind === "heal");
    expect(heals).toHaveLength(3);
    for (const roll of heals) {
      expect(roll.rolls).toHaveLength(4); // 2d8 + 1d8 + 1d8
      expect(roll.total).toBe(roll.rolls.reduce((a, b) => a + b, 0) + 4); // +2 +1 +1
    }
    for (const id of ["a1", "a2", "a3"]) expect(board.tokens.find((t) => t.id === id)!.hp).toBeGreaterThan(1);
    // cada alvo recebeu o resultado do seu próprio dado
    expect(heals.map((r) => r.target).sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("sem o aprimoramento só aceita um alvo (alvo: 1 criatura)", async () => {
    const { bridge, runtime, hero, action } = await setup(LAGRIMA, (b) => {
      b.addToken(makeToken({ id: "a1", name: "a1", side: "heroes", gx: 4, gy: 5, hp: 1, hpMax: 80, initiative: -10 }));
      b.addToken(makeToken({ id: "a2", name: "a2", side: "heroes", gx: 6, gy: 5, hp: 1, hpMax: 80, initiative: -11 }));
    });
    expect(() => runtime.executeTacticalAction(hero.id, action("Curar Ferimentos").id, ["a1", "a2"], null, null)).toThrow(/no máximo 1 alvo/);
    runtime.executeTacticalAction(hero.id, action("Curar Ferimentos").id, ["a1"], null, null);
    expect(bridge.getBoard().tokens.find((t) => t.id === "a1")!.hp).toBeGreaterThan(1);
    expect(bridge.getBoard().tokens.find((t) => t.id === "a2")!.hp).toBe(1);
  });
});

describe("aprimoramento que muda a ação", () => {
  it("Concentração de Combate: +2 PM muda de ação livre para padrão", async () => {
    const { bridge, runtime, hero, action, augmentIndex } = await setup(ASTOLFO);
    const exec = augmentIndex("Concentração de Combate", (a) => a.execucao === "standard");
    expect(exec).toBeGreaterThanOrEqual(0);
    const before = bridge.getCombatState().resources[hero.id];
    runtime.executeTacticalAction(hero.id, action("Concentração de Combate").id, [hero.id], null, { counts: { [exec]: 1 }, racial: false });
    const after = bridge.getCombatState().resources[hero.id];
    expect(after.standard).toBe(0);
    expect(after.free).toBe(before.free);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.pm).toBe(99 - 3);
  });

  it("Concentração de Combate sem aprimoramento continua ação livre", async () => {
    const { bridge, runtime, hero, action } = await setup(ASTOLFO);
    const before = bridge.getCombatState().resources[hero.id];
    runtime.executeTacticalAction(hero.id, action("Concentração de Combate").id, [hero.id], null, null);
    const after = bridge.getCombatState().resources[hero.id];
    expect(after.standard).toBe(before.standard);
    expect(after.free).toBe(before.free - 1);
  });

  it("Campo de Força: +1 PM muda para reação e a RD vale uma vez", async () => {
    const { bridge, runtime, hero, action, augmentIndex } = await setup(ASTOLFO);
    const react = augmentIndex("Campo de Força", (a) => a.execucao === "reaction");
    expect(react).toBeGreaterThanOrEqual(0);
    const before = bridge.getCombatState().resources[hero.id];
    runtime.executeTacticalAction(hero.id, action("Campo de Força").id, [hero.id], null, { counts: { [react]: 1 }, racial: false });
    const after = bridge.getCombatState().resources[hero.id];
    expect(after.reaction).toBe(0);
    expect(after.standard).toBe(before.standard);
    const effect = bridge.getBoard().tokens.find((t) => t.id === hero.id)!.effects?.find((e) => e.sourceId === "spell:campo-de-forca");
    expect(effect?.once).toBe(true);
    expect(effect?.mods?.rd).toBe(30);
  });
});

describe("Arma Mágica", () => {
  it("o bônus de +1 vale só para a arma escolhida", async () => {
    const { bridge, runtime, hero, action } = await setup(ASTOLFO, (b) => {
      b.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 500, hpMax: 500, defense: 1, initiative: -50 }));
    });
    const weapons = (hero.tacticalActions ?? []).filter((a) => a.category === "weapon" && a.attackSkill);
    expect(weapons.length).toBeGreaterThanOrEqual(1);
    const chosen = weapons[0];
    runtime.executeTacticalAction(hero.id, action("Arma Mágica").id, [hero.id], null, { counts: {}, racial: false, weaponId: chosen.id });
    const effect = bridge.getBoard().tokens.find((t) => t.id === hero.id)!.effects?.find((e) => e.sourceId === "spell:arma-magica");
    expect(effect?.weaponId).toBe(chosen.id);
    expect(effect?.name).toContain(chosen.name);
    const { effectBonus } = await import("../src/tactics/engine/effectBonuses");
    const token = bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    expect(effectBonus(token, "attack", chosen.id)).toBe(1);
    expect(effectBonus(token, "damage", chosen.id)).toBe(1);
    expect(effectBonus(token, "attack", "character:weapon:outra")).toBe(0);
  });

  it("o ataque da arma abençoada soma +1 no teste e no dano (o bônus entra de verdade no combate)", async () => {
    const { bridge, runtime, hero, action } = await setup(ASTOLFO, (b) => {
      b.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 5000, hpMax: 5000, defense: 1, initiative: -50 }));
    });
    const attack = (hero.tacticalActions ?? []).find((a) => a.category === "weapon" && a.attackSkill && (a.rangeM ?? 0) >= 1.5 && !a.pmCost)!;
    runtime.executeTacticalAction(hero.id, action("Arma Mágica").id, [hero.id], null, { counts: {}, racial: false, weaponId: attack.id });
    // a ação padrão da magia já foi usada: passa a vez e volta ao turno do herói
    bridge.updateToken(hero.id, {});
    const state = bridge.getCombatState();
    bridge.syncCombat({ ...state, resources: { ...state.resources, [hero.id]: { ...state.resources[hero.id], standard: 1 } } });
    runtime.executeTacticalAction(hero.id, attack.id, ["alvo"], null, null);
    const roll = bridge.getCombatState().rolls.find((r) => r.kind === "attack" && r.action === attack.name)!;
    expect(roll.modifier).toBe(hero.tacticalActions!.length ? (hero[attack.attackSkill!] + (attack.attackBonus || 0) + 1) : 0);
  });
});

describe("Instante Estoico", () => {
  it("é reação: dá RD 10 e some depois de reduzir um dano", async () => {
    const { bridge, runtime, hero, action } = await setup(LAGRIMA);
    const before = bridge.getCombatState().resources[hero.id];
    runtime.executeTacticalAction(hero.id, action("Instante Estoico").id, [hero.id], null, null);
    expect(bridge.getCombatState().resources[hero.id].reaction).toBe(0);
    expect(bridge.getCombatState().resources[hero.id].standard).toBe(before.standard);
    const { mitigateDamage } = await import("../src/tactics/engine/reactiveTriggers");
    const token = bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    expect(token.effects?.find((e) => e.sourceId === "spell:instante-estoico")?.mods?.rd).toBe(10);
    expect(mitigateDamage(token, 15).amount).toBe(5);
    const again = bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    expect(again.effects?.some((e) => e.sourceId === "spell:instante-estoico")).toBeFalsy();
    expect(mitigateDamage(again, 15).amount).toBe(15);
  });
});

describe("Amedrontar", () => {
  const cast = async (will: number) => {
    const { bridge, runtime, hero, action } = await setup(ASTOLFO, (b) => {
      b.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 100, hpMax: 100, defense: 10, will, initiative: -50 }));
    });
    runtime.executeTacticalAction(hero.id, action("Amedrontar").id, ["alvo"], null, null);
    return { bridge, hero, target: bridge.getBoard().tokens.find((t) => t.id === "alvo")! };
  };

  it("falhou na Vontade: apavorado por 1 rodada e abalado pelo resto da cena", async () => {
    const { bridge, target } = await cast(-100);
    expect(target.conditions).toEqual(expect.arrayContaining(["Apavorado", "Abalado"]));
    const effects = target.effects ?? [];
    expect(effects.find((e) => e.condition === "Apavorado")?.kind).toBe("rounds");
    expect(effects.find((e) => e.condition === "Abalado")?.kind).toBe("scene");
    const save = bridge.getCombatState().rolls.find((r) => r.kind === "save")!;
    expect(save.actor).toBe("Alvo");
    expect(save.success).toBe(false);
  });

  it("passou na Vontade: só abalado por 1d4 rodadas", async () => {
    // d20 natural 1 sempre falha: repete até o alvo passar (Vontade +100 passa em qualquer natural, exceto o 1)
    for (let tentativa = 0; tentativa < 40; tentativa += 1) {
      vi.resetModules(); localStorage.clear();
      const { bridge, target } = await cast(100);
      const save = bridge.getCombatState().rolls.find((r) => r.kind === "save")!;
      if (!save.success) continue;
      expect(target.conditions).toContain("Abalado");
      expect(target.conditions).not.toContain("Apavorado");
      const abalado = (target.effects ?? []).find((e) => e.condition === "Abalado")!;
      expect(abalado.kind).toBe("rounds");
      return;
    }
    throw new Error("o alvo nunca passou no teste de Vontade");
  });
});

describe("Campo de Força, Instante Estoico, Armadura Arcana e Proteção Divina", () => {
  it("Campo de Força dá 30 PV temporários que são gastos antes dos PV e acabam com a cena", async () => {
    const { bridge, runtime, hero, action } = await setup(ASTOLFO);
    runtime.executeTacticalAction(hero.id, action("Campo de Força").id, [hero.id], null, null);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.tempHp).toBe(30);
    const { mitigateDamage } = await import("../src/tactics/engine/reactiveTriggers");
    const hp = bridge.getBoard().tokens.find((t) => t.id === hero.id)!.hp;
    expect(mitigateDamage(bridge.getBoard().tokens.find((t) => t.id === hero.id)!, 20).amount).toBe(0);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.tempHp).toBe(10);
    expect(mitigateDamage(bridge.getBoard().tokens.find((t) => t.id === hero.id)!, 25).amount).toBe(15);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.tempHp).toBeUndefined();
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.hp).toBe(hp);
  });

  it("Campo de Força: +3 PM (3º círculo) muda os PV temporários para 50", async () => {
    const { bridge, runtime, hero, action, augmentIndex } = await setup(ASTOLFO);
    const fifty = augmentIndex("Campo de Força", (a) => a.soma?.tempHp === 20);
    expect(fifty).toBeGreaterThanOrEqual(0);
    runtime.executeTacticalAction(hero.id, action("Campo de Força").id, [hero.id], null, { counts: { [fifty]: 1 }, racial: false });
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.tempHp).toBe(50);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.pm).toBe(99 - 6);
  });

  it("Instante Estoico: a RD vale contra dano que não é de magia e não vale contra dano mágico", async () => {
    const { bridge, runtime, hero, action } = await setup(LAGRIMA);
    runtime.executeTacticalAction(hero.id, action("Instante Estoico").id, [hero.id], null, null);
    const { mitigateDamage } = await import("../src/tactics/engine/reactiveTriggers");
    const token = () => bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    expect(mitigateDamage(token(), 15, undefined, undefined, true).amount).toBe(15); // dano mágico: RD não vale e o efeito continua
    expect(token().effects?.some((e) => e.sourceId === "spell:instante-estoico")).toBe(true);
    expect(mitigateDamage(token(), 15).amount).toBe(5); // dano comum: RD 10
  });

  it("Armadura Arcana soma +5 na Defesa e acumula com outras magias; Bênção e Arma Mágica não", async () => {
    const { effectBonus } = await import("../src/tactics/engine/effectBonuses");
    const armor = { id: "a", name: "Armadura Arcana", sourceId: "spell:armadura-arcana", kind: "scene" as const, stacks: true, mods: { defense: 5 } };
    const shield = { id: "s", name: "Escudo da Fé", sourceId: "spell:escudo-da-fe", kind: "scene" as const, mods: { defense: 2 } };
    expect(effectBonus({ effects: [armor] }, "defense")).toBe(5);
    expect(effectBonus({ effects: [armor, shield] }, "defense")).toBe(7);
  });

  it("Armadura Arcana lançada eleva a Defesa que o atacante precisa vencer", async () => {
    const { bridge, runtime, hero, action } = await setup(ASTOLFO, (b) => {
      b.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 100, hpMax: 100, defense: 10, initiative: -50 }));
    });
    const { targetDefense } = await import("../src/tactics/engine/targeting");
    const self = () => bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    const foe = bridge.getBoard().tokens.find((t) => t.id === "alvo")!;
    const before = targetDefense(bridge.getBoard(), foe, self());
    runtime.executeTacticalAction(hero.id, action("Armadura Arcana").id, [hero.id], null, null);
    expect(targetDefense(bridge.getBoard(), foe, self())).toBe(before + 5);
  });

  it("Proteção Divina soma +2 nos testes de resistência do alvo", async () => {
    const { bridge, runtime, hero, action } = await setup(LAGRIMA);
    const { saveModifier } = await import("../src/tactics/engine/saves");
    const before = saveModifier(bridge.getBoard().tokens.find((t) => t.id === hero.id)!, "will");
    runtime.executeTacticalAction(hero.id, action("Proteção Divina").id, [hero.id], null, null);
    const token = bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    expect(saveModifier(token, "will")).toBe(before + 2);
    expect(saveModifier(token, "fortitude")).toBe(token.fortitude + 2);
    expect(saveModifier(token, "reflexes")).toBeGreaterThanOrEqual(token.reflexes + 2);
  });

  it("Proteção Divina: o aprimoramento 'aumenta o bônus em +1' soma", async () => {
    const { bridge, runtime, hero, action, augmentIndex } = await setup(LAGRIMA);
    const inc = augmentIndex("Proteção Divina", (a) => a.soma?.saves === 1);
    expect(inc).toBeGreaterThanOrEqual(0);
    const { saveModifier } = await import("../src/tactics/engine/saves");
    const before = saveModifier(bridge.getBoard().tokens.find((t) => t.id === hero.id)!, "will");
    runtime.executeTacticalAction(hero.id, action("Proteção Divina").id, [hero.id], null, { counts: { [inc]: 2 }, racial: false });
    expect(saveModifier(bridge.getBoard().tokens.find((t) => t.id === hero.id)!, "will")).toBe(before + 4);
  });
});
