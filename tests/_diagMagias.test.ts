import { it } from "vitest";
import fs from "node:fs";
import { T20_RACES, T20_POWERS, T20_ORIGINS, findPowerByName } from "../src/portal/lib/t20/compendium";
import renard from "../src/portal/data/ready/renard.json";

/** Diagnóstico temporário (só roda com DIAG=1). */
const sp = "C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad";

it.runIf(process.env.DIAG === "1")("diagnóstico de habilidades de raça e origem", () => {
  const out: string[] = [];
  for (const name of ["criança das trevas", "herança divina", "sombras profanas", "usurpar", "luz sagrada"]) {
    const p = findPowerByName(name) as any;
    out.push(`poder "${name}" -> ${p ? JSON.stringify({ id: p.id, nome: p.nome, tipo: p.tipo, subtipo: p.subtipo, fonte: p.fonte, requisito: p.requisito }) : "NÃO ACHADO"}`);
  }
  const powersByName = (re: RegExp) => (T20_POWERS as any[]).filter((p) => re.test(p.nome)).map((p) => `${p.nome} [${p.tipo}/${p.subtipo ?? ""}]`);
  out.push("poderes parecidos: " + JSON.stringify(powersByName(/crian[cç]a das trevas|sombras profanas|usurpar|heran[cç]a divina/i)));
  const sul = T20_RACES.find((r: any) => r.id === "suraggel-sulfure") as any;
  out.push("raça suraggel-sulfure: " + JSON.stringify({ atributos: sul.atributos, bonusTexto: sul.bonusTexto, habilidades: sul.habilidades, tipoCriatura: sul.tipoCriatura }));
  out.push("raças suraggel no catálogo: " + (T20_RACES as any[]).filter((r) => /suraggel|aggelus|sulfure/i.test(r.nome + r.id)).map((r) => `${r.id}=${r.nome}`).join("; "));
  const origin = (T20_ORIGINS as any[]).find((o) => /duplo/i.test(o.nome));
  out.push("origem Duplo feérico: " + JSON.stringify(origin));
  out.push("ficha racialAbilities[0]: " + JSON.stringify((renard as any).racialAbilities[0]).slice(0, 400));
  out.push("ficha powers[0]: " + JSON.stringify((renard as any).powers[0]).slice(0, 300));
  const f = JSON.parse(fs.readFileSync(`${sp}/campos-renard.json`, "utf8"));
  out.push("PDF campo 'Habilidades de Raça e Origem':\n" + f["Habilidades de Raça e Origem"]);
  for (const n of ["astolfo", "m"]) {
    const g = JSON.parse(fs.readFileSync(`${sp}/campos-${n}.json`, "utf8"));
    out.push(`PDF ${n} campo 'Habilidades de Raça e Origem':\n` + g["Habilidades de Raça e Origem"]);
  }
  fs.writeFileSync(`${sp}/diag-raca2.txt`, out.join("\n"));
});
