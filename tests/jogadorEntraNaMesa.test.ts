import { describe, expect, it } from "vitest";
import { makeBoard, makeToken } from "./helpers";
import { firstFreeCell } from "../src/tactics/engine/runtimeCommands";

/** O jogador entra com o personagem da conta ("Meus personagens → Usar"): o Mestre cria o token numa casa livre (comando claimCharacter). */
describe("casa livre para o personagem que entra", () => {
  it("pega a primeira casa vazia e pula as ocupadas", () => {
    const board = makeBoard([makeToken({ id: "a", gx: 1, gy: 1 }), makeToken({ id: "b", gx: 2, gy: 1 })]);
    expect(firstFreeCell(board)).toEqual({ x: 3, y: 1 });
    expect(firstFreeCell(makeBoard([]))).toEqual({ x: 1, y: 1 });
  });
});
