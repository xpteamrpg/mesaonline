import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, requireLogin: () => true, openAuthModal: () => undefined }) }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); vi.resetModules(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("guildas", () => {
  it("a lista mostra a Armada de Vectora e, ao entrar, o dono recebe e há 4 lojas de exemplo e o botão de criar loja", async () => {
    const { GuildsView } = await import("../src/portal/components/views/GuildsView");
    await act(async () => { root.render(<GuildsView />); });
    expect(host.textContent).toContain("Armada de Vectora");
    expect(host.textContent).toContain("0 personagens");
    await act(async () => { (host.querySelector("[data-enter-guild]") as HTMLButtonElement).click(); });
    const page = host.querySelector("[data-guild-page]")!;
    expect(page.textContent).toContain("Nicolas");
    expect(page.textContent).toContain("Dono da guilda");
    expect(page.querySelectorAll("[data-shop]")).toHaveLength(4);
    expect(page.textContent).toContain("exemplo");
    await act(async () => { (page.querySelector("[data-create-shop]") as HTMLButtonElement).click(); });
    expect(page.textContent).toContain("só quem está logado e dentro da guilda pode comprar");
  });

  it("o card Guildas do banner da home leva para a página de guildas", async () => {
    const { HomeBanner } = await import("../src/portal/components/views/HomeBanner");
    const go = vi.fn();
    await act(async () => { root.render(<HomeBanner onNavigate={go} />); });
    await act(async () => { (host.querySelector("[data-guilds-card]") as HTMLButtonElement).click(); });
    expect(go).toHaveBeenCalledWith("guilds");
  });
});

describe("card Mapa de Arton", () => {
  it("está na home, abre o projeto do Yuri Alessandro em outra aba e Homebrew continua no menu e na home", async () => {
    const { HomeView } = await import("../src/portal/components/views/PortalViews");
    await act(async () => { root.render(<HomeView onNavigate={() => undefined} characters={[]} />); });
    const link = host.querySelector("a[data-external-card]") as HTMLAnchorElement;
    expect(link.href).toBe("https://yurialessandro.github.io/artonMap/");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noreferrer");
    expect(link.textContent).toContain("Mapa de Arton");
    expect(host.textContent).toContain("Homebrew");
    const { MENU_CARDS } = await import("../src/portal/components/layout/menuCards");
    expect(MENU_CARDS.some((c) => c.view === "homebrew")).toBe(true);
  });
});

describe("condições Morto e Invisível", () => {
  it("entram na lista de condições com descrição", async () => {
    const { CONDITION_NAMES, conditionDescription } = await import("../src/game/conditionInfo");
    expect(CONDITION_NAMES).toContain("Morto");
    expect(CONDITION_NAMES).toContain("Invisível");
    expect(conditionDescription("Invisível")).toMatch(/camuflagem total/i);
  });

  it("Invisível dá camuflagem total a quem é atacado", async () => {
    const { concealmentAgainst } = await import("../src/tactics/engine/concealment");
    const bridge = await import("../src/game/vttBridge");
    const board = bridge.getBoard();
    const attacker = makeToken({ id: "a", side: "threats", gx: 1, gy: 1 });
    const visible = makeToken({ id: "v", side: "heroes", gx: 2, gy: 1 });
    const invisible = makeToken({ id: "i", side: "heroes", gx: 2, gy: 2, conditions: ["Invisível"] });
    expect(concealmentAgainst(board, attacker, visible).level).toBe("none");
    expect(concealmentAgainst(board, attacker, invisible).level).toBe("total");
  });

  it("Morto marcado à mão mata o token mesmo com PV, e tirar a condição o traz de volta", async () => {
    const bridge = await import("../src/game/vttBridge");
    bridge.addToken(makeToken({ id: "t1", side: "heroes", hp: 20, hpMax: 20 }));
    expect(bridge.getBoard().tokens.find((t) => t.id === "t1")!.dead).toBeFalsy();
    bridge.updateToken("t1", { conditions: ["Morto"] });
    expect(bridge.getBoard().tokens.find((t) => t.id === "t1")!.dead).toBe(true);
    bridge.updateToken("t1", { conditions: [] });
    expect(bridge.getBoard().tokens.find((t) => t.id === "t1")!.dead).toBe(false);
  });
});
