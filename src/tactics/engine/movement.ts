import { activeGrid, metersToCells, stepCost } from "../../game/distance";
import { adjustedSpeedM } from "../../game/conditionEffects";
import type { BoardState, BoardToken, BoardWall } from "../../game/types";
import { floorOf } from "../../game/floors";
import { coveredCells, sideOf, tokenCovers } from "../../game/tokenSize";

export interface Speeds {
  walk: number;
  fly: number;
  burrow: number;
}

/** Lê "9m (6q), voo 12m" e preserva deslocamentos especiais. */
export function speeds(raw: unknown, fallback = 9): Speeds {
  if (typeof raw === "number") return { walk: raw, fly: 0, burrow: 0 };
  const out: Speeds = { walk: fallback, fly: 0, burrow: 0 };
  let sawWalk = false;
  for (const part of String(raw || "").split(/[,;]/)) {
    const match = part.match(/(\d+(?:[.,]\d+)?)\s*m/i);
    if (!match) continue;
    const value = Number(match[1].replace(",", "."));
    if (/voo|voar|a[eé]reo/i.test(part)) out.fly = value;
    else if (/escava|subterr/i.test(part)) out.burrow = value;
    else { out.walk = value; sawWalk = true; }
  }
  if (!sawWalk && /apenas\s+voo/i.test(String(raw))) out.walk = 0;
  return out;
}

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

function wallBlocks(wall: BoardWall): boolean {
  if ((wall.type === "door" || wall.type === "window") && wall.open) return false;
  if (wall.type === "window") return true;
  return true;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
}

function intersects(ax: number, ay: number, bx: number, by: number, wall: BoardWall) {
  const o1 = orientation(ax, ay, bx, by, wall.x1, wall.y1);
  const o2 = orientation(ax, ay, bx, by, wall.x2, wall.y2);
  const o3 = orientation(wall.x1, wall.y1, wall.x2, wall.y2, ax, ay);
  const o4 = orientation(wall.x1, wall.y1, wall.x2, wall.y2, bx, by);
  return o1 !== o2 && o3 !== o4;
}

export function movementBlocked(board: BoardState, from: { x: number; y: number; floor?: number }, to: { x: number; y: number }, flying = false): boolean {
  const terrain = board.map.terrain[cellKey(to.x, to.y)];
  if (!flying && terrain?.type === "blocked") return true;
  if (flying) return false;
  // Baú fechado é obstáculo (V3: "baús fechados bloqueiam movimento"); aberto, dá para passar.
  if (board.objects.some((object) => object.kind === "chest" && !object.opened && object.x === to.x && object.y === to.y && floorOf(object) === floorOf(from))) return true;
  const ax = from.x + 0.5;
  const ay = from.y + 0.5;
  const bx = to.x + 0.5;
  const by = to.y + 0.5;
  if (board.walls.some((wall) => floorOf(wall) === floorOf(from) && wallBlocks(wall) && intersects(ax, ay, bx, by, wall))) return true;

  // Bloqueio de canto: diagonal não atravessa duas quinas sólidas.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx && dy) {
    const horizontalBlocked = board.map.terrain[cellKey(from.x + dx, from.y)]?.type === "blocked";
    const verticalBlocked = board.map.terrain[cellKey(from.x, from.y + dy)]?.type === "blocked";
    if (horizontalBlocked && verticalBlocked) return true;
  }
  return false;
}


/** Unidade viva e visivel, de outro token, ocupando a celula no andar do token (o bloco inteiro conta: Grande 2x2, Enorme 3x3...). */
function occupantOf(board: BoardState, token: BoardToken, x: number, y: number): BoardToken | undefined {
  return board.tokens.find((entry) => entry.id !== token.id && entry.id !== token.mountId && entry.id !== token.riderId && floorOf(entry) === floorOf(token) && !entry.hidden && !entry.defeated && tokenCovers(entry, x, y));
}

