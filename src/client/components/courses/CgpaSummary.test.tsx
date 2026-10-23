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
    expect(screen.getByText(/Record a graded course/)).toBeTruthy();
    expect(screen.getByText("Every category has its credits.")).toBeTruthy();
  });
});

describe("CgpaTile", () => {
  it("prints the figure to two decimals over the graded credits", () => {
    render(<CgpaTile summary={summary} />);
    expect(screen.getByText("3.46")).toBeTruthy();
    expect(screen.getByText("over 48 graded credits")).toBeTruthy();
  });

  it("prints a dash, not a zero, while there is no CGPA", () => {
    render(<CgpaTile summary={{ ...summary, cgpa: null, gradedCredits: 0 }} />);
    expect(screen.getByLabelText("No CGPA yet").textContent).toBe("–");
    expect(screen.queryByText("0.00")).toBeNull();
  });

  it("shows a loading state while the summary loads", () => {
    render(<CgpaTile />);
    expect(screen.getByRole("status").textContent).toBe("Loading your CGPA");
  });

  it("says it did not load and retries inside the tile", () => {
    const onRetry = vi.fn();
    render(<CgpaTile isError onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toBe("Your CGPA did not load.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("CreditsTile", () => {
  it("shows earned of required, the bar and what is left", () => {
    render(<CreditsTile earned={96} required={130} />);
    expect(screen.getByText("96")).toBeTruthy();
    expect(screen.getByText("of 130")).toBeTruthy();
    expect(screen.getByText("34 to go")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("74");
  });

  it("prints a real zero as 0 and never goes negative past the total", () => {
    const { unmount } = render(<CreditsTile earned={0} required={130} />);
    expect(screen.getByText("130 to go")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    unmount();
    render(<CreditsTile earned={136} required={130} />);
    expect(screen.getByText("All credits done")).toBeTruthy();
  });
});
