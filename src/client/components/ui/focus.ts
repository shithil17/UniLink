/**
 * The one keyboard-focus style: a 3px solid `brand` outline set off from the control. Every
 * interactive element (shadcn controls, tabs, links, custom buttons) uses this string instead of
 * its own ring.
 */
export const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-brand";

/** The same outline for controls whose border already marks the edge (inputs, selects): 1px gap, brand border. */
export const focusRingInset =
  "focus-visible:border-brand focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-brand";
