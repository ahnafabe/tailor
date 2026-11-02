import { describe, expect, test } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "../../state/AppContext";
import { MemoryStore } from "../../platform/store";
import { FakeAiClient } from "../../platform/ai";
import { FoodTab } from "./FoodTab";
import { today } from "../../lib/format";

function setup(seed: Record<string, unknown> = {}, ai = new FakeAiClient()) {
  const store = new MemoryStore(seed);
  render(<AppProviders store={store} ai={ai}><FoodTab /></AppProviders>);
  return { store, user: userEvent.setup() };
}

const addFromSearch = async (user: ReturnType<typeof userEvent.setup>, q: string) => {
  const box = screen.getByPlaceholderText(/200g chicken/);
  await user.clear(box);
  await user.type(box, q);
  const first = within(screen.getByTestId("results")).getAllByRole("button", { name: "Add" })[0];
  await user.click(first);
};

describe("Food tab", () => {
  test("logs several foods in a row (regression: only the first food used to save)", async () => {
    const { store, user } = setup();
    await screen.findByText("Food log");
    await addFromSearch(user, "chicken breast");
    await addFromSearch(user, "banana");
    await addFromSearch(user, "egg, large");
    await waitFor(() => expect((store.get("day-" + today()) as { items: unknown[] }).items).toHaveLength(3));
    expect(within(screen.getByTestId("food-log")).getAllByText(/kcal · P/)).toHaveLength(3);
  });

  test("changing a serving to grams updates calories and macros", async () => {
    const { store, user } = setup();
    await screen.findByText("Food log");
    await addFromSearch(user, "chicken breast");
    await user.click(await screen.findByRole("button", { name: "Edit amount" }));
    const sheet = screen.getByTestId("amount-preview").closest(".sheet") as HTMLElement;
    await user.selectOptions(within(sheet).getByLabelText("Unit"), "g");
    const amt = within(sheet).getByLabelText("Amount eaten");
    await user.clear(amt);
    await user.type(amt, "250");
    expect(screen.getByTestId("amount-preview")).toHaveTextContent("= 413 kcal · P77.5 C0 F9");
    await user.click(within(sheet).getByRole("button", { name: "Save amount" }));
    await waitFor(() => expect(screen.getByTestId("food-log")).toHaveTextContent("250 g · 413 kcal"));
    const saved = (store.get("day-" + today()) as { items: { q: number; unit: string }[] }).items[0];
    expect(saved).toMatchObject({ q: 2.5, unit: "g" });
  });

  test("AI estimates are validated: malformed items are dropped", async () => {
    const ai = new FakeAiClient({ items: [{ name: "Chicken", serving: "150 g", kcal: "248", p: 46.5, c: 0, f: 5.4 }, { name: "", kcal: 100 }, { name: "Pizza", kcal: 99999 }] });
    const { user } = setup({}, ai);
    await screen.findByText("Food log");
    await user.type(screen.getByPlaceholderText(/200g chicken/), "chicken and stuff");
    await user.click(screen.getByRole("button", { name: "Estimate with Claude" }));
    expect(await screen.findByRole("status")).toHaveTextContent("2 unclear items skipped");
    expect(within(screen.getByTestId("results")).getAllByText(/kcal · P/)).toHaveLength(1);
  });

  test("shows yesterday's overage as an alteration", async () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    setup({ ["day-" + yk]: { items: [{ name: "x", kcal: 2900, p: 160, c: 300, f: 120, q: 1 }] } });
    expect(await screen.findByTestId("carry-note")).toHaveTextContent("Alteration: −490 kcal");
  });
});
