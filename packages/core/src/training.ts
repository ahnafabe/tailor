import { weekMon } from "./dates";
import type { AppState, DateKey, Profile, SetLog, Workout } from "./types";

/* ---------- Strength history ---------- */

/** Estimated one-rep max (Epley). */
export const e1rm = (w: number, r: number) => w * (1 + r / 30);

export interface LiftPoint { k: DateKey; v: number }

/** Best estimated 1RM per session for one exercise key (e.g. "rdl" or "dbbench|L"). */
export function liftSeries(wos: Record<DateKey, Workout>, key: string): LiftPoint[] {
  const pts: LiftPoint[] = [];
  for (const k of Object.keys(wos).sort()) {
    const st = wos[k].sets?.[key];
    if (!st) continue;
    const ok = st.filter((s): s is SetLog => !!(s && s.ok && s.w && s.r));
    if (!ok.length) continue;
    pts.push({ k, v: Math.max(...ok.map((s) => e1rm(s.w as number, s.r as number))) });
  }
  return pts;
}

/** Stalled = the last 3 sessions never beat the session before them (0.5% tolerance). */
export function stalled(wos: Record<DateKey, Workout>, key: string): boolean {
  const s = liftSeries(wos, key);
  if (s.length < 4) return false;
  const ref = s[s.length - 4].v;
  return Math.max(...s.slice(-3).map((x) => x.v)) <= ref * 1.005;
}

/* ---------- Training blocks ---------- */

export const BLOCK_LEN = 5; // 4 build weeks + 1 deload
export const DEFAULT_BLOCK_START = "2026-10-26";

export interface BlockInfo { num: number; week: number; deload: boolean; ramp: boolean }

export function blockInfo(profile: Pick<Profile, "blockStart">, k: DateKey): BlockInfo {
  const start = profile.blockStart || DEFAULT_BLOCK_START;
  const w = Math.floor((new Date(weekMon(k) + "T12:00").getTime() - new Date(weekMon(start) + "T12:00").getTime()) / 6048e5);
  const ww = Math.max(0, w);
  const week = (ww % BLOCK_LEN) + 1;
  return { num: Math.floor(ww / BLOCK_LEN) + 1, week, deload: week === BLOCK_LEN, ramp: week === 3 || week === 4 };
}

/* ---------- Session plans ---------- */

export interface ExerciseDef { n: string; s: number; lo: number; hi: number; inc: number; lr?: number | boolean; xl?: number | boolean; db?: number | boolean; uni?: number | boolean }
export interface Program {
  SESS: Record<string, { n: string; ex: string[]; optional?: number | boolean }>;
  EXS: Record<string, ExerciseDef>;
  ACC_ROT: Record<string, string>;
}
export interface PlanItem { base: string; ex: string; sets: number; swapped: boolean }

/**
 * The exercises and set counts for a session on a given day, after applying:
 * the user's swaps, accessory rotation on even-numbered blocks, deload halving,
 * and the weeks 3–4 ramp (+1 set on the first two lifts unless stalled).
 */
export function planFor(s: Pick<AppState, "profile" | "wos">, prog: Program, sess: string, k: DateKey): PlanItem[] {
  const B = blockInfo(s.profile, k), sw = s.profile.swaps || {}, seen = new Set<string>();
  const list = prog.SESS[sess].ex;
  return list.map((base, i) => {
    let ex = sw[base] || base;
    if (!sw[base] && prog.ACC_ROT[base] && B.num % 2 === 0 && !list.includes(prog.ACC_ROT[base])) ex = prog.ACC_ROT[base];
    if (seen.has(ex)) ex = base;
    seen.add(ex);
    const def = prog.EXS[ex];
    let sets = def.s;
    if (B.deload) sets = Math.max(1, Math.ceil(sets / 2));
    else if (B.ramp && i < 2 && def.inc && !stalled(s.wos, ex + (def.lr ? "|R" : ""))) sets += 1;
    return { base, ex, sets, swapped: ex !== base };
  });
}

/* ---------- Progression ---------- */

export type ProgressionKind =
  | "first" | "deload" | "wrist-drop" | "wrist-hold" | "reps-only"
  | "sleep-hold" | "increase" | "missed-hold" | "hold";

export interface ProgressionInput {
  last: SetLog[] | null; // completed sets from the previous session of this exercise/side
  baseSets: number; lo: number; hi: number;
  incKg: number; // load jump (0 = bodyweight/time exercise)
  deload: boolean;
  wristSensitive: boolean; wristPain?: number | null;
  sleptH?: number | null;
}
export interface Progression { kind: ProgressionKind; weightKg: number | null; lastReps: number[] }

/**
 * Double progression with recovery guards. Order matters:
 * deload > wrist pain > rep-only exercises > short sleep > progression.
 */
export function decideProgression(x: ProgressionInput): Progression {
  if (!x.last || !x.last.length) return { kind: "first", weightKg: null, lastReps: [] };
  const last = x.last.slice(0, x.baseSets);
  const reps = last.map((s) => s.r ?? 0);
  const wkg = Math.max(...last.map((s) => s.w || 0));
  const allTop = last.length >= Math.ceil(x.baseSets / 2) && last.every((s) => (s.r ?? 0) >= x.hi);
  const miss = last.some((s) => (s.r ?? 0) < x.lo);
  if (x.deload && x.incKg) return { kind: "deload", weightKg: wkg * 0.9, lastReps: reps };
  if (x.wristSensitive && (x.wristPain ?? 0) >= 6) return { kind: "wrist-drop", weightKg: wkg * 0.9, lastReps: reps };
  if (x.wristSensitive && (x.wristPain ?? 0) >= 4) return { kind: "wrist-hold", weightKg: wkg, lastReps: reps };
  if (!x.incKg) return { kind: "reps-only", weightKg: null, lastReps: reps };
  if (allTop && x.sleptH && x.sleptH < 6) return { kind: "sleep-hold", weightKg: wkg, lastReps: reps };
  if (allTop) return { kind: "increase", weightKg: wkg + x.incKg, lastReps: reps };
  if (miss) return { kind: "missed-hold", weightKg: wkg, lastReps: reps };
  return { kind: "hold", weightKg: wkg, lastReps: reps };
}
