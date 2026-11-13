import type { Map as MapLibreMap } from "maplibre-gl";
import { MapPinOffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, type GeoPoint } from "../../../shared/geo";
import { fitToPoints, initialView, MAX_BOUNDS, prefersReducedMotion } from "@/lib/map/camera";
import { loadMapLibre, type MapLibreModule } from "@/lib/map/load";
import { buildMapStyle, readMapTokens } from "@/lib/map/style";

export type MapStatus = "loading" | "ready" | "unavailable";

export type MapViewProps = {
  /** The map's accessible name (full-screen maps read it; a preview's button carries its own). */
  label: string;
  /** Pan and zoom. Off for a preview, which must not capture touches or scroll. */
  interactive: boolean;
  /** Points to fit with padding. None: NSU at city zoom. A new set moves the map there. */
  fitPoints?: readonly GeoPoint[];
  /**
   * Called each time the map has a loaded style: once when it first loads and again after a palette
   * change reloads the style, which drops layers and sources added at runtime. Add markers, lines and
   * layers here. The returned function runs before the next call and when the map goes away.
   */
  onMap?: (map: MapLibreMap, lib: MapLibreModule) => void | (() => void);
  /** Reports loading, ready and unavailable, so a parent can disable what needs a working map. */
  onStatusChange?: (status: MapStatus) => void;
  className?: string;
};

/**
 * One MapLibre map that fills its parent (which must have a size). MapLibre loads on first mount, so
 * the screen around it renders first. The map sits over a same-size skeleton and fades in with
 * opacity only. It is held to `MAP_BOUNDS`, never rotates or tilts, restyles when the palette changes
 * and shows a still "unavailable" state when it cannot load (offline, no WebGL).
 */
export function MapView({
  label,
  interactive,
  fitPoints,
  onMap,
  onStatusChange,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  // The effect below runs once per attempt; it reads these through a ref so a new callback or
  // label never rebuilds the map.
  const fitKey = fitPoints?.map((p) => `${p.lat},${p.lng}`).join("|") ?? "";
  const latest = useRef({ onMap, onStatusChange, label, fitPoints, fitKey });
  useEffect(() => {
    latest.current = { onMap, onStatusChange, label, fitPoints, fitKey };
  });
  // The fit the map was last shown, so only a real change moves the camera.
  const appliedFit = useRef(fitKey);

  useEffect(() => {
    latest.current.onStatusChange?.(status);
  }, [status]);

  useEffect(() => {
    let disposed = false;
    let loaded = false;
    let cleanup: void | (() => void);
    let observer: MutationObserver | undefined;

    loadMapLibre()
      .then((lib) => {
        const container = containerRef.current;
        if (disposed || !container) return;
        const { fitPoints: points, label: name, fitKey: initialFit } = latest.current;
        appliedFit.current = initialFit;

        let map: MapLibreMap;
        try {
          map = new lib.Map({
            container,
            style: buildMapStyle(readMapTokens()),
            ...initialView(points),
            minZoom: MAP_MIN_ZOOM,
            maxZoom: MAP_MAX_ZOOM,
            maxBounds: MAX_BOUNDS,
            interactive,
            // We draw our own attribution so it is always open and readable in every palette.
            attributionControl: false,
            // North stays up: no rotating and no tilting, by any gesture.
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            maxPitch: 0,
            // Only set when reducing motion: MapLibre copies an explicit `undefined` over its 300 ms
            // default, and a missing fade duration turns every label's opacity into NaN (nothing drawn).
            ...(prefersReducedMotion() ? { fadeDuration: 0 } : {}),
          });
        } catch {
          // No WebGL (or it is blocked): the panel says so and the text facts stay.
          setStatus("unavailable");
          return;
        }
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.getCanvas().setAttribute("aria-label", name);

        map.on("style.load", () => {
          cleanup?.();
          cleanup = latest.current.onMap?.(map, lib);
        });
        map.once("load", () => {
          loaded = true;
          setStatus("ready");
        });
        map.on("error", (event) => {
          // A style or tile-set that cannot be fetched. A single missing tile (event.tile) is not
          // worth blanking a map that works.
          const { sourceId, tile } = event as { sourceId?: string; tile?: unknown };
          if (!loaded && sourceId && !tile) {
            setStatus("unavailable");
          }
        });

        // A palette change is a `data-theme` change on <html>; redraw with the new tokens. A full
        // reload (diff off) keeps `style.load` honest for anything the parent added.
        observer = new MutationObserver(() => {
          map.setStyle(buildMapStyle(readMapTokens()), { diff: false });
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
      })
      .catch(() => {
        if (!disposed) setStatus("unavailable");
      });

    return () => {
      disposed = true;
      observer?.disconnect();
      cleanup?.();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [attempt, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedFit.current === fitKey) return;
    appliedFit.current = fitKey;
    fitToPoints(map, latest.current.fitPoints ?? []);
  }, [fitKey]);

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div className={cn("absolute inset-0 bg-track", className)}>
      <div
        ref={containerRef}
        aria-hidden={interactive ? undefined : true}
        className={cn(
          "size-full transition-opacity duration-300 ease-ui-out motion-reduce:transition-none",
          "[&_.maplibregl-canvas:focus-visible]:outline-3 [&_.maplibregl-canvas:focus-visible]:-outline-offset-3 [&_.maplibregl-canvas:focus-visible]:outline-solid [&_.maplibregl-canvas:focus-visible]:outline-brand",
          status === "ready" ? "opacity-100" : "opacity-0",
          !interactive && "pointer-events-none",
        )}
      />
      {status === "loading" ? (
        <div role="status" aria-busy="true" className="absolute inset-0">
          <span className="sr-only">Loading the map</span>
          <Skeleton className="size-full rounded-none" />
        </div>
      ) : null}
      {status === "unavailable" ? (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-tint px-6 text-center"
        >
          <MapPinOffIcon aria-hidden className="size-6 text-faint" />
          <p className="text-[13px] leading-snug font-medium text-soft">
            {offline ? "Map unavailable offline" : "The map can't load right now"}
          </p>
          {interactive ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatus("loading");
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
