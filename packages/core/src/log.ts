import type { DateKey, DayLog, FoodItem } from "./types";
import { totals } from "./nutrition";

/** Below this many logged calories a day is treated as "not logged". */
export const MIN_LOGGED_KCAL = 800;

/** The user said they didn't log everything they ate this day. */
export const isPartial = (d: DayLog | undefined): boolean => !!d?.partial;

/**
 * Whether a day's food log can be trusted as a full day's intake.
 * Partial days are left out of averages (observed burn, recap, streaks, comparisons),
 * because a half-logged day looks like a big deficit that never happened.
 */
export function countsAsLogged(d: DayLog | undefined): boolean {
  if (!d || !d.items || !d.items.length || isPartial(d)) return false;
  return totals(d.items).kcal > MIN_LOGGED_KCAL;
}

/** A food the user has eaten before, rebuilt from their history so it can be logged again in one tap. */
export interface CatalogFood {
  id: string; // saved food id, or "h:" + name key for foods only seen in history
  name: string;
  serving: string;
  kcal: number; // per serving
  p: number;
  c: number;
  f: number;
  bq?: number | null;
  bu?: string | null;
  barcode?: string | null;
  est?: boolean;
  count: number; // times logged
  lastUsed: DateKey | null; // last day it was logged
  last?: { q: number; amt?: number; unit?: string }; // the amount eaten last time
  saved: boolean; // true when it is a stored food (editable/deletable record)
}

interface SavedLike {
  id: string; name: string; serving?: string; kcal: number; p: number; c: number; f: number;
  bq?: number | null; bu?: string | null; barcode?: string | null; est?: boolean; hidden?: boolean; used?: number;
}

/** Same food = same name, ignoring case, spacing and an "(est.)" style suffix. */
export const foodKey = (name: string): string =>
  String(name || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9%]+/g, " ").trim();

/**
 * Builds the food catalogue: every saved food plus every food ever logged, one entry per food.
 * Nutrition comes from the saved record if there is one (the user may have corrected it),
 * otherwise from the most recent time it was logged. Hidden saved foods are left out,
 * along with any history entries of the same name.
 */
export function foodCatalog(foods: Record<string, SavedLike>, days: Record<DateKey, DayLog>): CatalogFood[] {
  const out = new Map<string, CatalogFood>();
  const hidden = new Set<string>();
  for (const f of Object.values(foods)) {
    const key = foodKey(f.name);
    if (!key) continue;
    if (f.hidden) { hidden.add(key); continue; }
    out.set(key, {
      id: f.id, name: f.name, serving: f.serving || "1 serving", kcal: +f.kcal || 0, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0,
      bq: f.bq ?? null, bu: f.bu ?? null, barcode: f.barcode ?? null, est: !!f.est, count: 0, lastUsed: null, saved: true,
    });
  }
  for (const k of Object.keys(days).sort()) {
    for (const it of days[k].items || []) {
      const key = foodKey(it.name);
      if (!key || hidden.has(key)) continue;
      let e = out.get(key);
      if (!e) {
        e = { id: "h:" + key, name: it.name, serving: "", kcal: 0, p: 0, c: 0, f: 0, count: 0, lastUsed: null, saved: false };
        out.set(key, e);
      }
      if (!e.saved) refresh(e, it); // history entries track the latest nutrition seen
      e.count++;
      e.lastUsed = k;
      e.last = { q: it.q, amt: it.amt, unit: it.unit };
    }
  }
  return [...out.values()].sort((a, b) => (b.lastUsed || "").localeCompare(a.lastUsed || "") || b.count - a.count || a.name.localeCompare(b.name));
}

function refresh(e: CatalogFood, it: FoodItem) {
  Object.assign(e, {
    name: it.name, serving: it.serving || "1 serving", kcal: +it.kcal || 0, p: +it.p || 0, c: +it.c || 0, f: +it.f || 0,
    bq: it.bq ?? null, bu: it.bu ?? null, est: !!it.est,
  });
}

/** Catalogue search: name contains every word typed, or exact barcode. Most-logged first. */
export function searchCatalog(cat: CatalogFood[], q: string): CatalogFood[] {
  const words = foodKey(q).split(" ").filter(Boolean);
  if (!words.length) return cat;
  return cat
    .filter((f) => (f.barcode && f.barcode === q.trim()) || words.every((w) => foodKey(f.name).includes(w)))
    .sort((a, b) => b.count - a.count || (b.lastUsed || "").localeCompare(a.lastUsed || ""));
}
