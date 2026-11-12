/**
 * The one place that says where map data comes from. OpenFreeMap serves OpenStreetMap data as vector
 * tiles in the OpenMapTiles schema, free and without a key. Switching to self-hosted tiles later
 * (same schema, so the style does not change) means editing this file and nothing else.
 */
export const MAP_SOURCE = {
  /** TileJSON for the vector tiles; MapLibre follows it to the current dated tile set. */
  vectorTilesUrl: "https://tiles.openfreemap.org/planet",
  /** Label font files. MapLibre needs prebuilt glyph ranges, which the app font (Figtree) has none of. */
  glyphsUrl: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  /** Icon sprite from the same host. */
  spriteUrl: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
} as const;

/** Noto Sans stacks that exist in the glyph set above. */
export const MAP_FONTS = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
} as const;

/**
 * Attribution is required by the data licenses and always shown on every map, previews included.
 * `href` is only used where a link is allowed (not inside a preview, which is one big button).
 */
export const MAP_ATTRIBUTION = [
  { text: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
  { text: "OpenMapTiles", href: "https://openmaptiles.org/" },
] as const;
