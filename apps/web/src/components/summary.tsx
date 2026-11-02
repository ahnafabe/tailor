import type { DayTargets, Macros } from "@tailor/core";
import { fmtInt } from "../lib/format";

/** iOS-style two-option switch. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, lab]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => value !== v && onChange(v)}>{lab}</button>
      ))}
    </div>
  );
}

export interface RingSpec { label: string; value: number; goal: number | null; unit: string; color: string; showLeft?: boolean }

/** Activity-style concentric rings with a legend. */
export function Rings({ rings }: { rings: RingSpec[] }) {
  return (
    <div className="ringRow">
      <svg viewBox="0 0 120 120" role="img" aria-label="Daily rings">
        {rings.map((r, i) => {
          const rad = 50 - i * 14, C = 2 * Math.PI * rad, pct = r.goal ? Math.min(1, r.value / r.goal) : 0;
          return (
            <g key={r.label}>
              <circle cx="60" cy="60" r={rad} fill="none" stroke={r.color} strokeOpacity=".2" strokeWidth="11" />
              {pct > 0 && <circle cx="60" cy="60" r={rad} fill="none" stroke={r.color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 60 60)" />}
            </g>
          );
        })}
      </svg>
      <div className="ringLeg" data-testid="ring-legend">
        {rings.map((r) => {
          const d = r.goal ? Math.round(r.goal - r.value) : 0;
          return (
            <div key={r.label}>
              <div className="k" style={{ color: r.color }}>{r.label}</div>
              {r.showLeft && r.goal
                ? <div className="v" style={d < 0 ? { color: "var(--stop)" } : undefined}>{fmtInt(Math.abs(d))}<small>{(r.unit ? " " + r.unit : "") + (d < 0 ? " over" : " left")}</small></div>
                : <div className="v">{fmtInt(r.value)}<small>{r.goal ? ` / ${fmtInt(r.goal)}${r.unit ? " " + r.unit : ""}` : ""}</small></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const leftTxt = (goal: number, v: number, u: string) => { const d = Math.round(goal - v); return d >= 0 ? `${fmtInt(d)} ${u} left` : `${fmtInt(-d)} ${u} over`; };

export function MacroBars({ tot, tg, showLeft }: { tot: Macros; tg: DayTargets | null; showLeft: boolean }) {
  const rows: [string, keyof Macros, "pro" | "carb" | "fat", string][] = [["Protein", "p", "pro", "--p"], ["Carbs", "c", "carb", "--c"], ["Fat", "f", "fat", "--f"]];
  return (
    <div className="macros" data-testid="macros">
      {rows.map(([lab, k, tk, col]) => {
        const goal = tg ? tg[tk] : null, v = Math.round(tot[k]), pct = goal ? Math.min(100, (v / goal) * 100) : 0, over = !!goal && v > goal;
        return (
          <div className="mbar" key={lab}>
            <span>{lab}</span>
            <div className="track"><div className="fill" style={{ width: pct + "%", background: `var(${col})` }} /></div>
            <span className="num" style={{ textAlign: "right", color: over && showLeft ? "var(--stop)" : undefined }}>
              {goal && showLeft ? leftTxt(goal, v, "g") : `${v}${goal ? " / " + goal : ""} g`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CarryNote({ tg }: { tg: DayTargets | null }) {
  if (!tg || tg.carry <= 0) return null;
  const dropped = (tg.over ?? 0) - tg.carry;
  return (
    <div className="carrynote" data-testid="carry-note">
      Alteration: −{tg.carry} kcal today from yesterday's overage (−{tg.carryC} g carbs{tg.carryF ? `, −${tg.carryF} g fat` : ""})
      {dropped > 0 ? `. The rest (${dropped} kcal) was dropped to keep today realistic.` : "."}
    </div>
  );
}

export function KcalLine({ tot, tg, showLeft }: { tot: Macros; tg: DayTargets | null; showLeft: boolean }) {
  const eaten = Math.round(tot.kcal);
  if (tg && showLeft) {
    const d = tg.kcal - eaten;
    return <div className="kcalRow"><span className="big" style={d < 0 ? { color: "var(--stop)" } : undefined}>{fmtInt(Math.abs(d))}</span><span className="sub">{d < 0 ? "kcal over" : "kcal left"} · {fmtInt(eaten)} eaten of {fmtInt(tg.kcal)}</span></div>;
  }
  return <div className="kcalRow"><span className="big">{fmtInt(eaten)}</span><span className="sub">{tg ? `of ${fmtInt(tg.kcal)} kcal · ${leftTxt(tg.kcal, eaten, "kcal")}` : "kcal · set up your profile for targets"}</span></div>;
}
