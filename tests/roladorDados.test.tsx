import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DicePanel, { rollGroups } from "../src/components/mesa/DicePanel";
import type { DiceResolution } from "../src/game/types";

const entry = (over: Partial<DiceResolution>): DiceResolution => ({
  id: "r1", actor: "Teste", target: "—", action: "Rolagem", kind: "system", total: 12, formula: "2d8", rolls: [6, 6], outcome: "Rolagem", success: true, timestamp: 1700000000000, ...over,
});

describe("rolador de dados", () => {
  it("distribui os números rolados pelos grupos da fórmula", () => {
    expect(rollGroups("2d8+1d6+3", [6, 6, 4])).toEqual([
      { faces: 8, count: 2, values: [6, 6] },
      { faces: 6, count: 1, values: [4] },
    ]);
    expect(rollGroups("1d20+5", [12])).toEqual([{ faces: 20, count: 1, values: [12] }]);
    // fórmula que não casa com os números: um grupo só, sem forma de dado
    expect(rollGroups("ataque", [3, 4])).toEqual([{ faces: null, count: 2, values: [3, 4] }]);
  });

  it("o histórico mostra cada dado entre colchetes e o total em destaque, sem o texto 'Rolagem D20'", () => {
    const html = renderToStaticMarkup(<DicePanel rolls={[entry({}), entry({ id: "r2", formula: "1d20+5", rolls: [12], modifier: 5, total: 17 })]} actor="Teste" onClose={() => {}} />);
    expect(html).toContain("[6]");
    expect(html).toContain("[12]");
    expect(html).toMatch(/data-dice-total[^>]*>12</);
    expect(html).toMatch(/data-dice-total[^>]*>17</);
    expect(html).not.toContain("Rolagem D20");
    // os 8 dados disponíveis (d20 a D%, sem o d2) como botões pequenos
    expect((html.match(/data-die-button=/g) ?? []).length).toBe(8);
  });
});
