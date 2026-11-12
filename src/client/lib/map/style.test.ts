/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { MAP_ATTRIBUTION, MAP_FONTS, MAP_SOURCE } from "./source";
import {
  BUILDING_MIN_ZOOM,
  buildMapStyle,
  isDarkColor,
  LABEL_NAME,
  LANDMARK_MIN_ZOOM,
  MAP_SOURCE_ID,
  mixColors,
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
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
const layersOf = (tokens: MapTokens) => buildMapStyle(tokens).layers as unknown as Layer[];
const layer = (tokens: MapTokens, id: string) => layersOf(tokens).find((l) => l.id === id)!;

describe("buildMapStyle", () => {
  it("draws land, water and parks from the given tokens", () => {
    expect(layer(LIGHT, "background").paint!["background-color"]).toBe(LIGHT.app);
    expect(layer(LIGHT, "water").paint!["fill-color"]).toBe(LIGHT.water);
    expect(layer(LIGHT, "park").paint!["fill-color"]).toBe(LIGHT.park);
    expect(layer(LIGHT, "road-minor").paint!["line-color"]).toEqual([
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
    expect(layer(other, "water").paint!["fill-color"]).toBe("rgb(1, 2, 3)");
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

  it("thickens roads by class", () => {
    const width = (id: string, cls: string, zoom: 0 | 1 | 2) => {
      const interpolate = layer(LIGHT, id).paint!["line-width"] as unknown[];
      // ["interpolate", ["linear"], ["zoom"], 10, <match>, 14, <match>, 18, <match>]
      const match = interpolate[4 + zoom * 2] as unknown[];
      const at = match.indexOf(cls);
      return at === -1 ? (match.at(-1) as number) : (match[at + 1] as number);
    };
    for (const zoom of [0, 1, 2] as const) {
      expect(width("road-major", "motorway", zoom)).toBeGreaterThan(
        width("road-major", "tertiary", zoom),
      );
      expect(width("road-major", "tertiary", zoom)).toBeGreaterThan(
        width("road-minor", "service", zoom),
      );
    }
    // Wider at 18 than at 10.
    expect(width("road-major", "primary", 2)).toBeGreaterThan(width("road-major", "primary", 0));
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
