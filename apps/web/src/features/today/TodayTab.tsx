import { dayTargets, totals } from "@tailor/core";
import { CarryNote, MacroBars, Rings, Segmented } from "../../components/summary";
import { useSaveProfile, useSnapshot } from "../../state/queries";
import { today } from "../../lib/format";

export function TodayTab({ onLogFood }: { onLogFood: () => void }) {
  const { data: s } = useSnapshot();
  const saveProfile = useSaveProfile();
  if (!s) return <div className="panel"><p className="sub">Loading your day…</p></div>;

  const k = today(), day = s.days[k] ?? {};
  const tg = dayTargets(s, k), tot = totals(day.items);
  const showLeft = s.profile.view === "left";
  const stepGoal = (s.profile.stepGoal as number) || 9000;

  return (
    <section>
      <div className="panel">
        <div className="row between">
          <h3>Today</h3>
          <Segmented label="Show eaten or left" value={showLeft ? "left" : "eaten"} options={[["eaten", "Eaten"], ["left", "Left"]]}
            onChange={(v) => saveProfile.mutate({ ...s.profile, view: v })} />
        </div>
        <Rings rings={[
          { label: "Calories", value: Math.round(tot.kcal), goal: tg?.kcal ?? null, unit: "kcal", color: "var(--ring1)", showLeft },
          { label: "Protein", value: Math.round(tot.p), goal: tg?.pro ?? null, unit: "g", color: "var(--ring2)", showLeft },
          { label: "Steps", value: (day.steps as number) || 0, goal: stepGoal, unit: "", color: "var(--ring3)" },
        ]} />
        <CarryNote tg={tg} />
        <MacroBars tot={tot} tg={tg} showLeft={showLeft} />
        <div className="row"><button className="btn small" onClick={onLogFood}>Log food</button></div>
      </div>
    </section>
  );
}
