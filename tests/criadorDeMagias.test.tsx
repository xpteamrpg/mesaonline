import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcular, circuloEfetivo, tarifaDoTexto } from "../src/portal/lib/homebrew/spellCost";
import { novaMagia } from "../src/portal/lib/homebrew/mySpells";
import { textoPlano, tipoDePocao, substituir } from "../src/portal/lib/homebrew/spellText";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Nada de rede: sem Supabase a guarda fica no navegador, separada por conta.
vi.mock("../src/portal/lib/supabase/client", () => ({ supabase: null, supabaseConfigured: false }));
const auth = vi.hoisted(() => ({ id: "u1" }));
vi.mock("../src/portal/lib/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: auth.id }, requireLogin: () => true }) }));

describe("motor de custo (balanceamento por pontos)", () => {
  const blast = () => {
    const m = novaMagia();
    m.efeitos = { dano: { n: 2, faces: 6, fixo: 0, tipo: "fogo" } };
    return m;
  };

  it("2d6 de fogo, 1 alvo, curto, instantânea, sem teste = 8 pontos (6 do dano + 2 por não ter resistência)", () => {
    const r = calcular(blast());
    expect(r.partes.dano).toBe(6);
    expect(r.partes.resistencia).toBe(2);
    expect(r.total).toBe(8);
    expect(r.orcamento).toBe(10);
    expect(r.valido).toBe(true);
  });

  it("com teste de Reflexos que reduz à metade, o custo cai para 7", () => {
    const m = blast();
    m.eixos.resistencia = "reduz-metade"; m.eixos.teste = "Reflexos";
    expect(calcular(m).total).toBe(7);
  });

  it("Bola de Fogo (2º círculo, 6d6, esfera de 6m, alcance médio, Reflexos reduz à metade) fecha em 17 de 18, como no original", () => {
    const m = novaMagia();
    m.circulo = 2;
    m.efeitos = { dano: { n: 6, faces: 6, fixo: 0, tipo: "fogo" } };
    m.eixos = { execucao: "padrao", alcance: "medio", duracao: "instantanea", resistencia: "reduz-metade", teste: "Reflexos", alvo: { tipo: "area", tamanho: "m", forma: "esfera", metros: 6 } };
    const r = calcular(m);
    expect(r.total).toBe(17);
    expect(r.orcamento).toBe(18);
    expect(r.valido).toBe(true);
  });

  it("estourar o orçamento marca inválida; um pouco acima pede aval do mestre", () => {
    const m = blast();
    m.efeitos.dano!.n = 5;
    const r = calcular(m);
    expect(r.valido).toBe(false);
    const m2 = blast();
    m2.efeitos.dano!.n = 3; // 9 + 2 = 11, passa 1 do orçamento de 10 (até +15% = 12)
    const r2 = calcular(m2);
    expect(r2.total).toBe(11);
    expect(r2.precisaAval).toBe(true);
    expect(r2.valido).toBe(false);
  });

  it("escola que não causa dano nas oficiais (Adivinhação) bloqueia magia de dano", () => {
    const m = blast();
    m.escola = "Adivinhação";
    const r = calcular(m);
    expect(r.bloqueada).toBe(true);
    expect(r.valido).toBe(false);
    expect(r.avisos.join(" ")).toContain("Adivinhação");
  });

  it("condição mais cara paga cheia e as extras pagam metade; condição junto com dano paga metade", () => {
    const m = novaMagia();
    m.efeitos = { condicoes: ["lento", "caido"] };
    m.eixos.resistencia = "parcial"; m.eixos.teste = "Vontade";
    // lento é tier 2 (5 pts), caído é tier 1 (2 pts, metade = 1)
    expect(calcular(m).partes.condicao).toBe(6);
    m.efeitos.dano = { n: 1, faces: 6, fixo: 0, tipo: "fogo" };
    expect(calcular(m).partes.condicao).toBe(3);
  });

  it("círculo efetivo pelo PM total (1, 3, 6, 10, 15 PM) e aviso quando o aprimoramento sobe de círculo", () => {
    expect([1, 2, 3, 5, 6, 10, 14, 15].map(circuloEfetivo)).toEqual([1, 1, 2, 2, 3, 4, 4, 5]);
    const m = blast();
    m.aprimoramentos = [{ texto: "faz algo grande", pm: 5 }];
    expect(calcular(m).avisos.join(" ")).toContain("leva a magia ao poder de 3º círculo");
  });

  it("reconhece o que um aprimoramento muda e compara com o PM das oficiais", () => {
    const t = tarifaDoTexto("aumenta o dano em +1d6", blast());
    expect(t?.chave).toBe("dano+:1d6");
    expect(t!.pm).toBeGreaterThan(0);
    expect(tarifaDoTexto("texto qualquer sem efeito reconhecível", blast())).toBeNull();
  });

  it("os códigos da descrição viram os valores da magia e a poção segue o alvo", () => {
    const m = blast();
    m.nome = "Lança de Cinzas";
    expect(substituir("Causa {dano} em {alvo}. Teste de {teste}.", m)).toBe("Causa 2d6 de fogo em 1 criatura. Teste de Reflexos.");
    expect(tipoDePocao("esfera com 6m de raio")).toBe("granada");
    expect(tipoDePocao("1 arma")).toBe("óleo");
    expect(textoPlano(m, calcular(m))).toContain("[8/10 pontos de construção]");
  });
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); auth.id = "u1"; vi.resetModules(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const setValue = async (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
};
const button = (text: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
const option = (text: string) => Array.from(host.querySelectorAll("button[data-opcao]")).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const next = () => act(async () => { (host.querySelector("[data-next-step]") as HTMLButtonElement).click(); });

async function mountCreator() {
  const { SpellCreator } = await import("../src/portal/components/views/SpellCreator");
  await act(async () => { root.render(<SpellCreator onClose={() => undefined} />); });
  await flush();
}

describe("criador de magias (privado)", () => {
  it("passo a passo: nome, efeito de dano, medidor de pontos ao vivo e guardar só para essa conta", async () => {
    await mountCreator();
    expect(host.querySelector("[data-spell-step]")!.getAttribute("data-spell-step")).toBe("basico");
    await setValue(host.querySelector('input[placeholder="Ex.: Lança de Cinzas"]') as HTMLInputElement, "Lança de Cinzas");
    await next(); // Efeitos
    expect(host.querySelector("[data-spell-step]")!.getAttribute("data-spell-step")).toBe("efeitos");
    await act(async () => { option("Causa dano").click(); });
    expect(host.querySelector("[data-meter]")!.textContent).toBe("8 / 10 pontos"); // dano 2d6 de fogo + sem teste
    await next(); // Detalhes
    expect(host.querySelector("[data-spell-step]")!.getAttribute("data-spell-step")).toBe("config");
    await act(async () => { host.querySelector("[data-spell-card]"); });
    // vai até a revisão
    for (let i = 0; i < 8 && host.querySelector("[data-next-step]"); i += 1) await next();
    expect(host.querySelector("[data-spell-step]")!.getAttribute("data-spell-step")).toBe("revisao");
    await act(async () => { button("Guardar magia").click(); });
    await flush();
    expect(host.querySelector("[data-my-spells]")!.textContent).toContain("Minhas magias (1)");
    const stored = JSON.parse(localStorage.getItem("tormenta20_my_spells_v2:u1") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ nome: "Lança de Cinzas", circulo: 1 });
    expect(stored[0].efeitos.dano).toMatchObject({ n: 2, faces: 6 });
    expect(localStorage.getItem("tormenta20_my_spells_v2:u2")).toBeNull();
  });

  it("o passo de resistência só aparece quando a magia é ofensiva", async () => {
    await mountCreator();
    const titulos = () => Array.from(host.querySelectorAll("nav button")).map((b) => b.textContent);
    expect(titulos()).not.toContain("Resistência");
    await next();
    await act(async () => { option("Causa dano").click(); });
    expect(titulos()).toContain("Resistência");
  });

  it("exige o nome para guardar", async () => {
    await mountCreator();
    for (let i = 0; i < 8 && host.querySelector("[data-next-step]"); i += 1) await next();
    await act(async () => { button("Guardar magia").click(); });
    expect(host.textContent).toContain("Dê um nome para a magia.");
    expect(localStorage.getItem("tormenta20_my_spells_v2:u1")).toBeNull();
  });

  it("outra conta no mesmo navegador não vê as magias", async () => {
    const { saveMySpell, loadMySpells, novaMagia: nova } = await import("../src/portal/lib/homebrew/mySpells");
    await saveMySpell("u1", { ...nova(), nome: "Só minha" });
    expect((await loadMySpells("u1")).spells.map((s) => s.nome)).toEqual(["Só minha"]);
    expect((await loadMySpells("u2")).spells).toEqual([]);
  });

  it("aprimoramento escrito entra no cartão", async () => {
    await mountCreator();
    for (let i = 0; i < 7; i += 1) { if (host.querySelector("[data-spell-step]")!.getAttribute("data-spell-step") === "aprimoramentos") break; await next(); }
    await act(async () => { button("+ escrever um").click(); });
    await setValue(host.querySelector('textarea[aria-label="Texto do aprimoramento"]') as HTMLTextAreaElement, "aumenta o dano em +1d6");
    expect(host.querySelector("[data-spell-card]")!.textContent).toContain("+1 PM: aumenta o dano em +1d6");
  });

  it("o botão do Homebrew abre o criador", async () => {
    const { HomebrewView } = await import("../src/portal/components/views/HomebrewView");
    await act(async () => { root.render(<HomebrewView onNavigate={() => undefined} />); });
    expect(host.querySelector("[data-spell-creator]")).toBeNull();
    await act(async () => { button("Criar magia").click(); });
    expect(host.querySelector("[data-spell-creator]")).toBeTruthy();
    expect(host.textContent).toContain("só suas");
  });
});
