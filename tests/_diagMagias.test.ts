import { it } from "vitest";
import fs from "node:fs";
import { findSpellByName, T20_SPELLS } from "../src/portal/lib/t20/compendium";

const sp = "C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad";

it.skip("diagnóstico das magias das fichas", () => {
  const out: string[] = [];
  for (const n of ["renard", "astolfo", "m"]) {
    const f = JSON.parse(fs.readFileSync(`${sp}/campos-${n}.json`, "utf8"));
    const lines = String(f.Magias ?? "").split(/\r?\n/).filter((l) => l.trim() && !/^[\s=]*\d.{0,3}c[ií]rculo/i.test(l) && !/^\s*\d+\s*PM\s*$/i.test(l));
    out.push("== " + n);
    for (const l of lines) out.push((findSpellByName(l.trim()) ? "OK    " : "FALTA ") + "| " + l.trim().slice(0, 90));
  }
  out.push("no catálogo (parecidos): " + T20_SPELLS.filter((s) => /flecha|amedront|amendront|escurid|ferimento|espelhada|campo de for|despeda/i.test(s.nome)).map((s) => `${s.nome} (${s.circulo}º)`).join("; "));
  fs.writeFileSync(`${sp}/diag-magias.txt`, out.join("\n"));
});
