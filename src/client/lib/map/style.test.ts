/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { MAP_MAX_ZOOM } from "../../../shared/geo";
import { DEFAULT_THEME_ID, themes } from "../../../shared/themes";
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
const mapDay = block(/:root\s*\{\s*(--map-ground[^}]*)\}/);

/** The tokens of one palette: roles from its block, map colors from its own block (Night, the other day palettes) or the shared default one. */
function paletteTokens(id: string): MapTokens {
  const isDefault = id === DEFAULT_THEME_ID;
  const own = isDefault ? day : block(new RegExp(`:root\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`));
  const maps = isDefault ? mapDay : own;
  const read = (name: string, from: string) =>
    new RegExp(`${name}:\\s*([^;]+);`).exec(from)?.[1]?.trim() ?? "";
  return {
    ink: read("--color-ink", own),
    soft: read("--color-soft", own),
    faint: read("--color-faint", own),
    brand: read("--color-brand", own),
    ground: read("--map-ground", maps),
    water: read("--map-water", maps),
    park: read("--map-park", maps),
    roadMajor: read("--map-road-major", maps),
    roadMid: read("--map-road-mid", maps),
    roadMinor: read("--map-road-minor", maps),
    roadStreet: read("--map-road-street", maps),
    casing: read("--map-casing", maps),
    building: read("--map-building", maps),
    dark: id === "night",
  };
}

