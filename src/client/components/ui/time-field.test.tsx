// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TimeField } from "./time-field";

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof TimeField>> = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState(props.value ?? "");
    return (
      <TimeField
        id="t"
        label="Starts"
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

const trigger = () => screen.getByRole("button", { name: /^Starts, / });
const open = () => fireEvent.click(trigger());
const list = (name: string) => screen.getByRole("listbox", { name });
const option = (name: string, text: string) =>
  within(list(name)).getByRole("option", { name: text });
const selected = (name: string) =>
  within(list(name))
    .getAllByRole("option")
    .find((o) => o.getAttribute("aria-selected") === "true")?.textContent;
const done = () => fireEvent.click(screen.getByRole("button", { name: "Done" }));
const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

describe("TimeField", () => {
  it.each([
    ["09:40", "9:40 AM"],
    ["13:05", "1:05 PM"],
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["23:59", "11:59 PM"],
  ])("reads %s as %s, never the 24-hour form", (value, shown) => {
    setup({ value });
    expect(trigger().textContent).toBe(shown);
    expect(trigger().getAttribute("aria-label")).toBe(`Starts, ${shown}`);
  });

  it("says what to do while empty instead of a dashed mask", () => {
    setup();
    expect(trigger().textContent).toBe("Pick a time");
    expect(trigger().textContent).not.toContain("--");
    expect(trigger().getAttribute("aria-label")).toBe("Starts, Pick a time");
  });

  it("opens on the current time with each list on its selected option", async () => {
    setup({ value: "13:05" });
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    expect([selected("Hour"), selected("Minute"), selected("AM or PM")]).toEqual(["1", "05", "PM"]);
    expect(within(list("Hour")).getAllByRole("option")).toHaveLength(12);
    // Minutes run in fives.
    expect(within(list("Minute")).getAllByRole("option")).toHaveLength(12);
    await waitFor(() => expect(document.activeElement).toBe(option("Hour", "1")));
  });

  it("emits HH:MM in 24-hour form only when Done is pressed", async () => {
    const { onChange } = setup({ value: "09:40" });
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    fireEvent.click(option("Hour", "2"));
    fireEvent.click(option("Minute", "35"));
    fireEvent.click(option("AM or PM", "PM"));
    expect(onChange).not.toHaveBeenCalled();
    done();
    expect(onChange).toHaveBeenCalledWith("14:35");
    await closed();
    expect(trigger().textContent).toBe("2:35 PM");
  });

  it("starts an empty field at 9:00 AM and commits it with Done", async () => {
    const { onChange } = setup();
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    done();
    expect(onChange).toHaveBeenCalledWith("09:00");
  });

  it("keeps a value that is off the five-minute step and lists that minute", async () => {
    const { onChange } = setup({ value: "09:43" });
    expect(trigger().textContent).toBe("9:43 AM");
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    expect(within(list("Minute")).getAllByRole("option")).toHaveLength(13);
    expect(selected("Minute")).toBe("43");
    // Picking another minute keeps 43 in the list, and Done on the untouched value keeps it too.
    fireEvent.click(option("Minute", "45"));
    expect(option("Minute", "43")).toBeTruthy();
    fireEvent.click(option("Minute", "43"));
    done();
    expect(onChange).toHaveBeenCalledWith("09:43");
  });

  it("moves with the arrow keys and Enter commits", async () => {
    const { onChange } = setup({ value: "09:00" });
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    await waitFor(() => expect(document.activeElement).toBe(option("Hour", "9")));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(selected("Hour")).toBe("10");
    expect(document.activeElement).toBe(option("Hour", "10"));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(option("Minute", "00"));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(selected("Minute")).toBe("55");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(selected("AM or PM")).toBe("PM");
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("22:55");
  });

  it("Space commits like Enter", async () => {
    const { onChange } = setup({ value: "09:00" });
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    await waitFor(() => expect(document.activeElement).toBe(option("Hour", "9")));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(onChange).toHaveBeenCalledWith("10:00");
    await closed();
  });

  it("closes on Escape without changing the value and hands focus back", async () => {
    const { onChange } = setup({ value: "09:00" });
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    fireEvent.click(option("Hour", "4"));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await closed();
    expect(document.activeElement).toBe(trigger());
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger().textContent).toBe("9:00 AM");
  });

  it("clears an optional field, and offers Clear only when it may be empty", async () => {
    const { onChange } = setup({ value: "09:00", clearable: true });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
    await closed();
    expect(trigger().textContent).toBe("Pick a time");
    cleanup();

    setup({ value: "09:00" });
    open();
    await screen.findByRole("listbox", { name: "Hour" });
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("passes the ref and the invalid and described-by attributes to the button", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <TimeField
        ref={ref}
        label="Leaves at"
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
