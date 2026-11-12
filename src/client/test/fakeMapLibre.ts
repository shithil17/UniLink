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
  touchZoomRotate = { disableRotation: () => this.record("touchZoomRotate.disableRotation") };
  keyboard = { disableRotation: () => this.record("keyboard.disableRotation") };

  constructor(options: Record<string, unknown>) {
    if (Map.failNext) {
      Map.failNext = false;
      throw new Error("WebGL is not available");
    }
    this.options = options;
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
  setStyle(style: unknown, options?: unknown) {
    this.record("setStyle", style, options);
    queueMicrotask(() => this.emit("style.load"));
  }
  fitBounds(bounds: unknown, options?: unknown) {
    this.record("fitBounds", bounds, options);
  }
  easeTo(options: unknown) {
    this.record("easeTo", options);
  }
  jumpTo(options: unknown) {
    this.record("jumpTo", options);
  }
  flyTo(options: unknown) {
    this.record("flyTo", options);
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

export class Marker {}

/** The maps still alive, newest last. */
export const liveMaps = () => Map.instances.filter((m) => !m.removed);

export function resetFakeMaps() {
  Map.instances = [];
  Map.failNext = false;
  Map.sourceError = false;
  Map.hold = false;
}
