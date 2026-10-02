import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";
import { getBoard, removeToken, selectToken } from "../src/game/vttBridge";
import { getCharacterSheetById, loadCharacterSheets, loadReadyHeroSheets, upsertCharacterSheet } from "../ficha-modernrpg/characterRoute";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  selectToken(null);
  getBoard().tokens.filter((t) => t.modernRpgCharacterId?.startsWith("pronto-")).forEach((t) => removeToken(t.id));
  document.body.innerHTML = "";
});

function mount(element: React.ReactElement) {
  const node = document.createElement("div");
  document.body.appendChild(node);
  act(() => { root = createRoot(node); root.render(element); });
  return node;
}

describe("heróis prontos do playtest à disposição do Mestre", () => {
  it("são 3 fichas completas, que nunca entram na lista da conta", () => {
    const ready = loadReadyHeroSheets();
    expect(ready.map((s) => s.name)).toEqual(["Renard", "Astolfo", "Kalop Sita", "Lágrima desk"]);
    expect(ready.map((s) => s.level)).toEqual([3, 6, 3, 3]);
    for (const sheet of ready) {
      expect(getCharacterSheetById(sheet.id)?.name).toBe(sheet.name); // o token consegue achar a ficha
      expect(loadCharacterSheets().some((c) => c.id === sheet.id)).toBe(false);
      upsertCharacterSheet(sheet); // sincronizar PV do token não copia o herói pronto para a lista da conta
      expect(loadCharacterSheets().some((c) => c.id === sheet.id)).toBe(false);
    }
  });

  it("em Meus personagens o Mestre vê os 3 e adiciona o token ao mapa", async () => {
    window.location.hash = "#/mesa";
    const node = mount(<App />);
    await act(async () => [...node.querySelectorAll("button")].find((b) => b.textContent?.includes("Continuar mesa local"))!.click());
    await act(async () => (document.querySelector('[title="Meus personagens"]') as HTMLElement).click());
    const dialog = document.querySelector('[aria-label="Meus personagens"]')!;
    expect(dialog.textContent).toContain("Heróis prontos do playtest");
    for (const name of ["Renard", "Astolfo", "Kalop Sita", "Lágrima desk"]) expect(dialog.textContent).toContain(name);
    const renard = [...dialog.querySelectorAll(".mesa-char-pick")].find((b) => b.textContent?.includes("Renard")) as HTMLElement;
    await act(async () => renard.click());
    const token = getBoard().tokens.find((t) => t.modernRpgCharacterId === "pronto-renard");
    expect(token).toBeDefined();
    expect(token).toMatchObject({ name: "Renard", hpMax: 18, pmMax: 22, defense: 13 });
  });
});
