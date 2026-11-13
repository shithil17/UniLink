import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { MapControlButton } from "./MapControlButton";

/** Only where a real pointer exists; touch screens pinch. */
const POINTER_ONLY = "[@media(hover:hover)_and_(pointer:fine)]:flex";

/**
 * The zoom in and out buttons of a map: one floating `surface` pill, hidden on touch screens. The
 * caller owns the map and does the zooming (`zoomBy`).
 */
export function MapZoom({
  onZoom,
  className,
}: {
  onZoom: (direction: 1 | -1) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden flex-col overflow-hidden rounded-full bg-surface shadow-float",
        POINTER_ONLY,
        className,
      )}
    >
      <MapControlButton aria-label="Zoom in" className="shadow-none" onClick={() => onZoom(1)}>
        <PlusIcon />
      </MapControlButton>
      <span aria-hidden className="mx-3 h-px bg-line" />
      <MapControlButton aria-label="Zoom out" className="shadow-none" onClick={() => onZoom(-1)}>
        <MinusIcon />
      </MapControlButton>
    </div>
  );
}
