import type { BoardState, BoardToken } from "../../game/types";
import { boardLighting, lightedCells } from "../../game/vision";
import { weatherRule } from "../../game/weatherRules";
import { cellDistance } from "./targeting";

/**
 * Camuflagem (Tormenta20 p.238–239, p.318): leve = 20% de chance de falha (d10: 1–2), total = 50% (d10: 1–5).
 * Fontes: neblina (clima), escuridão (só a definida à mão na Luz; a iluminação que vem do clima é regra da casa, não escuridão do livro),
 * e atacante cego (todos os alvos têm camuflagem total). Visão na Penumbra, Visão no Escuro e Visão nas Trevas ignoram a escuridão em alcance curto (p.229).
 */
export type Concealment = "none" | "light" | "total";
const SHORT_RANGE_CELLS = 6; // 9 m

export function concealmentAgainst(board: BoardState, attacker: BoardToken, target: BoardToken): { level: Concealment; reasons: string[] } {
  let level: Concealment = "none";
  const reasons: string[] = [];
  const raise = (next: Concealment, reason: string) => {
    if (next === "total" || (next === "light" && level === "none")) level = next;
    reasons.push(reason);
  };
  if ((attacker.conditions || []).some((condition) => /cego/i.test(condition.normalize("NFD").replace(/[̀-ͯ]/g, "")))) raise("total", "atacante cego");
  if (weatherRule(board.weather).concealment === "light") raise("light", "névoa");
  if (board.lightingManual) {
    const lighting = boardLighting(board);
    const dark: Concealment = lighting === "twilight" || lighting === "starnight" ? "light" : lighting === "darknight" || lighting === "cave" ? "total" : "none";
    if (dark !== "none" && !lightedCells(board).has(`${target.gx},${target.gy}`)) {
      const vision = attacker.visionType || "normal";
      const near = cellDistance(attacker, target) <= SHORT_RANGE_CELLS;
      const ignores = near && (vision === "magic" || (vision === "dark" && lighting !== "cave") || (vision === "penumbra" && dark === "light"));
      if (!ignores) raise(dark, lighting === "cave" ? "escuridão mágica" : dark === "light" ? "escuridão leve" : "escuridão total");
    }
  }
  return { level, reasons };
}

/** Chance de falha do ataque pela camuflagem: 0, 0.2 ou 0.5. */
export const concealmentMiss = (level: Concealment) => (level === "total" ? 0.5 : level === "light" ? 0.2 : 0);
