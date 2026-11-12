import { describe, expect, it } from "vite-plus/test";
import { MAP_BOUNDS, MAP_CITY_ZOOM, MAP_STREET_ZOOM, NSU_CENTRE } from "../../../shared/geo";
import { boundsOf, FIT_PADDING, initialView, MAX_BOUNDS } from "./camera";

describe("camera", () => {
  it("holds maps to the greater-Dhaka box, as [[west, south], [east, north]]", () => {
    expect(MAX_BOUNDS).toEqual([
      [MAP_BOUNDS.west, MAP_BOUNDS.south],
      [MAP_BOUNDS.east, MAP_BOUNDS.north],
    ]);
  });

  it("opens on NSU at city zoom when there is nothing to fit", () => {
    for (const none of [undefined, []]) {
      expect(initialView(none)).toEqual({
        center: [NSU_CENTRE.lng, NSU_CENTRE.lat],
        zoom: MAP_CITY_ZOOM,
      });
    }
  });

  it("fits the box around the points with padding and a street-zoom ceiling", () => {
    const view = initialView([
      { lat: 23.8, lng: 90.5 },
      { lat: 23.7, lng: 90.4 },
    ]);
    expect(view).toEqual({
      bounds: [
        [90.4, 23.7],
        [90.5, 23.8],
      ],
      fitBoundsOptions: { padding: FIT_PADDING, maxZoom: MAP_STREET_ZOOM, animate: false },
    });
  });

  it("makes a single point a zero-size box, which the street-zoom ceiling then bounds", () => {
    expect(boundsOf([{ lat: 23.8, lng: 90.4 }])).toEqual([
      [90.4, 23.8],
      [90.4, 23.8],
    ]);
  });
});
