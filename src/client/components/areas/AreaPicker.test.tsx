// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AreaOption } from "../../../shared/schemas/areas";
import { AreaPicker } from "./AreaPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const AREAS: AreaOption[] = [
  { id: 1, slug: "bashundhara-r-a", name: "Bashundhara R/A", lat: null, lng: null, children: [] },
  {
    id: 2,
    slug: "mirpur",
    name: "Mirpur",
    lat: null,
    lng: null,
    children: [{ id: 20, slug: "mirpur-pallabi", name: "Pallabi", lat: null, lng: null }],
  },
  { id: 3, slug: "uttara", name: "Uttara", lat: null, lng: null, children: [] },
];

function setup(
  props: { value?: number | null; anyLabel?: string; current?: { id: number; name: string } } = {},
) {
  const fetchMock = vi.fn(async () => Response.json(AREAS));
  vi.stubGlobal("fetch", fetchMock);
  const onChange = vi.fn();
  function Host() {
    const [v, setV] = useState<number | null>(props.value ?? null);
    return (
      <AreaPicker
        id="a"
        value={v}
        anyLabel={props.anyLabel}
        current={props.current}
        onChange={(next) => {
          setV(next);
          onChange(next);
        }}
      />
    );
  }
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Host />
    </QueryClientProvider>,
  );
  return { fetchMock, onChange };
}

const optionTexts = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("AreaPicker", () => {
  it("loads the list only when opened, with sub-areas listed under their area", async () => {
    const { fetchMock } = setup();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pick an area" }));
    expect(await screen.findByRole("option", { name: "Pallabi, in Mirpur" })).toBeTruthy();
    expect(optionTexts()).toEqual(["Bashundhara R/A", "Mirpur", "Pallabi", "Uttara"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("searches area and sub-area names in any case, and picks a sub-area", async () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick an area" }));
    const search = await screen.findByRole("combobox", { name: "Search areas" });
    await screen.findByText("Uttara");
    fireEvent.change(search, { target: { value: "PALLA" } });
    // The parent stays as a pickable heading row.
    expect(optionTexts()).toEqual(["Mirpur", "Pallabi"]);
    fireEvent.click(screen.getByRole("option", { name: "Pallabi, in Mirpur" }));
    expect(onChange).toHaveBeenCalledWith(20);
    expect(await screen.findByRole("button", { name: "Pallabi" })).toBeTruthy();
  });

  it("lets a top-level area be picked, with the keyboard too", async () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick an area" }));
    const search = await screen.findByRole("combobox", { name: "Search areas" });
    await screen.findByText("Uttara");
    fireEvent.change(search, { target: { value: "mirp" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("says when nothing matches", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Pick an area" }));
    const search = await screen.findByRole("combobox", { name: "Search areas" });
    await screen.findByText("Uttara");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(await screen.findByText(/No area matches that/)).toBeTruthy();
  });

  it("is clearable with an any row, and names an area from the URL once the list loads", async () => {
    const { onChange } = setup({ value: 3, anyLabel: "Any area" });
    const trigger = await screen.findByRole("button", { name: "Uttara" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Any area" }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(await screen.findByRole("button", { name: "Any area" })).toBeTruthy();
  });

  it("shows the saved name of an area that has left the list, without asking for it", () => {
    const { fetchMock } = setup({ value: 77, current: { id: 77, name: "Old Place" } });
    expect(screen.getByRole("button", { name: "Old Place" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
