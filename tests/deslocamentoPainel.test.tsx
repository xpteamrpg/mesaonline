import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterSheet, CombatActions } from "../src/components/mesaSkin/components/Panels";
import { SkinRuntimeContext, type SkinRuntime } from "../src/components/mesaSkin/runtime";

/** O deslocamento aparece no painel do personagem (exploração e combate), com os quadrados de 1,5 m e voo/escavação quando existem. */
const focus = (speed?: { walkM: number; flyM?: number; burrowM?: number }) => ({
  name: "Renard", subtitle: "x", combatSubtitle: "x", portrait: "kael", hp: 10, hpMax: 10, pm: 5, pmMax: 5, defense: 15, speed,
});
const runtimeFor = (speed?: { walkM: number; flyM?: number; burrowM?: number }) => ({ campaign: "Mesa", scene: "Cena", isMaster: true, focus: focus(speed), playerPortrait: "kael", skills: [], equipment: [], spells: [], powers: [], saves: [], attacks: [], hotkeys: [], rolls: [], group: [], initiative: [], mapTokens: [] }) as unknown as SkinRuntime;
const render = (node: React.ReactNode, runtime: SkinRuntime) => renderToStaticMarkup(<SkinRuntimeContext.Provider value={runtime}>{node}</SkinRuntimeContext.Provider>);

describe("deslocamento no painel do personagem", () => {
  it("exploração: chip D com os metros e, ao passar o mouse, os quadrados", () => {
    const html = render(<CharacterSheet links={{}} onAction={() => undefined} />, runtimeFor({ walkM: 9 }));
    expect(html).toMatch(/data-speed-chip[^>]*>D 9 m</);
    expect(html).toContain("9 m (6 quadrados)");
  });

  it("combate: linha Deslocamento, com voo e escavação quando existem", () => {
    const html = render(<CombatActions links={{}} onAction={() => undefined} />, runtimeFor({ walkM: 12, flyM: 18, burrowM: 6 }));
    expect(html).toContain("Deslocamento");
    expect(html).toContain("data-speed-line");
    expect(html).toContain("12 m (8 quadrados) · voo 18 m · escavação 6 m");
  });

  it("sem dado, mostra traço", () => {
    const html = render(<CharacterSheet links={{}} onAction={() => undefined} />, runtimeFor(undefined));
    expect(html).toMatch(/data-speed-chip[^>]*>D —</);
  });
});
