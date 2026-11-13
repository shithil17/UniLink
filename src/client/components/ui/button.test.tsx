// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Button } from "./button";

afterEach(cleanup);

describe("Button loading", () => {
  it("keeps the label in the layout, transparent, and centers a spinner on top", () => {
    const { container } = render(<Button loading>Save target</Button>);
    const button = screen.getByRole("button", { name: "Save target" });

    expect(button.getAttribute("aria-busy")).toBe("true");
    const content = container.querySelector("[data-slot=button-content]");
    expect(content?.textContent).toBe("Save target");
    expect(content?.className).toContain("opacity-0");
    const spinner = container.querySelector("svg");
    expect(spinner?.parentElement?.className).toContain("absolute");
    // The spinner is not a flow sibling of the label, so it adds no width.
    expect(spinner?.parentElement?.parentElement).toBe(button);
  });

  it("shows no spinner and a plain label when not loading", () => {
    const { container } = render(<Button>Save target</Button>);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("[data-slot=button-content]")?.className).toBe("contents");
  });

  it("ignores clicks while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
