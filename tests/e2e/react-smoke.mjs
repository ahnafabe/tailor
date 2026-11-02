import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const mock = readFileSync(new URL("./mock-runtime.js", import.meta.url), "utf8");
const html = readFileSync(process.argv[2], "utf8");
const dk = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const seed = { ["day-" + dk(1)]: { items: [{ name: "x", kcal: 2900, p: 160, c: 300, f: 120, q: 1, meal: "Lunch" }] }, ["day-" + dk(0)]: { items: [{ name: "Oats", kcal: 150, p: 5, c: 27, f: 2.6, q: 1, meal: "Breakfast" }], steps: 5200 } };
const b = await chromium.launch(); const errs = [];
for (const scheme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/ERR_|Failed to load/.test(m.text()) && errs.push(m.text()));
  await p.setContent(`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}body{margin:0}</style><script>window.__seed=${JSON.stringify(seed)}</script><script>${mock}</script></head><body>${html}</body></html>`);
  await p.waitForSelector('[data-testid="ring-legend"]', { timeout: 15000 });
  console.log(scheme, "legend:", await p.textContent('[data-testid="ring-legend"]'), "| carry:", await p.textContent('[data-testid="carry-note"]'), "| sync:", await p.textContent("header .tag:last-child"));
  await p.screenshot({ path: `dist/react-${scheme}.png` });
  if (scheme === "light") {
    await p.click('nav.tabs button:has-text("Food")'); await p.fill('input[type=search]', 'banana'); await p.click('[data-testid="results"] button:has-text("Add")'); await p.waitForTimeout(300);
    console.log("food log:", (await p.textContent('[data-testid="food-log"]')).slice(0, 160));
    console.log("saved to mock db:", JSON.stringify((await p.evaluate(() => window.__store))["day-" + new Date().toISOString().slice(0,10)]?.items?.length ?? Object.values(await p.evaluate(() => window.__store)).map(v=>v.items?.length)));
  }
  await p.close();
}
console.log("errors:", errs); await b.close();
