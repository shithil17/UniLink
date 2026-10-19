import { describe, expect, it } from "vite-plus/test";
import { studentCourseInput } from "./courses.ts";

describe("studentCourseInput credits", () => {
  const base = { code: "BUS101", title: "Intro", category: "Electives" };

  it("asks for the credits instead of showing zod's NaN message", () => {
    for (const credits of [Number.NaN, undefined]) {
      const result = studentCourseInput.safeParse({ ...base, credits });
      expect(result.error?.issues[0].message).toBe("Enter the credits");
    }
  });

  it("still rejects zero and accepts halves", () => {
    expect(studentCourseInput.safeParse({ ...base, credits: 0 }).success).toBe(false);
    expect(studentCourseInput.safeParse({ ...base, credits: 1.5 }).success).toBe(true);
  });
});
