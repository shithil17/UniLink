// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

const HEIGHT = 500;
const PEEK = 100;

beforeEach(() => {
  // happy-dom has no layout, so give the sheet a height for the 34% rule to measure against.
  // The peek strip is measured through a probe element, which gets its own height.
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute("data-sheet-probe") ? PEEK : HEIGHT;
  });
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

function renderCollapsible(initial = false, open = true) {
  const onOpenChange = vi.fn();
  const onCollapsedChange = vi.fn();
  const view = (collapsed: boolean, isOpen = open) => (
    <Sheet
      open={isOpen}
      onOpenChange={onOpenChange}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    >
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Rides</SheetTitle>
          <button type="button">Inside</button>
          <button type="button" data-sheet-strip-action>
            Back
          </button>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
  const { rerender } = render(view(initial));
  const popup = () => document.querySelector<HTMLElement>("[data-slot=sheet-content]")!;
  return {
    onOpenChange,
    onCollapsedChange,
    popup,
    set: (c: boolean, isOpen = true) => rerender(view(c, isOpen)),
  };
}

describe("Collapsible sheet", () => {
  it("collapses instead of closing when dragged down past the threshold", () => {
    const { onOpenChange, onCollapsedChange } = renderCollapsible();
    const handle = document.querySelector("[data-slot=sheet-handle]")!;
    drag(handle, HEIGHT * 0.5, 400);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("stays open on a short slow drag", () => {
    const { onOpenChange, onCollapsedChange } = renderCollapsible();
    drag(document.querySelector("[data-slot=sheet-handle]")!, 10, 300);
    expect(onCollapsedChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("marks the sheet collapsed, drops the scrim's touches and hides the body under the strip", () => {
    const { popup, set } = renderCollapsible();
    expect(popup().hasAttribute("data-collapsed")).toBe(false);
    set(true);
    expect(popup().hasAttribute("data-collapsed")).toBe(true);
    expect(
      document.querySelector("[data-slot=sheet-overlay]")!.hasAttribute("data-collapsed"),
    ).toBe(true);
    const body = document.querySelector("[data-slot=sheet-body]")!;
    expect(body.className).toContain("group-data-collapsed/sheet:invisible");
    expect(body.contains(screen.getByText("Inside"))).toBe(true);
    // Hidden is inherited, so a strip action inside the body must opt back in or it vanishes with it.
    expect(body.className).toContain(
      "group-data-collapsed/sheet:**:data-sheet-strip-action:visible",
    );
    expect(
      screen.getByRole("button", { name: "Back" }).hasAttribute("data-sheet-strip-action"),
    ).toBe(true);
  });

  it("expands when the strip is tapped, but not when the close button is", () => {
    const { popup, onCollapsedChange, onOpenChange } = renderCollapsible(true);
    drag(popup(), 0, 100);
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    onCollapsedChange.mockClear();
    const base = { pointerId: 1, isPrimary: true, pointerType: "touch", clientY: 100 };
    fireEvent.pointerDown(screen.getByRole("button", { name: "Close" }), base);
    fireEvent.pointerUp(screen.getByRole("button", { name: "Close" }), base);
    expect(onCollapsedChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("expands when the strip is dragged up", () => {
    const { popup, onCollapsedChange } = renderCollapsible(true);
    drag(popup(), -HEIGHT * 0.5, 400);
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it("opens from the handle with Enter, or Space on release, and moves focus to the sheet", () => {
    const { popup, onCollapsedChange } = renderCollapsible(true);
    const handle = screen.getByRole("button", { name: "Expand" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "Enter" });
    expect(onCollapsedChange).toHaveBeenCalledTimes(1);
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    // Focus must not be left on a handle that stops being a button (it would drop to the page).
    expect(document.activeElement).toBe(popup());

    onCollapsedChange.mockClear();
    handle.focus();
    fireEvent.keyDown(handle, { key: " " });
    expect(onCollapsedChange).not.toHaveBeenCalled();
    fireEvent.keyUp(handle, { key: " " });
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(popup());
  });

  it("keeps strip actions live: pressing one neither grabs the strip nor expands it", () => {
    const { onCollapsedChange } = renderCollapsible(true);
    const back = screen.getByRole("button", { name: "Back" });
    const base = { pointerId: 1, isPrimary: true, pointerType: "touch", clientY: 100 };
    fireEvent.pointerDown(back, base);
    fireEvent.pointerUp(back, base);
    expect(onCollapsedChange).not.toHaveBeenCalled();
    // A press on the title row beside it is a tap on the strip.
    const title = screen.getByText("Rides");
    fireEvent.pointerDown(title, base);
    fireEvent.pointerUp(title, base);
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it("moves focus to the sheet when collapsing hides the control that has it, not a strip action", () => {
    const { popup, set } = renderCollapsible(false);
    screen.getByText("Inside").focus();
    set(true);
    expect(document.activeElement).toBe(popup());
    set(false);
    screen.getByRole("button", { name: "Back" }).focus();
    set(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" }));
  });

  it("does not carry a scroll position from one open of the sheet into the next", async () => {
    const { popup, set } = renderCollapsible(false);
    popup().scrollTop = 120;
    set(true);
    expect(popup().scrollTop).toBe(0);
    // Closed while collapsed. The sheet comes back as a new element, still collapsed, and then opens:
    // it must start where a fresh sheet does, not at the old list's place.
    set(true, false);
    await waitFor(() => expect(document.querySelector("[data-slot=sheet-content]")).toBeNull());
    set(true, true);
    await waitFor(() => expect(document.querySelector("[data-slot=sheet-content]")).not.toBeNull());
    set(false, true);
    expect(popup().scrollTop).toBe(0);
  });

  it("puts the scroll position back when the same open sheet expands again", () => {
    const { popup, set } = renderCollapsible(false);
    popup().scrollTop = 120;
    set(true);
    set(false);
    expect(popup().scrollTop).toBe(120);
  });

  it("does not collapse by pressing outside while collapsed", () => {
    const { onOpenChange } = renderCollapsible(true);
    for (const el of [document.body, document.querySelector("[data-slot=sheet-overlay]")!]) {
      fireEvent.pointerDown(el);
      fireEvent.mouseDown(el);
      fireEvent.click(el);
    }
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("a plain sheet is not collapsible", () => {
    const { handle } = renderSheet();
    expect(handle!.getAttribute("aria-hidden")).toBe("true");
    expect(
      document.querySelector("[data-slot=sheet-content]")!.hasAttribute("data-collapsed"),
    ).toBe(false);
  });
});
