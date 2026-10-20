import { describe, expect, it } from "vite-plus/test";
import type { ModFaculty } from "../../shared/schemas/faculty";
import { changedFields } from "./faculty";

const original: ModFaculty = {
  id: 1,
  name: "Sabbir Rahman",
  initials: "SfR1",
  designation: "Lecturer",
  department: "ECE",
  nsuPage: null,
  hidden: false,
};

describe("changedFields", () => {
  it("is empty when nothing changed", () => {
    const { id: _id, hidden: _hidden, ...same } = original;
    expect(changedFields(original, same)).toEqual({});
  });

  it("holds only the fields that changed, and null when a value is cleared", () => {
    expect(
      changedFields(original, {
        name: "Sabbir Rahman",
        initials: null,
        designation: "Professor",
        department: "ECE",
        nsuPage: "https://ece.northsouth.edu/people/s/",
      }),
    ).toEqual({
      initials: null,
      designation: "Professor",
      nsuPage: "https://ece.northsouth.edu/people/s/",
    });
  });
});
