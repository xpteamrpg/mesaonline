import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe("preferências da mesa", () => {
  it("a escala do mapa começa desligada, liga e lembra; o modo atual é Minimalista", async () => {
    const prefs = await import("../src/game/mesaPreferences");
    expect(prefs.getPreferences()).toEqual({ showScale: false, tableMode: "minimal", gameSystem: "t20" });
    prefs.setPreferences({ showScale: true });
    expect(prefs.getPreferences().showScale).toBe(true);
    expect(JSON.parse(localStorage.getItem("mesa-preferences-v1")!).showScale).toBe(true);
  });
});

describe("o que foi rolado, em palavras", () => {
  it("diz perícia, ataque, dano, teste de resistência, iniciativa e rolagem livre", async () => {
    const { describeRoll } = await import("../src/components/mesa/skinRuntime");
    const roll = (kind: string, action: string, extra: Record<string, string> = {}) => describeRoll({ kind, action, target: "—", actor: "Kaleb", ...extra } as never);
    expect(roll("system", "Acrobacia")).toBe("Teste de perícia: Acrobacia");
    expect(roll("attack", "Machado de guerra", { target: "Goblin" })).toBe("Atacou com Machado de guerra em Goblin");
    expect(roll("damage", "Machado de guerra")).toBe("Dano de Machado de guerra");
    expect(roll("save", "Fortitude")).toBe("Teste de resistência: Fortitude");
    expect(roll("system", "Iniciativa")).toBe("Iniciativa");
    expect(roll("system", "Rolagem D12")).toBe("Rolagem livre (D12)");
    expect(roll("save", "Dano do fogo", { actor: "Mesa" })).toBe("Macro: Dano do fogo");
  });
});

describe("o que vai para o combate (Inventário e Ficha)", () => {
  const sheet = {
    id: "ficha-1",
    attacks: [
      { id: "a1", name: "Espada", skill: "Luta", damage: "1d8", critical: "19/x2", damageType: "Corte" },
      { id: "a2", name: "Adaga", skill: "Luta", damage: "1d4", critical: "19/x2", damageType: "Perfuração" },
    ],
    powers: [{ id: "p1", name: "Golpe Poderoso", type: "Combate", description: "Gaste 1 PM para causar mais dano.", cost: 1 }],
    spells: [], racialAbilities: [], classAbilities: [],
    equipment: [
      { id: "i1", name: "Poção de cura", quantity: 2, slots: 0.5, price: 30, description: "Recupera 2d8+2 PV.", category: "Consumível", equipped: false },
      { id: "i2", name: "Corda", quantity: 1, slots: 1, price: 1, description: "Corda de 15 m.", category: "Item Geral", equipped: false },
    ],
  } as never;
  const names = async (kind: "weapon" | "item" | "power") => {
    const { actionsForCharacter } = await import("../src/tactics/interpretation/characterActionAdapter");
    return actionsForCharacter(sheet).filter((action) => action.category === kind).map((action) => action.name);
  };

  it("sem nenhuma marca, aparece tudo o que a ficha tem (itens só os de combate)", async () => {
    expect(await names("weapon")).toEqual(["Espada", "Adaga"]);
    expect(await names("item")).toEqual(["Poção de cura"]);
  });

  it("com marcas, só o marcado; item marcado vira ação mesmo sem parecer de combate", async () => {
    const { toggleLoadout } = await import("../src/game/combatLoadout");
    toggleLoadout("ficha-1", "attacks", "a2");
    toggleLoadout("ficha-1", "items", "i2");
    expect(await names("weapon")).toEqual(["Adaga"]);
    expect(await names("item")).toEqual(["Corda"]);
    toggleLoadout("ficha-1", "attacks", "a2");
    expect(await names("weapon")).toEqual(["Espada", "Adaga"]);
  });
});

describe("hotkeys com ataque ou poder", () => {
  it("o slot guarda uma ação da ficha e o item sai do slot anterior", async () => {
    const { assignHotkey, readHotkeys } = await import("../src/game/hotkeys");
    assignHotkey("ficha-1", 1, "i1");
    assignHotkey("ficha-1", 2, "action:character:power:p1");
    expect(readHotkeys("ficha-1").slice(0, 2)).toEqual(["i1", "action:character:power:p1"]);
    assignHotkey("ficha-1", 3, "action:character:power:p1");
    expect(readHotkeys("ficha-1").slice(0, 3)).toEqual(["i1", "", "action:character:power:p1"]);
  });
});

describe("Elenco", () => {
  let root: Root | undefined;
  let node: HTMLDivElement;
  beforeEach(() => { node = document.createElement("div"); document.body.appendChild(node); });
  afterEach(() => { act(() => root?.unmount()); node.remove(); root = undefined; });

  it("separa Heróis e Ameaças; edita só o essencial e guarda o resto em 'Mais opções do mestre'", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { default: MesaGlobalPanel } = await import("../src/components/mesa/MesaGlobalPanel");
    const { tacticalViewForToken } = await import("../src/integration/modernRpgCharacterBridge");
    bridge.addToken(makeToken({ id: "h1", name: "Aro", side: "heroes" }));
    bridge.addToken(makeToken({ id: "m1", name: "Goblin", side: "threats", gx: 3 }));
    bridge.selectToken("h1");
    const snapshot = bridge.getRuntimeSnapshot();
    const units = snapshot.board.tokens.map(tacticalViewForToken);
    await act(async () => {
      root = createRoot(node);
      root.render(<MesaGlobalPanel panel="roster" snapshot={snapshot} units={units} selectedUnit={units.find((unit) => unit.id === "h1")} onClose={() => undefined} onOpenCharacter={() => undefined} onOpenCharacters={() => undefined} onOpenThreats={() => undefined}/>);
    });
    const text = () => node.textContent || "";
    expect(text()).toContain("HERÓIS · 1");
    expect(text()).toContain("AMEAÇAS · 1");
    for (const label of ["Condições", "Montaria ou parceiro", "Defesa"]) expect(text(), label).toContain(label);
    expect(text()).toContain("Personagem ou ficha");
    expect(text()).not.toContain("ITENS, BAÚS E TESOUROS");
    expect(text()).not.toContain("Fichas");
    expect(text()).not.toContain("AURA E LUZ");
    expect(text()).not.toContain("Controle do token");
    await act(async () => [...node.querySelectorAll("button")].find((button) => button.textContent === "Mais opções do mestre")!.click());
    expect(text()).toContain("Controle do token");
    expect(text()).toContain("AURA E LUZ");
  });
});
