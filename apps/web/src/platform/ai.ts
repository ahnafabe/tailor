import { AiLabelSchema, AiSleepSchema, describeFoodPrompt, findBrands, parseAiFoodItems, photoFoodPrompt, type AiFoodItem, type EstimateContext } from "@tailor/core";
import type { ClaudeSample } from "./runtime";

/** AI features the app needs. Today: Claude inside the artifact. Later: an ApiAiClient calling our Express server,
 *  which holds the Anthropic API key. Every response is validated with zod in @tailor/core before use. */
export interface AiClient {
  readonly available: boolean;
  readonly images: boolean;
  estimateFood(description: string, ctx?: EstimateContext): Promise<{ items: AiFoodItem[]; dropped: number }>;
  estimateMeal(photo: Blob, context: string, ctx?: EstimateContext): Promise<{ items: AiFoodItem[]; dropped: number }>;
  readLabel(photo: Blob): Promise<ReturnType<typeof AiLabelSchema.parse> | null>;
  readSleep(photos: Blob[]): Promise<ReturnType<typeof AiSleepSchema.parse> | null>;
}


export class ClaudeSampleClient implements AiClient {
  private sample: ClaudeSample | null = null;
  available = false;
  images = false;

  async init(): Promise<void> {
    try {
      this.sample = ((await window.claude?.use("sample")) as ClaudeSample | null) ?? null;
      this.available = !!this.sample;
      if (this.sample) this.images = !!(await this.sample.limits().catch(() => null))?.images;
    } catch { this.available = false; }
  }

  private need(): ClaudeSample {
    if (!this.sample) throw new Error("Claude isn't available in this view");
    return this.sample;
  }

  /** Brand-aware: "Starbucks spinach feta wrap" asks for Starbucks' published numbers (see core describeFoodPrompt). */
  async estimateFood(description: string, ctx: EstimateContext = {}) {
    const brands = ctx.brands ?? findBrands(description);
    const raw = await this.need().json(describeFoodPrompt(description, { ...ctx, brands }), { modelTier: brands.length ? "default" : "quick" });
    return parseAiFoodItems(raw);
  }

  async estimateMeal(photo: Blob, context: string, ctx: EstimateContext = {}) {
    const raw = await this.need().json(photoFoodPrompt(context.trim(), { ...ctx, brands: ctx.brands ?? findBrands(context) }), { images: [photo], modelTier: "default" });
    return parseAiFoodItems(raw);
  }

  async readLabel(photo: Blob) {
    const raw = await this.need().json(
      'This is a Nutrition Facts table (may be Canadian bilingual). Read it exactly. Return ONLY JSON {"name":string,"serving":string,"kcal":number,"p":number,"c":number,"f":number} per serving.',
      { images: [photo], modelTier: "default" });
    const r = AiLabelSchema.safeParse(raw);
    return r.success ? r.data : null;
  }

  async readSleep(photos: Blob[]) {
    const raw = await this.need().json(
      'These are RingConn app screenshots. Read values exactly. Return ONLY JSON {"sleepH":number|null,"sleepScore":number|null,"rhr":number|null,"hrv":number|null}.',
      { images: photos.slice(0, 4), modelTier: "default" });
    const r = AiSleepSchema.safeParse(raw);
    return r.success ? r.data : null;
  }
}

/** Test double: returns canned responses through the same validation path. */
export class FakeAiClient implements AiClient {
  available = true; images = true;
  constructor(private foodResponse: unknown = { items: [] }) {}
  async estimateFood() { return parseAiFoodItems(this.foodResponse); }
  async estimateMeal() { return parseAiFoodItems(this.foodResponse); }
  async readLabel() { return null; }
  async readSleep() { return null; }
}
