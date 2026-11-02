/** Serving-size conversion. Nutrition is stored per serving; the eaten amount is amt + unit,
 *  and q (servings multiplier) is derived from it using how many g/ml one serving is (bq/bu). */

export type UnitId = "srv" | "g" | "oz" | "ml" | "cup" | "tbsp";
export const UNITS: Record<UnitId, { lab: string; base?: "g" | "ml"; f?: number }> = {
  srv: { lab: "servings" },
  g: { lab: "g", base: "g", f: 1 },
  oz: { lab: "oz", base: "g", f: 28.3495 },
  ml: { lab: "ml", base: "ml", f: 1 },
  cup: { lab: "cups", base: "ml", f: 236.6 },
  tbsp: { lab: "tbsp", base: "ml", f: 14.79 },
};

export interface ServingBase { bq: number; bu: "g" | "ml" }

/** Reads "1 cup (158 g)" or "250 ml" → { bq: 158, bu: "g" }. */
export function parseBase(serving: string | undefined | null): ServingBase | null {
  const m = String(serving || "").match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  return m ? { bq: +m[1], bu: m[2].toLowerCase() as "g" | "ml" } : null;
}

export function baseOf(f: { bq?: number | null; bu?: string | null; grams?: number | null; serving?: string }): ServingBase | null {
  if (f.bq && (f.bu === "g" || f.bu === "ml")) return { bq: f.bq, bu: f.bu };
  if (f.grams) return { bq: +f.grams, bu: "g" };
  return parseBase(f.serving);
}

/** Servings eaten for an amount in a unit, or null if the unit can't be converted for this food. */
export function servingsFor(amt: number, unit: UnitId, base: ServingBase | null): number | null {
  if (unit === "srv") return amt;
  const u = UNITS[unit];
  if (!base || base.bu !== u.base || !base.bq) return null;
  return (amt * (u.f as number)) / base.bq;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Human label for a logged amount: "250 g", "1.5 × 1 cup (158 g)", "1 medium". */
export function amountLabel(x: { unit?: string; amt?: number; q: number; serving?: string }): string {
  const u = (x.unit || "srv") as UnitId, a = x.amt ?? x.q;
  if (u === "srv") return a === 1 ? x.serving || "1 serving" : r1(a) + " × " + (x.serving || "serving");
  return r1(a) + " " + UNITS[u].lab;
}
