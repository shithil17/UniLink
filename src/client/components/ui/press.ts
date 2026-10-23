/**
 * The shared press feedback: a 140ms scale on `:active` only, with the shared ease. It lives under
 * `motion-safe:`, so reduced motion gets no scale at all. Icon buttons press a little deeper.
 */
export const press =
  "motion-safe:transition-transform motion-safe:duration-140 motion-safe:ease-ui-out motion-safe:active:scale-[.97]";

export const pressIcon =
  "motion-safe:transition-transform motion-safe:duration-140 motion-safe:ease-ui-out motion-safe:active:scale-[.94]";
