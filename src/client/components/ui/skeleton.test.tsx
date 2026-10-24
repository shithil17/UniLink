// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SkeletonRows } from "./skeleton";

afterEach(cleanup);

describe("SkeletonRows", () => {
  it("is one busy status region that reads Loading once", () => {
    const { container } = render(<SkeletonRows rows={4} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toBe("Loading");
    expect(container.querySelectorAll("[data-slot=skeleton-row]")).toHaveLength(4);
  });

  it("separates rows with a hairline but not above the first", () => {
    const { container } = render(<SkeletonRows rows={2} />);
    const rows = container.querySelectorAll("[data-slot=skeleton-row]");
    expect(rows[0]?.className).not.toContain("border-t");
    expect(rows[1]?.className).toContain("border-t");
  });
});
