import { describe, expect, it } from "vitest";
import renard from "./fixtures/renard-campos-pdf.json";
import astolfo from "./fixtures/astolfo-campos-pdf.json";
import lagrima from "./fixtures/lagrima-m-campos-pdf.json";
import { heroJsonToDraft } from "../src/portal/lib/pdf/heroJson";

/**
 * Ficha real do Renard (modelo "Modelo de Heróis"): a lista de magias vem com separadores
 * "=====1º Círculo=====" e custos soltos ("1 PM", "3 PM"...), que não são magias.
 */
describe("ficha real: Renard (magias com separadores de círculo)", () => {
  const draft = heroJsonToDraft({ personagem: { nome: "Renard" }, campos_originais_pdf: renard });
  const names = (draft.spells ?? []).map((spell) => spell.name);

  it("não cria magia a partir de separadores nem de custos soltos", () => {
    expect(names.some((n) => n.startsWith("="))).toBe(false);
    expect(names.some((n) => /^\d+\s*PM$/i.test(n))).toBe(false);
  });

  it("mantém as magias de verdade, no círculo do separador", () => {
    expect(names).toEqual(expect.arrayContaining(["Escuridão", "Disfarce Ilusório", "Seta Infalível"]));
    const dark = draft.spells!.find((spell) => spell.name === "Escuridão")!;
    expect(dark.circle).toBe(1);
  });

  it("limpa anotações do nome e acha a magia do catálogo, com o custo do catálogo", () => {
    const cure = draft.spells!.find((spell) => spell.name === "Curar Ferimentos");
    expect(cure).toBeDefined(); // "curar ferimentos -1PM (harmonizado)"
    const arrow = draft.spells!.find((spell) => spell.name === "Flecha de Luz");
    expect(arrow).toMatchObject({ circle: 1, cost: 1 });
  });
});

describe("ficha real: Astolfo (etiquetas de nível, escola e erro de digitação)", () => {
  const draft = heroJsonToDraft({ personagem: { nome: "Astolfo" }, campos_originais_pdf: astolfo });
  const names = (draft.spells ?? []).map((spell) => spell.name);

  it("reconhece as magias mesmo com [nível - origem], {escola}, 'nível 4-' e 'Amendrontar'", () => {
    expect(names).toEqual(expect.arrayContaining(["Armadura Arcana", "Arma Mágica", "Toque Chocante", "Primor Atlético", "Concentração de Combate", "Imagem Espelhada", "Campo de Força", "Bola de Fogo", "Despedaçar", "Amedrontar"]));
  });

  it("não cria magia a partir do rótulo 'raça' nem do texto-modelo", () => {
    expect(names.some((n) => /^ra[cç]a$/i.test(n) || n.includes("<"))).toBe(false);
  });

  it("todas as magias são do catálogo, com o custo do catálogo (nenhuma com custo 0)", () => {
    expect((draft.spells ?? []).filter((spell) => !spell.cost)).toEqual([]);
  });
});

describe("ficha real: Lágrima (M), magias em lista por origem", () => {
  const draft = heroJsonToDraft({ personagem: { nome: "Lágrima" }, campos_originais_pdf: lagrima });
  it("lê as magias de 'Feiticeiro:' e 'Glamour:' sem repetir", () => {
    const names = (draft.spells ?? []).map((spell) => spell.name);
    expect(names).toEqual(expect.arrayContaining(["Instante Estoico", "Queda Suave", "Curar Ferimentos", "Caminhos da Natureza"]));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("raça com erro de digitação na ficha (Lágrima: 'Eiradan')", () => {
  it("reconhece 'Eiradan' como Eiradaan em vez de cair em Humano", () => {
    const draft = heroJsonToDraft({ personagem: { nome: "Lágrima" }, campos_originais_pdf: lagrima });
    expect(draft.raceId).toBe("eiradaan-herois");
  });
});

describe("poderes de raça e de origem do campo 'Habilidades de Raça e Origem'", () => {
  const powersOf = (name: string, fields: Record<string, string>) => (heroJsonToDraft({ personagem: { nome: name }, campos_originais_pdf: fields }).powers ?? []).map((p) => p.name);

  it("Renard: lê Criança das Trevas, Sombras Profanas e o poder de origem Usurpar, sem repetir Herança Divina (que a raça já dá)", () => {
    const names = powersOf("Renard", renard);
    // "Sombras Profanas" não está no catálogo: entra com o nome como a ficha escreve.
    expect(names.map((n) => n.toLowerCase())).toEqual(expect.arrayContaining(["criança das trevas", "sombras profanas", "usurpar"]));
    expect(names.some((n) => /heran[cç]a divina/i.test(n))).toBe(false);
  });

  it("Astolfo: lê Pirata Oceânico (raça) e Engenhosidade (origem), e não confunde as magias da Canção dos Mares com poderes", () => {
    const names = powersOf("Astolfo", astolfo);
    expect(names.some((n) => /pirata oce/i.test(n))).toBe(true);
    expect(names.some((n) => /engenhosidade/i.test(n))).toBe(true);
    expect(names.some((n) => /amendrontar|amedrontar|despeda/i.test(n))).toBe(false);
  });

  it("Lágrima: o que a raça já dá (Essência Feérica...) não vira poder repetido, e '+1 int' não vira poder", () => {
    const names = powersOf("Lágrima", lagrima);
    expect(names.some((n) => /^ess[eê]ncia f/i.test(n) || /^\+1 int$/i.test(n))).toBe(false);
  });

  it("Lágrima: poder escrito com erro de digitação ('Redirecionar distino') é reconhecido no catálogo", () => {
    expect(powersOf("Lágrima", lagrima)).toContain("Redirecionar Destino");
  });
});