/** Passo do bloco do token (canto superior esquerdo em `from`) para `to`: cada casa do bloco precisa caber no mapa e passar por paredes e terreno. */
function footprintStepBlocked(board: BoardState, token: BoardToken, from: { x: number; y: number }, to: { x: number; y: number }, ghost: boolean): boolean {
  const side = Math.max(1, sideOf(token));
  for (let ox = 0; ox < side; ox += 1) {
    for (let oy = 0; oy < side; oy += 1) {
      const nx = to.x + ox, ny = to.y + oy;
      if (nx < 0 || ny < 0 || nx >= board.map.cols || ny >= board.map.rows) return true;
      if (movementBlocked(board, { x: from.x + ox, y: from.y + oy, floor: token.floor }, { x: nx, y: ny }, ghost)) return true;
    }
  }
  return false;
}

/** Alguma casa do bloco em `to` tem unidade de lado oposto (bloqueia a passagem)? */
function hostileInFootprint(board: BoardState, token: BoardToken, to: { x: number; y: number }): boolean {
  return coveredCells(token, to).some((cell) => { const other = occupantOf(board, token, cell.x, cell.y); return Boolean(other && other.side !== token.side); });
}

/** Alguma casa do bloco em `to` está tomada por outra unidade (ninguém termina o movimento em cima de outra)? */
export function footprintOccupied(board: BoardState, token: BoardToken, to: { x: number; y: number }): boolean {
  return coveredCells(token, to).some((cell) => Boolean(occupantOf(board, token, cell.x, cell.y)));
}

/** Quem se move quando o cavaleiro anda: o par anda pela montaria (tamanho e deslocamento dela). */
export function moverOf(board: Pick<BoardState, "tokens">, token: BoardToken): BoardToken {
  return (token.mountId && board.tokens.find((entry) => entry.id === token.mountId)) || token;
}

/** Exploração não tem limite de distância: o orçamento é grande o bastante para cobrir o mapa (paredes, ocupação e condições como Imóvel continuam valendo). */
export const EXPLORATION_BUDGET_M = 100000;

export interface ReachableOptions {
  mode?: "walk" | "fly" | "burrow";
  budgetM?: number;
  ignoreCreatures?: boolean;
}

/** Dijkstra com terreno difícil, elevação, paredes, portas e bloqueio de canto. */
export function reachableCells(board: BoardState, token: BoardToken, options: ReachableOptions = {}): Map<string, number> {
  const mode = options.mode || "walk";
  const flying = mode === "fly";
  const budgetM = adjustedSpeedM(token.conditions, options.budgetM ?? (flying ? token.flyM || 0 : mode === "burrow" ? token.burrowM || 0 : token.movementM));
  const budget = Math.max(0, metersToCells(budgetM, activeGrid()));
  const result = new Map<string, number>([[cellKey(token.gx, token.gy), 0]]);
  const queue = [{ x: token.gx, y: token.gy, cost: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost > (result.get(cellKey(current.x, current.y)) ?? Infinity)) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (!dx && !dy) continue;
        const x = current.x + dx;
        const y = current.y + dy;
        const key = cellKey(x, y);
        if (footprintStepBlocked(board, token, current, { x, y }, flying || mode === "burrow")) continue;
        // Unidade de lado oposto bloqueia; aliada pode ser atravessada (mas nao ocupada, ver abaixo).
        if (!options.ignoreCreatures && hostileInFootprint(board, token, { x, y })) continue;
        const fromCell = board.map.terrain[cellKey(current.x, current.y)];
        const cell = board.map.terrain[key];
        let step = stepCost(dx, dy, activeGrid()); // regra unica: game/distance.ts
        if (!flying && mode !== "burrow" && coveredCells(token, { x, y }).some((c) => board.map.terrain[cellKey(c.x, c.y)]?.type === "difficult")) step *= 2;
        if (!flying && mode !== "burrow") step += Math.max(0, (cell?.elevation || 0) - (fromCell?.elevation || 0));
        const cost = current.cost + step;
        if (cost > budget || cost >= (result.get(key) ?? Infinity)) continue;
        result.set(key, cost);
        queue.push({ x, y, cost });
      }
    }
  }
  // Aliados podem ser atravessados, mas ninguem termina o movimento sobre outra unidade.
  if (!options.ignoreCreatures) {
    for (const key of [...result.keys()]) {
      const [x, y] = key.split(",").map(Number);
      if (footprintOccupied(board, token, { x, y })) result.delete(key);
    }
  }
  return result;
}

