import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";
import { accountNickname } from "../src/game/playerName";

/** O Mestre guarda o apelido de cada jogador e ele aparece ao lado dos tokens que o jogador controla. */
const fakeStorage = (entries: Record<string, string>) => ({
  length: Object.keys(entries).length,
  key: (index: number) => Object.keys(entries)[index] ?? null,
  getItem: (key: string) => entries[key] ?? null,
});

describe("apelido do jogador", () => {
  it("lê o apelido da sessão da conta, cai no e-mail e devolve vazio sem conta", () => {
    expect(accountNickname(fakeStorage({ "sb-abc-auth-token": JSON.stringify({ user: { email: "a@b.com", user_metadata: { nickname: "Samar" } } }) }))).toBe("Samar");
    expect(accountNickname(fakeStorage({ "sb-abc-auth-token": JSON.stringify({ user: { email: "betatester1@mesaonline.com.br", user_metadata: {} } }) }))).toBe("betatester1");
    expect(accountNickname(fakeStorage({ outra: "x" }))).toBe("");
    expect(accountNickname(fakeStorage({ "sb-abc-auth-token": "isto não é json" }))).toBe("");
  });

  describe("no Mestre", () => {
    beforeEach(() => { localStorage.clear(); vi.resetModules(); });
    it("setPlayerName guarda o nome limpo por jogador e ignora vazio", async () => {
      const bridge = await import("../src/game/vttBridge");
      bridge.addToken(makeToken({ id: "t1", name: "Aventureira", side: "heroes", controlledBy: "peer-1" }));
      bridge.setPlayerName("peer-1", "  Samar   Jogador  ");
      bridge.setPlayerName("peer-2", "   ");
      expect(bridge.getBoard().playerNames).toEqual({ "peer-1": "Samar Jogador" });
    });
  });
});
