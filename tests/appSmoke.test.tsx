import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { removeCharacterSheetById, upsertCharacterSheet } from "../ficha-modernrpg/characterRoute";
import { addToken, getBoard, getCombatState, removeToken, selectToken } from "../src/game/vttBridge";
import { makeSheet, makeToken } from "./helpers";

const PORTAL_SHEET_ID = "portal-character-smoke";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  getBoard().tokens
    .filter((token) => token.id === "smoke-token" || token.modernRpgCharacterId === PORTAL_SHEET_ID)
    .forEach((token) => removeToken(token.id));
  removeCharacterSheetById(PORTAL_SHEET_ID);
});

describe("Mesa Online", () => {
  it("monta direto no lobby da Mesa, sem recriar o Portal", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    expect(node.textContent).toContain("Mesa Online");
    expect(node.textContent).toContain("Continuar mesa local");
    // O Portal é um site separado: a Mesa só oferece o retorno para ele.
    expect(node.textContent).toContain("Voltar ao Portal");
    expect(node.textContent).not.toContain("Ficha oficial");
    expect(node.textContent).not.toContain("Oficina de Heróis");
  });

  it("entra da lobby na exploração sem reload", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enter = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    expect(enter).toBeTruthy();
    await act(async () => enter!.click());
    // A mesa usa literalmente a fonte visual importada, sem remontar o shell
    // anterior da Armada. O modo ainda é controlado pelo mesmo App/runtime.
    expect(node.textContent).toContain("ARMADA NEXUS RPG");
    expect(node.textContent).toContain("Elenco");
    expect(node.querySelector('.appearance-table[data-mesa-view="explore"]')).toBeTruthy();
    expect(node.querySelector('img[alt="Ponte da Tormenta Rubra"]')).toBeTruthy();
  });

  it("traz fichas já guardadas para tokens reais da Mesa", async () => {
    upsertCharacterSheet(makeSheet({ id: PORTAL_SHEET_ID, name: "Heroína do Portal" }));
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enter = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    await act(async () => {
      enter!.click();
      await Promise.resolve();
    });
    const token = getBoard().tokens.find((entry) => entry.modernRpgCharacterId === PORTAL_SHEET_ID);
    expect(token).toBeTruthy();
    expect(token?.name).toBe("Heroína do Portal");
  });

  it("clicar numa perícia do painel rola o teste e registra no histórico", async () => {
    upsertCharacterSheet(makeSheet({ id: PORTAL_SHEET_ID, name: "Heroína do Portal" }));
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    await act(async () => [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"))!.click());
    const token = getBoard().tokens.find((entry) => entry.modernRpgCharacterId === PORTAL_SHEET_ID)!;
    await act(async () => { selectToken(token.id); });
    const skill = node.querySelector<HTMLButtonElement>('button[title="Rolar Acrobacia"]');
    expect(skill).toBeTruthy();
    await act(async () => skill!.click());
    expect(getCombatState().rolls.some((roll) => roll.action === "Acrobacia")).toBe(true);
  });

  it("Grupo abre o Elenco da cena na gaveta, sem abrir o Portal nem trocar a tela da Mesa", async () => {
    const openPortal = vi.spyOn(window, "open").mockReturnValue(null);
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enter = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    await act(async () => enter!.click());
    const group = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Elenco");
    await act(async () => group!.click());
    expect(openPortal).not.toHaveBeenCalled();
    expect(node.querySelector(".mesa-skin-drawer-host")?.textContent).toContain("Elenco");
    expect(node.querySelector('.appearance-table[data-mesa-view="explore"]')).toBeTruthy();
    openPortal.mockRestore();
  });

  it("abre o submenu de iluminação pelo ícone literal da máscara", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enterTable = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    await act(async () => enterTable!.click());
    const lighting = node.querySelector<HTMLButtonElement>('button[aria-label="Iluminação da mesa"]');
    expect(lighting).toBeTruthy();
    await act(async () => lighting!.click());
    expect(node.textContent).toContain("Fog, luz e clima");
    expect(node.querySelector('.appearance-table[data-mesa-view="explore"]')).toBeTruthy();
  });

  it("expõe Compêndio, Macros, Objetos, Música e undo/redo pelos botões da barra", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enterTable = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    await act(async () => enterTable!.click());

    const inventory = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Compêndio");
    await act(async () => inventory!.click());
    expect(node.textContent).toContain("Compêndio");

    const close = node.querySelector<HTMLButtonElement>('button[aria-label="Fechar painel"]');
    await act(async () => close!.click());
    const macros = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Macros");
    await act(async () => macros!.click());
    // Macros guarda só macros e gatilhos; as outras gavetas têm botão próprio.
    expect(node.textContent).toContain("MACROS GLOBAIS");
    expect(node.textContent).toContain("Gatilhos da cena");
    expect(node.textContent).toContain("Marque as casas na gaveta Ambientação");
    expect(node.textContent).not.toContain("Ordem de iniciativa");

    const closeMacros = node.querySelector<HTMLButtonElement>('button[aria-label="Fechar painel"]');
    await act(async () => closeMacros!.click());
    const music = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Música");
    await act(async () => music!.click());
    expect(node.querySelector(".mesa-skin-drawer-host")?.textContent).toContain("Loop");
    expect(node.querySelector(".mesa-skin-drawer-host")?.textContent).not.toContain("Arquivo local");
    await act(async () => node.querySelector<HTMLButtonElement>('button[aria-label="Fechar painel"]')!.click());
    const undo = node.querySelector<HTMLButtonElement>('button[aria-label="Desfazer última rolagem"]');
    await act(async () => undo!.click());
    expect(node.textContent).toContain("Desfazer e refazer");
  });

  it("configura áreas e objetos pelo botão Ambientação", async () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enterTable = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    await act(async () => enterTable!.click());
    const objects = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Ambientação");
    await act(async () => objects!.click());
    expect(node.textContent).toContain("Forma da área");
    expect(node.textContent).not.toContain("Alinhar mapa");
    expect(node.textContent).not.toContain("Mover token");
    expect(node.textContent).not.toContain("Condição do gatilho");
    expect(node.textContent).not.toContain("Ping");
    expect(node.textContent).not.toContain("Portas");
    // itens, armadilhas, luzes e mídia moram aqui, na Ambientação
    for (const section of ["ITENS, BAÚS E TESOUROS", "ARMADILHAS", "LUZES", "MÍDIA NA CENA"]) expect(node.textContent, section).toContain(section);
    expect(node.querySelector('.appearance-table[data-mesa-view="explore"]')).toBeTruthy();
  });

  it("alterna exploração → combate → exploração no mesmo App, sem reload", async () => {
    addToken(makeToken({ id: "smoke-token" }));
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => {
      root = createRoot(node);
      root.render(<App/>);
      await Promise.resolve();
    });
    const enterTable = [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"));
    await act(async () => enterTable!.click());
    const combatToggle = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Combate");
    await act(async () => {
      combatToggle!.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(node.querySelector('.appearance-table[data-mesa-view="combat"]')).toBeTruthy();
    const leaveCombat = [...node.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Encerrar combate");
    await act(async () => leaveCombat!.click());
    expect(node.querySelector('.appearance-table[data-mesa-view="explore"]')).toBeTruthy();
    expect(getBoard().tokens.some((token) => token.id === "smoke-token")).toBe(true);
  });

  it("clicar numa perícia rola e mostra o resultado na mesinha de dados (exploração)", async () => {
    const sheet = { ...makeSheet(), id: PORTAL_SHEET_ID, name: "Aro Rolador" };
    upsertCharacterSheet(sheet);
    const node = document.createElement("div");
    document.body.appendChild(node);
    await act(async () => { root = createRoot(node); root.render(<App/>); await Promise.resolve(); });
    await act(async () => [...node.querySelectorAll("button")].find((button) => button.textContent?.includes("Continuar mesa local"))!.click());
    await act(async () => { await Promise.resolve(); });
    const token = getBoard().tokens.find((entry) => entry.modernRpgCharacterId === PORTAL_SHEET_ID);
    expect(token).toBeTruthy();
    selectToken(token!.id);
    await act(async () => node.querySelector<HTMLElement>('[title="Rolar Acrobacia"]')!.click());
    expect(node.textContent).toContain("HISTÓRICO");
    expect(node.textContent).toContain("Acrobacia");
    expect(node.textContent).toMatch(/1d20[+-]\d+/);
    expect(node.querySelector("[data-dice-entry]")?.textContent).toMatch(/\[\d+\]/);
  });
});

