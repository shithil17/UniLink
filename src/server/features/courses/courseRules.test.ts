import { describe, expect, it } from "vite-plus/test";
import { checkCourseChange, type RuleRow } from "./courseRules";

const row = (id: number, code: string, over: Partial<RuleRow> = {}): RuleRow => ({
  id,
  kind: "course",
  code,
  alternatives: [],
  prereq: null,
  ...over,
});
const both = { checkCode: true, checkPrereq: true };

describe("checkCourseChange", () => {
  const others = [
    row(1, "CSE115"),
    row(2, "CSE173", { prereq: { course: "CSE115" } }),
    row(3, "ENG115", { alternatives: [{ code: "BEN205" }] }),
  ];

  it("refuses a code used as a slot code or as an alternative", () => {
    expect(checkCourseChange(others, null, row(0, "BEN205"), both)).toEqual({
      reason: "code_taken",
      code: "BEN205",
    });
    expect(checkCourseChange(others, null, row(0, "CSE115"), both)?.reason).toBe("code_taken");
    expect(checkCourseChange(others, null, row(0, "CSE311"), both)).toBeNull();
  });

  it("lets two slots list the same alternative", () => {
    const next = row(0, "ENG116", { alternatives: [{ code: "BEN205" }] });
    expect(checkCourseChange(others, null, next, both)).toBeNull();
  });

  it("refuses a prerequisite on a code the curriculum lacks, or on itself", () => {
    expect(
      checkCourseChange(others, null, row(0, "CSE311", { prereq: { course: "CSE999" } }), both),
    ).toEqual({ reason: "prereq_unknown", codes: ["CSE999"] });
    expect(
      checkCourseChange(others, null, row(0, "CSE311", { prereq: { course: "CSE311" } }), both)
        ?.reason,
    ).toBe("prereq_unknown");
    expect(
      checkCourseChange(others, null, row(0, "CSE311", { prereq: { course: "BEN205" } }), both),
    ).toBeNull();
  });

  it("does not recheck the prerequisite or code when the edit leaves them alone", () => {
    const stored = row(9, "CSE400", { prereq: { course: "GONE101" } });
    const after = { ...stored, code: "CSE400" };
    expect(
      checkCourseChange(others, stored, after, { checkCode: false, checkPrereq: false }),
    ).toBeNull();
  });

  it("refuses to remove a code another slot's prerequisite needs", () => {
    const before = others[0];
    expect(checkCourseChange(others.slice(1), before, row(1, "CSE116"), both)).toEqual({
      reason: "code_referenced",
      code: "CSE115",
      by: "CSE173",
    });
    // Making it an elective takes it out of the prerequisite pool too.
    expect(
      checkCourseChange(others.slice(1), before, row(1, "ELECT1", { kind: "elective" }), {
        checkCode: false,
        checkPrereq: false,
      })?.reason,
    ).toBe("code_referenced");
  });
});
