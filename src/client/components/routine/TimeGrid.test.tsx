// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { courseHue } from "@/lib/courseHue";
import type { DateKey } from "../../../shared/calendar";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { TimeGrid } from "./TimeGrid";

afterEach(cleanup);

const entry = (over: Partial<RoutineEntry> & Pick<RoutineEntry, "id" | "courseCode">) =>
  ({
    term: { year: 2026, season: "fall" },
    section: 1,
    days: ["T"],
    room: "",
    initials: "",
    start: "10:00",
    end: "11:30",
    ...over,
  }) as RoutineEntry;

// Tuesday 2026-10-20, 12:00 in Dhaka (06:00 UTC).
const now = Date.UTC(2026, 9, 20, 6, 0);
const week: DateKey[] = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
];
const term = { start: "2026-08-30" as DateKey, end: "2026-12-20" as DateKey };

function grid(entries: RoutineEntry[], dates: DateKey[] = week) {
  render(
    <TimeGrid
      dates={dates}
      entries={entries}
      term={term}
      today="2026-10-20"
      now={now}
      titles={new Map()}
      onOpen={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
}

describe("TimeGrid", () => {
  it("colors a week block with the hue of its course code", () => {
    const entries = [
      entry({ id: 1, courseCode: "CSE215", days: ["W"] }),
      entry({ id: 2, courseCode: "MAT120", days: ["W"], start: "13:00", end: "14:30" }),
    ];
    grid(entries);
    for (const e of entries) {
      const block = screen.getByRole("button", { name: new RegExp(`^${e.courseCode},`) });
      expect(block.dataset.hue).toBe(courseHue(e.courseCode));
      expect(block.className).toContain("bg-hue");
    }
  });

  it("gives a lab the hue of its theory course", () => {
    grid([
      entry({ id: 1, courseCode: "CSE215" }),
      entry({ id: 2, courseCode: "CSE215L", start: "13:00", end: "14:30" }),
    ]);
    const theory = screen.getByRole("button", { name: /^CSE215,/ });
    const lab = screen.getByRole("button", { name: /^CSE215L,/ });
    expect(lab.dataset.hue).toBe(theory.dataset.hue);
  });

  it("colors a day block the same way and tags the class under way", () => {
    grid([entry({ id: 1, courseCode: "CSE215", start: "11:30", end: "13:00" })], [week[2]]);
    const block = screen.getByRole("button", { name: /^CSE215,/ });
    expect(block.dataset.hue).toBe(courseHue("CSE215"));
    expect(block.dataset.status).toBe("current");
    expect(block.className).toContain("rounded-row");
  });

  it("fills today's header and marks it as the current date", () => {
    grid([]);
    const header = screen.getByRole("button", { name: /Tuesday, October 20, 2026, today/ });
    expect(header.getAttribute("aria-current")).toBe("date");
    expect(header.className).toContain("bg-brand-soft");
  });
});
