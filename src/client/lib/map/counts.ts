import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { GeoPoint } from "../../../shared/geo";
import type { MapLibreModule } from "./load";

/** One area's count pill: where it stands, what it is called and how many rides it holds. */
export type CountPill = {
  areaId: number;
  name: string;
  count: number;
  point: GeoPoint;
  /** Sub-areas with a point and a count of their own: pills of their own, but also matched by this area's list filter. */
  nearby: number;
};

/** "1 ride", "6 rides". */
export const rideCount = (n: number): string => `${n} ${n === 1 ? "ride" : "rides"}`;

/** What a pill is called to a screen reader: "Jatrabari, 6 rides". */
export const pillLabel = (pill: Pick<CountPill, "name" | "count">): string =>
  `${pill.name}, ${rideCount(pill.count)}`;

const PILL =
  "relative grid h-8 min-w-8 cursor-pointer place-items-center rounded-full px-2.5 text-[13px] leading-none font-semibold tabular-nums shadow-float outline-none after:absolute after:-inset-2 after:content-[''] motion-safe:transition-transform motion-safe:duration-140 motion-safe:ease-ui-out focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-brand";
/** A selected pill flips to ink and grows, so the state is never color alone. */
const IDLE = "bg-brand text-primary-foreground";
const SELECTED = "scale-110 bg-ink text-app outline-2 outline-solid outline-surface";

/** What `drawCountPills` hands back: redraw the pills in place, or take them all off. */
export type CountPillsHandle = {
  /** Applies new counts and selection without remaking the pills that are still there, so a focused pill keeps focus. */
  update: (pills: readonly CountPill[], selectedId: number | null) => void;
  clear: () => void;
};

type Drawn = { marker: Marker; wrapper: HTMLElement; button: HTMLButtonElement };

/**
 * Draws a count pill at each area's point on a map with a loaded style. A pill is a real button
 * labelled "<Area>, N rides", inside a wrapper that MapLibre positions (so the pill's own press scale
 * never fights the marker's transform). Call it from `MapView`'s `onMap`, which runs again after a
 * palette restyle, and return `clear`. `onSelect` runs with the area id when a pill is tapped or
 * activated from the keyboard.
 */
export function drawCountPills(
  map: MapLibreMap,
  lib: MapLibreModule,
  initial: readonly CountPill[],
  initialSelected: number | null,
  onSelect: (areaId: number) => void,
): CountPillsHandle {
  const drawn = new Map<number, Drawn>();

  const paint = (pill: CountPill, selected: boolean, at: Drawn) => {
    at.button.textContent = String(pill.count);
    at.button.setAttribute("aria-label", pillLabel(pill));
    at.button.setAttribute("aria-pressed", String(selected));
    at.button.className = `${PILL} ${selected ? SELECTED : IDLE}`;
    at.wrapper.style.zIndex = selected ? "1" : "0";
    at.marker.setLngLat([pill.point.lng, pill.point.lat]);
  };

  const create = (pill: CountPill): Drawn => {
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.areaId = String(pill.areaId);
    button.addEventListener("click", () => onSelect(pill.areaId));
    // A tap on a pill is not a drag of the map under it.
    for (const type of ["pointerdown", "mousedown", "touchstart"]) {
      button.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }
    wrapper.appendChild(button);
    const marker = new lib.Marker({ element: wrapper, anchor: "center" }).setLngLat([
      pill.point.lng,
      pill.point.lat,
    ]);
    marker.addTo(map);
    return { marker, wrapper, button };
  };

  const update: CountPillsHandle["update"] = (pills, selectedId) => {
    const keep = new Set(pills.map((p) => p.areaId));
    for (const [areaId, at] of drawn) {
      if (keep.has(areaId)) continue;
      at.marker.remove();
      drawn.delete(areaId);
    }
    for (const pill of pills) {
      let at = drawn.get(pill.areaId);
      if (!at) {
        at = create(pill);
        drawn.set(pill.areaId, at);
      }
      paint(pill, pill.areaId === selectedId, at);
    }
  };

  update(initial, initialSelected);

  return {
    update,
    clear: () => {
      for (const at of drawn.values()) at.marker.remove();
      drawn.clear();
    },
  };
}
