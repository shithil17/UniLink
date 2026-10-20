import { describe, expect, it } from "vite-plus/test";
import { pickChosenCode, slotLabel, type SlotChoice } from "./slotChoice.ts";

const eng: SlotChoice = {
  code: "ENG115",
  title: "Introduction to Composition",
  alternatives: [{ code: "BEN205", title: "Bangla Language and Literature" }],
};

let n = 0;
const attempt = (courseCode: string, grade: string, createdAt = ++n) => ({
  id: ++n,
  courseCode,
  grade,
  createdAt,
});

describe("slotLabel", () => {
  it("joins the codes with / and the titles with ' / ' until one is taken", () => {
    expect(slotLabel(eng)).toEqual({
      code: "ENG115/BEN205",
      title: "Introduction to Composition / Bangla Language and Literature",
      hasChoices: true,
      chosen: false,
      others: [{ code: "BEN205", title: "Bangla Language and Literature" }],
    });
  });

  it("keeps the slot code first and the alternatives in order", () => {
    const three: SlotChoice = {
      code: "PHY107L",
      title: "Physics Lab",
      alternatives: [
        { code: "CHE101L", title: "Chemistry Lab" },
        { code: "BIO101L", title: "Biology Lab" },
      ],
    };
    expect(slotLabel(three).code).toBe("PHY107L/CHE101L/BIO101L");
    expect(slotLabel({ ...three, chosenCode: null }).code).toBe("PHY107L/CHE101L/BIO101L");
  });

  it("shows the course taken once one is chosen, and names the others", () => {
    expect(slotLabel({ ...eng, chosenCode: "BEN205" })).toEqual({
      code: "BEN205",
      title: "Bangla Language and Literature",
      hasChoices: true,
      chosen: true,
      others: [{ code: "ENG115", title: "Introduction to Composition" }],
    });
    expect(slotLabel({ ...eng, chosenCode: "ENG115" }).code).toBe("ENG115");
  });

  it("prints a slot without alternatives as it is", () => {
    expect(
      slotLabel({ code: "CSE115", title: "Programming Language I", alternatives: [] }),
    ).toEqual({
      code: "CSE115",
      title: "Programming Language I",
      hasChoices: false,
      chosen: false,
      others: [],
    });
  });

  it("ignores a chosen code the slot does not offer", () => {
    expect(slotLabel({ ...eng, chosenCode: "XXX999" }).code).toBe("ENG115/BEN205");
  });
});

describe("pickChosenCode", () => {
  const codes = ["ENG115", "BEN205"];

  it("is null while no code has an attempt", () => {
    expect(pickChosenCode(codes, [])).toBeNull();
    expect(pickChosenCode(codes, [attempt("CSE115", "A")])).toBeNull();
  });

  it("takes the only code attempted, even a failed one", () => {
    expect(pickChosenCode(codes, [attempt("BEN205", "F")])).toBe("BEN205");
  });

  it("prefers a passing attempt to a later failed one", () => {
    expect(pickChosenCode(codes, [attempt("ENG115", "B"), attempt("BEN205", "F")])).toBe("ENG115");
  });

  it("prefers the better grade when both passed", () => {
    expect(pickChosenCode(codes, [attempt("ENG115", "B"), attempt("BEN205", "A-")])).toBe("BEN205");
  });

  it("ranks a waiver below a graded pass", () => {
    expect(pickChosenCode(codes, [attempt("ENG115", "WV"), attempt("BEN205", "D")])).toBe("BEN205");
  });

  it("falls back to the most recent attempt on a tie", () => {
    expect(pickChosenCode(codes, [attempt("ENG115", "F", 10), attempt("BEN205", "W", 20)])).toBe(
      "BEN205",
    );
    expect(pickChosenCode(codes, [attempt("ENG115", "B", 20), attempt("BEN205", "B", 10)])).toBe(
      "ENG115",
    );
  });
});
