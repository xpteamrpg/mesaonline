import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Token } from "../src/components/mesaSkin/components/MapArea";
import { getStageControl, setViewAs } from "../src/components/mesa/mapStageControl";
import type { SkinMapToken } from "../src/components/mesaSkin/runtime";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: SkinMapToken = { id: "t1", name: "Kael", portrait: "kael", ring: "#d9a94c", x: 50, y: 50, hp: 10, hpMax: 20 };
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

function mount(token: SkinMapToken, onMenu?: (x: number, y: number) => void) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<Token token={token} mode="exploration" index={0} onSelect={() => {}} onMenu={onMenu} />));
  return host;
}

describe("token na exploração", () => {
  it("mostra as colunas de PV e PM ao lado só quando o PM vem preenchido (Mestre ou dono)", () => {
    expect(mount(base).querySelector("[data-token-stats]")).toBeNull();
    act(() => root?.unmount()); host?.remove();
    const stats = mount({ ...base, pm: 5, pmMax: 10 }).querySelector("[data-token-stats]");
    expect(stats?.getAttribute("title")).toBe("PV 10/20 · PM 5/10");
    expect(stats?.children.length).toBe(2);
  });

  it("botão direito chama o menu com a posição do clique; sem callback não intercepta", () => {
    const onMenu = vi.fn();
    const el = mount(base, onMenu).querySelector("[data-token-id]")!;
    act(() => { el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 80 })); });
    expect(onMenu).toHaveBeenCalledWith(120, 80);
    act(() => root?.unmount()); host?.remove();
    const plain = mount(base).querySelector("[data-token-id]")!;
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    act(() => { plain.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  });

  it("ver pela visão de um token é guardado no palco e pode ser desligado", () => {
    setViewAs("t1");
    expect(getStageControl().viewAsTokenId).toBe("t1");
    setViewAs(null);
    expect(getStageControl().viewAsTokenId).toBeNull();
  });
});
