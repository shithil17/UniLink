// @vitest-environment happy-dom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { NextClassPanel, TodaySection, type RoutineView } from "./TodaySection";

afterEach(cleanup);

const entry = (over: Partial<RoutineEntry> & Pick<RoutineEntry, "id" | "start" | "end">) =>
  ({
    term: { year: 2026, season: "fall" },
    courseCode: "CSE115",
    section: 1,
    days: ["T"],
    room: "",
    initials: "",
    ...over,
  }) as RoutineEntry;

// Tuesday 2026-10-20, 10:00 in Dhaka (04:00 UTC).
const now = Date.UTC(2026, 9, 20, 4, 0);
const titles = new Map([["CSE115", "Programming"]]);

async function renderIn(ui: React.ReactNode) {
  const root = createRootRoute({ component: () => ui });
  const router = createRouter({
    routeTree: root.addChildren([createRoute({ getParentRoute: () => root, path: "/routine" })]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole("region", { name: "Today" }).catch(() => null);
}

const view = (data: RoutineEntry[] | undefined, over: Partial<RoutineView> = {}): RoutineView => ({
  isPending: false,
  isError: false,
  data,
  refetch: () => {},
  ...over,
});

describe("TodaySection", () => {
  it("lists today's classes in time order, marking the current one and the finished one", async () => {
    const data = [
      entry({ id: 3, start: "13:00", end: "14:00", courseCode: "ENG115" }),
      entry({ id: 2, start: "09:30", end: "11:00", courseCode: "MAT120" }),
      entry({ id: 1, start: "08:00", end: "09:00" }),
      entry({ id: 4, start: "09:00", end: "10:00", days: ["M"], courseCode: "BUS101" }),
    ];
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={now} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("CSE115"),
      expect.stringContaining("MAT120"),
      expect.stringContaining("ENG115"),
    ]);
    expect(rows[0].textContent).toContain("Finished");
    expect(rows[1].textContent).toContain("Now");
    expect(rows[1].className).toContain("bg-brand-soft");
    expect(rows[2].textContent).not.toContain("Now");
    expect(screen.getByRole("link", { name: "Full routine" })).toBeTruthy();
  });

  it("says so when nothing is held today, and offers the routine when none is added", async () => {
    await renderIn(
      <TodaySection
        routine={view([entry({ id: 1, start: "09:00", end: "10:00", days: ["M"] })])}
        titles={titles}
        now={now}
      />,
    );
    expect(screen.getByText("No classes today.")).toBeTruthy();
    cleanup();
    await renderIn(<TodaySection routine={view([])} titles={titles} now={now} />);
    expect(screen.getByRole("link", { name: "Add your routine" })).toBeTruthy();
  });
});

describe("NextClassPanel", () => {
  it("counts down to the start of an upcoming class", () => {
    render(
      <NextClassPanel
        entry={entry({ id: 1, start: "10:12", end: "11:30", room: "304" })}
        title="Programming"
        now={now}
      />,
    );
    expect(screen.getByText("Next class")).toBeTruthy();
    expect(screen.getByText("12 min")).toBeTruthy();
    expect(screen.getByText("until it starts")).toBeTruthy();
    expect(screen.getByText(/Room 304/)).toBeTruthy();
  });

  it("counts down to the end of the class in progress", () => {
    render(<NextClassPanel entry={entry({ id: 1, start: "09:30", end: "10:45" })} now={now} />);
    expect(screen.getByText("In class now")).toBeTruthy();
    expect(screen.getByText("45 min")).toBeTruthy();
  });
});
