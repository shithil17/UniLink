import type { Map as MapLibreMap } from "maplibre-gl";
import {
  MAP_BOUNDS,
  MAP_CITY_ZOOM,
  MAP_STREET_ZOOM,
  NSU_CENTRE,
  type GeoPoint,
} from "../../../shared/geo";

/** `MAP_BOUNDS` in the `[[west, south], [east, north]]` form MapLibre takes for `maxBounds`. */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [MAP_BOUNDS.west, MAP_BOUNDS.south],
  [MAP_BOUNDS.east, MAP_BOUNDS.north],
];

/** Space kept around fitted points, in px: enough that a pin is never under the edge or a floating control. */
export const FIT_PADDING = 48;

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** The shape MapLibre takes for a view: `[lng, lat]`. */
export const toLngLat = (p: GeoPoint): [number, number] => [p.lng, p.lat];

/** Where a map opens: the box around the points to fit, or NSU at city zoom when there are none. */
export function initialView(points: readonly GeoPoint[] | undefined) {
  if (!points || points.length === 0) {
    return { center: toLngLat(NSU_CENTRE), zoom: MAP_CITY_ZOOM };
  }
  return { bounds: boundsOf(points), fitBoundsOptions: fitOptions() };
}

export function boundsOf(points: readonly GeoPoint[]): [[number, number], [number, number]] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** Padding for a fit: one number for every side, or each side, for a map with a panel over one edge of it. */
export type FitPadding = number | { top: number; right: number; bottom: number; left: number };

function fitOptions(animate = false, padding: FitPadding = FIT_PADDING) {
  return { padding, maxZoom: MAP_STREET_ZOOM, animate };
}

/**
 * Moves the map to show `points`, flying there unless the user asked for reduced motion (then it
 * jumps). `padding` keeps them clear of whatever covers part of the map.
 */
export function fitToPoints(map: MapLibreMap, points: readonly GeoPoint[], padding?: FitPadding) {
  if (points.length === 0) {
    map.easeTo({
      center: toLngLat(NSU_CENTRE),
      zoom: MAP_CITY_ZOOM,
      duration: prefersReducedMotion() ? 0 : undefined,
    });
    return;
  }
  map.fitBounds(boundsOf(points), fitOptions(!prefersReducedMotion(), padding));
}

/** Centres on one spot at street zoom (a picked search result), flying unless reduced motion. */
export function flyToPoint(map: MapLibreMap, point: GeoPoint, zoom: number = MAP_STREET_ZOOM) {
  if (prefersReducedMotion()) map.jumpTo({ center: toLngLat(point), zoom });
  else map.flyTo({ center: toLngLat(point), zoom });
}

/** Zoom buttons: a step in or out, instant under reduced motion. */
export function zoomBy(map: MapLibreMap, direction: 1 | -1) {
  const options = prefersReducedMotion() ? { duration: 0 } : undefined;
  if (direction === 1) map.zoomIn(options);
  else map.zoomOut(options);
}
