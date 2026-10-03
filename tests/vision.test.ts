import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOG_SETTINGS, boardLighting, computeVisibility, effectiveVisionRadius,
  fogForVision, fogSettings, lightedCells, tokenVisible, visionForTokens, wallBlocksVision,
} from "../src/game/vision";
import type { BoardWall } from "../src/game/types";
import { makeBoard, makeToken } from "./helpers";

const wall = (over: Partial<BoardWall> = {}): BoardWall => ({
  id: "w1", type: "wall", x1: 3, y1: 0, x2: 3, y2: 12, ...over,
});

describe("paredes bloqueiam visao", () => {
  it("parede bloqueia, porta aberta nao, janela nunca", () => {
    expect(wallBlocksVision(wall())).toBe(true);
    expect(wallBlocksVision(wall({ type: "door", open: false }))).toBe(true);
    expect(wallBlocksVision(wall({ type: "door", open: true }))).toBe(false);
    expect(wallBlocksVision(wall({ type: "window" }))).toBe(false);
    expect(wallBlocksVision(wall({ type: "invisible" }))).toBe(false);
  });

  it("uma parede corta a visao do outro lado", () => {
    const board = makeBoard([], { walls: [wall()] });
    const visivel = computeVisibility(board, { gx: 1, gy: 5 }, 8);
    expect(visivel.has("2,5")).toBe(true);   // antes da parede
    expect(visivel.has("6,5")).toBe(false);  // depois da parede
  });

  it("abrir a porta devolve a visao", () => {
    const fechada = makeBoard([], { walls: [wall({ type: "door", open: false })] });
    const aberta = makeBoard([], { walls: [wall({ type: "door", open: true })] });
    expect(computeVisibility(fechada, { gx: 1, gy: 5 }, 8).has("6,5")).toBe(false);
    expect(computeVisibility(aberta, { gx: 1, gy: 5 }, 8).has("6,5")).toBe(true);
  });
});

describe("alcance de visao por iluminacao e tipo", () => {
  const token = makeToken({ id: "t", gx: 5, gy: 5 });

  it("luz do dia da alcance cheio", () => {
    expect(effectiveVisionRadius(token, "sunny")).toBeGreaterThan(6);
  });

  it("escuridao total cega quem nao tem Visao no Escuro", () => {
    expect(effectiveVisionRadius(token, "darknight")).toBe(0);
    expect(effectiveVisionRadius({ ...token, visionType: "penumbra" }, "darknight")).toBe(0);
    expect(effectiveVisionRadius({ ...token, visionType: "dark" }, "darknight")).toBe(6);
  });

  it("penumbra reduz a visao normal pela metade", () => {
    const cheio = effectiveVisionRadius(token, "sunny");
    expect(effectiveVisionRadius(token, "twilight")).toBe(Math.ceil(cheio * 0.5));
  });

  it("a condicao Cego reduz a visao a uma casa", () => {
    const cego = { ...token, conditions: ["Cego"] };
    expect(effectiveVisionRadius(cego, "sunny")).toBe(1);
  });
});

describe("luz revela — o elo que faltava", () => {
  it("acender uma tocha ilumina celulas", () => {
    const apagada = makeBoard([], { lights: [{ id: "l1", x: 8, y: 8, type: "torch", name: "Tocha", radius: 6, color: "#fff", intensity: 1, enabled: false }] });
    const acesa = makeBoard([], { lights: [{ ...apagada.lights[0], enabled: true }] });
    expect(lightedCells(apagada).size).toBe(0);
    expect(lightedCells(acesa).has("8,8")).toBe(true);
    expect(lightedCells(acesa).size).toBeGreaterThan(10);
  });

  it("a parede tambem bloqueia a luz", () => {
    const semParede = makeBoard([], { lights: [{ id: "l1", x: 1, y: 5, type: "torch", name: "T", radius: 9, color: "#fff", intensity: 1, enabled: true }] });
    const comParede = makeBoard([], { walls: [wall()], lights: semParede.lights });
    expect(lightedCells(semParede).has("6,5")).toBe(true);
    expect(lightedCells(comParede).has("6,5")).toBe(false);
  });

  it("no breu, quem nao tem Visao no Escuro so enxerga o que a luz revela", () => {
    const heroi = makeToken({ id: "h", gx: 2, gy: 2 });
    const board = makeBoard([heroi], {
      lighting: "darknight",
      lights: [{ id: "l1", x: 9, y: 9, type: "torch", name: "T", radius: 4, color: "#fff", intensity: 1, enabled: true }],
    });
    const { visible } = visionForTokens(board, [heroi]);
    expect(visible.has("2,2")).toBe(true);   // a propria casa
    expect(visible.has("5,5")).toBe(false);  // breu
    expect(visible.has("9,9")).toBe(true);   // iluminado pela tocha
  });
});

