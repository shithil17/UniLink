import { describe, expect, it } from "vite-plus/test";
import {
  facultyTitle,
  normalizeWords,
  searchFaculty,
  type SearchableFaculty,
} from "./facultySearch";

const f = (
  name: string,
  initials: string | null,
  department = "ECE",
  hidden = false,
): SearchableFaculty => ({ name, initials, department, hidden });

const LIST = [
  f("M. Rokonuzzaman", "RkZ"),
  f("Mohammad Rashedur Rahman", "RRn"),
  f("Hafiz Abdur Rahman", "HzR"),
  f("Atiqur Rahman (Aqu)", "Aqu"),
  f("Atiqur Rahman (AUQ)", "AUQ"),
  f("Sabbir Rahman", "SfR1"),
  f("Sadia Rahim", "SfR2", "LAW"),
  f("Tanzilur Rahman", null),
  f("Dr. Zoë Álvarez", "ZaL", "PHA"),
  f("Retired Person", "RtP", "ECE", true),
];
const names = (found: SearchableFaculty[]) => found.map((x) => x.name);

describe("normalizeWords", () => {
  it("lowercases, strips accents, drops titles and collapses dots", () => {
    expect(normalizeWords("Dr.  Zoë   Álvarez")).toEqual(["zoe", "alvarez"]);
    expect(normalizeWords("K. M. A. Salam")).toEqual(["k", "m", "a", "salam"]);
    expect(normalizeWords("Prof. Dr. Md. Rahman")).toEqual(["md", "rahman"]);
    expect(normalizeWords("Mohammad Ali")).toEqual(["mohammad", "ali"]);
  });
});

describe("searchFaculty", () => {
  it("matches name words by prefix, every word of the query", () => {
    expect(names(searchFaculty(LIST, { query: "rahman" }))).toEqual([
      "Atiqur Rahman (Aqu)",
      "Atiqur Rahman (AUQ)",
      "Hafiz Abdur Rahman",
      "Mohammad Rashedur Rahman",
      "Sabbir Rahman",
      "Tanzilur Rahman",
    ]);
    expect(names(searchFaculty(LIST, { query: "atiq rah" }))).toEqual([
      "Atiqur Rahman (Aqu)",
      "Atiqur Rahman (AUQ)",
    ]);
    expect(searchFaculty(LIST, { query: "man" })).toEqual([]);
  });

  it("ignores titles and accents in the query", () => {
    expect(names(searchFaculty(LIST, { query: "dr zoe alv" }))).toEqual(["Dr. Zoë Álvarez"]);
  });

  it("finds initials without regard to case", () => {
    expect(names(searchFaculty(LIST, { query: "RkZ" }))).toEqual(["M. Rokonuzzaman"]);
    expect(names(searchFaculty(LIST, { query: "rkz" }))).toEqual(["M. Rokonuzzaman"]);
  });

  it("matches initials by prefix, and a full code finds exactly that person", () => {
    expect(names(searchFaculty(LIST, { query: "sfr" }))).toEqual(["Sabbir Rahman", "Sadia Rahim"]);
    expect(names(searchFaculty(LIST, { query: "sfr1" }))).toEqual(["Sabbir Rahman"]);
  });

  it("ranks exact initials, then initials prefix, then names, then alphabetical", () => {
    const list = [
      f("Aaron Rkz Name", null),
      f("Zed", "Rkz"),
      f("Yan", "RkZa"),
      f("Bea Rkzed", null),
    ];
    expect(names(searchFaculty(list, { query: "rkz" }))).toEqual([
      "Zed",
      "Yan",
      "Aaron Rkz Name",
      "Bea Rkzed",
    ]);
  });

  it("returns everyone by name for an empty query, and handles missing initials", () => {
    const all = searchFaculty(LIST, { query: "  " });
    expect(all).toHaveLength(LIST.length - 1);
    expect(all[0]?.name).toBe("Atiqur Rahman (Aqu)");
    expect(names(searchFaculty(LIST, { query: "tanz" }))).toEqual(["Tanzilur Rahman"]);
  });

  it("filters by department, or shows all", () => {
    expect(names(searchFaculty(LIST, { query: "sfr", department: "LAW" }))).toEqual([
      "Sadia Rahim",
    ]);
    expect(searchFaculty(LIST, { department: "PHA" })).toHaveLength(1);
    expect(searchFaculty(LIST, { department: null })).toHaveLength(LIST.length - 1);
  });

  it("leaves hidden faculty out unless asked", () => {
    expect(searchFaculty(LIST, { query: "retired" })).toEqual([]);
    expect(names(searchFaculty(LIST, { query: "retired", includeHidden: true }))).toEqual([
      "Retired Person",
    ]);
    expect(names(searchFaculty(LIST, { query: "rtp" }))).toEqual([]);
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
