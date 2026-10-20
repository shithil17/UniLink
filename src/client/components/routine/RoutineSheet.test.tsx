// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("RoutineSheet overlap warning", () => {
  it("names the clashing class and the day while still letting the form be saved", async () => {
    open("new");
    fireEvent.click(screen.getByRole("button", { name: "Wednesday" }));
    type("Starts", "10:00");
    type("Ends", "11:00");
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
    type("Starts", "10:30");
    type("Ends", "12:00");
    await waitFor(() => expect(screen.getByLabelText("Ends")).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not warn an edited class about itself", () => {
    open(saved);
    expect(screen.getByRole("heading", { name: "Edit class" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete class" })).toBeTruthy();
  });

  it("asks for the missing fields instead of saving an empty form", async () => {
    open("new");
    fireEvent.click(screen.getByRole("button", { name: "Add class" }));
    expect(await screen.findByText("Pick at least one day")).toBeTruthy();
    expect(screen.getByText("Pick a start time")).toBeTruthy();
    expect(screen.getByText(/Enter the section number/)).toBeTruthy();
  });
});
