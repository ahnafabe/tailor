import { useState } from "react";
import { TodayTab } from "./features/today/TodayTab";
import { FoodTab } from "./features/food/FoodTab";
import { useServices } from "./state/AppContext";

type Tab = "today" | "food";

/** React version of Tailor (in progress). Tabs are migrated one at a time from apps/legacy. */
export function App() {
  const [tab, setTab] = useState<Tab>("today");
  const { store } = useServices();
  return (
    <div className="wrap">
      <header>
        <div>
          <div className="tag">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1>Tailor</h1>
          <div className="sub">Fitness and wellbeing, made to measure</div>
        </div>
        <div className="tag">{store.mode === "synced" ? "Synced" : "This device only"}</div>
      </header>
      {tab === "today" ? <TodayTab onLogFood={() => setTab("food")} /> : <FoodTab />}
      <nav className="tabs" role="tablist">
        {(["today", "food"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}><span>{t === "today" ? "Today" : "Food"}</span></button>
        ))}
      </nav>
    </div>
  );
}
