// Parity check: renders the previous single-file build and the new build with identical seeded data
// and compares every number the user sees. Usage: node tests/e2e/parity.mjs <old.html> <new.html>
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [oldPath, newPath] = process.argv.slice(2);
const mock = readFileSync(new URL("./mock-runtime.js", import.meta.url), "utf8");
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const it = (kcal, p, c, f) => ({ name: "x", serving: "1", kcal, p, c, f, q: 1, meal: "Lunch" });
const seed = {};
for (let i = 1; i <= 22; i++) seed["day-" + dk(i)] = { items: [it(2000 + (i % 5) * 180, 150 + i, 180, 60 + (i % 4) * 12)], weightKg: 109.5 - (22 - i) * 0.07 + (i % 3) * 0.3, steps: 6000 + i * 300, sleepH: 5.5 + (i % 4) * 0.6 };
[30, 23, 16, 9, 2].forEach((o) => { seed["wo-" + dk(o)] = { session: "LA", done: true, pain: 2, sets: { legpress: [{ w: 100, r: 10, ok: true }, { w: 100, r: 12, ok: true }], rdl: [{ w: 60, r: 8, ok: true }] } }; });
[29, 22, 15, 8, 1].forEach((o, i) => { seed["wo-" + dk(o)] = { session: "UA", done: true, pain: 3 + (i % 3), sets: { "dbbench|R": [{ w: 30, r: 10, ok: true }, { w: 30, r: 10, ok: true }, { w: 30, r: 10, ok: true }], "dbbench|L": [{ w: 14, r: 8, ok: true }], pulldown: [{ w: 50, r: 12, ok: true }, { w: 50, r: 12, ok: true }, { w: 50, r: 12, ok: true }] } }; });
const SEL = ["#tRingLeg", "#tMacros", "#tCarry", "#rcBody", "#gProj", "#gLeft", "#fKcalOf", "#bTargets", "#bTdeeExplain", "#weekPanel", "#woList", "#balList", "#bRate", "#whyProof"];
async function snapshot(path) {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const html = readFileSync(path, "utf8");
  await p.setContent(`<!doctype html><html><head><meta charset=utf8><style>[hidden]{display:none!important}</style><script>window.__seed=${JSON.stringify(seed)}</script><script>${mock}</script></head><body>${html}</body></html>`);
  await p.waitForTimeout(700);
  const out = {};
  for (const s of SEL) out[s] = (await p.locator(s).count()) ? (await p.textContent(s)).replace(/\s+/g, " ").trim() : "(missing)";
  await b.close(); return { out, errs };
}
const A = await snapshot(oldPath), B = await snapshot(newPath);
let diffs = 0;
for (const s of SEL) if (A.out[s] !== B.out[s]) { diffs++; console.log(`DIFF ${s}\n  old: ${A.out[s].slice(0, 400)}\n  new: ${B.out[s].slice(0, 400)}`); }
console.log(`errors old=${A.errs.length} new=${B.errs.length}`, B.errs.slice(0, 3));
console.log(diffs ? `${diffs} section(s) differ` : `PARITY OK: ${SEL.length} sections identical`);
process.exit(diffs || B.errs.length ? 1 : 0);
