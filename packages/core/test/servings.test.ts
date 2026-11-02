import { test } from "vitest";
import assert from "node:assert/strict";
import { amountLabel, baseOf, parseBase, servingsFor } from "../src";

test("parses grams or ml out of a serving description", () => {
  assert.deepEqual(parseBase("1 cup (158 g)"), { bq: 158, bu: "g" });
  assert.deepEqual(parseBase("1 bottle (325 ml)"), { bq: 325, bu: "ml" });
  assert.equal(parseBase("1 medium"), null);
});

test("prefers stored base, then AI grams, then the serving text", () => {
  assert.deepEqual(baseOf({ bq: 118, bu: "g", serving: "1 medium" }), { bq: 118, bu: "g" });
  assert.deepEqual(baseOf({ grams: 150, serving: "about 150 g" }), { bq: 150, bu: "g" });
  assert.deepEqual(baseOf({ serving: "100 g" }), { bq: 100, bu: "g" });
});

test("converts amounts to servings", () => {
  const chicken = { bq: 100, bu: "g" as const };
  assert.equal(servingsFor(250, "g", chicken), 2.5);
  assert.ok(Math.abs(servingsFor(8, "oz", chicken)! - 2.268) < 0.001); // 8 oz = 226.8 g
  assert.ok(Math.abs(servingsFor(500, "ml", { bq: 325, bu: "ml" })! - 1.538) < 0.001);
  assert.equal(servingsFor(1.5, "srv", null), 1.5);
});

test("refuses mass units for liquids and units with no known base", () => {
  assert.equal(servingsFor(100, "g", { bq: 325, bu: "ml" }), null);
  assert.equal(servingsFor(90, "g", null), null);
});

test("labels logged amounts", () => {
  assert.equal(amountLabel({ unit: "g", amt: 250, q: 2.5 }), "250 g");
  assert.equal(amountLabel({ unit: "srv", amt: 1.5, q: 1.5, serving: "1 cup (158 g)" }), "1.5 × 1 cup (158 g)");
  assert.equal(amountLabel({ q: 1, serving: "1 medium" }), "1 medium");
});
