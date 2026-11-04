// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlannerRow } from "@/lib/plannerModel";
import { PlannerSection } from "./PlannerRows";

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

describe("PlannerSection", () => {
  it("marks a row with a mock grade in a tone that differs from the panel and the page", () => {
    render(
      <PlannerSection
        id="s"
        title="Still to take"
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
      <PlannerSection
        id="s"
        title="Could retake"
        rows={[row("MAT116", { kind: "retake", best: "B", status: "done" })]}
        picks={{ MAT116: "C" }}
        onPick={vi.fn()}
      />,
    );
    expect(screen.getByText("No change: your best stays B.")).toBeTruthy();
  });
});
