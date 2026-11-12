import type { Map as MapLibreMap } from "maplibre-gl";
import { XIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { zoomBy } from "@/lib/map/camera";
import { MapAttribution } from "./MapAttribution";
import { MapControlButton } from "./MapControlButton";
import { MapView, type MapViewProps } from "./MapView";
import { MapZoom } from "./MapZoom";

export type MapOverlayProps = Pick<MapViewProps, "fitPoints" | "onMap"> & {
  open: boolean;
  /** Called for every way out: the close button, Escape, the scrim. Wire it to `useMapParam().close`. */
  onClose: () => void;
  /** The map's accessible name, also the dialog's. */
  label: string;
  /** Floating buttons stacked above the zoom buttons, bottom right: "Fit the ride", "Back to NSU". */
  actions?: ReactNode;
  /**
   * A floating card along the bottom (the ride card, the pin picker's bar). The attribution and the
   * buttons above ride on top of it, so nothing overlaps however tall it is.
   */
  footer?: ReactNode;
  /** Anything else laid over the map (a search field, a centre pin). The child positions itself. */
  children?: ReactNode;
};

/**
 * The safe-area-aware inset of a floating control from a viewport edge, never under 12px. Written out
 * in full: Tailwind only generates classes it can read as whole strings in the source.
 */
const INSET = {
  top: "top-[max(0.75rem,env(safe-area-inset-top))]",
  left: "left-[max(0.75rem,env(safe-area-inset-left))]",
} as const;
/** The same inset as padding, for the stack along the bottom. */
const PAD =
  "pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]";

/**
 * The full-screen map. On phones it covers the whole viewport, the floating tab bar included, and
 * keeps clear of the notch and home bar. From `md` it is a centered dialog over a scrim, 32px in from
 * the edges, with the desktop panel radius. It is an in-app overlay (not the Fullscreen API, which
 * iPhones do not offer a page). Tie `open` to the URL with `useMapParam` so every way out is one
 * history step and the screen underneath keeps its scroll and state.
 *
 * Controls are floating layers on `surface`: close top left, zoom bottom right (hidden on touch),
 * `actions` above the zoom, attribution bottom left. A `footer` card sits under them.
 */
export function MapOverlay({
  open,
  onClose,
  label,
  fitPoints,
  onMap,
  actions,
  footer,
  children,
}: MapOverlayProps) {
  const mapRef = useRef<MapLibreMap | null>(null);

  const handleMap: NonNullable<MapViewProps["onMap"]> = (map, lib) => {
    mapRef.current = map;
    const cleanup = onMap?.(map, lib);
    return () => {
      cleanup?.();
      mapRef.current = null;
    };
  };
  const zoom = (direction: 1 | -1) => {
    if (mapRef.current) zoomBy(mapRef.current, direction);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-60 max-md:hidden" />
        <DialogPrimitive.Popup
          data-slot="map-overlay"
          className={cn(
            "fixed inset-0 z-60 overflow-hidden bg-app outline-none md:inset-8 md:rounded-[24px]",
            "transition-opacity duration-200 ease-ui-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <MapView label={label} interactive fitPoints={fitPoints} onMap={handleMap} />
          {children}
          <DialogPrimitive.Close
            render={
              <MapControlButton
                aria-label="Close the map"
                className={cn("absolute z-10", INSET.top, INSET.left)}
              />
            }
          >
            <XIcon />
          </DialogPrimitive.Close>
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2",
              PAD,
            )}
          >
            <div className="flex items-end justify-between gap-2">
              <MapAttribution links className="pointer-events-auto" />
              <div className="pointer-events-auto flex flex-col items-end gap-2">
                {actions}
                <MapZoom onZoom={zoom} />
              </div>
            </div>
            {footer ? <div className="pointer-events-auto">{footer}</div> : null}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
