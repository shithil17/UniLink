/**
 * The only module that imports MapLibre. It is reached through `loadMapLibre()` (a dynamic import),
 * so the library, its stylesheet and its worker end up in their own chunk that a screen without a
 * map never downloads.
 *
 * ceiling: about 300 KB gzipped for this chunk. Measured at 291 KB, and the library brings a 147 KB
 * (gzipped) worker and a 10 KB stylesheet with it. Revisit if the chunk grows by more than a quarter.
 */
import { Map, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Bundlers cannot find the worker next to the library, so it is pointed at once, here.
setWorkerUrl(workerUrl);

export { Map, Marker };
