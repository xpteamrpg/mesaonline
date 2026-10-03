import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

/** Magia de área (Bola de Fogo, Reflexos reduz à metade): cada alvo na área rola o teste sozinho; falhou = dano completo, passou = metade. */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => vi.restoreAllMocks());

describe("Bola de Fogo em área", () => {
  it("cada alvo faz o teste de Reflexos: quem falha leva o dano completo e quem passa leva metade", async () => {
    const bridge = await import("../src/game/vttBridge");
    const runtime = await import("../src/tactics/engine/runtimeCommands");
    const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
    const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
    const hero = { ...boardTokenFromCharacter(loadReadyHeroSheets()[1], { x: 3, y: 5 }), initiative: 99, pm: 99, pmMax: 99 };
    bridge.addToken(hero);
    const foe = (id: string, gx: number, gy: number, reflexes: number) => bridge.addToken(makeToken({ id, name: id, side: "threats", gx, gy, hp: 500, hpMax: 500, defense: 1, reflexes, initiative: -50 }));
    foe("falha", 8, 5, -100);   // erra o teste (d20 = 11)
    foe("passa", 9, 5, 100);    // passa no teste
    foe("fora", 20, 12, -100);  // fora da área: não é afetado
    bridge.startCombat();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // d20 = 11 e cada d6 = 4
    const bola = (hero.tacticalActions ?? []).find((a) => a.name === "Bola de Fogo")!;
    expect(bola.areaM).toBe(6);
    runtime.executeTacticalAction(hero.id, bola.id, ["falha", "passa"], { x: 8, y: 5 }, null);
    const board = bridge.getBoard();
    const hp = (id: string) => board.tokens.find((t) => t.id === id)!.hp;
    expect(500 - hp("falha")).toBe(24);          // 6d6 com todos os dados em 4
    expect(500 - hp("passa")).toBe(12);          // metade
    expect(hp("fora")).toBe(500);
    const saves = bridge.getCombatState().rolls.filter((r) => r.kind === "save");
    expect(saves.map((s) => s.actor).sort()).toEqual(["falha", "passa"]);
    expect(saves.find((s) => s.actor === "falha")!.success).toBe(false);
    expect(saves.find((s) => s.actor === "passa")!.success).toBe(true);
  });
});

describe("Toque Chocante e Despedaçar: 1 criatura na base, explosão de 6 m com o aprimoramento de PM", () => {
  it("o catálogo lê o aprimoramento como área pessoal de 6 m", async () => {
    const casting = await import("../src/tactics/interpretation/spellCasting");
    for (const [nome, custo] of [["Toque Chocante", 2], ["Despedaçar", 5]] as const) {
      const entry = casting.findSpellEntry({ name: nome, category: "spell" })!;
      const burst = casting.normalizeAugments(entry).find((a) => a.areaM);
      expect(burst, nome).toBeDefined();
      expect(burst!.areaM).toBe(6);
      expect(burst!.custo).toBe(custo);
    }
  });

  it("sem aprimoramento atinge 1 criatura; com ele atinge todos os inimigos a até 6 m de quem lança, cada um com seu teste", async () => {
    const bridge = await import("../src/game/vttBridge");
    const runtime = await import("../src/tactics/engine/runtimeCommands");
    const casting = await import("../src/tactics/interpretation/spellCasting");
    const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
    const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
    const hero = { ...boardTokenFromCharacter(loadReadyHeroSheets()[1], { x: 10, y: 5 }), initiative: 99, pm: 99, pmMax: 99, level: 10 };
    bridge.addToken(hero);
    const foe = (id: string, gx: number, gy: number) => bridge.addToken(makeToken({ id, name: id, side: "threats", gx, gy, hp: 500, hpMax: 500, defense: 1, fortitude: -100, initiative: -50 }));
    foe("perto1", 11, 5); foe("perto2", 13, 5); foe("longe", 20, 12);
    bridge.startCombat();
    const toque = (hero.tacticalActions ?? []).find((a) => a.name === "Toque Chocante")!;
    expect(toque.target).toBe("enemy");
    const index = casting.normalizeAugments(casting.findSpellEntry({ name: "Toque Chocante", category: "spell" })!).findIndex((a) => a.areaM);
    runtime.executeTacticalAction(hero.id, toque.id, ["perto1", "perto2"], null, { counts: { [index]: 1 }, racial: false });
    const hp = (id: string) => bridge.getBoard().tokens.find((t) => t.id === id)!.hp;
    expect(hp("perto1")).toBeLessThan(500);
    expect(hp("perto2")).toBeLessThan(500);
    expect(hp("longe")).toBe(500);
    expect(bridge.getCombatState().rolls.filter((r) => r.kind === "save").map((r) => r.actor).sort()).toEqual(["perto1", "perto2"]);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)!.pm).toBe(99 - 3); // 1 PM da magia + 2 PM do aprimoramento
  });
});
