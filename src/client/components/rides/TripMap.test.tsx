// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { MapLibreModule } from "@/lib/map/load";
import type { Trip } from "@/lib/map/trip";
import * as fake from "@/test/fakeMapLibre";
import { TripMap, type TripMapProps } from "./TripMap";

// The panel is replaced by one that hands over `onMap`, so a test can run the preview's and the
// overlay's map callbacks in whatever order the browser does.
let onMap: NonNullable<import("@/components/map/MapPanel").MapPanelProps["onMap"]>;
vi.mock("@/components/map/MapPanel", () => ({
  MapPanel: (props: { onMap: typeof onMap }) => {
    onMap = props.onMap;
    return null;
  },
}));

const lib = fake as unknown as MapLibreModule;
const end = (lat: number, lng: number) => ({ point: { lat, lng }, exact: true, area: null });
const ONE_WAY: Trip = { pickup: end(23.71, 90.43), destination: end(23.81, 90.42) };
const PICKUP_ONLY: Trip = { pickup: end(23.71, 90.43), destination: null };

const props = (trip: Trip): TripMapProps => ({
  id: "ride",
  trip,
  pickup: { area: null, landmark: null },
  destination: { area: null, landmark: null },
  openLabel: "Open the map",
  label: "Map",
});

const newMap = () => new fake.Map({ container: document.createElement("div") });
const markersOn = (map: fake.Map) =>
  fake.Marker.instances.filter((m) => !m.removed && map.getCanvasContainer().contains(m.element));

beforeEach(() => fake.resetFakeMaps());
afterEach(cleanup);

describe("TripMap", () => {
  it("keeps the preview's pins when the closing overlay's map cleans up after it", () => {
    const view = render(<TripMap {...props(ONE_WAY)} />);
    const overlay = newMap();
    const cleanOverlay = onMap(overlay as never, lib) as () => void;
    // The preview mounts again while the overlay is still fading out.
    const preview = newMap();
    onMap(preview as never, lib);
    expect(markersOn(preview)).toHaveLength(2);

    act(() => cleanOverlay());
    expect(markersOn(overlay)).toHaveLength(0);
    expect(markersOn(preview)).toHaveLength(2);

    // And it still follows the trip: a pin placed on the form is drawn on the preview.
    view.rerender(<TripMap {...props(PICKUP_ONLY)} />);
    expect(markersOn(preview)).toHaveLength(1);
    view.rerender(<TripMap {...props(ONE_WAY)} />);
    expect(markersOn(preview)).toHaveLength(2);
  });

  it("clears its pins when the map goes away", () => {
    render(<TripMap {...props(ONE_WAY)} />);
    const map = newMap();
    const clean = onMap(map as never, lib) as () => void;
    act(() => clean());
    expect(markersOn(map)).toHaveLength(0);
  });
});
