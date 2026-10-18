/// <reference types="node" />
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  THEME_STORAGE_KEY,
  isThemeId,
  resolveTheme,
  themes,
} from "./themes";

// Read from disk: vitest returns an empty string for `?raw` css imports.
const root = path.resolve(import.meta.dirname, "../..");
const html = readFileSync(path.join(root, "index.html"), "utf8");
const css = readFileSync(path.join(root, "src/client/index.css"), "utf8");

const byId = (a: string | undefined, b: string | undefined) => (a ?? "").localeCompare(b ?? "");

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

describe("css and index.html stay in step with themes.ts", () => {
  const nonDefault = themes.filter((t) => t.id !== DEFAULT_THEME_ID);

  function heroFromCss(block: string) {
    return /--color-hero1:\s*(#[0-9a-fA-F]{6})\s*;/.exec(block)?.[1]?.toLowerCase();
  }

  it("has a data-theme block in index.css for every non-default theme, with the same hero color", () => {
    for (const t of nonDefault) {
      const match = new RegExp(`:root\\[data-theme="${t.id}"\\]\\s*\\{([^}]*)\\}`).exec(css);
      expect(match, `css block for ${t.id}`).not.toBeNull();
      expect(heroFromCss(match![1]!), `hero1 for ${t.id}`).toBe(t.hero);
    }
  });

  it("has no css block for an id that themes.ts does not list", () => {
    const ids = [...css.matchAll(/^:root\[data-theme="([^"]+)"\]\s*\{/gm)].map((m) => m[1]);
    expect(ids.toSorted(byId)).toEqual(nonDefault.map((t) => t.id).toSorted(byId));
  });

  it("uses the default theme's hero color in the css base theme and the static meta tag", () => {
    const base = /@theme static\s*\{([^}]*)\}/.exec(css)![1]!;
    const hero = resolveTheme(DEFAULT_THEME_ID).hero;
    expect(heroFromCss(base)).toBe(hero);
    expect(html).toContain(`<meta name="theme-color" content="${hero}" />`);
  });

  describe("inline script", () => {
    const code = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;

    /** Runs the script against fake globals. `stored` is the saved value, or `THROWS` when storage throws. */
    const THROWS = "\0throws";

    function run(stored: string | null) {
      const root = { dataset: {} as Record<string, string> };
      const meta = { content: "unset" };
      const doc = {
        documentElement: root,
        querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null),
      };
      const storage = {
        getItem: (key: string) => {
          if (stored === THROWS) throw new Error("storage blocked");
          return key === THEME_STORAGE_KEY ? stored : null;
        },
      };
      // The meta fake needs setAttribute because the script uses it.
      (meta as Record<string, unknown>).setAttribute = (name: string, value: string) => {
        if (name === "content") meta.content = value;
      };
      runInNewContext(code, { document: doc, localStorage: storage });
      return { theme: root.dataset.theme, hero: meta.content };
    }

    it("reads the same storage key as THEME_STORAGE_KEY", () => {
      expect(code).toContain(`"${THEME_STORAGE_KEY}"`);
    });

    it("applies every saved theme id and its hero color", () => {
      for (const t of themes) expect(run(t.id)).toEqual({ theme: t.id, hero: t.hero });
    });

    it("falls back to the default for missing, unknown or inherited keys", () => {
      const fallback = resolveTheme(DEFAULT_THEME_ID);
      for (const bad of [null, "", "nope", "constructor", "toString"]) {
        expect(run(bad)).toEqual({ theme: fallback.id, hero: fallback.hero });
      }
    });

    it("falls back to the default when storage throws", () => {
      const fallback = resolveTheme(DEFAULT_THEME_ID);
      expect(run(THROWS)).toEqual({ theme: fallback.id, hero: fallback.hero });
    });

    it("does not know ids that themes.ts lacks", () => {
      const keys = [...code.matchAll(/["']?([a-z][a-z-]*)["']?\s*:\s*"#[0-9a-fA-F]{6}"/g)].map(
        (m) => m[1],
      );
      expect(keys.toSorted(byId)).toEqual(THEME_IDS.toSorted(byId));
    });
  });
});
