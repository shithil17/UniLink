import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { AreaOption } from "../../shared/schemas/areas";
import type { RideAreaCounts, RideAreaEnd } from "../../shared/schemas/rides";
import { areaNameOf, areaPointOf, areasQuery } from "./areas";
import { errorMessage } from "./api";
import { FIT_PADDING, type FitPadding } from "./map/camera";
import { rideCount, type CountPill } from "./map/counts";
import { rideAreaCountsQuery, type RideFilters } from "./rides";
import { toast } from "./toast";

/** The Map view's two ways to count: where rides leave from, or where they go. */
export const AREA_END_LABELS: Record<RideAreaEnd, string> = {
  pickup: "Leaving from",
  destination: "Going to",
};

/** "Jatrabari: 6 rides leaving", the line on the card a tapped pill opens. */
export const areaCardLine = (name: string, count: number, by: RideAreaEnd): string =>
  `${name}: ${rideCount(count)} ${by === "pickup" ? "leaving" : "arriving"}`;

/** "Leaving Jatrabari · 6 rides", the title of the rides layer. The count is left off until it is known. */
export const areaRidesTitle = (by: RideAreaEnd, name: string, count?: number): string =>
  `${by === "pickup" ? "Leaving" : "Going to"} ${name}${count === undefined ? "" : ` · ${rideCount(count)}`}`;

/** "Not on the map: 3 rides", the chip for rides in areas that have no point. */
export const offMapLabel = (count: number): string => `Not on the map: ${rideCount(count)}`;

/**
 * The card's second line. The list filter on an area also matches its sub-areas, so when some of
 * them have a pill of their own the list shows more rides than this pill counts. Empty when it does not.
 */
export const nearbyLine = (nearby: number): string =>
  nearby > 0
    ? `Includes rides in ${nearby} nearby ${nearby === 1 ? "sub-area" : "sub-areas"} in the list.`
    : "";

/** The area filter a pill sets: `from` when counting pickups, `to` when counting destinations. */
export const areaFilterKey = (by: RideAreaEnd): "from" | "to" => (by === "pickup" ? "from" : "to");

/**
 * Turns the counts into pills. An area is a pill when it has a point on the map; rides in an area
 * with none ("Outside Dhaka"), or in one that is no longer in the picker list (hidden since), are
 * added up as `offMap`. The server has already rolled a sub-area with no point of its own into its
 * parent, so each count is one area. Biggest counts first, so a draw order is stable.
 */
export function areaPills(
  areas: readonly AreaOption[],
  counts: RideAreaCounts["areas"],
): { pills: CountPill[]; offMap: number } {
  const pills: CountPill[] = [];
  let offMap = 0;
  for (const { areaId, count } of counts) {
    const point = areaPointOf(areas, areaId);
    const name = areaNameOf(areas, areaId);
    if (point && name) pills.push({ areaId, name, count, point, nearby: 0 });
    else offMap += count;
  }
  // A sub-area with its own point and its own count is a pill beside its parent's.
  const parentOf = new Map<number, number>();
  for (const top of areas) {
    for (const child of top.children) {
      if (child.lat !== null && child.lng !== null) parentOf.set(child.id, top.id);
    }
  }
  const byId = new Map(pills.map((p) => [p.areaId, p]));
  for (const pill of pills) {
    const parent = byId.get(parentOf.get(pill.areaId) ?? -1);
    if (parent) parent.nearby += 1;
  }
  pills.sort((a, b) => b.count - a.count || a.areaId - b.areaId);
  return { pills, offMap };
}

export type RideAreaMapModel = {
  by: RideAreaEnd;
  setBy: (by: RideAreaEnd) => void;
  pills: CountPill[];
  offMap: number;
  /** True until the first counts and the area list are both in. */
  loading: boolean;
};

/**
 * The Map view's data: the counts for the current vehicle, date and weekday filters and the
 * Leaving from / Going to choice (`initialBy` when the screen opens on an area's rides), as pills. It only fetches while `shown`, keeps the last pills up while
 * a new set loads, and toasts when the counts cannot be had.
 */
export function useRideAreaMap(
  filters: RideFilters,
  shown: boolean,
  initialBy: RideAreaEnd = "pickup",
): RideAreaMapModel {
  const [by, setBy] = useState<RideAreaEnd>(initialBy);
  const areas = useQuery({ ...areasQuery, enabled: shown });
  const counts = useQuery(rideAreaCountsQuery(filters, by, shown));

  const failed = counts.isError ? errorMessage(counts.error) : null;
  useEffect(() => {
    if (failed) toast.error(failed, { id: "ride-area-counts" });
  }, [failed]);

  const { pills, offMap } = useMemo(
    () =>
      areas.data && counts.data
        ? areaPills(areas.data, counts.data.areas)
        : { pills: [], offMap: 0 },
    [areas.data, counts.data],
  );
  return { by, setBy, pills, offMap, loading: shown && (areas.isPending || counts.isPending) };
}

/**
 * How much of the map the layers cover, so the map behind can be fitted to what is left. A phone
 * sheet is at most 60% of the screen tall (`max-h-[60dvh]` below), a docked panel from `lg` is 24rem
 * wide and 12px in from the right edge (`w-[24rem]`, `right-3` below). Keep these and the classes in step.
 */
const SHEET_MAX_HEIGHT = 0.6;
const DOCK_WIDTH_PX = 384 + 12;

/** Padding for fitting the map to a ride, keeping it clear of the sheet or panel that covers part of the map. */
export function layerPadding(wide: boolean): FitPadding {
  return wide
    ? { top: FIT_PADDING, left: FIT_PADDING, bottom: FIT_PADDING, right: DOCK_WIDTH_PX + 24 }
    : {
        top: FIT_PADDING,
        left: FIT_PADDING,
        right: FIT_PADDING,
        bottom: FIT_PADDING + Math.round(window.innerHeight * SHEET_MAX_HEIGHT),
      };
}
