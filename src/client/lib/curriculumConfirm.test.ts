import { describe, expect, it } from "vite-plus/test";
import type { CourseInput, ModCourse } from "../../shared/schemas/modCourses";
import {
  courseAddConfirm,
  courseChanges,
  courseEditConfirm,
  courseHiddenConfirm,
  importConfirm,
  previewImport,
} from "./curriculumConfirm";

const course: ModCourse = {
  id: 1,
  curriculumId: 1,
  kind: "course",
  code: "CSE215",
  title: "Programming Language II",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 3,
  alternatives: [],
  prereq: { course: "CSE115" },
  hidden: false,
};

const row = (over: Record<string, unknown> = {}) => ({
  kind: "course",
  code: "CSE115",
  title: "Programming Language I",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  ...over,
});

describe("course edit summary", () => {
  it("lists only changed fields as before and after", () => {
    const changes = courseChanges(course, {
      credits: 4,
      semester: null,
      prereq: { all: [{ course: "CSE115" }, { course: "MAT120" }] },
    });
    expect(changes).toEqual([
      { label: "Credits", before: "3", after: "4" },
      { label: "Semester", before: "3", after: "None" },
      { label: "Prerequisites", before: "CSE115", after: "CSE115 and MAT120" },
    ]);
  });

  it("describes alternatives and the non-credit switch in words", () => {
    const changes = courseChanges(course, {
      nonCredit: true,
      alternatives: [{ code: "BEN205", title: "Bangla" }],
    });
    expect(changes).toEqual([
      { label: "Non-credit", before: "No", after: "Yes" },
      { label: "Or take instead", before: "None", after: "BEN205 Bangla" },
    ]);
  });

  it("warns that a new code detaches grades, and that credits move the totals", () => {
    const effects = courseEditConfirm(course, { code: "CSE216", credits: 4 }).effects.join(" ");
    expect(effects).toContain("Grades students recorded under CSE215");
    expect(effects).toMatch(/Credit totals/);
    expect(courseEditConfirm(course, { title: "New" }).effects.join(" ")).not.toMatch(/Grades/);
  });

  it("has no changes for an empty patch", () => {
    expect(courseChanges(course, {})).toEqual([]);
  });
});

describe("course add and hide summaries", () => {
  const values: CourseInput = {
    kind: "course",
    code: "CSE311",
    title: "Databases",
    credits: 3,
    category: "Core",
    nonCredit: false,
    semester: null,
    alternatives: [],
    prereq: null,
  };

  it("prints what the new slot holds and leaves empty optional fields out", () => {
    const add = courseAddConfirm(values);
    expect(add.title).toBe("Add course");
    const labels = add.facts.map((f) => f.label);
    expect(labels).toContain("Code");
    expect(labels).not.toContain("Semester");
    expect(labels).not.toContain("Prerequisites");
    expect(courseAddConfirm({ ...values, semester: 5 }).facts).toContainEqual({
      label: "Semester",
      value: "5",
    });
  });

  it("says hiding stops students seeing the course but keeps grades", () => {
    const hide = courseHiddenConfirm(course, true, "retired");
    expect(hide.title).toBe("Hide course");
    expect(hide.destructive).toBe(true);
    expect(hide.effects.join(" ")).toMatch(/Students stop seeing/);
    expect(courseHiddenConfirm(course, false, "back").title).toBe("Show course again");
  });
});

describe("import preview", () => {
  const existing: ModCourse[] = [
    {
      ...course,
      id: 1,
      code: "CSE115",
      title: "Programming Language I",
      prereq: null,
      semester: 1,
    },
    {
      ...course,
      id: 2,
      code: "CSE173",
      title: "Discrete",
      prereq: null,
      semester: 2,
      hidden: true,
    },
    { ...course, id: 3, code: "CSE225", title: "Data Structures", prereq: null, semester: 3 },
  ];

  it("counts what the file adds, changes and removes", () => {
    const preview = previewImport(existing, [
      row(), // same as CSE115
      row({ code: "CSE173", title: "Discrete Math", semester: 2 }), // changed, was hidden
      row({ code: "MAT120", title: "Calculus I" }), // added
    ]);
    expect(preview).toMatchObject({
      accepted: 3,
      skipped: 0,
      added: 1,
      changed: 1,
      removed: 1, // CSE225 is not in the file
      unchanged: 1,
      shownAgain: 1,
    });
  });

  it("counts the rows the server would refuse as skipped, not as added", () => {
    const preview = previewImport(
      [],
      [
        row(),
        row(),
        row({ code: "bad code" }),
        row({ code: "CSE225", prereq: { course: "ZZZ999" } }),
      ],
    );
    expect(preview.accepted).toBe(1);
    expect(preview.skipped).toBe(3);
    expect(preview.added).toBe(1);
  });

  it("treats a new version as all added", () => {
    expect(previewImport([], [row(), row({ code: "CSE173" })])).toMatchObject({
      added: 2,
      changed: 0,
      removed: 0,
    });
  });

  it("puts the counts in the summary and uses the destructive style only for a replacement", () => {
    const preview = previewImport(existing, [row()]);
    const replace = importConfirm({
      fileName: "cse.json",
      program: "CSE",
      version: "2024",
      rowCount: 1,
      replacing: true,
      preview,
    });
    expect(replace.destructive).toBe(true);
    expect(replace.counts).toEqual([
      { label: "Added", value: "0" },
      { label: "Changed", value: "0" },
      { label: "Removed", value: "2" },
    ]);
    expect(replace.effects.join(" ")).toMatch(/including changes made in the Courses screen/);

    const fresh = importConfirm({
      fileName: "cse.json",
      program: "CSE",
      version: "2025",
      rowCount: 1,
      replacing: false,
      preview: previewImport([], [row()]),
    });
    expect(fresh.destructive).toBe(false);
    expect(fresh.title).toBe("Import curriculum");
  });

  it("leaves the counts out when the current courses haven't loaded", () => {
    const summary = importConfirm({
      fileName: "cse.json",
      program: "CSE",
      version: "2024",
      rowCount: 3,
      replacing: true,
      preview: null,
    });
    expect(summary.counts).toBeUndefined();
  });
});
