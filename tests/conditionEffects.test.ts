import { describe, expect, it } from "vitest";
import {
  activeConditions, adjustedSpeedM, conditionMods, conditionSkillPenalty, confusedBehavior, turnStartEffects,
} from "../src/game/conditionEffects";
import { CONDITION_NAMES, conditionDescription } from "../src/game/conditionInfo";
import type { BoardState } from "../src/game/types";
import { reachableCells } from "../src/tactics/engine/movement";
import { resolveSave, saveModifier } from "../src/tactics/engine/saves";
import { targetDefense } from "../src/tactics/engine/targeting";
import { makeToken } from "./helpers";

function board(tokens = [makeToken()]): BoardState {
  return {
    id: "b", map: { id: "m", name: "T", location: "", image: "", cols: 9, rows: 9, terrain: {} },
    tokens, walls: [], lights: [], shapes: [], objects: [], fog: [], explored: [], weather: "clear",
    chat: [], selectedTokenIds: [], targetedTokenIds: [], revision: 1,
  };
}

describe("catálogo de condições", () => {
  it("traz as 35 condições do legado (mais Morto e Invisível, da mesa) com descrição", () => {
    expect(CONDITION_NAMES).toHaveLength(37);
    expect(conditionDescription("Em Chamas")).toContain("1d6");
    expect(conditionDescription("caído")).toContain("–5 na Defesa contra ataques corpo a corpo");
  });
});

describe("condições compostas e escalada", () => {
  it("Exausto inclui Debilitado, Lento e Vulnerável", () => {
    const set = activeConditions(["Exausto"]);
    expect(["debilitado", "lento", "vulneravel"].every((name) => set.has(name))).toBe(true);
  });

  it("Paralisado vira Imóvel e Indefeso (que inclui Desprevenido)", () => {
    const set = activeConditions(["Paralisado"]);
    expect(["imovel", "indefeso", "desprevenido"].every((name) => set.has(name))).toBe(true);
  });

  it("Amedrontado tem o efeito de Abalado", () => {
    expect(conditionSkillPenalty(["Amedrontado"])).toBe(-2);
  });
});

describe("modificadores numéricos", () => {
  it("Abalado −2 e Apavorado −5 em perícias, sem acumular", () => {
    expect(conditionSkillPenalty(["Abalado"])).toBe(-2);
    expect(conditionSkillPenalty(["Apavorado"])).toBe(-5);
    expect(conditionSkillPenalty(["Abalado", "Apavorado"])).toBe(-5);
  });

  it("Fraco/Debilitado atingem só perícias físicas; Frustrado/Esmorecido só as mentais", () => {
    expect(conditionSkillPenalty(["Fraco"], "for")).toBe(-2);
    expect(conditionSkillPenalty(["Fraco"], "int")).toBe(0);
    expect(conditionSkillPenalty(["Debilitado"], "des")).toBe(-5);
    expect(conditionSkillPenalty(["Frustrado"], "car")).toBe(-2);
    expect(conditionSkillPenalty(["Esmorecido"], "sab")).toBe(-5);
  });

  it("Ofuscado penaliza Percepção; Cego penaliza Força e Destreza", () => {
    expect(conditionSkillPenalty(["Ofuscado"], "sab", "per")).toBe(-2);
    expect(conditionSkillPenalty(["Cego"], "des")).toBe(-5);
  });

  it("Defesa: Vulnerável −2, Desprevenido −5, Indefeso −15 (inclui Desprevenido)", () => {
    expect(conditionMods(["Vulnerável"]).defense).toBe(-2);
    expect(conditionMods(["Desprevenido"]).defense).toBe(-5);
    expect(conditionMods(["Indefeso"]).defense).toBe(-15);
  });

  it("Caído: −5 de Defesa contra corpo a corpo e +5 contra ataque à distância", () => {
    const fallen = makeToken({ id: "alvo", defense: 15, conditions: ["Caído"] });
    const attacker = makeToken({ id: "atk", gx: 2, gy: 1 });
    const b = board([fallen, attacker]);
    expect(targetDefense(b, attacker, fallen, false)).toBe(10);
    expect(targetDefense(b, attacker, fallen, true)).toBe(20);
  });

  it("Petrificado dá RD 8; Enjoado limita a uma ação por rodada", () => {
    expect(conditionMods(["Petrificado"]).damageReduction).toBe(8);
    expect(conditionMods(["Enjoado"]).oneActionPerRound).toBe(true);
  });
});

describe("testes de resistência", () => {
  it("Desprevenido soma −5 em Reflexos", () => {
    const token = makeToken({ reflexes: 4, conditions: ["Desprevenido"] });
    expect(saveModifier(token, "reflexes")).toBe(-1);
    expect(saveModifier(token, "will")).toBe(token.will);
  });

  it("Indefeso falha automaticamente em Reflexos, mesmo com 20 natural", () => {
    const token = makeToken({ conditions: ["Indefeso"] });
    expect(resolveSave({ target: token, type: "reflexes", dc: 1, roll: () => 20 }).passed).toBe(false);
    expect(resolveSave({ target: token, type: "fortitude", dc: 1, roll: () => 20 }).passed).toBe(true);
  });
});

describe("ações e movimento", () => {
  it("Atordoado, Pasmo, Inconsciente e Fascinado não agem", () => {
    for (const name of ["Atordoado", "Pasmo", "Inconsciente", "Fascinado", "Paralisado", "Surpreendido"]) {
      expect(conditionMods([name]).canAct).toBe(false);
    }
    expect(conditionMods(["Abalado"]).canAct).toBe(true);
  });

  it("deslocamento: Lento metade, Imóvel zero, Caído 1,5 m, Sobrecarregado −3 m", () => {
    expect(adjustedSpeedM(["Lento"], 9)).toBe(4.5);
    expect(adjustedSpeedM(["Imóvel"], 9)).toBe(0);
    expect(adjustedSpeedM(["Caído"], 9)).toBe(1.5);
    expect(adjustedSpeedM(["Sobrecarregado"], 9)).toBe(6);
    expect(adjustedSpeedM([], 9)).toBe(9);
  });

  it("o alcance de movimento respeita as condições", () => {
    const normal = makeToken({ movementM: 9 });
    const slowed = makeToken({ movementM: 9, conditions: ["Lento"] });
    const stuck = makeToken({ movementM: 9, conditions: ["Imóvel"] });
    expect(reachableCells(board([normal]), normal).size).toBeGreaterThan(reachableCells(board([slowed]), slowed).size);
    expect(reachableCells(board([stuck]), stuck).size).toBe(1);
  });
});

describe("início do turno", () => {
  it("Em Chamas, Sangrando e Confuso disparam efeitos", () => {
    expect(turnStartEffects(["Em Chamas", "Sangrando", "Confuso"])).toEqual(["fire", "bleed", "confused"]);
    expect(turnStartEffects(["Abalado"])).toEqual([]);
  });

  it("descreve o comportamento do Confuso pela rolagem", () => {
    expect(confusedBehavior(1)).toContain("direção");
    expect(confusedBehavior(2)).toContain("não pode fazer ações");
    expect(confusedBehavior(5)).toContain("ataca");
    expect(confusedBehavior(6)).toContain("termina");
  });
});
