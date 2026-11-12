import type { ReactNode } from "react";
import { useMapParam } from "@/lib/map/useMapParam";
import { MapOverlay, type MapOverlayProps } from "./MapOverlay";
import { MapPreview, type MapPreviewProps } from "./MapPreview";

export type MapPanelProps = Pick<MapOverlayProps, "fitPoints" | "onMap" | "actions" | "footer"> & {
  /** Names this map in the URL (`?map=ride`); lowercase letters, digits and hyphens. */
  id: string;
  /** The map's accessible name once it is open. */
  label: string;
  /** What the preview button says it opens. */
  openLabel: string;
  /** Keeps the preview from holding a map while another full-screen map of the same screen is open. */
  pause?: boolean;
  /** Sizes the preview panel (its height must stay fixed). */
  previewClassName?: MapPreviewProps["className"];
  /** Laid over the full-screen map, for example the ride card. */
  children?: ReactNode;
};

/**
 * A preview and the full-screen map it opens, wired together: the preview opens the overlay by
 * pushing `?map=<id>`, and every way out of the overlay closes it through the same history step.
 * While the overlay is open the preview keeps no map of its own, so one screen never holds two live
 * maps. `onMap` and `fitPoints` apply to both.
 *
 * The route must keep the param: its `validateSearch` returns `map: parseMapParam(raw.map)`.
 */
export function MapPanel({
  id,
  label,
  openLabel,
  fitPoints,
  onMap,
  actions,
  footer,
  pause = false,
  previewClassName,
  children,
}: MapPanelProps) {
  const map = useMapParam(id);
  return (
    <>
      <MapPreview
        label={openLabel}
        onOpen={map.open}
        fitPoints={fitPoints}
        onMap={onMap}
        active={!map.isOpen && !pause}
        className={previewClassName}
      />
      <MapOverlay
        open={map.isOpen}
        onClose={map.close}
        label={label}
        fitPoints={fitPoints}
        onMap={onMap}
        actions={actions}
        footer={footer}
      >
        {children}
      </MapOverlay>
    </>
  );
}
