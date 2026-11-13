import { ChevronRightIcon, MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus";

const row = "flex min-h-[60px] w-full items-center gap-3 rounded-row bg-tint px-4";

/**
 * The 60px row under a landmark field: "Pin the exact spot (optional)" opens the pin picker, and once
 * a spot is set it reads "Pinned" with Change and Remove. Both states are the same height, so
 * pinning never moves the form. The pin is optional: the area and the landmark say where without it.
 */
export function RidePinRow({
  kind,
  pinned,
  onPin,
  onRemove,
}: {
  kind: "pickup" | "destination";
  pinned: boolean;
  /** Opens the pin picker, to place the pin or to move it. */
  onPin: () => void;
  onRemove: () => void;
}) {
  if (!pinned) {
    return (
      <button
        type="button"
        onClick={onPin}
        className={`${row} cursor-pointer text-left text-[15px] font-medium text-ink outline-none active:bg-line ${focusRing}`}
      >
        <MapPinIcon aria-hidden className="size-5 shrink-0 text-soft" />
        <span className="min-w-0 flex-1">
          Pin the exact spot (optional)
          <span className="sr-only"> for the {kind}</span>
        </span>
        <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-faint" />
      </button>
    );
  }
  return (
    <div className={`${row} py-2 pr-2`}>
      <MapPinIcon aria-hidden className="size-5 shrink-0 fill-brand text-brand" />
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">Pinned</span>
      <Button variant="ghost" size="sm" aria-label={`Change the ${kind} pin`} onClick={onPin}>
        Change
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Remove the ${kind} pin`} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
