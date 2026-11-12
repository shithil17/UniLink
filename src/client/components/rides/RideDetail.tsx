import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CarIcon } from "lucide-react";
import { ReportButton } from "@/components/posts/ReportButton";
import { StatusNote } from "@/components/posts/StatusNote";
import { RideContact } from "@/components/rides/RideContact";
import { RideDetailPanel } from "@/components/rides/RideDetailPanel";
import { RideMap } from "@/components/rides/RideMap";
import { RideOwnerActions } from "@/components/rides/RideOwnerActions";
import { RideSafetyNotice } from "@/components/rides/RideSafetyNotice";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { directionsUrl } from "@/lib/map/trip";
import { useRideTrip } from "@/lib/rideTrip";
import { RIDE_REPORT_DESCRIPTION, rideDetailQuery } from "@/lib/rides";

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";
// The sheet's own title style comes from `SheetTitle`; the panel's heading repeats that scale.
const sheetTitle = "pr-11 text-balance break-words";
const panelTitle =
  "text-[22px] leading-[1.2] font-bold tracking-[-0.01em] text-balance break-words text-ink";

/** The same shape as the loaded facts panel, so the ride does not jump the layout when it arrives. */
function RideSkeleton() {
  return (
    <div role="status" aria-label="Loading the ride" className="grid gap-5">
      <div className={panel}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="grid gap-1.5 border-t border-line px-4 py-3 first:border-t-0">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
      </div>
      <Skeleton className="h-36 w-full rounded-panel md:rounded-[24px]" />
    </div>
  );
}

/**
 * One ride: its title, moderation status, facts, the poster's own controls or the contact and report
 * for everyone else, and, in a sheet, the safety notice. The one body behind the phone sheet and the wide-screen
 * side panel. In a sheet the title is the sheet's accessible title and leaves room for its close
 * button; in the panel it is a plain heading under the page's own.
 *
 * Switching to another ride keeps the last one on screen, dimmed and not tappable, until the new one
 * arrives (`keepPreviousData`), so the panel never flashes to a skeleton. The body is keyed on the
 * ride, so a revealed contact or a half-written report never carries over to the next one.
 * `onClose` leaves a ride that is gone; `onDeleted` runs after the poster deletes theirs.
 *
 * `noMap` leaves out the map preview, for a screen that already has a live map behind the detail (one
 * screen never holds two); "Open in Maps" then sits with the facts, where the preview's full-screen
 * card would have had it.
 */
export function RideDetail({
  rideId,
  inSheet = false,
  noMap = false,
  onClose,
  onDeleted,
}: {
  rideId: string;
  inSheet?: boolean;
  noMap?: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const id = /^\d+$/.test(rideId) ? Number(rideId) : 0;
  const detail = useQuery({
    ...rideDetailQuery(id),
    enabled: id > 0,
    placeholderData: keepPreviousData,
  });
  const gone = id === 0 || (detail.error instanceof ApiError && detail.error.status === 404);
  const ride = detail.data;
  const stale = detail.isPlaceholderData;
  const trip = useRideTrip(ride, noMap);
  const directions = noMap && trip ? directionsUrl(trip) : null;
  const heading = ride ? `${ride.pickupArea.name} to ${ride.destinationArea.name}` : "Ride";
  const Title = inSheet ? SheetTitle : "h2";

  return (
    <div className={`grid gap-5 ${inSheet ? "px-5" : ""}`}>
      <Title className={inSheet ? sheetTitle : panelTitle}>{heading}</Title>
      {gone ? (
        <div className={panel}>
          <EmptyState
            icon={CarIcon}
            title="This ride isn't available."
            description="It already left, or it was deleted or removed."
            action={
              <Button variant="outline" size="sm" onClick={onClose}>
                Back to rides
              </Button>
            }
          />
        </div>
      ) : detail.isPending ? (
        <RideSkeleton />
      ) : detail.isError ? (
        <ErrorBlock
          title="The ride didn't load"
          message={errorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isRefetching}
        />
      ) : ride ? (
        <div
          key={ride.id}
          aria-busy={stale}
          inert={stale}
          className={`grid gap-5 transition-opacity duration-150 ${stale ? "opacity-60" : ""}`}
        >
          {ride.mine ? (
            <StatusNote
              status={ride.status}
              what="ride"
              category={ride.rejectionCategory}
              appeal={{ targetType: "ride", id: ride.id }}
            />
          ) : null}
          {noMap ? null : <RideMap ride={ride} inSheet={inSheet} />}
          <RideDetailPanel ride={ride} directionsUrl={directions} />
          {ride.mine ? (
            <RideOwnerActions ride={ride} onDeleted={onDeleted} />
          ) : (
            <>
              <RideContact rideId={ride.id} />
              <ReportButton
                type="ride"
                id={ride.id}
                label="Report this ride"
                description={RIDE_REPORT_DESCRIPTION}
              />
            </>
          )}
          {/* The panel sits next to the list, which already says it; a sheet covers the list. */}
          {inSheet ? <RideSafetyNotice /> : null}
        </div>
      ) : null}
    </div>
  );
}
