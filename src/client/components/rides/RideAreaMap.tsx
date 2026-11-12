import type { Map as MapLibreMap } from "maplibre-gl";
import { Maximize2Icon, SlidersHorizontalIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { MapAttribution } from "@/components/map/MapAttribution";
import { MapControlButton } from "@/components/map/MapControlButton";
import { MapOverlay } from "@/components/map/MapOverlay";
import { MapView, type MapViewProps } from "@/components/map/MapView";
import { MapZoom } from "@/components/map/MapZoom";
import { RideFilterSheet } from "@/components/rides/RideFilters";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { Skeleton } from "@/components/ui/skeleton";
import { zoomBy } from "@/lib/map/camera";
import { drawCountPills, type CountPill, type CountPillsHandle } from "@/lib/map/counts";
import {
  AREA_END_LABELS,
  areaCardLine,
  nearbyLine,
  offMapLabel,
  type RideAreaMapModel,
} from "@/lib/rideAreaMap";
import type { RideFilters } from "@/lib/rides";
import type { RideAreaEnd } from "../../../shared/schemas/rides";

const MAP_LABEL = "Map of rides by area";

/**
 * Keeps the count pills on whichever map is showing. Returns the `onMap` to hand to the map: it draws
 * the pills when the style loads (and again after a palette restyle), and a change in the counts or
 * the selection updates them in place, so a pill that has focus keeps it.
 */
function useCountMarkers(
  pills: readonly CountPill[],
  selectedId: number | null,
  onSelect: (areaId: number) => void,
): NonNullable<MapViewProps["onMap"]> {
  const handle = useRef<CountPillsHandle | null>(null);
  const latest = useRef({ pills, selectedId, onSelect });
  useEffect(() => {
    latest.current = { pills, selectedId, onSelect };
    handle.current?.update(pills, selectedId);
  }, [pills, selectedId, onSelect]);

  return useCallback((map, lib) => {
    const drawn = drawCountPills(map, lib, latest.current.pills, latest.current.selectedId, (id) =>
      latest.current.onSelect(id),
    );
    handle.current = drawn;
    return () => {
      drawn.clear();
      if (handle.current === drawn) handle.current = null;
    };
  }, []);
}

/** Leaving from / Going to: two equal halves floating on the map, so switching never resizes it. */
function AreaEndSwitch({
  by,
  onChange,
  className,
}: {
  by: RideAreaEnd;
  onChange: (by: RideAreaEnd) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Count rides by"
      className={cn(
        "inline-grid grid-cols-2 gap-1 rounded-full bg-surface p-1 shadow-float",
        className,
      )}
    >
      {(["pickup", "destination"] as const).map((end) => (
        <button
          key={end}
          type="button"
          aria-pressed={by === end}
          onClick={() => onChange(end)}
          className={cn(
            `relative min-h-9 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap outline-none after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] ${press} ${focusRing}`,
            by === end ? "bg-brand-soft text-brand-ink" : "text-soft",
          )}
        >
          {AREA_END_LABELS[end]}
        </button>
      ))}
    </div>
  );
}

const floatingPill =
  "inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-[13px] font-semibold shadow-float";

/**
 * The line floating at the bottom of the map. It is always rendered (so nothing around it moves):
 * "Loading counts" while the first counts come, "No rides match" when there are none, otherwise the
 * "Not on the map: N rides" chip for rides in areas with no point, which opens the list.
 */
function AreaMapStatus({ model, onOpenList }: { model: RideAreaMapModel; onOpenList: () => void }) {
  const empty = model.pills.length === 0 && model.offMap === 0;
  return (
    <div role="status" aria-busy={model.loading} className="flex min-h-11 justify-center">
      {model.loading ? (
        <span className={cn(floatingPill, "text-soft")}>Loading counts</span>
      ) : empty ? (
        <span className={cn(floatingPill, "text-soft")}>No rides match</span>
      ) : model.offMap > 0 ? (
        <button
          type="button"
          onClick={onOpenList}
          className={cn(
            floatingPill,
            `pointer-events-auto text-ink outline-none ${press} ${focusRing}`,
          )}
        >
          {offMapLabel(model.offMap)}
        </button>
      ) : null}
    </div>
  );
}

/**
 * From `lg`: the map in the sticky right column, filling its height and interactive in place. A pill
 * filters the list beside it (the route sets `from` or `to`) and shows selected; the expand button
 * opens the same map full screen, and while that is open `paused` keeps this one from holding a
 * second map.
 */
export function RideAreaColumn({
  model,
  selectedId,
  onSelect,
  onExpand,
  onOpenList,
  paused,
}: {
  model: RideAreaMapModel;
  /** The pill the list is filtered to, if any. */
  selectedId: number | null;
  onSelect: (areaId: number) => void;
  onExpand: () => void;
  onOpenList: () => void;
  paused: boolean;
}) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawPills = useCountMarkers(model.pills, selectedId, onSelect);
  const onMap: NonNullable<MapViewProps["onMap"]> = (map, lib) => {
    mapRef.current = map;
    const undraw = drawPills(map, lib);
    return () => {
      undraw?.();
      mapRef.current = null;
    };
  };

  return (
    <div
      data-slot="ride-area-column"
      className="relative h-[calc(100dvh-4.5rem)] overflow-hidden rounded-[24px] bg-track"
    >
      {paused ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : (
        <MapView label={MAP_LABEL} interactive onMap={onMap} />
      )}
      <AreaEndSwitch
        by={model.by}
        onChange={model.setBy}
        className="absolute top-3 left-1/2 z-10 -translate-x-1/2"
      />
      <MapControlButton
        aria-label="Open the map full screen"
        className="absolute top-3 right-3 z-10"
        onClick={onExpand}
      >
        <Maximize2Icon />
      </MapControlButton>
      <div className="pointer-events-none absolute inset-x-3 bottom-[3.75rem] z-10">
        <AreaMapStatus model={model} onOpenList={onOpenList} />
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-2">
        <MapAttribution links className="pointer-events-auto" />
        <MapZoom
          className="pointer-events-auto"
          onZoom={(direction) => mapRef.current && zoomBy(mapRef.current, direction)}
        />
      </div>
    </div>
  );
}

