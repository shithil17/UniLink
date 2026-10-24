// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CreditBar } from "./CreditBar";

afterEach(cleanup);

const bar = () => screen.getByRole("progressbar");

describe("CreditBar", () => {
  it("sets --p from the ratio of earned to required", () => {
    render(<CreditBar earned={30} required={120} />);
    expect(bar().style.getPropertyValue("--p")).toBe("25%");
    expect(bar().getAttribute("aria-valuenow")).toBe("25");
  });

  it("draws a real zero as 0%, not a stub", () => {
    render(<CreditBar earned={0} required={120} />);
    expect(bar().style.getPropertyValue("--p")).toBe("0%");
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
  });

  it("clamps at 100% when earned passes required", () => {
    render(<CreditBar earned={130} required={120} />);
    expect(bar().style.getPropertyValue("--p")).toBe("100%");
  });

  it("reveals the fill with clip-path rather than width", () => {
    render(<CreditBar earned={60} required={120} />);
    const fill = bar().querySelector("[data-slot=credit-bar-fill]")!;
    expect(fill.getAttribute("class")).toContain("clip-path");
    expect((fill as HTMLElement).style.width).toBe("");
  });
});
