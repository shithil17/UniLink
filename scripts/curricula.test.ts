import { describe, expect, it } from "vite-plus/test";
import { checkImportRows } from "../src/server/features/courses/importRows";
import { curriculumImport } from "../src/shared/schemas/courses";
import { readCurriculumFiles } from "./curricula";

const files = readCurriculumFiles();

describe("data/curricula", () => {
  it("has a file for every supported program", () => {
    expect(files.map((f) => f.file.slice(0, 2)).sort()).toEqual(
      ["10", "11", "12", "18", "20", "25", "27", "30", "42", "43", "46", "47", "48"].sort(),
    );
  });

  it("has one file per program and version", () => {
    const keys = files.map(({ raw }) => {
      const { program, version } = raw as { program: string; version: string };
      return `${program}/${version}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe.each(files)("$file", ({ file, raw }) => {
    it("matches the curriculum schema", () => {
      const parsed = curriculumImport.safeParse(raw);
      expect(parsed.error?.issues.slice(0, 3)).toBeUndefined();
    });

    it("is named after its program code", () => {
      expect(file.startsWith(`${(raw as { program: string }).program}-`)).toBe(true);
    });

    it("has no rejected rows: unique codes, and every prereq course is in the file", () => {
      const rows = (raw as { courses: unknown[] }).courses;
      expect(checkImportRows(rows).rejected).toEqual([]);
    });
  });
});
