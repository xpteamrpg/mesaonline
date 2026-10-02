import type { BattleMap, ThreatTemplate } from "./types";
import { cellKey } from "./rules";
import { withBase } from "../utils/assetUrl";

function markRect(
  terrain: BattleMap["terrain"],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: "blocked" | "difficult" | "elevated" | "cover",
  elevation = 0,
) {
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) terrain[cellKey(x, y)] = { type, elevation };
  }
}

function tavernTerrain() {
  const terrain: BattleMap["terrain"] = {};
  markRect(terrain, 0, 0, 13, 0, "blocked");
  markRect(terrain, 0, 13, 13, 13, "blocked");
  markRect(terrain, 0, 0, 0, 13, "blocked");
  markRect(terrain, 13, 0, 13, 13, "blocked");
  markRect(terrain, 2, 2, 4, 3, "elevated", 1);
  markRect(terrain, 9, 2, 11, 3, "elevated", 1);
  markRect(terrain, 3, 5, 4, 5, "cover");
  markRect(terrain, 8, 5, 9, 5, "cover");
  markRect(terrain, 4, 8, 6, 8, "cover");
  markRect(terrain, 10, 8, 11, 9, "blocked");
  markRect(terrain, 2, 9, 2, 11, "difficult");
  return terrain;
}

function ruinsTerrain() {
  const terrain: BattleMap["terrain"] = {};
  markRect(terrain, 0, 0, 13, 0, "blocked");
  markRect(terrain, 0, 13, 13, 13, "blocked");
  markRect(terrain, 1, 1, 3, 2, "elevated", 2);
  markRect(terrain, 10, 1, 12, 3, "elevated", 2);
  markRect(terrain, 5, 4, 8, 6, "elevated", 1);
  markRect(terrain, 6, 5, 7, 5, "blocked");
  markRect(terrain, 3, 8, 4, 9, "cover");
  markRect(terrain, 9, 9, 11, 10, "difficult");
  markRect(terrain, 1, 5, 1, 8, "difficult");
  return terrain;
}

export const DEFAULT_MAPS: BattleMap[] = [
  {
    id: "taverna-fenix",
    name: "Ponte da Tormenta Rubra",
    location: "Cenário atual",
    image: withBase("/tactics/ponte-tempestade-rubra.jpg"),
    isoImage: withBase("/tactics/taverna-isometrica.png"),
    cols: 14,
    rows: 14,
    terrain: tavernTerrain(),
  },
  {
    id: "ruinas-akhall",
    name: "Fortaleza da Tormenta",
    location: "Ponte da Tormenta Rubra",
    image: withBase("/tactics/fortaleza-tempestade-rubra.jpg"),
    isoImage: withBase("/tactics/fortaleza-isometrica.png"),
    cols: 14,
    rows: 14,
    terrain: ruinsTerrain(),
  },
];

export const DEFAULT_THREATS: ThreatTemplate[] = [
  {
    id: "uktril",
    name: "Uktril da Tormenta",
    title: "Lefeu de infantaria, ND 5",
    symbol: "UK",
    sprite: withBase("/tactics/sprite-lefeu.png"),
    pv: 68,
    pm: 15,
    defense: 23,
    initiative: 8,
    luta: 15,
    pontaria: 8,
    damage: "2d8+8",
    crit: 19,
    critMultiplier: 2,
    attackType: "melee",
    rangeM: 1.5,
    movementM: 9,
    level: 5,
    spellDC: 18,
    actions: ["garras", "rajada-tormenta"],
    fortitude: 14,
    reflexes: 11,
    will: 9,
  },
  {
    id: "cultista",
    name: "Arauto de Aharadak",
    title: "Sacerdote da Devoradora, ND 6",
    symbol: "AA",
    sprite: withBase("/tactics/sprite-cultista.png"),
    pv: 54,
    pm: 32,
    defense: 21,
    initiative: 7,
    luta: 10,
    pontaria: 13,
    damage: "3d6+6",
    crit: 20,
    critMultiplier: 2,
    attackType: "ranged",
    rangeM: 18,
    movementM: 9,
    level: 6,
    spellDC: 20,
    actions: ["adaga", "chama-aharadak"],
    fortitude: 10,
    reflexes: 9,
    will: 16,
  },
  {
    id: "golem",
    name: "Golem de Aco-Rubi",
    title: "Construto de guerra, ND 7",
    symbol: "GR",
    pv: 95,
    pm: 10,
    defense: 25,
    initiative: 3,
    luta: 17,
    pontaria: 5,
    damage: "2d10+10",
    crit: 20,
    critMultiplier: 3,
    attackType: "melee",
    rangeM: 1.5,
    movementM: 6,
    level: 7,
    spellDC: 18,
    actions: ["garras"],
    fortitude: 18,
    reflexes: 6,
    will: 12,
  },
  {
    id: "goblin",
    name: "Goblin Salteador",
    title: "Humanoide pequeno, ND 1/2",
    symbol: "GS",
    pv: 12,
    pm: 3,
    defense: 15,
    initiative: 5,
    luta: 5,
    pontaria: 6,
    damage: "1d6+2",
    crit: 20,
    critMultiplier: 2,
    attackType: "ranged",
    rangeM: 9,
    movementM: 9,
    level: 2,
    spellDC: 13,
    actions: ["adaga"],
    fortitude: 3,
    reflexes: 6,
    will: 1,
  },
];


/** Dados de demonstração não povoam BOARD.tokens automaticamente. */
export const DEMO_DEFAULTS = { mapId: DEFAULT_MAPS[0].id } as const;