describe("fog derivado da visao", () => {
  it("cobre o que nao se enxerga e respeita areas exploradas", () => {
    const heroi = makeToken({ id: "h", gx: 1, gy: 1 });
    const board = makeBoard([heroi], { explored: ["10,10"] });
    const { visible } = visionForTokens(board, [heroi]);

    const semMemoria = fogForVision(board, visible, fogSettings({ keepExploredDim: false }));
    const comMemoria = fogForVision(board, visible, fogSettings({ keepExploredDim: true }));

    expect(semMemoria.has("10,10")).toBe(true);
    expect(comMemoria.has("10,10")).toBe(false);
    expect(comMemoria.has("1,1")).toBe(false);
  });

  it("o clima NÃO altera a iluminação nem o alcance de visão (regras de clima ainda não existem)", () => {
    for (const weather of ["clear", "rain", "snow", "embers", "fog", "tormenta", "storm"] as const) {
      expect(boardLighting(makeBoard([], { weather }))).toBe("sunny");
    }
    expect(boardLighting(makeBoard([], { weather: "fog", lighting: "darknight" }))).toBe("darknight"); // o que o Mestre escolheu vale
    expect(boardLighting(makeBoard([], { weather: "clear", lighting: "cave" }))).toBe("cave");
  });

  it("Escuridão mágica: nem a Visão no Escuro comum enxerga; só quem tem a habilidade para isso", () => {
    const comum = makeToken({ id: "c", visionType: "normal" });
    const escuro = makeToken({ id: "d", visionType: "dark" });
    const magico = makeToken({ id: "m", visionType: "magic" });
    expect(effectiveVisionRadius(comum, "cave")).toBe(0);
    expect(effectiveVisionRadius(escuro, "cave")).toBe(0);
    expect(effectiveVisionRadius(magico, "cave")).toBe(6);
    // escuridão comum continua igual: a Visão no Escuro enxerga 9 m
    expect(effectiveVisionRadius(escuro, "darknight")).toBe(6);
    expect(effectiveVisionRadius(comum, "darknight")).toBe(0);
  });

  it("as configuracoes padrao existem e sao completas", () => {
    expect(Object.keys(DEFAULT_FOG_SETTINGS).sort()).toEqual([
      "darknessRevealedOnlyByLights", "exploreOnMove", "keepExploredDim",
      "masterSeesPreview", "opacity", "ownVisionCells", "playerFogEnabled",
    ]);
  });
});

describe("cada jogador vê pelos próprios personagens", () => {
  const a = () => makeToken({ id: "a", name: "A", side: "heroes", gx: 2, gy: 2, controlledBy: "jogadorA" });
  const b = () => makeToken({ id: "b", name: "B", side: "heroes", gx: 12, gy: 12, controlledBy: "jogadorB" });

  it("na escuridão, sem luz, o personagem de outro jogador não aparece; os meus sim", () => {
    const board = makeBoard([a(), b()], { lighting: "darknight", fogSettings: { playerFogEnabled: true } });
    const mineB = board.tokens.filter((t) => t.controlledBy === "jogadorB");
    const { visible } = visionForTokens(board, mineB, fogSettings(board.fogSettings));
    const opts = { visible, isMaster: false, masterSeesPreview: false, fogEnabled: true, ownedIds: new Set(["b"]) };
    expect(tokenVisible({ x: 12, y: 12, side: "heroes", id: "b" }, opts)).toBe(true);   // o meu
    expect(tokenVisible({ x: 2, y: 2, side: "heroes", id: "a" }, opts)).toBe(false);    // outro jogador, no escuro
  });

  it("com uma tocha acesa perto dele, o outro jogador passa a ver; quem tem Visão no Escuro vê sem luz", () => {
    const torch = { id: "l1", x: 2, y: 3, type: "torch", name: "Tocha", radius: 6, intensity: 1, color: "#ffcc66", enabled: true } as never;
    const lit = makeBoard([a(), b()], { lighting: "darknight", lights: [torch] });
    const { visible } = visionForTokens(lit, lit.tokens.filter((t) => t.controlledBy === "jogadorB"), fogSettings(lit.fogSettings));
    const opts = { visible, isMaster: false, masterSeesPreview: false, fogEnabled: true, ownedIds: new Set(["b"]) };
    expect(tokenVisible({ x: 2, y: 2, side: "heroes", id: "a" }, opts)).toBe(true);     // iluminado pela tocha

    const dark = makeBoard([a(), { ...b(), gx: 6, gy: 2, visionType: "dark" }], { lighting: "darknight" });
    const darkVisible = visionForTokens(dark, dark.tokens.filter((t) => t.controlledBy === "jogadorB"), fogSettings(dark.fogSettings)).visible;
    expect(tokenVisible({ x: 2, y: 2, side: "heroes", id: "a" }, { ...opts, visible: darkVisible })).toBe(true); // a 4 casas, dentro dos 9 m da Visão no Escuro
  });

  it("parede entre os dois esconde o outro personagem mesmo em plena luz", () => {
    const board = makeBoard([a(), { ...b(), gx: 6, gy: 2 }], { lighting: "sunny", walls: [{ id: "w", type: "wall", x1: 4, y1: 0, x2: 4, y2: 14 }] as never });
    const { visible } = visionForTokens(board, board.tokens.filter((t) => t.controlledBy === "jogadorB"), fogSettings(board.fogSettings));
    expect(tokenVisible({ x: 2, y: 2, side: "heroes", id: "a" }, { visible, isMaster: false, masterSeesPreview: false, fogEnabled: true, ownedIds: new Set(["b"]) })).toBe(false);
  });
});

describe("quem enxerga a Escuridão mágica", () => {
  it("só Visão nas Trevas e Percepção às Cegas dão a visão mágica; Visão no Escuro não", async () => {
    const { visionTypeFromText } = await import("../src/game/vision");
    expect(visionTypeFromText("Humano", "Visão nas Trevas: você enxerga...")).toBe("magic");
    expect(visionTypeFromText("Elfo", "Percepção às Cegas: ...")).toBe("magic");
    expect(visionTypeFromText("Anão", "Visão no Escuro")).toBe("dark");
    expect(visionTypeFromText("Elfo", "Visão na Penumbra")).toBe("penumbra");
    expect(visionTypeFromText("Humano")).toBe("normal");
    // quem tem as duas coisas fica com a mágica (também enxerga o escuro comum)
    expect(visionTypeFromText("x", "Visão no Escuro e Percepção às Cegas")).toBe("magic");
  });
});
