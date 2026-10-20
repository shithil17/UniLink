import { describe, expect, it } from "vite-plus/test";
import { curriculumImport, curriculumImportEnvelope, studentCourseInput } from "./courses.ts";

describe("studentCourseInput credits", () => {
  const base = { code: "BUS101", title: "Intro", category: "Electives" };

  it("asks for the credits instead of showing zod's NaN message", () => {
    for (const credits of [Number.NaN, undefined]) {
      const result = studentCourseInput.safeParse({ ...base, credits });
      expect(result.error?.issues[0].message).toBe("Enter the credits");
    }
  });

  it("still rejects zero and accepts halves", () => {
    expect(studentCourseInput.safeParse({ ...base, credits: 0 }).success).toBe(false);
    expect(studentCourseInput.safeParse({ ...base, credits: 1.5 }).success).toBe(true);
  });
});

describe("curriculum elective trails", () => {
  const row = (code: string, kind: "course" | "elective" = "course", category = "Core") => ({
    kind,
    code,
    title: code,
    credits: 3,
    category,
    nonCredit: false,
    semester: null,
    alternatives: kind === "course" ? [{ code: "ALT101", title: "Alt" }] : [],
    prereq: null,
  });
  const trailCourse = (code: string) => ({ code, title: code, credits: 3 });
  const file = (block?: unknown) => ({
    program: "42",
    name: "CSE",
    version: "v",
    effectiveFromYear: 22,
    totalCredits: 6,
    courses: [row("CSE115"), row("ELECT1", "elective", "Electives")],
    ...(block === undefined ? {} : { electiveTrails: block }),
  });
  const block = (over: Record<string, unknown> = {}) => ({
    category: "Electives",
    minFromOneTrail: 1,
    trails: [{ name: "A", courses: [trailCourse("XYZ301")] }],
    ...over,
  });
  const message = (input: unknown) => curriculumImport.safeParse(input).error?.issues[0]?.message;

  it("accepts a good block and a file without one", () => {
    expect(curriculumImport.safeParse(file(block())).success).toBe(true);
    expect(curriculumImport.safeParse(file()).success).toBe(true);
  });

  it("rejects a code that is a slot code or an alternative", () => {
    for (const code of ["CSE115", "ALT101"]) {
      const bad = block({ trails: [{ name: "A", courses: [trailCourse(code)] }] });
      expect(message(file(bad))).toContain(code);
    }
  });

  it("rejects a repeated code, an unknown category and a minimum above the largest trail", () => {
    const repeated = block({
      trails: [
        { name: "A", courses: [trailCourse("XYZ301")] },
        { name: "B", courses: [trailCourse("XYZ301")] },
      ],
    });
    expect(message(file(repeated))).toMatch(/more than once/);
    // Both the envelope (client) and the full schema (seed) see the checks that need only the block.
    expect(curriculumImportEnvelope.safeParse({ ...file(repeated), courses: [] }).success).toBe(
      false,
    );
    expect(message(file(block({ category: "Nope" })))).toMatch(/not the category/);
    expect(message(file(block({ category: "Core" })))).toMatch(/not the category/);
    expect(message(file(block({ minFromOneTrail: 2 })))).toMatch(/largest trail/);
    expect(message(file(block({ minFromOneTrail: 0 })))).toBeDefined();
    expect(message(file(block({ trails: [] })))).toBeDefined();
  });

  it("rejects a malformed trail course code", () => {
    const bad = block({ trails: [{ name: "A", courses: [trailCourse("xyz")] }] });
    expect(curriculumImport.safeParse(file(bad)).success).toBe(false);
  });
});
