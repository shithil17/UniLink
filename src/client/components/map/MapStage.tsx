import type { Map as MapLibreMap } from "maplibre-gl";
import { useRef, type ReactNode } from "react";
import { cn } from "cn";
import { zoomBy } from "@/lib/map/camera";
import { MapAttribution } from "./MapAttribution";
import { MapView, type MapViewProps } from "./MapView";
import { MapZoom } from "./MapZoom";

export type MapStageProps = Pick<MapViewProps, "fitPoints" | "onMap"> & {
  /** The map's accessible name. */
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
  /** The control that sits in the top-left corner (the close button), after `children` in tab order. */
  corner?: ReactNode;
  /** Extra classes for the stack along the bottom, for example padding to keep it clear of a docked panel. */
  controlsClassName?: string;
};

/** The same inset as padding, for the stack along the bottom. */
const PAD =
  "pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]";

/**
 * An interactive map with its floating controls: zoom bottom right (hidden on touch), `actions` above
 * it, the attribution bottom left and a `footer` card under them. It fills its parent, which must be
 * positioned and have a size. `MapOverlay` puts it in a dialog; a screen that gives the map its whole
 * content area uses it directly.
 */
export function MapStage({
  label,
  fitPoints,
  onMap,
  actions,
  footer,
  children,
  corner,
  controlsClassName,
}: MapStageProps) {
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
    <>
      <MapView label={label} interactive fitPoints={fitPoints} onMap={handleMap} />
      {children}
      {corner}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2",
          PAD,
          controlsClassName,
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
    </>
  );
}
