import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

// Read from disk: vitest returns an empty string for `?raw` css imports.
const root = path.resolve(import.meta.dirname, "../../../..");
const scene = readFileSync(
  path.join(root, "src/client/components/layout/NotFoundScene.tsx"),
  "utf8",
);
const css = readFileSync(path.join(root, "src/client/index.css"), "utf8");

describe("NotFoundScene", () => {
  it("has no hex colors, so every fill follows the palette", () => {
    expect(scene).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("only uses skin tokens that index.css defines", () => {
    const used = new Set([...scene.matchAll(/fill-(skin-[\w-]+)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(0);
    for (const token of used) expect(css, token).toMatch(new RegExp(`--color-${token}:\\s*#`));
  });
});
