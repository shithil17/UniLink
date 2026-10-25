// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { stateKind } from "@/lib/stateKind";
import { StateMark } from "./StateMark";

afterEach(cleanup);

const shapeOf = (container: HTMLElement) =>
  container.querySelector("[data-shape]")?.getAttribute("data-shape");

describe("StateMark", () => {
  it.each([
    { props: { status: "done" as const }, label: "Done", shape: "filled" },
    { props: { status: "available" as const }, label: "Available", shape: "hollow" },
    { props: { status: "locked" as const }, label: "Locked", shape: "struck" },
    { props: { status: "done" as const, waived: true }, label: "Waived", shape: "half" },
  ])("marks $label with its own label and shape", ({ props, label, shape }) => {
    const { container } = render(<StateMark {...props} />);
    expect(screen.getByRole("img", { name: label })).toBeTruthy();
    expect(shapeOf(container)).toBe(shape);
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
    expect(new Set(shapes).size).toBe(4);
  });

  it("takes a size and wears hue ink only inside a course", () => {
    const { container, rerender } = render(<StateMark status="available" />);
    const svg = () => container.querySelector("svg")!;
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
