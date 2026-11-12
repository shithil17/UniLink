// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { liveMaps, resetFakeMaps } from "@/test/fakeMapLibre";
import { resetFakeMapParam } from "@/test/fakeMapParam";
import type { ModArea } from "../../shared/schemas/areas";
import { Route } from "./mod.areas";

vi.mock("@/lib/toast", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));
// No router here: the open map lives in a variable instead of the URL.
vi.mock("@/lib/map/useMapParam", () => import("@/test/fakeMapParam"));

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
  row({ id: 1, name: "Bashundhara R/A", lat: 23.81667, lng: 90.42943 }),
  row({ id: 2, name: "Mirpur", lat: 23.8223, lng: 90.3654 }),
  row({ id: 3, name: "Mirpur 10", parentId: 2 }),
  row({ id: 5, name: "Outside Dhaka", slug: "outside-dhaka" }),
  row({ id: 4, name: "Ghost Town", hidden: true, hiddenReason: "Not a real place" }),
];

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method === "PUT") return Response.json({ ...AREAS[2], lat: 1, lng: 1 });
  // The picker's place search reads the student list; nothing in it here.
  return Response.json(url === "/api/areas" ? [] : AREAS);
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  resetFakeMaps();
  resetFakeMapParam();
  vi.stubGlobal("fetch", fetchMock);
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
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

  const puts = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([url, init]) => [url, JSON.parse(init?.body as string)]);

  it("sets a sub-area's point from the picker, opened on its parent's point", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Mirpur 10" }));
    expect(await screen.findByRole("heading", { name: "Not on the map" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Set the map point" }));

    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    const map = liveMaps()[0]!;
    expect(map.options.bounds).toEqual([
      [90.3654, 23.8223],
      [90.3654, 23.8223],
    ]);
    expect(
      screen.getByText("Place the pin at the centre of the area, where students would expect it."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove pin" })).toBeNull();

    act(() => map.moveTo({ lat: 23.8301234, lng: 90.3712345 }));
    const use = () => screen.getByRole("button", { name: "Use this spot" }) as HTMLButtonElement;
    await waitFor(() => expect(use().disabled).toBe(false));
    fireEvent.click(use());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Map point saved"));
    expect(puts()).toEqual([
      ["/api/mod/areas/3/point", { point: { lat: 23.83012, lng: 90.37123 } }],
    ]);
    // The mod list and the student pickers are asked again.
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/mod/areas").length).toBeGreaterThan(
      1,
    );
  });

  it("moves an area that has a point, removes it from the picker, and toasts a refusal", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Bashundhara R/A" }));
    expect(await screen.findByRole("heading", { name: "On the map" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move the map point" }));

    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    expect(liveMaps()[0]!.options.bounds).toEqual([
      [90.42943, 23.81667],
      [90.42943, 23.81667],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Remove pin" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Map point removed"));
    expect(puts()).toEqual([["/api/mod/areas/1/point", { point: null }]]);
  });

  it("offers no map point for Outside Dhaka", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Outside Dhaka" }));
    expect(await screen.findByRole("heading", { name: "Not on the map" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /map point/ })).toBeNull();
  });
});
