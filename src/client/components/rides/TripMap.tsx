import type { Map as MapLibreMap } from "maplibre-gl";
import { ExternalLinkIcon, ScanIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { MapControlButton } from "@/components/map/MapControlButton";
import { MapPanel, type MapPanelProps } from "@/components/map/MapPanel";
import { buttonVariants } from "@/components/ui/button";
import { placeLine } from "@/lib/areas";
import { fitToPoints } from "@/lib/map/camera";
import type { MapLibreModule } from "@/lib/map/load";
import { directionsUrl, drawTrip, tripPoints, type Trip } from "@/lib/map/trip";

/** What the card under the full-screen map says about one end: its area and the poster's landmark. */
export type TripCardEnd = { area: string | null; landmark: string | null };

function CardRow({ label, end }: { label: string; end: TripCardEnd }) {
  return (
    <div className="grid gap-0.5 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-[13px] leading-[1.4] text-faint">{label}</dt>
      <dd className="text-[15px] leading-[1.4] break-words text-ink">
        {end.area ? placeLine(end.area, end.landmark) : "Not picked yet"}
      </dd>
    </div>
  );
}

/**
 * The floating card at the bottom of the full-screen trip map: where it starts and where it ends,
 * with the landmarks, and "Open in Maps" when both ends have a point. The link hands both points to
 * Google Maps in a new tab; nothing is sent until it is tapped. (The distance joins this card when
 * the road route is stored.)
 */
function TripCard({
  trip,
  pickup,
  destination,
  directions,
}: {
  trip: Trip;
  pickup: TripCardEnd;
  destination: TripCardEnd;
  directions: boolean;
}) {
  const url = directions ? directionsUrl(trip) : null;
  return (
    <div
      data-slot="trip-card"
      className="grid gap-3 rounded-panel bg-surface p-4 shadow-float md:rounded-[24px]"
    >
      <dl>
        <CardRow label="Pickup" end={pickup} />
        <CardRow label="Destination" end={destination} />
      </dl>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          Open in Maps
          <ExternalLinkIcon aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

export type TripMapProps = {
  /** The `?map=` name of the full-screen map this preview opens. */
  id: string;
  trip: Trip;
  pickup: TripCardEnd;
  destination: TripCardEnd;
  /** Names the preview's button and the full-screen map. */
  openLabel: string;
  label: string;
  /** Adds "Open in Maps" to the card. */
  directions?: boolean;
  /** Keeps the preview from holding a map while a different full-screen map is open. */
  pause?: MapPanelProps["pause"];
  previewClassName?: string;
};

/**
 * A trip on a map: the preview that sits in a screen and the full-screen map it opens, both drawing
 * the same two pins and dashed line. The ride detail and the ride form both use it. When the trip
 * changes (a pin placed, an area picked) the markers and the view follow without remaking the map.
 */
export function TripMap({
  id,
  trip,
  pickup,
  destination,
  openLabel,
  label,
  directions = false,
  pause,
  previewClassName,
}: TripMapProps) {
  const points = tripPoints(trip);
  // The live map and what is drawn on it, so a changed trip can be redrawn in place.
  const live = useRef<{
    map: MapLibreMap;
    lib: MapLibreModule;
    clear: () => void;
  } | null>(null);
  const latest = useRef(trip);
  const tripKey = JSON.stringify(trip);

  const paint = (map: MapLibreMap, lib: MapLibreModule) => {
    live.current?.clear();
    live.current = { map, lib, clear: drawTrip(map, lib, latest.current) };
  };

  useEffect(() => {
    latest.current = trip;
    if (live.current) paint(live.current.map, live.current.lib);
    // Redraw when the trip's content changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey]);

  const onMap = (map: MapLibreMap, lib: MapLibreModule) => {
    paint(map, lib);
    return () => {
      live.current?.clear();
      live.current = null;
    };
  };

  return (
    <MapPanel
      id={id}
      label={label}
      openLabel={openLabel}
      fitPoints={points}
      onMap={onMap}
      pause={pause}
      previewClassName={previewClassName}
      actions={
        <MapControlButton
          size="sm"
          className="rounded-full"
          onClick={() => {
            if (live.current) fitToPoints(live.current.map, points);
          }}
        >
          <ScanIcon aria-hidden />
          Fit the ride
        </MapControlButton>
      }
      footer={
        <TripCard trip={trip} pickup={pickup} destination={destination} directions={directions} />
      }
    />
  );
}
