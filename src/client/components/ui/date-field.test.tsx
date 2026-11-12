// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DateField } from "./date-field";

afterEach(cleanup);

const TODAY = "2026-10-21";

function setup(props: Partial<React.ComponentProps<typeof DateField>> = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState(props.value ?? "");
    return (
      <DateField
        id="d"
        label="Runs until"
        today={TODAY}
        {...props}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange };
}

const trigger = () => screen.getByRole("button", { name: /^Runs until, / });
const open = () => fireEvent.click(trigger());
const day = (long: string) => screen.getByRole("button", { name: new RegExp(`^${long}`) });
const cursor = () => document.activeElement as HTMLElement;
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(cursor(), { key: k, ...init });

describe("DateField", () => {
  it("shows the picked date day first and names it in full for screen readers", () => {
    setup({ value: "2026-10-21" });
    expect(trigger().textContent).toBe("Wed, 21 Oct 2026");
    expect(trigger().getAttribute("aria-label")).toBe("Runs until, Wednesday, 21 October 2026");
  });

  it("never prints a month-first numeric date", () => {
    setup({ value: "2026-03-04" });
    // 4 March, not 3/4: the day comes first and the month is a word.
    expect(trigger().textContent).toBe("Wed, 4 Mar 2026");
    expect(trigger().textContent).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  it("says what to do while empty", () => {
    setup();
    expect(trigger().textContent).toBe("Pick a date");
    expect(trigger().getAttribute("aria-label")).toBe("Runs until, Pick a date");
  });

  it("opens on the picked month and emits YYYY-MM-DD for the tapped day", async () => {
    const { onChange } = setup({ value: "2026-10-21" });
    open();
    expect((await screen.findByText("October 2026")).textContent).toBe("October 2026");
    fireEvent.click(day("Friday, 30 October 2026"));
    expect(onChange).toHaveBeenCalledWith("2026-10-30");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger().textContent).toBe("Fri, 30 Oct 2026");
  });

  it("starts the week on Sunday and always draws six rows", async () => {
    setup({ value: "2026-02-10" });
    open();
    await screen.findByRole("grid");
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    // February 2026 fits in four weeks; the grid still has the header row and six day rows.
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("marks today and the selected day", async () => {
    setup({ value: "2026-10-25" });
    open();
    const today = await screen.findByRole("button", { name: "Wednesday, 21 October 2026, today" });
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(
      day("Sunday, 25 October 2026").closest("[role=gridcell]")?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("disables days outside min and max and the month steps that would leave them", async () => {
    const { onChange } = setup({ value: "2026-10-21", min: "2026-10-15", max: "2026-10-28" });
    open();
    const early = await screen.findByRole("button", { name: "Tuesday, 13 October 2026" });
    expect((early as HTMLButtonElement).disabled).toBe(true);
    expect((day("Thursday, 29 October 2026") as HTMLButtonElement).disabled).toBe(true);
    expect((day("Thursday, 15 October 2026") as HTMLButtonElement).disabled).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Previous month" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Next month" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(early);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves with the arrow keys and Page keys, then Enter picks", async () => {
    const { onChange } = setup({ value: "2026-10-21" });
    open();
    await waitFor(() =>
      expect(cursor().getAttribute("aria-label")).toBe("Wednesday, 21 October 2026, today"),
    );
    key("ArrowRight");
    expect(cursor().getAttribute("aria-label")).toBe("Thursday, 22 October 2026");
    key("ArrowDown");
    expect(cursor().getAttribute("aria-label")).toBe("Thursday, 29 October 2026");
    key("ArrowLeft");
    key("ArrowUp");
    expect(cursor().getAttribute("aria-label")).toBe("Wednesday, 21 October 2026, today");
    // The next month, same day; the grid and its header follow the cursor.
    key("PageDown");
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(cursor().getAttribute("aria-label")).toBe("Saturday, 21 November 2026");
    key("PageUp");
    key("PageUp");
    expect(screen.getByText("September 2026")).toBeTruthy();
    key("Enter");
    expect(onChange).toHaveBeenCalledWith("2026-09-21");
  });

  it("keeps the cursor inside min and max", async () => {
    setup({ value: "2026-10-21", max: "2026-10-22" });
    open();
    await waitFor(() => expect(cursor().getAttribute("aria-label")).toContain("21 October"));
    key("ArrowDown");
    expect(cursor().getAttribute("aria-label")).toBe("Thursday, 22 October 2026");
  });

  it("closes on Escape and hands focus back to the field", async () => {
    const { onChange } = setup({ value: "2026-10-21" });
    open();
    await screen.findByRole("grid");
    key("Escape");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears an optional field, and offers Clear only when it may be empty", async () => {
    const { onChange } = setup({ value: "2026-10-21", clearable: true });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger().textContent).toBe("Pick a date");
    cleanup();

    setup({ value: "2026-10-21" });
    open();
    await screen.findByRole("grid");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("passes the ref and the invalid and described-by attributes to the button", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <DateField
        ref={ref}
        label="Departs"
        value=""
        onChange={() => {}}
        aria-invalid
        aria-describedby="hint"
      />,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current?.getAttribute("aria-invalid")).toBe("true");
    expect(ref.current?.getAttribute("aria-describedby")).toBe("hint");
  });
});
