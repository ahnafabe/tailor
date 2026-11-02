import type { Profile } from "@tailor/core";

/** Starting profile until onboarding exists. Saved settings override every field. */
export const DEFAULT_PROFILE: Profile = {
  sex: "m", age: 25, heightCm: 177.8, weightKg: 240.8 / 2.20462, act: 1.45, run: 80,
  days: 4, goal: "cut", rate: -1, goalKg: 215 / 2.20462, blockStart: "2026-10-26",
  units: "lb", daysWhich: "Mon Tue Fri Sat", stepGoal: 9000, goalDate: "2026-12-15", view: "eaten",
};

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
export type Meal = (typeof MEALS)[number];
