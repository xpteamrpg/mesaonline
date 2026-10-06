import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { announcementText, whatsappLink } from "../src/portal/lib/tables/details";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, requireLogin: () => true }) }));
vi.mock("../src/portal/lib/campaigns/client", async (original) => ({ ...(await original<typeof import("../src/portal/lib/campaigns/client")>()), tableParty: async () => [] }));

const table = {
  id: "t1", code: "ABCD2345", name: "Ratos dos Subúrbios", system: "3D&T Victory", modality: "online" as const, priceType: "gratuita" as const, priceValue: 0,
  schedule: "", gmName: "O Grimório", seatsTotal: 6, seatsFilled: 4, ageRating: "18", vttPlatform: "Owlbear Rodeo", description: "Você é um grupo de criminosos sem renome.",
  imageUrl: "", contactInfo: "", liveRoomCode: "ABCD2345", isPublic: true, ratingAvg: null, ratingCount: 0, createdAt: "2026-10-06",
  details: {
    sessions: [{ day: "Sábado", start: "15:00", end: "18:00", recurrence: "avulsa" as const }],
    rules: "Requisitos: PC ou celular.", scenario: "Project Moon", scenarioTags: ["Distopia", "Horror"],
    contentWarnings: ["violência", "gore"], safetyTools: ["linha e véu"], techRequirements: ["Microfone necessário"],
    experience: "todos", language: "pt-BR", communication: "Discord", whatsapp: "(75) 98233-0030", acceptsDonations: true,
  },
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("página de detalhe da mesa", () => {
  it("mostra as seções e a coluna da direita", async () => {
    const { TableDetailView } = await import("../src/portal/components/views/TableDetailView");
    await act(async () => { root.render(<TableDetailView table={table} code="ABCD2345" onEnter={() => undefined} onClose={() => undefined} />); });
    const text = host.textContent!;
    for (const part of ["Ratos dos Subúrbios", "Horários das sessões", "Sábado · 15:00 – 18:00 · avulsa", "Sobre a mesa", "Regras da mesa", "Cenário", "Project Moon", "Distopia",
      "Segurança e conforto", "Avisos de conteúdo", "gore", "A mesa pode incluir descrições gráficas", "linha e véu", "Requisitos técnicos", "Microfone necessário",
      "Entrar na mesa", "Enviar WhatsApp", "Copiar anúncio", "Mesa gratuita", "Aceita doações", "+18", "Owlbear Rodeo", "Discord", "Como participar", "O Grimório", "4 de 6"]) {
      expect(text, part).toContain(part);
    }
    const wa = host.querySelector('a[href^="https://wa.me/"]') as HTMLAnchorElement;
    expect(wa.href).toBe("https://wa.me/5575982330030");
  });

  it("sem detalhes preenchidos, a página não mostra seções vazias", async () => {
    const { TableDetailView } = await import("../src/portal/components/views/TableDetailView");
    await act(async () => { root.render(<TableDetailView table={{ ...table, details: undefined, description: "" }} code="X" onEnter={() => undefined} onClose={() => undefined} />); });
    const text = host.textContent!;
    expect(text).not.toContain("Regras da mesa");
    expect(text).not.toContain("Segurança e conforto");
    expect(text).not.toContain("Enviar WhatsApp");
  });

  it("o formulário da mesa tem os campos de detalhe (horário, avisos, segurança, requisitos, WhatsApp)", async () => {
    const { TableDetailsFields } = await import("../src/portal/components/views/TableDetailsFields");
    let value: import("../src/portal/lib/tables/details").TableDetails = {};
    const render = () => root.render(<TableDetailsFields value={value} onChange={(next) => { value = next; void act(async () => render()); }} />);
    await act(async () => render());
    const click = async (label: string) => { const b = Array.from(host.querySelectorAll("button")).find((x) => x.textContent === label)!; await act(async () => { b.click(); }); };
    await click("+ Horário");
    await click("terror");
    await click("x-card");
    await click("Microfone necessário");
    expect(value.sessions).toHaveLength(1);
    expect(value.contentWarnings).toEqual(["terror"]);
    expect(value.safetyTools).toEqual(["x-card"]);
    expect(value.techRequirements).toEqual(["Microfone necessário"]);
    await click("terror");
    expect(value.contentWarnings).toEqual([]);
  });

  it("WhatsApp: só dígitos, assume Brasil; texto do anúncio com vagas e código", () => {
    expect(whatsappLink("(75) 98233-0030")).toBe("https://wa.me/5575982330030");
    expect(whatsappLink("+55 75 98233-0030")).toBe("https://wa.me/5575982330030");
    expect(whatsappLink("123")).toBe("");
    const ad = announcementText(table, "ABCD2345");
    expect(ad).toContain("Ratos dos Subúrbios");
    expect(ad).toContain("Vagas: 2 de 6");
    expect(ad).toContain("Mesa gratuita");
    expect(ad).toContain("Código da mesa: ABCD2345");
  });
});
