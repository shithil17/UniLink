// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { stateKind } from "@/lib/stateKind";
import { StateMark } from "./StateMark";

afterEach(cleanup);

const shapeOf = (container: HTMLElement) =>
  container.querySelector("[data-shape]")?.getAttribute("data-shape");

describe("StateMark", () => {
  it("labels each state for assistive tech, not by color alone", () => {
    const cases = [
      { props: { status: "done" as const }, label: "Done" },
      { props: { status: "available" as const }, label: "Available" },
      { props: { status: "locked" as const }, label: "Locked" },
      { props: { status: "done" as const, waived: true }, label: "Waived" },
    ];
    for (const { props, label } of cases) {
      render(<StateMark {...props} />);
      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      cleanup();
    }
  });

  it("draws a different shape for every state", () => {
    const shapes = [
      { status: "done" as const },
      { status: "available" as const },
      { status: "locked" as const },
      { status: "done" as const, waived: true },
    ].map((props) => {
      const { container } = render(<StateMark {...props} />);
      const shape = shapeOf(container);
      cleanup();
      return shape;
    });
    expect(shapes).toEqual(["filled", "hollow", "struck", "half"]);
    expect(new Set(shapes).size).toBe(4);
  });

  it("keeps waived and locked apart from each other and from done and available", () => {
    const shape = (props: { status: "done" | "available" | "locked"; waived?: boolean }) => {
      const { container } = render(<StateMark {...props} />);
      const found = shapeOf(container);
      cleanup();
      return found;
    };
    const waived = shape({ status: "done", waived: true });
    const locked = shape({ status: "locked" });
    expect(waived).toBe("half");
    expect(locked).toBe("struck");
    expect(
      new Set([waived, locked, shape({ status: "done" }), shape({ status: "available" })]),
    ).toHaveProperty("size", 4);
  });

  it("is 20px by default, takes a size, and wears hue ink only inside a course", () => {
    const { container, rerender } = render(<StateMark status="available" />);
    const svg = () => container.querySelector("svg")!;
    expect(svg().getAttribute("width")).toBe("20");
    expect(svg().getAttribute("class")).toContain("text-ink");
    rerender(<StateMark status="available" size={28} inCourse />);
    expect(svg().getAttribute("height")).toBe("28");
    expect(svg().getAttribute("class")).toContain("text-hue-ink");
  });

  it("prints the label and hides the mark from assistive tech when asked", () => {
    render(<StateMark status="locked" showLabel />);
    expect(screen.getByText("Locked")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("only a done course can be waived", () => {
    expect(stateKind("done", true)).toBe("waived");
    expect(stateKind("available", true)).toBe("available");
  });
});
