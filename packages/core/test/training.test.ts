import { test } from "vitest";
import assert from "node:assert/strict";
import { blockInfo, decideProgression, liftSeries, planFor, stalled, parseAiFoodItems } from "../src";
import type { Program, Workout } from "../src";
import { profile, state } from "./helpers";

const prog: Program = {
  SESS: { UA: { n: "Upper A", ex: ["press", "row", "fly", "curl"] }, ARM: { n: "Arms", ex: ["curl", "ropecurl"] } },
  EXS: {
    press: { n: "Press", s: 3, lo: 6, hi: 10, inc: 2, lr: 1 },
    row: { n: "Row", s: 3, lo: 8, hi: 12, inc: 2.5 },
    fly: { n: "Pec deck", s: 3, lo: 10, hi: 15, inc: 2.5 },
    cablefly: { n: "Cable fly", s: 2, lo: 12, hi: 15, inc: 2.5 },
    curl: { n: "Hammer curl", s: 2, lo: 10, hi: 12, inc: 1 },
    ropecurl: { n: "Rope curl", s: 3, lo: 10, hi: 12, inc: 2.5 },
    machine: { n: "Machine press", s: 3, lo: 8, hi: 12, inc: 5 },
  },
  ACC_ROT: { fly: "cablefly", curl: "ropecurl" },
};

test("blocks: 4 build weeks then a deload, ramp in weeks 3–4", () => {
  const p = profile({ blockStart: "2026-10-26" });
  assert.deepEqual(blockInfo(p, "2026-11-01"), { num: 1, week: 1, deload: false, ramp: false });
  assert.equal(blockInfo(p, "2026-11-12").week, 3);
  assert.equal(blockInfo(p, "2026-11-12").ramp, true);
  assert.equal(blockInfo(p, "2026-11-25").deload, true);
  assert.deepEqual(blockInfo(p, "2026-11-30"), { num: 2, week: 1, deload: false, ramp: false });
});

test("plan: base week uses default sets", () => {
  const s = state({ profile: profile({ blockStart: "2026-10-26" }) });
  assert.deepEqual(planFor(s, prog, "UA", "2026-11-02").map((x) => x.sets), [3, 3, 3, 2]);
});

test("plan: ramp week adds a set to the first two lifts", () => {
  const s = state({ profile: profile({ blockStart: "2026-10-26" }) });
  assert.deepEqual(planFor(s, prog, "UA", "2026-11-12").map((x) => x.sets), [4, 4, 3, 2]);
});

test("plan: deload halves sets (rounded up)", () => {
  const s = state({ profile: profile({ blockStart: "2026-10-26" }) });
  assert.deepEqual(planFor(s, prog, "UA", "2026-11-25").map((x) => x.sets), [2, 2, 2, 1]);
});

test("plan: even blocks rotate accessories, unless already in the session", () => {
  const s = state({ profile: profile({ blockStart: "2026-10-26" }) });
  const ua = planFor(s, prog, "UA", "2026-12-01").map((x) => x.ex); // block 2
  assert.deepEqual(ua, ["press", "row", "cablefly", "ropecurl"]);
  const arm = planFor(s, prog, "ARM", "2026-12-01").map((x) => x.ex);
  assert.deepEqual(arm, ["curl", "ropecurl"]); // rope curl already present, so curl stays
});

test("plan: user swaps win over rotation", () => {
  const s = state({ profile: profile({ blockStart: "2026-10-26", swaps: { press: "machine" } }) });
  const p = planFor(s, prog, "UA", "2026-11-02")[0];
  assert.equal(p.ex, "machine");
  assert.equal(p.swapped, true);
});

const wo = (k: string, w: number, r: number): [string, Workout] => [k, { session: "UA", done: true, sets: { row: [{ w, r, ok: true }] } }];

test("stall: 3 sessions without beating the 4th-last", () => {
  const wos = Object.fromEntries([wo("2026-10-01", 60, 10), wo("2026-10-08", 60, 10), wo("2026-10-15", 60, 9), wo("2026-10-22", 60, 10)]);
  assert.equal(liftSeries(wos, "row").length, 4);
  assert.equal(stalled(wos, "row"), true);
  wos["2026-10-29"] = wo("2026-10-29", 62.5, 10)[1];
  assert.equal(stalled(wos, "row"), false);
});

test("stall: a stalled lift doesn't get the ramp set", () => {
  const wos = Object.fromEntries([wo("2026-10-01", 60, 10), wo("2026-10-08", 60, 10), wo("2026-10-15", 60, 10), wo("2026-10-22", 60, 10)]);
  const s = state({ profile: profile({ blockStart: "2026-10-26" }), wos });
  assert.deepEqual(planFor(s, prog, "UA", "2026-11-12").map((x) => x.sets), [4, 3, 3, 2]);
});

const base = { baseSets: 3, lo: 8, hi: 12, incKg: 2.5, deload: false, wristSensitive: false };
const sets = (w: number, ...r: number[]) => r.map((x) => ({ w, r: x, ok: true }));

test("progression: first time", () => {
  assert.equal(decideProgression({ ...base, last: null }).kind, "first");
});
test("progression: all sets at the top → add weight", () => {
  const p = decideProgression({ ...base, last: sets(50, 12, 12, 12) });
  assert.deepEqual([p.kind, p.weightKg], ["increase", 52.5]);
});
test("progression: missed the bottom → hold", () => {
  assert.equal(decideProgression({ ...base, last: sets(50, 9, 7, 6) }).kind, "missed-hold");
});
test("progression: in range → hold and beat reps", () => {
  assert.equal(decideProgression({ ...base, last: sets(50, 12, 11, 10) }).kind, "hold");
});
test("progression: short sleep blocks an increase", () => {
  assert.equal(decideProgression({ ...base, last: sets(50, 12, 12, 12), sleptH: 5.5 }).kind, "sleep-hold");
});
test("progression: wrist pain overrides everything but deload", () => {
  assert.deepEqual(decideProgression({ ...base, wristSensitive: true, wristPain: 6, last: sets(50, 12, 12, 12) }), { kind: "wrist-drop", weightKg: 45, lastReps: [12, 12, 12] });
  assert.equal(decideProgression({ ...base, wristSensitive: true, wristPain: 4, last: sets(50, 12, 12, 12) }).kind, "wrist-hold");
  assert.equal(decideProgression({ ...base, wristSensitive: false, wristPain: 8, last: sets(50, 12, 12, 12) }).kind, "increase");
});
test("progression: deload uses 90%", () => {
  const p = decideProgression({ ...base, deload: true, last: sets(50, 10, 10, 10) });
  assert.deepEqual([p.kind, p.weightKg], ["deload", 45]);
});
test("progression: bodyweight/time exercises progress by reps", () => {
  assert.equal(decideProgression({ ...base, incKg: 0, last: sets(0, 30, 30) }).kind, "reps-only");
});

test("AI food parsing keeps valid items and coerces numeric strings", () => {
  const r = parseAiFoodItems({ items: [
    { name: "Chicken", serving: "150 g", kcal: "248", p: 46.5, c: 0, f: 5.4 },
    { name: "", kcal: 100 }, // no name
    { name: "Rice", kcal: -5 }, // negative
    { name: "Pizza", kcal: 99999 }, // implausible
  ] });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kcal, 248);
  assert.equal(r.dropped, 3);
  assert.deepEqual(parseAiFoodItems("not json").items, []);
});
