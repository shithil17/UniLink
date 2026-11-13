export type MapLibreModule = typeof import("./maplibre");

let pending: Promise<MapLibreModule> | undefined;

/**
 * Loads MapLibre on first use and shares the one promise afterwards. A failed load (offline, a
 * stale chunk) is forgotten, so the next map to mount tries again.
 */
export function loadMapLibre(): Promise<MapLibreModule> {
  pending ??= import("./maplibre").catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
