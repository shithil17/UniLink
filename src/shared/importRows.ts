import { prereqCourseCodes } from "./prereq.ts";
import { courseImportRow, type CourseImportRow } from "./schemas/courses.ts";

// The per-row and cross-row checks of a curriculum file. Shared so the mod import screen can preview
// exactly which rows the server will accept, with the same code the import route runs.

export type AcceptedRow = { index: number; row: CourseImportRow };
export type RejectedRow = { index: number; code: string | null; reason: string };

function rawCode(raw: unknown): string | null {
  const code = (raw as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Checks every row of a curriculum file on its own, then across the file: a duplicate code is
 * rejected (the first one wins), and so is a prerequisite that points at a code no accepted course
 * row has, as its code or as an alternative. Dropping a row can orphan the prerequisites of others, so
 * the check repeats until nothing more is dropped.
 */
export function checkImportRows(rawRows: readonly unknown[]): {
  accepted: AcceptedRow[];
  rejected: RejectedRow[];
} {
  const rejected: RejectedRow[] = [];
  let accepted: AcceptedRow[] = [];
  const seen = new Set<string>();

  rawRows.forEach((raw, index) => {
    const parsed = courseImportRow.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      rejected.push({ index, code: rawCode(raw), reason: `${where}${issue.message}` });
    } else if (seen.has(parsed.data.code)) {
      rejected.push({ index, code: parsed.data.code, reason: "Duplicate code" });
    } else {
      seen.add(parsed.data.code);
      accepted.push({ index, row: parsed.data });
    }
  });

  for (let changed = true; changed;) {
    changed = false;
    // Only course rows can be a prerequisite: an elective placeholder is never "passed".
    const known = new Set(
      accepted.flatMap(({ row }) =>
        row.kind === "course" ? [row.code, ...row.alternatives.map((a) => a.code)] : [],
      ),
    );
    accepted = accepted.filter(({ index, row }) => {
      const own = new Set([row.code, ...row.alternatives.map((a) => a.code)]);
      const bad = prereqCourseCodes(row.prereq).find((c) => own.has(c) || !known.has(c));
      if (bad === undefined) return true;
      const reason = own.has(bad)
        ? `Prerequisite ${bad} is the course itself`
        : `Prerequisite ${bad} is not a course in this file`;
      rejected.push({ index, code: row.code, reason });
      changed = true;
      return false;
    });
  }

  rejected.sort((a, b) => a.index - b.index);
  return { accepted, rejected };
}
