import { describe, expect, it } from "vite-plus/test";
import type { CourseMap } from "../../shared/schemas/courses";
import { selectHomeState, unlockedNext, UNLOCKED_NEXT_MAX } from "./home";

const ok = <T>(data: T) => ({ status: "success" as const, data });
const pending = { status: "pending" as const, data: undefined };
const failed = { status: "error" as const, data: undefined };
const user = { username: "sam" };
const mapWith = (curriculum: object | null) => ok({ curriculum } as Pick<CourseMap, "curriculum">);

describe("selectHomeState", () => {
  it("shows loading while the session check runs", () => {
    expect(selectHomeState(pending, pending)).toBe("loading");
  });

  it("shows the error state when the session check fails (not a 401)", () => {
    expect(selectHomeState(failed, pending)).toBe("error");
  });

  it("is signed out only when the session resolved to null", () => {
    expect(selectHomeState(ok(null), pending)).toBe("signedOut");
  });

  it("waits for the course map, then reports its failure", () => {
    expect(selectHomeState(ok(user), pending)).toBe("loading");
    expect(selectHomeState(ok(user), failed)).toBe("error");
  });

  it("is empty without a curriculum and ready with one", () => {
    expect(selectHomeState(ok(user), mapWith(null))).toBe("empty");
    expect(selectHomeState(ok(user), mapWith({ id: 1 }))).toBe("ready");
  });
});

const slot = (code: string, over: Partial<CourseMap["categories"][number]["slots"][number]> = {}) =>
  ({
    kind: "course",
    code,
    title: code,
    credits: 3,
    category: "Core",
    nonCredit: false,
    semester: 1,
    alternatives: [],
    prereq: null,
    status: "available",
    filledBy: null,
    waived: false,
    studentCourse: null,
    ...over,
  }) as CourseMap["categories"][number]["slots"][number];

const category = (slots: ReturnType<typeof slot>[]) => ({
  name: "Core",
  required: 0,
  earned: 0,
  slots,
});

describe("unlockedNext", () => {
  it("keeps only available fixed courses, earliest semester first, no semester last", () => {
    const { items, total } = unlockedNext({
      categories: [
        category([
          slot("C", { semester: null }),
          slot("B", { semester: 3 }),
          slot("DONE", { status: "done" }),
          slot("LOCK", { status: "locked" }),
          slot("ELECT1", { kind: "elective" }),
          slot("A", { semester: 2 }),
          slot("A2", { semester: 2 }),
        ]),
      ],
    });
    expect(items.map((s) => s.code)).toEqual(["A", "A2", "B", "C"]);
    expect(total).toBe(4);
  });

  it("caps the list but still reports the full count", () => {
    const many = Array.from({ length: UNLOCKED_NEXT_MAX + 3 }, (_, i) => slot(`X${i}`));
    const { items, total } = unlockedNext({ categories: [category(many)] });
    expect(items).toHaveLength(UNLOCKED_NEXT_MAX);
    expect(total).toBe(UNLOCKED_NEXT_MAX + 3);
  });
});
