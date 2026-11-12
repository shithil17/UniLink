// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { parseMapParam } from "@/lib/map/useMapParam";
import { Map as FakeMap, liveMaps, resetFakeMaps } from "@/test/fakeMapLibre";
import { MapPanel } from "./MapPanel";

vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));

beforeEach(() => {
  resetFakeMaps();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

async function renderPanel(
  entries = ["/"],
  waitForPreview = true,
  onMap?: ComponentProps<typeof MapPanel>["onMap"],
) {
  const root = createRootRoute({
    validateSearch: (raw: Record<string, unknown>) => ({ map: parseMapParam(raw.map) }),
    component: () => (
      <main>
        <MapPanel
          id="ride"
          label="Map of this ride"
          openLabel="Open the map of this ride"
          onMap={onMap}
        />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: entries }),
  });
  render(<RouterProvider router={router} />);
  if (waitForPreview) await screen.findByRole("button", { name: /Open the map of this ride/ });
  return router;
}

const mapParam = (router: Awaited<ReturnType<typeof renderPanel>>) =>
  (router.state.location.search as { map?: string }).map;

describe("MapPanel", () => {
  it("shows a skeleton, then a map that is not interactive, behind one button", async () => {
    FakeMap.hold = true;
    await renderPanel();
    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    expect(screen.getByText("Loading the map")).toBeTruthy();
    // The button already says what it opens while the map loads.
    expect(screen.getByRole("button", { name: "Open the map of this ride" })).toBeTruthy();
    act(() => FakeMap.release());
    await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());

    expect(liveMaps()).toHaveLength(1);
    expect(liveMaps()[0]!.options.interactive).toBe(false);
    // The credit is on the preview too, as plain text inside the button.
    const button = screen.getByRole("button", { name: "Open the map of this ride" });
    expect(button.textContent).toContain("© OpenStreetMap contributors");
    expect(button.querySelector("a")).toBeNull();
  });

  it("opens the full-screen map on click, keeping one live map", async () => {
    const router = await renderPanel();
    await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());

    act(() => screen.getByRole("button", { name: "Open the map of this ride" }).click());
    expect(await screen.findByRole("dialog", { name: "Map of this ride" })).toBeTruthy();
    expect(mapParam(router)).toBe("ride");

    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    expect(liveMaps()[0]!.options.interactive).toBe(true);
  });

  it("closes with the close button and steps back in history", async () => {
    const router = await renderPanel();
    act(() => screen.getByRole("button", { name: "Open the map of this ride" }).click());
    await screen.findByRole("dialog");
    const length = router.history.length;

    act(() => screen.getByRole("button", { name: "Close the map" }).click());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mapParam(router)).toBeUndefined();
    // Back, not a second push: the entry the open added is the one that went away.
    expect(router.history.location.search).toBe("");
    expect(router.history.length).toBe(length);
  });

  it("never holds two live maps while the overlay fades out, and the preview map returns after", async () => {
    // Each map reports how many are alive when it loads: a preview that remounted during the
    // overlay's exit would see two.
    let mostAlive = 0;
    await renderPanel(["/"], true, () => {
      mostAlive = Math.max(mostAlive, liveMaps().length);
    });
    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    act(() => screen.getByRole("button", { name: "Open the map of this ride" }).click());
    await screen.findByRole("dialog");
    await waitFor(() => expect(liveMaps()[0]!.options.interactive).toBe(true));

    act(() => screen.getByRole("button", { name: "Close the map" }).click());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => {
      expect(liveMaps()).toHaveLength(1);
      expect(liveMaps()[0]!.options.interactive).toBe(false);
    });
    expect(mostAlive).toBe(1);
  });

  it("closes when the browser goes back", async () => {
    const router = await renderPanel();
    act(() => screen.getByRole("button", { name: "Open the map of this ride" }).click());
    await screen.findByRole("dialog");

    act(() => router.history.back());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mapParam(router)).toBeUndefined();
    // The preview is back, ready to open again.
    expect(screen.getByRole("button", { name: "Open the map of this ride" })).toBeTruthy();
  });

  it("closes with Escape", async () => {
    const router = await renderPanel();
    act(() => screen.getByRole("button", { name: "Open the map of this ride" }).click());
    const dialog = await screen.findByRole("dialog");

    act(() => {
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mapParam(router)).toBeUndefined();
  });

  it("opens straight from a link with the param, and closing it does not leave the app", async () => {
    const router = await renderPanel(["/?map=ride"], false);
    await screen.findByRole("dialog", { name: "Map of this ride" });

    act(() => screen.getByRole("button", { name: "Close the map" }).click());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mapParam(router)).toBeUndefined();
    expect(router.history.location.pathname).toBe("/");
  });

  it("disables the preview and says so when the map cannot load", async () => {
    FakeMap.failNext = true;
    await renderPanel();
    await screen.findByText(/can't load right now|unavailable offline/);
    // The panel text comes from the map, and the button learns of it one render later through
    // `onStatusChange`, so wait for the button itself rather than assuming the two land together.
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Open the map of this ride" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );
  });
});
