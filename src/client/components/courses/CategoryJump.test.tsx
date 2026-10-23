// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CategoryJump } from "./CategoryJump";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function setup(reduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) => ({ matches: reduce && query.includes("reduce") }) as MediaQueryList,
  );
  const target = document.createElement("h2");
  target.id = "cat-math-science";
  const scroll = vi.fn();
  target.scrollIntoView = scroll;
  document.body.append(target);
  render(<CategoryJump names={["Core", "Math & Science"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Math & Science" }));
  return scroll;
}

describe("CategoryJump", () => {
  it("scrolls the category heading into view smoothly and holds no pressed state", () => {
    const scroll = setup(false);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth" });
    for (const name of ["Core", "Math & Science"]) {
      expect(screen.getByRole("button", { name }).hasAttribute("aria-pressed")).toBe(false);
    }
  });

  it("jumps instantly under reduced motion", () => {
    expect(setup(true)).toHaveBeenCalledWith({ behavior: "auto" });
  });
});
