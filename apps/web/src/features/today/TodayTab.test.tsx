import { expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "../../state/AppContext";
import { MemoryStore } from "../../platform/store";
import { FakeAiClient } from "../../platform/ai";
import { TodayTab } from "./TodayTab";
import { today } from "../../lib/format";

test("rings show eaten vs. target, and the Eaten/Left switch persists to the profile", async () => {
  const store = new MemoryStore({ ["day-" + today()]: { items: [{ name: "x", kcal: 600, p: 50, c: 60, f: 20, q: 1 }], steps: 4000 } });
  render(<AppProviders store={store} ai={new FakeAiClient()}><TodayTab onLogFood={() => {}} /></AppProviders>);
  const legend = await screen.findByTestId("ring-legend");
  expect(legend).toHaveTextContent("600/ 2,090 kcal");
  expect(legend).toHaveTextContent("4,000/ 9,000");

  await userEvent.setup().click(screen.getByRole("button", { name: "Left" }));
  await waitFor(() => expect(screen.getByTestId("ring-legend")).toHaveTextContent("1,490 kcal left"));
  expect(screen.getByTestId("macros")).toHaveTextContent("145 g left"); // protein 195 - 50
  expect((store.get("profile") as { view: string }).view).toBe("left");
});
