import { it } from "vitest";
import fs from "node:fs";
import { T20_RACES, findRaceByName } from "../src/portal/lib/t20/compendium";
import { heroJsonToDraft } from "../src/portal/lib/pdf/heroJson";
import { attackTotal, defense, skillTotal } from "../src/portal/lib/t20/sheetRules";

/**
 * Ferramenta de desenvolvimento (só roda com GERAR_HEROIS=1): monta src/portal/data/ready/*.json a partir das fichas
 * importadas pelo botão "Importar ficha em PDF" (sheet-*.json) e dos campos dos PDFs, e escreve um relatório de conferência.
 */
const sp = process.env.HEROIS_TMP ?? "";
const HEROIS = [
  { key: "renard", pdf: "renard", id: "pronto-renard", name: "Renard", file: "renard" },
  { key: "kalop", pdf: "astolfo", id: "pronto-astolfo", name: "Astolfo", file: "astolfo" },
  { key: "m", pdf: "m", id: "pronto-lagrima", name: "Lágrima desk", file: "lagrima" },
];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

it.runIf(process.env.GERAR_HEROIS === "1")("gera os heróis prontos", () => {
  const report: string[] = [];
  report.push("raças parecidas com Eiradan: " + T20_RACES.filter((r) => /eira|eir/i.test(r.nome)).map((r) => `${r.id}=${r.nome}`).join("; ") + " | findRaceByName('Eiradan'): " + (findRaceByName("Eiradan")?.id ?? "nada"));
  for (const h of HEROIS) {
    const sheet = JSON.parse(fs.readFileSync(`${sp}/sheet-${h.key}.json`, "utf8"));
    const fields = JSON.parse(fs.readFileSync(`${sp}/campos-${h.pdf}.json`, "utf8"));
    const draft = heroJsonToDraft({ personagem: { nome: h.name }, campos_originais_pdf: fields });
    // magias: as do leitor corrigido (catálogo, com custo do catálogo)
    sheet.spells = draft.spells ?? [];
    if (draft.powers?.length) sheet.powers = draft.powers; // inclui poderes de raça e origem do campo "Habilidades de Raça e Origem"
    const classExtra = String(fields.Classe ?? "").match(/\(([^)]*)\)/)?.[1]?.trim();
    const classText = String(fields.Classe ?? "").replace(/\([^)]*\)/g, "").trim();
    sheet.id = h.id;
    sheet.name = h.name;
    sheet.campaign = "Campanha livre";
    sheet.avatar = `/herois/${h.key}-token.webp`;
    delete sheet.avatarPos;
    const race = T20_RACES.find((r) => r.id === sheet.raceId);
    if (race && draft.raceId === sheet.raceId) sheet.race = race.nome;
    sheet.race = cap(sheet.race);
    if (sheet.origin) sheet.origin = cap(sheet.origin);
    if (!/^arcanista$/i.test(sheet.class)) sheet.class = "Arcanista"; // classId já é arcanista; o texto vinha do caminho escrito na ficha
    else sheet.class = "Arcanista";
    const path = classExtra || (/^arcanista$/i.test(classText) ? "" : classText);
    if (path) sheet.path = cap(path);
    sheet.notes = [`Herói do playtest (importado de ${h.pdf}.pdf).`, sheet.notes && !/^Importado de/.test(sheet.notes) ? sheet.notes : ""].filter(Boolean).join("\n\n");
    fs.mkdirSync("src/portal/data/ready", { recursive: true });
    fs.writeFileSync(`src/portal/data/ready/${h.file}.json`, JSON.stringify(sheet, null, 1));

    const def = defense(sheet);
    const lut = skillTotal(sheet, "lut");
    report.push(`\n=== ${h.name} (${h.pdf}.pdf) ===`);
    report.push(`nome/raça/classe/nível: ${sheet.name} | ${sheet.race} (${sheet.raceId}) | ${sheet.class}${sheet.path ? " (" + sheet.path + ")" : ""} (${sheet.classId}) | nv ${sheet.level} | origem ${sheet.origin} | divindade ${sheet.deity ?? "-"}`);
    report.push(`atributos ficha: ${JSON.stringify(Object.fromEntries(Object.entries(sheet.attributes).map(([k, v]) => [k, (v as { value: number }).value])))}`);
    report.push(`PDF campos de atributo: ${JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([k]) => /^mod(for|des|con|int|sab|car)$/i.test(k))))}`);
    report.push(`PV ${sheet.hp.max} (PDF vidaMax ${fields.vidaMax}) | PM ${sheet.mp.max} (PDF manaMax ${fields.manaMax}) | deslocamento ${sheet.speed} (PDF ${fields.deslocamento})`);
    report.push(`defesa na ficha: ${def.total} | PDF defesa: Texto13=${fields.Texto13 ?? "-"}, defesa1=${fields.defesa1 ?? "-"}, defesaOutros=${fields.defesaOutros ?? "-"}`);
    report.push(`ataques: ${sheet.attacks.map((a: never) => { const x = a as { name: string }; return `${x.name} +${attackTotal(sheet, a).bonus}`; }).join("; ")} | Luta total ${lut?.total}`);
    report.push(`poderes (${sheet.powers.length}): ${sheet.powers.map((p: { name: string }) => p.name).join("; ")}`);
    report.push(`magias (${sheet.spells.length}): ${sheet.spells.map((s: { name: string; circle: number; cost: number }) => `${s.name} ${s.circle}º/${s.cost}PM`).join("; ")}`);
    report.push(`equipamento (${sheet.equipment.length}): ${sheet.equipment.map((e: { name: string; equipped: boolean }) => e.name + (e.equipped ? "*" : "")).join("; ")}`);
    report.push(`perícias treinadas: ${Object.entries(sheet.skills).filter(([, v]) => (v as { trained?: boolean }).trained).map(([k]) => k).join(", ")} | T$ ${sheet.money} | PE ${sheet.xp}`);
  }
  fs.writeFileSync(`${sp}/relatorio-herois.txt`, report.join("\n"));
});
