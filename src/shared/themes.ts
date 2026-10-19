/**
 * Theme registry. Adding a palette = one entry here + one `:root[data-theme="<id>"]` block in
 * `src/client/index.css`. The inline script in `index.html` keeps a copy of the ids and bar
 * colors (it cannot import this file); `themes.test.ts` stops the copies drifting apart.
 */
export const THEME_IDS = ["ocean", "red-gradient", "cherry-blossom", "cherry-red"] as const;

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
    name: "Ocean Teal",
    blurb: "Calm teal on a cool neutral",
    bar: "#f4f6f5",
    ink: "#14201e",
    accent: "#0e7367",
  },
  {
    id: "red-gradient",
    name: "Bordeaux",
    blurb: "Deep wine red on warm grey",
    bar: "#f7f3f3",
    ink: "#2e1014",
    accent: "#9b1b30",
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    blurb: "Rose crimson on blush",
    bar: "#fbf4f5",
    ink: "#3a0f1c",
    accent: "#b0123f",
  },
  {
    id: "cherry-red",
    name: "Cherry Red",
    blurb: "Bright red, near-black ink",
    bar: "#f3f4f4",
    ink: "#1a1a1a",
    accent: "#d6001f",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Maps any stored value to a known theme, falling back to the default. */
export function resolveTheme(value: unknown): ThemeMeta {
  return themes.find((t) => t.id === value) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!;
}
