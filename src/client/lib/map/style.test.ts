/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { MAP_MAX_ZOOM } from "../../../shared/geo";
import { MAP_ATTRIBUTION, MAP_FONTS, MAP_SOURCE } from "./source";
import {
  BUILDING_MIN_ZOOM,
  buildMapStyle,
  isDarkColor,
  LABEL_NAME,
  LANDMARK_MIN_ZOOM,
  MAP_SOURCE_ID,
  mixColors,
  POSTER_ZOOM,
  ROAD_WIDTH_ZOOMS,
  STREET_ZOOM,
  type MapTokens,
} from "./style";

// The real palette values, read from the stylesheet so the test has no colors of its own.
const css = readFileSync(path.resolve(import.meta.dirname, "../../index.css"), "utf8");
const block = (open: RegExp) => open.exec(css)![1]!;
const day = block(/@theme static\s*\{([^}]*)\}/);
const night = block(/:root\[data-theme="night"\]\s*\{([^}]*)\}/);
const mapDay = block(/:root\s*\{\s*(--map-water[^}]*)\}/);

function tokensFrom(palette: string, mapTints: string, dark: boolean): MapTokens {
  const read = (name: string, from: string) =>
    new RegExp(`${name}:\\s*([^;]+);`).exec(from)![1]!.trim();
  return {
    app: read("--color-app", palette),
    surface: read("--color-surface", palette),
    line: read("--color-line", palette),
    edge: read("--color-edge", palette),
    ink: read("--color-ink", palette),
    soft: read("--color-soft", palette),
    faint: read("--color-faint", palette),
    brand: read("--color-brand", palette),
    water: read("--map-water", mapTints),
    park: read("--map-park", mapTints),
    dark,
  };
}

const LIGHT = tokensFrom(day, mapDay, false);
const NIGHT = tokensFrom(night, night, true);

