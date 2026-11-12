import type { Map as MapLibreMap } from "maplibre-gl";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { zoomBy } from "@/lib/map/camera";
import { MapAttribution } from "./MapAttribution";
import { MapControlButton } from "./MapControlButton";
import { MapView, type MapViewProps } from "./MapView";

export type MapOverlayProps = Pick<MapViewProps, "fitPoints" | "onMap"> & {
  open: boolean;
  /** Called for every way out: the close button, Escape, the scrim. Wire it to `useMapParam().close`. */
  onClose: () => void;
  /** The map's accessible name, also the dialog's. */
  label: string;
  /** Floating buttons stacked above the zoom buttons, bottom right: "Fit the ride", "Back to NSU". */
  actions?: ReactNode;
  /** Anything else laid over the map (a card, a search field). The child positions itself. */
  children?: ReactNode;
};

/** The safe-area-aware inset of a floating control from a viewport edge, never under 12px. */
const inset = (side: "top" | "right" | "bottom" | "left") =>
  `${side}-[max(0.75rem,env(safe-area-inset-${side}))]`;

/** Only where a real pointer exists; touch screens pinch. */
const POINTER_ONLY = "[@media(hover:hover)_and_(pointer:fine)]:flex";

/**
 * The full-screen map. On phones it covers the whole viewport, the floating tab bar included, and
 * keeps clear of the notch and home bar. From `md` it is a centered dialog over a scrim, 32px in from
 * the edges, with the desktop panel radius. It is an in-app overlay (not the Fullscreen API, which
 * iPhones do not offer a page). Tie `open` to the URL with `useMapParam` so every way out is one
 * history step and the screen underneath keeps its scroll and state.
 *
 * Controls are floating layers on `surface`: close top left, zoom bottom right (hidden on touch),
 * `actions` above the zoom, attribution bottom left.
 */
export function MapOverlay({
  open,
  onClose,
  label,
  fitPoints,
  onMap,
  actions,
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
                className={cn("absolute z-10", inset("top"), inset("left"))}
              />
            }
          >
            <XIcon />
          </DialogPrimitive.Close>
          <MapAttribution links className={cn("absolute z-10", inset("bottom"), inset("left"))} />
          <div
            className={cn(
              "absolute z-10 flex flex-col items-end gap-2",
              inset("bottom"),
              inset("right"),
            )}
          >
            {actions}
            <div
              className={cn(
                "hidden flex-col overflow-hidden rounded-full bg-surface shadow-float",
                POINTER_ONLY,
              )}
            >
              <MapControlButton
                aria-label="Zoom in"
                className="shadow-none"
                onClick={() => zoom(1)}
              >
                <PlusIcon />
              </MapControlButton>
              <span aria-hidden className="mx-3 h-px bg-line" />
              <MapControlButton
                aria-label="Zoom out"
                className="shadow-none"
                onClick={() => zoom(-1)}
              >
                <MinusIcon />
              </MapControlButton>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
