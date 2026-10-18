import { describe, expect, it } from "vite-plus/test";
import { isValidStudentId, normalizeStudentId, parseStudentId } from "./studentId";

describe("student ID validation", () => {
  it("accepts suffix 042 and 642", () => {
    expect(isValidStudentId("2211234042")).toBe(true);
    expect(isValidStudentId("2211234642")).toBe(true);
  });

  it("accepts semester digit 1 to 3 only", () => {
    for (const d of ["1", "2", "3"]) expect(isValidStudentId(`22${d}1234042`)).toBe(true);
    for (const d of ["0", "4", "9"]) expect(isValidStudentId(`22${d}1234042`)).toBe(false);
  });

  it("rejects other suffixes", () => {
    expect(isValidStudentId("2211234043")).toBe(false);
    expect(isValidStudentId("2211234000")).toBe(false);
  });

  it("rejects wrong lengths and non-digits", () => {
    expect(isValidStudentId("221123404")).toBe(false);
    expect(isValidStudentId("22112340420")).toBe(false);
    expect(isValidStudentId("")).toBe(false);
    expect(isValidStudentId("22112340a2")).toBe(false);
  });

  it("ignores spaces and dashes", () => {
    expect(normalizeStudentId(" 22 1 1234 042 ")).toBe("2211234042");
    expect(isValidStudentId("221-1234-042")).toBe(true);
    expect(isValidStudentId("22 1 1234 - 642")).toBe(true);
  });
});

describe("parseStudentId", () => {
  it("splits into key, suffix and admission year", () => {
    expect(parseStudentId("2311234642")).toEqual({
      key: "2311234",
      suffix: "642",
      admissionYear: 23,
    });
  });

  it("normalises before splitting, so spaced and plain forms share one key", () => {
    expect(parseStudentId("231 1234 042")?.key).toBe(parseStudentId("2311234042")?.key);
  });

  it("returns null for an invalid ID", () => {
    expect(parseStudentId("2341234042")).toBeNull();
  });
});
