/**
 * Theme registry. Adding a palette = one entry here + one `:root[data-theme="<id>"]` block in
 * `src/client/index.css`. The inline script in `index.html` keeps a copy of the ids and bar
 * colors (it cannot import this file); `themes.test.ts` stops the copies drifting apart.
 */
export const THEME_IDS = [
  "ocean",
  "red-gradient",
  "cherry-blossom",
  "cherry-red",
  "night",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  blurb: string;
  /** The palette's ground (`--color-bar`, same as `--color-app`), used for `<meta name="theme-color">`. */
  bar: string;
  /**
   * Picker preview, the palette's ground, ink and accent. Copies of `--color-bar`, `--color-ink` and
   * `--color-brand`, because the preview must not follow the active theme (`themes.test.ts` checks them).
   */
  ink: string;
  accent: string;
};

export const DEFAULT_THEME_ID: ThemeId = "ocean";

/** Same key as the inline script in `index.html`. */
export const THEME_STORAGE_KEY = "unilink-theme";

export const themes: readonly ThemeMeta[] = [
  {
    id: "ocean",
    name: "Coral",
    blurb: "Warm coral on a cool neutral",
    bar: "#f3f4f8",
    ink: "#1c1e2b",
    accent: "#c4401a",
  },
  {
    id: "red-gradient",
    name: "Bordeaux",
    blurb: "Deep wine red on warm grey",
    bar: "#f5f2f4",
    ink: "#1c1e2b",
    accent: "#8c1f3d",
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    blurb: "Rose crimson on blush",
    bar: "#faf3f6",
    ink: "#1c1e2b",
    accent: "#b53568",
  },
  {
    id: "cherry-red",
    name: "Cherry Red",
    blurb: "Bright red, near-black ink",
    bar: "#f6f3f4",
    ink: "#1c1e2b",
    accent: "#c21f2f",
  },
  {
    id: "night",
    name: "Night",
    blurb: "Dark mode: warm coral on charcoal",
    bar: "#14151c",
    ink: "#ecedf3",
    accent: "#ff8a5c",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Maps any stored value to a known theme, falling back to the default. */
export function resolveTheme(value: unknown): ThemeMeta {
  return themes.find((t) => t.id === value) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!;
}
