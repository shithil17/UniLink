import type { CourseMap, CourseStatus } from "../../shared/schemas/courses";
import type { PrereqRule } from "../../shared/prereq";

export const NODE_HEIGHT = 60;
export const ROW_GAP_Y = 8;
export const ROW_HEADER_HEIGHT = 36;
export const ROW_HEIGHT = NODE_HEIGHT + ROW_GAP_Y * 2;
export const LEFT_LABEL_WIDTH = 112;
export const RIGHT_TOTAL_WIDTH = 76;
const MIN_COLUMNS = 4;

export type SequenceCourse = {
  id: string;
  code: string;
  title: string;
  credits: number;
  totalCredits: number;
  status: CourseStatus;
  waived: boolean;
  nonCredit: boolean;
  prereq: PrereqRule | null;
  category: string;
  slots: CourseMap["categories"][number]["slots"][number][];
  extra?: CourseMap["extras"][number];
  mergedLab?: CourseMap["categories"][number]["slots"][number];
  split?: boolean;
  note?: string;
  creditMark?: string;
  electiveHint?: string;
};

export type SequenceNode = {
  id: string;
  type: "sequenceCourse" | "sequenceRow" | "sequenceTotal";
  position: { x: number; y: number };
  data: SequenceCourse | { label: string; alternate: boolean } | { credits: number };
  width?: number;
  height?: number;
  draggable: false;
  selectable: false;
  connectable: false;
  zIndex?: number;
};

export type SequenceEdge = {
  id: string;
  source: string;
  target: string;
  type: "sequence";
  animated: false;
  data: { dashed: boolean; points?: { x: number; y: number }[] };
};

export type SequenceLayout = {
  nodes: SequenceNode[];
  edges: SequenceEdge[];
  rows: { id: string; label: string; credits: number; y: number; height: number }[];
  width: number;
  height: number;
  columns: number;
  columnWidth: number;
  creditNotes: { code: string; credits: number; mark: string }[];
};

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];

function courseForSlot(slot: Slot, category: string): SequenceCourse {
  const filler = slot.kind === "elective" ? slot.studentCourse : null;
  return {
    id: slot.code,
    code: filler?.code ?? slot.code,
    title: filler?.title ?? slot.title,
    credits: filler?.credits ?? slot.credits,
    totalCredits: slot.nonCredit ? 0 : (filler?.credits ?? slot.credits),
    status: filler ? (filler.done ? "done" : "available") : slot.status,
    waived: filler?.waived ?? slot.waived,
    nonCredit: slot.nonCredit,
    prereq: slot.prereq,
    category,
    slots: [slot],
  };
}

function getCourses(map: CourseMap, expanded?: string) {
  const categories = map.categories.map((category) => {
    const byCode = new Map(category.slots.map((slot) => [slot.code, slot]));
    const consumed = new Set<string>();
    const courses: SequenceCourse[] = [];
    for (const slot of category.slots) {
      if (consumed.has(slot.code)) continue;
      const theory =
        slot.kind === "course" && slot.code.endsWith("L")
          ? byCode.get(slot.code.slice(0, -1))
          : undefined;
      if (theory?.kind === "course" && theory.semester === slot.semester) {
        consumed.add(slot.code);
        continue;
      }
      const lab = slot.kind === "course" ? byCode.get(`${slot.code}L`) : undefined;
      if (lab?.kind === "course" && lab.semester === slot.semester) {
        consumed.add(lab.code);
        const main = courseForSlot(slot, category.name);
        courses.push({
          ...main,
          code: `${slot.code} + L`,
          credits: main.credits + (slot.nonCredit ? 0 : lab.credits),
          totalCredits: main.totalCredits + (lab.nonCredit ? 0 : lab.credits),
          nonCredit: slot.nonCredit && lab.nonCredit,
          slots: [slot, lab],
          mergedLab: lab,
          split: expanded === slot.code,
        });
      } else {
        const course = courseForSlot(slot, category.name);
        if (slot.kind === "elective" && !slot.studentCourse) {
          course.electiveHint = category.trails ? "Pick from a trail" : "Any discipline";
        }
        courses.push(course);
      }
      consumed.add(slot.code);
    }
    return courses;
  });
  const extras = map.extras.map((course) => ({
    id: `extra:${course.id}`,
    code: course.code,
    title: course.title,
    credits: course.credits,
    totalCredits: course.credits,
    status: course.done ? ("done" as const) : ("available" as const),
    waived: course.waived,
    nonCredit: false,
    prereq: null,
    category: "",
    slots: [],
    extra: course,
  }));
  return { categories, extras };
}

