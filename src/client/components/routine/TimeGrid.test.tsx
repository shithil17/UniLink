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
  it("colors a week block with the hue of its course code and tags the class under way", () => {
    const entries = [
      entry({ id: 1, courseCode: "CSE215", days: ["W"] }),
      entry({ id: 2, courseCode: "MAT120", days: ["W"], start: "13:00", end: "14:30" }),
      // Tuesday 11:30-13:00 is under way at `now`.
      entry({ id: 3, courseCode: "ENG115", days: ["T"], start: "11:30", end: "13:00" }),
    ];
    grid(entries);
    for (const e of entries) {
      const block = screen.getByRole("button", { name: new RegExp(`^${e.courseCode},`) });
      expect(block.dataset.hue).toBe(courseHue(e.courseCode));
    }
    expect(screen.getByRole("button", { name: /^ENG115,/ }).dataset.status).toBe("current");
    expect(screen.getByRole("button", { name: /^CSE215,/ }).dataset.status).not.toBe("current");
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

  it("marks today's header as the current date", () => {
    grid([]);
    const header = screen.getByRole("button", { name: /Tuesday, October 20, 2026, today/ });
    expect(header.getAttribute("aria-current")).toBe("date");
  });
});
