#!/usr/bin/env node
/**
 * Critical visual-lock guard.
 *
 * The supplied Mesa Online skin is a frozen deliverable. Functional work may
 * call existing controls and use an already-open contextual drawer, but it may
 * not edit the source files that define the supplied mask. This check detects
 * content changes as well as unexpected additions/removals in that mask.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(fileURLToPath(new URL(".", import.meta.url)));
const projectRoot = resolve(here, "..");
const manifestPath = join(here, "visual-lock.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function walk(path) {
  if (!existsSync(path)) return [];
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = join(path, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

// The supplied mask is the MesaSkin tree plus the two cascading stylesheets.
const files = [
  ...walk(join(projectRoot, "src/components/mesaSkin")),
  join(projectRoot, "src/index.css"),
  join(projectRoot, "src/mesa-theme.css"),
];
/**
 * Resumo do arquivo sem depender do fim de linha: no Windows o arquivo pode estar com CRLF e no repositório (Linux,
 * GitHub Actions) com LF. Só o conteúdo conta; imagens e outros binários entram como estão.
 */
function digest(file) {
  const raw = readFileSync(file);
  const text = !raw.includes(0);
  return createHash("sha256").update(text ? Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8") : raw).digest("hex");
}

const actual = Object.fromEntries(files
  .sort()
  .map((file) => [relative(projectRoot, file).replaceAll("\\", "/"), digest(file)]));

const expectedPaths = Object.keys(manifest.files).sort();
const actualPaths = Object.keys(actual).sort();
const failures = [];
for (const path of expectedPaths) {
  if (!(path in actual)) failures.push(`missing protected file: ${path}`);
  else if (actual[path] !== manifest.files[path]) failures.push(`content changed: ${path}`);
}
for (const path of actualPaths) {
  if (!(path in manifest.files)) failures.push(`unexpected protected file: ${path}`);
}

if (failures.length) {
  console.error("VISUAL LOCK FAILED — the supplied Mesa mask must not be changed.");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Visual lock passed: ${actualPaths.length} supplied-mask files match the frozen manifest.`);
}
