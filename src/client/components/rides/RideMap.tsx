import { useQuery } from "@tanstack/react-query";
import { TripMap } from "@/components/rides/TripMap";
import { Skeleton } from "@/components/ui/skeleton";
import { areasQuery } from "@/lib/areas";
import { tripOf } from "@/lib/map/trip";
import type { RideDetail } from "../../../shared/schemas/rides";

/**
 * The ride's map panel: the first panel under the title, above the facts, because "where" is the
 * first question. It shows both ends and the dashed line, and opens the full-screen ride map. An end
 * with no exact pin stands at its area's point as an "Around ..." circle, so the panel shows whenever
 * at least one end has a point; a ride with no point at all has no map panel, and the text facts below
 * say everything it knew. The area list is only fetched when an end needs it.
 *
 * It is 180px tall in the phone sheet and 240px in the side panel.
 */
export function RideMap({ ride, inSheet }: { ride: RideDetail; inSheet: boolean }) {
  const pickupPoint = ride.pickupPoint ?? null;
  const destinationPoint = ride.destinationPoint ?? null;
  const needsAreas = pickupPoint === null || destinationPoint === null;
  const areas = useQuery({ ...areasQuery, enabled: needsAreas });
  const size = inSheet ? "h-[180px]" : "h-60";

  // Held at its final size while the area list loads, so the facts below do not jump.
  if (needsAreas && areas.isPending) {
    return <Skeleton className={`${size} w-full rounded-panel md:rounded-[24px]`} />;
  }

  const trip = tripOf(
    {
      pickup: { point: pickupPoint, areaId: ride.pickupArea.id, areaName: ride.pickupArea.name },
      destination: {
        point: destinationPoint,
        areaId: ride.destinationArea.id,
        areaName: ride.destinationArea.name,
      },
    },
    areas.data,
  );
  if (!trip.pickup && !trip.destination) return null;

  return (
    <TripMap
      id="ride"
      trip={trip}
      label="Map of this ride"
      openLabel="Open the map of this ride"
      pickup={{ area: ride.pickupArea.name, landmark: ride.pickupLandmark }}
      destination={{ area: ride.destinationArea.name, landmark: ride.destinationLandmark }}
      directions
      previewClassName={size}
    />
  );
}
