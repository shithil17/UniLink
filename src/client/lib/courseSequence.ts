import type { CourseMap, CourseStatus } from "../../shared/schemas/courses";
import type { PrereqRule } from "../../shared/prereq";

export const NODE_HEIGHT = 60;
export const ROW_GAP_Y = 15;
const ROUTE_CLEARANCE = 4;
const PARALLEL_GAP = 6;
const GUTTER_RUN_GAP = 24;
const PORT_MARGIN = 10;
// ceiling: fixed lane room between columns; revisit if a gutter ever needs more parallel lines.
const COLUMN_GUTTER = 100;
const MIN_NODE_WIDTH = 168;
const MAX_NODE_WIDTH = 300;
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
  gridLeft: number;
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
  const available = sheetWidth - LEFT_LABEL_WIDTH - RIGHT_TOTAL_WIDTH;
  const nodeWidth = Math.min(
    MAX_NODE_WIDTH,
    Math.max(MIN_NODE_WIDTH, available / columns - COLUMN_GUTTER),
  );
  // Boxes grow with the sheet up to the cap; the gutter stays fixed and, once boxes are capped,
  // the grid is centred instead of stretching the gaps.
  const columnWidth = Math.min(available / columns, nodeWidth + COLUMN_GUTTER);
  const gridLeft = LEFT_LABEL_WIDTH + (available - columnWidth * columns) / 2;
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
      position: { x: sheetWidth - RIGHT_TOTAL_WIDTH, y: row.y + ROW_GAP_Y },
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
          return parent ? [(parent.position.x - gridLeft + nodeWidth / 2) / columnWidth] : [];
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
      const y = row.y + ROW_GAP_Y;
      const x = gridLeft + col * columnWidth + (columnWidth - nodeWidth) / 2;
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
  const rowOf = (id: string) => Math.round(courseNodes.get(id)!.position.y / ROW_HEIGHT);
  const colOf = (id: string) => {
    const node = courseNodes.get(id)!;
    const center = node.position.x + (node.width ?? nodeWidth) / 2;
    return Math.min(columns - 1, Math.max(0, Math.floor((center - gridLeft) / columnWidth)));
  };
  const groupBy = <T, K>(items: T[], key: (item: T) => K) => {
    const groups = new Map<K, T[]>();
    for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
    return groups;
  };
  // Lines whose ranges meet (within `pad`) get separate lanes; lines that never meet can share one.
  const lanes = (items: { id: string; lo: number; hi: number }[], pad: number) => {
    const ends: number[] = [];
    const laneOf = new Map<string, number>();
    for (const item of [...items].sort((a, b) => a.lo - b.lo || a.hi - b.hi)) {
      let lane = ends.findIndex((end) => end + pad < item.lo);
      if (lane < 0) lane = ends.length;
      ends[lane] = item.hi;
      laneOf.set(item.id, lane);
    }
    return { laneOf, count: ends.length };
  };
  const place = (lane: number, count: number, from: number, to: number) =>
    from + ((to - from) * (lane + 0.5)) / count;

  // Decide how each line leaves its source and enters its target. Same-column neighbours stay
  // on the direct path; everything else leaves a side and enters a side beside the target column.
  type Side = "left" | "right" | "top" | "bottom";
  type Plan = { edge: SequenceEdge; exit: Side; enter: Side; gutter: number };
  const plans: Plan[] = [];
  const innerSide = (id: string): Side | null => {
    const node = courseNodes.get(id)!;
    if ((node.width ?? nodeWidth) >= nodeWidth - 1) return null;
    const mid = gridLeft + (colOf(id) + 0.5) * columnWidth;
    return node.position.x < mid ? "right" : "left";
  };
  for (const edge of edges) {
    const rowS = rowOf(edge.source);
    const rowT = rowOf(edge.target);
    const colS = colOf(edge.source);
    const colT = colOf(edge.target);
    if (rowT <= rowS || (rowT === rowS + 1 && colS === colT)) continue;
    let exit: Side;
    let enter: Side;
    let gutter: number;
    if (colS === colT) {
      exit = enter = colT < columns - 1 ? "right" : "left";
      gutter = exit === "right" ? colT + 1 : colT;
    } else {
      const east = colT > colS;
      exit = east ? "right" : "left";
      enter = east ? "left" : "right";
      gutter = east ? colT : colT + 1;
      const lo = Math.min(colS, colT) + 1;
      const hi = Math.max(colS, colT) - 1;
      const blocked = [...courseNodes.keys()].some(
        (id) => rowOf(id) === rowS && colOf(id) >= lo && colOf(id) <= hi,
      );
      if (blocked) exit = "bottom";
    }
    if (exit === innerSide(edge.source)) exit = "bottom";
    if (enter === innerSide(edge.target)) enter = "top";
    plans.push({ edge, exit, enter, gutter });
  }

  // Spread every use of a box side along it. Left-side ports sit in the upper half and right-side
  // ports in the lower half, so a run leaving one box never lines up with a run entering its
  // neighbour. Bottom ports use the left half and top ports the right half for the same reason.
  const ports = new Map<string, { x: number; y: number }>();
  const uses: { key: string; id: string; side: Side; other: string }[] = [];
  for (const { edge, exit, enter } of plans) {
    uses.push({ key: `source:${edge.id}`, id: edge.source, side: exit, other: edge.target });
    uses.push({ key: `target:${edge.id}`, id: edge.target, side: enter, other: edge.source });
  }
  for (const [, group] of groupBy(uses, (use) => `${use.id}:${use.side}`)) {
    const { id, side } = group[0]!;
    const node = courseNodes.get(id)!;
    const w = node.width ?? nodeWidth;
    const h = node.height ?? NODE_HEIGHT;
    const { x, y } = node.position;
    const ordered = [...group].sort((a, b) => {
      const na = courseNodes.get(a.other)!.position;
      const nb = courseNodes.get(b.other)!.position;
      return na.y - nb.y || na.x - nb.x;
    });
    ordered.forEach((use, index) => {
      const n = ordered.length;
      if (side === "left" || side === "right") {
        const [from, to] =
          side === "left" ? [y + PORT_MARGIN, y + h / 2 - 2] : [y + h / 2 + 2, y + h - PORT_MARGIN];
        ports.set(use.key, { x: side === "left" ? x : x + w, y: place(index, n, from, to) });
      } else {
        const [from, to] =
          side === "bottom"
            ? [x + PORT_MARGIN, x + w / 2 - 2]
            : [x + w / 2 + 2, x + w - PORT_MARGIN];
        ports.set(use.key, { x: place(index, n, from, to), y: side === "bottom" ? y + h : y });
      }
    });
  }

  const gutterX = new Map<string, number>();
  const half = Math.max(0, (columnWidth - nodeWidth) / 2 - ROUTE_CLEARANCE);
  for (const [gutter, group] of groupBy(plans, (plan) => plan.gutter)) {
    const { laneOf, count } = lanes(
      group.map(({ edge }) => {
        const start = ports.get(`source:${edge.id}`)!.y;
        const end = ports.get(`target:${edge.id}`)!.y;
        return { id: edge.id, lo: Math.min(start, end), hi: Math.max(start, end) };
      }),
      GUTTER_RUN_GAP,
    );
    const boundary = gridLeft + gutter * columnWidth;
    const from = gutter === 0 ? boundary + ROUTE_CLEARANCE : boundary - half;
    const to = gutter === columns ? boundary - ROUTE_CLEARANCE : boundary + half;
    for (const { edge } of group) {
      gutterX.set(edge.id, place(laneOf.get(edge.id)!, count, from, to));
    }
  }

  // Lines that drop out of the bottom of a box or come in over the top run along the row gap.
  const laneY = new Map<string, number>();
  const runs = new Map<number, { id: string; key: string; lo: number; hi: number }[]>();
  for (const { edge, exit, enter } of plans) {
    const gx = gutterX.get(edge.id)!;
    for (const [side, gap, end] of [
      [exit, rowOf(edge.source), "source"],
      [enter, rowOf(edge.target) - 1, "target"],
    ] as const) {
      if (side !== "bottom" && side !== "top") continue;
      const px = ports.get(`${end}:${edge.id}`)!.x;
      runs.set(gap, [
        ...(runs.get(gap) ?? []),
        {
          id: `${end}:${edge.id}`,
          key: `${end}:${edge.id}`,
          lo: Math.min(px, gx),
          hi: Math.max(px, gx),
        },
      ]);
    }
  }
  for (const [gap, items] of runs) {
    const { laneOf, count } = lanes(items, PARALLEL_GAP);
    const top = gap * ROW_HEIGHT + ROW_GAP_Y + NODE_HEIGHT + ROUTE_CLEARANCE;
    const bottom = (gap + 1) * ROW_HEIGHT + ROW_GAP_Y - ROUTE_CLEARANCE;
    for (const item of items) laneY.set(item.key, place(laneOf.get(item.id)!, count, top, bottom));
  }

  for (const { edge, exit, enter } of plans) {
    const gx = gutterX.get(edge.id)!;
    const start = ports.get(`source:${edge.id}`)!;
    const end = ports.get(`target:${edge.id}`)!;
    const points = [start];
    if (exit === "bottom") {
      const y = laneY.get(`source:${edge.id}`)!;
      points.push({ x: start.x, y }, { x: gx, y });
    } else {
      points.push({ x: gx, y: start.y });
    }
    if (enter === "top") {
      const y = laneY.get(`target:${edge.id}`)!;
      points.push({ x: gx, y }, { x: end.x, y });
    } else {
      points.push({ x: gx, y: end.y });
    }
    points.push(end);
    edge.data.points = points.filter(
      (point, index) =>
        index === 0 || point.x !== points[index - 1]!.x || point.y !== points[index - 1]!.y,
    );
  }
  return {
    nodes,
    edges,
    rows,
    width: sheetWidth,
    height: groups.length * ROW_HEIGHT,
    columns,
    columnWidth,
    gridLeft,
    creditNotes,
  };
}
