import type { Map as MapLibreMap } from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { MapControlButton } from "@/components/map/MapControlButton";
import { MapOverlay } from "@/components/map/MapOverlay";
import { MapStage } from "@/components/map/MapStage";
import { RideAreaLayers, type AreaLayer } from "@/components/rides/RideAreaLayers";
import { RideFilterSheet } from "@/components/rides/RideFilters";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { areaNameOf, areasQuery } from "@/lib/areas";
import { fitToPoints, flyToPoint } from "@/lib/map/camera";
import { drawCountPills, type CountPill, type CountPillsHandle } from "@/lib/map/counts";
import { MAP_INSET } from "@/lib/map/inset";
import type { MapLibreModule } from "@/lib/map/load";
import { drawTrip, tripPoints, type Trip } from "@/lib/map/trip";
import {
  AREA_END_LABELS,
  areaCardLine,
  layerPadding,
  nearbyLine,
  offMapLabel,
  type RideAreaMapModel,
} from "@/lib/rideAreaMap";
import { useRideIdTrip } from "@/lib/rideTrip";
import type { RideFilters } from "@/lib/rides";
import type { GeoPoint } from "../../../shared/geo";
import type { RideAreaEnd } from "../../../shared/schemas/rides";

const MAP_LABEL = "Map of rides by area";

/**
 * What the one map draws. Normally the count pills, updated in place so a pill that has focus keeps
 * it. While a ride's detail is open (`detail`) the pills go and the ride's pins, "Around ..." circles
 * and dashed line take their place, and the camera fits that ride clear of what covers the map (the
 * sheet or the docked panel); when the detail closes the pills come back and the camera returns to
 * where the student left it. Returns the `onMap` for the map: it draws when the style loads and again
 * after a palette restyle, which drops what was drawn.
 */
function useAreaMapMarkers({
  pills,
  selectedId,
  onSelect,
  detail,
  trip,
  wide,
}: {
  pills: readonly CountPill[];
  selectedId: number | null;
  onSelect: (areaId: number) => void;
  detail: boolean;
  trip: Trip | null;
  wide: boolean;
}): (map: MapLibreMap, lib: MapLibreModule) => () => void {
  const at = useRef<{ map: MapLibreMap; lib: MapLibreModule } | null>(null);
  const pillsDrawn = useRef<CountPillsHandle | null>(null);
  const tripDrawn = useRef<(() => void) | null>(null);
  const latest = useRef({ pills, selectedId, onSelect, detail, trip, wide });
  // What the markers on the map were drawn for, so a change in the counts alone updates in place.
  const drawnFor = useRef<{ detail: boolean; trip: Trip | null } | null>(null);
  // The trip the camera was last fitted to, and where it was before that.
  const framed = useRef<Trip | null>(null);
  const before = useRef<{ center: GeoPoint; zoom: number } | null>(null);

  const clear = useCallback(() => {
    pillsDrawn.current?.clear();
    pillsDrawn.current = null;
    tripDrawn.current?.();
    tripDrawn.current = null;
  }, []);

  const draw = useCallback(() => {
    const map = at.current;
    if (!map) return;
    clear();
    const now = latest.current;
    drawnFor.current = { detail: now.detail, trip: now.trip };
    if (now.detail) {
      if (now.trip) tripDrawn.current = drawTrip(map.map, map.lib, now.trip);
    } else {
      pillsDrawn.current = drawCountPills(map.map, map.lib, now.pills, now.selectedId, (id) =>
        latest.current.onSelect(id),
      );
    }
  }, [clear]);

  const frame = useCallback(() => {
    const map = at.current?.map;
    if (!map) return;
    const now = latest.current;
    const target = now.detail ? now.trip : null;
    if (target === framed.current) return;
    framed.current = target;
    if (target) {
      before.current ??= { center: map.getCenter(), zoom: map.getZoom() };
      fitToPoints(map, tripPoints(target), layerPadding(now.wide));
    } else if (before.current) {
      flyToPoint(map, before.current.center, before.current.zoom);
      before.current = null;
    }
  }, []);

  useEffect(() => {
    latest.current = { pills, selectedId, onSelect, detail, trip, wide };
    const same = drawnFor.current?.detail === detail && drawnFor.current.trip === trip;
    if (same) pillsDrawn.current?.update(pills, selectedId);
    else draw();
    frame();
  }, [pills, selectedId, onSelect, detail, trip, wide, draw, frame]);

  return useCallback(
    (map, lib) => {
      at.current = { map, lib };
      draw();
      frame();
      return () => {
        clear();
        drawnFor.current = null;
        if (at.current?.map === map) at.current = null;
      };
    },
    [draw, frame, clear],
  );
}

