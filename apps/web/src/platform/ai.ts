import { AiLabelSchema, AiSleepSchema, parseAiFoodItems, type AiFoodItem } from "@tailor/core";
import type { ClaudeSample } from "./runtime";

/** AI features the app needs. Today: Claude inside the artifact. Later: an ApiAiClient calling our Express server,
 *  which holds the Anthropic API key. Every response is validated with zod in @tailor/core before use. */
export interface AiClient {
  readonly available: boolean;
  readonly images: boolean;
  estimateFood(description: string): Promise<{ items: AiFoodItem[]; dropped: number }>;
  estimateMeal(photo: Blob, context: string): Promise<{ items: AiFoodItem[]; dropped: number }>;
  readLabel(photo: Blob): Promise<ReturnType<typeof AiLabelSchema.parse> | null>;
  readSleep(photos: Blob[]): Promise<ReturnType<typeof AiSleepSchema.parse> | null>;
}

const FOOD_JSON = '{"items":[{"name":string,"serving":string,"grams":number,"kcal":number,"p":number,"c":number,"f":number}]}';

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

  async estimateFood(description: string) {
    const raw = await this.need().json(
      `You are a nutrition database using USDA and Canadian Nutrient File values. Estimate nutrition for what this person ate: "${description.replace(/"/g, "'")}". If no amount is given, assume a typical single portion. Return ONLY JSON: ${FOOD_JSON} with one item per distinct food and values for the whole amount.`,
      { modelTier: "quick" });
    return parseAiFoodItems(raw);
  }

  async estimateMeal(photo: Blob, context: string) {
    const ctx = context.trim() ? ` The person who ate it adds this context, which overrides what the photo suggests: "${context.replace(/"/g, "'")}".` : "";
    const raw = await this.need().json(
      `Estimate the nutrition of the food in this photo using USDA/Canadian Nutrient File values. Estimate portions from visual cues.${ctx} Return ONLY JSON ${FOOD_JSON} with values for the amount actually eaten.`,
      { images: [photo], modelTier: "default" });
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
