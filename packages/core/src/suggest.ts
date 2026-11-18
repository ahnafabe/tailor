import { z } from "zod";
import type { Macros } from "./types";
import { foodKey } from "./log";

/* ---------- Halal ----------
   The user eats halal. Foods they logged themselves are trusted; anything the app proposes
   (staples, combos, restaurant orders) is screened. A name that says "halal" always passes. */
const NON_HALAL = /\b(pork|bacon|ham|prosciutto|pancetta|pepperoni|salami|chorizo|carnitas|lard|gelatine?|wine|beer|rum|bourbon|whiskey|liqueur)\b/;
export const looksNonHalal = (name: string): boolean => {
  const n = String(name || "").toLowerCase();
  return !/\bhalal\b/.test(n) && NON_HALAL.test(n);
};

/** What's left of today's targets (negative when over). */
export function macrosLeft(tg: { kcal: number; pro: number; carb: number; fat: number }, eaten: Macros): Macros {
  return { kcal: Math.round(tg.kcal - eaten.kcal), p: Math.round(tg.pro - eaten.p), c: Math.round(tg.carb - eaten.c), f: Math.round(tg.fat - eaten.f) };
}

/** Meals still to come today, so "one meal" gets a fair share of what's left. */
export const mealsLeft = (hour: number): number => (hour < 11 ? 3 : hour < 16 ? 2 : 1);

export interface SuggestFood {
  id: string; name: string; serving?: string; kcal: number; p: number; c: number; f: number;
  count?: number; staple?: boolean; bq?: number | null; bu?: string | null;
}
export interface Portion { food: SuggestFood; q: number }
export interface MealIdea { portions: Portion[]; kcal: number; p: number; c: number; f: number; score: number }
export interface Suggestions {
  /** normal: fits what's left. light: little or nothing left, so a small high-protein option instead of "eat nothing". none: nothing sensible to add. */
  mode: "normal" | "light" | "none";
  budget: number; protein: number;
  ideas: MealIdea[];
}

const PORTIONS = [0.5, 1, 1.5, 2, 3];
const MAX_FOODS = 30;
export const LIGHT_KCAL = 250;
/** Two names for basically the same food ("Rotisserie chicken breast" vs "Kirkland rotisserie chicken breast"). */
const words = (n: string) => new Set(foodKey(n).split(" ").filter((w) => w.length >= 4));
export const similarFoods = (a: string, b: string): boolean => { const A = words(a); let n = 0; words(b).forEach((w) => { if (A.has(w)) n++; }); return n >= 2; };
const GENERIC = new Set(["", "food", "item", "meal", "snack"]);
/** Largest single portion of one food the app will propose. */
const MAX_G = 350, MAX_ML = 500;
const fits = (food: SuggestFood, q: number) => !food.bq || !food.bu || q * food.bq <= (food.bu === "ml" ? MAX_ML : MAX_G);

/**
 * Suggests up to `n` meals built from foods the user already eats (1–3 foods, common portions).
 * Ranking: hit the protein still needed, use most of the calorie budget without going over,
 * don't blow past the fat and carbs left, prefer fewer items and familiar foods.
 * Pure and deterministic, so it's unit tested and cheap enough to run on every render.
 */
