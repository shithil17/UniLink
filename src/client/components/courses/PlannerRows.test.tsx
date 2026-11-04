// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlannerRow } from "@/lib/plannerModel";
import { PLANNER_ROWS_SHOWN } from "../../../shared/planner";
import { PlannerList } from "./PlannerRows";

afterEach(cleanup);

const row = (key: string, over: Partial<PlannerRow> = {}): PlannerRow => ({
  key,
  code: key,
  title: `Title ${key}`,
  credits: 3,
  category: "Core",
  kind: "future",
  best: null,
  status: "available",
  waived: false,
  ...over,
});

describe("PlannerList", () => {
  it("marks a row with a mock grade in a tone that differs from the panel and the page", () => {
    render(
      <PlannerList
        rows={[row("CSE101"), row("CSE102")]}
        picks={{ CSE102: "A" }}
        onPick={vi.fn()}
      />,
    );
    const mocked = screen.getByText("Title CSE102").closest("li")!;
    const plain = screen.getByText("Title CSE101").closest("li")!;
    // `tint` is the page colour, so a tint row would look like a hole in the panel.
    expect(mocked.className).toContain("bg-brand-soft");
    expect(mocked.className).not.toContain("bg-tint");
    expect(plain.className).not.toContain("bg-brand-soft");
    expect(screen.getAllByText("Mock").length).toBeGreaterThan(0);
  });

  it("says when a mock changes nothing", () => {
    render(
      <PlannerList
        rows={[row("MAT116", { kind: "retake", best: "B", status: "done" })]}
        picks={{ MAT116: "C" }}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByText("No change: your best stays B.")).toBeTruthy();
  });

  it("opens a long list as a preview, keeps mocked rows in it and shows the rest on demand", () => {
    const total = PLANNER_ROWS_SHOWN + 3;
    const rows = Array.from({ length: total }, (_, i) => row(`CSE${100 + i}`));
    const last = rows[total - 1].key;
    render(<PlannerList rows={rows} picks={{ [last]: "A" }} onPick={vi.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(PLANNER_ROWS_SHOWN + 1);
    expect(screen.getByText(`Title ${last}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Show all ${total}` }));
    expect(screen.getAllByRole("listitem")).toHaveLength(total);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });
});
