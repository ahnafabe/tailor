import { test } from "vitest";
import assert from "node:assert/strict";
import { adaptive, addDays, countsAsLogged, dayTargets, foodCatalog, foodKey, searchCatalog, type DayLog } from "../src";
import { food, state } from "./helpers";

test("a day marked partial never counts as a full logged day", () => {
  const full: DayLog = { items: [food(2100)] };
  assert.equal(countsAsLogged(full), true);
  assert.equal(countsAsLogged({ ...full, partial: true }), false);
  assert.equal(countsAsLogged({ items: [food(500)] }), false); // too little to be a real day
  assert.equal(countsAsLogged(undefined), false);
});

test("observed burn ignores partial days instead of reading them as huge deficits", () => {
  const days: Record<string, DayLog> = {};
  let k = "2026-10-01";
  for (let i = 0; i < 21; i++, k = addDays(k, 1)) days[k] = { items: [food(2500)], weightKg: 100 };
  const before = adaptive({ days })!;
  // Mark 5 days partial with only 1,000 kcal logged
  Object.keys(days).slice(3, 8).forEach((d) => { days[d] = { ...days[d], items: [food(1000)], partial: true }; });
  const after = adaptive({ days })!;
  assert.equal(after.tdee, before.tdee);
  assert.equal(after.n, before.n - 5);
});

test("a partial day that was already over target still carries over (logged food is a minimum)", () => {
  const s = state();
  const base = dayTargets(s, "2026-11-02")!;
  s.days["2026-11-01"] = { items: [food(base.kcal + 300)], partial: true };
  assert.equal(dayTargets(s, "2026-11-02")!.carry, 300);
});

test("catalogue: one entry per food, built from history, with count and last amount", () => {
  const days: Record<string, DayLog> = {
    "2026-11-01": { items: [{ ...food(165, 31, 0, 3.6, 2), name: "Chicken breast", serving: "100 g", amt: 200, unit: "g" }] },
    "2026-11-03": { items: [{ ...food(170, 31, 0, 4, 1.5), name: "chicken  breast", serving: "100 g", amt: 150, unit: "g" }] },
    "2026-11-02": { items: [{ ...food(250, 5, 50, 1), name: "Rice" }] },
  };
  const cat = foodCatalog({}, days);
  assert.equal(cat.length, 2);
  const ch = cat[0];
  assert.equal(ch.lastUsed, "2026-11-03"); // most recent first
  assert.equal(ch.count, 2);
  assert.equal(ch.kcal, 170); // latest nutrition seen
  assert.deepEqual(ch.last, { q: 1.5, amt: 150, unit: "g" });
  assert.equal(ch.saved, false);
});

test("catalogue: a saved food wins over history, and hidden foods disappear", () => {
  const days: Record<string, DayLog> = { "2026-11-01": { items: [{ ...food(999), name: "Greek yogurt" }, { ...food(100), name: "Apple" }] } };
  const foods = {
    f1: { id: "f1", name: "Greek Yogurt", serving: "170 g", kcal: 100, p: 17, c: 6, f: 0 },
    f2: { id: "f2", name: "apple", kcal: 95, p: 0, c: 25, f: 0, hidden: true },
  };
  const cat = foodCatalog(foods, days);
  assert.deepEqual(cat.map((f) => [f.id, f.kcal, f.count]), [["f1", 100, 1]]);
});

test("catalogue search matches every word, most-logged first", () => {
  const days: Record<string, DayLog> = {
    "2026-11-01": { items: [{ ...food(1), name: "Chicken thigh (no skin)" }, { ...food(1), name: "Chicken breast" }] },
    "2026-11-02": { items: [{ ...food(1), name: "Chicken breast" }] },
  };
  const cat = foodCatalog({}, days);
  assert.deepEqual(searchCatalog(cat, "chick").map((f) => f.name), ["Chicken breast", "Chicken thigh (no skin)"]);
  assert.deepEqual(searchCatalog(cat, "thigh chicken").map((f) => f.name), ["Chicken thigh (no skin)"]);
  assert.equal(foodKey("Chicken thigh (no skin)"), "chicken thigh");
});