function rowGroups(categories: SequenceCourse[][], extras: SequenceCourse[]) {
  const semesters = [
    ...new Set(
      categories.flatMap((courses) =>
        courses.flatMap((course) => course.slots.slice(0, 1).map((slot) => slot.semester)),
      ),
    ),
  ]
    .filter((semester): semester is number => semester !== null)
    .sort((a, b) => a - b);
  const groups = semesters.map((semester) => ({
    id: `semester:${semester}`,
    label: ordinal(semester),
    courses: categories.map((courses) =>
      courses.filter((course) => course.slots[0]?.semester === semester),
    ),
    extras: [] as SequenceCourse[],
  }));
  if (categories.some((courses) => courses.some((course) => course.slots[0]?.semester === null))) {
    groups.push({
      id: "unscheduled",
      label: "Unscheduled",
      courses: categories.map((courses) =>
        courses.filter((course) => course.slots[0]?.semester === null),
      ),
      extras: [],
    });
  }
  if (extras.length) groups.push({ id: "extras", label: "Extra courses", courses: [], extras });
  return groups;
}

export function ordinal(value: number) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] ?? "th");
  return `${value}${suffix}`;
}

function leafRules(rule: PrereqRule | null, underAny = false): { code: string; dashed: boolean }[] {
  if (!rule) return [];
  if ("course" in rule) return [{ code: rule.course, dashed: underAny }];
  if ("credits" in rule) return [];
  return ("all" in rule ? rule.all : rule.any).flatMap((child) =>
    leafRules(child, underAny || "any" in rule),
  );
}

function creditLeaves(rule: PrereqRule | null): number[] {
  if (!rule || "course" in rule) return [];
  if ("credits" in rule) return [rule.credits];
  return ("all" in rule ? rule.all : rule.any).flatMap(creditLeaves);
}

function creditMark(index: number) {
  return ["†", "‡", "§", "¶"][index] ?? String(index - 3);
}

function lockedNode(
  course: SequenceCourse,
  x: number,
  y: number,
  width: number,
  height = NODE_HEIGHT,
): SequenceNode {
  return {
    id: course.id,
    type: "sequenceCourse",
    position: { x, y },
    data: course,
    width,
    height,
    draggable: false,
    selectable: false,
    connectable: false,
  };
}

