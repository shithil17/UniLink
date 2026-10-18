/**
 * Theme registry. Adding a palette = one entry here + one `:root[data-theme="<id>"]` block in
 * `src/client/index.css`. The inline script in `index.html` keeps a copy of the ids and hero
 * colors (it cannot import this file); `themes.test.ts` stops the copies drifting apart.
 */
export const THEME_IDS = ["ocean", "red-gradient", "cherry-blossom", "cherry-red"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Hero gradient start color, used for `<meta name="theme-color">`. */
  hero: string;
  /** Palette preview dots shown in the picker. */
  swatches: readonly [string, string, string, string, string];
};

export const DEFAULT_THEME_ID: ThemeId = "ocean";

/** Same key as the inline script in `index.html`. */
export const THEME_STORAGE_KEY = "unilink-theme";

export const themes: readonly ThemeMeta[] = [
  {
    id: "ocean",
    name: "Ocean Teal",
    blurb: "Current base look",
    hero: "#08443b",
    swatches: ["#f7f8f5", "#08443b", "#0e7367", "#e4e9e5", "#172421"],
  },
  {
    id: "red-gradient",
    name: "Red Gradient",
    blurb: "Bordeaux to scarlet",
    hero: "#641220",
    swatches: ["#641220", "#85182a", "#a71e34", "#c71f37", "#e01e37"],
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom Bloom",
    blurb: "Bordeaux to blush",
    hero: "#590d22",
    swatches: ["#590d22", "#a4133c", "#ff4d6d", "#ffb3c1", "#fff0f3"],
  },
  {
    id: "cherry-red",
    name: "Cherry Red",
    blurb: "Pinterest red",
    hero: "#1a1a1a",
    swatches: ["#f1f3f4", "#1a1a1a", "#e60023", "#7c8085", "#ffffff"],
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Maps any stored value to a known theme, falling back to the default. */
export function resolveTheme(value: unknown): ThemeMeta {
  return themes.find((t) => t.id === value) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!;
}
