import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { PrereqRule } from "./prereq.ts";
import { formatPrereq, parsePrereq, simplifyPrereq, unknownPrereqCodes } from "./prereqText.ts";

const CURRICULA_DIR = join(import.meta.dirname, "..", "..", "data", "curricula");

const rule = (text: string) => {
  const parsed = parsePrereq(text);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.rule;
};
const error = (text: string) => {
  const parsed = parsePrereq(text);
  if (parsed.ok) throw new Error(`expected an error for "${text}"`);
  return parsed;
};

describe("prerequisite text", () => {
  it("round-trips every rule in the curriculum files", () => {
    let seen = 0;
    for (const file of readdirSync(CURRICULA_DIR).filter((f) => f.endsWith(".json"))) {
      const data = JSON.parse(readFileSync(join(CURRICULA_DIR, file), "utf8")) as {
        courses: { code: string; prereq: PrereqRule | null }[];
      };
      for (const course of data.courses) {
        if (!course.prereq) continue;
        seen++;
        const text = formatPrereq(course.prereq);
        expect(rule(text), `${file} ${course.code}: ${text}`).toEqual(course.prereq);
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it("prints the wording students see", () => {
    expect(formatPrereq({ all: [{ course: "CSE115" }, { credits: 100 }] })).toBe(
      "CSE115 and 100 credits completed",
    );
    expect(
      formatPrereq({
        all: [{ course: "CSE215" }, { any: [{ course: "MAT120" }, { course: "MAT125" }] }],
      }),
    ).toBe("CSE215 and (MAT120 or MAT125)");
    expect(formatPrereq({ credits: 97.5 })).toBe("97.5 credits completed");
    expect(formatPrereq(null)).toBe("");
  });

  it("round-trips nested groups of both kinds", () => {
    const cases: PrereqRule[] = [
      { course: "CSE115" },
      { credits: 60 },
      { any: [{ course: "ECO101" }, { course: "ENG102" }] },
      { all: [{ any: [{ course: "MAT120" }, { course: "MAT125" }] }, { course: "CSE215" }] },
      { any: [{ all: [{ course: "CSE215" }, { course: "CSE225" }] }, { course: "CSE173" }] },
      { all: [{ course: "CSE215" }, { all: [{ course: "CSE225" }, { credits: 90 }] }] },
      {
        any: [
          { all: [{ course: "EEE141" }, { any: [{ course: "MAT130" }, { course: "MAT250" }] }] },
          { credits: 120 },
        ],
      },
    ];
    for (const r of cases) expect(rule(formatPrereq(r))).toEqual(r);
  });

  it("binds and tighter than or", () => {
    expect(rule("CSE115 or CSE173 and MAT120")).toEqual({
      any: [{ course: "CSE115" }, { all: [{ course: "CSE173" }, { course: "MAT120" }] }],
    });
    expect(rule("(CSE115 or CSE173) and MAT120")).toEqual({
      all: [{ any: [{ course: "CSE115" }, { course: "CSE173" }] }, { course: "MAT120" }],
    });
    expect(rule("CSE115 and CSE173 and MAT120")).toEqual({
      all: [{ course: "CSE115" }, { course: "CSE173" }, { course: "MAT120" }],
    });
  });

  it("is forgiving about case, spacing and the credits wording", () => {
    expect(rule("  cse115   AND  mat120 ")).toEqual({
      all: [{ course: "CSE115" }, { course: "MAT120" }],
    });
    expect(rule("(CSE115)")).toEqual({ course: "CSE115" });
    expect(rule("120 credits")).toEqual({ credits: 120 });
    expect(rule("1 credit completed")).toEqual({ credits: 1 });
    expect(rule("CSE115L")).toEqual({ course: "CSE115L" });
    expect(rule("")).toBeNull();
    expect(rule("   ")).toBeNull();
  });

  it("simplifies groups the text cannot show", () => {
    expect(simplifyPrereq({ all: [{ any: [{ course: "CSE115" }] }] })).toEqual({
      course: "CSE115",
    });
    expect(simplifyPrereq({ all: [] })).toBeNull();
    expect(simplifyPrereq({ any: [{ all: [] }, { course: "CSE115" }] })).toEqual({
      course: "CSE115",
    });
  });

  it("explains a mistake and says where it is", () => {
    expect(error("CSE215 and")).toMatchObject({
      message: expect.stringContaining("ends too early"),
      position: 10,
    });
    expect(error("CSE215 MAT120").message).toContain('Put "and" or "or" before MAT120');
    expect(error("CSE215 and (MAT120 or MAT125")).toMatchObject({
      message: expect.stringContaining("not closed"),
    });
    expect(error("CSE215)")).toMatchObject({
      message: expect.stringContaining('without a matching "("'),
      position: 6,
    });
    expect(error("()").message).toContain("between the brackets");
    expect(error("and CSE215").message).toContain("needs a course on both sides");
    expect(error("CSE2").message).toContain("isn't a course code");
    expect(error("CSE215 & MAT120")).toMatchObject({ position: 7 });
    expect(error("120").message).toContain("120 credits completed");
    expect(error("0 credits").message).toContain("more than 0");
  });

  it("lists the codes a rule uses that the curriculum does not have", () => {
    const known = new Set(["CSE115", "MAT120"]);
    expect(unknownPrereqCodes(rule("CSE115 and (MAT120 or CSE999)"), known)).toEqual(["CSE999"]);
    expect(unknownPrereqCodes(rule("CSE888 or CSE888 and 60 credits"), known)).toEqual(["CSE888"]);
    expect(unknownPrereqCodes(rule("CSE115 and MAT120"), known)).toEqual([]);
    expect(unknownPrereqCodes(null, known)).toEqual([]);
  });
});
