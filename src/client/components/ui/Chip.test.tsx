// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Chip } from "./chip";

afterEach(cleanup);

const check = (container: HTMLElement) => container.querySelector("[data-slot=chip-check]");

describe("Chip", () => {
  it("toggles aria-pressed on click and shows a check only while pressed", () => {
    const { container } = render(<Chip>CSE core</Chip>);
    const chip = screen.getByRole("button", { name: "CSE core" });

    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(check(container)).toBeNull();

    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(check(container)).not.toBeNull();

    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(check(container)).toBeNull();
  });

  it("follows the pressed prop and reports the next value when controlled", () => {
    const onPressedChange = vi.fn();
    const { container, rerender } = render(
      <Chip pressed={false} onPressedChange={onPressedChange}>
        Maths
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Maths" });

    fireEvent.click(chip);
    expect(onPressedChange).toHaveBeenCalledWith(true);
    // Controlled: the chip does not flip until the parent says so.
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    rerender(
      <Chip pressed onPressedChange={onPressedChange}>
        Maths
      </Chip>,
    );
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(check(container)).not.toBeNull();
  });
});