export function suggestMeals(foods: SuggestFood[], left: Macros, opts: { budget?: number; halal?: boolean; n?: number } = {}): Suggestions {
  const n = opts.n ?? 3;
  let budget = Math.min(opts.budget ?? left.kcal, left.kcal);
  let mode: Suggestions["mode"] = "normal";
  const share = left.kcal > 0 ? Math.min(1, budget / left.kcal) : 1;
  let P = Math.max(0, left.p) * share, C = Math.max(0, left.c) * share, F = Math.max(0, left.f) * share;
  if (budget < 200) {
    if (left.p < 15) return { mode: "none", budget: Math.max(0, budget), protein: Math.max(0, left.p), ideas: [] };
    mode = "light"; budget = LIGHT_KCAL; P = Math.min(left.p, 40); C = 15; F = 8;
  }

  // Candidate foods: familiar first, one per name, halal-screened, at least half a serving must fit.
  const seen = new Set<string>();
  const cands = foods
    .filter((f) => f.kcal > 0 && !GENERIC.has(foodKey(f.name)) && f.kcal * 0.5 <= budget && !(opts.halal && looksNonHalal(f.name)))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || Number(!!a.staple) - Number(!!b.staple))
    .filter((f) => { const k = foodKey(f.name); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, MAX_FOODS);
  const items: Portion[] = [];
  for (const food of cands) for (const q of PORTIONS) if (food.kcal * q <= budget && fits(food, q)) items.push({ food, q });

  const score = (ps: Portion[]): MealIdea | null => {
    const m = ps.reduce((t, x) => ({ kcal: t.kcal + x.food.kcal * x.q, p: t.p + x.food.p * x.q, c: t.c + x.food.c * x.q, f: t.f + x.food.f * x.q }), { kcal: 0, p: 0, c: 0, f: 0 });
    if (m.kcal > budget) return null;
    const pf = P <= 5 ? 1 : Math.min(m.p / P, 1);
    const fill = m.kcal / budget;
    const fatOver = Math.max(0, m.f - F * 1.15) / Math.max(F, 10);
    const carbOver = Math.max(0, m.c - C * 1.15) / Math.max(C, 20);
    const familiar = ps.reduce((t, x) => t + Math.log1p(x.food.count || 0), 0) / ps.length;
    const s = 3 * pf + 1.5 * Math.min(fill, 1) - 3 * fatOver - carbOver - 0.15 * (ps.length - 1) + 0.1 * familiar;
    return { portions: ps, kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f), score: s };
  };

  // Singles and pairs exhaustively; triples by extending the best pairs (beam search keeps it fast).
  const all: MealIdea[] = [];
  const push = (x: MealIdea | null) => { if (x) all.push(x); };
  items.forEach((a) => push(score([a])));
  const pairs: MealIdea[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (items[i].food === items[j].food || similarFoods(items[i].food.name, items[j].food.name)) continue;
    const x = score([items[i], items[j]]); if (x) pairs.push(x);
  }
  all.push(...pairs);
  pairs.sort((a, b) => b.score - a.score).slice(0, 60).forEach((pr) => {
    for (const it of items) if (!pr.portions.some((x) => x.food === it.food || similarFoods(x.food.name, it.food.name))) push(score([...pr.portions, it]));
  });

  // Variety: each idea is led by a different main food (its biggest protein source)
  // and no two ideas use the same set of foods in different amounts.
  all.sort((a, b) => b.score - a.score);
  const ideas: MealIdea[] = [], mains = new Set<string>(), sets = new Set<string>();
  for (const x of all) {
    const main = [...x.portions].sort((a, b) => b.food.p * b.q - a.food.p * a.q)[0].food.id;
    const set = x.portions.map((p) => p.food.id).sort().join("+");
    if (mains.has(main) || sets.has(set)) continue;
    mains.add(main); sets.add(set); ideas.push(x);
    if (ideas.length >= n) break;
  }
  return { mode, budget: Math.round(budget), protein: Math.round(P), ideas };
}

/* ---------- Eating out: validate Claude's restaurant orders ---------- */
const num = z.preprocess((v) => (typeof v === "string" ? parseFloat(v) : v), z.number().finite().nonnegative());
export const AiOrderSchema = z
  .object({
    place: z.string().trim().min(1).max(80),
    order: z.string().trim().min(1).max(300),
    mods: z.array(z.string().trim().max(120)).max(8).catch([]).default([]),
    halal: z.enum(["certified", "options", "unclear", "no"]).catch("unclear"),
    halalNote: z.string().trim().max(240).catch("").default(""),
    kcal: num.refine((v) => v > 0 && v <= 3000, "implausible calories"),
    p: num, c: num, f: num,
    confidence: z.enum(["high", "medium", "low"]).catch("low"),
  })
  // Calories must roughly agree with the macros (4/4/9); a mismatch means made-up numbers.
  .refine((o) => Math.abs(o.p * 4 + o.c * 4 + o.f * 9 - o.kcal) <= Math.max(60, o.kcal * 0.2), "calories don't match macros");
export type AiOrder = z.infer<typeof AiOrderSchema>;

/** Keeps valid orders; with halal on, drops anything marked not halal or with a non-halal item named in it. */
export function parseAiOrders(raw: unknown, halal = false): { orders: AiOrder[]; dropped: number } {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { orders?: unknown }).orders) ? (raw as { orders: unknown[] }).orders : [];
  const orders: AiOrder[] = [];
  for (const it of list) {
    const r = AiOrderSchema.safeParse(it);
    if (!r.success) continue;
    const text = (r.data.order + " " + r.data.mods.join(" ")).replace(/\b(no|without|hold the|remove|skip)\s+\w+/gi, ""); // "no bacon" is fine
    if (halal && (r.data.halal === "no" || looksNonHalal(text))) continue;
    orders.push(r.data);
  }
  return { orders, dropped: list.length - orders.length };
}
