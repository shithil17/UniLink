/// <reference types="vite/client" />
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { seed } from "../../../../scripts/seed";

// The same files `vp run seed` reads; a worker cannot read the file system, so Vite bundles them in.
const files = import.meta.glob("../../../../data/curricula/*.json", {
  eager: true,
  import: "default",
});

const count = async (table: string) =>
  (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n;

describe("seed", () => {
  it("loads every curriculum and both fake students, and can run twice", async () => {
    const curricula = Object.values(files);
    expect(curricula).toHaveLength(13);
    await seed(env.DB, curricula);
    const courses = await count("courses");
    expect(await count("curricula")).toBe(13);
    expect(courses).toBeGreaterThan(500);
    expect(await count("users")).toBe(2);

    await seed(env.DB, curricula);
    expect(await count("curricula")).toBe(13);
    expect(await count("courses")).toBe(courses);
    expect(await count("users")).toBe(2);
  });
});
