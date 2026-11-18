import { test } from "vitest";
import assert from "node:assert/strict";
import { similarFoods, looksNonHalal, macrosLeft, mealsLeft, parseAiOrders, suggestMeals, type SuggestFood } from "../src";

const F = (id: string, name: string, kcal: number, p: number, c: number, f: number, count = 3): SuggestFood => ({ id, name, kcal, p, c, f, count });
const foods = [
  F("ch", "Chicken breast", 165, 31, 0, 3.6, 10),
  F("rice", "Rice, cooked", 205, 4, 45, 0.4, 8),
  F("gy", "Greek yogurt", 100, 17, 6, 0.7, 6),
  F("pb", "Peanut butter", 190, 7, 7, 16, 2),
  F("bacon", "Bacon", 90, 6, 0, 7, 1),
  F("bar", "Protein bar", 200, 20, 22, 7, 4),
];

test("halal screen catches pork and alcohol but trusts anything labelled halal", () => {
  assert.equal(looksNonHalal("Bacon strips"), true);
  assert.equal(looksNonHalal("Pork carnitas bowl"), true);
  assert.equal(looksNonHalal("Halal beef pepperoni"), false);
  assert.equal(looksNonHalal("Hamburger"), false); // "ham" only as a whole word
  assert.equal(looksNonHalal("Chicken shawarma"), false);
});

test("macros left and meals left in the day", () => {
  assert.deepEqual(macrosLeft({ kcal: 1790, pro: 204, carb: 84, fat: 71 }, { kcal: 1100, p: 120, c: 60, f: 40 }), { kcal: 690, p: 84, c: 24, f: 31 });
  assert.equal(mealsLeft(9), 3);
  assert.equal(mealsLeft(13), 2);
  assert.equal(mealsLeft(20), 1);
});

test("ideas stay under the calorie budget and lead with protein", () => {
  const s = suggestMeals(foods, { kcal: 600, p: 70, c: 50, f: 20 }, { halal: true });
  assert.equal(s.mode, "normal");
  assert.equal(s.ideas.length, 3);
  for (const i of s.ideas) {
    assert.ok(i.kcal <= 600, `over budget: ${i.kcal}`);
    assert.ok(!i.portions.some((x) => x.food.id === "bacon"), "halal filter");
  }
  assert.ok(s.ideas[0].p >= 55, `best idea should cover most protein, got ${s.ideas[0].p}`);
  // Variety: different main protein source per idea
  const mains = s.ideas.map((i) => [...i.portions].sort((a, b) => b.food.p * b.q - a.food.p * a.q)[0].food.id);
  assert.equal(new Set(mains).size, mains.length);
});

test("one-meal budget is respected", () => {
  const s = suggestMeals(foods, { kcal: 1200, p: 120, c: 80, f: 40 }, { budget: 400 });
  assert.equal(s.budget, 400);
  s.ideas.forEach((i) => assert.ok(i.kcal <= 400));
});

test("over budget with protein still needed: a light high-protein option, not 'eat nothing'", () => {
  const s = suggestMeals(foods, { kcal: -150, p: 35, c: -10, f: -5 }, { halal: true });
  assert.equal(s.mode, "light");
  assert.ok(s.ideas.length > 0);
  s.ideas.forEach((i) => assert.ok(i.kcal <= 250));
  assert.ok(s.ideas[0].p >= 20);
});

test("nothing left and protein done: no suggestions", () => {
  assert.equal(suggestMeals(foods, { kcal: 50, p: 5, c: 0, f: 0 }).mode, "none");
});

test("restaurant orders: validated, macros must add up, halal enforced", () => {
  const ok = { place: "Chipotle", order: "Chicken burrito bowl", mods: ["double chicken", "no cheese", "no bacon"], halal: "unclear", kcal: 650, p: 72, c: 55, f: 16, confidence: "high" };
  const fake = { ...ok, place: "Made up", kcal: 300 }; // 72*4+55*4+16*9 = 652, not 300
  const pork = { ...ok, place: "Taco place", order: "Carnitas tacos", kcal: 650 };
  const notHalal = { ...ok, place: "X", halal: "no" };
  const stringy = { ...ok, place: "Osmow's", order: "Chicken on the rocks", halal: "certified", kcal: "700", p: "60", c: "60", f: "24" };
  const r = parseAiOrders({ orders: [ok, fake, pork, notHalal, stringy, null] }, true);
  assert.deepEqual(r.orders.map((o) => o.place), ["Chipotle", "Osmow's"]);
  assert.equal(r.dropped, 4);
  assert.equal(r.orders[1].kcal, 700);
  assert.equal(parseAiOrders({ orders: [pork, notHalal] }, false).orders.length, 2);
  assert.deepEqual(parseAiOrders("garbage"), { orders: [], dropped: 0 });
});

test("portions stay realistic: at most 350 g or 500 ml of any one food", () => {
  const big = [{ ...F("ch", "Chicken breast", 330, 62, 0, 7, 9), bq: 200, bu: "g" }, { ...F("milk", "Fairlife", 150, 26, 6, 2.5, 4), bq: 340, bu: "ml" }];
  const s = suggestMeals(big, { kcal: 1300, p: 150, c: 60, f: 40 });
  for (const i of s.ideas) for (const x of i.portions) assert.ok(x.q * x.food.bq! <= (x.food.bu === "ml" ? 500 : 350), `${x.q} × ${x.food.bq}${x.food.bu}`);
});

test("never pairs two versions of the same food, and skips unnamed foods", () => {
  assert.equal(similarFoods("Rotisserie chicken breast (USDA)", "Kirkland rotisserie chicken breast, with skin"), true);
  assert.equal(similarFoods("Chicken breast", "Chicken and lamb donair"), false);
  const list = [F("a", "Rotisserie chicken breast", 200, 30, 0, 8, 5), F("b", "Kirkland rotisserie chicken breast", 200, 30, 0, 8, 5), F("c", "Food", 100, 30, 0, 0, 9), F("r", "Rice, cooked", 205, 4, 45, 0.4, 3)];
  const s = suggestMeals(list, { kcal: 800, p: 90, c: 60, f: 30 });
  for (const i of s.ideas) {
    assert.ok(!(i.portions.some((x) => x.food.id === "a") && i.portions.some((x) => x.food.id === "b")));
    assert.ok(!i.portions.some((x) => x.food.id === "c"));
  }
});
