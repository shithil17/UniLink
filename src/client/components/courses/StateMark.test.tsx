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
