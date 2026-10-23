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
const viteConfig = readFileSync(path.join(root, "vite.config.ts"), "utf8");

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

  const HUES = ["mint", "sky", "lilac", "butter", "peach", "rose"];

  /** Every role a palette must define (`--color-*`), plus `float-color` below. `chip` and `deep` are gone. */
  const ROLES = [
    "app",
    "surface",
    "tint",
    "brand-soft",
    "brand-ink",
    "ink",
    "soft",
    "faint",
    "body",
    "line",
    "track",
    "edge",
    "brand",
    "primary",
    "primary-foreground",
    "danger",
    "on-danger",
    "danger-soft",
    "scrim",
    "bar",
    ...HUES.flatMap((h) => [h, `${h}-ink`]),
    "float-color",
  ];

  /** Palette variables of one block: `--color-x` as `x`, and `--float-color` as `float-color`. */
  function tokens(block: string) {
    return new Map(
      [...block.matchAll(/--(color-[a-z-]+|float-color):\s*([^;]+);/g)].map(
        (m) => [m[1]!.replace(/^color-/, ""), m[2]!.trim().toLowerCase()] as const,
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

  it("marks the night palette as dark so native controls and scrollbars follow it", () => {
    expect(blockFor("night")).toMatch(/color-scheme:\s*dark/);
    expect(base).not.toMatch(/color-scheme/);
    // The overlay behind sheets and dialogs is a dark `scrim` in every palette, heavier in Night.
    const night = tokens(blockFor("night")!);
    expect(night.get("scrim")).toBe("rgba(0, 0, 0, 0.6)");
    expect(night.get("float-color")).toBe("rgba(0, 0, 0, 0.65)");
    // The float shadows read `--float-color` at use, so a palette override of it takes effect.
    expect(css).toMatch(/--shadow-float:[^;]*var\(--float-color\)/);
    expect(css).toMatch(/--shadow-float-up:\s*0 -10px 30px -10px var\(--float-color\)/);
  });

  it("matches the Pocket Planner accents, soft fills and names", () => {
    const want = {
      ocean: ["#c4401a", "#ffe9df", "#a23412"],
      "red-gradient": ["#8c1f3d", "#f6e1e7", "#7a1a35"],
      "cherry-blossom": ["#b53568", "#fce4ee", "#9a2a57"],
      "cherry-red": ["#c21f2f", "#fde3e5", "#a5192a"],
      night: ["#ff8a5c", "#3e2118", "#ffb596"],
    } as const;
    for (const t of themes) {
      const [accent, soft, ink] = want[t.id];
      expect(t.accent.toLowerCase(), `accent ${t.id}`).toBe(accent);
      const tk = tokens(blockFor(t.id)!);
      expect(tk.get("brand-soft"), `brand-soft ${t.id}`).toBe(soft);
      expect(tk.get("brand-ink"), `brand-ink ${t.id}`).toBe(ink);
      expect(tk.get("tint"), `tint is app for ${t.id}`).toBe(t.bar);
    }
    expect(resolveTheme("ocean").name).toBe("Coral");
    expect(resolveTheme("ocean").accent.toLowerCase()).toBe("#c4401a");
    expect(resolveTheme("ocean").blurb).toBe("Warm coral on a cool neutral");
    expect(resolveTheme("night").blurb).toBe("Dark mode: warm coral on charcoal");
  });

  it("gives Night its own hue pairs and keeps the six light pairs shared", () => {
    const light = tokens(blockFor("ocean")!);
    for (const t of themes.filter((x) => x.id !== "night" && x.id !== "ocean")) {
      const tk = tokens(blockFor(t.id)!);
      for (const h of HUES) {
        expect(tk.get(h), `${h} ${t.id}`).toBe(light.get(h));
        expect(tk.get(`${h}-ink`), `${h}-ink ${t.id}`).toBe(light.get(`${h}-ink`));
      }
    }
    const night = tokens(blockFor("night")!);
    for (const h of HUES) expect(night.get(h)).not.toBe(light.get(h));
  });

  it("maps data-hue to hue and hue-ink, defaulting to sky", () => {
    for (const h of HUES) {
      expect(css).toMatch(
        new RegExp(
          `\\[data-hue="${h}"\\]\\s*\\{\\s*--hue-bg:\\s*var\\(--color-${h}\\);\\s*--hue-ink:\\s*var\\(--color-${h}-ink\\);`,
        ),
      );
    }
    expect(css).toMatch(/:root,\s*\[data-hue="sky"\]\s*\{[^}]*--hue-bg:\s*var\(--color-sky\)/);
    expect(css).toMatch(/--color-hue:\s*var\(--hue-bg\)/);
    expect(css).toMatch(/--color-hue-ink:\s*var\(--hue-ink\)/);
  });

  it("defines the radii, motion curves and gated hover variant", () => {
    expect(css).toMatch(/--radius-control:\s*12px/);
    expect(css).toMatch(/--radius-row:\s*16px/);
    expect(css).toMatch(/--radius-panel:\s*20px/);
    expect(css).toMatch(/--radius-sheet:\s*28px/);
    expect(css).toMatch(/--radius:\s*var\(--radius-panel\)/);
    expect(css).toMatch(/--ease-ui-out:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
    expect(css).toMatch(/--ease-ui-in-out:\s*cubic-bezier\(0\.77, 0, 0\.175, 1\)/);
    expect(css).toMatch(/--ease-drawer:\s*cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
    expect(css).toMatch(
      /@custom-variant hover\s*\{\s*@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*&:hover\s*\{\s*@slot;/,
    );
  });

  it("points the shadcn aliases at the Pocket Planner roles", () => {
    expect(css).toMatch(/--input:\s*var\(--color-edge\)/);
    expect(css).toMatch(/--destructive:\s*var\(--color-danger\)/);
    expect(css).toMatch(/--secondary:\s*var\(--color-brand-soft\)/);
    expect(css).toMatch(/--secondary-foreground:\s*var\(--color-brand-ink\)/);
    expect(css).toMatch(/--accent:\s*var\(--color-tint\)/);
    expect(css).toMatch(/--muted:\s*var\(--color-track\)/);
    expect(css).toMatch(/--ring:\s*var\(--color-brand\)/);
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

  it("uses the default theme's bar color for the manifest theme and background colors", () => {
    const { bar } = resolveTheme(DEFAULT_THEME_ID);
    expect(viteConfig).toContain(`theme_color: "${bar}"`);
    expect(viteConfig).toContain(`background_color: "${bar}"`);
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
