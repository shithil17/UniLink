import type { Map as MapLibreMap } from "maplibre-gl";
import { arcLine, distanceM, type GeoPoint } from "../../../shared/geo";
import type { AreaOption } from "../../../shared/schemas/areas";
import { areaPointOf } from "../areas";
import type { MapLibreModule } from "./load";
import { readMapTokens } from "./style";

/**
 * One end of a trip as a map draws it. An exact pin (`exact`) is a pin the student placed. Without
 * one the end stands at its area's point and is drawn as an "Around <area>" circle, so an approximate
 * place is never mistaken for an exact one.
 */
export type TripEnd = { point: GeoPoint; exact: boolean; area: string | null };

/** The two ends of a ride. An end with no pin and no area point is null and is not drawn. */
export type Trip = { pickup: TripEnd | null; destination: TripEnd | null };

/** What a ride or the form knows about one end: its exact pin, its area and the area's name. */
export type TripEndInput = {
  point: GeoPoint | null | undefined;
  areaId: number | null;
  areaName: string | null | undefined;
};

function endOf(input: TripEndInput, areas: readonly AreaOption[] | undefined): TripEnd | null {
  if (input.point) return { point: input.point, exact: true, area: input.areaName ?? null };
  const at = input.areaId === null ? null : areaPointOf(areas, input.areaId);
  return at ? { point: at, exact: false, area: input.areaName ?? null } : null;
}

/** The trip a ride (or the form being filled in) shows. `areas` is the area list, for the points of ends with no pin. */
export function tripOf(
  ends: { pickup: TripEndInput; destination: TripEndInput },
  areas: readonly AreaOption[] | undefined,
): Trip {
  return { pickup: endOf(ends.pickup, areas), destination: endOf(ends.destination, areas) };
}

/** The points a map fits: whichever ends are drawn. */
export const tripPoints = (trip: Trip): GeoPoint[] =>
  [trip.pickup?.point, trip.destination?.point].filter((p): p is GeoPoint => p !== undefined);

/** Google Maps directions between the two ends, or null when an end has no point at all. */
export function directionsUrl(trip: Trip): string | null {
  if (!trip.pickup || !trip.destination) return null;
  const at = (p: GeoPoint) => `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${at(trip.pickup.point)}&destination=${at(trip.destination.point)}`;
}

// ---- Drawing -------------------------------------------------------------------------------------

const LINE_ID = "trip-line";
/** The floating-layer shadow as a filter, so it follows the shape of a pin. */
const SOFT_SHADOW = "drop-shadow-[0_6px_6px_var(--float-color)]";

const PIN_PATH = "M18 43C18 43 3 28.5 3 16.5a15 15 0 0 1 30 0C33 28.5 18 43 18 43Z";
const FLAG_PATH = "M13 10.5v13M13 11h10.5l-3.5 4.25 3.5 4.25H13";

/** Pickup: a filled accent pin with a light dot. */
const PICKUP_PIN = `<svg viewBox="0 0 36 44" width="36" height="44" aria-hidden="true" class="${SOFT_SHADOW}"><path d="${PIN_PATH}" class="fill-brand stroke-surface" stroke-width="2.5"/><circle cx="18" cy="16.5" r="5.5" class="fill-surface"/></svg>`;
/** Destination: an outlined pin with a flag, so it never reads as the pickup in grey scale. */
const DESTINATION_PIN = `<svg viewBox="0 0 36 44" width="36" height="44" aria-hidden="true" class="${SOFT_SHADOW}"><path d="${PIN_PATH}" class="fill-surface stroke-brand" stroke-width="3.5"/><path d="${FLAG_PATH}" class="fill-brand stroke-brand" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The two pin drawings (static markup, no user text), also used for the picker's centre pin. */
export const PIN_MARKUP = { pickup: PICKUP_PIN, destination: DESTINATION_PIN } as const;

const AROUND_FLAG = `<svg viewBox="0 0 36 44" width="20" height="24" aria-hidden="true"><path d="${FLAG_PATH}" class="fill-brand-ink stroke-brand-ink" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function element(markup: string, className: string, label: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.innerHTML = markup;
  return el;
}

/** An exact pin. Its tip is the point. */
function pinElement(kind: "pickup" | "destination", area: string | null): HTMLElement {
  const label = kind === "pickup" ? "Pickup" : "Destination";
  return element(
    kind === "pickup" ? PICKUP_PIN : DESTINATION_PIN,
    "pointer-events-none",
    area ? `${label}, ${area}` : label,
  );
}

/** An end with no pin: a soft circle at the area's point (a dot for the pickup, a flag for the destination) and its name below. */
function areaElement(kind: "pickup" | "destination", area: string | null): HTMLElement {
  const text = area ? `Around ${area}` : "Around here";
  const circle = element(
    kind === "pickup" ? '<span class="size-3.5 rounded-full bg-brand"></span>' : AROUND_FLAG,
    "pointer-events-none relative grid size-11 place-items-center rounded-full bg-brand-soft shadow-float",
    `${kind === "pickup" ? "Pickup" : "Destination"}, ${text.toLowerCase()}`,
  );
  const name = document.createElement("span");
  name.className =
    "absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-full bg-surface px-2.5 py-1 text-[12px] leading-none font-semibold whitespace-nowrap text-ink shadow-float";
  name.textContent = text;
  circle.appendChild(name);
  return circle;
}

/**
 * Draws a trip on a map that has a loaded style: a marker for each end and the dashed line between
 * them. Call it from `MapView`'s `onMap`, which runs again after a palette change drops what a style
 * held, and return its result so the markers go before the next call. The line is the shortest
 * gentle curve (`arcLine`), dashed so it never reads as the road route.
 */
export function drawTrip(map: MapLibreMap, lib: MapLibreModule, trip: Trip): () => void {
  const markers = [
    { kind: "pickup", end: trip.pickup },
    { kind: "destination", end: trip.destination },
  ].flatMap(({ kind, end }) => {
    if (!end) return [];
    const k = kind as "pickup" | "destination";
    const marker = new lib.Marker({
      element: end.exact ? pinElement(k, end.area) : areaElement(k, end.area),
      anchor: end.exact ? "bottom" : "center",
    })
      .setLngLat([end.point.lng, end.point.lat])
      .addTo(map);
    return [marker];
  });

  if (trip.pickup && trip.destination && distanceM(trip.pickup.point, trip.destination.point) > 1) {
    const coordinates = arcLine(trip.pickup.point, trip.destination.point).map((p) => [
      p.lng,
      p.lat,
    ]);
    map.addSource(LINE_ID, {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
    });
    map.addLayer({
      id: LINE_ID,
      type: "line",
      source: LINE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": readMapTokens().brand,
        "line-width": 3,
        "line-dasharray": [1.2, 2],
      },
    });
  }

  return () => {
    for (const marker of markers) marker.remove();
    try {
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
      if (map.getSource(LINE_ID)) map.removeSource(LINE_ID);
    } catch {
      // The style was replaced under us; there is nothing left to remove.
    }
  };
}
