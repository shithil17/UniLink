import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { FACULTY_DIR, readFacultyFiles } from "./faculty";

const rows = readFacultyFiles();

describe("data/faculty", () => {
  it("has one file per department, named after its code, with rows in name order", () => {
    const files = readdirSync(FACULTY_DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const own = readFacultyFiles(FACULTY_DIR).filter(
        (r) => r.department === file.slice(0, -5).toUpperCase(),
      );
      expect(own.length, file).toBeGreaterThan(0);
      const names = own.map((r) => r.name.toLowerCase());
      expect(names, file).toEqual([...names].sort());
    }
  });

  it("keeps initials unique across every file, ignoring case", () => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!r.initials) continue;
      const key = r.initials.toLowerCase();
      expect(seen.get(key), `${r.name} and ${seen.get(key)} share initials ${r.initials}`).toBe(
        undefined,
      );
      seen.set(key, r.name);
    }
  });

  it("keeps names unique within a department", () => {
    const keys = rows.map((r) => `${r.department}/${r.name.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("refuses a row filed under the wrong department", () => {
    const dir = mkdtempSync(join(tmpdir(), "unilink-faculty-"));
    try {
      const row = { name: "A B", initials: "AB", designation: "Lecturer", department: "MGT" };
      writeFileSync(join(dir, "ece.json"), JSON.stringify([row]));
      expect(() => readFacultyFiles(dir)).toThrow(/ece\.json.*MGT.*ECE/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
