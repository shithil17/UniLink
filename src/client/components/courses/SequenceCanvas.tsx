import "@xyflow/react/dist/style.css";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StateMark } from "@/components/courses/StateMark";
import { focusRing } from "@/components/ui/focus";
import { courseHue } from "@/lib/courseHue";
import { formatCredits } from "@/lib/courseMap";
import { STATE_LABEL, stateKind } from "@/lib/stateKind";
import {
  LEFT_LABEL_WIDTH,
  RIGHT_TOTAL_WIDTH,
  layoutCourseSequence,
  type SequenceCourse,
  type SequenceLayout,
  type SequenceNode,
} from "@/lib/courseSequence";
import type { CourseMap } from "../../../shared/schemas/courses";

type CourseData = SequenceCourse & {
  onActivate: (id: string) => void;
  onHighlight: (id: string | null) => void;
};
type FlowNode = Node<CourseData | { label: string; alternate: boolean } | { credits: number }>;

function CourseNode({ id, data }: NodeProps<FlowNode>) {
  if (!("code" in data)) return null;
  const course = data as CourseData;
  const slot = course.slots[0];
  const openElective = slot?.kind === "elective" && !slot.studentCourse;
  const state = stateKind(course.status, course.waived);
  const label = `${course.code}, ${course.title}, ${STATE_LABEL[state]}${course.note ? `, ${course.note}` : ""}`;
  return (
    <>
      <Handle type="target" position={Position.Top} className="sequence-handle" />
      <button
        type="button"
        aria-label={label}
        data-hue={courseHue(slot?.code ?? course.code)}
        className={`sequence-course nodrag flex h-full w-full items-center gap-2 rounded-row bg-hue px-2.5 text-left ${focusRing}`}
        onClick={() => course.onActivate(id)}
        onFocus={() => course.onHighlight(id)}
        onBlur={() => course.onHighlight(null)}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="block truncate text-[14px] leading-[18px] font-semibold tracking-[0.01em] text-hue-ink tabular-nums">
              {openElective ? slot.code : course.code}
            </span>
            {course.note ? (
              <span aria-label={course.note} className="text-[12px] font-semibold text-hue-ink">
                †
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[12px] leading-4 text-soft">
            {openElective ? course.electiveHint : course.title}
          </span>
        </span>
        <StateMark status={course.status} waived={course.waived} inCourse size={18} />
      </button>
      <Handle type="source" position={Position.Bottom} className="sequence-handle" />
    </>
  );
}

function RowNode({ data }: NodeProps<FlowNode>) {
  if (!("label" in data)) return null;
  return (
    <div className={`sequence-band ${data.alternate ? "bg-tint" : "bg-surface"}`}>
      <span>{data.label}</span>
    </div>
  );
}

function TotalNode({ data }: NodeProps<FlowNode>) {
  if (!("credits" in data)) return null;
  return (
    <div className="flex h-full items-center justify-end pr-3 text-[13px] font-medium tabular-nums text-soft">
      {formatCredits(data.credits)}
    </div>
  );
}

const nodeTypes = { sequenceCourse: CourseNode, sequenceRow: RowNode, sequenceTotal: TotalNode };

function asFlow(
  layout: SequenceLayout,
  activate: (id: string) => void,
  highlight: (id: string | null) => void,
) {
  return {
    nodes: layout.nodes.map((node: SequenceNode) => ({
      ...node,
      data:
        node.type === "sequenceCourse"
          ? { ...node.data, onActivate: activate, onHighlight: highlight }
          : node.data,
    })) as FlowNode[],
    edges: layout.edges.map((edge) => ({
      ...edge,
      style: {
        stroke: "var(--color-edge)",
        strokeWidth: 1.25,
        strokeDasharray: edge.data.dashed ? "5 4" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--color-edge)",
        width: 14,
        height: 14,
      },
    })) as Edge[],
  };
}

function connections(layout: SequenceLayout, active: string | null) {
  if (!active) return null;
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const edge of layout.edges) {
    parents.set(edge.target, [...(parents.get(edge.target) ?? []), edge.source]);
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  }
  const visited = new Set([active]);
  for (const links of [parents, children]) {
    const queue = [active];
    while (queue.length)
      for (const next of links.get(queue.shift()!) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
  }
  return visited;
}

export function SequenceCanvas({
  map,
  onOpen,
}: {
  map: CourseMap;
  onOpen: (
    target:
      | { type: "slot"; slot: CourseMap["categories"][number]["slots"][number] }
      | { type: "extra"; course: CourseMap["extras"][number] },
  ) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry?.contentRect.width ?? 0);
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layout = useMemo(
    () => layoutCourseSequence(map, expanded ?? undefined, width || 1200),
    [map, expanded, width],
  );
  const activate = useCallback(
    (id: string) => {
      const course = layout.nodes.find((node) => node.type === "sequenceCourse" && node.id === id)
        ?.data as SequenceCourse | undefined;
      if (!course) return;
      if (course.mergedLab && !course.split) {
        setExpanded(course.slots[0]!.code);
        setActive(course.slots[0]!.code);
        return;
      }
      if (course.extra) onOpen({ type: "extra", course: course.extra });
      else if (course.slots[0]) onOpen({ type: "slot", slot: course.slots[0] });
    },
    [layout.nodes, onOpen],
  );
  const highlight = useCallback((id: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    if (id) setActive(id);
    else hoverTimer.current = setTimeout(() => setActive(null), 100);
  }, []);
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  const graph = useMemo(() => asFlow(layout, activate, setActive), [layout, activate]);
  const highlighted = useMemo(() => connections(layout, active), [layout, active]);
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        style:
          node.type === "sequenceCourse" && highlighted && !highlighted.has(node.id)
            ? { opacity: 0.2 }
            : undefined,
      })),
    [graph.nodes, highlighted],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        style: {
          ...edge.style,
          opacity:
            highlighted && (!highlighted.has(edge.source) || !highlighted.has(edge.target))
              ? 0.12
              : 0.72,
        },
      })),
    [graph.edges, highlighted],
  );

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(null);
        setActive(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);
  const footnotes = [
    ...new Map(layout.creditNotes.map((note) => [note.credits, note.credits])).values(),
  ];
  return (
    <section
      ref={container}
      className="sequence-sheet relative w-full overflow-hidden rounded-panel bg-surface"
      aria-label="Course sequence sheet"
    >
      <div
        className="sequence-table-header"
        style={{
          gridTemplateColumns: `${LEFT_LABEL_WIDTH}px minmax(0, 1fr) ${RIGHT_TOTAL_WIDTH}px`,
        }}
      >
        <span>Semester</span>
        <span>Course</span>
        <span className="text-right">Credits</span>
      </div>
      <div
        role="region"
        aria-label="Course sequence diagram"
        className="sequence-canvas"
        style={{ width: layout.width, height: layout.height }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ width: layout.width, height: layout.height }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          onNodeMouseEnter={(_, node) => highlight(node.type === "sequenceCourse" ? node.id : null)}
          onNodeMouseLeave={(_, node) => node.type === "sequenceCourse" && highlight(null)}
          onPaneClick={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
            setActive(null);
            setExpanded(null);
          }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          proOptions={{ hideAttribution: true }}
        />
      </div>
      <div className="sequence-sheet-total flex items-center justify-end gap-2 px-4 py-3 text-[14px] font-semibold text-ink tabular-nums">
        <span>Total</span>
        <span>{formatCredits(map.degree.required)}</span>
      </div>
      {footnotes.length ? (
        <div className="grid gap-1 px-4 pb-3 text-[12px] text-soft">
          {footnotes.map((credits) => (
            <p key={credits}>† after completion of {formatCredits(credits)} credits</p>
          ))}
        </div>
      ) : null}
      <p className="sr-only">
        Credit threshold notes:{" "}
        {layout.creditNotes
          .map((note) => `${note.code} after ${note.credits} credits`)
          .join(", ") || "none"}
        .
      </p>
    </section>
  );
}
