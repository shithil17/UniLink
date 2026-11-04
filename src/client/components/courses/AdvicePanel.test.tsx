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

const NO_TARGET = "Set a target CGPA to see what you need.";
const ESTIMATE = "Estimates only. Retake rules and fees are set by NSU.";

describe("AdvicePanel", () => {
  it("shows only the needed average while it is too early, with no prediction or retakes", () => {
    const { predictedCgpa: _, ...rest } = base;
    render(
      <AdvicePanel
        advice={{
          ...rest,
          kind: "too_early",
          neededAverage: 3.5,
          text: "You need about a 3.50 average in your remaining 121 credits.",
          outlook: { ...base.outlook, source: "fallback", gradedCourses: 3 },
        }}
        realReached={false}
        rows={rows}
        targetState="ready"
      />,
    );
    expect(screen.getByRole("heading", { name: "Too early to call" })).toBeTruthy();
    expect(screen.getByText(/You need about a 3.50 average/)).toBeTruthy();
    expect(screen.getByText(/Predictions start at/)).toBeTruthy();
    expect(screen.queryByText("Predicted at graduation")).toBeNull();
    expect(screen.queryByText("Your usual average there")).toBeNull();
    expect(screen.queryByText("Best case")).toBeNull();
    expect(screen.queryByText("Retakes that help most")).toBeNull();
  });

  it("calls a target that top grades could still reach a stretch, and one they could not out of reach", () => {
    const { rerender } = render(
      <AdvicePanel
        advice={outOfReach({ possible: true })}
        realReached={false}
        rows={rows}
        targetState="ready"
      />,
    );
    expect(screen.getByRole("heading", { name: "A stretch" })).toBeTruthy();
    rerender(
      <AdvicePanel
        advice={outOfReach({ possible: false })}
        realReached={false}
        rows={rows}
        targetState="ready"
      />,
    );
    expect(screen.getByRole("heading", { name: "Out of reach" })).toBeTruthy();
  });

  it("lists each retake as a course row with its title, credits and grade change", () => {
    render(
      <AdvicePanel
        advice={outOfReach({ possible: false })}
        realReached={false}
        rows={rows}
        targetState="ready"
      />,
    );
    expect(screen.getByText("Calculus I")).toBeTruthy();
    expect(screen.getByText("MAT116")).toBeTruthy();
    expect(screen.getByText("3 cr")).toBeTruthy();
    expect(screen.getByText("D to B-")).toBeTruthy();
  });

  it("states the estimate note once", () => {
    render(
      <AdvicePanel
        advice={outOfReach({ possible: false })}
        realReached={false}
        rows={rows}
        targetState="ready"
      />,
    );
    expect(
      screen.getAllByText("Estimates only. Retake rules and fees are set by NSU."),
    ).toHaveLength(1);
  });

  it("shows the best case and straight A's figures when the target is out of reach", () => {
    render(
      <AdvicePanel
        advice={outOfReach({ possible: false })}
        realReached={false}
        rows={rows}
        targetState="ready"
      />,
    );
    expect(screen.getByText("Best case").nextSibling?.textContent).toBe("3.50");
    expect(screen.getByText("Straight A's").nextSibling?.textContent).toBe("3.60");
  });

  it("leaves those rows out when the figures are missing", () => {
    const advice = { ...outOfReach({ possible: false }), bestCaseCgpa: null, maxCgpa: null };
    render(
      <AdvicePanel advice={advice as Advice} realReached={false} rows={rows} targetState="ready" />,
    );
    expect(screen.queryByText("Straight A's")).toBeNull();
    expect(screen.queryByText(/^Best case/)).toBeNull();
  });

  it("says any passing grade instead of a negative or zero needed average", () => {
    const needed = (n: number) => ({ ...outOfReach({ possible: false }), neededAverage: n });
    const label = /^Needed in your remaining/;
    const { rerender } = render(
      <AdvicePanel advice={needed(-6.5)} realReached={false} rows={rows} targetState="ready" />,
    );
    expect(screen.getByText(label).nextSibling?.textContent).toBe("Any passing grade");
    rerender(
      <AdvicePanel advice={needed(0)} realReached={false} rows={rows} targetState="ready" />,
    );
    expect(screen.getByText(label).nextSibling?.textContent).toBe("Any passing grade");
    rerender(
      <AdvicePanel advice={needed(3.25)} realReached={false} rows={rows} targetState="ready" />,
    );
    expect(screen.getByText(label).nextSibling?.textContent).toBe("3.25");
    rerender(
      <AdvicePanel advice={needed(4.1)} realReached={false} rows={rows} targetState="ready" />,
    );
    expect(screen.getByText(label).nextSibling?.textContent).toBe("over 4.00");
  });

  it("marks a retake of a failed extra course as available, not done", () => {
    const extra: PlannerRow[] = [{ ...rows[0]!, status: "available" }];
    const { container, rerender } = render(
      <AdvicePanel
        advice={outOfReach({ possible: false })}
        realReached={false}
        rows={extra}
        targetState="ready"
      />,
    );
    const marked = () => container.querySelector("li [data-state]")?.getAttribute("data-state");
    expect(marked()).toBe("available");
    // No matching row: falls back to the code and a done mark.
    rerender(
      <AdvicePanel
        advice={outOfReach({ possible: false })}
        realReached={false}
        rows={[]}
        targetState="ready"
      />,
    );
    expect(marked()).toBe("done");
  });

  it("prompts for a target only once the target is known to be unset", () => {
    render(<AdvicePanel advice={null} realReached={false} rows={rows} targetState="ready" />);
    expect(screen.getByText(NO_TARGET)).toBeTruthy();
    expect(screen.getByText(ESTIMATE)).toBeTruthy();
  });

  it("shows loading bars and no prompt while the target loads", () => {
    const { container } = render(
      <AdvicePanel advice={null} realReached={false} rows={rows} targetState="loading" />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText(NO_TARGET)).toBeNull();
    expect(screen.getByText(ESTIMATE)).toBeTruthy();
  });

  it("says there is no advice, not to set a target, when the target failed to load", () => {
    render(<AdvicePanel advice={null} realReached={false} rows={rows} targetState="failed" />);
    expect(screen.getByText("No advice until your target loads.")).toBeTruthy();
    expect(screen.queryByText(NO_TARGET)).toBeNull();
    expect(screen.getByText(ESTIMATE)).toBeTruthy();
  });
});
