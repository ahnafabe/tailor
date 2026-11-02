// Builds the single-file app that gets published as the Claude artifact.
// 1. Bundles @tailor/core (TypeScript) into one IIFE exposed as window.TailorCore.
// 2. Inlines it into apps/legacy/src/app.html ahead of the app script.
// 3. Writes dist/index.html.
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const core = await build({
  entryPoints: ["packages/core/src/index.ts"],
  bundle: true,
  format: "iife",
  globalName: "TailorCore",
  target: "es2020",
  minify: true,
  write: false,
  legalComments: "none",
});
const coreJs = core.outputFiles[0].text;

const html = await readFile("apps/legacy/src/app.html", "utf8");
const marker = "<script>\n(function(){";
if (!html.includes(marker)) throw new Error("App script marker not found in app.html");
// Function replacer: the bundle contains "$" sequences that a replacement string would treat as patterns.
const coreTag = `<script>/* @tailor/core */\n${coreJs.replace(/<\/script/gi, () => "<\\/script")}</script>\n`;
const out = html.replace(marker, () => coreTag + marker);

await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", out);
console.log(`dist/index.html  ${(out.length / 1024).toFixed(0)} KB (core ${(coreJs.length / 1024).toFixed(0)} KB)`);
