import { describe, expect, it } from "vitest";
import { eligibleImprovements, improvementCost, improvementProblem, withImprovements } from "../src/portal/lib/t20/improvements";
import { itemToEquipment } from "../src/portal/lib/t20/sheetRules";
import { findItemByName } from "../src/portal/lib/t20/compendium";

const equip = (name: string) => itemToEquipment(findItemByName(name)!, 1, true);

describe("melhorias de itens (Tabela 3-7, p.164)", () => {
  it("o preço é o total por quantidade de melhorias: +300, +3.000, +9.000, +18.000 (e CD +5/+10/+15/+20)", () => {
    expect([1, 2, 3, 4].map((n) => improvementCost(n))).toEqual([{ price: 300, cd: 5 }, { price: 3000, cd: 10 }, { price: 9000, cd: 15 }, { price: 18000, cd: 20 }]);
  });
  it("exemplo do livro: espada longa T$ 15 vira T$ 315 com 1 melhoria e T$ 18.015 com 4", () => {
    const espada = equip("Espada longa");
    expect(espada.price).toBe(15);
    expect(withImprovements(espada, ["Certeira"]).price).toBe(315);
    expect(withImprovements(espada, ["Certeira", "Cruel", "Maciça", "Pungente"]).price).toBe(18015);
    expect(withImprovements(withImprovements(espada, ["Certeira", "Cruel"]), ["Certeira"]).price).toBe(315); // tirar uma melhoria devolve o preço
  });
  it("melhoria que veio paga da importação não é cobrada de novo; só a nova", () => {
    const cimitarra = { ...equip("Cimitarra"), modifications: ["Maciça"], basePrice: 15, freeModifications: 1 };
    expect(withImprovements(cimitarra, ["Maciça"]).price).toBe(15);
    expect(withImprovements(cimitarra, ["Maciça", "Certeira"]).price).toBe(15 + 3000 - 300);
  });
  it("cada categoria só vê as melhorias dela e os pré-requisitos do texto são respeitados", () => {
    const armaNomes = eligibleImprovements(equip("Espada longa")).map((m) => m.nome);
    expect(armaNomes).toContain("Certeira");
    expect(armaNomes).not.toContain("Reforçada"); // é de armaduras/escudos
    expect(eligibleImprovements(equip("Corda")).length).toBe(0); // item geral comum não recebe melhorias
    const armadura = eligibleImprovements(equip("Armadura completa")).map((m) => m.nome);
    expect(armadura).toContain("Reforçada");
    const atroz = eligibleImprovements(equip("Espada longa")).find((m) => m.nome === "Atroz")!;
    expect(improvementProblem(atroz, [])).toMatch(/Cruel/);
    expect(improvementProblem(atroz, ["Cruel"])).toBeUndefined();
  });
});
