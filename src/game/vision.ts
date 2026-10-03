/**
 * CADEIA LUZ → VISÃO → FOG.
 *
 * Antes desta recuperação a Mesa tinha apenas CRUD: `setFog`, `upsertLight`,
 * `removeLight`. A luz acendia e não revelava nada para ninguém; a parede
 * bloqueava movimento e linha de efeito, mas não bloqueava visão.
 *
 * Portado e adaptado de `Vtt/app.js`:
 *   wallBlocksVision · _raySegIntersect · rayHitsWall · computeVisibility
 *   getEffectiveVisionRadius · adicionarCelulasAuraLight · atualizarFogJogador
 *
 * Diferenças conscientes em relação ao original:
 *   - sem andares (`getFloorFromZ`): a Mesa ainda não tem multinível (Grupo 2, item 36).
 *     As chaves de célula seguem o formato "x,y" do BOARD atual.
 *   - trabalha em coordenadas de grade, não em pixels.
 */
import type { BoardState, BoardToken, BoardWall, WeatherType } from "./types";
import { type GridSettings, activeGrid } from "./distance";
import { activeFloor, floorOf } from "./floors";

/** Tipo de visão do token. `dark` é a Visão no Escuro (darkvision) do T20. */
export type VisionType = "normal" | "penumbra" | "dark" | "magic";

/** Iluminação ambiente da cena. */
export type LightingType = "sunny" | "twilight" | "starnight" | "darknight" | "cave";

export const LIGHTING_LABEL: Record<LightingType, string> = {
  sunny: "Luz do dia",
  twilight: "Penumbra",
  starnight: "Noite estrelada",
  darknight: "Escuridão",
  cave: "Escuridão mágica",
};

export interface FogSettings {
  /** o fog dos jogadores é calculado e aplicado */
  playerFogEnabled: boolean;
  /** o Mestre enxerga a prévia do que o jogador enxerga */
  masterSeesPreview: boolean;
  /** em escuridão total, só as luzes revelam */
  darknessRevealedOnlyByLights: boolean;
  /** mover heróis marca as células como exploradas */
  exploreOnMove: boolean;
  /** áreas já exploradas continuam em penumbra em vez de voltar ao breu */
  keepExploredDim: boolean;
  /** visão própria do token, em casas */
  ownVisionCells: number;
  /** opacidade do fog, 0..1 */
  opacity: number;
}

export const DEFAULT_FOG_SETTINGS: FogSettings = {
  playerFogEnabled: true,
  masterSeesPreview: false,
  darknessRevealedOnlyByLights: true,
  exploreOnMove: true,
  keepExploredDim: true,
  ownVisionCells: 4,
  opacity: 0.94,
};

/**
 * Deduz o tipo de visao a partir do TEXTO da ficha (raca, raciais, poderes).
 * O T20 concede "Visao no Escuro" e "Visao na Penumbra" por raca/habilidade;
 * nao ha campo dedicado no CharacterSheet, entao lemos o que a Oficina grava.
 */
export function visionTypeFromText(...fontes: Array<string | undefined | null>): VisionType {
  const texto = fontes.filter(Boolean).join(" · ").toLowerCase();
  // Só duas habilidades do sistema enxergam a Escuridão mágica (informado pelo usuário em 03/10): Visão nas Trevas e Percepção às Cegas.
  if (/vis[aã]o\s+nas\s+trevas|percep[cç][aã]o\s+[aà]s\s+cegas/.test(texto)) return "magic";
  if (/vis[aã]o\s+no\s+escuro|darkvision/.test(texto)) return "dark";
  if (/vis[aã]o\s+na\s+penumbra|penumbra|low-?light/.test(texto)) return "penumbra";
  return "normal";
}

/**
 * Regra UNICA de visibilidade de token. Vale para o token inteiro — retrato,
 * nome, barras de PV/PM, condicoes, aura, selecao e indicadores.
 * Nao basta esconder a imagem e deixar o nome aparecendo.
 */
