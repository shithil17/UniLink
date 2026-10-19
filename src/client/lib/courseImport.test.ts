import { describe, expect, it } from "vite-plus/test";
import { ApiError } from "./api";
import { parseCurriculumText, rejectedRows } from "./courseImport";

const header = {
  program: "42",
  name: "CSE",
  version: "2020",
  effectiveFromYear: 20,
  totalCredits: 130,
  courses: [{ code: "CSE115" }, { code: "bad" }],
};

describe("parseCurriculumText", () => {
  it("accepts a header and counts the rows without judging them", () => {
    const parsed = parseCurriculumText(JSON.stringify(header));
    expect(parsed).toMatchObject({ ok: true, rowCount: 2 });
  });

  it("refuses text that is not JSON", () => {
    expect(parseCurriculumText("{nope")).toEqual({
      ok: false,
      message: "That file is not valid JSON.",
    });
  });

  it("refuses a file whose header is wrong, naming the field", () => {
    const parsed = parseCurriculumText(JSON.stringify({ ...header, program: "99" }));
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.message).toContain("program");
  });
});

describe("rejectedRows", () => {
  it("reads the rejected rows off a 422", () => {
    const rejected = [{ index: 1, code: "bad", reason: "Invalid course code" }];
    const err = new ApiError(422, { error: "no_valid_rows", rejected });
    expect(rejectedRows(err)).toEqual(rejected);
  });

  it("returns nothing for other errors", () => {
    expect(rejectedRows(new ApiError(400, { error: "validation_error" }))).toEqual([]);
    expect(rejectedRows(new Error("x"))).toEqual([]);
  });
});
