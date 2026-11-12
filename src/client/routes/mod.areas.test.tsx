// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ModArea } from "../../shared/schemas/areas";
import { Route } from "./mod.areas";

const row = (over: Partial<ModArea> & Pick<ModArea, "id" | "name">): ModArea => ({
  slug: over.name.toLowerCase().replace(/\W+/g, "-"),
  parentId: null,
  lat: null,
  lng: null,
  hidden: false,
  hiddenReason: null,
  ...over,
});

const AREAS: ModArea[] = [
  row({ id: 1, name: "Bashundhara R/A" }),
  row({ id: 2, name: "Mirpur" }),
  row({ id: 3, name: "Mirpur 10", parentId: 2 }),
  row({ id: 4, name: "Ghost Town", hidden: true, hiddenReason: "Not a real place" }),
];

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(AREAS));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () => {
  const Page = Route.options.component!;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Page />
    </QueryClientProvider>,
  );
};

describe("Mod Areas screen", () => {
  it("lists areas with sub-areas under their parent, and marks a hidden one with its reason", async () => {
    renderPage();
    const mirpur = await screen.findByRole("button", { name: "Mirpur" });
    const items = screen.getAllByRole("listitem");
    // The sub-area sits inside its parent's list item.
    const parentItem = items.find((li) => li.contains(mirpur) && li.querySelector("ul"))!;
    expect(within(parentItem).getByRole("button", { name: "Mirpur 10" })).toBeTruthy();
    const ghost = screen.getByRole("button", { name: /Ghost Town/ });
    expect(ghost.textContent).toContain("Hidden");
    expect(ghost.textContent).toContain("Not a real place");
    expect(screen.getByRole("button", { name: "Bashundhara R/A" }).textContent).not.toContain(
      "Hidden",
    );
  });

  it("opens the edit sheet for an area and the add sheet from the header", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Mirpur 10" }));
    expect(await screen.findByRole("heading", { name: "Edit area" })).toBeTruthy();
    expect(screen.getByText(/A sub-area of Mirpur/)).toBeTruthy();
    cleanup();

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add area" }));
    expect(await screen.findByRole("heading", { name: "Add area" })).toBeTruthy();
  });
});
