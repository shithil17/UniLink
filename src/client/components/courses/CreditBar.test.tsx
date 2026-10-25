// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CreditBar } from "./CreditBar";

afterEach(cleanup);

const bar = () => screen.getByRole("progressbar");

describe("CreditBar", () => {
  it.each([
    { name: "the ratio of earned to required", earned: 30, p: "25%", now: "25" },
    { name: "a real zero, not a stub", earned: 0, p: "0%", now: "0" },
    { name: "100% when earned passes required", earned: 130, p: "100%", now: "100" },
  ])("sets --p to $name", ({ earned, p, now }) => {
    render(<CreditBar earned={earned} required={120} />);
    expect(bar().style.getPropertyValue("--p")).toBe(p);
    expect(bar().getAttribute("aria-valuenow")).toBe(now);
  });
});
