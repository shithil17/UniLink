/**
 * A stand-in for `@/lib/map/maplibre` in component tests: no WebGL, no network, no worker. Tests
 * mock the module with `vi.mock("@/lib/map/maplibre", () => import("@/test/fakeMapLibre"))`, then
 * read `Map.instances` for the options a map was created with and `calls` for what it was asked to do.
 */
type Handler = (event?: unknown) => void;

export class Map {
  static instances: Map[] = [];
  /** Make the next construction throw, like a browser with no WebGL. */
  static failNext = false;
  /** Make the loaded map report a source that cannot be fetched, like being offline. */
  static sourceError = false;
  /** Hold every map in its loading state until `Map.release()`, to look at the skeleton. */
  static hold = false;
  private static held: (() => void)[] = [];

  options: Record<string, unknown>;
  removed = false;
  calls: { method: string; args: unknown[] }[] = [];
  private handlers = new globalThis.Map<string, Handler[]>();
  private canvas = document.createElement("canvas");
  private center: { lng: number; lat: number };
  private zoomLevel: number;
  /** Sources and layers added at runtime, by id; a restyle (`setStyle`) drops them like MapLibre does. */
  sources = new globalThis.Map<string, unknown>();
  layers = new globalThis.Map<string, unknown>();
  touchZoomRotate = { disableRotation: () => this.record("touchZoomRotate.disableRotation") };
  keyboard = { disableRotation: () => this.record("keyboard.disableRotation") };

  constructor(options: Record<string, unknown>) {
    if (Map.failNext) {
      Map.failNext = false;
      throw new Error("WebGL is not available");
    }
    this.options = options;
    const [lng, lat] = (options.center as [number, number] | undefined) ?? centreOfBounds(options);
    this.center = { lng, lat };
    this.zoomLevel = (options.zoom as number | undefined) ?? 0;
    (options.container as HTMLElement).appendChild(this.canvas);
    Map.instances.push(this);
    const finish = () => {
      if (this.removed) return;
      if (Map.sourceError) {
        this.emit("error", { sourceId: "openmaptiles", error: new Error("Failed to fetch") });
        return;
      }
      this.emit("style.load");
      this.emit("load");
    };
    if (Map.hold) Map.held.push(finish);
    else queueMicrotask(finish);
  }

  static release() {
    Map.hold = false;
    for (const finish of Map.held.splice(0)) finish();
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
  }

  on(type: string, handler: Handler) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    return this;
  }

  off(type: string, handler: Handler) {
    this.handlers.set(
      type,
      (this.handlers.get(type) ?? []).filter((h) => h !== handler),
    );
    return this;
  }

  once(type: string, handler: Handler) {
    const wrapper: Handler = (event) => {
      this.handlers.set(
        type,
        (this.handlers.get(type) ?? []).filter((h) => h !== wrapper),
      );
      handler(event);
    };
    return this.on(type, wrapper);
  }

  emit(type: string, event?: unknown) {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }

  getCanvas() {
    return this.canvas;
  }
  getCanvasContainer() {
    return this.options.container as HTMLElement;
  }
  setStyle(style: unknown, options?: unknown) {
    this.record("setStyle", style, options);
    this.sources.clear();
    this.layers.clear();
    queueMicrotask(() => this.emit("style.load"));
  }
  addSource(id: string, source: unknown) {
    this.sources.set(id, source);
    return this;
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  removeSource(id: string) {
    this.sources.delete(id);
    return this;
  }
  addLayer(layer: { id: string }) {
    this.layers.set(layer.id, layer);
    return this;
  }
  getLayer(id: string) {
    return this.layers.get(id);
  }
  removeLayer(id: string) {
    this.layers.delete(id);
    return this;
  }
  /** The map's centre, which `jumpTo`, `easeTo`, `flyTo` and `moveTo` keep up to date. */
  getCenter() {
    return { ...this.center };
  }
  getZoom() {
    return this.zoomLevel;
  }
  /** Plays a pan or a drag: moves the centre and emits the events a real move does. */
  moveTo(point: { lat: number; lng: number }) {
    this.emit("movestart");
    this.center = { lng: point.lng, lat: point.lat };
    this.emit("move");
    this.emit("moveend");
  }
  private go(method: string, options: unknown) {
    this.record(method, options);
    const { center: centre, zoom } = options as { center?: [number, number]; zoom?: number };
    if (zoom !== undefined) this.zoomLevel = zoom;
    if (centre) this.moveTo({ lng: centre[0], lat: centre[1] });
  }
  fitBounds(bounds: unknown, options?: unknown) {
    this.record("fitBounds", bounds, options);
    const [[west, south], [east, north]] = bounds as [[number, number], [number, number]];
    this.moveTo({ lng: (west + east) / 2, lat: (south + north) / 2 });
  }
  easeTo(options: unknown) {
    this.go("easeTo", options);
  }
  jumpTo(options: unknown) {
    this.go("jumpTo", options);
  }
  flyTo(options: unknown) {
    this.go("flyTo", options);
  }
  zoomIn(options?: unknown) {
    this.record("zoomIn", options);
  }
  zoomOut(options?: unknown) {
    this.record("zoomOut", options);
  }
  remove() {
    this.removed = true;
    this.canvas.remove();
  }

  called(method: string) {
    return this.calls.filter((c) => c.method === method);
  }
}

function centreOfBounds(options: Record<string, unknown>): [number, number] {
  const bounds = options.bounds as [[number, number], [number, number]] | undefined;
  if (!bounds) return [0, 0];
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

/**
 * A marker: its element goes into the map's container while it is on a map, so a test can find what
 * a ride's pins say. `Marker.instances` lists every one made.
 */
export class Marker {
  static instances: Marker[] = [];
  element: HTMLElement;
  options: Record<string, unknown>;
  lngLat: [number, number] | undefined;
  removed = false;

  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
    this.element = (options.element as HTMLElement | undefined) ?? document.createElement("div");
    Marker.instances.push(this);
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }
  addTo(map: Map) {
    map.getCanvasContainer().appendChild(this.element);
    return this;
  }
  remove() {
    this.removed = true;
    this.element.remove();
    return this;
  }
}

/** The maps still alive, newest last. */
export const liveMaps = () => Map.instances.filter((m) => !m.removed);

export function resetFakeMaps() {
  Map.instances = [];
  Marker.instances = [];
  Map.failNext = false;
  Map.sourceError = false;
  Map.hold = false;
}
