import { it } from "vitest";
import fs from "node:fs";
import { getBoard, addToken } from "../src/game/vttBridge";
import { boardTokenFromCharacter } from "../src/integration/modernRpgCharacterBridge";
import { loadReadyHeroSheets } from "../ficha-modernrpg/characterRoute";
import { reachableWithPaths, footprintOccupied } from "../src/tactics/engine/movement";

/** Medição temporária (só roda com DIAG=1): onde o mapa gasta tempo ao mostrar o alcance do token. */
const sp = "C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad";

it.runIf(process.env.DIAG === "1")("medição do alcance", () => {
  const out: string[] = [];
  const sheets = loadReadyHeroSheets();
  sheets.forEach((sheet, i) => addToken(boardTokenFromCharacter(sheet, { x: 3 + i * 2, y: 3 })));
  const board = getBoard();
  const token = board.tokens[0];
  const time = (label: string, n: number, fn: () => unknown) => { const t = performance.now(); for (let i = 0; i < n; i += 1) fn(); out.push(`${label}: ${((performance.now() - t) / n).toFixed(2)} ms por chamada`); };
  out.push(`mapa ${board.map.cols}x${board.map.rows} = ${board.map.cols * board.map.rows} casas | tokens ${board.tokens.length} | deslocamento ${token.movementM} m`);
  time("reachableWithPaths (andar, 9 m)", 20, () => reachableWithPaths(board, token, { mode: "walk" }));
  const reach = reachableWithPaths(board, token, { mode: "walk" });
  out.push(`casas alcançáveis: ${reach.size}`);
  time("footprintOccupied em todas as casas alcançáveis", 20, () => { for (const key of reach.keys()) { const [x, y] = key.split(",").map(Number); footprintOccupied(board, token, { x, y }); } });
  fs.writeFileSync(`${sp}/bench-mov.txt`, out.join("\n"));
});
