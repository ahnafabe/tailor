import type { AppState, FoodItem, Profile } from "../src";

/** Ahnaf's starting profile: 25 M, 5'10", 240.8 lb, cutting 1%/week toward 215 lb. */
export const profile = (over: Partial<Profile> = {}): Profile => ({
  sex: "m", age: 25, heightCm: 177.8, weightKg: 240.8 / 2.20462, act: 1.45, run: 80, days: 4,
  goal: "cut", rate: -1, goalKg: 215 / 2.20462, ...over,
});

export const food = (kcal: number, p = 0, c = 0, f = 0, q = 1): FoodItem => ({ name: "x", kcal, p, c, f, q });

export const state = (over: Partial<AppState> = {}): AppState => ({ profile: profile(), days: {}, wos: {}, ...over });
