// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { RoutineSheet } from "./RoutineSheet";

afterEach(cleanup);

const saved: RoutineEntry = {
  id: 1,
  term: { year: 2026, season: "fall" },
  courseCode: "CSE115",
  section: 2,
  days: ["M", "W"],
  start: "09:00",
  end: "10:30",
  room: "",
  initials: "",
};

function open(target: "new" | RoutineEntry) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RoutineSheet
        target={target}
        entries={[saved]}
        choices={[{ code: "CSE115", title: "Programming" }]}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
}

/** Picks a time in a TimeField's sheet: opens it by the field's name, sets the three lists and presses Done. */
async function pickTime(field: RegExp, hour: string, minute: string, period: "AM" | "PM") {
  fireEvent.click(screen.getByRole("button", { name: field }));
  const pick = async (list: string, name: string) =>
    fireEvent.click(
      within(await screen.findByRole("listbox", { name: list })).getByRole("option", { name }),
    );
  await pick("Hour", hour);
  await pick("Minute", minute);
  await pick("AM or PM", period);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("listbox", { name: "Hour" })).toBeNull());
}

const pick = (label: string, hour: string, minute: string, period: "AM" | "PM") =>
  pickTime(new RegExp(`^${label}, `), hour, minute, period);

describe("RoutineSheet overlap warning", () => {
  it("names the clashing class and the day while still letting the form be saved", async () => {
    open("new");
    fireEvent.click(screen.getByRole("button", { name: "Wednesday" }));
    await pick("Starts", "10", "00", "AM");
    await pick("Ends", "11", "00", "AM");
    const warning = await screen.findByRole("status");
    expect(warning.textContent).toContain("overlaps another class");
    expect(warning.textContent).toContain("CSE115 section 2, Wed");
    expect(warning.textContent).toContain("9:00 - 10:30 AM");
    expect((screen.getByRole("button", { name: "Add class" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("shows no warning for a class that starts when the other ends", async () => {
    open("new");
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    await pick("Starts", "10", "30", "AM");
    await pick("Ends", "12", "00", "PM");
    await waitFor(() => expect(screen.getByLabelText("Ends")).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not warn an edited class about itself", () => {
    open(saved);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("asks for the missing fields instead of saving an empty form", async () => {
    open("new");
    fireEvent.click(screen.getByRole("button", { name: "Add class" }));
    expect(await screen.findByText("Pick at least one day")).toBeTruthy();
    expect(screen.getByText("Pick a start time")).toBeTruthy();
    expect(screen.getByText(/Enter the section number/)).toBeTruthy();
  });
});

describe("RoutineSheet day chips", () => {
  it("names the days in full and toggles aria-pressed", () => {
    open("new");
    const sunday = screen.getByRole("button", { name: "Sunday" });
    expect(sunday.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(sunday);
    expect(sunday.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Sunday")).toBeTruthy();

    fireEvent.click(sunday);
    expect(sunday.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the chosen days in week order whatever order they were tapped in", () => {
    open("new");
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "Sunday" }));
    expect(screen.getByText("Sunday, Tuesday")).toBeTruthy();
  });
});
