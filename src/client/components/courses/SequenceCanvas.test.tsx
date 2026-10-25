// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { CourseMap } from "../../../shared/schemas/courses";
import { CourseViewToggle } from "./CourseViewToggle";
import { layoutCourseSequence } from "../../lib/courseSequence";
import { connections, styleEdges } from "../../lib/sequenceEdges";
import { SequenceCanvas } from "./SequenceCanvas";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m22 = 1;
      inverse() {
        return this;
      }
      scale() {
        return this;
      }
    },
  );
  vi.stubGlobal(
    "DOMMatrix",
    class {
      m22 = 1;
      inverse() {
        return this;
      }
      scale() {
        return this;
      }
    },
  );
});

afterEach(cleanup);

const slot = (over: Partial<CourseMap["categories"][number]["slots"][number]> = {}) => ({
  kind: "course" as const,
  code: "CSE101",
  title: "Programming I",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  status: "available" as const,
  filledBy: null,
  chosenCode: null,
  waived: false,
  studentCourse: null,
  ...over,
});

const map: CourseMap = {
  curriculum: null,
  degree: { required: 7, earned: 0 },
  categories: [
    {
      name: "Core",
      required: 7,
      earned: 0,
      trails: null,
      slots: [
        slot(),
        slot({ code: "CSE101L", title: "Programming I Lab", credits: 1 }),
        slot({ code: "CSE102", title: "Algorithms", semester: 2, prereq: { course: "CSE101" } }),
        slot({ code: "CSE104", title: "Unrelated course", semester: 2 }),
        slot({ code: "CSE201", title: "Other prerequisite" }),
        slot({ code: "CSE202", title: "Other course", semester: 2, prereq: { course: "CSE201" } }),
      ],
    },
  ],
  extras: [],
};

describe("course sequence UI", () => {
  it("keeps the view toggle hidden below md and shows it from md up", () => {
    render(<CourseViewToggle view="list" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Course map view" });
    expect(group.className).toContain("hidden");
    expect(group.className).toContain("md:flex");
  });

  it("renders nodes, splits a lab pair, and opens the existing slot sheet target", () => {
    const onOpen = vi.fn();
    render(<SequenceCanvas map={map} onOpen={onOpen} />);
    const merged = screen.getByRole("button", { name: /CSE101 \+ L/ });
    expect(screen.getByRole("button", { name: /CSE102, Algorithms/ })).toBeTruthy();
    fireEvent.click(merged);
    expect(screen.getByRole("button", { name: /CSE101, Programming I,/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /CSE101L, Programming I Lab/ }));
    expect(onOpen).toHaveBeenCalledWith({ type: "slot", slot: map.categories[0]!.slots[1] });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: /CSE101 \+ L/ })).toBeTruthy();
  });

  it("keeps the highlight during a brief gap between course nodes", async () => {
    const { container } = render(<SequenceCanvas map={map} onOpen={() => {}} />);
    const first = container.querySelector('.react-flow__node[data-id="CSE101"]')!;
    const unrelated = container.querySelector('.react-flow__node[data-id="CSE104"]')!;
    fireEvent.mouseEnter(first);
    expect(unrelated.getAttribute("style")).toContain("opacity: 0.2");
    fireEvent.mouseLeave(first);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(unrelated.getAttribute("style")).toContain("opacity: 0.2");
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(unrelated.getAttribute("style")).not.toContain("opacity: 0.2");
  });

  it("draws the active chain in the brand colour, wider than the dimmed edges", () => {
    const layout = layoutCourseSequence(map);
    const chain = connections(layout, "CSE101")!;
    const edges = styleEdges(
      layout.edges.map((edge) => ({ ...edge, style: {} })) as never,
      chain.edges,
    );
    const lit = edges.find((edge) => edge.source === "CSE101")!;
    const dimmed = edges.find((edge) => edge.source === "CSE201")!;
    expect(lit.style.stroke).toBe("var(--color-brand)");
    expect(lit.markerEnd.color).toBe("var(--color-brand)");
    expect(lit.style.strokeWidth).toBeGreaterThan(dimmed.style.strokeWidth);
    expect(lit.style.opacity).toBe(1);
    expect(dimmed.style.opacity).toBe(0.08);
    expect(lit.zIndex).toBeGreaterThan(dimmed.zIndex);
    const idle = styleEdges(layout.edges as never, null);
    expect(idle[0]!.style.stroke).toBe("var(--color-edge)");
    expect(idle[0]!.style.opacity).toBe(1);
  });
});