/**
 * Dijkstra guardando o predecessor de cada celula, para reconstruir o CAMINHO.
 * Recuperado de `Vtt/app.js` (_wayCells / _wayFlatDist). Mesma regra de custo
 * de `reachableCells` — nao duplica logica, so lembra de onde veio.
 */
export function reachableWithPaths(
  board: BoardState, token: BoardToken, options: ReachableOptions = {},
): Map<string, { cost: number; from: string | null }> {
  const mode = options.mode || "walk";
  const flying = mode === "fly";
  const budgetM = adjustedSpeedM(token.conditions, options.budgetM ?? (flying ? token.flyM || 0 : mode === "burrow" ? token.burrowM || 0 : token.movementM));
  const budget = Math.max(0, metersToCells(budgetM, activeGrid()));
  const inicio = cellKey(token.gx, token.gy);
  const resultado = new Map<string, { cost: number; from: string | null }>([[inicio, { cost: 0, from: null }]]);
  const fila = [{ x: token.gx, y: token.gy, cost: 0 }];

  while (fila.length) {
    fila.sort((a, b) => a.cost - b.cost);
    const atual = fila.shift()!;
    const chaveAtual = cellKey(atual.x, atual.y);
    if (atual.cost > (resultado.get(chaveAtual)?.cost ?? Infinity)) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (!dx && !dy) continue;
        const x = atual.x + dx;
        const y = atual.y + dy;
        const key = cellKey(x, y);
        if (footprintStepBlocked(board, token, atual, { x, y }, flying || mode === "burrow")) continue;
        // Unidade de lado oposto bloqueia; aliada pode ser atravessada (mas nao ocupada, ver abaixo).
        if (!options.ignoreCreatures && hostileInFootprint(board, token, { x, y })) continue;
        const de = board.map.terrain[cellKey(atual.x, atual.y)];
        const cell = board.map.terrain[key];
        let step = stepCost(dx, dy, activeGrid());
        if (!flying && mode !== "burrow" && coveredCells(token, { x, y }).some((c) => board.map.terrain[cellKey(c.x, c.y)]?.type === "difficult")) step *= 2;
        if (!flying && mode !== "burrow") step += Math.max(0, (cell?.elevation || 0) - (de?.elevation || 0));
        const cost = atual.cost + step;
        if (cost > budget || cost >= (resultado.get(key)?.cost ?? Infinity)) continue;
        resultado.set(key, { cost, from: chaveAtual });
        fila.push({ x, y, cost });
      }
    }
  }
  return resultado;
}

/**
 * Caminho da origem ate o destino, celula a celula (inclui as duas pontas).
 * Devolve [] se o destino nao for alcancavel.
 */
export function pathTo(
  board: BoardState, token: BoardToken, target: { x: number; y: number }, options: ReachableOptions = {},
): string[] {
  const mapa = reachableWithPaths(board, token, options);
  const destino = cellKey(target.x, target.y);
  if (!mapa.has(destino)) return [];
  if (!options.ignoreCreatures && footprintOccupied(board, token, target)) return [];
  const caminho: string[] = [];
  let atual: string | null = destino;
  let guarda = 0;
  while (atual && guarda < 4096) {
    caminho.unshift(atual);
    atual = mapa.get(atual)?.from ?? null;
    guarda += 1;
  }
  return caminho;
}

export function movementRangeM(board: BoardState, token: BoardToken, options?: ReachableOptions): Set<string> {
  return new Set(reachableCells(board, token, options).keys());
}
