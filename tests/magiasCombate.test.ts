import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

/**
 * Magias de combate dos heróis do playtest que mexem nas rolagens: Imagem Espelhada, Concentração de Combate e o dano elemental da Arma Mágica
 * (texto de cada magia no catálogo magias.json).
 */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const ASTOLFO = 1;

async function setup(extra: (bridge: typeof import("../src/game/vttBridge")) => void = () => undefined) {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const casting = await import("../src/tactics/interpretation/spellCasting");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const sheet = loadReadyHeroSheets()[ASTOLFO];
  const hero = { ...boardTokenFromCharacter(sheet, { x: 5, y: 5 }), initiative: 99, pm: 99, pmMax: 99, level: 10 };
  bridge.addToken(hero);
  bridge.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 5000, hpMax: 5000, defense: 1, initiative: -50 }));
  extra(bridge);
  bridge.startCombat();
  const action = (name: string) => (hero.tacticalActions ?? []).find((a) => a.name === name)!;
  const augmentIndex = (spellName: string, pick: (a: ReturnType<typeof casting.normalizeAugments>[number]) => unknown) => {
    const entry = casting.findSpellEntry({ name: spellName, category: "spell" })!;
    return casting.normalizeAugments(entry).findIndex(pick);
  };
  const melee = () => (hero.tacticalActions ?? []).find((a) => a.category === "weapon" && a.attackSkill && (a.rangeM ?? 0) >= 1.5 && !a.pmCost)!;
  const refill = (id: string) => {
    const state = bridge.getCombatState();
    bridge.syncCombat({ ...state, activeTokenId: id, resources: { ...state.resources, [id]: { standard: 1, movement: 1, full: 1, free: 1, reaction: 1 } } });
  };
  return { bridge, runtime, casting, hero, action, augmentIndex, melee, refill };
}

describe("Imagem Espelhada", () => {
  it("+6 na Defesa; cada cópia desfeita tira 2; sem cópias o efeito acaba", async () => {
    const { bridge, runtime, hero, action } = await setup();
    const { targetDefense } = await import("../src/tactics/engine/targeting");
    const { loseMirrorImage } = await import("../src/tactics/engine/reactiveTriggers");
    const self = () => bridge.getBoard().tokens.find((t) => t.id === hero.id)!;
    const attacker = bridge.getBoard().tokens.find((t) => t.id === "alvo")!;
    const base = targetDefense(bridge.getBoard(), attacker, self());
    runtime.executeTacticalAction(hero.id, action("Imagem Espelhada").id, [hero.id], null, null);
    expect(targetDefense(bridge.getBoard(), attacker, self())).toBe(base + 6);
    loseMirrorImage(hero.id);
    expect(targetDefense(bridge.getBoard(), attacker, self())).toBe(base + 4);
    loseMirrorImage(hero.id); loseMirrorImage(hero.id);
    expect(targetDefense(bridge.getBoard(), attacker, self())).toBe(base);
    expect(self().effects?.some((e) => e.mirrorImages)).toBeFalsy();
  });

  it("um ataque que erra de verdade desfaz uma cópia", async () => {
    const { bridge, runtime, hero, action, refill } = await setup((b) => b.updateToken("alvo", { luta: -100 }));
    runtime.executeTacticalAction(hero.id, action("Imagem Espelhada").id, [hero.id], null, null);
    const attack = { id: "golpe", name: "Golpe", source: "custom", sourceId: "golpe", category: "weapon", kind: "standard", effect: "damage", target: "enemy", description: "", pmCost: 0, rangeM: 3, damage: "1d4", attackSkill: "luta", color: "arcane" } as never;
    const { resolveTacticalAction } = await import("../src/tactics/engine/combat");
    const hasImages = () => bridge.getBoard().tokens.find((t) => t.id === hero.id)!.effects?.some((e) => e.mirrorImages);
    let misses = 0;
    for (let n = 0; n < 60 && hasImages(); n += 1) {
      refill("alvo");
      const result = resolveTacticalAction("alvo", attack, [hero.id]);
      if (!result.targets[0].hit) misses += 1;
    }
    expect(misses).toBeGreaterThanOrEqual(3); // três cópias: três erros e o efeito acaba
    expect(hasImages()).toBeFalsy();
  });
});

