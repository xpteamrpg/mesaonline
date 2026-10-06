import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, requireLogin: () => true }) }));
vi.mock("../src/portal/lib/tables/client", async (original) => ({
  ...(await original<typeof import("../src/portal/lib/tables/client")>()),
  listPublicTables: async () => ({ tables: [], total: 0, hasMore: false }),
  getTableByCode: async () => { throw new Error("sem rede"); },
}));
const table = (id: string, name: string, kind: "campanha" | "oneshot") => ({ id, name, kind, code: `COD${id}`, liveRoomCode: `COD${id}`, ageRating: "14", imageUrl: "", system: "Tormenta20" });
vi.mock("../src/portal/lib/campaigns/client", async (original) => ({
  ...(await original<typeof import("../src/portal/lib/campaigns/client")>()),
  myTables: async () => [
    { table: table("1", "Cripta dos Reis", "oneshot"), role: "mestre", members: 3 },
    { table: table("2", "Guerra dos Tronos de Arton", "campanha"), role: "jogador", members: 5 },
    { table: table("3", "Taverna do Javali", "oneshot"), role: "jogador", members: 2 },
  ],
  myInvites: async () => [],
  tableParty: async () => [],
  tableMembers: async () => [],
  characterRequests: async () => [],
  claimTable: async () => undefined,
  requestCharacter: (...args: unknown[]) => requestCharacterSpy(...args),
}));

const requestCharacterSpy = vi.hoisted(() => vi.fn(async () => ({ id: "l1", status: "aceito" })));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

async function mount() {
  const { OnlineTableView } = await import("../src/portal/components/views/OnlineTableView");
  await act(async () => { root.render(<OnlineTableView />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
/** Bloco da lista cujo título é `title` (o cartão da lista inteira). */
const section = (title: string) => {
  const heading = Array.from(host.querySelectorAll("h2")).find((h) => h.textContent === title)!;
  return heading.parentElement!.parentElement!;
};

/** Minhas campanhas e Meus one-shots mostram TODAS as mesas da conta (mestre e jogador), cada uma na lista do seu tipo e com o papel. */
describe("listas de mesas do Portal", () => {
  it("cada mesa cai na lista do tipo dela, com o papel (mestre/jogador) e a faixa etária", async () => {
    await mount();
    const oneshots = section("Meus one-shots").textContent!;
    const campanhas = section("Minhas campanhas").textContent!;
    expect(oneshots).toContain("Cripta dos Reis");
    expect(oneshots).toContain("Taverna do Javali");
    expect(campanhas).toContain("Guerra dos Tronos de Arton");
    expect(campanhas).not.toContain("Cripta dos Reis");
    expect(oneshots).toContain("♛ Mestre");
    expect(oneshots).toContain("⚔ Jogador");
    expect(campanhas).toContain("⚔ Jogador");
    // 14 anos vira a faixa 16
    expect(campanhas).toContain("16+");
  });

  it("a seção repetida de baixo (em que participo) não existe mais", async () => {
    await mount();
    expect(host.textContent).not.toMatch(/em que participo/i);
  });

  it("jogador vê Importar personagem e Sair; o mestre vê Gerenciar e Editar", async () => {
    await mount();
    const text = host.textContent!;
    expect(text.match(/Importar personagem/g)?.length).toBe(2);
    expect(text.match(/Sair/g)?.length).toBe(2);
    expect(text).toContain("Gerenciar jogadores e convites");
    expect(text.match(/Editar mesa/g)?.length).toBe(1);
  });

  it("o mestre adiciona direto na mesa um herói pronto (já aceito, sem pedido)", async () => {
    const { ManageTableDialog } = await import("../src/portal/components/campaigns/MesaAccountSections");
    await act(async () => { root.render(<ManageTableDialog table={{ id: "1", name: "Cripta dos Reis", code: "COD1" }} onClose={() => undefined} />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(host.textContent).toContain("Adicionar personagem direto");
    expect(host.textContent).toContain("Renard");
    const add = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Adicionar")!;
    await act(async () => { add.click(); });
    expect(requestCharacterSpy).toHaveBeenCalledTimes(1);
    expect((requestCharacterSpy.mock.calls[0] as unknown[])[0]).toBe("1");
  });
});
