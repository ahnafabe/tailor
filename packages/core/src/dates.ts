import type { DateKey } from "./types";

/** Local-time date key, e.g. 2026-11-01. */
export const dkey = (d: Date): DateKey =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** Noon avoids daylight-saving edge cases when stepping whole days. */
const noon = (k: DateKey) => new Date(k + "T12:00");

export function addDays(k: DateKey, n: number): DateKey {
  const d = noon(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
}

export const prevKey = (k: DateKey): DateKey => addDays(k, -1);

/** Monday of the week containing k. */
export function weekMon(k: DateKey): DateKey {
  const d = noon(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dkey(d);
}
