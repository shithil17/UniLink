import type { StyleSpecification } from "maplibre-gl";
import { MAP_FONTS, MAP_SOURCE } from "./source";

/**
 * The map's own style, drawn from the active palette. Nothing here is a fixed color: every fill,
 * line and label is the theme's `app`, `surface`, `line`, `edge`, `ink`, `soft`, `faint` or `brand`
 * (plus the two map tints for water and parks), or a mix of two of them. The result follows all five
 * palettes, Night included, with no color values in code.
 *
 * The layer set is our own, written against the public OpenMapTiles schema (the same schema
 * OpenFreeMap serves), not copied from any other style.
 */

export type MapTokens = {
  app: string;
  surface: string;
  line: string;
  edge: string;
  ink: string;
  soft: string;
  faint: string;
  /** The accent, also used for the big roads. */
  brand: string;
  /** Soft water tint (`--map-water`). */
  water: string;
  /** Soft park tint (`--map-park`). */
  park: string;
  /** Night palette: the dark variant of the style. */
  dark: boolean;
};

/** The vector source's id in the style; layers refer to it. */
export const MAP_SOURCE_ID = "openmaptiles";

/** Buildings appear from here: below it a city is a haze of grey boxes. */
export const BUILDING_MIN_ZOOM = 15;
/** Landmark dots and labels (schools, hospitals, stations ...) appear from here. */
export const LANDMARK_MIN_ZOOM = 15.5;
const MINOR_ROAD_MIN_ZOOM = 12;
const ROAD_LABEL_MIN_ZOOM = 12.5;
const TERTIARY_LABEL_MIN_ZOOM = 14;
/** Lane and service-road names appear from street zoom; below it they would crowd the larger names. */
const MINOR_LABEL_MIN_ZOOM = 15;
/**
 * The two looks and where one becomes the other. At or below `POSTER_ZOOM` the map is a flat poster: roads
 * are bold accent-tinted lines on muted land, with no casings. From `STREET_ZOOM` it is a calm street map:
 * the accent eases off and casings return so streets read clearly. Between them everything is interpolated.
 */
export const POSTER_ZOOM = 12.5;
export const STREET_ZOOM = 15.5;
const SUBURB_LABEL_MIN_ZOOM = 10.5;
const NEIGHBOURHOOD_LABEL_MIN_ZOOM = 13.5;
const RAIL_MIN_ZOOM = 13;

/** The classes of point of interest worth a label at street zoom: places a student can name a meeting spot by. */
export const LANDMARK_CLASSES = [
  "college",
  "school",
  "hospital",
  "place_of_worship",
  "bus",
  "railway",
  "stadium",
  "library",
  "police",
  "post",
  "bank",
];

/** Labels prefer the English name, then the Latin-script name, then whatever the place is called. */
export const LABEL_NAME = [
  "coalesce",
  ["get", "name:en"],
  ["get", "name:latin"],
  ["get", "name"],
] as const;

const MAJOR_ROADS = ["motorway", "trunk", "primary", "secondary", "tertiary"];
const MINOR_ROADS = ["minor", "service", "track", "path"];
/** The zooms `ROAD_WIDTHS` gives a width at. */
export const ROAD_WIDTH_ZOOMS = [9, 12, 14, 16, 18] as const;
/**
 * Road widths in px at `ROAD_WIDTH_ZOOMS`, by class. The big classes are bold at city zoom and the minor
 * ones hairlines, so the hierarchy reads at a glance; every step down a class is thinner at every zoom.
 */
const ROAD_WIDTHS: Record<string, readonly number[]> = {
  motorway: [2.2, 3.6, 4.6, 8, 14],
  trunk: [2, 3.3, 4.3, 7.5, 13],
  primary: [1.6, 2.9, 3.9, 7, 12],
  secondary: [0.8, 1.5, 2.5, 5.5, 10],
  tertiary: [0.5, 1, 1.8, 4.5, 8],
  minor: [0.3, 0.4, 0.9, 3, 6],
  service: [0.2, 0.3, 0.6, 2, 4],
  track: [0.2, 0.3, 0.5, 1.5, 3],
  path: [0.2, 0.3, 0.4, 1, 2],
};
const CASING_EXTRA_PX = 1;
/** The classes whose fill carries the accent: strongly at city zoom, a trace at street zoom. */
const ACCENT_ROADS = ["motorway", "trunk", "primary"];
/** The middle classes at city zoom: clearly thinner and quieter than the accent roads. */
const MID_ROADS = ["secondary", "tertiary"];

