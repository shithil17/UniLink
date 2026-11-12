import { useInfiniteQuery } from "@tanstack/react-query";
import { CarIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { RideDetail } from "@/components/rides/RideDetail";
import { RideList } from "@/components/rides/RideList";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SkeletonRows } from "@/components/ui/skeleton";
import { areaRidesTitle, nearbyLine } from "@/lib/rideAreaMap";
import { errorMessage } from "@/lib/api";
import { rideFeedInfinite, type RideFilters } from "@/lib/rides";
import type { RideAreaEnd } from "../../../shared/schemas/rides";

/** The rides layer: which area, which direction, and what the title and its note say. */
export type AreaLayer = {
  by: RideAreaEnd;
  id: number;
  name: string;
  /** The pill's count, once the counts are in. */
  count: number | undefined;
  /** Sub-areas with a pill of their own that the list also covers. */
  nearby: number;
};

/**
 * One area's live rides under the Map view's filters, in the feed's own list (same rows, same pages,
 * same dimming while a new set loads). The text search and the other end's area are left out, so the
 * rides here are the ones the pill counted. A row opens its ride through `onOpenRide`.
 */
function AreaRides({
  layer,
  filters,
  onOpenRide,
  titleAs: Title,
  titleClassName,
}: {
  layer: AreaLayer;
  filters: RideFilters;
  onOpenRide: (id: number) => void;
  titleAs: ElementType;
  titleClassName?: string;
}) {
  const end = layer.by === "pickup" ? { from: layer.id } : { to: layer.id };
  const list = useInfiniteQuery(
    rideFeedInfinite({ vehicle: filters.vehicle, date: filters.date, day: filters.day, ...end }),
  );
  const rides = list.data?.pages.flatMap((p) => p.items) ?? [];
  const note = nearbyLine(layer.nearby);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <Title className={titleClassName}>
          {areaRidesTitle(layer.by, layer.name, layer.count)}
        </Title>
        {note ? <p className="text-[13px] leading-[1.4] text-soft">{note}</p> : null}
      </div>
      {list.isPending || (list.isPlaceholderData && rides.length === 0) ? (
        <SkeletonRows rows={3} label="Loading rides" />
      ) : list.isError ? (
        <ErrorBlock
          title="Rides didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : rides.length === 0 ? (
        <div className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
          <EmptyState icon={CarIcon} title="No rides match." description="Try another filter." />
        </div>
      ) : (
        <div
          aria-busy={list.isPlaceholderData}
          className={`grid gap-4 transition-opacity duration-150 ${list.isPlaceholderData ? "opacity-60" : ""}`}
        >
          <RideList items={rides} onSelect={(ride) => onOpenRide(ride.id)} />
          {list.hasNextPage && !list.isPlaceholderData ? (
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show more
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const sheetTitle = "pr-11 text-balance break-words";
const panelTitle =
  "text-[22px] leading-[1.2] font-bold tracking-[-0.01em] text-balance break-words text-ink";
/** Phone sheets stop short of the top, so the map stays in view behind them. */
const SHEET_CLASS = "bg-app data-[side=bottom]:max-h-[60dvh] **:data-[slot=sheet-handle]:bg-app";

/**
 * A panel docked to the right of the map from `lg`: floating, inset from the edges, full height. It is
 * not a dialog (the map behind stays live), so it takes focus when it opens or becomes the top layer
 * again and closes on Escape from inside it. Stacked panels share one position; the lower one is
 * `inert` while another covers it, and stays mounted, so its scroll is kept.
 */
function DockedPanel({
  label,
  closeLabel,
  onClose,
  covered = false,
  backArrow = false,
  children,
}: {
  label: string;
  closeLabel: string;
  onClose: () => void;
  covered?: boolean;
  /** The content carries a back arrow that does what the close button would, so there is no close button. */
  backArrow?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!covered) ref.current?.focus({ preventScroll: true });
  }, [covered]);

  return (
    <section
      ref={ref}
      aria-label={label}
      tabIndex={-1}
      inert={covered}
      onKeyDown={(event) => {
        // Only keys pressed inside the panel itself: a dialog opened from it is portaled out and closes on its own.
        if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
          event.stopPropagation();
          onClose();
        }
      }}
      data-slot="docked-panel"
      className={`pointer-events-auto absolute inset-0 overflow-y-auto overscroll-contain rounded-[24px] bg-app p-4 shadow-float outline-none ${backArrow ? "" : "[&_h2]:pr-10"}`}
    >
      {backArrow ? null : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={closeLabel}
          className="absolute top-3 right-3 z-10"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      )}
      {children}
    </section>
  );
}

/**
 * The layers over the Map view, in order: an area's rides, and a ride's detail over them. Below `lg`
 * they are raised bottom sheets over the map, the detail stacked over the rides sheet (which stays
 * mounted underneath, so closing the detail returns to the list where it was scrolled); from `lg`
 * they are docked panels on the right. The detail never carries its own map (`noMap`): the one map
 * behind it draws the ride.
 *
 * Both are controlled by the route (`area`, `detailId`), and each remembers its last content so it
 * stays put while a sheet slides away.
 */
export function RideAreaLayers({
  wide,
  area,
  detailId,
  filters,
  onOpenRide,
  onCloseArea,
  onCloseDetail,
  onDeleted,
}: {
  wide: boolean;
  area: AreaLayer | null;
  detailId: number | null;
  filters: RideFilters;
  onOpenRide: (id: number) => void;
  onCloseArea: () => void;
  onCloseDetail: () => void;
  onDeleted: () => void;
}) {
  const [lastArea, setLastArea] = useState(area);
  if (area && area !== lastArea) setLastArea(area);
  const [lastDetail, setLastDetail] = useState(detailId);
  if (detailId !== null && detailId !== lastDetail) setLastDetail(detailId);
  const shownArea = area ?? lastArea;
  const shownDetail = detailId ?? lastDetail;
  // A detail opened over an area's rides gets a back arrow to them, held while it slides away so its
  // header never changes shape on the way out. A detail on its own (a reload) has nothing to go back to.
  const [backTo, setBackTo] = useState<string | null>(null);
  const wantBack = detailId === null ? backTo : (area?.name ?? null);
  if (wantBack !== backTo) setBackTo(wantBack);
  const back = backTo ? { label: `Back to ${backTo} rides`, onBack: onCloseDetail } : undefined;

  if (wide) {
    return (
      <div
        data-slot="area-layers"
        className="pointer-events-none absolute inset-y-3 right-3 z-20 w-[24rem]"
      >
        {area ? (
          <DockedPanel
            label="Rides in this area"
            closeLabel="Close the rides"
            onClose={onCloseArea}
            covered={detailId !== null}
          >
            <AreaRides
              layer={area}
              filters={filters}
              onOpenRide={onOpenRide}
              titleAs="h2"
              titleClassName={panelTitle}
            />
          </DockedPanel>
        ) : null}
        {detailId !== null ? (
          <DockedPanel
            label="Ride details"
            closeLabel="Close the ride"
            onClose={onCloseDetail}
            backArrow={back !== undefined}
          >
            <RideDetail
              back={back}
              noMap
              rideId={String(detailId)}
              onClose={onCloseDetail}
              onDeleted={onDeleted}
            />
          </DockedPanel>
        ) : null}
      </div>
    );
  }

  // Inside the rides sheet when it is open, so Escape and focus treat it as the layer above; on its
  // own when only a ride's detail is open (a reload on a ride).
  const detailSheet = (
    <Sheet open={detailId !== null} onOpenChange={(open) => !open && onCloseDetail()}>
      <SheetContent
        side="bottom"
        raised
        showCloseButton={back === undefined}
        className={SHEET_CLASS}
      >
        {shownDetail !== null ? (
          <RideDetail
            back={back}
            inSheet
            noMap
            rideId={String(shownDetail)}
            onClose={onCloseDetail}
            onDeleted={onDeleted}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      <Sheet open={area !== null} onOpenChange={(open) => !open && onCloseArea()}>
        <SheetContent side="bottom" raised className={SHEET_CLASS}>
          {shownArea ? (
            <div className="px-5">
              <AreaRides
                layer={shownArea}
                filters={filters}
                onOpenRide={onOpenRide}
                titleAs={SheetTitle}
                titleClassName={sheetTitle}
              />
            </div>
          ) : null}
          {detailSheet}
        </SheetContent>
      </Sheet>
      {area === null ? detailSheet : null}
    </>
  );
}
