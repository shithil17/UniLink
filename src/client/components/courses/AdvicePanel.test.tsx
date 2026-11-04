// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { PlannerRow } from "@/lib/plannerModel";
import type { Advice } from "../../../shared/planner";
import { AdvicePanel } from "./AdvicePanel";

afterEach(cleanup);

const base = {
  target: 3.8,
  ceiling: { grade: "A-", points: 3.7, source: "history", gradedCourses: 12 },
  outlook: { overall: 3.2, average: 3.2, byCategory: {}, source: "history", gradedCourses: 12 },
  remainingCredits: 30,
  predictedAverage: 3.2,
  text: "Out of reach by graduation.",
  predictedCgpa: 3.3,
  neededAverage: 4.1,
} as const;

const outOfReach = (over: { possible: boolean }): Advice => ({
  ...base,
  kind: "out_of_reach",
  retakes: [{ code: "MAT116", credits: 3, currentBest: "D", aimFor: "B-", gainPerCredit: 1 }],
  bestCaseCgpa: 3.5,
  maxCgpa: over.possible ? 3.9 : 3.6,
  possible: over.possible,
  tooManyRetakes: false,
});

const rows: PlannerRow[] = [
  {
    key: "MAT116",
    code: "MAT116",
    title: "Calculus I",
    credits: 3,
    category: "Core",
    kind: "retake",
    best: "D",
    status: "done",
    waived: false,
  },
];

describe("AdvicePanel", () => {
  it("calls a target that top grades could still reach a stretch, and one they could not out of reach", () => {
    const { rerender } = render(
      <AdvicePanel advice={outOfReach({ possible: true })} realReached={false} rows={rows} />,
    );
    expect(screen.getByRole("heading", { name: "A stretch" })).toBeTruthy();
    rerender(
      <AdvicePanel advice={outOfReach({ possible: false })} realReached={false} rows={rows} />,
    );
    expect(screen.getByRole("heading", { name: "Out of reach" })).toBeTruthy();
  });

  it("lists each retake as a course row with its title, credits and grade change", () => {
    render(
      <AdvicePanel advice={outOfReach({ possible: false })} realReached={false} rows={rows} />,
    );
    expect(screen.getByText("Calculus I")).toBeTruthy();
    expect(screen.getByText("MAT116")).toBeTruthy();
    expect(screen.getByText("3 cr")).toBeTruthy();
    expect(screen.getByText("D to B-")).toBeTruthy();
  });

  it("states the estimate note once", () => {
    render(
      <AdvicePanel advice={outOfReach({ possible: false })} realReached={false} rows={rows} />,
    );
    expect(
      screen.getAllByText("Estimates only. Retake rules and fees are set by NSU."),
    ).toHaveLength(1);
  });

  it("shows the best case and straight A's figures when the target is out of reach", () => {
    render(
      <AdvicePanel advice={outOfReach({ possible: false })} realReached={false} rows={rows} />,
    );
    expect(screen.getByText("Best case at A-").nextSibling?.textContent).toBe("3.50");
    expect(screen.getByText("Straight A's").nextSibling?.textContent).toBe("3.60");
  });

  it("leaves those rows out when the figures are missing", () => {
    const advice = { ...outOfReach({ possible: false }), bestCaseCgpa: null, maxCgpa: null };
    render(<AdvicePanel advice={advice as Advice} realReached={false} rows={rows} />);
    expect(screen.queryByText("Straight A's")).toBeNull();
    expect(screen.queryByText(/^Best case at/)).toBeNull();
  });

  it("says any passing grade instead of a negative or zero needed average", () => {
    const needed = (n: number) => ({ ...outOfReach({ possible: false }), neededAverage: n });
    const label = /^Needed in your remaining/;
    const { rerender } = render(
      <AdvicePanel advice={needed(-6.5)} realReached={false} rows={rows} />,
    );
    expect(screen.getByText(label).nextSibling?.textContent).toBe("Any passing grade");
    rerender(<AdvicePanel advice={needed(0)} realReached={false} rows={rows} />);
    expect(screen.getByText(label).nextSibling?.textContent).toBe("Any passing grade");
    rerender(<AdvicePanel advice={needed(3.25)} realReached={false} rows={rows} />);
    expect(screen.getByText(label).nextSibling?.textContent).toBe("3.25");
    rerender(<AdvicePanel advice={needed(4.1)} realReached={false} rows={rows} />);
    expect(screen.getByText(label).nextSibling?.textContent).toBe("over 4.00");
  });
});
