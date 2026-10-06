import { describe, expect, it } from "vitest";
import { findPowerByName } from "../ficha-modernrpg/t20/compendium";
import { findPowerByName as findPowerPortal } from "../src/portal/lib/t20/compendium";

/** Nomes de poder escritos do jeito da pessoa (parênteses, prefixo, bônus no fim) acham o poder do catálogo, nas duas cópias das regras. */
describe("nome de poder tolerante", () => {
  const casos: [string, string][] = [
    ["Caminho do arcanista:sentinela", "Sentinela"],
    ["Poder: Pernas do Mar", "Pernas do Mar"],
    ["Poderes de Arcanista: Estilo Esotérico", "Estilo Esotérico"],
    ["Instinto Selvagem (nota)", "Instinto Selvagem"],
    ["Instinto selvagem +1", "Instinto Selvagem"],
    ["Acuidade com Arma", "Acuidade com Arma"],
  ];
  for (const [escrito, esperado] of casos) {
    it(`"${escrito}" → ${esperado}`, () => {
      expect(findPowerByName(escrito)?.nome).toBe(esperado);
      expect(findPowerPortal(escrito)?.nome).toBe(esperado);
    });
  }
  it("nome que não existe continua sem resultado", () => {
    expect(findPowerByName("Poder Inventado Qualquer")).toBeUndefined();
  });
});
