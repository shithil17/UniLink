import { describe, expect, it } from "vite-plus/test";
import { facultyTitle, normalizeWords, parseFacultyQuery } from "./facultySearch";

describe("normalizeWords", () => {
  it("lowercases, strips accents, drops titles and collapses dots", () => {
    expect(normalizeWords("Dr.  Zoë   Álvarez")).toEqual(["zoe", "alvarez"]);
    expect(normalizeWords("K. M. A. Salam")).toEqual(["k", "m", "a", "salam"]);
    expect(normalizeWords("Prof. Dr. Md. Rahman")).toEqual(["md", "rahman"]);
    expect(normalizeWords("Mohammad Ali")).toEqual(["mohammad", "ali"]);
  });
});

describe("parseFacultyQuery", () => {
  it("splits a query into name words and one initials string", () => {
    expect(parseFacultyQuery("Dr. Atiq  RAH")).toEqual({
      words: ["atiq", "rah"],
      initials: "dratiqrah",
    });
    expect(parseFacultyQuery("SfR1")).toEqual({ words: ["sfr1"], initials: "sfr1" });
    expect(parseFacultyQuery("Dr. Zoë Álvarez").words).toEqual(["zoe", "alvarez"]);
  });

  it("reads a blank query as no search", () => {
    expect(parseFacultyQuery("  ")).toEqual({ words: [], initials: "" });
    expect(parseFacultyQuery("Dr.").words).toEqual([]);
  });
});

describe("facultyTitle", () => {
  it("adds initials in brackets, unless there are none or the name has them", () => {
    expect(facultyTitle({ name: "M. Rokonuzzaman", initials: "RkZ" })).toBe(
      "M. Rokonuzzaman (RkZ)",
    );
    expect(facultyTitle({ name: "Tanzilur Rahman", initials: null })).toBe("Tanzilur Rahman");
    expect(facultyTitle({ name: "Atiqur Rahman (Aqu)", initials: "Aqu" })).toBe(
      "Atiqur Rahman (Aqu)",
    );
  });
});
