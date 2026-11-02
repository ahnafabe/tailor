import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptive, addDays, currentWeight, trendSeries } from "../src";
import type { DayLog } from "../src";
import { food, state } from "./helpers";

test("trend smooths a single noisy reading", () => {
  const tr = trendSeries({ "2026-11-01": { weightKg: 100 }, "2026-11-02": { weightKg: 110 } });
  assert.equal(tr[1].t, 101); // 10% of the way toward the new reading
});

test("current weight falls back to the profile with no weigh-ins", () => {
  assert.equal(currentWeight(state()), 240.8 / 2.20462);
});

test("adaptive burn needs enough data", () => {
  const days: Record<string, DayLog> = {};
  for (let i = 0; i < 5; i++) days[addDays("2026-11-01", i)] = { weightKg: 108, items: [food(2100)] };
  assert.equal(adaptive({ days }), null);
});

test("adaptive burn: stable weight means intake equals burn", () => {
  const days: Record<string, DayLog> = {};
  for (let i = 0; i < 21; i++) days[addDays("2026-11-01", i)] = { weightKg: 108, items: [food(2500)] };
  const a = adaptive({ days })!;
  assert.equal(a.tdee, 2500);
  assert.equal(a.n, 21);
});

test("adaptive burn: losing weight means burn is above intake", () => {
  const days: Record<string, DayLog> = {};
  // lose 0.1 kg/day for 21 days on 2,100 kcal
  for (let i = 0; i < 21; i++) days[addDays("2026-11-01", i)] = { weightKg: 108 - 0.1 * i, items: [food(2100)] };
  const a = adaptive({ days })!;
  // True burn is 2,100 + 0.1 kg x 7,700 = 2,870. The smoothed trend lags real loss, so early estimates
  // land low (here ~2,570). That errs conservative on a cut; documented so a future change is deliberate.
  assert.ok(a.tdee > 2100 && a.tdee < 2870, `tdee ${a.tdee}`);
  assert.ok(a.tdee > 2500, `lag larger than expected: ${a.tdee}`);
});

test("intake window uses local dates (regression: UTC parsing shifted it by a day)", () => {
  const days: Record<string, DayLog> = {};
  for (let i = 0; i < 12; i++) days[addDays("2026-11-01", i)] = { weightKg: 108, items: [food(2000)] };
  days["2026-10-31"] = { items: [food(9000)] }; // the day before the window must not be counted
  assert.equal(adaptive({ days })!.tdee, 2000);
});
