import { Link } from "@tanstack/react-router";
import { MinusIcon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import { errorMessage } from "@/lib/api";
import {
  dayLabel,
  RIDE_EXPIRY_WORDS,
  seatsLine,
  useMarkFull,
  useRenewRide,
  useSetSeats,
} from "@/lib/rides";
import { toast } from "@/lib/toast";
import type { RideSummary } from "../../../shared/schemas/rides";

/**
 * What the poster can do with their own ride: change the seats left (one step at a time, or mark it
 * full), edit it, renew a recurring one, or delete it. Says in words when it disappears.
 */
export function RideOwnerActions({
  ride,
  onDeleted,
}: {
  ride: RideSummary;
  onDeleted: () => void;
}) {
  const setSeats = useSetSeats(ride.id);
  const markFull = useMarkFull(ride.id);
  const renew = useRenewRide(ride.id);
  const ended = ride.state === "expired";
  const busy = setSeats.isPending || markFull.isPending;

  const seatsTo = (n: number) =>
    setSeats.mutate(n, {
      onSuccess: (saved) => toast.success(seatsLine(saved)),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <section
      aria-label="Your ride"
      className="grid gap-4 rounded-panel bg-surface p-4 md:rounded-[24px]"
    >
      {ended ? null : (
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] leading-[1.3] font-semibold text-ink">Seats left</p>
              <p className="text-[13px] leading-[1.4] text-soft tabular-nums">
                {ride.seatsRemaining} of {ride.totalSeats}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="A seat was taken"
                disabled={busy || ride.seatsRemaining === 0}
                onClick={() => seatsTo(ride.seatsRemaining - 1)}
              >
                <MinusIcon aria-hidden strokeWidth={1.75} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="A seat is free again"
                disabled={busy || ride.seatsRemaining >= ride.totalSeats}
                onClick={() => seatsTo(ride.seatsRemaining + 1)}
              >
                <PlusIcon aria-hidden strokeWidth={1.75} />
              </Button>
            </div>
          </div>
          {ride.seatsRemaining > 0 ? (
            <Button
              variant="secondary"
              loading={markFull.isPending}
              disabled={busy}
              onClick={() =>
                markFull.mutate(undefined, {
                  onSuccess: () => toast.success("Marked as full."),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Mark as full
            </Button>
          ) : null}
        </div>
      )}

      <p className="text-[13px] leading-[1.4] text-soft">
        {RIDE_EXPIRY_WORDS[ride.kind]} {RIDE_EXPIRY_WORDS.deleted}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {ride.kind === "one_off" && ended ? null : (
          <Link
            to="/rides/$rideId/edit"
            params={{ rideId: String(ride.id) }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <PencilIcon aria-hidden strokeWidth={1.75} />
            Edit
          </Link>
        )}
        {ride.kind === "recurring" ? (
          <Button
            variant="outline"
            size="sm"
            loading={renew.isPending}
            onClick={() =>
              renew.mutate(undefined, {
                onSuccess: (saved) =>
                  toast.success(
                    saved.endsOn ? `Renewed. It runs until ${dayLabel(saved.endsOn)}.` : "Renewed.",
                  ),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            <RefreshCwIcon aria-hidden strokeWidth={1.75} />
            Renew
          </Button>
        ) : null}
        <DeletePostButton basePath="/api/rides" id={ride.id} what="ride" onDeleted={onDeleted} />
      </div>
    </section>
  );
}