describe("Concentração de Combate", () => {
  it("o d20 do ataque é rolado duas vezes e vale o melhor", async () => {
    const { bridge, runtime, hero, action, melee } = await setup();
    runtime.executeTacticalAction(hero.id, action("Concentração de Combate").id, [hero.id], null, null);
    const attack = melee();
    runtime.executeTacticalAction(hero.id, attack.id, ["alvo"], null, null);
    const roll = bridge.getCombatState().rolls.find((r) => r.kind === "attack" && r.action === attack.name)!;
    expect(roll.rolls).toHaveLength(2);
    expect(roll.natural).toBe(Math.max(...roll.rolls));
  });

  it("o inimigo que ataca rola dois dados e usa o pior; melhor e pior se anulam", async () => {
    const { attackDiceMode } = await import("../src/tactics/engine/effectBonuses");
    const holder = { effects: [{ id: "c", name: "c", kind: "scene" as const, incomingAttackRoll: "worst" as const }] };
    const caster = { effects: [{ id: "c", name: "c", kind: "scene" as const, attackRoll: "best" as const }] };
    expect(attackDiceMode({ effects: [] }, holder)).toBe("worst");
    expect(attackDiceMode(caster, { effects: [] })).toBe("best");
    expect(attackDiceMode(caster, holder)).toBe("normal");
    expect(attackDiceMode({ effects: [] }, { effects: [] })).toBe("normal");
  });

  it("os aprimoramentos do catálogo: execução padrão + cena exige 2º círculo; o de 3º círculo faz o inimigo rolar o pior", async () => {
    const { casting } = await setup();
    const entry = casting.findSpellEntry({ name: "Concentração de Combate", category: "spell" })!;
    const augments = casting.normalizeAugments(entry);
    const standard = augments.findIndex((a) => a.execucao === "standard");
    expect(augments[standard].requerCirculo).toBe(2);
    expect(augments[standard].define?.cena).toBe(1);
    expect(augments.some((a) => a.define?.inimigoPior)).toBe(true);
  });
});

describe("Arma Mágica: dano de energia", () => {
  it("+1d6 de energia escolhida entra no dano da arma escolhida e a energia é obrigatória", async () => {
    const { bridge, runtime, casting, hero, action, augmentIndex, melee, refill } = await setup();
    const attack = melee();
    const elemental = augmentIndex("Arma Mágica", (a) => a.soma?.elemental === 1 && a.tipo === "extra");
    expect(elemental).toBeGreaterThanOrEqual(0);
    expect(() => runtime.executeTacticalAction(hero.id, action("Arma Mágica").id, [hero.id], null, { counts: { [elemental]: 1 }, racial: false, weaponId: attack.id })).toThrow(/energia/i);
    runtime.executeTacticalAction(hero.id, action("Arma Mágica").id, [hero.id], null, { counts: { [elemental]: 1 }, racial: false, weaponId: attack.id, element: "Fogo" });
    const effect = bridge.getBoard().tokens.find((t) => t.id === hero.id)!.effects!.find((e) => e.sourceId === "spell:arma-magica")!;
    expect(effect.extraDamage).toEqual({ formula: "1d6", type: "Fogo" });
    expect(casting.sanitizeAugmentChoice({ counts: {}, element: "Veneno" }).element).toBeUndefined();
    refill(hero.id);
    // 5000 PV e Defesa 1: acerta (exceto 1 natural); tenta até acertar
    for (let n = 0; n < 20; n += 1) {
      refill(hero.id);
      runtime.executeTacticalAction(hero.id, attack.id, ["alvo"], null, null);
      const hit = bridge.getCombatState().rolls.filter((r) => r.kind === "damage" && r.action === attack.name).at(-1);
      if (hit) {
        const dice = (attack.damage || "").match(/(\d+)d\d+/);
        expect(hit.rolls.length).toBeGreaterThanOrEqual((dice ? Number(dice[1]) : 0) + 1); // dados da arma + o d6 de fogo
        return;
      }
    }
    throw new Error("nenhum ataque acertou");
  });

  it("+2d6 só vale junto do aprimoramento de +1d6", async () => {
    const { runtime, hero, action, augmentIndex, melee } = await setup();
    const two = augmentIndex("Arma Mágica", (a) => a.exige !== undefined);
    expect(() => runtime.executeTacticalAction(hero.id, action("Arma Mágica").id, [hero.id], null, { counts: { [two]: 1 }, racial: false, weaponId: melee().id, element: "Frio" })).toThrow(/junto/);
  });
});
