// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MAP_BOUNDS, MAP_CITY_ZOOM, NSU_CENTRE } from "../../../shared/geo";
import { liveMaps, Map as FakeMap, resetFakeMaps } from "@/test/fakeMapLibre";
import { MapView } from "./MapView";

vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"));

function reduceMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  resetFakeMaps();
  reduceMotion(false);
});
afterEach(cleanup);

const ready = () => waitFor(() => expect(screen.queryByText("Loading the map")).toBeNull());

describe("MapView", () => {
  it("shows a skeleton first, then the map, held to the bounds with rotation and tilt off", async () => {
    render(<MapView label="Test map" interactive />);
    expect(screen.getByText("Loading the map")).toBeTruthy();
    await ready();

    const options = liveMaps()[0]!.options;
    expect(options.maxBounds).toEqual([
      [MAP_BOUNDS.west, MAP_BOUNDS.south],
      [MAP_BOUNDS.east, MAP_BOUNDS.north],
    ]);
    expect(options.center).toEqual([NSU_CENTRE.lng, NSU_CENTRE.lat]);
    expect(options.zoom).toBe(MAP_CITY_ZOOM);
    expect(options).toMatchObject({
      interactive: true,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    expect(liveMaps()[0]!.getCanvas().getAttribute("aria-label")).toBe("Test map");
  });

  it("leaves the fade duration out unless motion is reduced, so MapLibre keeps its default and labels draw", async () => {
    render(<MapView label="Test map" interactive />);
    await ready();
    // An explicit `fadeDuration: undefined` overrides MapLibre's default and hides every label.
    expect("fadeDuration" in liveMaps()[0]!.options).toBe(false);
    cleanup();
    resetFakeMaps();

    reduceMotion(true);
    render(<MapView label="Test map" interactive />);
    await ready();
    expect(liveMaps()[0]!.options.fadeDuration).toBe(0);
  });

  it("opens fitted to the points it is given", async () => {
    render(
      <MapView
        label="Test map"
        interactive={false}
        fitPoints={[
          { lat: 23.8, lng: 90.4 },
          { lat: 23.7, lng: 90.5 },
        ]}
      />,
    );
    await ready();
    const options = liveMaps()[0]!.options;
    expect(options.bounds).toEqual([
      [90.4, 23.7],
      [90.5, 23.8],
    ]);
    expect(options.interactive).toBe(false);
  });

  it("moves to a new set of points, flying normally and jumping under reduced motion", async () => {
    const first = [{ lat: 23.8, lng: 90.4 }];
    const second = [{ lat: 23.7, lng: 90.5 }];
    const { rerender } = render(<MapView label="m" interactive fitPoints={first} />);
    await ready();
    const map = liveMaps()[0]!;

    rerender(<MapView label="m" interactive fitPoints={second} />);
    expect(map.called("fitBounds")[0]!.args[1]).toMatchObject({ animate: true });

    reduceMotion(true);
    rerender(<MapView label="m" interactive fitPoints={first} />);
    expect(map.called("fitBounds")[1]!.args[1]).toMatchObject({ animate: false });
  });

  it("restyles when the palette changes", async () => {
    render(<MapView label="m" interactive />);
    await ready();
    const map = liveMaps()[0]!;
    expect(map.called("setStyle")).toHaveLength(0);

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "night");
      await Promise.resolve();
    });
    await waitFor(() => expect(map.called("setStyle")).toHaveLength(1));
    expect(map.called("setStyle")[0]!.args[1]).toEqual({ diff: false });
    document.documentElement.removeAttribute("data-theme");
  });

  it("hands the map to onMap after each style load and runs its cleanup", async () => {
    const cleanup = vi.fn();
    const onMap = vi.fn((_map: unknown) => cleanup);
    const { unmount } = render(<MapView label="m" interactive onMap={onMap} />);
    await ready();
    expect(onMap).toHaveBeenCalledTimes(1);
    expect(onMap.mock.calls[0]![0]).toBe(liveMaps()[0]);

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "night");
      await Promise.resolve();
    });
    await waitFor(() => expect(onMap).toHaveBeenCalledTimes(2));
    expect(cleanup).toHaveBeenCalledTimes(1);
    document.documentElement.removeAttribute("data-theme");

    unmount();
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(liveMaps()).toHaveLength(0);
  });

  it("says the map is unavailable when it cannot start, and offers a retry on a full-screen map", async () => {
    FakeMap.failNext = true;
    render(<MapView label="m" interactive />);
    await screen.findByText(/can't load right now|unavailable offline/);
    expect(screen.queryByText("Loading the map")).toBeNull();

    // Retrying builds a map this time.
    screen.getByRole("button", { name: "Try again" }).click();
    await waitFor(() => expect(liveMaps()).toHaveLength(1));
    await ready();
  });

  it("says the map is unavailable when its tiles cannot be fetched", async () => {
    FakeMap.sourceError = true;
    render(<MapView label="m" interactive={false} />);
    await screen.findByText(/can't load right now|unavailable offline/);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
