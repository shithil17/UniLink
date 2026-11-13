import { Maximize2Icon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/focus";
import { MapAttribution } from "./MapAttribution";
import { MapView, type MapStatus, type MapViewProps } from "./MapView";

export type MapPreviewProps = Pick<MapViewProps, "fitPoints" | "onMap"> & {
  /** What the button says it opens, for example "Open the map of this ride". */
  label: string;
  /** Opens the full-screen map. */
  onOpen: () => void;
  /**
   * False draws only the skeleton and keeps no map (and so no WebGL context) behind it. A screen
   * turns it off while its full-screen map is open, so there is only ever one live map.
   */
  active?: boolean;
  /** Sizes the panel. It must keep a fixed height; the default is the phone size. */
  className?: string;
};

/**
 * A map inside a screen: fixed height, a same-size skeleton while MapLibre loads, then the map fades
 * in. It does not pan, zoom or capture scroll, so it can sit in a scrolling page or a drag-to-dismiss
 * sheet. The whole panel is one button that opens the full-screen map, with an expand icon top right.
 * When the map cannot load, the button is disabled and the panel says so.
 */
export function MapPreview({
  label,
  onOpen,
  fitPoints,
  onMap,
  active = true,
  className,
}: MapPreviewProps) {
  const [status, setStatus] = useState<MapStatus>("loading");
  const unavailable = active && status === "unavailable";

  return (
    <button
      type="button"
      data-slot="map-preview"
      aria-label={label}
      disabled={unavailable}
      onClick={onOpen}
      className={cn(
        "relative block h-[180px] w-full overflow-hidden rounded-panel bg-track text-left outline-none md:rounded-[24px]",
        focusRing,
        className,
      )}
    >
      {active ? (
        <MapView
          label={label}
          interactive={false}
          fitPoints={fitPoints}
          onMap={onMap}
          onStatusChange={setStatus}
        />
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <MapAttribution links={false} className="absolute bottom-2 left-2" />
      {unavailable ? null : (
        <span
          aria-hidden
          className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-surface text-ink shadow-float"
        >
          <Maximize2Icon className="size-[18px]" />
        </span>
      )}
    </button>
  );
}