/** What a tapped pill opens: how many rides leave from (or arrive at) the area, and a button to the list. */
function AreaCard({ pill, by, onShow }: { pill: CountPill; by: RideAreaEnd; onShow: () => void }) {
  return (
    <div
      data-slot="area-card"
      className="grid gap-3 rounded-panel bg-surface p-4 shadow-float md:rounded-[24px]"
    >
      <div aria-live="polite" className="grid gap-0.5">
        <p className="text-[15px] leading-[1.4] font-semibold text-ink">
          {areaCardLine(pill.name, pill.count, by)}
        </p>
        {/* Always rendered, one line tall, so the card never changes size between areas. */}
        <p className="min-h-[1.125rem] text-[13px] leading-[1.4] text-soft">
          {nearbyLine(pill.nearby)}
        </p>
      </div>
      <Button onClick={onShow}>Show these rides</Button>
    </div>
  );
}

const topInset = "top-[max(0.75rem,env(safe-area-inset-top))]";

/**
 * The full-screen Map view: below `lg` it is the Map view itself, and from `lg` it is what the expand
 * button opens. A floating Filters button opens the filter sheet above the map, the Leaving from /
 * Going to switch floats top centre, and a tapped pill opens a card at the bottom whose button hands
 * the area to `onShowRides` (the route closes the map and filters the list).
 */
export function RideAreaOverlay({
  open,
  onClose,
  model,
  filters,
  onFilters,
  onShowRides,
  onOpenList,
}: {
  open: boolean;
  onClose: () => void;
  model: RideAreaMapModel;
  filters: RideFilters;
  onFilters: (patch: Partial<RideFilters>) => void;
  onShowRides: (areaId: number) => void;
  onOpenList: () => void;
}) {
  const [cardId, setCardId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A map that closes forgets its card and sheet (reset while rendering, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setCardId(null);
      setFiltersOpen(false);
    }
  }

  const select = useCallback((id: number) => setCardId((c) => (c === id ? null : id)), []);
  const onMap = useCountMarkers(model.pills, cardId, select);
  const card = model.pills.find((p) => p.areaId === cardId);

  return (
    <MapOverlay
      open={open}
      onClose={onClose}
      label={MAP_LABEL}
      onMap={onMap}
      footer={
        <div className="grid gap-2">
          <AreaMapStatus model={model} onOpenList={onOpenList} />
          {card ? (
            <AreaCard pill={card} by={model.by} onShow={() => onShowRides(card.areaId)} />
          ) : null}
        </div>
      }
    >
      <AreaEndSwitch
        by={model.by}
        onChange={model.setBy}
        className={cn("absolute left-1/2 z-10 -translate-x-1/2", topInset)}
      />
      <MapControlButton
        aria-label="Filters"
        aria-haspopup="dialog"
        className={cn("absolute right-[max(0.75rem,env(safe-area-inset-right))] z-10", topInset)}
        onClick={() => setFiltersOpen(true)}
      >
        <SlidersHorizontalIcon />
      </MapControlButton>
      <RideFilterSheet
        raised
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onApply={onFilters}
      />
    </MapOverlay>
  );
}