export function tokenVisible(
  unit: { x: number; y: number; side?: string; id?: string },
  options: { visible: Set<string>; isMaster: boolean; masterSeesPreview: boolean; fogEnabled: boolean; ownedIds?: Set<string> },
): boolean {
  if (!options.fogEnabled) return true;
  if (options.isMaster && !options.masterSeesPreview) return true;
  if (unit.side === "heroes") {
    // Sem a lista dos meus tokens (telas antigas), o jogador vê todos os aliados. Com ela, vale a regra da mesa: os meus eu sempre vejo;
    // o personagem de outro jogador só aparece se estiver dentro do campo de visão (iluminado) de um dos meus.
    if (!options.ownedIds || options.isMaster || (unit.id && options.ownedIds.has(unit.id))) return true;
  }
  return options.visible.has(`${unit.x},${unit.y}`);
}

export function fogSettings(partial?: Partial<FogSettings> | null): FogSettings {
  return { ...DEFAULT_FOG_SETTINGS, ...(partial || {}) };
}

/** Iluminação implícita quando a cena não define uma. */
export function lightingFromWeather(_weather: WeatherType): LightingType {
  // As regras de clima ainda não existem: o clima é só visual e não altera a visão (decisão do usuário, 03/10).
  return "sunny";
}

export function boardLighting(board: BoardState): LightingType {
  return board.lighting || lightingFromWeather(board.weather);
}

/**
 * Paredes que bloqueiam LINHA DE VISÃO.
 * Porta aberta e janela não bloqueiam; janela fechada também não (dá para ver através).
 */
export function wallBlocksVision(wall: BoardWall): boolean {
  if (wall.type === "invisible") return false;
  if (wall.type === "window") return false;
  if (wall.type === "door" && wall.open) return false;
  return true;
}

/** Intersecção segmento × segmento (`_raySegIntersect` do VTT antigo). */
export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const rdx = bx - ax, rdy = by - ay;
  const sdx = dx - cx, sdy = dy - cy;
  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((cx - ax) * sdy - (cy - ay) * sdx) / denom;
  const u = ((cx - ax) * rdy - (cy - ay) * rdx) / denom;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

/** `true` se o raio origem→alvo cruza alguma parede que bloqueia visão. */
export function rayHitsWall(
  ax: number, ay: number, bx: number, by: number, walls: BoardWall[],
): boolean {
  return walls.some((wall) =>
    wallBlocksVision(wall) && segmentsIntersect(ax, ay, bx, by, wall.x1, wall.y1, wall.x2, wall.y2));
}

/**
 * Alcance de visão em casas, por tipo de visão × iluminação × condições.
 * Regra do VTT antigo, preservada: Cego = 1 casa; Visão no Escuro enxerga 9 m
 * mesmo em escuridão total; Penumbra não enxerga em escuridão total.
 */
export function effectiveVisionRadius(
  token: BoardToken,
  lighting: LightingType,
  settings: FogSettings = DEFAULT_FOG_SETTINGS,
  grid: GridSettings = activeGrid(),
): number {
  if (token.conditions?.some((entry) => /cego|blind/i.test(entry))) return 1;
  const visionType: VisionType = token.visionType || "normal";
  const base = token.visionCells || settings.ownVisionCells * 3;
  const shortRange = Math.round(9 / grid.scale); // 9 m → 6 casas a 1,5 m

  if (lighting === "sunny") return base;

  if (lighting === "twilight") {
    if (visionType === "penumbra" || visionType === "dark") return shortRange;
    return Math.ceil(base * 0.5);
  }

  if (lighting === "starnight") {
    if (visionType === "penumbra" || visionType === "dark") return shortRange;
    return Math.ceil(base * 0.35);
  }

  if (lighting === "darknight") {
    if (visionType === "dark" || visionType === "magic") return shortRange;
    return 0;
  }

  // Escuridão mágica (chave interna "cave"): nem a Visão no Escuro comum enxerga; só quem tem habilidade para ver a escuridão mágica.
  if (lighting === "cave") return visionType === "magic" ? shortRange : 0;

  return base;
}

/** Células que uma origem enxerga, respeitando paredes. */
export function computeVisibility(
  board: BoardState,
  origin: { gx: number; gy: number; floor?: number },
  radius: number,
): Set<string> {
  const visible = new Set<string>();
  if (radius <= 0) return visible;
  // Barreiras de outro andar nunca bloqueiam a visão deste token.
  const floor = floorOf(origin);
  const walls = board.walls.filter((wall) => floorOf(wall) === floor && wallBlocksVision(wall));
  const ox = origin.gx + 0.5;
  const oy = origin.gy + 0.5;

  for (let dgx = -radius; dgx <= radius; dgx += 1) {
    for (let dgy = -radius; dgy <= radius; dgy += 1) {
      if (dgx * dgx + dgy * dgy > radius * radius) continue;
      const gx = origin.gx + dgx;
      const gy = origin.gy + dgy;
      if (gx < 0 || gy < 0 || gx >= board.map.cols || gy >= board.map.rows) continue;
      if (!rayHitsWall(ox, oy, gx + 0.5, gy + 0.5, walls)) visible.add(`${gx},${gy}`);
    }
  }
  visible.add(`${origin.gx},${origin.gy}`);
  return visible;
}

