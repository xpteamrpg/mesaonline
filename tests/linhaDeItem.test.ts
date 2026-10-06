import { describe, expect, it } from "vitest";
import { parseItemLine } from "../src/portal/lib/pdf/itemLine";

describe("leitor de linha de inventário", () => {
  it("separa quantidade, item do catálogo e melhoria", () => {
    const a = parseItemLine("2x Cimitarra Maciça");
    expect(a.quantity).toBe(2);
    expect(a.base?.nome).toBe("Cimitarra");
    expect(a.modifications.map((m) => m.nome)).toEqual(["Maciça"]);
    expect(a.leftover).toBe("");
  });
  it("aceita quantidade no fim, gênero diferente e melhoria entre parênteses", () => {
    expect(parseItemLine("Cimitarra x3").quantity).toBe(3);
    const b = parseItemLine("Espada longa certeiras");
    expect(b.base?.nome).toBe("Espada longa");
    expect(b.modifications.map((m) => m.nome)).toContain("Certeira");
    expect(parseItemLine("Armadura completa (Reforçada)").modifications.map((m) => m.nome)).toContain("Reforçada");
  });
  it("duas melhorias na mesma arma e palavra desconhecida não some", () => {
    const c = parseItemLine("Cimitarra certeira pungente");
    expect(c.modifications.map((m) => m.nome).sort()).toEqual(["Certeira", "Pungente"]);
    const d = parseItemLine("Cimitarra amassante");
    expect(d.base?.nome).toBe("Cimitarra");
    expect(d.modifications).toEqual([]);
    expect(d.leftover).toBe("amassante");
  });
  it("item simples continua simples", () => {
    const e = parseItemLine("Corda");
    expect(e.quantity).toBe(1);
    expect(e.base?.nome).toBe("Corda");
  });
});
