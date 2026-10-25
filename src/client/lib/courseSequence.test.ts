import curriculum from "../../../data/curricula/42-cse.json";
import { describe, expect, it } from "vite-plus/test";
import { curriculumImport, type CourseMap } from "../../shared/schemas/courses";
import { LEFT_LABEL_WIDTH, layoutCourseSequence, type SequenceCourse } from "./courseSequence";

function mapFromCurriculum(): CourseMap {
  const parsed = curriculumImport.parse(curriculum);
  const names = [...new Set(parsed.courses.map((course) => course.category))];
  return {
    curriculum: null,
    degree: { required: parsed.totalCredits, earned: 0 },
    categories: names.map((name) => ({
      name,
      required: 0,
      earned: 0,
      trails: null,
      slots: parsed.courses
        .filter((course) => course.category === name)
        .map((course) => ({
          ...course,
          status: "locked" as const,
          filledBy: null,
          chosenCode: null,
          waived: false,
          studentCourse: null,
        })),
    })),
    extras: [],
  };
}

const base = (over: Partial<CourseMap["categories"][number]["slots"][number]> = {}) => ({
  kind: "course" as const,
  code: "CSE101",
  title: "Course",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  status: "locked" as const,
  filledBy: null,
  chosenCode: null,
  waived: false,
  studentCourse: null,
  ...over,
});

function mapWith(
  slots: CourseMap["categories"][number]["slots"][],
  extras: CourseMap["extras"] = [],
): CourseMap {
  return {
    curriculum: null,
    degree: { required: 0, earned: 0 },
    categories: slots.map((rows, i) => ({
      name: `Category ${i + 1}`,
      required: 0,
      earned: 0,
      trails: null,
      slots: rows,
    })),
    extras,
  };
}

