import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_THEME_ID, THEME_IDS, isThemeId, resolveTheme, themes } from "./themes";

describe("resolveTheme", () => {
  it("returns the matching theme for every known id", () => {
    for (const id of THEME_IDS) expect(resolveTheme(id).id).toBe(id);
  });

  it("falls back to the default for missing or unknown values", () => {
    for (const bad of [null, undefined, "", "OCEAN", "toString", "dark", 3, {}]) {
      expect(resolveTheme(bad).id).toBe(DEFAULT_THEME_ID);
    }
  });

  it("keeps the registry and the id list in step", () => {
    expect(themes.map((t) => t.id)).toEqual([...THEME_IDS]);
    expect(isThemeId("cherry-red")).toBe(true);
    expect(isThemeId("constructor")).toBe(false);
  });
});
