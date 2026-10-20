import { describe, expect, it } from "vite-plus/test";
import { searchCourses, type CourseChoice } from "./courseSearch";

const courses: CourseChoice[] = [
  { code: "CSE115", title: "Programming Language I", status: "done" },
  { code: "CSE115L", title: "Programming Language I Lab", status: "done" },
  { code: "CSE173", title: "Discrete Mathematics", status: "available" },
  { code: "CSE215", title: "Programming Language II", status: "available" },
  { code: "CSE225", title: "Data Structures and Algorithms", status: "locked" },
  { code: "MAT116", title: "Pre-Calculus", status: "available" },
  { code: "ENG115", title: "Introduction to Composition" },
];
const codes = (query: string) => searchCourses(courses, query).map((c) => c.code);

describe("searchCourses", () => {
  it("lists every course with no query: available ones first, then locked, then done", () => {
    expect(codes("")).toEqual([
      "CSE173",
      "CSE215",
      "ENG115",
      "MAT116",
      "CSE225",
      "CSE115",
      "CSE115L",
    ]);
  });

  it("finds a code typed in any case, with or without a space", () => {
    expect(codes("cse225")).toEqual(["CSE225"]);
    expect(codes("CSE 225")).toEqual(["CSE225"]);
  });

  it("puts the exact code before longer codes that start with it", () => {
    expect(codes("cse115")).toEqual(["CSE115", "CSE115L"]);
  });

  it("matches the start of a code, then a number anywhere in it", () => {
    expect(codes("cse2")).toEqual(["CSE215", "CSE225"]);
    // ENG115 is not done, so it outranks the done CSE115 courses among the "contains" matches.
    expect(codes("115")).toEqual(["ENG115", "CSE115", "CSE115L"]);
  });

  it("matches title words by their start, in any order", () => {
    expect(codes("prog lang")).toEqual(["CSE215", "CSE115", "CSE115L"]);
    expect(codes("algorithms data")).toEqual(["CSE225"]);
    expect(codes("calculus")).toEqual(["MAT116"]);
  });

  it("finds nothing for text that is in no code or title", () => {
    expect(codes("zzzz")).toEqual([]);
    expect(codes("gramming")).toEqual([]);
  });
});
