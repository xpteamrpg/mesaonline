import { it, vi } from "vitest";
import fs from "node:fs";
import { makeToken } from "./helpers";
it.runIf(process.env.DIAG === "1")("ataque do Kalop 30 vezes", async () => {
  const out: string[] = [];
  let acertos = 0, tentativas = 0; const dano: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    vi.resetModules(); localStorage.clear();
    const bridge = await import("../src/game/vttBridge");
    const runtime = await import("../src/tactics/engine/runtimeCommands");
    const { boardTokenFromCharacter } = await import("../src/integration/modernRpgCharacterBridge");
    const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
    const hero = { ...boardTokenFromCharacter(loadReadyHeroSheets()[2], { x: 5, y: 5 }), initiative: 99 };
    bridge.addToken(hero); bridge.addToken(makeToken({ id: "alvo", side: "threats", gx: 6, gy: 5, hp: 300, hpMax: 300, defense: 1, initiative: -50 }));
    bridge.startCombat();
    const attack = hero.tacticalActions!.find((a) => a.name === "Corrente de espinhos")!;
    if (i === 0) out.push("ação: " + JSON.stringify({ id: attack.id, damage: attack.damage, crit: attack.crit, mult: attack.critMultiplier, attackSkill: attack.attackSkill, rangeM: attack.rangeM, kind: attack.kind, effect: attack.effect }));
    runtime.executeTacticalAction(hero.id, attack.id, ["alvo"]);
    tentativas += 1;
    const hp = bridge.getBoard().tokens.find((t) => t.id === "alvo")!.hp;
    if (hp < 300) { acertos += 1; dano.push(300 - hp); }
    if (i < 3) out.push("log: " + bridge.getCombatState().log.filter((l) => l.type === "attack" || l.type === "damage").map((l) => `${l.title} | ${l.detail}`).join(" || "));
  }
  out.push(`acertos ${acertos}/${tentativas} | dano: min ${Math.min(...dano)} máx ${Math.max(...dano)} | amostra ${dano.slice(0, 10).join(",")}`);
  fs.writeFileSync("C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad/diag-kalop.txt", out.join("\n"));
});
