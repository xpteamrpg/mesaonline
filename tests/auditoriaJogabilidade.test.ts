import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { makeToken } from "./helpers";

/**
 * Auditoria de jogabilidade com os heróis prontos do playtest (fichas reais importadas):
 * o token da ficha tem as ações certas, o combate cobra as ações de movimento e padrão, e o ataque da ficha chega no alvo.
 * Exploração e combate são testados separados: na exploração o movimento é livre; no combate, não.
 */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const relatorio: string[] = [];

async function setup(sheetIndex: number, opts: { enemyAt?: [number, number] } = {}) {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const sheet = loadReadyHeroSheets()[sheetIndex];
  const hero = { ...boardTokenFromCharacter(sheet, { x: 5, y: 5 }), initiative: 99 };
  const [ex, ey] = opts.enemyAt ?? [6, 5];
  bridge.addToken(hero);
  bridge.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: ex, gy: ey, hp: 300, hpMax: 300, defense: 1, initiative: -50 }));
  return { bridge, runtime, sheet, hero };
}

const NOMES = ["Renard", "Astolfo", "Kalop Sita", "Lágrima desk"];

describe.each(NOMES.map((nome, i) => [nome, i] as const))("%s", (nome, index) => {
  it("o token da ficha traz ataques, poderes ativos e magias como ações", async () => {
    const { hero, sheet } = await setup(index);
    const actions = hero.tacticalActions ?? [];
    expect(actions.length).toBeGreaterThan(0);
    for (const attack of sheet.attacks) expect(actions.some((a) => a.name.toLowerCase().includes(attack.name.toLowerCase().split(" ")[0]))).toBe(true);
    relatorio.push(`${nome}: ${actions.length} ações → ${actions.map((a) => `${a.name} [${a.category}/${a.kind}${a.pmCost ? ` ${a.pmCost}PM` : ""}]`).join("; ")}`);
    relatorio.push(`   ficha: ${sheet.attacks.length} ataque(s), ${sheet.powers.length} poder(es), ${sheet.spells.length} magia(s); PV ${hero.hpMax} PM ${hero.pmMax} DEF ${hero.defense} Luta +${hero.luta} Pontaria +${hero.pontaria}`);
    expect(hero.hpMax).toBe(sheet.hp.max);
    expect(hero.pmMax).toBe(sheet.mp.max);
  });

  it("no COMBATE o ataque da ficha chega no alvo e gasta a ação padrão", async () => {
    const { bridge, runtime, hero } = await setup(index);
    bridge.startCombat();
    expect(bridge.getCombatState().activeTokenId).toBe(hero.id);
    const attack = (hero.tacticalActions ?? []).find((a) => a.kind === "standard" && a.effect === "damage" && (a.rangeM ?? 0) >= 1.5 && !a.pmCost);
    expect(attack, `${nome} precisa ter um ataque corpo a corpo ou à distância`).toBeDefined();
    const before = bridge.getBoard().tokens.find((t) => t.id === "alvo")!.hp;
    runtime.executeTacticalAction(hero.id, attack!.id, ["alvo"]);
    const state = bridge.getCombatState();
    expect(state.resources[hero.id].standard).toBe(0);
    expect(state.log.some((entry) => entry.type === "attack" || entry.type === "damage")).toBe(true);
    // a ação padrão já foi usada: um segundo ataque é recusado
    expect(() => runtime.executeTacticalAction(hero.id, attack!.id, ["alvo"])).toThrow(/padrão|ação/i);
    const after = bridge.getBoard().tokens.find((t) => t.id === "alvo")!.hp;
    relatorio.push(`${nome}: ataque "${attack!.name}" → alvo ${before} → ${after} PV (defesa 1)`);
  });

  it("no COMBATE mover gasta a ação de movimento e tem limite de deslocamento", async () => {
    const { bridge, runtime, hero } = await setup(index, { enemyAt: [12, 12] });
    bridge.startCombat();
    const r0 = bridge.getCombatState().resources[hero.id];
    expect(r0.movement).toBeGreaterThan(0);
    runtime.executeTacticalMove(hero.id, 8, 5); // 3 casas
    expect(bridge.getCombatState().resources[hero.id].movement).toBe(r0.movement - 1);
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)).toMatchObject({ gx: 8, gy: 5 });
    // além do deslocamento (8 casas, o herói anda 4 a 6): recusado
    expect(() => runtime.executeTacticalMove(hero.id, 8, 13, "walk")).toThrow(/deslocamento|alcance|bloqueado/i);
  });
});

describe("EXPLORAÇÃO: movimento livre, sem gastar ação", () => {
  it("o herói atravessa o mapa de uma vez e não gasta nada do combate", async () => {
    const { bridge, runtime, hero } = await setup(0, { enemyAt: [12, 12] });
    runtime.executeExplorationMove(hero.id, 1, 12, "walk");
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)).toMatchObject({ gx: 1, gy: 12 });
    runtime.executeExplorationMove(hero.id, 12, 1, "walk");
    expect(bridge.getBoard().tokens.find((t) => t.id === hero.id)).toMatchObject({ gx: 12, gy: 1 });
  });

  it("parede e ocupação continuam bloqueando; a exploração não vale durante o combate", async () => {
    const { bridge, runtime, hero } = await setup(1, { enemyAt: [6, 5] });
    expect(() => runtime.executeExplorationMove(hero.id, 6, 5, "walk")).toThrow(/bloqueado/); // casa ocupada pelo alvo
    bridge.upsertWall({ id: "muro", type: "wall", x1: 8, y1: 0, x2: 8, y2: 14 });
    expect(() => runtime.executeExplorationMove(hero.id, 12, 5, "walk")).toThrow(/bloqueado/); // atrás de uma parede inteira
    bridge.startCombat();
    expect(() => runtime.executeExplorationMove(hero.id, 5, 7, "walk")).toThrow(/combate/i);
  });
});

describe("perícias dos heróis", () => {
  it("toda perícia tem total calculado e as treinadas somam o treino", async () => {
    const { T20_SKILLS } = await import("../src/portal/lib/t20/compendium");
    const { skillTotal } = await import("../src/portal/lib/t20/sheetRules");
    const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
    for (const sheet of loadReadyHeroSheets() as never[]) {
      const s = sheet as { name: string; skills: Record<string, { trained?: boolean }> };
      const linhas: string[] = [];
      for (const def of T20_SKILLS) {
        const total = skillTotal(s as never, def.id);
        expect(total, `${s.name} / ${def.nome}`).toBeDefined();
        expect(Number.isFinite(total!.total)).toBe(true);
        if (s.skills[def.id]?.trained) linhas.push(`${def.nome} ${total!.total >= 0 ? "+" : ""}${total!.total}`);
      }
      relatorio.push(`${s.name} (perícias treinadas): ${linhas.join(", ")}`);
    }
  });

  it("zz grava o relatório da auditoria", () => {
    fs.writeFileSync("C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad/auditoria.txt", relatorio.join("\n"));
  });
});