/** Leaving from / Going to: two equal halves floating on the map, so switching never resizes it. */
function AreaEndSwitch({
  by,
  onChange,
  disabled = false,
  className,
}: {
  by: RideAreaEnd;
  onChange: (by: RideAreaEnd) => void;
  /** Held while a layer shows one direction's rides, so the pills and the rides never disagree. */
  disabled?: boolean;
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
          disabled={disabled}
          onClick={() => onChange(end)}
          className={cn(
            `relative min-h-9 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap outline-none after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] disabled:opacity-60 ${press} ${focusRing}`,
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

const topInset = MAP_INSET.top;
/** Room the docked panels take on the right from `lg` (24rem and 12px either side), kept clear by the controls. */
const DOCK_CLEARANCE = "pr-[25.5rem]";
/** The switch centred on the map that is left of the panels. */
const DOCK_CENTRE = "left-[calc((100%-24.75rem)/2)]";

/**
 * The Map view: ride counts per area on one map, and the layers a tapped count opens. Below `lg` it
 * is a full-screen map (`mode="overlay"`, open while the Map view is, so Back returns to the list);
 * from `lg` it fills the content area under the filter bar (`mode="inline"`, no dialog and no scrim).
 *
 * A tapped pill opens a card ("Show these rides") that opens the area's rides over the map (a bottom
 * sheet, or a docked panel on the right from `lg`), and a ride in them opens its detail over those.
 * The route owns the layers (`area` and `ride` search params, one history step each); the map stays
 * the same live map throughout and draws the open ride behind the detail.
 */
export function RideAreaMap({
  mode,
  open = true,
  onClose,
  model,
  filters,
  onFilters,
  onOpenList,
  area,
  detailId,
  onShowRides,
  onOpenRide,
  onCloseArea,
  onCloseDetail,
  onDeleted,
}: {
  mode: "overlay" | "inline";
  /** Overlay only: whether the full-screen map is open. */
  open?: boolean;
  /** Overlay only: every way out of the full-screen map. */
  onClose: () => void;
  model: RideAreaMapModel;
  filters: RideFilters;
  onFilters: (patch: Partial<RideFilters>) => void;
  onOpenList: () => void;
  /** The area whose rides are open, from the `area` param. */
  area: { by: RideAreaEnd; id: number } | null;
  /** The ride whose detail is open, from the `ride` param. */
  detailId: number | null;
  onShowRides: (areaId: number) => void;
  onOpenRide: (id: number) => void;
  onCloseArea: () => void;
  onCloseDetail: () => void;
  onDeleted: () => void;
}) {
  const wide = mode === "inline";
  // A screen that opens on an area's rides starts with that area's pill selected.
  const [cardId, setCardId] = useState<number | null>(area?.id ?? null);
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

  // Another pill while the rides are open (from `lg`, where the map stays in reach) leaves them.
  const select = useCallback(
    (id: number) => {
      if (area) onCloseArea();
      setCardId((c) => (c === id ? null : id));
    },
    [area, onCloseArea],
  );
  const trip = useRideIdTrip(detailId);
  const onMap = useAreaMapMarkers({
    pills: model.pills,
    selectedId: cardId,
    onSelect: select,
    detail: detailId !== null,
    trip,
    wide,
  });
  const card = model.pills.find((p) => p.areaId === cardId);

  const areas = useQuery(areasQuery);
  const pill =
    area && model.by === area.by ? model.pills.find((p) => p.areaId === area.id) : undefined;
  const layer: AreaLayer | null = area
    ? {
        by: area.by,
        id: area.id,
        name: pill?.name ?? areaNameOf(areas.data, area.id) ?? "this area",
        count: pill?.count,
        nearby: pill?.nearby ?? 0,
      }
    : null;
  const docked = wide && (area !== null || detailId !== null);

  const footer =
    detailId === null ? (
      <div className="mx-auto grid w-full max-w-md gap-2">
        <AreaMapStatus model={model} onOpenList={onOpenList} />
        {card ? (
          <AreaCard pill={card} by={model.by} onShow={() => onShowRides(card.areaId)} />
        ) : null}
      </div>
    ) : null;
  const children = (
    <>
      <AreaEndSwitch
        by={model.by}
        onChange={model.setBy}
        disabled={area !== null || detailId !== null}
        className={cn("absolute left-1/2 z-10 -translate-x-1/2", topInset, docked && DOCK_CENTRE)}
      />
      {wide ? null : (
        <>
          <MapControlButton
            aria-label="Filters"
            aria-haspopup="dialog"
            className={cn(
              "absolute right-[max(0.75rem,env(safe-area-inset-right))] z-10",
              topInset,
            )}
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
        </>
      )}
      <RideAreaLayers
        wide={wide}
        area={layer}
        detailId={detailId}
        filters={filters}
        onOpenRide={onOpenRide}
        onCloseArea={onCloseArea}
        onCloseDetail={onCloseDetail}
        onDeleted={onDeleted}
      />
    </>
  );

  if (mode === "overlay") {
    return (
      <MapOverlay open={open} onClose={onClose} label={MAP_LABEL} onMap={onMap} footer={footer}>
        {children}
      </MapOverlay>
    );
  }
  return (
    <div
      data-slot="ride-area-map"
      className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] bg-track"
    >
      <MapStage
        label={MAP_LABEL}
        onMap={onMap}
        footer={footer}
        controlsClassName={docked ? DOCK_CLEARANCE : undefined}
      >
        {children}
      </MapStage>
    </div>
  );
}