/**
 * Células iluminadas por fontes de luz acesas, respeitando paredes.
 * É o elo que faltava: acender uma tocha passa a revelar área.
 */
export function lightedCells(
  board: BoardState,
  grid: GridSettings = activeGrid(),
  floor = activeFloor(board),
): Set<string> {
  const lit = new Set<string>();
  for (const light of board.lights) {
    if (!light.enabled || floorOf(light) !== floor) continue;
    const radius = Math.max(0, Math.ceil(light.radius / grid.scale));
    for (const key of computeVisibility(board, { gx: light.x, gy: light.y, floor }, radius)) lit.add(key);
  }
  // Auras que iluminam tambem revelam (adicionarCelulasAuraLight do VTT antigo).
  for (const token of board.tokens) {
    if (floorOf(token) !== floor || !token.aura?.light || token.aura.active === false) continue;
    const radius = Math.max(0, Math.ceil((token.aura.radiusM || 0) / grid.scale));
    if (!radius) continue;
    for (const key of computeVisibility(board, token, radius)) lit.add(key);
  }
  return lit;
}

export interface VisionResult {
  /** o que os tokens indicados enxergam agora */
  visible: Set<string>;
  /** células iluminadas por fontes de luz */
  lit: Set<string>;
}

/**
 * Visão combinada de um conjunto de tokens.
 * Em escuridão total com `darknessRevealedOnlyByLights`, quem não tem Visão no
 * Escuro só enxerga o que estiver iluminado.
 */
export function visionForTokens(
  board: BoardState,
  tokens: BoardToken[],
  settings: FogSettings = DEFAULT_FOG_SETTINGS,
  grid: GridSettings = activeGrid(),
): VisionResult {
  const lighting = boardLighting(board);
  const floor = activeFloor(board);
  const lit = lightedCells(board, grid, floor);
  const visible = new Set<string>();
  const darkScene = lighting === "darknight" || lighting === "cave";

  for (const token of tokens) {
    // A visão não atravessa andares. Trocar o andar ativo troca também o
    // conjunto de luzes, paredes e tokens que participam do cálculo.
    if (floorOf(token) !== floor) continue;
    const radius = effectiveVisionRadius(token, lighting, settings, grid);
    const own = computeVisibility(board, token, Math.max(radius, settings.ownVisionCells));
    for (const key of own) {
      const withinNaturalVision = radius > 0
        && computeVisibility(board, token, radius).has(key);
      if (withinNaturalVision) { visible.add(key); continue; }
      // fora do alcance natural: só entra se estiver iluminado e visível pela luz
      if (settings.darknessRevealedOnlyByLights && lit.has(key)) visible.add(key);
      else if (!darkScene && !settings.darknessRevealedOnlyByLights) visible.add(key);
    }
    visible.add(`${token.gx},${token.gy}`);
  }

  if (settings.darknessRevealedOnlyByLights && darkScene) {
    // a luz revela por si, mesmo longe dos tokens
    for (const key of lit) visible.add(key);
  }

  return { visible, lit };
}

/**
 * Fog que o jogador deve ver: tudo que NÃO está visível fica coberto.
 * Áreas já exploradas continuam reveladas quando `keepExploredDim`.
 */
export function fogForVision(
  board: BoardState,
  visible: Set<string>,
  settings: FogSettings = DEFAULT_FOG_SETTINGS,
): Set<string> {
  const covered = new Set<string>();
  const explored = new Set(board.explored || []);
  for (let x = 0; x < board.map.cols; x += 1) {
    for (let y = 0; y < board.map.rows; y += 1) {
      const key = `${x},${y}`;
      if (visible.has(key)) continue;
      if (settings.keepExploredDim && explored.has(key)) continue;
      covered.add(key);
    }
  }
  return covered;
}
