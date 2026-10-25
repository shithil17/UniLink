import { MarkerType, type Edge } from "@xyflow/react";
import type { SequenceLayout } from "./courseSequence";

export function connections(layout: SequenceLayout, active: string | null) {
  if (!active) return null;
  const parents = new Map<string, SequenceLayout["edges"]>();
  const children = new Map<string, SequenceLayout["edges"]>();
  for (const edge of layout.edges) {
    parents.set(edge.target, [...(parents.get(edge.target) ?? []), edge]);
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge]);
  }
  const nodes = new Set([active]);
  const edges = new Set<string>();
  for (const [links, far] of [
    [parents, "source"],
    [children, "target"],
  ] as const) {
    const queue = [active];
    while (queue.length)
      for (const edge of links.get(queue.shift()!) ?? []) {
        edges.add(edge.id);
        const next = edge[far];
        if (!nodes.has(next)) {
          nodes.add(next);
          queue.push(next);
        }
      }
  }
  return { nodes, edges };
}

/** Brand-coloured chain edges on top, everything else faint; neutral when nothing is active. */
export function styleEdges(edges: Edge[], chain: Set<string> | null) {
  return edges.map((edge) => {
    const lit = chain?.has(edge.id) ?? false;
    const color = lit ? "var(--color-brand)" : "var(--color-edge)";
    return {
      ...edge,
      zIndex: lit ? 2 : 0,
      style: {
        ...edge.style,
        stroke: color,
        strokeWidth: lit ? 2 : 1.5,
        opacity: chain && !lit ? 0.08 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    };
  });
}
