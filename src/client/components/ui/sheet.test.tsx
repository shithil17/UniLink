// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

const HEIGHT = 500;

beforeEach(() => {
  // happy-dom has no layout, so give the sheet a height for the 34% rule to measure against.
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(HEIGHT);
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.setPointerCapture = () => {};
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSheet(side: "bottom" | "right" = "bottom") {
  const onOpenChange = vi.fn();
  render(
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Pick a theme</SheetTitle>
          <SheetDescription>Just colors.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>,
  );
  return { onOpenChange, handle: document.querySelector("[data-slot=sheet-handle]") };
}

/** Drags the handle `to` px down over `ms` of fake time, then lets go. */
function drag(handle: Element, to: number, ms: number) {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const base = { pointerId: 1, isPrimary: true, pointerType: "touch" };
  fireEvent.pointerDown(handle, { ...base, clientY: 100 });
  now += ms;
  fireEvent.pointerMove(handle, { ...base, clientY: 100 + to });
  now += ms;
  fireEvent.pointerUp(handle, { ...base, clientY: 100 + to });
}

describe("Sheet drag to dismiss", () => {
  it("closes when the handle is dragged past a third of the sheet", () => {
    const { onOpenChange, handle } = renderSheet();
    expect(handle).not.toBeNull();
    drag(handle!, HEIGHT * 0.5, 400);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("stays open and settles back after a short slow drag", () => {
    const { onOpenChange, handle } = renderSheet();
    drag(handle!, HEIGHT * 0.05, 300);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Pick a theme")).toBeTruthy();
  });

  it("closes on a quick flick even over a short distance", () => {
    const { onOpenChange, handle } = renderSheet();
    drag(handle!, HEIGHT * 0.05, 10);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("only bottom sheets get a handle", () => {
    const { handle } = renderSheet("right");
    expect(handle).toBeNull();
  });
});