type Layer = {
  id: string;
  type: string;
  source?: string;
  minzoom?: number;
  maxzoom?: number;
  "source-layer"?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
const layersOf = (tokens: MapTokens) => buildMapStyle(tokens).layers as unknown as Layer[];
const layer = (tokens: MapTokens, id: string) => layersOf(tokens).find((l) => l.id === id)!;

/** The output of a zoom `interpolate` at the stop with this input zoom. */
function stopAt(id: string, prop: string, zoom: number, tokens: MapTokens = LIGHT) {
  const expr = layer(tokens, id).paint![prop] as unknown[];
  // ["interpolate", ["linear"], ["zoom"], z1, v1, z2, v2, ...]
  const i = expr.indexOf(zoom, 3);
  if (i === -1) throw new Error(`${id} ${prop} has no stop at zoom ${zoom}`);
  return expr[i + 1];
}

/** Red, green and blue of a color string, normalised through `mixColors`. */
const rgb = (color: string) => mixColors(color, color, 0).match(/\d+/g)!.map(Number);
const distance = (a: string, b: string) => {
  const [ca, cb] = [rgb(a), rgb(b)];
  return Math.hypot(...ca.map((v, i) => v - cb[i]!));
};
/** The color a `["match", ["get","class"], ...]` gives one class, or its fallback. */
function matchColor(match: unknown, cls: string): string {
  const m = match as unknown[];
  for (let i = 2; i < m.length - 1; i += 2) {
    const label = m[i];
    if (label === cls || (Array.isArray(label) && label.includes(cls))) return m[i + 1] as string;
  }
  return m.at(-1) as string;
}

describe("buildMapStyle", () => {
  it("draws land, water and parks from the given tokens", () => {
    expect(layer(LIGHT, "background").paint!["background-color"]).toBe(LIGHT.app);
    expect(layer(LIGHT, "water").paint!["fill-color"]).toBe(
      mixColors(LIGHT.water, LIGHT.ink, 0.08),
    );
    expect(layer(LIGHT, "park").paint!["fill-color"]).toBe(LIGHT.park);
    // Street zoom: streets are the surface color.
    expect(stopAt("road-minor", "line-color", STREET_ZOOM)).toEqual([
      "match",
      ["get", "class"],
      expect.any(Array),
      expect.any(String),
      LIGHT.surface,
    ]);
  });

  it("follows other tokens, not a fixed palette", () => {
    const other = { ...LIGHT, app: "rgb(10, 20, 30)", water: "rgb(1, 2, 3)" };
    expect(layer(other, "background").paint!["background-color"]).toBe("rgb(10, 20, 30)");
    expect(layer(other, "water").paint!["fill-color"]).toBe(mixColors("rgb(1, 2, 3)", other.ink, 0.08));
  });

  it("gives the Night tokens the dark variant and keeps the day ones light", () => {
    expect(buildMapStyle(LIGHT).metadata).toEqual({ "unilink:variant": "light" });
    expect(buildMapStyle(NIGHT).metadata).toEqual({ "unilink:variant": "dark" });
    expect(layer(NIGHT, "background").paint!["background-color"]).toBe(NIGHT.app);
    expect(isDarkColor(NIGHT.app)).toBe(true);
    expect(isDarkColor(LIGHT.app)).toBe(false);
    // The two variants are different pictures, not one with a flag.
    expect(layer(NIGHT, "building").paint!["fill-color"]).not.toBe(
      layer(LIGHT, "building").paint!["fill-color"],
    );
  });

  it("labels prefer name:en, then name:latin, then name, in every text layer", () => {
    expect(LABEL_NAME).toEqual([
      "coalesce",
      ["get", "name:en"],
      ["get", "name:latin"],
      ["get", "name"],
    ]);
    const symbols = layersOf(LIGHT).filter((l) => l.type === "symbol");
    expect(symbols.length).toBeGreaterThan(0);
    for (const l of symbols) {
      expect(l.layout!["text-field"], l.id).toEqual(LABEL_NAME);
      const fonts: string[] = [...MAP_FONTS.regular, ...MAP_FONTS.bold];
      expect(fonts).toContain((l.layout!["text-font"] as string[])[0]);
    }
  });

  it("labels major roads and area names, and keeps buildings and landmarks to street zoom", () => {
    const ids = layersOf(LIGHT).map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining(["label-road", "label-suburb", "label-neighbourhood"]),
    );
    expect(layer(LIGHT, "building").minzoom).toBe(BUILDING_MIN_ZOOM);
    expect(layer(LIGHT, "landmark-label").minzoom).toBe(LANDMARK_MIN_ZOOM);
    expect(layer(LIGHT, "landmark-dot").minzoom).toBe(LANDMARK_MIN_ZOOM);
    expect(BUILDING_MIN_ZOOM).toBeGreaterThanOrEqual(15);
  });

  it("keeps place names and road names at every zoom up to the map's maximum", () => {
    const labels = layersOf(LIGHT).filter((l) => l.type === "symbol");
    const places = labels.filter((l) => l["source-layer"] === "place");
    expect(places.map((l) => l.id)).toEqual(
      expect.arrayContaining(["label-city", "label-town", "label-suburb", "label-neighbourhood"]),
    );
    // No label layer may switch off before the map's highest zoom; tiles stop sooner and are overzoomed.
    for (const l of labels) {
      expect(l.maxzoom === undefined || l.maxzoom >= MAP_MAX_ZOOM, l.id).toBe(true);
    }
  });

  it("labels minor roads from street zoom with the shared label name", () => {
    const minor = layer(LIGHT, "label-road-minor") as Layer & { filter: unknown };
    expect(minor.type).toBe("symbol");
    expect(minor["source-layer"]).toBe("transportation_name");
    expect(minor.layout!["symbol-placement"]).toBe("line");
    expect(minor.layout!["text-field"]).toEqual(LABEL_NAME);
    expect(minor.minzoom).toBeGreaterThanOrEqual(14);
    expect(minor.minzoom).toBeLessThanOrEqual(15);
    expect(JSON.stringify(minor.filter)).toContain('"minor"');
    // Bigger roads are named earlier than lanes.
    expect(layer(LIGHT, "label-road-tertiary").minzoom!).toBeLessThan(minor.minzoom!);
    expect(layer(LIGHT, "label-road").minzoom!).toBeLessThan(
      layer(LIGHT, "label-road-tertiary").minzoom!,
    );
  });

  it("thickens roads by class, with minor roads thinner than major ones at every stop", () => {
    const width = (id: string, cls: string, zoom: number) => {
      const match = stopAt(id, "line-width", zoom) as unknown[];
      const at = match.indexOf(cls);
      return at === -1 ? (match.at(-1) as number) : (match[at + 1] as number);
    };
    for (const zoom of ROAD_WIDTH_ZOOMS) {
      expect(width("road-major", "motorway", zoom), `motorway at ${zoom}`).toBeGreaterThan(
        width("road-major", "secondary", zoom),
      );
      expect(width("road-major", "secondary", zoom)).toBeGreaterThan(
        width("road-major", "tertiary", zoom),
      );
      // The thickest minor class is still thinner than the thinnest major one.
      expect(width("road-major", "tertiary", zoom)).toBeGreaterThan(
        width("road-minor", "minor", zoom),
      );
      expect(width("road-minor", "minor", zoom)).toBeGreaterThan(
        width("road-minor", "service", zoom),
      );
    }
    // Wider at 18 than at 9.
    expect(width("road-major", "primary", 18)).toBeGreaterThan(width("road-major", "primary", 9));
  });

  it("draws a poster at city zoom: accent-tinted big roads, quiet minor hairlines, no casings", () => {
    const major = stopAt("road-major", "line-color", POSTER_ZOOM);
    const motorway = matchColor(major, "motorway");
    const tertiary = matchColor(major, "tertiary");
    const minor = matchColor(stopAt("road-minor", "line-color", POSTER_ZOOM), "minor");
    for (const tokens of [LIGHT, NIGHT]) {
      const low = matchColor(stopAt("road-major", "line-color", POSTER_ZOOM, tokens), "motorway");
      // The accent shows: closer to the accent than the land is.
      expect(distance(low, tokens.brand)).toBeLessThan(distance(tokens.app, tokens.brand));
      // Held back: not the raw accent.
      expect(distance(low, tokens.brand)).toBeGreaterThan(0);
    }
    expect(motorway).not.toBe(tertiary);
    expect(tertiary).not.toBe(minor);
    // Minor streets sit closer to the land than the big roads do.
    expect(distance(minor, LIGHT.app)).toBeLessThan(distance(motorway, LIGHT.app));
    // Casings are invisible on the poster and full at street zoom.
    for (const id of ["road-major-casing", "road-minor-casing"]) {
      const opacity = layer(LIGHT, id).paint!["line-opacity"] as unknown[];
      expect(opacity[4], id).toBeLessThanOrEqual(POSTER_ZOOM + 1);
      expect(opacity[5], id).toBe(0);
      expect(opacity.at(-2), id).toBe(STREET_ZOOM);
      expect(opacity.at(-1), id).toBe(1);
    }
    // No buildings at city zoom.
    expect(layer(LIGHT, "building").minzoom).toBeGreaterThan(POSTER_ZOOM);
  });

  it("eases the accent off by street zoom, where the roads are the surface color", () => {
    for (const tokens of [LIGHT, NIGHT]) {
      const at = (zoom: number) =>
        matchColor(stopAt("road-major", "line-color", zoom, tokens), "motorway");
      expect(distance(at(STREET_ZOOM), tokens.brand)).toBeGreaterThan(
        distance(at(POSTER_ZOOM), tokens.brand),
      );
      expect(distance(at(STREET_ZOOM), tokens.surface)).toBeLessThan(
        distance(at(POSTER_ZOOM), tokens.surface),
      );
      expect(matchColor(stopAt("road-minor", "line-color", STREET_ZOOM, tokens), "minor")).toBe(
        tokens.surface,
      );
    }
  });

  it("writes no color literal of its own: every color comes from the tokens", () => {
    const tokens = { ...LIGHT } as Record<string, unknown>;
    // Tokens as rgb() so any hex in the output would be the style's own.
    for (const key of Object.keys(tokens)) {
      if (typeof tokens[key] === "string") tokens[key] = mixColors(tokens[key], tokens[key], 0);
    }
    for (const t of [tokens as unknown as MapTokens, { ...NIGHT }]) {
      const text = JSON.stringify(buildMapStyle(t));
      expect(text).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(text).not.toMatch(/\b(?:white|black|red|green|blue|gray|grey)\b/);
    }
  });

  it("reads one vector source and the shared glyphs, and every layer points at it", () => {
    const style = buildMapStyle(LIGHT);
    expect(style.glyphs).toBe(MAP_SOURCE.glyphsUrl);
    expect(style.sprite).toBe(MAP_SOURCE.spriteUrl);
    expect(style.sources).toEqual({
      [MAP_SOURCE_ID]: { type: "vector", url: MAP_SOURCE.vectorTilesUrl },
    });
    const layers = style.layers as unknown as Layer[];
    expect(new Set(layers.map((l) => l.id)).size).toBe(layers.length);
    for (const l of layers.filter((x) => x.type !== "background")) {
      expect(l.source, l.id).toBe(MAP_SOURCE_ID);
    }
  });
});

describe("attribution text", () => {
  it("names OpenStreetMap contributors and OpenMapTiles", () => {
    const texts = MAP_ATTRIBUTION.map((a) => a.text);
    expect(texts).toContain("© OpenStreetMap contributors");
    expect(texts).toContain("OpenMapTiles");
  });
});

describe("mixColors", () => {
  it("blends hex and rgb colors and falls back to the first when one is unreadable", () => {
    expect(mixColors("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    expect(mixColors("rgb(0, 0, 0)", "#fff", 0)).toBe("rgb(0, 0, 0)");
    expect(mixColors("#102030", "not a color", 0.5)).toBe("#102030");
  });
});
