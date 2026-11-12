import { useState, type ReactNode, type RefObject } from "react";
import { CarIcon } from "lucide-react";
import { RideDetail } from "@/components/rides/RideDetail";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * From this width the rides screen is a list with the open ride beside it. Below it the ride opens in
 * a bottom sheet. It is `lg`, not `md`: with the 240px sidebar open, `md` leaves a 464px column, too
 * narrow for a list and a ride side by side. Keep it in step with the `lg:` classes in the screen.
 */
export const RIDE_SPLIT_QUERY = "(min-width: 64rem)";

/**
 * Where the open ride shows, chosen by the URL: no ride, an empty prompt (or the Map view's map) on wide
 * screens and nothing on phones; a ride, the side panel on wide screens and a bottom sheet over the list on phones. The
 * list underneath stays mounted either way, so its scroll, filters and loaded pages are kept.
 *
 * The sheet is controlled by the route and remembers the last ride, so its content stays put while
 * it slides away. `onClose` runs when it is dismissed (close button, drag, Escape, scrim).
 */
export function RideDetailHost({
  rideId,
  wide,
  returnFocusTo,
  onClose,
  onDeleted,
  wideEmpty,
}: {
  rideId: string | undefined;
  wide: boolean;
  /** The list row that opened the ride; the sheet hands focus back to it when it closes. */
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  onDeleted: () => void;
  /** What the side panel shows while no ride is open, instead of the prompt: the Map view's map. */
  wideEmpty?: ReactNode;
}) {
  const [lastRideId, setLastRideId] = useState(rideId);
  if (rideId && rideId !== lastRideId) setLastRideId(rideId);

  if (wide) {
    return (
      <aside
        aria-label="Ride details"
        className="sticky top-9 -mx-1 max-h-[calc(100dvh-4.5rem)] min-w-0 self-start overflow-y-auto px-1"
      >
        {rideId ? (
          <RideDetail rideId={rideId} onClose={onClose} onDeleted={onDeleted} />
        ) : (
          (wideEmpty ?? (
            <div className="overflow-hidden rounded-[24px] bg-surface">
              <EmptyState
                icon={CarIcon}
                title="Pick a ride to see the details"
                description="Its facts and the poster's contact open here."
                className="py-16"
              />
            </div>
          ))
        )}
      </aside>
    );
  }

  return (
    <Sheet open={rideId !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        finalFocus={returnFocusTo}
        className="bg-app **:data-[slot=sheet-handle]:bg-app"
      >
        {lastRideId ? (
          <RideDetail inSheet rideId={lastRideId} onClose={onClose} onDeleted={onDeleted} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
