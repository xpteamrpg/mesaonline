import { it } from "vitest";
import fs from "node:fs";
import { loadReadyHeroSheets } from "../ficha-modernrpg/characterRoute";

/** Confronto temporário (só com DIAG=1): o que está escrito na ficha original e NÃO aparece na ficha final do site. */
const sp = "C:/Users/Dannilo/AppData/Local/Temp/claude/c--RPG-AI-tste-Site-Mes-ONline-MesaOnline-entrega-atualizada-2026-09-29-v3-FUSAO-EM-ANDAMENTO/7f319fbb-7378-4199-bdf7-aed9c2631172/scratchpad";
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+\-./ ]+/g, " ").replace(/\s+/g, " ").trim();

it.runIf(process.env.DIAG === "1")("confronto das fichas", () => {
  const out: string[] = [];
  const sheets = loadReadyHeroSheets() as unknown as Array<Record<string, any>>;
  const fontes: Array<{ nome: string; idx: number; campos: Record<string, string> }> = [];
  for (const [nome, idx, arq] of [["Renard", 0, "campos-renard.json"], ["Astolfo", 1, "campos-astolfo.json"], ["Lágrima desk", 3, "campos-m.json"]] as const) fontes.push({ nome, idx, campos: JSON.parse(fs.readFileSync(`${sp}/${arq}`, "utf8")) });
  for (const f of fontes) {
    const sheet = sheets[f.idx];
    const alvo = norm(JSON.stringify(sheet, (k, v) => (k === "avatar" ? undefined : v)));
    out.push(`\n===== ${f.nome} (PDF: ${Object.keys(f.campos).length} campos preenchidos) =====`);
    const naoAchados: string[] = [];
    for (const [k, v] of Object.entries(f.campos)) {
      const texto = String(v).trim(); if (!texto || texto === "on" || /^[+\-\d.,\s/]{1,6}$/.test(texto)) continue;
      // texto longo: confere por linhas/trechos; curto: confere inteiro
      const partes = texto.length > 80 ? texto.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 6 && !/^[=\-\s]*$/.test(l)) : [texto];
      const faltando = partes.filter((p) => { const n = norm(p); return n.length >= 4 && !alvo.includes(n) && !alvo.includes(n.slice(0, 30)); });
      if (faltando.length) naoAchados.push(`  • ${k}: ${faltando.length}/${partes.length} trecho(s) ausente(s) → ${faltando.slice(0, 3).map((x) => JSON.stringify(x.slice(0, 70))).join(" ; ")}`);
    }
    out.push(naoAchados.length ? naoAchados.join("\n") : "  (tudo que está escrito no PDF aparece na ficha)");
  }
  // Kalop: JSON da ficha de origem
  const kj = JSON.parse(fs.readFileSync("C:/RPG/AI tste/Mesa de teste do Morden/Kalopjson.json", "utf8")); delete kj.charImage;
  const ks = sheets[2]; const alvoK = norm(JSON.stringify(ks, (k, v) => (k === "avatar" ? undefined : v)));
  out.push(`\n===== Kalop Sita (JSON de origem) =====`);
  const faltaK: string[] = [];
  const visita = (valor: unknown, caminho: string) => {
    if (typeof valor === "string") { const t = valor.trim(); if (t.length < 4 || /^[+\-\d.,\s/]+$/.test(t)) return; const partes = t.length > 80 ? t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 6) : [t]; const f = partes.filter((p) => { const n = norm(p); return n.length >= 4 && !alvoK.includes(n) && !alvoK.includes(n.slice(0, 30)); }); if (f.length) faltaK.push(`  • ${caminho}: ${f.length}/${partes.length} ausente(s) → ${f.slice(0, 2).map((x) => JSON.stringify(x.slice(0, 70))).join(" ; ")}`); }
    else if (Array.isArray(valor)) valor.forEach((x, i) => visita(x, `${caminho}[${i}]`));
    else if (valor && typeof valor === "object") for (const [k, v] of Object.entries(valor)) visita(v, caminho ? `${caminho}.${k}` : k);
  };
  visita(kj, "");
  out.push(faltaK.length ? faltaK.join("\n") : "  (tudo que está escrito no JSON aparece na ficha)");
  fs.writeFileSync(`${sp}/confronto.txt`, out.join("\n"));
});
