import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { makeToken } from "./helpers";

/**
 * As magias das fichas dos 4 heróis do playtest: cada uma está na lista de Agir como magia, com a ação (padrão, movimento, livre, reação, completa)
 * e o custo em PM do catálogo, e ao ser conjurada no combate gasta exatamente isso.
 */
beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const NOMES = ["Renard", "Astolfo", "Kalop Sita", "Lágrima desk"];
const SAIDA = process.env.MAGIAS_RELATORIO;
const linhas: string[] = [];

async function setup(index: number) {
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const { SPELL_BY_ID } = await import("../src/portal/lib/t20/compendium");
  const { actionKindFromExecution } = await import("../src/tactics/interpretation/modernRpgRules");
  const { spellAllowsTarget } = await import("../src/tactics/interpretation/spellTargeting");
  const sheet = loadReadyHeroSheets()[index];
  const hero = { ...boardTokenFromCharacter(sheet, { x: 5, y: 5 }), initiative: 99, pm: 99, pmMax: 99 };
  bridge.addToken(hero);
  bridge.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 300, hpMax: 300, defense: 1, initiative: -50 }));
  bridge.addToken(makeToken({ id: "aliado", name: "Aliado", side: "heroes", gx: 4, gy: 5, hp: 10, hpMax: 40, initiative: -60 }));
  bridge.startCombat();
  return { bridge, runtime, sheet, hero, SPELL_BY_ID, actionKindFromExecution, spellAllowsTarget };
}

describe.each(NOMES.map((nome, i) => [nome, i] as const))("magias de %s", (nome, index) => {
  it("toda magia da ficha está em Agir com a ação e o custo do catálogo e gasta isso ao conjurar", async () => {
    const first = await setup(index);
    for (const spell of first.sheet.spells) {
      const { bridge, runtime, hero, SPELL_BY_ID, actionKindFromExecution, spellAllowsTarget } = await (async () => { vi.resetModules(); localStorage.clear(); return setup(index); })();
      const catalogo = SPELL_BY_ID.get(spell.id);
      expect(catalogo, `${nome}: "${spell.name}" (${spell.id}) não está no catálogo`).toBeDefined();
      const action = (hero.tacticalActions ?? []).find((a) => a.category === "spell" && a.sourceId === spell.id);
      expect(action, `${nome}: "${spell.name}" não aparece como ação de magia`).toBeDefined();
      const kindEsperado = actionKindFromExecution(catalogo!.execucao);
      expect(action!.kind, `${nome}: ${spell.name} (execução "${catalogo!.execucao}")`).toBe(kindEsperado);
      expect(action!.pmCost, `${nome}: ${spell.name} (custo do catálogo)`).toBe(catalogo!.custo);

      // conjura no combate: gasta o PM e a ação certos
      const cands = [["alvo", "threats"], ["aliado", "heroes"], [hero.id, "heroes"]] as const;
      const ok = cands.find(([id, side]) => spellAllowsTarget(action!, { id: hero.id, side: "heroes" }, { id, side }) === true);
      const target = ok ? [ok[0]] : action!.target === "ally" ? ["aliado"] : action!.target === "self" ? [hero.id] : ["alvo"];
      const antes = { pm: bridge.getBoard().tokens.find((t) => t.id === hero.id)!.pm, res: { ...bridge.getCombatState().resources[hero.id] } };
      let erro = "";
      try { runtime.executeTacticalAction(hero.id, action!.id, target, action!.areaM ? { x: 6, y: 5 } : null); } catch (e) { erro = (e as Error).message; }
      const depois = { pm: bridge.getBoard().tokens.find((t) => t.id === hero.id)!.pm, res: bridge.getCombatState().resources[hero.id] as Record<string, number> };
      const gastou = Object.entries(antes.res).filter(([k, v]) => depois.res[k] !== v).map(([k, v]) => `${k} ${v}→${depois.res[k]}`).join(", ");
      linhas.push(`${nome} | ${spell.name} | catálogo: ${catalogo!.execucao}, ${catalogo!.custo} PM | ação: ${action!.kind}, ${action!.pmCost} PM | gastou: PM ${antes.pm - depois.pm}${gastou ? `, ${gastou}` : ""}${erro ? ` | ERRO: ${erro}` : ""}`);
      expect(erro, `${nome}: ${spell.name}`).toBe("");
      expect(antes.pm - depois.pm, `${nome}: ${spell.name} deve gastar ${catalogo!.custo} PM`).toBe(catalogo!.custo);
      if (kindEsperado === "standard") expect(depois.res.standard, `${nome}: ${spell.name} gasta a ação padrão`).toBe(0);
      if (kindEsperado === "movement") expect(depois.res.movement, `${nome}: ${spell.name} gasta a ação de movimento`).toBeLessThan(antes.res.movement);
      if (kindEsperado === "reaction") expect(depois.res.reaction, `${nome}: ${spell.name} gasta a reação`).toBe(0);
    }
  }, 120000);

  it("zz relatório", () => { if (SAIDA && index === 3) fs.writeFileSync(SAIDA, linhas.join("\n")); });
});
