// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CgpaSummary } from "../../../shared/schemas/attempts";
import { CgpaSummaryView, CgpaTile, CreditsTile } from "./CgpaSummary";

afterEach(cleanup);

const summary: CgpaSummary = {
  cgpa: 3.4567,
  gradedCredits: 48,
  earnedCredits: 96,
  requiredCredits: 130,
  remainingCredits: 34,
  categories: [
    { name: "Core", required: 60, earned: 60, remaining: 0 },
    { name: "Math & Science", required: 30, earned: 24, remaining: 6 },
  ],
};

describe("CgpaSummaryView", () => {
  it("shows CGPA to two decimals, the credit totals and only the categories with credits left", () => {
    render(<CgpaSummaryView summary={summary} />);
    expect(screen.getByText("3.46")).toBeTruthy();
    expect(screen.getByText("over 48 graded credits")).toBeTruthy();
    expect(screen.getByText("96 / 130 credits")).toBeTruthy();
    expect(screen.getByText("34 credits")).toBeTruthy();
    expect(screen.getByText("Math & Science")).toBeTruthy();
    expect(screen.queryByText("Core")).toBeNull();
  });

  it("shows a dash and an empty state while there is no CGPA", () => {
    render(
      <CgpaSummaryView summary={{ ...summary, cgpa: null, gradedCredits: 0, categories: [] }} />,
    );
    expect(screen.getByLabelText("No CGPA yet").textContent).toBe("–");
    expect(screen.queryByText("0.00")).toBeNull();
    expect(screen.getByText(/Record a graded course/)).toBeTruthy();
    expect(screen.getByText("Every category has its credits.")).toBeTruthy();
  });
});

describe("CgpaTile", () => {
  it("says it did not load and retries inside the tile", () => {
    const onRetry = vi.fn();
    render(<CgpaTile isError onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toBe("Your CGPA did not load.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("CreditsTile", () => {
  it.each([
    { earned: 96, left: "34 to go", now: "74" },
    { earned: 0, left: "130 to go", now: "0" },
    { earned: 136, left: "All credits done", now: "100" },
  ])("shows $earned of 130 with $left", ({ earned, left, now }) => {
    render(<CreditsTile earned={earned} required={130} />);
    expect(screen.getByText(String(earned))).toBeTruthy();
    expect(screen.getByText("of 130")).toBeTruthy();
    expect(screen.getByText(left)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(now);
  });
});