/** Deterministic compact grid; width is the available sheet width in CSS pixels. */
export function layoutCourseSequence(
  map: CourseMap,
  expanded?: string,
  width = 1200,
): SequenceLayout {
  const { categories, extras } = getCourses(map, expanded);
  const groups = rowGroups(categories, extras);
  const rowCourses = groups.map((group) => [...group.courses.flat(), ...group.extras]);
  const columns = Math.max(MIN_COLUMNS, ...rowCourses.map((courses) => courses.length));
  const sheetWidth = width;
  const columnWidth = (sheetWidth - LEFT_LABEL_WIDTH - RIGHT_TOTAL_WIDTH) / columns;
  const nodeWidth = columnWidth * 0.9;
  const rows = groups.map((group, i) => ({
    id: group.id,
    label: group.label,
    credits: rowCourses[i]!.reduce((sum, course) => sum + course.totalCredits, 0),
    y: i * ROW_HEIGHT,
    height: ROW_HEIGHT,
  }));
  const nodes: SequenceNode[] = [];
  const codeToNode = new Map<string, string>();
  for (const [i, group] of groups.entries()) {
    const row = rows[i]!;
    nodes.push({
      id: `row:${group.id}`,
      type: "sequenceRow",
      position: { x: 0, y: row.y },
      data: { label: row.label, alternate: i % 2 === 1 },
      width: sheetWidth,
      height: row.height,
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -1,
    });
    nodes.push({
      id: `total:${group.id}`,
      type: "sequenceTotal",
      position: { x: sheetWidth - RIGHT_TOTAL_WIDTH, y: row.y + 10 },
      data: { credits: row.credits },
      width: RIGHT_TOTAL_WIDTH,
      height: NODE_HEIGHT,
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 2,
    });
    const ordered = rowCourses[i]!.map((course, index) => ({ course, index })).sort(
      (a, b) =>
        Number(Boolean(b.course.prereq)) - Number(Boolean(a.course.prereq)) || a.index - b.index,
    );
    const occupied = new Set<number>();
    for (const { course } of ordered) {
      const genEd = /general education|\bGED\b/i.test(course.category);
      const genEdCount = rowCourses[i]!.filter((item) =>
        /general education|\bGED\b/i.test(item.category),
      ).length;
      let col: number;
      if (genEd) {
        col = columns - 1;
        while (occupied.has(col)) col--;
      } else {
        const prereqColumns = leafRules(course.prereq).flatMap(({ code }) => {
          const id = codeToNode.get(code);
          const parent = id ? nodes.find((node) => node.id === id) : undefined;
          return parent
            ? [(parent.position.x - LEFT_LABEL_WIDTH + nodeWidth / 2) / columnWidth]
            : [];
        });
        const preferred = prereqColumns.length
          ? prereqColumns.reduce((sum, col) => sum + col, 0) / prereqColumns.length
          : 0;
        const free = Array.from({ length: columns }, (_, col) => col).filter(
          (candidate) => !occupied.has(candidate) && candidate < columns - genEdCount,
        );
        col = free.reduce(
          (best, candidate) =>
            Math.abs(candidate - preferred) < Math.abs(best - preferred) ? candidate : best,
          free[0] ?? 0,
        );
      }
      const y = row.y + 10;
      const x = LEFT_LABEL_WIDTH + col * columnWidth + (columnWidth - nodeWidth) / 2;
      if (course.split && course.mergedLab) {
        const [theorySlot, labSlot] = course.slots;
        const half = (nodeWidth - 4) / 2;
        const theory = {
          ...course,
          id: theorySlot!.code,
          code: theorySlot!.code,
          title: theorySlot!.title,
          credits: theorySlot!.credits,
          slots: [theorySlot!],
          mergedLab: undefined,
          split: false,
        };
        const lab = {
          ...course,
          id: labSlot!.code,
          code: labSlot!.code,
          title: labSlot!.title,
          credits: labSlot!.credits,
          status: labSlot!.status,
          waived: labSlot!.waived,
          slots: [labSlot!],
          mergedLab: undefined,
          split: false,
        };
        nodes.push(lockedNode(theory, x, y, half), lockedNode(lab, x + half + 4, y, half));
        codeToNode.set(theorySlot!.code, theory.id);
        codeToNode.set(labSlot!.code, lab.id);
        occupied.add(col);
      } else {
        nodes.push(lockedNode(course, x, y, nodeWidth));
        for (const slot of course.slots) {
          codeToNode.set(slot.code, course.id);
          for (const alt of slot.alternatives) codeToNode.set(alt.code, course.id);
          if (slot.studentCourse) codeToNode.set(slot.studentCourse.code, course.id);
        }
        codeToNode.set(course.code, course.id);
        occupied.add(col);
      }
    }
  }
  const edges: SequenceEdge[] = [];
  const creditNotes: { code: string; credits: number; mark: string }[] = [];
  const creditThresholds = [
    ...new Set(
      nodes.flatMap((node) =>
        node.type === "sequenceCourse" ? creditLeaves((node.data as SequenceCourse).prereq) : [],
      ),
    ),
  ].sort((a, b) => a - b);
  const marks = new Map(creditThresholds.map((credits, index) => [credits, creditMark(index)]));
  for (const node of nodes.filter((entry) => entry.type === "sequenceCourse")) {
    const course = node.data as SequenceCourse;
    const credits = creditLeaves(course.prereq);
    if (credits.length) {
      course.note = `after ${credits.join(" or ")} credits`;
      course.creditMark = marks.get(credits[0]!);
      creditNotes.push({ code: course.code, credits: credits[0]!, mark: marks.get(credits[0]!)! });
    }
    for (const leaf of leafRules(course.prereq)) {
      const source = codeToNode.get(leaf.code);
      if (
        !source ||
        source === node.id ||
        edges.some(
          (edge) => edge.id === `${source}->${node.id}:${leaf.code}:${leaf.dashed ? "any" : "all"}`,
        )
      )
        continue;
      edges.push({
        id: `${source}->${node.id}:${leaf.code}:${leaf.dashed ? "any" : "all"}`,
        source,
        target: node.id,
        type: "sequence",
        animated: false,
        data: { dashed: leaf.dashed },
      });
    }
  }
  const courseNodes = new Map(
    nodes.filter((node) => node.type === "sequenceCourse").map((node) => [node.id, node]),
  );
  const routedGutters = new Map<number, number>();
  const gutterCounts = new Map<number, number>();
  for (const edge of edges) {
    const source = courseNodes.get(edge.source)!;
    const target = courseNodes.get(edge.target)!;
    if (target.position.y - source.position.y > ROW_HEIGHT) {
      const targetColumn = Math.floor(
        (target.position.x + (target.width ?? nodeWidth) / 2 - LEFT_LABEL_WIDTH) / columnWidth,
      );
      const gutter = targetColumn === 0 ? 1 : targetColumn;
      gutterCounts.set(gutter, (gutterCounts.get(gutter) ?? 0) + 1);
    }
  }
  for (const edge of edges) {
    const source = courseNodes.get(edge.source)!;
    const target = courseNodes.get(edge.target)!;
    if (target.position.y - source.position.y <= ROW_HEIGHT) continue;
    const sourceX = source.position.x + (source.width ?? nodeWidth) / 2;
    const targetX = target.position.x + (target.width ?? nodeWidth) / 2;
    const targetColumn = Math.floor((targetX - LEFT_LABEL_WIDTH) / columnWidth);
    const gutter = targetColumn === 0 ? 1 : targetColumn;
    const index = routedGutters.get(gutter) ?? 0;
    routedGutters.set(gutter, index + 1);
    const count = gutterCounts.get(gutter)!;
    const spread = Math.min(6, columnWidth * 0.7);
    const offset = count < 2 ? 0 : (index / (count - 1) - 0.5) * spread;
    const gutterX = LEFT_LABEL_WIDTH + gutter * columnWidth + offset;
    const sourceBottom = source.position.y + (source.height ?? NODE_HEIGHT);
    const targetTop = target.position.y;
    const belowSource = sourceBottom + ROW_GAP_Y / 2;
    const aboveTarget = targetTop - ROW_GAP_Y / 2;
    edge.data.points = [
      { x: sourceX, y: sourceBottom },
      { x: sourceX, y: belowSource },
      { x: gutterX, y: belowSource },
      { x: gutterX, y: aboveTarget },
      { x: targetX, y: aboveTarget },
      { x: targetX, y: targetTop },
    ];
  }
  return {
    nodes,
    edges,
    rows,
    width: sheetWidth,
    height: groups.length * ROW_HEIGHT,
    columns,
    columnWidth,
    creditNotes,
  };
}
