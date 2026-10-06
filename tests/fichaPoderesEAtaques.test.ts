import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

async function heroi(index = 0) {
  const { loadReadyHeroSheets } = await import("../ficha-modernrpg/characterRoute");
  return structuredClone(loadReadyHeroSheets()[index]);
}

describe("poderes que somam PV e PM", () => {
  it("Vitalidade soma +1 PV por nível; Vontade de Ferro +1 PM a cada dois níveis; Coração de Dragão +2 PV e +2 PM", async () => {
    const { powerVitals, maxHp, maxMp } = await import("../src/portal/lib/t20/sheetRules");
    const sheet = await heroi(0);
    sheet.level = 6;
    sheet.powers = [];
    const semPoder = { hp: maxHp(sheet), mp: maxMp(sheet) };
    sheet.powers = [
      { id: "a", name: "Vitalidade", type: "Geral", description: "" },
      { id: "b", name: "Vontade de Ferro", type: "Geral", description: "" },
      { id: "c", name: "Coração de Dragão", type: "Racial", description: "" },
    ];
    expect(powerVitals(sheet)).toEqual({ pv: 6 + 2, pm: 3 + 2 });
    expect(maxHp(sheet)).toBe(semPoder.hp + 8);
    expect(maxMp(sheet)).toBe(semPoder.mp + 5);
  });
  it("não conta duas vezes o mesmo poder, ignora o que não está na tabela e respeita a classe do Poder Mágico", async () => {
    const { powerVitals } = await import("../src/portal/lib/t20/sheetRules");
    const sheet = await heroi(0);
    sheet.level = 4;
    sheet.class = "Guerreiro";
    sheet.powers = [
      { id: "a", name: "Vitalidade", type: "Geral", description: "" },
      { id: "b", name: "Vitalidade", type: "Geral", description: "" },
      { id: "c", name: "Golpe Pessoal", type: "Combate", description: "" },
      { id: "d", name: "Poder Mágico", type: "Classe", description: "" },
    ];
    expect(powerVitals(sheet)).toEqual({ pv: 4, pm: 0 });
    sheet.class = "Arcanista";
    expect(powerVitals(sheet).pm).toBe(4);
  });
});

describe("ataque personalizado da ficha", () => {
  it("vai para a lista de Agir somando o atributo e o bônus de dano, com crítico e perícia certos", async () => {
    const { actionsForCharacter } = await import("../src/tactics/interpretation/characterActionAdapter");
    const sheet = await heroi(0);
    sheet.attributes.for.value = 3;
    sheet.attacks = [{ id: "custom1", name: "Cajado de teste", skill: "Luta", damage: "1d8", damageAttr: "for", critical: "19/x3", range: "Corpo a corpo", damageType: "Impacto", bonus: 2, damageBonus: 1 }];
    const ataque = actionsForCharacter(sheet, { attacks: [], powers: [], items: [] } as never).find((a) => a.id === "character:attack:custom1");
    expect(ataque).toBeTruthy();
    expect(ataque?.attackSkill).toBe("luta");
    expect(ataque?.attackBonus).toBe(2);
    expect(ataque?.damage).toBe("1d8");
    expect(ataque?.extraDamage).toBe("4"); // FOR 3 + bônus 1
    expect(ataque?.crit).toBe(19);
    expect(ataque?.critMultiplier).toBe(3);
  });
  it("sem atributo no dano, só o bônus extra conta", async () => {
    const { actionsForCharacter } = await import("../src/tactics/interpretation/characterActionAdapter");
    const sheet = await heroi(0);
    sheet.attacks = [{ id: "custom2", name: "Arco de teste", skill: "Pontaria", damage: "1d6", damageAttr: null, critical: "20/x2", range: "Médio (30m)", damageType: "Perfuração", damageBonus: 2 }];
    const ataque = actionsForCharacter(sheet, { attacks: [], powers: [], items: [] } as never).find((a) => a.id === "character:attack:custom2");
    expect(ataque?.attackSkill).toBe("pontaria");
    expect(ataque?.extraDamage).toBe("2");
  });
});
