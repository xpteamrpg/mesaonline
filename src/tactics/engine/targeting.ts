import { conditionMods } from "../../game/conditionEffects";
import type { BoardState, BoardToken, BoardWall } from "../../game/types";
import { type Cell, activeGrid, distanceBetween } from "../../game/distance";
import { blockCenter, blockGap, coveredCells } from "../../game/tokenSize";
import { effectBonus } from "./effectBonuses";

/** Passos de grade (Chebyshev). Usado para adjacencia e interpolacao de raio,
 *  NAO para distancia em metros — para isso use rangeM/distanceBetween. */
export function cellDistance(a: Pick<BoardToken, "gx" | "gy"> & Partial<Pick<BoardToken, "size" | "title" | "mountId">>, b: Pick<BoardToken, "gx" | "gy"> & Partial<Pick<BoardToken, "size" | "title" | "mountId">>): number {
  return blockGap(a, b); // da casa mais próxima de cada bloco (criatura Grande ocupa 2x2 etc.)
}

/** Distancia em metros pela regra unica da cena (game/distance.ts). */
export function rangeM(a: Pick<BoardToken, "gx" | "gy"> & Partial<Pick<BoardToken, "size" | "title" | "mountId">>, b: Pick<BoardToken, "gx" | "gy"> & Partial<Pick<BoardToken, "size" | "title" | "mountId">>): number {
  const cellsA = coveredCells(a).length ? coveredCells(a) : [{ x: a.gx, y: a.gy }];
  const cellsB = coveredCells(b).length ? coveredCells(b) : [{ x: b.gx, y: b.gy }];
  let best = Infinity;
  for (const p of cellsA) for (const q of cellsB) best = Math.min(best, distanceBetween(p, q, activeGrid()));
  return best;
}

/** Mesma regra, para posicoes soltas de grade (celulas de area, destinos da IA). */
export function withinRangeCells(a: Cell, b: Cell, maximumM: number): boolean {
  return distanceBetween(a, b, activeGrid()) <= maximumM + 0.001;
}

export function withinRange(source: BoardToken, target: BoardToken, maximumM: number): boolean {
  return rangeM(source, target) <= maximumM + 0.001;
}

function segmentIntersectsWall(ax: number, ay: number, bx: number, by: number, wall: BoardWall): boolean {
  if (wall.open && (wall.type === "door" || wall.type === "window")) return false;
  if (wall.type === "window") return false;
  const cross = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d1 = cross(ax, ay, bx, by, wall.x1, wall.y1);
  const d2 = cross(ax, ay, bx, by, wall.x2, wall.y2);
  const d3 = cross(wall.x1, wall.y1, wall.x2, wall.y2, ax, ay);
  const d4 = cross(wall.x1, wall.y1, wall.x2, wall.y2, bx, by);
  return ((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0)) && ((d3 <= 0 && d4 >= 0) || (d3 >= 0 && d4 <= 0));
}

export function hasLineOfEffect(board: BoardState, source: BoardToken, target: BoardToken): boolean {
  const from = blockCenter(source.mountId ? { ...source, mountId: undefined } : source);
  const to = blockCenter(target.mountId ? { ...target, mountId: undefined } : target);
  return !board.walls.some((wall) => segmentIntersectsWall(from.x, from.y, to.x, to.y, wall));
}

/** Altura do terreno sob o token (livro p.239: posição elevada dá +2 no ataque). */
export function elevationAt(board: BoardState, token: Pick<BoardToken, "gx" | "gy">): number {
  return board.map.terrain[`${token.gx},${token.gy}`]?.elevation ?? 0;
}

export type CoverLevel = "none" | "partial" | "total";

export function coverBetween(board: BoardState, source: BoardToken, target: BoardToken): CoverLevel {
  if (!hasLineOfEffect(board, source, target)) return "total";
  const cells = board.map.terrain;
  const steps = Math.max(1, cellDistance(source, target));
  for (let step = 1; step < steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(source.gx + (target.gx - source.gx) * ratio);
    const y = Math.round(source.gy + (target.gy - source.gy) * ratio);
    if (cells[`${x},${y}`]?.type === "cover") return "partial";
  }
  return "none";
}

export function isFlanking(board: BoardState, attacker: BoardToken, target: BoardToken): boolean {
  if (cellDistance(attacker, target) > 1) return false;
  return board.tokens.some((ally) => {
    if (ally.id === attacker.id || ally.side !== attacker.side || ally.defeated || cellDistance(ally, target) > 1) return false;
    const ax = Math.sign(attacker.gx - target.gx);
    const ay = Math.sign(attacker.gy - target.gy);
    const bx = Math.sign(ally.gx - target.gx);
    const by = Math.sign(ally.gy - target.gy);
    return ax === -bx && ay === -by;
  });
}

export function targetDefense(board: BoardState, source: BoardToken, target: BoardToken, ranged = false): number {
  const cover = coverBetween(board, source, target);
  const mods = conditionMods(target.conditions);
  const byCondition = mods.defense + (ranged ? mods.defenseVsRanged : mods.defenseVsMelee);
  return target.defense + byCondition + effectBonus(target, "defense") + (cover === "partial" ? 5 : cover === "total" ? 99 : 0);
}
