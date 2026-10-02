import { it, vi } from "vitest";
import fs from "node:fs";
import { makeToken } from "./helpers";

/** Varredura temporária (só roda com DIAG=1): executa CADA ação de cada herói no combate e registra o que acontece. */
const out = "C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad/varredura.txt";

async function fresh(index: number) {
  vi.resetModules(); localStorage.clear();
  const bridge = await import("../src/game/vttBridge");
  const runtime = await import("../src/tactics/engine/runtimeCommands");
  const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  const sheet = loadReadyHeroSheets()[index];
  const hero = { ...boardTokenFromCharacter(sheet, { x: 5, y: 5 }), initiative: 99, pm: 99, pmMax: 99 };
  bridge.addToken(hero);
  bridge.addToken(makeToken({ id: "alvo", name: "Alvo", side: "threats", gx: 6, gy: 5, hp: 300, hpMax: 300, defense: 1, initiative: -50 }));
  bridge.addToken(makeToken({ id: "aliado", name: "Aliado", side: "heroes", gx: 4, gy: 5, hp: 10, hpMax: 40, initiative: -60 }));
  bridge.startCombat();
  return { bridge, runtime, hero };
}

it.runIf(process.env.DIAG === "1")("varredura de ações", async () => {
  const lines: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const { hero } = await fresh(index);
    const actions = (hero.tacticalActions ?? []).filter((a) => a.category !== "special");
    lines.push(`\n===== ${hero.name} — ${actions.length} ações (sem passivos) =====`);
    for (const action of actions) {
      const { bridge, runtime, hero: h } = await fresh(index);
      // Mesmo critério da tela de Agir: a regra curada da magia manda; senão vale o alvo da ação.
      const { spellAllowsTarget } = await import("../src/tactics/interpretation/spellTargeting");
      const cands = [["alvo", "threats"], ["aliado", "heroes"], [h.id, "heroes"]] as const;
      const curatedOk = action.category === "spell" ? cands.find(([id, side]) => spellAllowsTarget(action, { id: h.id, side: "heroes" }, { id, side }) === true) : undefined;
      const target = curatedOk ? [curatedOk[0]] : action.target === "ally" ? ["aliado"] : action.target === "self" ? [h.id] : ["alvo"];
      const before = { pv: bridge.getBoard().tokens.find((t) => t.id === "alvo")!.hp, aliado: bridge.getBoard().tokens.find((t) => t.id === "aliado")!.hp, pm: bridge.getBoard().tokens.find((t) => t.id === h.id)!.pm, res: { ...bridge.getCombatState().resources[h.id] } };
      let status = "OK";
      try {
        runtime.executeTacticalAction(h.id, action.id, target, action.areaM ? { x: 6, y: 5 } : null);
      } catch (error) { status = "ERRO: " + (error as Error).message.slice(0, 110); }
      const board = bridge.getBoard();
      const after = { pv: board.tokens.find((t) => t.id === "alvo")!.hp, aliado: board.tokens.find((t) => t.id === "aliado")!.hp, pm: board.tokens.find((t) => t.id === h.id)!.pm, res: bridge.getCombatState().resources[h.id] };
      const mudou = [after.pv !== before.pv ? `alvo ${before.pv}→${after.pv}` : "", after.aliado !== before.aliado ? `aliado ${before.aliado}→${after.aliado}` : "", after.pm !== before.pm ? `PM ${before.pm}→${after.pm}` : "", JSON.stringify(after.res) !== JSON.stringify(before.res) ? `ação gasta (${Object.entries(before.res).filter(([k, v]) => (after.res as Record<string, number>)[k] !== v).map(([k]) => k).join("/")})` : ""].filter(Boolean).join(", ");
      lines.push(`${status.startsWith("OK") ? "OK  " : "FALHA"} | ${action.name} [${action.category}/${action.kind}/${action.target}${action.pmCost ? ` ${action.pmCost}PM` : ""}${action.damage ? ` dano ${action.damage}` : ""}${action.healing ? ` cura ${action.healing}` : ""}${action.areaM ? ` área ${action.areaM}m` : ""}] ${status === "OK" ? "→ " + (mudou || "sem efeito mecânico (texto)") : status}`);
    }
  }
  fs.writeFileSync(out, lines.join("\n"));
}, 240000);
