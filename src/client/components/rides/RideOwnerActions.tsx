import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MinusIcon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import { errorMessage } from "@/lib/api";
import {
  dayLabel,
  RIDE_EXPIRY_WORDS,
  seatsTakenLine,
  useMarkFull,
  useRenewRide,
  useSetSeats,
} from "@/lib/rides";
import { toast } from "@/lib/toast";
import type { RideSummary } from "../../../shared/schemas/rides";

/**
 * What the poster can do with their own ride: set how many seats are taken (a draft the stepper
 * changes and Save sends once, or Mark as full in one tap), edit it, renew a recurring one, or delete
 * it. Save, Cancel and Mark as full are always there and only disabled, so nothing jumps. Says in
 * words when it disappears.
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

  // The stepper counts seats taken and only changes a draft; Save sends it as one request. The draft
  // starts at the saved count, follows the server while it is untouched, and starts over for another ride.
  const saved = ride.totalSeats - ride.seatsRemaining;
  const [draft, setDraft] = useState(saved);
  const [synced, setSynced] = useState({ id: ride.id, saved });
  if (synced.id !== ride.id || synced.saved !== saved) {
    if (synced.id !== ride.id || draft === synced.saved) setDraft(saved);
    setSynced({ id: ride.id, saved });
  }
  const changed = draft !== saved;

  const save = () =>
    setSeats.mutate(ride.totalSeats - draft, {
      onSuccess: (done) => {
        const taken = done.totalSeats - done.seatsRemaining;
        setDraft(taken);
        toast.success(seatsTakenLine(done.totalSeats, taken));
      },
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
              <p className="text-[15px] leading-[1.3] font-semibold text-ink">Seats taken</p>
              <p className="text-[13px] leading-[1.4] text-soft tabular-nums">
                {draft} of {ride.totalSeats}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="One seat freed up"
                disabled={busy || draft === 0}
                onClick={() => setDraft(draft - 1)}
              >
                <MinusIcon aria-hidden strokeWidth={1.75} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="One more seat taken"
                disabled={busy || draft >= ride.totalSeats}
                onClick={() => setDraft(draft + 1)}
              >
                <PlusIcon aria-hidden strokeWidth={1.75} />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy || !changed} onClick={() => setDraft(saved)}>
              Cancel
            </Button>
            <Button loading={setSeats.isPending} disabled={busy || !changed} onClick={save}>
              Save
            </Button>
          </div>
          <Button
            variant="secondary"
            loading={markFull.isPending}
            disabled={busy || ride.seatsRemaining === 0}
            onClick={() =>
              markFull.mutate(undefined, {
                onSuccess: (done) => {
                  setDraft(done.totalSeats - done.seatsRemaining);
                  toast.success("Marked as full.");
                },
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            Mark as full
          </Button>
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