const LIGHT = paletteTokens(DEFAULT_THEME_ID);
const palettes = themes.map((t) => paletteTokens(t.id));
const NIGHT = paletteTokens("night");

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
  it("draws land, water, parks and streets from the given tokens", () => {
    expect(layer(LIGHT, "background").paint!["background-color"]).toBe(LIGHT.ground);
    expect(layer(LIGHT, "water").paint!["fill-color"]).toBe(LIGHT.water);
    expect(layer(LIGHT, "waterway").paint!["line-color"]).toBe(LIGHT.water);
    expect(layer(LIGHT, "park").paint!["fill-color"]).toBe(LIGHT.park);
    expect(layer(LIGHT, "building").paint!["fill-color"]).toBe(LIGHT.building);
    // Street zoom: streets are the palette's street fill.
    expect(stopAt("road-minor", "line-color", STREET_ZOOM)).toEqual([
      "match",
      ["get", "class"],
      expect.any(Array),
      expect.any(String),
      LIGHT.roadStreet,
    ]);
    expect(layer(LIGHT, "road-minor-casing").paint!["line-color"]).toBe(LIGHT.casing);
  });

  it("follows other tokens, not a fixed palette", () => {
    const other = { ...LIGHT, ground: "rgb(10, 20, 30)", water: "rgb(1, 2, 3)" };
    expect(layer(other, "background").paint!["background-color"]).toBe("rgb(10, 20, 30)");
    expect(layer(other, "water").paint!["fill-color"]).toBe("rgb(1, 2, 3)");
  });

  it("gives the Night tokens the dark variant and keeps the day ones light", () => {
    expect(buildMapStyle(LIGHT).metadata).toEqual({ "unilink:variant": "light" });
    expect(buildMapStyle(NIGHT).metadata).toEqual({ "unilink:variant": "dark" });
    expect(layer(NIGHT, "background").paint!["background-color"]).toBe(NIGHT.ground);
    expect(isDarkColor(NIGHT.ground)).toBe(true);
    expect(isDarkColor(LIGHT.ground)).toBe(false);
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

  it("draws a poster at city zoom: three road tones, quiet minor hairlines, no casings or buildings", () => {
    for (const tokens of palettes) {
      const at = (id: string, cls: string) =>
        matchColor(stopAt(id, "line-color", POSTER_ZOOM, tokens), cls);
      expect(at("road-major", "motorway")).toBe(tokens.roadMajor);
      expect(at("road-major", "tertiary")).toBe(tokens.roadMid);
      expect(at("road-minor", "minor")).toBe(tokens.roadMinor);
      // A clear hierarchy against the ground: boldest to faintest.
      const c = (color: string) => contrast(color, tokens.ground);
      expect(c(tokens.roadMajor), tokens.ground).toBeGreaterThan(c(tokens.roadMid));
      expect(c(tokens.roadMid), tokens.ground).toBeGreaterThan(c(tokens.roadMinor));
    }
    // Casings are invisible on the poster and full at street zoom.
    for (const id of ["road-major-casing", "road-minor-casing"]) {
      const opacity = layer(LIGHT, id).paint!["line-opacity"] as unknown[];
      expect(opacity[3], id).toBeLessThanOrEqual(POSTER_ZOOM + 1);
      expect(opacity[4], id).toBe(0);
      expect(opacity.at(-2), id).toBe(STREET_ZOOM);
      expect(opacity.at(-1), id).toBe(1);
    }
    expect(layer(LIGHT, "building").minzoom).toBeGreaterThan(POSTER_ZOOM);
  });

  it("eases to street roads: the street fill, outlined, with only a trace of the accent", () => {
    for (const tokens of palettes) {
      const major = matchColor(stopAt("road-major", "line-color", STREET_ZOOM, tokens), "motorway");
      expect(distance(major, tokens.roadStreet), tokens.ground).toBeLessThan(40);
      for (const cls of ["secondary", "minor"]) {
        const id = cls === "minor" ? "road-minor" : "road-major";
        expect(matchColor(stopAt(id, "line-color", STREET_ZOOM, tokens), cls)).toBe(
          tokens.roadStreet,
        );
      }
    }
  });

  it("writes no color literal of its own: every color comes from the tokens", () => {
    // Tokens as rgb() so any hex in the output would be the style's own.
    const asRgb = (t: MapTokens) =>
      Object.fromEntries(
        Object.entries(t).map(([k, v]) => [k, typeof v === "string" ? mixColors(v, v, 0) : v]),
      ) as MapTokens;
    for (const t of palettes.map(asRgb)) {
      const text = JSON.stringify(buildMapStyle(t));
      expect(text).not.toMatch(/#[0-9a-f]{3,8}\b/i);
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

/** WCAG contrast ratio of two colors. */
function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, bl] = rgb(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].toSorted((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("every palette's map", () => {
  const lum = (c: string) => {
    const [r, g, bl] = rgb(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };

  for (const theme of themes) {
    const tokens = paletteTokens(theme.id);
    const c = (a: string, b: string) => contrast(a, b);

    it(`${theme.id}: reads every map color from the stylesheet`, () => {
      for (const [key, value] of Object.entries(tokens)) {
        expect(value, `${theme.id} ${key}`).not.toBe("");
      }
    });

    it(`${theme.id}: the accent markers and the labels stay readable on the map`, () => {
      // Pins, the dashed line and the count pills are drawn in the accent over the ground and its roads.
      expect(c(tokens.brand, tokens.ground), "accent on ground").toBeGreaterThanOrEqual(3);
      expect(c(tokens.brand, tokens.roadMajor), "accent on major roads").toBeGreaterThanOrEqual(
        1.4,
      );
      expect(c(tokens.brand, tokens.water), "accent on water").toBeGreaterThanOrEqual(1.4);
      expect(c(tokens.ink, tokens.ground), "ink").toBeGreaterThanOrEqual(7);
      expect(c(tokens.soft, tokens.ground), "soft").toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme.id}: water is a distinct cool shape, never the road or the accent`, () => {
      const [r, , b] = rgb(tokens.water);
      expect(b, "water leans blue").toBeGreaterThan(r!);
      expect(c(tokens.water, tokens.ground), "water on ground").toBeGreaterThanOrEqual(1.15);
      expect(distance(tokens.water, tokens.roadMajor)).toBeGreaterThan(40);
      expect(distance(tokens.water, tokens.roadMid)).toBeGreaterThan(30);
      expect(distance(tokens.water, tokens.brand)).toBeGreaterThan(80);
      expect(c(tokens.roadMajor, tokens.ground), "big roads").toBeGreaterThan(1.3);
    });

    it(`${theme.id}: street roads stand apart from the ground and the buildings`, () => {
      expect(c(tokens.roadStreet, tokens.ground), "road fill on ground").toBeGreaterThanOrEqual(
        1.08,
      );
      expect(c(tokens.casing, tokens.ground), "casing on ground").toBeGreaterThanOrEqual(1.1);
      expect(
        c(tokens.roadStreet, tokens.building),
        "road fill on buildings",
      ).toBeGreaterThanOrEqual(1.1);
      if (tokens.dark) {
        // Pale roads on a dark ground, buildings a touch lighter than the ground but darker than the roads.
        expect(c(tokens.roadStreet, tokens.ground), "dark road fill").toBeGreaterThanOrEqual(5);
        expect(lum(tokens.building)).toBeGreaterThan(lum(tokens.ground));
        expect(lum(tokens.building)).toBeLessThan(lum(tokens.roadStreet));
      }
    });
  }
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
