import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { RideDetail } from "../../shared/schemas/rides";
import { areasQuery } from "./areas";
import { rideDetailQuery } from "./rides";
import { tripOf, type Trip } from "./map/trip";

/**
 * The trip a ride shows on a map: its exact pins, and the area points for ends with none. Null while
 * the area list that an end needs is loading, or when no end has a point. The area list is only
 * fetched when an end needs it, and not at all while `enabled` is false.
 */
export function useRideTrip(ride: RideDetail | undefined, enabled = true): Trip | null {
  const needsAreas = enabled && ride !== undefined && (!ride.pickupPoint || !ride.destinationPoint);
  const areas = useQuery({ ...areasQuery, enabled: needsAreas });
  const loading = needsAreas && areas.isPending;
  return useMemo(() => {
    if (!enabled || !ride || loading) return null;
    const trip = tripOf(
      {
        pickup: {
          point: ride.pickupPoint ?? null,
          areaId: ride.pickupArea.id,
          areaName: ride.pickupArea.name,
        },
        destination: {
          point: ride.destinationPoint ?? null,
          areaId: ride.destinationArea.id,
          areaName: ride.destinationArea.name,
        },
      },
      areas.data,
    );
    return trip.pickup || trip.destination ? trip : null;
  }, [enabled, ride, loading, areas.data]);
}

/** The trip of the ride with this id (it shares the detail's cached query), for a map behind the detail. */
export function useRideIdTrip(rideId: number | null): Trip | null {
  const detail = useQuery({
    ...rideDetailQuery(rideId ?? 0),
    enabled: rideId !== null,
    placeholderData: keepPreviousData,
  });
  return useRideTrip(rideId === null ? undefined : detail.data);
}
