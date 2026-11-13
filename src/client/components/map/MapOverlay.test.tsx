// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { liveMaps, resetFakeMaps } from "@/test/fakeMapLibre";
import { MapOverlay } from "./MapOverlay";

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

function renderOverlay(props: Partial<Parameters<typeof MapOverlay>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <MapOverlay open onClose={onClose} label="Map of this ride" {...props}>
      <p>Over the map</p>
    </MapOverlay>,
  );
  return { onClose };
}

describe("MapOverlay", () => {
  it("is a dialog named after the map, with the attribution and its controls", async () => {
    renderOverlay({ actions: <button type="button">Fit the ride</button> });
    expect(screen.getByRole("dialog", { name: "Map of this ride" })).toBeTruthy();
    expect(
      screen.getByText("© OpenStreetMap contributors").closest("a")?.getAttribute("href"),
    ).toBe("https://www.openstreetmap.org/copyright");
    expect(screen.getByText("OpenMapTiles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close the map" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit the ride" })).toBeTruthy();
    expect(screen.getByText("Over the map")).toBeTruthy();
    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    expect(liveMaps()[0]!.options.interactive).toBe(true);
  });

  it("renders nothing, and builds no map, while closed", () => {
    renderOverlay({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(liveMaps()).toHaveLength(0);
  });

  it("closes with the close button", () => {
    const { onClose } = renderOverlay();
    fireEvent.click(screen.getByRole("button", { name: "Close the map" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape", () => {
    const { onClose } = renderOverlay();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("zooms the map from the zoom buttons", async () => {
    renderOverlay();
    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    const map = liveMaps()[0]!;
    await waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(map.called("zoomIn")).toHaveLength(1);
    expect(map.called("zoomOut")).toHaveLength(1);
  });

  it("passes the map to onMap so a screen can add markers", async () => {
    const onMap = vi.fn();
    renderOverlay({ onMap });
    await waitFor(() => expect(onMap).toHaveBeenCalledTimes(1));
    expect(onMap.mock.calls[0]![0]).toBe(liveMaps()[0]);
  });
});
