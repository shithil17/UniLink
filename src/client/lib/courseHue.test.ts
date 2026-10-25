import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { courseHue, HUES } from "./courseHue";

const curriculaDir = join(process.cwd(), "data/curricula");

function curriculumCodes(): string[] {
  const codes = new Set<string>();
  for (const file of readdirSync(curriculaDir).filter((f) => f.endsWith(".json"))) {
    const curriculum = JSON.parse(readFileSync(join(curriculaDir, file), "utf8")) as {
      courses: { code?: string }[];
    };
    for (const course of curriculum.courses) if (course.code) codes.add(course.code);
  }
  return [...codes];
}

describe("courseHue", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(courseHue("  cse225 ")).toBe(courseHue("CSE225"));
  });

  it("gives a lab its theory course's hue", () => {
    expect(courseHue("CSE225L")).toBe(courseHue("CSE225"));
    expect(courseHue("cse115l")).toBe(courseHue("CSE115"));
  });

  it("always returns one of the six hues", () => {
    for (const code of ["", "L", "X", "CSE115", "ÄÖÜ", "🙂", "A".repeat(500)]) {
      expect(HUES).toContain(courseHue(code));
    }
  });

  it("uses every hue across the real curricula", () => {
    const codes = curriculumCodes();
    expect(codes.length).toBeGreaterThan(100);
    expect(new Set(codes.map(courseHue))).toEqual(new Set(HUES));
  });

  it("locks the FNV-1a assignment", () => {
    expect({
      CSE115: courseHue("CSE115"),
      CSE225: courseHue("CSE225"),
      MAT120: courseHue("MAT120"),
      ENG102: courseHue("ENG102"),
      CSE327: courseHue("CSE327"),
      MAT130: courseHue("MAT130"),
    }).toEqual({
      CSE115: "sky",
      CSE225: "butter",
      MAT120: "mint",
      ENG102: "lilac",
      CSE327: "peach",
      MAT130: "rose",
    });
  });
});
