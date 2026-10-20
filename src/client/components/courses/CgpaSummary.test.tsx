// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { CgpaSummary } from "../../../shared/schemas/attempts";
import { CgpaSummaryView } from "./CgpaSummary";

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
