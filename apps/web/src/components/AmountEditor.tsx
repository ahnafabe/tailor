import { useEffect, useId, useMemo, useState } from "react";
import { baseOf, servingsFor, UNITS, type UnitId } from "@tailor/core";
import { r1 } from "../lib/format";

export interface AmountValue { q: number; amt: number; unit: UnitId; bq: number | null; bu: "g" | "ml" | null }
interface Food { kcal: number; p: number; c: number; f: number; serving?: string; bq?: number | null; bu?: string | null; grams?: number | null; amt?: number; q?: number; unit?: string }

/** Amount + unit picker with a live macro preview. Calls onChange with null when the amount can't be converted. */
export function AmountEditor({ food, onChange }: { food: Food; onChange: (v: AmountValue | null) => void }) {
  const id = useId();
  const b0 = baseOf(food);
  const [amt, setAmt] = useState(String(food.amt ?? food.q ?? 1));
  const [unit, setUnit] = useState<UnitId>((food.unit as UnitId) || "srv");
  const [bq, setBq] = useState(b0?.bq ? String(b0.bq) : "");
  const [bu, setBu] = useState<"g" | "ml">(b0?.bu ?? "g");

  const value = useMemo<AmountValue | null>(() => {
    const base = bq ? { bq: +bq, bu } : null;
    const q = servingsFor(+amt || 0, unit, base);
    return q == null ? null : { q, amt: +amt || 0, unit, bq: base?.bq ?? null, bu: base ? bu : null };
  }, [amt, unit, bq, bu]);

  useEffect(() => onChange(value), [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const u = UNITS[unit];
  const needsBase = unit !== "srv" && (!bq || (u.base && bu !== u.base));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="grid2">
        <label htmlFor={id + "a"}>Amount eaten<input id={id + "a"} type="number" inputMode="decimal" min="0" step="any" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
        <label htmlFor={id + "u"}>Unit
          <select id={id + "u"} value={unit} onChange={(e) => { const nu = e.target.value as UnitId; setUnit(nu); const base = UNITS[nu].base; if (base && !bq) setBu(base); }}>
            {Object.entries(UNITS).map(([k, v]) => <option key={k} value={k}>{v.lab}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        {([["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2]] as const).map(([l, v]) => <button key={l} type="button" className="x" onClick={() => { setUnit("srv"); setAmt(String(v)); }}>{l} srv</button>)}
        {[50, 100, 150, 200].map((v) => <button key={v} type="button" className="x" onClick={() => { setUnit(bu === "ml" ? "ml" : "g"); setAmt(String(v)); }}>{v} {bu}</button>)}
      </div>
      {(needsBase || unit !== "srv") && (
        <div className="row" style={{ fontSize: 13, color: "var(--muted)" }}>
          1 serving ({food.serving || "serving"}) =
          <input aria-label="Grams or ml in one serving" style={{ width: 90 }} type="number" inputMode="decimal" min="0" step="any" value={bq} onChange={(e) => setBq(e.target.value)} />
          <select aria-label="Serving base unit" style={{ width: 70 }} value={bu} onChange={(e) => setBu(e.target.value as "g" | "ml")}><option value="g">g</option><option value="ml">ml</option></select>
        </div>
      )}
      <div className="num" data-testid="amount-preview" style={{ fontSize: 15, color: value ? "var(--ink)" : "var(--hold)" }}>
        {value
          ? `= ${Math.round(food.kcal * value.q)} kcal · P${r1(food.p * value.q)} C${r1(food.c * value.q)} F${r1(food.f * value.q)}${unit !== "srv" ? `  (${r1(value.q)} servings)` : ""}`
          : u.base && bq && bu !== u.base ? `This food is measured in ${bu}. Pick a ${bu}-based unit, or servings.` : `Enter how many ${u.base} one serving is to use ${u.lab}.`}
      </div>
    </div>
  );
}
