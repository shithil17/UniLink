/**
 * Map geometry shared by the client and the server: the one bounding box every map and every saved
 * point is held to, and the small point helpers around it. WGS84 throughout (degrees).
 */

export type GeoPoint = { lat: number; lng: number };

/** A box as plain edges, so the server can range-check without a map library. */
export type GeoBounds = { south: number; west: number; north: number; east: number };

/**
 * The greater-Dhaka box, about Savar to Gazipur to Narayanganj. Maps cannot pan out of it and a
 * saved point must fall inside it.
 */
export const MAP_BOUNDS: GeoBounds = { south: 23.58, west: 90.22, north: 24.08, east: 90.62 };

/** Bashundhara R/A, where NSU is. A map with nothing to fit opens here. */
export const NSU_CENTRE: GeoPoint = { lat: 23.8151, lng: 90.4253 };

/** Zoom of a map opened on NSU with nothing to fit: the north-east of the city in one view. */
export const MAP_CITY_ZOOM = 11;
/** Zoom where a student places a pin and where buildings and landmarks show. */
export const MAP_STREET_ZOOM = 16;
/** The map cannot be zoomed out past the greater-Dhaka box, whatever the screen size. */
export const MAP_MIN_ZOOM = 9;
/** Vector tiles stop at 14; past that they are drawn bigger, which is enough for a pin. */
export const MAP_MAX_ZOOM = 18;

/** A point is stored to 5 decimals, about 1 m. */
export const POINT_DECIMALS = 5;

/**
 * The pin picker counts the map as moved once its centre is this far (metres) from where it opened.
 * Floating-point noise in a fitted view stays under it; a deliberate nudge goes past it.
 */
export const PIN_MOVED_MIN_M = 2;

/** The line between two pins: how many straight pieces draw the curve. */
export const ARC_SEGMENTS = 32;
/** How far the line bows away from the straight one, as a share of the distance between the ends. */
export const ARC_BULGE = 0.18;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function inBounds(point: GeoPoint, bounds: GeoBounds = MAP_BOUNDS): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

const roundTo = (value: number) => {
  const factor = 10 ** POINT_DECIMALS;
  return Math.round(value * factor) / factor;
};

export function roundPoint(point: GeoPoint): GeoPoint {
  return { lat: roundTo(point.lat), lng: roundTo(point.lng) };
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

type MaybePoint = { lat: number | null; lng: number | null };

/** The area whose point is closest to `point`. Areas with no point are skipped; none left gives undefined. */
export function nearestArea<T extends MaybePoint>(
  point: GeoPoint,
  areas: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const area of areas) {
    if (area.lat === null || area.lng === null) continue;
    const distance = distanceM(point, { lat: area.lat, lng: area.lng });
    if (distance < bestDistance) {
      best = area;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * A gently curved line from `a` to `b` (a quadratic curve bowed to the left of the way there), as
 * `segments + 1` points. The first point is exactly `a` and the last exactly `b`. It is drawn
 * dashed, so it reads as "from here to there", never as the road route.
 */
export function arcLine(a: GeoPoint, b: GeoPoint, segments: number = ARC_SEGMENTS): GeoPoint[] {
  const steps = Math.max(1, Math.floor(segments));
  // Work on a flat plane with longitude shrunk by latitude, so "to the left" is a right angle on
  // the screen and not only on paper. The box is small enough for that to be exact enough.
  const cos = Math.cos(toRad((a.lat + b.lat) / 2));
  const dx = (b.lng - a.lng) * cos;
  const dy = b.lat - a.lat;
  const control = {
    x: a.lng * cos + dx / 2 - dy * ARC_BULGE,
    y: a.lat + dy / 2 + dx * ARC_BULGE,
  };
  const start = { x: a.lng * cos, y: a.lat };
  const end = { x: b.lng * cos, y: b.lat };

  const line: GeoPoint[] = [{ lat: a.lat, lng: a.lng }];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * start.x + 2 * u * t * control.x + t * t * end.x;
    const y = u * u * start.y + 2 * u * t * control.y + t * t * end.y;
    line.push({ lat: y, lng: x / cos });
  }
  line.push({ lat: b.lat, lng: b.lng });
  return line;
}
