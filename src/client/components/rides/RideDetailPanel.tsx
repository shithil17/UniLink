import { Badge } from "@/components/ui/badge";
import {
  priceLine,
  rideBadge,
  runsUntilLine,
  scheduleLine,
  seatsLine,
  VEHICLE_LABELS,
} from "@/lib/rides";
import { placeLine } from "@/lib/areas";
import type { RideSummary } from "../../../shared/schemas/rides";

/** One labelled row of the ride's facts, hairline-separated from the next. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-t border-line px-4 py-3 first:border-t-0">
      <dt className="text-[13px] leading-[1.4] text-faint">{label}</dt>
      <dd className="text-[15px] leading-[1.4] break-words text-ink">{children}</dd>
    </div>
  );
}

/**
 * The ride's facts on one flat panel: route, schedule in Asia/Dhaka, vehicle, seats left (or Full),
 * price and notes. Never a contact: those come from "Show contact".
 */
export function RideDetailPanel({ ride }: { ride: RideSummary }) {
  const runs = runsUntilLine(ride);
  // A held or turned-down ride says so in its status note above, and "Full" is in the seats line.
  const ended = rideBadge(ride) === "Ended";
  return (
    <section
      aria-label="The ride"
      className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]"
    >
      <dl>
        <Fact label="From">{placeLine(ride.pickupArea.name, ride.pickupLandmark)}</Fact>
        <Fact label="To">{placeLine(ride.destinationArea.name, ride.destinationLandmark)}</Fact>
        <Fact label={ride.kind === "one_off" ? "Departs" : "Leaves"}>
          {scheduleLine(ride)}
          {runs ? <span className="block text-[13px] text-soft">{runs}</span> : null}
        </Fact>
        <Fact label="Vehicle">{VEHICLE_LABELS[ride.vehicle]}</Fact>
        <Fact label="Seats">
          <span className="inline-flex flex-wrap items-center gap-2">
            {seatsLine(ride)}
            {ended ? <Badge>Ended</Badge> : null}
          </span>
        </Fact>
        <Fact label="Price">{priceLine(ride.pricePerSeatTaka)}</Fact>
        {ride.notes ? <Fact label="Notes">{ride.notes}</Fact> : null}
      </dl>
    </section>
  );
}
