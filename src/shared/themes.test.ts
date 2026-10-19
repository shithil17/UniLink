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

  /** Every role a palette must define. `hero*` tokens no longer exist. */
  const ROLES = [
    "app",
    "surface",
    "tint",
    "chip",
    "brand-soft",
    "ink",
    "soft",
    "faint",
    "body",
    "deep",
    "line",
    "edge",
    "brand",
    "primary",
    "primary-foreground",
    "danger",
    "bar",
  ];

  function tokens(block: string) {
    return new Map(
      [...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(
        (m) => [m[1]!, m[2]!.toLowerCase()] as const,
      ),
    );
  }

  const base = /@theme static\s*\{([^}]*)\}/.exec(css)![1]!;
  const blockFor = (id: string) =>
    id === DEFAULT_THEME_ID
      ? base
      : new RegExp(`:root\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];

  it("has a block for every theme with every role token and nothing else", () => {
    for (const t of themes) {
      const block = blockFor(t.id);
      expect(block, `css block for ${t.id}`).toBeDefined();
      expect([...tokens(block!).keys()].toSorted(byId), t.id).toEqual(ROLES.toSorted(byId));
    }
  });

  it("keeps no hero token anywhere in the css", () => {
    expect(css).not.toMatch(/hero/i);
  });

  it("makes bar the ground, and the picker preview colors copies of ground, ink and brand", () => {
    for (const t of themes) {
      const tk = tokens(blockFor(t.id)!);
      expect(tk.get("bar"), `bar for ${t.id}`).toBe(t.bar);
      expect(tk.get("app"), `app for ${t.id}`).toBe(t.bar);
      expect(tk.get("ink"), `ink for ${t.id}`).toBe(t.ink);
      expect(tk.get("brand"), `brand for ${t.id}`).toBe(t.accent);
      expect(tk.get("primary"), `primary for ${t.id}`).toBe(t.accent);
    }
  });

  it("points the shadcn aliases at edge and danger", () => {
    expect(css).toMatch(/--input:\s*var\(--color-edge\)/);
    expect(css).toMatch(/--destructive:\s*var\(--color-danger\)/);
  });

  it("has no css block for an id that themes.ts does not list", () => {
    const ids = [...css.matchAll(/^:root\[data-theme="([^"]+)"\]\s*\{/gm)].map((m) => m[1]);
    expect(ids.toSorted(byId)).toEqual(nonDefault.map((t) => t.id).toSorted(byId));
  });

  it("uses the default theme's bar color in the static meta tag", () => {
    expect(html).toContain(
      `<meta name="theme-color" content="${resolveTheme(DEFAULT_THEME_ID).bar}" />`,
    );
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
      return { theme: root.dataset.theme, bar: meta.content };
    }

    it("reads the same storage key as THEME_STORAGE_KEY", () => {
      expect(code).toContain(`"${THEME_STORAGE_KEY}"`);
    });

    it("applies every saved theme id and its bar color", () => {
      for (const t of themes) expect(run(t.id)).toEqual({ theme: t.id, bar: t.bar });
    });

    it("falls back to the default for missing, unknown or inherited keys", () => {
      const fallback = resolveTheme(DEFAULT_THEME_ID);
      for (const bad of [null, "", "nope", "constructor", "toString"]) {
        expect(run(bad)).toEqual({ theme: fallback.id, bar: fallback.bar });
      }
    });

    it("falls back to the default when storage throws", () => {
      const fallback = resolveTheme(DEFAULT_THEME_ID);
      expect(run(THROWS)).toEqual({ theme: fallback.id, bar: fallback.bar });
    });

    it("does not know ids that themes.ts lacks", () => {
      const keys = [...code.matchAll(/["']?([a-z][a-z-]*)["']?\s*:\s*"#[0-9a-fA-F]{6}"/g)].map(
        (m) => m[1],
      );
      expect(keys.toSorted(byId)).toEqual(THEME_IDS.toSorted(byId));
    });
  });
});
