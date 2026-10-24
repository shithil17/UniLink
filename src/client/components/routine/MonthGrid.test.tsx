// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { courseHue } from "@/lib/courseHue";

import { monthWeeks, type DateKey } from "../../../shared/calendar";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { MonthGrid } from "./MonthGrid";

afterEach(cleanup);

const entry = (id: number, courseCode: string, start: string, days: string[]) =>
  ({
    id,
    term: { year: 2026, season: "fall" },
    courseCode,
    section: 1,
    days,
    room: "",
    initials: "",
    start,
    end: `${Number(start.slice(0, 2)) + 1}:00`,
  }) as RoutineEntry;

const term = { start: "2026-08-30" as DateKey, end: "2026-12-20" as DateKey };

function month(entries: RoutineEntry[]) {
  render(
    <MonthGrid
      weeks={monthWeeks("2026-10-20")}
      month="2026-10"
      entries={entries}
      term={term}
      today="2026-10-20"
      onPickDate={vi.fn()}
    />,
  );
}

describe("MonthGrid", () => {
  it("marks today's cell and shows at most three dots, counting the rest in its name", () => {
    // Tuesday 2026-10-20 holds five classes.
    month(
      ["CSE115", "CSE215", "MAT120", "PHY107", "ENG102"].map((code, i) =>
        entry(i + 1, code, `${8 + i}:00`.padStart(5, "0"), ["T"]),
      ),
    );
    const today = screen.getByRole("button", { name: /Tuesday, October 20, 2026, today/ });
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(today.getAttribute("aria-label")).toContain("5 classes, 2 more than the dots show");
    expect(today.querySelectorAll('[data-slot="month-dot"]')).toHaveLength(3);
    expect(screen.getAllByRole("button", { current: "date" })).toHaveLength(1);
  });

  it("draws one hue dot per class on a lighter day, in each course's hue", () => {
    month([entry(1, "CSE215", "09:00", ["T"]), entry(2, "CSE215L", "11:00", ["T"])]);
    const today = screen.getByRole("button", { name: /October 20, 2026, today/ });
    const dots = [...today.querySelectorAll<HTMLElement>('[data-slot="month-dot"]')];
    expect(dots.map((d) => d.dataset.hue)).toEqual([courseHue("CSE215"), courseHue("CSE215L")]);
    expect(dots[0].dataset.hue).toBe(dots[1].dataset.hue);
    expect(today.getAttribute("aria-label")).toContain("2 classes");
    expect(today.getAttribute("aria-label")).not.toContain("more than");
  });

  it("draws no dots on a date without classes", () => {
    month([entry(1, "CSE215", "09:00", ["T"])]);
    const wednesday = screen.getByRole("button", { name: /Wednesday, October 21, 2026/ });
    expect(wednesday.querySelectorAll('[data-slot="month-dot"]')).toHaveLength(0);
    expect(wednesday.getAttribute("aria-label")).toContain("no classes");
  });
});