type Rgba = [number, number, number, number];

/** Reads `#rgb`, `#rrggbb`, `rgb()` and `rgba()`, the forms the palette variables use. */
function parseColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)?.[1];
  if (hex) {
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      1,
    ];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v)?.[1];
  if (fn) {
    const parts = fn
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
    }
  }
  return null;
}

/** `a` blended towards `b` by `t` (0 to 1), as an rgb() string MapLibre reads. An unreadable color keeps `a`. */
export function mixColors(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  const channel = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** Whether a color is dark (relative luminance under one half). Unreadable counts as light. */
export function isDarkColor(value: string): boolean {
  const c = parseColor(value);
  if (!c) return false;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]) < 0.5;
}

const TOKEN_VARIABLES = {
  app: "--color-app",
  surface: "--color-surface",
  line: "--color-line",
  edge: "--color-edge",
  ink: "--color-ink",
  soft: "--color-soft",
  faint: "--color-faint",
  brand: "--color-brand",
  water: "--map-water",
  park: "--map-park",
} as const;

/** The active palette's colors, read from the element's computed style. */
export function readMapTokens(element: Element = document.documentElement): MapTokens {
  const css = getComputedStyle(element);
  const read = (name: string) => css.getPropertyValue(name).trim();
  const tokens = Object.fromEntries(
    Object.entries(TOKEN_VARIABLES).map(([key, variable]) => [key, read(variable)]),
  ) as Omit<MapTokens, "dark">;
  return { ...tokens, dark: isDarkColor(tokens.app) };
}

/** `["match", ["get","class"], c1, v1, c2, v2, ..., fallback]` */
const byClass = (values: Record<string, number>, fallback: number) => [
  "match",
  ["get", "class"],
  ...Object.entries(values).flat(),
  fallback,
];

/** Width in px of a road class that thickens with zoom (`extra` widens it for the casing). */
const roadWidth = (classes: string[], extra: number) => [
  "interpolate",
  ["linear"],
  ["zoom"],
  ...ROAD_WIDTH_ZOOMS.flatMap((zoom, stop) => [
    zoom,
    byClass(
      Object.fromEntries(classes.map((c) => [c, ROAD_WIDTHS[c]![stop]! + extra])),
      ROAD_WIDTHS[classes.at(-1)!]![stop]! + extra,
    ),
  ]),
];

const isClass = (classes: readonly string[]) => ["match", ["get", "class"], classes, true, false];
const isLine = ["==", ["geometry-type"], "LineString"];

