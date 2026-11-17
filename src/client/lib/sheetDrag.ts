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
/**
 * A collapsible sheet can rest as a peek strip instead of closing. `travel` below is the distance
 * from fully open to the peek, in px.
 */
/** Dragged past this share of the travel, an open sheet collapses on release. */
export const COLLAPSE_FRACTION = 0.34;
/** A downward release faster than this (px per ms) collapses it whatever the distance. */
export const COLLAPSE_VELOCITY = 0.55;
/** Lifted past this share of the travel, a collapsed sheet expands on release (easier than collapsing). */
export const EXPAND_FRACTION = 0.2;
/** An upward release faster than this (px per ms) expands it whatever the distance. */
export const EXPAND_VELOCITY = 0.4;
/** A press that moves less than this (px) is a tap, not a drag. */
export const TAP_SLOP = 6;
/** The height of a collapsed sheet's peek strip in rem (handle and title row), before the bottom inset. */
export const SHEET_PEEK_REM = 5.5;
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

/** The give a drag has past its limit: damped like the upward drag, and capped. */
function giveWay(excess: number): number {
  return Math.min(UP_MAX, Math.pow(excess, UP_EXPONENT));
}

/**
 * The offset of an open collapsible sheet for a raw finger delta: downward follows the finger 1:1
 * until the peek (`travel`), then gives way; upward is damped and capped, as for a plain sheet.
 */
export function expandedDragOffset(rawDelta: number, travel: number): number {
  if (rawDelta <= travel) return dragOffset(rawDelta);
  return travel + giveWay(rawDelta - travel);
}

/**
 * The offset of a collapsed sheet, measured from its resting place at the peek: lifting follows the
 * finger 1:1 until it is fully open (`-travel`), then gives way; pulling further down is damped.
 */
export function peekDragOffset(rawDelta: number, travel: number): number {
  if (rawDelta >= 0) return giveWay(rawDelta);
  if (-rawDelta <= travel) return rawDelta;
  return -(travel + giveWay(-rawDelta - travel));
}

/** Whether releasing an open sheet `offset` px down collapses it. `velocity` is px per ms, downward positive. */
export function shouldCollapse(offset: number, travel: number, velocity: number): boolean {
  return offset > travel * COLLAPSE_FRACTION || velocity > COLLAPSE_VELOCITY;
}

/** Whether releasing a collapsed sheet `offset` px from the peek (negative is up) expands it. */
export function shouldExpand(offset: number, travel: number, velocity: number): boolean {
  return -offset > travel * EXPAND_FRACTION || -velocity > EXPAND_VELOCITY;
}

/** Whether a press that travelled `movement` px was a tap. */
export function isTap(movement: number): boolean {
  return Math.abs(movement) < TAP_SLOP;
}

/**
 * How open a collapsible sheet looks at `offset` px, from 0 (the peek) to 1 (fully open); the scrim
 * follows it. `collapsed` says which rest the offset is measured from.
 */
export function openness(offset: number, travel: number, collapsed: boolean): number {
  if (travel <= 0) return collapsed ? 0 : 1;
  const open = collapsed ? -offset / travel : 1 - offset / travel;
  return Math.max(0, Math.min(1, open));
}
