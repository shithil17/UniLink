/**
 * The safe-area-aware inset of a floating control from a viewport edge, never under 12px. Written out
 * in full: Tailwind only generates classes it can read as whole strings in the source.
 */
export const MAP_INSET = {
  top: "top-[max(0.75rem,env(safe-area-inset-top))]",
  left: "left-[max(0.75rem,env(safe-area-inset-left))]",
} as const;
