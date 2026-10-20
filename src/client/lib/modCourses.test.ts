import { describe, expect, it } from "vite-plus/test";
import type { ModCourse } from "../../shared/schemas/modCourses";
import type { CourseInput } from "../../shared/schemas/modCourses";
import { changedFields, groupByCategory, matchesCourse, prereqCodesFor } from "./modCourses";

const course = (over: Partial<ModCourse>): ModCourse => ({
  id: 1,
  curriculumId: 1,
  kind: "course",
  code: "CSE115",
  title: "Programming Language I",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  hidden: false,
  ...over,
});

const eng = course({
  id: 3,
  code: "ENG115",
  title: "Composition",
  category: "GED",
  alternatives: [{ code: "BEN205", title: "Bangla Language" }],
});
const all = [
  course({ id: 1 }),
  course({ id: 2, code: "CSE173", title: "Discrete Math", prereq: { course: "CSE115" } }),
  eng,
  course({ id: 4, kind: "elective", code: "ELECT1", title: "Open elective" }),
];

const values = (c: ModCourse): CourseInput => ({
  kind: c.kind,
  code: c.code,
  title: c.title,
  credits: c.credits,
  category: c.category,
  nonCredit: c.nonCredit,
  semester: c.semester,
  alternatives: c.alternatives,
  prereq: c.prereq,
});

describe("groupByCategory", () => {
  it("keeps categories in the order of their first slot", () => {
    expect(groupByCategory(all).map((g) => [g.name, g.courses.length])).toEqual([
      ["Core", 3],
      ["GED", 1],
    ]);
  });
});

describe("matchesCourse", () => {
  it("matches a code, an alternative's code or a title, ignoring case", () => {
    expect(matchesCourse(eng, "eng1")).toBe(true);
    expect(matchesCourse(eng, " ben2 ")).toBe(true);
    expect(matchesCourse(eng, "bangla")).toBe(true);
    expect(matchesCourse(eng, "discrete")).toBe(false);
    expect(matchesCourse(eng, "")).toBe(true);
  });
});

describe("prereqCodesFor", () => {
  it("lists course slot codes and alternatives, but not the slot's own or an elective's", () => {
    expect([...prereqCodesFor(all, 3)].sort()).toEqual(["CSE115", "CSE173"]);
    expect([...prereqCodesFor(all, null)].sort()).toEqual(["BEN205", "CSE115", "CSE173", "ENG115"]);
  });
});

describe("changedFields", () => {
  it("is empty when nothing changed, whatever the prerequisite's spelling", () => {
    const two = all[1];
    expect(changedFields(two, values(two))).toEqual({});
    const wrapped = course({ prereq: { all: [{ course: "CSE115" }] } });
    expect(changedFields(wrapped, { ...values(wrapped), prereq: { course: "CSE115" } })).toEqual(
      {},
    );
  });

  it("holds only what changed", () => {
    expect(
      changedFields(eng, {
        ...values(eng),
        title: "Composition II",
        alternatives: [],
        semester: null,
      }),
    ).toEqual({ title: "Composition II", alternatives: [], semester: null });
    expect(changedFields(eng, { ...values(eng), prereq: { course: "CSE115" } })).toEqual({
      prereq: { course: "CSE115" },
    });
  });
});
