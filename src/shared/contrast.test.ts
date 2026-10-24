/// <reference types="node" />
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_THEME_ID, themes } from "./themes";

// Contrast is computed from the hex values in `index.css`, so a nudged color fails here.
const css = readFileSync(path.resolve(import.meta.dirname, "../client/index.css"), "utf8");

const HUES = ["mint", "sky", "lilac", "butter", "peach", "rose"] as const;

function blockFor(id: string) {
  return id === DEFAULT_THEME_ID
    ? /@theme static\s*\{([^}]*)\}/.exec(css)?.[1]
    : new RegExp(`:root\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
}

/** Hex roles of one palette, e.g. `ink`, `brand-ink`, `mint-ink`. */
function palette(id: string) {
  const block = blockFor(id);
  if (!block) throw new Error(`no css block for ${id}`);
  return new Map(
    [...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(
      (m) => [m[1]!, m[2]!.toLowerCase()] as const,
    ),
  );
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x contrast ratio between two #rrggbb colors. */
function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

type Pair = { fg: string; bg: string; min: 3 | 4.5 };

/** Text pairs need 4.5; non-text pairs (control edge, focus ring, accent mark on the ground) need 3. */
const PAIRS: Pair[] = [
  { fg: "ink", bg: "app", min: 4.5 },
  { fg: "ink", bg: "surface", min: 4.5 },
  { fg: "soft", bg: "app", min: 4.5 },
  { fg: "soft", bg: "surface", min: 4.5 },
  { fg: "soft", bg: "track", min: 4.5 },
  { fg: "faint", bg: "app", min: 4.5 },
  { fg: "faint", bg: "surface", min: 4.5 },
  { fg: "primary-foreground", bg: "brand", min: 4.5 },
  { fg: "brand-ink", bg: "brand-soft", min: 4.5 },
  { fg: "brand-ink", bg: "surface", min: 4.5 },
  // Brand is a fill, ring and mark, not body text (text uses brand-ink), so 3:1 applies.
  { fg: "brand", bg: "app", min: 3 },
  { fg: "edge", bg: "app", min: 3 },
  { fg: "edge", bg: "surface", min: 3 },
  { fg: "danger", bg: "surface", min: 4.5 },
  { fg: "danger", bg: "danger-soft", min: 4.5 },
  { fg: "on-danger", bg: "danger", min: 4.5 },
  // Toast: app-colored text on an ink pill.
  { fg: "app", bg: "ink", min: 4.5 },
  ...HUES.map((h) => ({ fg: `${h}-ink`, bg: h, min: 4.5 as const })),
];

/*
 * Documented exception: `faint` on `track`/`line` is below 4.5 in Night (4.46). `faint` is only
 * placed on `track` or `line` in disabled controls, which WCAG exempts, so the pair is not listed.
 */

describe("contrast per palette", () => {
  for (const t of themes) {
    it(`${t.name} (${t.id}) passes every pair`, () => {
      const p = palette(t.id);
      const failures: string[] = [];
      for (const { fg, bg, min } of PAIRS) {
        const f = p.get(fg);
        const b = p.get(bg);
        expect(f, `${t.id} ${fg}`).toBeDefined();
        expect(b, `${t.id} ${bg}`).toBeDefined();
        const r = ratio(f!, b!);
        if (r < min) failures.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`);
      }
      expect(failures, t.id).toEqual([]);
    });
  }

  it("keeps the documented faint-on-track exception to the one Night pair", () => {
    // Every palette except Night clears 4.5 anyway; Night is 4.46 and stays disabled-only.
    for (const t of themes) {
      const p = palette(t.id);
      const r = ratio(p.get("faint")!, p.get("track")!);
      if (t.id === "night") expect(r).toBeCloseTo(4.46, 2);
      else expect(r).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("makes line and track the same color, so one disabled and track fill serves both", () => {
    for (const t of themes) {
      const p = palette(t.id);
      expect(p.get("track"), t.id).toBe(p.get("line"));
    }
  });
});

describe("ratios match the values computed for the showcase palettes", () => {
  const close = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.01);

  it("ink, soft, faint and edge on app (Coral)", () => {
    const p = palette("ocean");
    close(ratio(p.get("ink")!, p.get("app")!), 15.05);
    close(ratio(p.get("soft")!, p.get("app")!), 7.46);
    close(ratio(p.get("faint")!, p.get("app")!), 5.33);
    close(ratio(p.get("edge")!, p.get("app")!), 3.55);
    close(ratio(p.get("brand")!, p.get("app")!), 4.67);
  });

  it("text on the accent, per palette", () => {
    const expected = {
      ocean: 5.13,
      "red-gradient": 8.83,
      "cherry-blossom": 5.72,
      "cherry-red": 5.95,
      night: 7.73,
    };
    for (const [id, want] of Object.entries(expected)) {
      const p = palette(id);
      close(ratio(p.get("primary-foreground")!, p.get("brand")!), want);
    }
  });

  it("brand-ink on brand-soft, per palette", () => {
    const expected = {
      ocean: 5.92,
      "red-gradient": 8.31,
      "cherry-blossom": 6.15,
      "cherry-red": 6.24,
      night: 8.57,
    };
    for (const [id, want] of Object.entries(expected)) {
      const p = palette(id);
      close(ratio(p.get("brand-ink")!, p.get("brand-soft")!), want);
    }
  });

  it("hue pairs stay within the documented ranges", () => {
    const light = palette("ocean");
    const night = palette("night");
    for (const h of HUES) {
      const l = ratio(light.get(`${h}-ink`)!, light.get(h)!);
      const n = ratio(night.get(`${h}-ink`)!, night.get(h)!);
      expect(l, `${h} light`).toBeGreaterThanOrEqual(5.55);
      expect(l, `${h} light`).toBeLessThanOrEqual(6.89);
      expect(n, `${h} night`).toBeGreaterThanOrEqual(7.23);
      expect(n, `${h} night`).toBeLessThanOrEqual(8.27);
    }
  });
});
