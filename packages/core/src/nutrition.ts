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
  /** official = the brand's or restaurant's published nutrition; label = read off a package; estimate = everything else. */
  source: z.enum(["official", "label", "estimate"]).catch("estimate").default("estimate"),
  sourceNote: z.string().trim().max(160).catch("").default(""),
});
export type AiFoodItem = z.infer<typeof AiFoodItemSchema>;

/** Calories should roughly equal protein*4 + carbs*4 + fat*9 (published numbers round, and fibre/alcohol skew it a little). */
export const macrosAddUp = (it: { kcal: number; p: number; c: number; f: number }): boolean =>
  Math.abs(it.p * 4 + it.c * 4 + it.f * 9 - it.kcal) <= Math.max(40, it.kcal * 0.25);

/**
 * Keeps the valid items from an AI response and reports how many were dropped.
 * An item claiming to be official or from a label whose macros don't add up is downgraded to an estimate.
 */
export function parseAiFoodItems(raw: unknown): { items: AiFoodItem[]; dropped: number; downgraded: number } {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : [];
  const items: AiFoodItem[] = [];
  let downgraded = 0;
  for (const it of list) {
    const r = AiFoodItemSchema.safeParse(it);
    if (!r.success) continue;
    if (r.data.source !== "estimate" && !macrosAddUp(r.data)) { r.data.source = "estimate"; downgraded++; }
    items.push(r.data);
  }
  return { items, dropped: list.length - items.length, downgraded };
}

/* ---------- Brand-aware estimate prompts ----------
   Naming a chain or brand ("Starbucks spinach feta wrap") should get that company's published numbers,
   not a generic guess. Brands are detected here so the prompt can insist on it and the UI can show it. */
const BRANDS: Array<[string, RegExp]> = [
  ["Starbucks", /starbucks|\bsbux\b/],
  ["Tim Hortons", /tim hortons?|timmies|\btims\b/],
  ["McDonald's", /mc ?donald'?s|\bmcd'?s\b|big mac|mcchicken|mcflurry|mcmuffin/],
  ["Subway", /\bsubway\b/],
  ["Chipotle", /chipotle (mexican grill|bowl|burrito)|\b(at|from) chipotle\b|\bchipotle's\b/],
  ["A&W", /\ba ?& ?w\b|\ba and w\b/],
  ["Mary Brown's", /mary brown'?s?/],
  ["Osmow's", /osmow'?s?/],
  ["Popeyes", /popeye'?s?/],
  ["KFC", /\bkfc\b|kentucky fried/],
  ["Wendy's", /wendy'?s/],
  ["Burger King", /burger king|\bbk\b|whopper/],
  ["Taco Bell", /taco bell/],
  ["Freshii", /freshii/],
  ["Nando's", /nando'?s/],
  ["Domino's", /domino'?s/],
  ["Pizza Hut", /pizza hut/],
  ["Panago", /panago/],
  ["Little Caesars", /little caesars?/],
  ["Booster Juice", /booster juice/],
  ["Jugo Juice", /jugo juice/],
  ["Chick-fil-A", /chick-?fil-?a/],
  ["Five Guys", /five guys/],
  ["Harvey's", /harvey'?s/],
  ["Triple O's", /triple o'?s/],
  ["White Spot", /white spot/],
  ["Church's", /church'?s (texas )?chicken/],
  ["Quesada", /quesada/],
  ["Mucho Burrito", /mucho burrito/],
  ["Panda Express", /panda express/],
  ["Costco", /costco|kirkland/],
  ["Fairlife", /fairlife/],
  ["Quest", /\bquest (bar|chips|protein)/],
  ["Oikos", /oikos/],
  ["Kind", /\bkind bar/],
];

/** Brands and restaurants named in free text, in the order they appear (deduped). */
export function findBrands(text: string): string[] {
  const t = String(text || "").toLowerCase().replace(/[’‘]/g, "'");
  return BRANDS.map(([name, re]) => ({ name, at: t.search(re) })).filter((b) => b.at >= 0).sort((a, b) => a.at - b.at).map((b) => b.name);
}

export interface EstimateContext {
  brands?: string[];
  area?: string;
  /** Similar foods this person has logged before, to anchor portions and recipes. */
  similar?: Array<{ name: string; serving?: string; kcal: number; p: number; c: number; f: number }>;
}

const OUT_FORMAT =
  'Return ONLY JSON {"items":[{"name":string,"serving":string (the amount, e.g. "1 wrap (180 g)" or "Grande, 2% milk"),"grams":number,"kcal":number,"p":number,"c":number,"f":number,' +
  '"source":"official"|"label"|"estimate","sourceNote":string (e.g. "Starbucks Canada published nutrition" or "assumed cooked in 1 tbsp oil")}]} with one item per distinct food, values for the whole amount eaten, macros in grams to 1 decimal.';

function sharedRules(ctx: EstimateContext): string {
  const lines: string[] = [];
  if (ctx.brands?.length)
    lines.push(
      `They named ${ctx.brands.join(", ")}. For anything from ${ctx.brands.length > 1 ? "these brands or restaurants" : "this brand or restaurant"}, use the company's OWN published nutrition for that exact menu item or product` +
        ` (Canadian menu/product when it differs${ctx.area ? `; they are in ${ctx.area}` : ""}), not a generic estimate of a similar food. Match the exact item name; if a size or option isn't given, use the default size and say which in serving.` +
        ' Set source to "official" only when you are confident these are the company\'s published numbers; otherwise set "estimate" and say why in sourceNote.',
    );
  else lines.push('If the text names a restaurant, chain or packaged brand, use that company\'s published nutrition (source "official"); otherwise use USDA / Canadian Nutrient File values (source "estimate").');
  lines.push("For home-cooked or restaurant food without published numbers, count hidden oil, butter and sauces, lean slightly high for restaurant portions, and note key assumptions in sourceNote.");
  if (ctx.similar?.length)
    lines.push(
      "This person has logged these similar foods before; use them for typical portions and recipes when the description is vague: " +
        ctx.similar.map((s) => `${s.name} (${s.serving || "1 serving"}: ${Math.round(s.kcal)} kcal, P${s.p} C${s.c} F${s.f})`).join("; ") + ".",
    );
  return lines.join(" ");
}

/** Prompt for "Estimate with Claude" from a typed description. */
export function describeFoodPrompt(text: string, ctx: EstimateContext = {}): string {
  return `You are a nutrition database. Estimate nutrition for what this person ate: "${String(text).replace(/"/g, "'")}". If no amount is given, assume one typical portion. ${sharedRules(ctx)} ${OUT_FORMAT}`;
}

/** Prompt for a meal photo, with the person's optional notes. */
export function photoFoodPrompt(notes: string, ctx: EstimateContext = {}): string {
  return (
    "Estimate the nutrition of the food in this photo. Estimate portions from visual cues (plate size, utensils, hands, packaging). " +
    "If you can see a brand, logo, cup, wrapper or packaging, identify the product and use that company's published nutrition (source \"official\"). " +
    (notes ? `The person who ate it adds this context, which overrides what the photo suggests (portion eaten, ingredients, where it's from, cooking method): "${notes.replace(/"/g, "'")}". ` : "") +
    sharedRules(ctx) + " " + OUT_FORMAT
  );
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
