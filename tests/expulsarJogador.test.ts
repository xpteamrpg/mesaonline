import { describe, expect, it } from "vitest";
import { ArmadaMultiplayer } from "../src/game/multiplayer";

type Internals = { state: Record<string, unknown>; connections: Map<string, unknown>; acceptConnection: (c: unknown, master: boolean) => void };

function makeMaster(role: "master" | "player" = "master") {
  const mp = new ArmadaMultiplayer({ getSnapshot: () => ({}), applySnapshot: () => {}, runCommand: () => {}, onState: () => {} });
  const inner = mp as unknown as Internals;
  inner.state = { ...inner.state, role };
  return { mp, inner };
}
function fakeConnection(peer: string) {
  const sent: unknown[] = [];
  const handlers: Record<string, () => void> = {};
  const state = { closed: false };
  const conn = { peer, open: true, send: (m: unknown) => { sent.push(m); }, close: () => { state.closed = true; }, on: (event: string, cb: () => void) => { handlers[event] = cb; } };
  return { conn, sent, handlers, state };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Expulsar jogador da sala", () => {
  it("o Mestre avisa e desconecta o jogador, que sai da lista de conexões", async () => {
    const { mp, inner } = makeMaster();
    const a = fakeConnection("jogador-1");
    inner.connections.set("jogador-1", a.conn);
    expect(mp.kick("jogador-1")).toBe(true);
    expect(a.sent).toEqual([{ type: "armada-kicked" }]);
    expect(inner.connections.has("jogador-1")).toBe(false);
    await wait(260);
    expect(a.state.closed).toBe(true);
  });

  it("quem foi expulso é barrado ao tentar voltar à mesma sala", async () => {
    const { mp, inner } = makeMaster();
    inner.connections.set("jogador-1", fakeConnection("jogador-1").conn);
    mp.kick("jogador-1");
    const back = fakeConnection("jogador-1");
    inner.acceptConnection(back.conn, true);
    back.handlers.open();
    expect(back.sent).toEqual([{ type: "armada-kicked" }]);
    expect(inner.connections.has("jogador-1")).toBe(false);
    await wait(260);
    expect(back.state.closed).toBe(true);
  });

  it("outro jogador continua conectado e só o Mestre pode expulsar", () => {
    const { mp, inner } = makeMaster();
    inner.connections.set("jogador-1", fakeConnection("jogador-1").conn);
    inner.connections.set("jogador-2", fakeConnection("jogador-2").conn);
    mp.kick("jogador-1");
    expect(inner.connections.has("jogador-2")).toBe(true);
    const player = makeMaster("player");
    player.inner.connections.set("x", fakeConnection("x").conn);
    expect(player.mp.kick("x")).toBe(false);
    expect(player.inner.connections.has("x")).toBe(true);
  });
});
