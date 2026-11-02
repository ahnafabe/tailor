/** Shared domain types. Storage shapes match the records the app already saves, so old data keeps working. */

export type DateKey = string; // "YYYY-MM-DD" in the user's local time

export interface FoodItem {
  name: string;
  serving?: string;
  kcal: number; // per serving
  p: number;
  c: number;
  f: number;
  q: number; // servings eaten
  meal?: string;
  est?: boolean;
  amt?: number;
  unit?: string;
  bq?: number | null;
  bu?: string | null;
}

export interface DayLog {
  items?: FoodItem[];
  weightKg?: number | null;
  steps?: number | null;
  sleepH?: number | null;
  [extra: string]: unknown;
}

export interface SetLog {
  w?: number | null; // kg
  r?: number | null;
  ok?: boolean;
}

export interface Workout {
  session: string | null;
  sets?: Record<string, (SetLog | null)[]>; // key: exercise id, or "id|L" / "id|R" for one-arm work
  done?: boolean;
  pain?: number | null;
  external?: boolean;
  [extra: string]: unknown;
}

export interface Profile {
  sex: "m" | "f";
  age: number;
  heightCm: number | null;
  weightKg: number | null;
  act: number; // activity multiplier
  run?: number; // extra kcal/day equivalent for running at 70 kg
  days: number; // lifting days per week
  goal: "cut" | "recomp" | "bulk";
  rate: number; // % bodyweight per week, signed
  goalKg?: number | null;
  carry?: boolean;
  blockStart?: DateKey;
  swaps?: Record<string, string>;
  [extra: string]: unknown;
}

export interface AppState {
  profile: Profile;
  days: Record<DateKey, DayLog>;
  wos: Record<DateKey, Workout>;
}

export interface Macros {
  kcal: number;
  p: number;
  c: number;
  f: number;
}
