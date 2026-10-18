import { describe, expect, it } from "vite-plus/test";
import {
  isValidStudentId,
  normalizeStudentId,
  parseStudentId,
  STUDENT_ID_MAX_AGE_YEARS,
} from "./studentId";

// Fixed clock: 18 Oct 2026 in Dhaka, so admission years 18 to 26 are valid.
const NOW = Date.UTC(2026, 9, 18, 6);
const valid = (id: string) => isValidStudentId(id, NOW);

describe("student ID validation", () => {
  it("accepts verified (0) and unverified (6) suffixes", () => {
    expect(valid("2211234042")).toBe(true);
    expect(valid("2211234642")).toBe(true);
  });

  it("rejects other verification digits", () => {
    for (const v of ["1", "5", "7", "9"]) expect(valid(`2211234${v}42`)).toBe(false);
  });

  it("accepts known program codes and rejects unknown ones", () => {
    for (const code of ["10", "30", "42", "43", "50", "90"]) {
      expect(valid(`2211234 0${code}`)).toBe(true);
    }
    for (const code of ["00", "17", "41", "99"]) expect(valid(`22112340${code}`)).toBe(false);
  });

  it("accepts semester digit 1 to 3 only", () => {
    for (const d of ["1", "2", "3"]) expect(valid(`22${d}1234042`)).toBe(true);
    for (const d of ["0", "4", "9"]) expect(valid(`22${d}1234042`)).toBe(false);
  });

  it("rejects admission years in the future", () => {
    expect(valid("2631234042")).toBe(true);
    expect(valid("2711234042")).toBe(false);
    expect(valid("9911234042")).toBe(false);
  });

  it(`rejects admission years more than ${STUDENT_ID_MAX_AGE_YEARS} years ago`, () => {
    expect(valid("1811234042")).toBe(true);
    expect(valid("1731234042")).toBe(false);
  });

  it("moves the window with the year in Dhaka", () => {
    const newYearDhaka = Date.UTC(2026, 11, 31, 18);
    expect(isValidStudentId("2711234042", newYearDhaka - 1)).toBe(false);
    expect(isValidStudentId("2711234042", newYearDhaka)).toBe(true);
    expect(isValidStudentId("1811234042", newYearDhaka)).toBe(false);
  });

  it("rejects wrong lengths and non-digits", () => {
    expect(valid("221123404")).toBe(false);
    expect(valid("22112340420")).toBe(false);
    expect(valid("")).toBe(false);
    expect(valid("22112340a2")).toBe(false);
  });

  it("ignores spaces and dashes", () => {
    expect(normalizeStudentId(" 22 1 1234 042 ")).toBe("2211234042");
    expect(valid("221-1234-042")).toBe(true);
    expect(valid("22 1 1234 - 642")).toBe(true);
  });
});

describe("parseStudentId", () => {
  it("splits into key, suffix and admission year", () => {
    expect(parseStudentId("2311234642", NOW)).toEqual({
      key: "2311234",
      suffix: "642",
      admissionYear: 23,
    });
  });

  it("gives the verified and unverified forms of one ID the same key", () => {
    expect(parseStudentId("231 1234 042", NOW)?.key).toBe(parseStudentId("2311234642", NOW)?.key);
  });

  it("returns null for an invalid ID", () => {
    expect(parseStudentId("2341234042", NOW)).toBeNull();
    expect(parseStudentId("2711234042", NOW)).toBeNull();
  });
});
