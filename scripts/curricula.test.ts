import { describe, expect, it } from "vite-plus/test";
import { checkImportRows } from "../src/server/features/courses/importRows";
import { curriculumImport, electiveTrailsRowIssues } from "../src/shared/schemas/courses";
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

  it("lists the six CSE trails with every listed course at 3 credits, and the internship row", () => {
    const cse = curriculumImport.parse(files.find((f) => f.file.startsWith("42-"))?.raw);
    expect(cse.electiveTrails?.minFromOneTrail).toBe(2);
    expect(cse.electiveTrails?.trails.map((t) => t.name)).toEqual([
      "Algorithms and Computation",
      "Software Engineering",
      "Networks",
      "Computer Architecture and VLSI",
      "Artificial Intelligence",
      "Bioinformatics",
    ]);
    const listed = cse.electiveTrails?.trails.flatMap((t) => t.courses) ?? [];
    expect(listed).toHaveLength(35);
    expect(listed.every((c) => c.credits === 3)).toBe(true);
    expect(cse.courses.find((c) => c.code === "CSE498")).toMatchObject({
      credits: 0,
      nonCredit: true,
      category: "Internship",
      semester: 12,
      prereq: null,
    });
  });

  describe.each(files)("$file", ({ file, raw }) => {
    it("matches the curriculum schema", () => {
      const parsed = curriculumImport.safeParse(raw);
      expect(parsed.error?.issues.slice(0, 3)).toBeUndefined();
    });

    it("is named after its program code", () => {
      expect(file.startsWith(`${(raw as { program: string }).program}-`)).toBe(true);
    });

    it("has trails that fit its slots, when it lists any", () => {
      const parsed = curriculumImport.parse(raw);
      const block = parsed.electiveTrails;
      if (!block) return;
      expect(electiveTrailsRowIssues(block, parsed.courses)).toEqual([]);
      // The data test also sees what the schema says: category, unique codes, a reachable minimum.
      expect(
        parsed.courses.filter((c) => c.kind === "elective" && c.category === block.category),
      ).not.toHaveLength(0);
    });

    it("has no rejected rows: unique codes, and every prereq course is in the file", () => {
      const rows = (raw as { courses: unknown[] }).courses;
      expect(checkImportRows(rows).rejected).toEqual([]);
    });
  });
});
