import { describe, expect, it } from "vitest";
import { describePeerError } from "../src/game/multiplayer";

describe("erros do PeerJS explicados em português", () => {
  it("falha de negociação (rede entre os dois computadores)", () => {
    const text = describePeerError({ message: "Negotiation of connection to modernrpg-armada-player-TSB9FL-3dfb failed." });
    expect(text).toMatch(/outra rede/);
    expect(text).toContain("Negotiation of connection"); // o texto original continua à vista
  });
  it("sala não encontrada, rede e erro desconhecido", () => {
    expect(describePeerError({ type: "peer-unavailable", message: "Could not connect to peer abc" })).toMatch(/Mestre já abriu a sala/);
    expect(describePeerError({ type: "network", message: "Lost connection to server." })).toMatch(/servidor que apresenta/);
    expect(describePeerError({ message: "algo novo" })).toBe("algo novo");
    expect(describePeerError({})).toBe("Erro de conexão.");
  });
});
