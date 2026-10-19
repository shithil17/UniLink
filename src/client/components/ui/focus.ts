/**
 * The one keyboard-focus style: a solid `brand` outline set off from the control. Every interactive
 * element (shadcn controls, tabs, links, custom buttons) uses this string instead of its own ring.
 */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-brand";

/** The same outline for controls whose border already marks the edge (inputs, selects): no gap. */
export const focusRingInset =
  "focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-brand";
