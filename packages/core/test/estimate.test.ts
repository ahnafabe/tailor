import { test } from "vitest";
import assert from "node:assert/strict";
import { describeFoodPrompt, findBrands, foodCatalog, macrosAddUp, parseAiFoodItems, photoFoodPrompt, relatedFoods, type DayLog } from "../src";

test("finds brands and restaurants named in a description", () => {
  assert.deepEqual(findBrands("Starbucks spinach feta wrap"), ["Starbucks"]);
  assert.deepEqual(findBrands("timmies double double and a McChicken"), ["Tim Hortons", "McDonald's"]);
  assert.deepEqual(findBrands("Mary Browns 2 piece, Osmow’s garlic sauce"), ["Mary Brown's", "Osmow's"]);
  assert.deepEqual(findBrands("chicken with chipotle mayo"), []); // the sauce, not the restaurant
  assert.deepEqual(findBrands("chipotle bowl with double chicken"), ["Chipotle"]);
  assert.deepEqual(findBrands("200 g chicken breast and rice"), []);
});

test("prompt insists on the brand's own published numbers when a brand is named", () => {
  const p = describeFoodPrompt("Starbucks spinach feta wrap", { brands: ["Starbucks"], area: "Surrey, BC" });
  assert.match(p, /Starbucks/);
  assert.match(p, /OWN published nutrition/);
  assert.match(p, /Canadian/);
  assert.match(p, /Surrey, BC/);
  assert.match(describeFoodPrompt("2 eggs"), /USDA/);
  assert.match(photoFoodPrompt("from Starbucks", { brands: ["Starbucks"] }), /logo|packaging/);
});

test("prompt includes similar foods already logged", () => {
  const days: Record<string, DayLog> = { "2026-11-01": { items: [{ name: "Kirkland rotisserie chicken breast", kcal: 330, p: 50, c: 0, f: 14, q: 1, serving: "1 breast" }, { name: "Rice, cooked", kcal: 205, p: 4, c: 45, f: 0.4, q: 1 }] } };
  const rel = relatedFoods(foodCatalog({}, days), "rotisserie chicken with salad");
  assert.deepEqual(rel.map((f) => f.name), ["Kirkland rotisserie chicken breast"]);
  const p = describeFoodPrompt("rotisserie chicken", { similar: rel });
  assert.match(p, /logged these similar foods before.*Kirkland rotisserie chicken breast \(1 breast: 330 kcal/);
});

test("'official' items whose macros don't add up are downgraded to estimates", () => {
  const wrap = { name: "Spinach & Feta Wrap", serving: "1 wrap", kcal: 290, p: 20, c: 34, f: 8, source: "official", sourceNote: "Starbucks Canada" };
  const bad = { ...wrap, name: "Made up", kcal: 900 };
  const r = parseAiFoodItems({ items: [wrap, bad, { name: "Rice", kcal: 205, p: 4, c: 45, f: 0.4, source: "weird" }] });
  assert.deepEqual(r.items.map((i) => [i.name, i.source]), [["Spinach & Feta Wrap", "official"], ["Made up", "estimate"], ["Rice", "estimate"]]);
  assert.equal(r.downgraded, 1);
  assert.equal(macrosAddUp({ kcal: 290, p: 20, c: 34, f: 8 }), true);
});
