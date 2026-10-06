import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBoard, makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe("regras de clima (Tormenta20 p.267)", () => {
  it("cada clima tem seu rótulo e as regras mostradas ao passar o mouse; cinzas e Tormenta não têm regra mecânica no livro", async () => {
    const { weatherRule, WEATHER_RULES } = await import("../src/game/weatherRules");
    expect(weatherRule("rain")).toMatchObject({ label: "Chuva", perception: -5, ranged: -2, difficultTerrain: false });
    expect(weatherRule("snow")).toMatchObject({ label: "Neve", perception: -5, ranged: -2, difficultTerrain: true });
    expect(weatherRule("storm")).toMatchObject({ label: "Tempestade", perception: -10, ranged: -5 });
    expect(weatherRule("storm").lightning).toEqual({ chance: 0.1, damage: "8d10" });
    expect(weatherRule("fog").concealment).toBe("light");
    expect(weatherRule("clear")).toMatchObject({ perception: 0, ranged: 0, difficultTerrain: false, concealment: "none" });
    for (const key of Object.keys(WEATHER_RULES) as Array<keyof typeof WEATHER_RULES>) expect(WEATHER_RULES[key].lines.length).toBeGreaterThan(0);
    expect(weatherRule("embers").lines.join(" ")).toMatch(/livro não traz regras/);
  });

  it("neve faz todo o terreno custar o dobro para andar", async () => {
    const { reachableWithPaths } = await import("../src/tactics/engine/movement");
    const hero = makeToken({ id: "h", gx: 5, gy: 5, side: "heroes", movementM: 9 });
    const reach = (weather: "clear" | "snow") => reachableWithPaths(makeBoard([hero], { weather }), hero, 9 / 1.5 * 1.5).size;
    expect(reach("snow")).toBeLessThan(reach("clear"));
  });

  it("raio da tempestade: com sorte baixa atinge uma criatura e tira PV; com sorte alta não acontece; fora da tempestade nunca", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { applyWeatherRoundStart } = await import("../src/tactics/engine/weatherEffects");
    bridge.addToken(makeToken({ id: "v", name: "Vítima", side: "heroes", gx: 3, gy: 3, hp: 500, hpMax: 500 }));
    expect(applyWeatherRoundStart(() => 0)).toEqual({}); // sem tempestade
    bridge.setWeather("storm");
    expect(applyWeatherRoundStart(() => 0.9)).toEqual({}); // 90% > 10%: sem raio
    const hit = applyWeatherRoundStart(() => 0);
    expect(hit.struck?.id).toBe("v");
    expect(hit.damage).toBeGreaterThanOrEqual(8);
    expect(hit.damage).toBeLessThanOrEqual(80);
    expect(bridge.getBoard().tokens.find((t) => t.id === "v")!.hp).toBe(500 - hit.damage!);
  });
});

describe("camuflagem (p.238) e iluminação", () => {
  it("névoa dá camuflagem leve; atacante cego, total; céu limpo, nenhuma", async () => {
    const { concealmentAgainst, concealmentMiss } = await import("../src/tactics/engine/concealment");
    const atk = makeToken({ id: "a", gx: 1, gy: 1 });
    const tgt = makeToken({ id: "t", gx: 3, gy: 1 });
    expect(concealmentAgainst(makeBoard([atk, tgt], { weather: "clear" }), atk, tgt).level).toBe("none");
    expect(concealmentAgainst(makeBoard([atk, tgt], { weather: "fog" }), atk, tgt).level).toBe("light");
    expect(concealmentAgainst(makeBoard([atk, tgt], { weather: "clear" }), { ...atk, conditions: ["Cego"] }, tgt).level).toBe("total");
    expect(concealmentMiss("light")).toBe(0.2);
    expect(concealmentMiss("total")).toBe(0.5);
  });

  it("escuridão só gera camuflagem quando foi escolhida à mão; Visão no Escuro e nas Trevas a ignoram de perto; luz do mapa apaga a escuridão", async () => {
    const { concealmentAgainst } = await import("../src/tactics/engine/concealment");
    const atk = makeToken({ id: "a", gx: 1, gy: 1 });
    const tgt = makeToken({ id: "t", gx: 3, gy: 1 });
    const dark = (extra = {}) => makeBoard([atk, tgt], { lighting: "darknight", lightingManual: true, ...extra });
    expect(concealmentAgainst(dark(), atk, tgt).level).toBe("total");
    expect(concealmentAgainst(makeBoard([atk, tgt], { weather: "rain", lighting: "twilight", lightingManual: false }), atk, tgt).level).toBe("none"); // penumbra vinda do clima é regra da casa
    expect(concealmentAgainst(dark(), { ...atk, visionType: "dark" }, tgt).level).toBe("none");
    expect(concealmentAgainst(makeBoard([atk, tgt], { lighting: "cave", lightingManual: true }), { ...atk, visionType: "dark" }, tgt).level).toBe("total"); // escuridão mágica: só quem tem Visão nas Trevas
    expect(concealmentAgainst(makeBoard([atk, tgt], { lighting: "cave", lightingManual: true }), { ...atk, visionType: "magic" }, tgt).level).toBe("none");
    const lit = dark({ lights: [{ id: "l", x: 3, y: 1, radius: 6, enabled: true, type: "torch" }] });
    expect(concealmentAgainst(lit, atk, tgt).level).toBe("none");
  });
});
