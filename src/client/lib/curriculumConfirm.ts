import { checkImportRows } from "../../shared/importRows";
import { formatPrereq, simplifyPrereq } from "../../shared/prereqText";
import type { CourseImportRow } from "../../shared/schemas/courses";
import type { CourseInput, CoursePatch, ModCourse } from "../../shared/schemas/modCourses";
import type { Change, ConfirmContent, Fact } from "./modConfirm";
import { formatCredits } from "./courseMap";

/*
 * The words of the confirm dialog for curriculum work: a slot added, edited, hidden or shown, and an
 * import. Kept apart from the user and faculty builders in `modConfirm.ts` only for size.
 */

const NONE = "None";

const reasonFact = (reason: string): Fact => ({ label: "Reason", value: reason });

const COURSE_KIND: Record<ModCourse["kind"], string> = {
  course: "Course",
  elective: "Elective placeholder",
};

const alternativesText = (list: readonly { code: string; title: string }[]) =>
  list.length === 0 ? NONE : list.map((a) => `${a.code} ${a.title}`).join("; ");

type CourseField = keyof CourseInput;

/** Each editable field of a slot: its label, and how a value of it reads in the dialog. */
const COURSE_FIELDS: readonly {
  key: CourseField;
  label: string;
  show: (c: Pick<ModCourse, CourseField> | CourseInput) => string;
}[] = [
  { key: "kind", label: "Kind", show: (c) => COURSE_KIND[c.kind] },
  { key: "code", label: "Code", show: (c) => c.code },
  { key: "title", label: "Title", show: (c) => c.title },
  { key: "credits", label: "Credits", show: (c) => formatCredits(c.credits) },
  { key: "category", label: "Category", show: (c) => c.category },
  { key: "nonCredit", label: "Non-credit", show: (c) => (c.nonCredit ? "Yes" : "No") },
  {
    key: "semester",
    label: "Semester",
    show: (c) => (c.semester === null ? NONE : String(c.semester)),
  },
  { key: "alternatives", label: "Or take instead", show: (c) => alternativesText(c.alternatives) },
  { key: "prereq", label: "Prerequisites", show: (c) => formatPrereq(c.prereq) || NONE },
];

/** The fields a course edit changes, as before and after. Empty when nothing changed. */
export function courseChanges(original: ModCourse, patch: CoursePatch): Change[] {
  return COURSE_FIELDS.flatMap(({ key, label, show }) =>
    patch[key] === undefined
      ? []
      : [{ label, before: show(original), after: show({ ...original, ...patch }) }],
  );
}

export function courseAddConfirm(values: CourseInput): ConfirmContent {
  const optional = new Set<CourseField>(["semester", "alternatives", "prereq"]);
  return {
    title: "Add course",
    confirmLabel: "Add course",
    lead: `${values.code} will be added to the curriculum.`,
    // Optional fields left empty are left out rather than printed as "None".
    facts: COURSE_FIELDS.filter(({ key }) => {
      if (!optional.has(key)) return true;
      return key === "semester"
        ? values.semester !== null
        : key === "alternatives"
          ? values.alternatives.length > 0
          : values.prereq !== null;
    }).map(({ label, show }) => ({ label, value: show(values) })),
    effects: ["It goes at the end of its category and shows on students' course maps right away."],
  };
}

export function courseEditConfirm(original: ModCourse, patch: CoursePatch): ConfirmContent {
  const effects = ["Students see the changes on their course maps right away."];
  if (patch.code !== undefined) {
    effects.push(`Grades students recorded under ${original.code} are detached from this course.`);
  }
  if (patch.credits !== undefined || patch.nonCredit !== undefined) {
    effects.push("Credit totals change for students who count this course.");
  }
  return {
    title: "Save course changes",
    confirmLabel: "Save changes",
    lead: `${original.code} will be updated.`,
    facts: [],
    changes: courseChanges(original, patch),
    effects,
  };
}

