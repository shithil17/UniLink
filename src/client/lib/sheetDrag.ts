/**
 * Pure maths for the bottom-sheet drag: when a release dismisses, how an upward drag is damped, and
 * the spring that settles a short drag back to rest. The sheet component owns the pointer events
 * and the DOM; nothing here touches either, so it is unit tested on its own.
 *
 * These are UI motion constants, not server limits, so they live here and not in `limits.ts`.
 */

/** A drag past this share of the sheet's height dismisses it. */
export const DISMISS_FRACTION = 0.34;
/** A release faster than this (px per ms, downward) dismisses it whatever the distance. */
export const DISMISS_VELOCITY = 0.55;
/** Upward drag follows `pow(d, UP_EXPONENT)`, so it gives way instead of hitting a wall. */
export const UP_EXPONENT = 0.72;
/** The most the sheet can lift above its resting place, in px. */
export const UP_MAX = 28;
/** Spring stiffness (per s squared) and damping ratio; ratio .65 overshoots about 7%. */
export const SPRING_STIFFNESS = 420;
export const SPRING_DAMPING_RATIO = 0.65;
/** The spring is at rest inside this distance (px) and speed (px per s). */
export const SETTLE_DISTANCE = 0.3;
export const SETTLE_SPEED = 8;
/** One animation frame never integrates more than this many seconds, so a stall cannot explode it. */
export const MAX_STEP_SECONDS = 0.032;
/** Dragged a full sheet height, the scrim has lost this share of its opacity. */
export const SCRIM_FADE = 0.8;
/** How many recent pointer samples the release velocity is read from. */
export const VELOCITY_SAMPLES = 6;

const DAMPING = 2 * SPRING_DAMPING_RATIO * Math.sqrt(SPRING_STIFFNESS);

export type SpringState = { x: number; v: number };
export type DragSample = { t: number; y: number };

/** Whether releasing now closes the sheet. `velocity` is px per ms, positive downward. */
export function shouldDismiss(distance: number, height: number, velocity: number): boolean {
  return distance > height * DISMISS_FRACTION || velocity > DISMISS_VELOCITY;
}

/** The sheet's offset for a raw finger delta: downward is 1:1, upward is damped and capped. */
export function dragOffset(rawDelta: number): number {
  if (rawDelta >= 0) return rawDelta;
  return -Math.min(UP_MAX, Math.pow(-rawDelta, UP_EXPONENT));
}

/** Release velocity in px per ms from the oldest to the newest of the recent samples. */
export function releaseVelocity(samples: readonly DragSample[]): number {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return 0;
  return (last.y - first.y) / Math.max(1, last.t - first.t);
}

/** Opacity the scrim keeps at `offset` px into a sheet `height` px tall. */
export function scrimOpacity(offset: number, height: number): number {
  if (height <= 0) return 1;
  return 1 - Math.max(0, Math.min(1, offset / height)) * SCRIM_FADE;
}

/** One semi-implicit Euler step of the damped spring pulling `x` to 0; `dt` is in seconds. */
export function springStep(state: SpringState, dt: number): SpringState {
  const step = Math.min(dt, MAX_STEP_SECONDS);
  const v = state.v + (-SPRING_STIFFNESS * state.x - DAMPING * state.v) * step;
  return { x: state.x + v * step, v };
}

/** True once the spring is close enough to rest that the sheet can snap to 0. */
export function isSettled(state: SpringState): boolean {
  return Math.abs(state.x) < SETTLE_DISTANCE && Math.abs(state.v) < SETTLE_SPEED;
}
