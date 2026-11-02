import { test } from "vitest";
import assert from "node:assert/strict";
import { dayTargets, targets, totals, CARRY_CAP, KCAL_FLOOR, addDays, weekMon } from "../src";
import { food, profile, state } from "./helpers";

test("totals scales by servings", () => {
  assert.deepEqual(totals([food(100, 10, 5, 2, 2), food(50, 1, 1, 1)]), { kcal: 250, p: 21, c: 11, f: 5 });
});

test("starting targets for the current profile", () => {
  const t = targets(state())!;
  assert.equal(t.kcal, 2090);
  assert.equal(t.pro, 195); // 2.0 g/kg of goal weight while cutting
  assert.equal(t.fat, 68);
  assert.equal(t.carb, 175);
  assert.equal(t.a, null); // no adaptive data yet
});

test("protein uses current weight when not cutting", () => {
  const t = targets(state({ profile: profile({ goal: "recomp", rate: 0 }) }))!;
  assert.equal(t.pro, Math.round((240.8 / 2.20462) * 2));
});

test("no carry-over when yesterday was on target", () => {
  const s = state({ days: { "2026-10-31": { items: [food(2000, 180, 170, 60)] } } });
  assert.equal(dayTargets(s, "2026-11-01")!.carry, 0);
});

test("small overage comes off fat first when fat was overeaten", () => {
  const s = state({ days: { "2026-10-31": { items: [food(2290, 150, 175, 90)] } } }); // 200 over, fat 22 g over
  const t = dayTargets(s, "2026-11-01")!;
  assert.equal(t.carry, 200);
  assert.equal(t.kcal, 1890);
  assert.equal(t.carryF, 19); // fat can drop to its floor (0.5 g/kg goal weight)
  assert.equal(t.pro, 195); // protein is never cut
});

test("large overage is capped and never goes below the floor", () => {
  // 1,120 kcal over: capped by the floor (2,090 - 1,600 = 490), the rest is dropped
  const s = state({ days: { "2026-10-31": { items: [food(3210, 160, 300, 120)] } } });
  const t = dayTargets(s, "2026-11-01")!;
  assert.equal(t.carry, Math.min(CARRY_CAP, 2090 - KCAL_FLOOR));
  assert.equal(t.kcal, KCAL_FLOOR);
  assert.equal(t.over, 1120);
});

test("carry-over can be switched off", () => {
  const s = state({ profile: profile({ carry: false }), days: { "2026-10-31": { items: [food(3500)] } } });
  assert.equal(dayTargets(s, "2026-11-01")!.carry, 0);
});

test("days under 800 kcal count as not logged", () => {
  const s = state({ days: { "2026-10-31": { items: [food(600)] } } });
  assert.equal(dayTargets(s, "2026-11-01")!.carry, 0);
});

test("chained days compare against the previous day's adjusted target", () => {
  // Oct 29 +310 → Oct 30 target 1,780; eating 2,900 that day is 1,120 over → Oct 31 floor
  const s = state({ days: {
    "2026-10-29": { items: [food(2400, 150, 230, 95)] },
    "2026-10-30": { items: [food(2900, 160, 300, 120)] },
  } });
  assert.equal(dayTargets(s, "2026-10-30")!.kcal, 1780);
  assert.equal(dayTargets(s, "2026-10-31")!.kcal, KCAL_FLOOR);
});

test("date helpers", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
  assert.equal(weekMon("2026-11-01"), "2026-10-26"); // Sunday belongs to the week starting Monday Oct 26
  assert.equal(weekMon("2026-11-02"), "2026-11-02");
});
