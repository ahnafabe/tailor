import { useMemo, useState } from "react";
import { amountLabel, baseOf, dayTargets, totals, type AiFoodItem, type FoodItem } from "@tailor/core";
import { AmountEditor, type AmountValue } from "../../components/AmountEditor";
import { CarryNote, KcalLine, MacroBars } from "../../components/summary";
import { MEALS, type Meal } from "../../data/defaults";
import { STAPLES, type LibraryFood } from "../../data/staples";
import { useServices } from "../../state/AppContext";
import { useSaveDay, useSaveFood, useSnapshot } from "../../state/queries";
import { r1, today } from "../../lib/format";

type Candidate = (LibraryFood | (AiFoodItem & { est: true })) & { grams?: number | null };

export function FoodTab() {
  const { data: s } = useSnapshot();
  const { ai } = useServices();
  const saveDay = useSaveDay();
  const saveFood = useSaveFood();
  const [date, setDate] = useState(today());
  const [meal, setMeal] = useState<Meal>("Breakfast");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [estimates, setEstimates] = useState<Candidate[]>([]);
  const [amountFor, setAmountFor] = useState<Candidate | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, setPending] = useState<AmountValue | null>(null);

  const library = useMemo(() => [...Object.values(s?.foods ?? {}), ...STAPLES] as LibraryFood[], [s?.foods]);
  if (!s) return <div className="panel"><p className="sub">Loading…</p></div>;

  const day = s.days[date] ?? { items: [] };
  const items = day.items ?? [];
  const tg = dayTargets(s, date), tot = totals(items), showLeft = s.profile.view === "left";
  const matches = query.trim() ? library.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  const writeItems = (next: FoodItem[]) => saveDay.mutate({ date, day: { ...day, items: next } });

  const add = (f: Candidate, amount?: AmountValue | null) => {
    const b = baseOf(f);
    const item: FoodItem = {
      name: f.name, serving: f.serving || "1 serving", kcal: +f.kcal || 0, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0,
      q: amount?.q ?? 1, amt: amount?.amt ?? 1, unit: amount?.unit ?? "srv",
      bq: amount?.bq ?? b?.bq ?? null, bu: amount?.bu ?? b?.bu ?? null, meal, est: !!f.est,
    };
    writeItems([...items, item]);
    if ("id" in f && f.id && !("staple" in f && f.staple)) saveFood.mutate({ ...(f as LibraryFood), used: Date.now() } as never);
    setStatus(`Added ${f.name}`);
  };

  const estimate = async () => {
    if (!query.trim()) { setStatus('Type what you ate first, e.g. "2 eggs and toast".'); return; }
    if (!ai.available) { setStatus("Claude estimates aren't available in this view."); return; }
    setStatus("Estimating…");
    try {
      const r = await ai.estimateFood(query);
      setEstimates(r.items.map((i) => ({ ...i, est: true as const })));
      setStatus(r.items.length ? `Estimated by Claude${r.dropped ? ` (${r.dropped} unclear item${r.dropped > 1 ? "s" : ""} skipped)` : ""}. Check the amounts, then add.` : "No foods recognized.");
    } catch { setStatus("Couldn't get an estimate. Try again in a minute."); }
  };

  const Cand = ({ f }: { f: Candidate }) => (
    <div className="cand">
      <div>
        <div style={{ fontWeight: 600 }}>{f.name}{f.est && <span className="est"> · est.</span>}</div>
        <div className="mt">{f.serving} · {Math.round(f.kcal)} kcal · P{f.p} C{f.c} F{f.f}</div>
      </div>
      <div className="row">
        <button className="x" onClick={() => { setAmountFor(f); setPending(null); }}>Amount…</button>
        <button className="btn small" onClick={() => add(f)}>Add</button>
      </div>
    </div>
  );

  return (
    <section>
      <div className="panel">
        <div className="row between"><h3>Food log</h3><input type="date" aria-label="Log date" value={date} onChange={(e) => setDate(e.target.value || today())} style={{ maxWidth: 170 }} /></div>
        <KcalLine tot={tot} tg={tg} showLeft={showLeft} />
        <CarryNote tg={tg} />
        <MacroBars tot={tot} tg={tg} showLeft={showLeft} />
      </div>

      <div className="panel">
        <h3>Add food</h3>
        <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)" }}>
          <label>Meal<select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>Search your foods or describe a meal
            <input type="search" placeholder="e.g. 200g chicken breast and rice" value={query} onChange={(e) => { setQuery(e.target.value); setEstimates([]); }} onKeyDown={(e) => e.key === "Enter" && estimate()} />
          </label>
        </div>
        <div className="row"><button className="btn small" onClick={estimate}>Estimate with Claude</button></div>
        <div className="status" role="status">{status}</div>
        <div style={{ display: "grid", gap: 6 }} data-testid="results">
          {(estimates.length ? estimates : matches).map((f, i) => <Cand key={("id" in f && f.id) || f.name + i} f={f} />)}
        </div>
        {amountFor && (
          <div className="sheet">
            <h3>{amountFor.name}</h3>
            <AmountEditor food={amountFor} onChange={setPending} />
            <div className="row">
              <button className="btn" disabled={!pending} onClick={() => { add(amountFor, pending); setAmountFor(null); }}>Add to {meal}</button>
              <button className="btn ghost" onClick={() => setAmountFor(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel" data-testid="food-log">
        {MEALS.map((m) => {
          const rows = items.map((x, i) => [x, i] as const).filter(([x]) => (x.meal || "Snacks") === m);
          return (
            <div key={m}>
              <div className="meal-h"><span>{m}</span><span>{Math.round(totals(rows.map((r) => r[0])).kcal)} kcal</span></div>
              {!rows.length && <div className="sub" style={{ padding: "6px 0" }}>Nothing logged</div>}
              {rows.map(([x, i]) => (
                <div key={i}>
                  <div className="item">
                    <div>
                      <div className="nm">{x.name}{x.est && <span className="est"> · est.</span>}</div>
                      <div className="mt">{amountLabel(x)} · {Math.round(x.kcal * x.q)} kcal · P{r1(x.p * x.q)} C{r1(x.c * x.q)} F{r1(x.f * x.q)}</div>
                    </div>
                    <div className="row">
                      <button className="x" onClick={() => { setEditing(editing === i ? null : i); setPending(null); }}>{editing === i ? "Close" : "Edit amount"}</button>
                      <button className="x" onClick={() => { setEditing(null); writeItems(items.filter((_, j) => j !== i)); }}>Remove</button>
                    </div>
                  </div>
                  {editing === i && (
                    <div className="sheet" style={{ marginBottom: 8 }}>
                      <AmountEditor food={x} onChange={setPending} />
                      <div className="row">
                        <button className="btn small" disabled={!pending} onClick={() => { if (!pending) return; writeItems(items.map((y, j) => (j === i ? { ...y, ...pending, bq: pending.bq, bu: pending.bu } : y))); setEditing(null); }}>Save amount</button>
                        <button className="btn small ghost" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
