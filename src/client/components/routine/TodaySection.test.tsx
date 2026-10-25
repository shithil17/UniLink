// @vitest-environment happy-dom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { courseHue } from "@/lib/courseHue";
import { NextClassPill, TodaySection, type RoutineView } from "./TodaySection";

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
  const data = [
    entry({ id: 3, start: "13:00", end: "14:00", courseCode: "ENG115" }),
    entry({ id: 2, start: "09:30", end: "11:00", courseCode: "MAT120" }),
    entry({ id: 1, start: "08:00", end: "09:00" }),
    entry({ id: 4, start: "09:00", end: "10:00", days: ["M"], courseCode: "BUS101" }),
  ];

  it("lists today's classes in time order, tagging the current, next and finished ones", async () => {
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={now} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("CSE115"),
      expect.stringContaining("MAT120"),
      expect.stringContaining("ENG115"),
    ]);
    expect(rows.map((r) => r.getAttribute("data-status"))).toEqual(["done", "current", "upcoming"]);
    expect(rows[0].textContent).toContain("Finished");
    expect(rows[1].textContent).toContain("In class now");
    expect(rows[1].textContent).not.toContain("Next");
    expect(rows[2].textContent).toContain("Next");
    expect(rows[2].textContent).not.toContain("In class now");
    expect(screen.getByRole("link", { name: "Full routine" })).toBeTruthy();
  });

  it("gives each block its course hue and prints the start, end and details", async () => {
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={now} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[1].getAttribute("data-hue")).toBe(courseHue("MAT120"));
    expect(rows[2].getAttribute("data-hue")).toBe(courseHue("ENG115"));
    expect(rows[1].textContent).toContain("9:30 - 11:00 AM");
    expect(rows[0].textContent).toContain("Programming");
    expect(rows[0].textContent).toContain("Section 1");
  });

  it("places blocks and the now marker by their time, 8 AM at the top", async () => {
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={now} />);
    const [done, current, upcoming] = screen.getAllByRole("listitem");
    expect(done.style.getPropertyValue("--at")).toBe("0");
    expect(current.style.getPropertyValue("--at")).toBe("1.5");
    expect(current.style.getPropertyValue("--span")).toBe("1.5");
    expect(upcoming.style.getPropertyValue("--at")).toBe("5");
    // 10:00 is two hours below the 8 AM line.
    const marker = document.querySelector('[data-slot="now-marker"]') as HTMLElement;
    expect(marker.style.getPropertyValue("--at")).toBe("2");
    expect(marker.textContent).toBe("10:00");
  });

  it("moves the marker with the clock and drops it outside the hours shown", async () => {
    const at = (h: number, m: number) => Date.UTC(2026, 9, 20, h - 6, m);
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={at(12, 30)} />);
    const marker = document.querySelector('[data-slot="now-marker"]') as HTMLElement;
    expect(marker.style.getPropertyValue("--at")).toBe("4.5");
    cleanup();
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={at(7, 59)} />);
    expect(document.querySelector('[data-slot="now-marker"]')).toBeNull();
    cleanup();
    await renderIn(<TodaySection routine={view(data)} titles={titles} now={at(14, 1)} />);
    expect(document.querySelector('[data-slot="now-marker"]')).toBeNull();
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
    expect(document.querySelector('[data-slot="now-marker"]')).toBeNull();
    cleanup();
    await renderIn(<TodaySection routine={view([])} titles={titles} now={now} />);
    expect(screen.getByRole("link", { name: "Add your routine" })).toBeTruthy();
  });

  it("shows a loading status while pending and a retry when the load failed", async () => {
    await renderIn(
      <TodaySection routine={view(undefined, { isPending: true })} titles={titles} now={now} />,
    );
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    cleanup();
    let retried = 0;
    await renderIn(
      <TodaySection
        routine={view(undefined, { isError: true, refetch: () => retried++ })}
        titles={titles}
        now={now}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retried).toBe(1);
  });
});

describe("NextClassPill", () => {
  it("names an upcoming class with its start and the wait", () => {
    render(
      <NextClassPill
        entry={entry({ id: 1, start: "10:12", end: "11:30", room: "304" })}
        title="Programming"
        now={now}
      />,
    );
    expect(screen.getByText("Next class")).toBeTruthy();
    expect(screen.getByText("in 12 min")).toBeTruthy();
    expect(screen.getByText(/CSE115/).textContent).toContain("at 10:12 AM");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("counts down to the end of the class in progress", () => {
    render(<NextClassPill entry={entry({ id: 1, start: "09:30", end: "10:45" })} now={now} />);
    expect(screen.getByText("In class now")).toBeTruthy();
    expect(screen.getByText("45 min left")).toBeTruthy();
    expect(screen.queryByText("Next class")).toBeNull();
  });
});
