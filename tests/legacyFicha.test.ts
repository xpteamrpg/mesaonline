import { describe, expect, it } from "vitest";
import kalop from "./fixtures/kalop-ficha-origem.json";
import { isLegacyFicha, legacyFichaToSheet } from "../src/portal/lib/pdf/legacyFicha";
import { isHeroJson } from "../src/portal/lib/pdf/heroJson";
import { attackTotal, defense } from "../src/portal/lib/t20/sheetRules";
import { T20_SKILLS, norm } from "../src/portal/lib/t20/compendium";

/**
 * JSON da ficha de origem (o app do Arsenal, versão 15.4: charName, attrs, skills, attacks, inventory...).
 * Os números são os que o próprio app calcula: defesa = 10 + atributo + armadura + escudo + "outros"; o "bônus" do ataque é o
 * total do teste; perícia = ½ nível + atributo + treino + outros.
 */
describe("JSON da ficha de origem: Kalop Sita (paladina, nível 3)", () => {
  const sheet = legacyFichaToSheet(kalop as never);

  it("é reconhecido como esse formato (e não como o JSON do herói do PDF)", () => {
    expect(isLegacyFicha(kalop)).toBe(true);
    expect(isHeroJson(kalop)).toBe(false);
  });

  it("lê identidade, atributos, PV, PM, PE e dinheiro", () => {
    expect(sheet).toMatchObject({ name: "Kalop Sita", level: 3, deity: "Azgher", xp: 3000, money: 644.5 });
    expect(sheet.classId).toBe("paladino");
    expect(sheet.race).toMatch(/kallyanach/i); // "Kallyanach (Ameaças)": a fonte entre parênteses não entra no nome
    expect(sheet.raceId).toMatch(/kallyanach/i);
    expect(Object.fromEntries(Object.entries(sheet.attributes).map(([k, v]) => [k, v.value]))).toEqual({ for: -1, des: 4, con: 2, int: 2, sab: -1, car: 4 });
    expect(sheet.hp).toEqual({ max: 39, current: 39 });
    expect(sheet.mp).toEqual({ max: 13, current: 13 });
  });

  it("a defesa bate com a da ficha de origem (10 + DES 4 + armadura 4 + outros 2 + 1)", () => {
    expect(defense(sheet).total).toBe(21);
    const armor = sheet.equipment.find((item) => item.equipped && item.category === "Armadura")!;
    expect(armor).toMatchObject({ defenseBonus: 4, armorPenalty: -3 });
  });

  it("ataques: dano e crítico separados, e o bônus escrito é o total do teste", () => {
    const thorn = sheet.attacks.find((a) => a.name === "Corrente de espinhos")!;
    expect(thorn).toMatchObject({ skill: "Luta", damage: "2d4", damageBonus: 4, critical: "19/x2" });
    expect(attackTotal(sheet, thorn).bonus).toBe(2);
  });

  it("perícias treinadas da ficha de origem aparecem treinadas", () => {
    const expected = (kalop.skills as Array<{ n: string; trained: boolean }>)
      .filter((s) => s.trained)
      .map((s) => T20_SKILLS.find((x) => norm(x.nome) === norm(s.n))?.id)
      .filter(Boolean);
    expect(expected.length).toBeGreaterThan(0);
    for (const id of expected) expect(sheet.skills[id as string]?.trained).toBe(true);
  });

  it("guarda as anotações, as proficiências e as habilidades escritas, sem repetir o que a classe já dá", () => {
    expect(sheet.notes).toContain("Kalop sita é um mulher");
    expect(sheet.notes).toContain("Proficiências: Marciais");
    expect(sheet.powers.map((p) => p.name)).toContain("Herança Dracônica (Fogo)");
    const free = new Set([...sheet.racialAbilities, ...sheet.classAbilities].map((a) => norm(a.name)));
    expect(sheet.powers.filter((p) => free.has(norm(p.name)))).toEqual([]);
  });
});
