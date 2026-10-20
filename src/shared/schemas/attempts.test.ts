import { describe, expect, it } from "vite-plus/test";
import { attemptFullInput, attemptInput, attemptUpdate } from "./attempts";

const base = { courseCode: "CSE115", grade: "A" };
const term = { year: 2024, season: "fall" };

describe("attempt forms", () => {
  it("the quick form keeps term and faculty optional", () => {
    expect(attemptInput.safeParse(base).success).toBe(true);
    expect(attemptInput.safeParse({ ...base, term: null, facultyId: null }).success).toBe(true);
  });

  it("the full form requires a term", () => {
    expect(attemptFullInput.safeParse(base).success).toBe(false);
    expect(attemptFullInput.safeParse({ ...base, term: null }).success).toBe(false);
    expect(attemptFullInput.safeParse({ ...base, term }).success).toBe(true);
    expect(attemptFullInput.safeParse({ ...base, term, facultyId: 3 }).success).toBe(true);
  });

  it("an edit changes at least one field and never the course", () => {
    expect(attemptUpdate.safeParse({}).success).toBe(false);
    expect(attemptUpdate.safeParse({ grade: "B" }).success).toBe(true);
    expect(attemptUpdate.safeParse({ facultyId: null }).success).toBe(true);
    expect(attemptUpdate.safeParse({ grade: "Z" }).success).toBe(false);
  });
});
