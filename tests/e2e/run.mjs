// Smoke test of the built app (dist/index.html) against a mock of the Claude artifact runtime.
// Covers the flows that have broken before: logging several foods, serving sizes, carry-over,
// the weekly plan / arm day, and the motivation flow.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const mock = readFileSync(new URL("./mock-runtime.js", import.meta.url), "utf8");
const html = readFileSync(process.argv[2] || "dist/index.html", "utf8");
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const seed = { ["day-" + dk(1)]: { items: [{ name: "x", kcal: 2900, p: 160, c: 300, f: 120, q: 1, meal: "Lunch" }] } };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.setContent(`<!doctype html><html><head><meta charset=utf8><style>[hidden]{display:none!important}</style><script>window.__seed=${JSON.stringify(seed)}</script><script>${mock}</script></head><body>${html}</body></html>`);
await p.waitForTimeout(600);
const step = async (name, fn) => { await fn(); console.log("ok  " + name); };

await step("carry-over note after an overeating day", async () => {
  assert.match(await p.textContent("#tCarry"), /Alteration: −490 kcal/);
});
await step("log several foods in a row", async () => {
  await p.click("nav.tabs button[data-tab=food]");
  for (const f of ["chicken breast", "banana", "egg, large"]) { await p.fill("#fSearch", f); await p.dispatchEvent("#fSearch", "input"); await p.locator("#fResults .cand").first().locator("button.btn").click(); await p.waitForTimeout(80); }
  assert.equal(await p.locator("#fLog .item").count(), 3);
});
await step("change a serving to grams", async () => {
  await p.locator("#fLog .item", { hasText: "Chicken" }).locator('button:has-text("Edit amount")').click();
  await p.selectOption("#le-unit", "g"); await p.fill("#le-amt", "250");
  await p.click('#fLog button:has-text("Save amount")'); await p.waitForTimeout(150);
  assert.match(await p.locator("#fLog .item", { hasText: "Chicken" }).textContent(), /250 g · 413 kcal/);
});
await step("AI estimate goes through validation", async () => {
  await p.fill("#fSearch", "chicken and rice"); await p.click("#fAsk"); await p.waitForTimeout(150);
  assert.equal(await p.locator("#fResults .cand").count(), 2);
});
await step("weekly plan and optional arm day", async () => {
  await p.click("nav.tabs button[data-tab=train]"); await p.waitForTimeout(100);
  assert.match(await p.textContent("#weekPanel"), /This week/);
  await p.locator('#weekPanel button:has-text("Do today")').click(); await p.waitForTimeout(100);
  assert.equal(await p.textContent("#woTitle"), "Arm day (optional)");
});
await step("motivation flow logs a moment", async () => {
  await p.click("nav.tabs button[data-tab=why]"); await p.click("#sosFood"); await p.waitForTimeout(100);
  await p.click('#sosBody button:has-text("I held the line")'); await p.waitForTimeout(150);
  assert.match(await p.textContent("#whyLearn"), /1 moment logged/);
});
await b.close();
assert.deepEqual(errs, [], "page errors: " + errs.join("; "));
console.log("smoke tests passed");