export function buildMapStyle(tokens: MapTokens): StyleSpecification {
  const { app, surface, ink, soft, faint, edge, brand, dark } = tokens;
  const mix = mixColors;

  // City zoom is a tonal poster: one ground in the palette's own hue, roads and water as deeper or paler
  // tones of it, and almost no other color. A light palette tints `app` towards its accent; Night tints it
  // towards the blue water tint, like a midnight-blue chart. The tint is small so the accent pins, the
  // dashed line and the count pills stay clear of the ground (a test holds that to 3:1).
  const land = dark ? mix(app, tokens.water, 0.3) : mix(app, brand, 0.07);
  const building = mix(land, ink, dark ? 0.12 : 0.07);
  const buildingEdge = mix(land, ink, dark ? 0.2 : 0.14);
  const casing = mix(land, edge, dark ? 0.55 : 0.4);
  // Street zoom: white-ish streets with a trace of the accent on the big ones.
  const road = surface;
  const bigRoad = mix(surface, brand, dark ? 0.22 : 0.14);
  // City zoom: big roads are the heaviest, most accent-tinted tone, mid roads a lighter tone, minor streets
  // low-contrast hairlines. Light palettes go deeper towards the accent, Night goes paler towards ink; every
  // one mixes the ground with a palette role, so it keeps its contrast on every palette.
  const accentRoadLow = dark ? mix(mix(land, ink, 0.55), brand, 0.1) : mix(land, brand, 0.45);
  const midRoadLow = dark ? mix(land, ink, 0.3) : mix(land, brand, 0.22);
  const minorRoadLow = dark ? mix(land, ink, 0.15) : mix(land, brand, 0.12);
  const rail = mix(land, edge, 0.5);
  const halo = land;
  const haloWidth = dark ? 1.6 : 1.4;
  /** Parks are a quiet tint on the poster and full strength at street zoom. */
  const parkOpacity = ["interpolate", ["linear"], ["zoom"], 10, 0.6, STREET_ZOOM, 1];
  // Water is the dominant shape on the poster, a deeper tone of the ground; it settles to the soft blue
  // water tint at street zoom.
  const waterStreet = mix(tokens.water, ink, dark ? 0.06 : 0.08);
  const waterLow = dark ? mix(app, tokens.water, 0.85) : mix(land, brand, 0.2);
  const water = [
    "interpolate",
    ["linear"],
    ["zoom"],
    POSTER_ZOOM,
    waterLow,
    STREET_ZOOM,
    waterStreet,
  ];
  const text = (size: number | unknown[], color: string, font: readonly string[], extra = {}) => ({
    layout: {
      "text-field": LABEL_NAME,
      "text-font": [...font],
      "text-size": size,
      "text-max-width": 8,
      ...extra,
    },
    paint: { "text-color": color, "text-halo-color": halo, "text-halo-width": haloWidth },
  });

  /** Place names never drop out at a high zoom; when two meet, the larger place (lower `rank`) is drawn and the other waits. */
  const placeLayout = { "symbol-sort-key": ["get", "rank"], "text-padding": 4 };

  const layers = [
    { id: "background", type: "background", paint: { "background-color": land } },
    {
      id: "landcover-green",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "landcover",
      filter: isClass(["wood", "grass"]),
      paint: { "fill-color": tokens.park, "fill-opacity": parkOpacity },
    },
    {
      id: "landuse-green",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "landuse",
      filter: isClass(["cemetery", "playground", "pitch", "stadium", "track"]),
      paint: { "fill-color": tokens.park, "fill-opacity": parkOpacity },
    },
    {
      id: "park",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "park",
      paint: { "fill-color": tokens.park, "fill-opacity": parkOpacity },
    },
    {
      id: "water",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "water",
      paint: { "fill-color": water },
    },
    {
      id: "waterway",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "waterway",
      filter: isClass(["river", "canal", "stream"]),
      paint: {
        "line-color": water,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 14, 3.5, 18, 9],
      },
    },
    {
      id: "building",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "building",
      minzoom: BUILDING_MIN_ZOOM,
      paint: {
        "fill-color": building,
        "fill-outline-color": buildingEdge,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], BUILDING_MIN_ZOOM, 0, 16, 1],
      },
    },
    {
      id: "rail",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      minzoom: RAIL_MIN_ZOOM,
      filter: ["all", isLine, ["==", ["get", "class"], "rail"]],
      paint: { "line-color": rail, "line-width": 1, "line-dasharray": [3, 3] },
    },
    ...[
      { name: "minor", classes: MINOR_ROADS, minzoom: MINOR_ROAD_MIN_ZOOM },
      { name: "major", classes: MAJOR_ROADS, minzoom: undefined },
    ].flatMap(({ name, classes, minzoom }) => [
      {
        id: `road-${name}-casing`,
        type: "line",
        source: MAP_SOURCE_ID,
        "source-layer": "transportation",
        minzoom,
        filter: ["all", isLine, isClass(classes)],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": casing,
          "line-width": roadWidth(classes, CASING_EXTRA_PX),
          // Absent on the poster, fading in as the map becomes a street map.
          "line-opacity": ["interpolate", ["linear"], ["zoom"], POSTER_ZOOM + 1, 0, STREET_ZOOM, 1],
        },
      },
      {
        id: `road-${name}`,
        type: "line",
        source: MAP_SOURCE_ID,
        "source-layer": "transportation",
        minzoom,
        filter: ["all", isLine, isClass(classes)],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            POSTER_ZOOM,
            [
              "match",
              ["get", "class"],
              ACCENT_ROADS,
              accentRoadLow,
              MID_ROADS,
              midRoadLow,
              minorRoadLow,
            ],
            STREET_ZOOM,
            ["match", ["get", "class"], ACCENT_ROADS, bigRoad, road],
          ],
          "line-width": roadWidth(classes, 0),
        },
      },
    ]),
    {
      id: "label-city",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "place",
      filter: isClass(["city"]),
      ...text(
        ["interpolate", ["linear"], ["zoom"], 9, 15, 12, 18, 15, 14],
        ink,
        MAP_FONTS.bold,
        placeLayout,
      ),
    },
    {
      id: "label-town",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "place",
      minzoom: 9,
      filter: isClass(["town", "village"]),
      ...text(
        ["interpolate", ["linear"], ["zoom"], 9, 13, 16, 11],
        soft,
        MAP_FONTS.regular,
        placeLayout,
      ),
    },
    {
      id: "label-suburb",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "place",
      minzoom: SUBURB_LABEL_MIN_ZOOM,
      filter: isClass(["suburb", "quarter"]),
      ...text(
        ["interpolate", ["linear"], ["zoom"], 10, 11.5, 15, 14, 18, 12],
        soft,
        MAP_FONTS.bold,
        placeLayout,
      ),
    },
    {
      id: "label-neighbourhood",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "place",
      minzoom: NEIGHBOURHOOD_LABEL_MIN_ZOOM,
      filter: isClass(["neighbourhood"]),
      ...text(12, faint, MAP_FONTS.regular, placeLayout),
    },
    {
      id: "label-road",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation_name",
      minzoom: ROAD_LABEL_MIN_ZOOM,
      filter: isClass(["motorway", "trunk", "primary", "secondary"]),
      ...text(["interpolate", ["linear"], ["zoom"], 12, 10, 18, 13], soft, MAP_FONTS.regular, {
        "symbol-placement": "line",
        "text-max-width": 10,
      }),
    },
    {
      id: "label-road-tertiary",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation_name",
      minzoom: TERTIARY_LABEL_MIN_ZOOM,
      filter: isClass(["tertiary"]),
      ...text(11, soft, MAP_FONTS.regular, { "symbol-placement": "line", "text-max-width": 10 }),
    },
    {
      id: "label-road-minor",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation_name",
      minzoom: MINOR_LABEL_MIN_ZOOM,
      filter: isClass(["minor", "service"]),
      ...text(10.5, soft, MAP_FONTS.regular, {
        "symbol-placement": "line",
        "text-max-width": 10,
      }),
    },
    {
      id: "landmark-dot",
      type: "circle",
      source: MAP_SOURCE_ID,
      "source-layer": "poi",
      minzoom: LANDMARK_MIN_ZOOM,
      filter: isClass(LANDMARK_CLASSES),
      paint: {
        "circle-radius": 3,
        "circle-color": faint,
        "circle-stroke-color": halo,
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: "landmark-label",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "poi",
      minzoom: LANDMARK_MIN_ZOOM,
      filter: isClass(LANDMARK_CLASSES),
      ...text(11, soft, MAP_FONTS.regular, {
        "text-anchor": "top",
        "text-offset": [0, 0.6],
        "text-optional": true,
        "text-max-width": 7,
      }),
    },
  ];

  return {
    version: 8,
    name: "UniLink",
    metadata: { "unilink:variant": dark ? "dark" : "light" },
    glyphs: MAP_SOURCE.glyphsUrl,
    sprite: MAP_SOURCE.spriteUrl,
    sources: { [MAP_SOURCE_ID]: { type: "vector", url: MAP_SOURCE.vectorTilesUrl } },
    layers,
  } as StyleSpecification;
}
