import { addDays } from "./dates";
import { totals } from "./nutrition";
import type { AppState, DateKey, DayLog } from "./types";

export const KCAL_PER_KG = 7700;
const TREND_ALPHA = 0.1;

export interface TrendPoint { k: DateKey; w: number; t: number }

/** Exponentially smoothed weight trend, so daily water swings don't move the numbers. */
export function trendSeries(days: Record<DateKey, DayLog>): TrendPoint[] {
  const ks = Object.keys(days).filter((k) => days[k]?.weightKg).sort();
  let t: number | null = null;
  return ks.map((k) => {
    const w = days[k].weightKg as number;
    t = t == null ? w : t + TREND_ALPHA * (w - t);
    return { k, w, t };
  });
}

export function currentWeight(s: Pick<AppState, "days" | "profile">): number | null {
  const tr = trendSeries(s.days);
  return tr.length ? tr[tr.length - 1].t : s.profile.weightKg ?? null;
}

/** Starting estimate: Mifflin–St Jeor x activity, plus lifting and running. */
export function formulaTdee(s: Pick<AppState, "days" | "profile">): number | null {
  const p = s.profile, w = currentWeight(s);
  if (!w || !p.heightCm || !p.age) return null;
  const bmr = 10 * w + 6.25 * p.heightCm - 5 * p.age + (p.sex === "m" ? 5 : -161);
  const lift = (+p.days * 250) / 7;
  return Math.round(bmr * +p.act + lift + (+(p.run ?? 0) || 0) * (w / 70));
}

export interface Adaptive { tdee: number; n: number; slope: number }

const dayDiff = (a: DateKey, b: DateKey) => Math.round((new Date(b + "T12:00").getTime() - new Date(a + "T12:00").getTime()) / 864e5);

/**
 * Observed burn: average intake corrected for how fast trend weight is moving.
 * Needs 10+ logged days and weigh-ins spanning 10+ days within the last 4 weeks.
 * (Day stepping uses local date keys; the original page parsed keys as UTC midnight,
 * which shifted the intake window by a day west of Greenwich.)
 */
export function adaptive(s: Pick<AppState, "days">): Adaptive | null {
  const tr = trendSeries(s.days);
  if (tr.length < 2) return null;
  const end = tr[tr.length - 1].k, start = addDays(end, -27);
  const win = tr.filter((x) => x.k >= start);
  if (win.length < 2) return null;
  const span = dayDiff(win[0].k, win[win.length - 1].k);
  if (span < 10) return null;
  const slope = (win[win.length - 1].t - win[0].t) / span;
  const intake: number[] = [];
  for (let k = win[0].k; k <= end; k = addDays(k, 1)) {
    const r = s.days[k];
    if (r) {
      const kc = totals(r.items).kcal;
      if (kc > 800) intake.push(kc);
    }
  }
  if (intake.length < 10) return null;
  const avg = intake.reduce((a, b) => a + b, 0) / intake.length;
  return { tdee: Math.round(avg - slope * KCAL_PER_KG), n: intake.length, slope };
}