export function courseHiddenConfirm(
  course: Pick<ModCourse, "code" | "title">,
  hidden: boolean,
  reason: string,
): ConfirmContent {
  const what = `${course.code} ${course.title}`;
  return hidden
    ? {
        title: "Hide course",
        confirmLabel: "Hide course",
        destructive: true,
        lead: `${course.code} will be hidden from students.`,
        facts: [{ label: "Course", value: what }, reasonFact(reason)],
        effects: [
          "Students stop seeing this course, unless they already have a grade on it.",
          "Grades are never deleted.",
          "A course whose prerequisite names this one stays locked until you change that prerequisite.",
          "An admin can reverse this from the audit log.",
        ],
      }
    : {
        title: "Show course again",
        confirmLabel: "Show again",
        lead: `${course.code} will show to students again.`,
        facts: [{ label: "Course", value: what }, reasonFact(reason)],
        effects: ["It shows on students' course maps again."],
      };
}

// ---- Import -----------------------------------------------------------------------------------

export type ImportPreview = {
  /** Rows the server will keep. */
  accepted: number;
  /** Rows the server will refuse: bad shape, a repeated code, a prerequisite that points nowhere. */
  skipped: number;
  /** Codes in the file that the version has not got. */
  added: number;
  /** Codes in both whose fields differ. */
  changed: number;
  /** Codes the version has that the file leaves out. */
  removed: number;
  /** Codes in both that are the same. */
  unchanged: number;
  /** Hidden slots whose code is in the file: a replaced slot starts visible. */
  shownAgain: number;
};

const sameSlot = (a: ModCourse, b: CourseImportRow): boolean =>
  a.kind === b.kind &&
  a.title === b.title &&
  a.credits === b.credits &&
  a.category === b.category &&
  a.nonCredit === b.nonCredit &&
  a.semester === b.semester &&
  JSON.stringify(a.alternatives) === JSON.stringify(b.alternatives) &&
  JSON.stringify(simplifyPrereq(a.prereq)) === JSON.stringify(simplifyPrereq(b.prereq));

/**
 * What importing `rows` would do to a version that has `existing` slots (pass none for a new version).
 * It runs the server's own row checks, so the counts are the ones the import will report; only the
 * trail block, which the server checks last, is not previewed.
 */
export function previewImport(
  existing: readonly ModCourse[],
  rows: readonly unknown[],
): ImportPreview {
  const { accepted, rejected } = checkImportRows(rows);
  const have = new Map(existing.map((c) => [c.code, c]));
  const incoming = new Set(accepted.map(({ row }) => row.code));
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  let shownAgain = 0;
  for (const { row } of accepted) {
    const was = have.get(row.code);
    if (!was) added += 1;
    else {
      if (sameSlot(was, row)) unchanged += 1;
      else changed += 1;
      if (was.hidden) shownAgain += 1;
    }
  }
  const removed = existing.filter((c) => !incoming.has(c.code)).length;
  return {
    accepted: accepted.length,
    skipped: rejected.length,
    added,
    changed,
    removed,
    unchanged,
    shownAgain,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function importConfirm(args: {
  fileName: string;
  program: string;
  version: string;
  rowCount: number;
  /** True when the program and version are already imported, so the import replaces its courses. */
  replacing: boolean;
  /** The preview, or null when the version's current courses haven't loaded. */
  preview: ImportPreview | null;
}): ConfirmContent {
  const { fileName, program, version, rowCount, replacing, preview } = args;
  const effects: string[] = [];
  if (replacing) {
    effects.push(
      "Every course of this version is replaced, including changes made in the Courses screen.",
    );
  }
  if (preview && preview.shownAgain > 0) {
    effects.push(
      `${plural(preview.shownAgain, "hidden course shows", "hidden courses show")} again.`,
    );
  }
  if (preview && preview.skipped > 0) {
    effects.push(
      `${plural(preview.skipped, "row has", "rows have")} problems and will be skipped. They're listed after the import.`,
    );
  }
  effects.push("Students' course maps update right away.");

  const counts: Fact[] | undefined = preview
    ? [
        { label: "Added", value: String(preview.added) },
        { label: "Changed", value: String(preview.changed) },
        { label: "Removed", value: String(preview.removed) },
      ]
    : undefined;

  return {
    title: replacing ? "Replace curriculum" : "Import curriculum",
    confirmLabel: replacing ? "Replace courses" : "Import",
    destructive: replacing,
    lead: replacing
      ? `The courses of ${program} version ${version} will be replaced with the ones in this file.`
      : `${program} version ${version} will be added as a new curriculum.`,
    facts: [
      { label: "File", value: fileName },
      { label: "Program", value: `${program} · version ${version}` },
      { label: "Rows in the file", value: String(rowCount) },
    ],
    counts,
    effects,
  };
}
