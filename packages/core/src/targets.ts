import { prevKey } from "./dates";
import { adaptive, currentWeight, formulaTdee, KCAL_PER_KG, type Adaptive } from "./energy";
import { totals } from "./nutrition";
import { MIN_LOGGED_KCAL } from "./log";
import type { AppState, DateKey } from "./types";

export interface Targets {
  kcal: number; pro: number; fat: number; carb: number;
  tdee: number; f: number; a: Adaptive | null; wgt: number; delta: number; fatMin: number;
}
export interface DayTargets extends Targets { carry: number; carryC: number; carryF: number; over?: number }

/** Base daily targets. Blends the formula with observed burn as logged days accumulate (up to 85%). */
export function targets(s: AppState): Targets | null {
  const f = formulaTdee(s), a = adaptive(s), w = currentWeight(s);
  if (!f || !w) return null;
  let tdee = f, wgt = 0;
  if (a) {
    wgt = Math.min(0.85, Math.max(0, (a.n - 7) / 21));
    tdee = Math.round(f * (1 - wgt) + a.tdee * wgt);
  }
  const p = s.profile, rate = +p.rate || 0;
  const delta = Math.round(((rate / 100) * w * KCAL_PER_KG) / 7);
  const kcal = Math.round((tdee + delta) / 10) * 10;
  // Protein and fat scale off goal weight when cutting, which avoids inflated numbers at higher body fat.
  const base = p.goal === "cut" && p.goalKg && p.goalKg < w ? p.goalKg : w;
  const pro = Math.round(base * 2.0), fat = Math.round(base * 0.7);
  const carb = Math.max(0, Math.round((kcal - pro * 4 - fat * 9) / 4));
  return { kcal, pro, fat, carb, tdee, f, a, wgt, delta, fatMin: Math.round(base * 0.5) };
}

/** Product safety rules for carry-over. */
export const CARRY_CAP = 500; // max kcal taken off any one day
export const KCAL_FLOOR = 1600; // never set a day below this

/**
 * Targets for a specific day, with yesterday's overage carried over.
 * Overage comes off fat first (if fat was overeaten), then carbs. Protein is never reduced.
 * Anything beyond the cap is dropped rather than stacked onto later days.
 */
export function dayTargets(s: AppState, k: DateKey, depth = 3): DayTargets | null {
  const base = targets(s);
  if (!base) return null;
  const tg: DayTargets = { ...base, carry: 0, carryC: 0, carryF: 0 };
  if (s.profile.carry === false || depth <= 0) return tg;
  const pk = prevKey(k), pr = s.days[pk];
  if (!pr || !pr.items || !pr.items.length) return tg;
  const eaten = totals(pr.items);
  // A partial day still carries over: what was logged is a minimum, so an overage is real.
  if (eaten.kcal < MIN_LOGGED_KCAL) return tg;
  const pt = dayTargets(s, pk, depth - 1)!;
  const over = Math.round(eaten.kcal - pt.kcal);
  if (over <= 0) return tg;
  let red = Math.min(over, CARRY_CAP, Math.max(0, base.kcal - KCAL_FLOOR));
  if (red <= 0) return tg;
  const fatRoom = Math.max(0, base.fat - base.fatMin) * 9;
  const overF = Math.max(0, eaten.f - pt.fat) * 9;
  let fatRed = Math.min(overF, red, fatRoom), carbRed = red - fatRed;
  if (carbRed / 4 > base.carb) {
    carbRed = base.carb * 4;
    fatRed = Math.min(red - carbRed, fatRoom);
    red = carbRed + fatRed;
  }
  tg.carryC = Math.round(carbRed / 4);
  tg.carryF = Math.round(fatRed / 9);
  tg.carb = base.carb - tg.carryC;
  tg.fat = base.fat - tg.carryF;
  tg.carry = Math.round(red);
  tg.kcal = base.kcal - tg.carry;
  tg.over = over;
  return tg;
}
