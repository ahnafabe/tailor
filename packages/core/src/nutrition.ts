import { z } from "zod";
import type { FoodItem, Macros } from "./types";

/** Sum of a day's food, scaled by servings eaten. */
export const totals = (items: FoodItem[] = []): Macros =>
  items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal * i.q, p: t.p + i.p * i.q, c: t.c + i.c * i.q, f: t.f + i.f * i.q }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

/* ---------- AI output validation ----------
   Claude returns JSON, but it can be malformed: strings for numbers, missing fields, negative values.
   Everything AI-generated goes through these schemas before it reaches the UI or storage. */
const num = z.preprocess((v) => (typeof v === "string" ? parseFloat(v) : v), z.number().finite().nonnegative());

export const AiFoodItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  serving: z.string().trim().max(120).default("1 serving"),
  grams: num.nullish(),
  kcal: num.refine((v) => v <= 5000, "implausible calories"),
  p: num.default(0),
  c: num.default(0),
  f: num.default(0),
});
export type AiFoodItem = z.infer<typeof AiFoodItemSchema>;

/** Keeps the valid items from an AI response and reports how many were dropped. */
export function parseAiFoodItems(raw: unknown): { items: AiFoodItem[]; dropped: number } {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : [];
  const items: AiFoodItem[] = [];
  for (const it of list) {
    const r = AiFoodItemSchema.safeParse(it);
    if (r.success) items.push(r.data);
  }
  return { items, dropped: list.length - items.length };
}

export const AiLabelSchema = z.object({
  name: z.string().max(200).default(""),
  serving: z.string().max(120).default("1 serving"),
  kcal: num,
  p: num.default(0),
  c: num.default(0),
  f: num.default(0),
});

export const AiSleepSchema = z.object({
  sleepH: num.refine((v) => v <= 24).nullish(),
  sleepScore: num.refine((v) => v <= 100).nullish(),
  rhr: num.refine((v) => v <= 250).nullish(),
  hrv: num.refine((v) => v <= 400).nullish(),
});
