import type { AcceptedRow } from "../../../shared/importRows.ts";
import { type CurriculumImport, type ElectiveTrails } from "../../../shared/schemas/courses.ts";
import type { CurriculumHeader, NewCourse, NewElectiveOption } from "../../repos/curricula.ts";

export { checkImportRows, type AcceptedRow, type RejectedRow } from "../../../shared/importRows.ts";

/** The `courses` row for an accepted import row. Shared by the import route and the seed script. */
export function toNewCourse({ index, row }: AcceptedRow): NewCourse {
  return {
    position: index,
    kind: row.kind,
    code: row.code,
    title: row.title,
    credits: row.credits,
    category: row.category,
    nonCredit: row.nonCredit,
    semester: row.semester,
    alternatives: row.alternatives,
    prereq: row.prereq,
  };
}

/** The `curricula` row for an import file's header. */
export function toCurriculumHeader(
  file: Pick<
    CurriculumImport,
    "program" | "name" | "version" | "effectiveFromYear" | "totalCredits" | "electiveTrails"
  >,
): CurriculumHeader {
  return {
    programCode: file.program,
    name: file.name,
    version: file.version,
    effectiveFromYear: file.effectiveFromYear,
    totalCredits: file.totalCredits,
    electiveRule: file.electiveTrails
      ? {
          category: file.electiveTrails.category,
          minFromOneTrail: file.electiveTrails.minFromOneTrail,
        }
      : null,
  };
}

/** The `elective_options` rows for a trail block: one per trail course, positioned in file order. */
export function toNewElectiveOptions(block: ElectiveTrails | undefined): NewElectiveOption[] {
  return (block?.trails ?? [])
    .flatMap((t) => t.courses.map((c) => ({ trail: t.name, ...c })))
    .map((o, position) => ({ ...o, position }));
}
