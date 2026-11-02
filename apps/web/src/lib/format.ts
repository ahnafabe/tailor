import { dkey } from "@tailor/core";

export const KG_LB = 2.20462;
export const today = () => dkey(new Date());
export const r1 = (x: number) => Math.round(x * 10) / 10;
export const fmtInt = (x: number) => Math.round(x).toLocaleString();

export const weightUnit = (units?: unknown) => (units === "kg" ? "kg" : "lb");
export const toDisplayWeight = (kg: number | null | undefined, units?: unknown) =>
  kg == null ? null : r1(units === "kg" ? kg : kg * KG_LB);
