import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBoard } from "../src/portal/lib/campaigns/board";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1", nickname: "Mestre Teste" }, requireLogin: () => true }) }));
// sem servidor de mesas: a cópia nasce só neste navegador (id local-…), que é o caminho que não depende de rede
vi.mock("../src/portal/lib/tables/client", async (original) => ({
  ...(await original<typeof import("../src/portal/lib/tables/client")>()),
  createTable: async () => { throw new Error("sem servidor"); },
}));
vi.mock("../src/portal/lib/campaigns/client", async (original) => ({
  ...(await original<typeof import("../src/portal/lib/campaigns/client")>()),
  myTables: async () => [], tableParty: async () => [], tableMembers: async () => [], characterRequests: async () => [], claimTable: async () => undefined,
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const buttonByText = (text: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

describe("campanhas oficiais e área do mestre", () => {
  it("Clonar no cartão da campanha oficial cria a campanha em Minhas campanhas com tudo da oficial", async () => {
    const { OnlineTableView } = await import("../src/portal/components/views/OnlineTableView");
    await act(async () => { root.render(<OnlineTableView />); });
    await flush();
    expect(host.textContent).not.toContain("A Libertação de Valkaria (minha cópia)");
    const clone = host.querySelector("button[data-clone-official]") as HTMLButtonElement;
    expect(clone.textContent).toBe("Clonar");
    await act(async () => { clone.click(); });
    await flush();
    // a lista "Minhas campanhas" mostra a cópia e o quadro dela já tem as missões, aliados e locais
    expect(host.textContent).toContain("A Libertação de Valkaria (minha cópia)");
    const links = JSON.parse(localStorage.getItem("tormenta20_online_my_tables_v1") || "[]");
    expect(links).toHaveLength(1);
    expect(links[0].kind).toBe("campanha");
    const board = loadBoard(links[0].id);
    expect(board.missions.map((m) => m.nome)).toContain("O Ritual Perdido");
    expect(board.allies).toHaveLength(3);
    expect(board.places).toHaveLength(4);
    expect(board.missions.every((m) => m.completa === false)).toBe(true);
  });

  it("a campanha oficial abre numa página de leitura com Clonar em cada item", async () => {
    const { OfficialCampaigns } = await import("../src/portal/components/campaigns/OfficialCampaigns");
    await act(async () => { root.render(<OfficialCampaigns />); });
    await act(async () => { buttonByText("▶ Abrir campanha").click(); });
    const page = host.querySelector("[data-official-campaign]")!;
    expect(page.textContent).toContain("Missões");
    expect(page.textContent).toContain("O Ritual Perdido");
    expect(page.textContent).toContain("Taverna do Corvo");
    expect(page.querySelectorAll("button[data-clone]").length).toBe(3 + 3 + 4); // aliados + missões + locais
    expect(page.textContent).not.toContain("Adicionar missão"); // só leitura
  });

  it("a área do mestre edita o quadro e guarda por mesa", async () => {
    const { CampaignHubView } = await import("../src/portal/components/campaigns/CampaignHubView");
    const table = { id: "t9", code: "ABCD2345", name: "Minha Campanha" } as import("../src/portal/lib/tables/client").TableEntry;
    await act(async () => { root.render(<CampaignHubView table={table} onClose={() => undefined} onPage={() => undefined} onEnter={() => undefined} />); });
    expect(host.textContent).toContain("Área do mestre");
    const input = host.querySelector('input[placeholder="Nome da missão"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Resgatar o prisioneiro"); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { buttonByText("Adicionar missão").click(); });
    expect(host.textContent).toContain("Resgatar o prisioneiro");
    expect(loadBoard("t9").missions.map((m) => m.nome)).toEqual(["Resgatar o prisioneiro"]);
    expect(loadBoard("outra").missions).toEqual([]);
  });

  it("a página da mesa do mestre tem Área do mestre, Editar e o painel de jogadores e convites dentro", async () => {
    const { TableDetailView } = await import("../src/portal/components/views/TableDetailView");
    const table = { id: "t1", code: "ABCD2345", name: "Cripta", system: "Tormenta20", modality: "online", priceType: "gratuita", priceValue: 0, schedule: "", gmName: "Eu", seatsTotal: 4, seatsFilled: 0, ageRating: "livre", vttPlatform: "", description: "", imageUrl: "", contactInfo: "", liveRoomCode: "ABCD2345", isPublic: false, ratingAvg: null, ratingCount: 0, createdAt: "" } as import("../src/portal/lib/tables/client").TableEntry;
    const hub = vi.fn(); const edit = vi.fn();
    await act(async () => { root.render(<TableDetailView table={table} code="ABCD2345" isMember isGm token="tok" onHub={hub} onEdit={edit} onEnter={() => undefined} onClose={() => undefined} />); });
    await flush();
    expect(host.querySelector("[data-master-area]")).toBeTruthy();
    expect(host.querySelector("[data-manage-section]")?.textContent).toContain("Convidar");
    expect(host.textContent).toContain("Preencher agora"); // sem detalhes ainda
    await act(async () => { (host.querySelector("[data-master-area]") as HTMLButtonElement).click(); });
    expect(hub).toHaveBeenCalled();
  });

  it("para o jogador a página da mesa não mostra gerenciar nem área do mestre", async () => {
    const { TableDetailView } = await import("../src/portal/components/views/TableDetailView");
    const table = { id: "t1", code: "X", name: "Cripta", system: "Tormenta20", seatsTotal: 4, seatsFilled: 0 } as import("../src/portal/lib/tables/client").TableEntry;
    await act(async () => { root.render(<TableDetailView table={table} code="X" isMember onEnter={() => undefined} onClose={() => undefined} />); });
    expect(host.querySelector("[data-master-area]")).toBeNull();
    expect(host.querySelector("[data-manage-section]")).toBeNull();
  });
});