describe("layoutCourseSequence", () => {
  it("sums the CSE course rows to 130 credits, excluding non-credit courses", () => {
    const layout = layoutCourseSequence(mapFromCurriculum());
    expect(layout.rows.reduce((sum, row) => sum + row.credits, 0)).toBe(130);
    expect(layout.rows).toHaveLength(12);
  });

  it("uses a compact grid with at least four columns and puts general education at the right", () => {
    const layout = layoutCourseSequence(mapFromCurriculum(), undefined, 1600);
    const courseNodes = layout.nodes.filter((node) => node.type === "sequenceCourse");
    const busiest = Math.max(
      ...layout.rows.map(
        (row) =>
          courseNodes.filter(
            (node) => node.position.y >= row.y && node.position.y < row.y + row.height,
          ).length,
      ),
    );
    expect(layout.columns).toBeGreaterThanOrEqual(4);
    expect(layout.columns).toBe(busiest);
    const geCourses = courseNodes.filter((node) =>
      /general education|\bGED\b/i.test((node.data as SequenceCourse).category),
    );
    expect(geCourses.length).toBeGreaterThan(0);
    expect(
      geCourses.every(
        (node) =>
          Math.floor(
            (node.position.x - LEFT_LABEL_WIDTH + (node.width ?? 0) / 2) / layout.columnWidth,
          ) ===
          layout.columns - 1,
      ),
    ).toBe(true);
  });

  it("keeps the MAT prerequisite chain in one column", () => {
    const layout = layoutCourseSequence(mapFromCurriculum(), undefined, 1600);
    const columns = ["MAT116", "MAT120", "MAT130", "MAT250", "MAT350"].map((code) => {
      const node = layout.nodes.find((item) => item.id === code)!;
      return Math.floor(
        (node.position.x - LEFT_LABEL_WIDTH + (node.width ?? 0) / 2) / layout.columnWidth,
      );
    });
    expect(new Set(columns).size).toBe(1);
  });

  it("routes the ENG103 to ENG115 skip through a gutter around intervening courses", () => {
    const layout = layoutCourseSequence(mapFromCurriculum(), undefined, 1600);
    const edge = layout.edges.find((item) => item.source === "ENG103" && item.target === "ENG115")!;
    expect(edge.data.points).toBeDefined();
    const blockers = ["ENG111", "PHI104"].map((id) => layout.nodes.find((node) => node.id === id)!);
    const points = edge.data.points!;
    for (const blocker of blockers) {
      const left = blocker.position.x;
      const right = left + blocker.width!;
      const top = blocker.position.y;
      const bottom = top + blocker.height!;
      for (const point of points) {
        expect(point.x > left && point.x < right && point.y > top && point.y < bottom).toBe(false);
      }
      for (const [start, end] of points.slice(1).map((point, index) => [points[index]!, point])) {
        const crossesVertically = start.x === end.x && start.x > left && start.x < right;
        const crossesHorizontally = start.y === end.y && start.y > top && start.y < bottom;
        expect(
          crossesVertically && Math.max(start.y, end.y) > top && Math.min(start.y, end.y) < bottom,
        ).toBe(false);
        expect(
          crossesHorizontally &&
            Math.max(start.x, end.x) > left &&
            Math.min(start.x, end.x) < right,
        ).toBe(false);
      }
    }
  });

  it("keeps adjacent-row prerequisite edges on the direct route", () => {
    const layout = layoutCourseSequence(
      mapWith([[base(), base({ code: "CSE102", semester: 2, prereq: { course: "CSE101" } })]]),
    );
    const edge = layout.edges.find((item) => item.source === "CSE101" && item.target === "CSE102")!;
    expect(edge.data.points).toBeUndefined();
  });

  it("assigns a different mark to each credit threshold", () => {
    const layout = layoutCourseSequence(mapFromCurriculum());
    const courses = new Map(
      layout.nodes
        .filter((node) => node.type === "sequenceCourse")
        .map((node) => [node.id, node.data as SequenceCourse]),
    );
    expect(courses.get("CSE299")?.creditMark).toBe("†");
    expect(courses.get("CSE499A")?.creditMark).toBe("‡");
    expect(layout.creditNotes.find((note) => note.credits === 60)?.mark).toBe("†");
    expect(layout.creditNotes.find((note) => note.credits === 100)?.mark).toBe("‡");
  });

  it("merges same-semester labs and splits the merged node on request", () => {
    const map = mapWith([[base(), base({ code: "CSE101L", title: "Course Lab", credits: 1 })]]);
    const merged = layoutCourseSequence(map);
    expect(merged.nodes.filter((node) => node.type === "sequenceCourse")).toHaveLength(1);
    expect(
      (merged.nodes.find((node) => node.type === "sequenceCourse")!.data as { code: string }).code,
    ).toBe("CSE101 + L");
    const split = layoutCourseSequence(map, "CSE101");
    expect(
      split.nodes.filter((node) => node.type === "sequenceCourse").map((node) => node.id),
    ).toEqual(["CSE101", "CSE101L"]);
    expect(split.rows[0]?.credits).toBe(4);
  });

  it("keeps nested any edges dashed, other prerequisites solid and credits as a note", () => {
    const map = mapWith([
      [
        base(),
        base({
          code: "CSE102",
          semester: 2,
          prereq: {
            all: [
              { course: "CSE101" },
              { any: [{ course: "MAT101" }, { course: "PHY101" }] },
              { credits: 30 },
            ],
          },
        }),
        base({ code: "MAT101", category: "Math", semester: 1 }),
        base({ code: "PHY101", category: "Math", semester: 1 }),
      ],
      [],
    ]);
    const layout = layoutCourseSequence(map);
    expect(
      layout.edges.filter((edge) => edge.target === "CSE102").map((edge) => edge.data.dashed),
    ).toEqual([false, true, true]);
    expect(
      (layout.nodes.find((node) => node.id === "CSE102")!.data as { note?: string }).note,
    ).toBe("after 30 credits");
    expect(layout.creditNotes).toEqual([{ code: "CSE102", credits: 30, mark: "†" }]);
  });

  it("points alternatives to their containing slot, preserves curriculum order and includes null rows", () => {
    const map = mapWith([
      [
        base({ code: "CSE201", semester: null, prereq: { course: "ALT101" } }),
        base({ code: "CSE200", semester: null }),
        base({ code: "CSE202", semester: null }),
        base({
          code: "BASE101",
          semester: 1,
          alternatives: [{ code: "ALT101", title: "Alternate" }],
        }),
      ],
    ]);
    const layout = layoutCourseSequence(map);
    expect(layoutCourseSequence(map).nodes.map((node) => [node.id, node.position])).toEqual(
      layout.nodes.map((node) => [node.id, node.position]),
    );
    expect(layout.edges.some((edge) => edge.source === "BASE101" && edge.target === "CSE201")).toBe(
      true,
    );
    expect(layout.rows.map((row) => row.label)).toEqual(["1st", "Unscheduled"]);
    const unscheduled = layout.nodes.filter(
      (node) => node.type === "sequenceCourse" && node.position.y === layout.rows[1]?.y + 10,
    );
    expect(unscheduled.map((node) => node.id)).toEqual(["CSE201", "CSE200", "CSE202"]);
  });
});
