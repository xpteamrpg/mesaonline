import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThreatLibraryDialog } from "../src/components/Libraries";
import { getOfficialThreats } from "../src/tactics/data/bestiaryAdapter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

/** A janela do Bestiário da Mesa mostra os ataques e as habilidades de cada ameaça (antes só PV, Defesa e dano). */
describe("bestiário da Mesa: ataques e habilidades", () => {
  it("o Gnoll Capanga mostra Espada curta e Mordida como ataques e o Bote como habilidade", async () => {
    const templates = getOfficialThreats().filter((template) => template.name === "Gnoll Capanga");
    expect(templates.length).toBeGreaterThan(0);
    await act(async () => { root.render(<ThreatLibraryDialog open templates={templates} onClose={() => undefined} onSpawn={() => undefined} />); });
    const details = host.querySelector("details.threat-details") as HTMLDetailsElement;
    expect(details).toBeTruthy();
    expect(details.textContent).toContain("1 habilidade");
    await act(async () => { details.open = true; details.dispatchEvent(new Event("toggle")); });
    const text = details.textContent!;
    expect(text).toContain("Espada curta");
    expect(text).toContain("Mordida");
    expect(text).toContain("Bote");
    expect(text).toContain("investida");
  });

  it("toda ameaça oficial com habilidades no catálogo as lista no detalhe", () => {
    const withAbilities = getOfficialThreats().filter((template) => (template.abilities ?? []).length > 0);
    expect(withAbilities.length).toBeGreaterThan(400);
  });
});
