import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeToken } from "./helpers";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

const sheet = (extra: Record<string, unknown> = {}) => ({ powers: [], racialAbilities: [], classAbilities: [], equipment: [], ...extra }) as never;
const power = (name: string) => ({ id: name, name, type: "Geral", description: "" });

describe("descanso de uma noite (Tormenta20 p.106)", () => {
  it("recupera metade do nível (ruim), nível (normal), 2× (confortável) ou 3× (luxuosa); mínimo 1", async () => {
    const { restRecovery } = await import("../src/game/rest");
    const r = (condition: "ruim" | "normal" | "confortavel" | "luxuosa", level: number) => restRecovery({ level, condition, place: "urbano" });
    expect(r("ruim", 7)).toMatchObject({ pv: 3, pm: 3 }); // exemplo do livro: nível 7 ao relento recupera 3
    expect(r("ruim", 1)).toMatchObject({ pv: 1, pm: 1 });
    expect(r("normal", 7)).toMatchObject({ pv: 7, pm: 7 });
    expect(r("confortavel", 7)).toMatchObject({ pv: 14, pm: 14 });
    expect(r("luxuosa", 7)).toMatchObject({ pv: 21, pm: 21 });
  });

  it("poderes e itens mudam a categoria: Pajem sobe uma, Descanso Natural ao relento vira confortável, Paranoico desce uma", async () => {
    const { restRecovery } = await import("../src/game/rest");
    expect(restRecovery({ level: 4, condition: "normal", place: "urbano", sheet: sheet({ powers: [power("Pajem")] }) })).toMatchObject({ pv: 8, condition: "confortavel" });
    expect(restRecovery({ level: 4, condition: "ruim", place: "ermos", sheet: sheet({ powers: [power("Descanso Natural")] }) })).toMatchObject({ pv: 8, condition: "confortavel" });
    expect(restRecovery({ level: 4, condition: "ruim", place: "urbano", sheet: sheet({ powers: [power("Descanso Natural")] }) })).toMatchObject({ pv: 2 }); // só ao relento
    expect(restRecovery({ level: 4, condition: "normal", place: "urbano", sheet: sheet({ powers: [power("Paranoico")] }) })).toMatchObject({ pv: 2, condition: "ruim" });
    expect(restRecovery({ level: 4, condition: "ruim", place: "urbano", sheet: sheet({ powers: [power("Paranoico")] }) })).toMatchObject({ pv: 1, pm: 1 });
    const camisolao = { id: "c", name: "Camisolão", equipped: true } as never;
    expect(restRecovery({ level: 4, condition: "confortavel", place: "urbano", sheet: sheet({ equipment: [camisolao] }) })).toMatchObject({ pv: 12, condition: "luxuosa" });
  });

  it("Rainha da Selva soma +1 PV por nível; Sono Reparador melhora um passo no que falta mais; osteon e vampiro descansam sempre como normal", async () => {
    const { restRecovery } = await import("../src/game/rest");
    expect(restRecovery({ level: 5, condition: "normal", place: "urbano", sheet: sheet({ racialAbilities: [power("Rainha da Selva")] }) })).toMatchObject({ pv: 10, pm: 5 });
    expect(restRecovery({ level: 5, condition: "normal", place: "urbano", missingPv: 30, missingPm: 2, sheet: sheet({ powers: [power("Sono Reparador")] }) })).toMatchObject({ pv: 10, pm: 5 });
    expect(restRecovery({ level: 5, condition: "normal", place: "urbano", missingPv: 1, missingPm: 20, sheet: sheet({ powers: [power("Sono Reparador")] }) })).toMatchObject({ pv: 5, pm: 10 });
    expect(restRecovery({ level: 5, condition: "luxuosa", place: "urbano", sheet: sheet({ racialAbilities: [power("Preço da Não Vida")] }) })).toMatchObject({ pv: 5, pm: 5, condition: "normal" });
  });

  it("o botão do Mestre recupera sem passar do máximo, acaba os PV temporários, ignora quem morreu e acorda quem estava a 0 PV", async () => {
    const bridge = await import("../src/game/vttBridge");
    const { restTokens } = await import("../src/game/restTokens");
    bridge.addToken(makeToken({ id: "a", name: "Ferido", side: "heroes", gx: 1, gy: 1, hp: 4, hpMax: 30, pm: 1, pmMax: 10, level: 5, tempHp: 20, tempHpScope: "day" } as never));
    bridge.addToken(makeToken({ id: "b", name: "Quase cheio", side: "heroes", gx: 2, gy: 1, hp: 29, hpMax: 30, pm: 10, pmMax: 10, level: 5 }));
    bridge.addToken(makeToken({ id: "c", name: "Caído", side: "heroes", gx: 3, gy: 1, hp: 30, hpMax: 30, level: 5 }));
    bridge.updateToken("c", { hp: -3 });
    bridge.addToken(makeToken({ id: "d", name: "Morto", side: "heroes", gx: 4, gy: 1, hp: 30, hpMax: 30, level: 5 }));
    bridge.updateToken("d", { hp: -20 });
    const get = (id: string) => bridge.getBoard().tokens.find((t) => t.id === id)!;
    const deadHp = get("d").hp;
    expect(get("d").dead).toBe(true);
    const lines = restTokens(["a", "b", "c", "d"], "normal", "urbano");
    expect(get("a")).toMatchObject({ hp: 9, pm: 6 });
    expect(get("a").tempHp).toBeUndefined();
    expect(get("b")).toMatchObject({ hp: 30, pm: 10 });
    expect(get("c").hp).toBe(2); // −3 + 5
    expect(get("c").conditions).not.toContain("Inconsciente");
    expect(get("d")).toMatchObject({ hp: deadHp, dead: true }); // quem morreu não descansa
    expect(lines.length).toBe(3);
  });
});
