import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { MapControlButton } from "./MapControlButton";
import { MAP_INSET } from "@/lib/map/inset";
import { MapStage, type MapStageProps } from "./MapStage";

export type MapOverlayProps = Omit<MapStageProps, "corner" | "controlsClassName"> & {
  open: boolean;
  /** Called for every way out: the close button, Escape, the scrim. Wire it to `useMapParam().close`. */
  onClose: () => void;
  /** Called once the close transition has finished and the overlay (and its map) is gone. */
  onExited?: () => void;
};

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
  onExited,
  label,
  fitPoints,
  onMap,
  actions,
  footer,
  children,
}: MapOverlayProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(next) => !next && onExited?.()}
    >
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
          <MapStage
            label={label}
            fitPoints={fitPoints}
            onMap={onMap}
            actions={actions}
            footer={footer}
            corner={
              <DialogPrimitive.Close
                render={
                  <MapControlButton
                    aria-label="Close the map"
                    className={cn("absolute z-10", MAP_INSET.top, MAP_INSET.left)}
                  />
                }
              >
                <XIcon />
              </DialogPrimitive.Close>
            }
          >
            {children}
          </MapStage>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
