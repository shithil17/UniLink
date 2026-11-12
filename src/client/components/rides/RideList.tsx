import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import {
  priceLine,
  rideBadge,
  runsUntilLine,
  scheduleLine,
  seatsLine,
  VEHICLE_LABELS,
} from "@/lib/rides";
import type { RideSummary } from "../../../shared/schemas/rides";

/** An area in the row's title, with the poster's landmark after it in lighter type. */
function Place({ area, landmark }: { area: string; landmark: string | null }) {
  return (
    <span>
      {area}
      {landmark ? <span className="font-normal text-soft"> ({landmark})</span> : null}
    </span>
  );
}

/**
 * Rides as one flat panel of hairline-separated rows, each opening the detail. A ride here never
 * carries a contact; those come only after "Show contact" on the detail. On "My rides" a ride that is
 * held, turned down, full or ended says so in a badge.
 */
export function RideList({
  items,
  withBadge = false,
}: {
  items: RideSummary[];
  withBadge?: boolean;
}) {
  return (
    <ul className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]">
      {items.map((ride) => {
        // "Full" is already in the seats line, so the badge is for the other states.
        const badge = withBadge ? rideBadge(ride) : null;
        const runs = runsUntilLine(ride);
        return (
          <li key={ride.id} className="border-t border-line first:border-t-0">
            <Link
              to="/rides/$rideId"
              params={{ rideId: String(ride.id) }}
              className={`flex min-h-15 items-center gap-3 px-4 py-3 outline-none hover:bg-tint active:bg-tint ${focusRing} focus-visible:-outline-offset-2 ${press}`}
            >
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-[1.3] font-semibold break-words text-ink">
                  <Place area={ride.pickupArea.name} landmark={ride.pickupLandmark} />
                  <span className="sr-only">to</span>
                  <ArrowRightIcon
                    aria-hidden
                    strokeWidth={1.75}
                    className="size-4 shrink-0 text-faint"
                  />
                  <Place area={ride.destinationArea.name} landmark={ride.destinationLandmark} />
                </span>
                <span className="text-[13px] leading-[1.4] text-soft">
                  {scheduleLine(ride)}
                  {runs ? ` · ${runs}` : ""}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[1.4] text-soft">
                  <span>{VEHICLE_LABELS[ride.vehicle]}</span>
                  <span aria-hidden>·</span>
                  <span>{priceLine(ride.pricePerSeatTaka)}</span>
                  <span aria-hidden>·</span>
                  <span>{seatsLine(ride)}</span>
                  {badge && badge !== "Full" ? <Badge>{badge}</Badge> : null}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-faint" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
