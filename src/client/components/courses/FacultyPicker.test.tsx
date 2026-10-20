// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { FacultyPicker } from "./FacultyPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LIST = [
  { id: 1, name: "Sabbir Rahman", initials: "SfR1", designation: "Lecturer", department: "ECE" },
  { id: 2, name: "Sadia Rahim", initials: "SfR2", designation: "Professor", department: "LAW" },
  { id: 3, name: "Tanzilur Rahman", initials: null, designation: "Professor", department: "ECE" },
];

function setup(value: number | null = null, current?: { name: string; initials: string | null }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(LIST)),
  );
  const onChange = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FacultyPicker id="f" value={value} onChange={onChange} current={current} />
    </QueryClientProvider>,
  );
  return onChange;
}

const openPicker = async () => {
  const trigger = await screen.findByRole("button", { name: /No faculty|\(/ });
  await vi.waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(trigger);
  return screen.findByRole("combobox", { name: "Search by name or initials" });
};

describe("FacultyPicker", () => {
  it("searches by initials and picks with the keyboard", async () => {
    const onChange = setup();
    const search = await openPicker();
    fireEvent.change(search, { target: { value: "sfr2" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "No faculty",
      expect.stringContaining("Sadia Rahim (SfR2)"),
    ]);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("shows initials in brackets only when there are some, and a muted designation line", async () => {
    setup();
    await openPicker();
    expect(screen.getByText("Tanzilur Rahman")).toBeTruthy();
    expect(screen.getByText("Sabbir Rahman (SfR1)")).toBeTruthy();
    expect(screen.getByText(/Professor · Law/)).toBeTruthy();
  });

  it("says when nothing matches and lets the student choose no faculty", async () => {
    const onChange = setup(1);
    const search = await openPicker();
    fireEvent.change(search, { target: { value: "zzzz" } });
    expect(screen.getByText("No faculty match that search.")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "No faculty" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("walks the list with the arrow keys", async () => {
    const onChange = setup();
    const search = await openPicker();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("names a saved choice that left the list", async () => {
    setup(99, { name: "Gone Person", initials: "GnP" });
    expect(await screen.findByRole("button", { name: "Gone Person (GnP)" })).toBeTruthy();
  });
});
