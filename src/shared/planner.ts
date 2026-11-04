// The grade planner: projected CGPA with mock grades, the average still needed to reach a target, and
// the retakes worth paying for. Pure arithmetic on top of `grading.ts`, which owns the CGPA math, the
// scale and the retake policy; nothing here recomputes a CGPA by hand. It runs in the browser.

import {
  BELOW_B_PLUS_POLICY,
  NSU_SCALE,
  bestAttempt,
  canRetake,
  cgpa,
  countsInCgpa,
  gradePoints,
  gradedCredits,
  isPassingGrade,
  type CourseRecord,
  type GradeScale,
  type RetakePolicy,
} from "./grading";

// Defined here, not in the server-only `limits.ts`, because the client runs the advisor. `limits.ts`
// re-exports them.
// ceiling: with fewer graded courses than this (about two terms), a student's own history says too
// little about their ceiling, so the fallback grade is assumed instead. Revisit once real transcripts
// show a better cut-off.
export const PLANNER_HISTORY_MIN_COURSES = 8;
// ceiling: the grade assumed as the realistic ceiling while history is thin. Never promised. Revisit
// if advice for new students proves too hopeful.
export const PLANNER_FALLBACK_CEILING = "A-";
// ceiling: the grade assumed as a student's usual grade while history is thin. Future courses are
// planned at this grade, so a lower value suggests retakes sooner. Revisit if advice for new
// students proves too hopeful or too gloomy.
export const PLANNER_FALLBACK_TYPICAL = "B+";
// ceiling: each retake costs extra tuition, so advice names a handful at most. Revisit if students
// need longer plans.
export const PLANNER_MAX_SUGGESTIONS = 5;

/** Float noise below this is not a difference: comparing 3.7 against a computed 3.7000000000000004. */
const EPSILON = 1e-9;

/** The scale and retake policy the planner works with; both are Strategy objects from `grading.ts`. */
export type PlannerRules = { scale: GradeScale; policy: RetakePolicy };

export const DEFAULT_RULES: PlannerRules = { scale: NSU_SCALE, policy: BELOW_B_PLUS_POLICY };

/** A course the student has taken, keyed by its code. */
export type PlannerCourse = CourseRecord & { code: string };

/**
 * A hypothetical grade. On a course the student has attempts for it is a retake (or the pass of an
 * F-only course); otherwise it is a first attempt at a course of `credits` credits. `code` is any key
 * that is unique per course or slot, so an elective slot with no course picked can use its own key.
 */
export type PlannerMock = { code: string; credits: number; grade: string };

/** A course map slot still to finish. A slot whose `code` matches a record is an F-only course. */
export type RemainingCourse = { code: string; credits: number };

/** A grade drawn from the student's own history, or a fallback when it is too thin. */
export type HistoryGrade = {
  grade: string;
  points: number;
  /** "history": a quantile of the student's own grades. "fallback": too few graded courses. */
  source: "history" | "fallback";
  /** Graded courses the grade was drawn from. */
  gradedCourses: number;
};

/** The best grade the student reaches: what a retake aims for. */
export type CeilingGrade = HistoryGrade;
/** The grade the student usually gets: what the remaining courses are planned at. */
export type TypicalGrade = HistoryGrade;

export type SuggestedRetake = {
  code: string;
  credits: number;
  currentBest: string;
  /** The ceiling grade. */
  aimFor: string;
  /** Grade points gained per credit, which is also the CGPA gain per credit of tuition paid. */
  gainPerCredit: number;
};

type AdviceBase = { target: number; ceiling: CeilingGrade; typical: TypicalGrade; text: string };

export type Advice =
  | (AdviceBase & { kind: "reached"; cgpa: number })
  | (AdviceBase & {
      kind: "no_retakes_needed";
      neededAverage: number;
      neededGrade: string;
      remainingCredits: number;
    })
  | (AdviceBase & {
      kind: "retakes_suggested";
      retakes: SuggestedRetake[];
      /** The average still needed over the remaining credits once the retakes are done; null when none are left. */
      neededAverage: number | null;
      neededGrade: string | null;
      remainingCredits: number;
    })
  | (AdviceBase & {
      kind: "out_of_reach";
      /**
       * The CGPA with every remaining course at the typical grade and every eligible retake at the
       * ceiling, or null with nothing to go on.
       */
      highestCgpa: number | null;
      /** True when the target is reachable, but only with more retakes than the advisor will suggest. */
      tooManyRetakes: boolean;
    });

// --- Mocks and projection ---

/** Letter grades with points that count in CGPA: the only grades a mock may use. */
function isMockGrade(grade: string, scale: GradeScale): boolean {
  return countsInCgpa(grade) && gradePoints(grade, scale) !== null;
}

/**
 * The records with the mocks applied. A mock on a course adds one attempt, so "best grade counts"
 * does the rest: a mock below the best changes nothing, and passing an F-only course replaces the F's
 * points without adding to the graded credits. A mock on a course that cannot be retaken, or with a
 * grade that has no points, is ignored. A mock on an unknown code is a first attempt at a new course.
 * One mock per code: the last wins.
 */
export function applyMocks(
  records: readonly PlannerCourse[],
  mocks: readonly PlannerMock[],
  rules: PlannerRules = DEFAULT_RULES,
): PlannerCourse[] {
  const byCode = new Map<string, PlannerMock>();
  for (const m of mocks) byCode.set(m.code, m);

  const result: PlannerCourse[] = records.map((record) => {
    const mock = byCode.get(record.code);
    if (!mock) return record;
    byCode.delete(record.code);
    if (!isMockGrade(mock.grade, rules.scale)) return record;
    if (!canRetake(record.attempts, rules.policy, rules.scale)) return record;
    return { ...record, attempts: [...record.attempts, { grade: mock.grade }] };
  });
  for (const mock of byCode.values()) {
    if (!isMockGrade(mock.grade, rules.scale) || !(mock.credits > 0)) continue;
    result.push({ code: mock.code, credits: mock.credits, attempts: [{ grade: mock.grade }] });
  }
  return result;
}

/** CGPA over the real records plus the mocks, through `cgpa()`. Equals `cgpa(records)` with no mocks. */
export function projectedCgpa(
  records: readonly PlannerCourse[],
  mocks: readonly PlannerMock[],
  rules: PlannerRules = DEFAULT_RULES,
): number | null {
  return cgpa(applyMocks(records, mocks, rules), rules.scale);
}

// --- Realistic ceiling ---

/** Scale grades, best first. */
function gradesByPoints(scale: GradeScale): [string, number][] {
  return Object.entries(scale.points).sort((a, b) => b[1] - a[1]);
}

/** The best scale grade at or below `points`. */
function snapDown(points: number, scale: GradeScale): [string, number] {
  const grades = gradesByPoints(scale);
  return grades.find(([, p]) => p <= points + EPSILON) ?? grades[grades.length - 1];
}

/** The worst scale grade at or above `points`, or the best grade when none reaches it. */
function snapUp(points: number, scale: GradeScale): [string, number] {
  const grades = gradesByPoints(scale);
  return [...grades].reverse().find(([, p]) => p >= points - EPSILON) ?? grades[0];
}

/** The `q` quantile (0 to 1) of ascending values, interpolating between neighbours. */
function quantile(sorted: readonly number[], q: number): number {
  const position = q * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
}

/** Best grade points per graded course (F counts; I, W, WV, non-credit and excluded do not), ascending. */
function historyPoints(records: readonly PlannerCourse[], scale: GradeScale): number[] {
  const points: number[] = [];
  for (const record of records) {
    if (record.nonCredit || record.excluded) continue;
    const best = bestAttempt(record.attempts, scale);
    if (best) points.push(gradePoints(best.grade, scale) ?? 0);
  }
  return points.sort((a, b) => a - b);
}

/** The `q` quantile of the history snapped down to a scale grade, or `fallback` while history is thin. */
function historyGrade(
  records: readonly PlannerCourse[],
  q: number,
  fallback: string,
  rules: PlannerRules,
): HistoryGrade {
  const points = historyPoints(records, rules.scale);
  if (points.length < PLANNER_HISTORY_MIN_COURSES) {
    return {
      grade: fallback,
      points: gradePoints(fallback, rules.scale) ?? 0,
      source: "fallback",
      gradedCourses: points.length,
    };
  }
  const [grade, snapped] = snapDown(quantile(points, q), rules.scale);
  return { grade, points: snapped, source: "history", gradedCourses: points.length };
}

/**
 * The best grade the planner assumes the student can reach, which is what a retake aims for: the
 * upper quartile of their best grade per graded course, snapped down to a scale grade. Below
 * `PLANNER_HISTORY_MIN_COURSES` graded courses it is the fallback grade instead.
 */
export function realisticCeiling(
  records: readonly PlannerCourse[],
  rules: PlannerRules = DEFAULT_RULES,
): CeilingGrade {
  return historyGrade(records, 0.75, PLANNER_FALLBACK_CEILING, rules);
}

/**
 * The grade the student usually gets, which is what the remaining courses are planned at: the
 * median of the same history, snapped down. A needed average is compared with this, never with the
 * ceiling, because one good grade now and then does not make an average across every course. Below
 * `PLANNER_HISTORY_MIN_COURSES` graded courses it is the fallback grade, and it is never above the
 * ceiling.
 */
export function typicalGrade(
  records: readonly PlannerCourse[],
  rules: PlannerRules = DEFAULT_RULES,
): TypicalGrade {
  const typical = historyGrade(records, 0.5, PLANNER_FALLBACK_TYPICAL, rules);
  const ceiling = realisticCeiling(records, rules);
  return typical.points > ceiling.points ? { ...ceiling } : typical;
}

// --- Needed average ---

/** Whether the record already has a graded attempt behind the CGPA (an F-only course does). */
const isGradedRecord = (record: PlannerCourse, scale: GradeScale) =>
  gradedCredits([record], scale) > 0;

/**
 * The average grade point the student needs over the `remaining` credits to finish on `target`, or
 * null when there are none. Per course record, not totals: a remaining course that already has a
 * graded F is in the CGPA at 0.0, so passing it adds points but no graded credits, while a course
 * with no graded attempt adds both. The result can be above 4.0 (not reachable); it is never rounded.
 */
export function neededAverage(
  records: readonly PlannerCourse[],
  remaining: readonly RemainingCourse[],
  target: number,
  rules: PlannerRules = DEFAULT_RULES,
): number | null {
  const remainingCredits = remaining.reduce((sum, r) => sum + r.credits, 0);
  if (remainingCredits <= 0) return null;

  const done = gradedCredits(records, rules.scale);
  const weighted = (cgpa(records, rules.scale) ?? 0) * done;
  const byCode = new Map(records.map((r) => [r.code, r]));
  // Only courses with no graded attempt grow the credits behind the CGPA.
  const newCredits = remaining
    .filter((r) => {
      const record = byCode.get(r.code);
      return !record || !isGradedRecord(record, rules.scale);
    })
    .reduce((sum, r) => sum + r.credits, 0);

  return (target * (done + newCredits) - weighted) / remainingCredits;
}

// --- Retake advice ---

type Candidate = SuggestedRetake & { mock: PlannerMock };

/**
 * Courses worth a retake, best first: the policy allows it, the course is graded and credit-bearing,
 * the ceiling beats its best grade, and it is not one of the remaining courses (an F-only course has
 * to be passed anyway, so it is never an optional retake). Largest gain per credit first, then more
 * credits, then course code.
 */
function retakeCandidates(
  records: readonly PlannerCourse[],
  remainingCodes: ReadonlySet<string>,
  mockedCodes: ReadonlySet<string>,
  ceiling: CeilingGrade,
  rules: PlannerRules,
): Candidate[] {
  const out: Candidate[] = [];
  for (const record of records) {
    if (record.nonCredit || record.excluded) continue;
    if (remainingCodes.has(record.code) || mockedCodes.has(record.code)) continue;
    const best = bestAttempt(record.attempts, rules.scale);
    if (!best || !isPassingGrade(best.grade)) continue;
    if (!canRetake(record.attempts, rules.policy, rules.scale)) continue;
    const gain = ceiling.points - (gradePoints(best.grade, rules.scale) ?? 0);
    if (gain <= EPSILON) continue;
    out.push({
      code: record.code,
      credits: record.credits,
      currentBest: best.grade,
      aimFor: ceiling.grade,
      gainPerCredit: gain,
      mock: { code: record.code, credits: record.credits, grade: ceiling.grade },
    });
  }
  return out.sort(
    (a, b) =>
      b.gainPerCredit - a.gainPerCredit || b.credits - a.credits || a.code.localeCompare(b.code),
  );
}

const fmtCgpa = (n: number) => n.toFixed(2);
/** Rounds down, so a CGPA just short of a target never reads as the target. */
const floorCgpa = (n: number) => fmtCgpa(Math.floor(n * 100 + EPSILON) / 100);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Advice for reaching `target`, future first. Mocks count: mocked remaining courses leave the
 * remaining credits and mocked past courses are not suggested again.
 *
 * 1. The projected CGPA already meets the target: `reached`.
 * 2. The needed average over the unmocked remaining credits is at or below the typical grade (what
 *    the student usually gets): `no_retakes_needed`.
 * 3. Otherwise retakes at the ceiling grade are added one at a time, largest gain per credit first,
 *    stopping as soon as the needed average is at or below the typical grade: `retakes_suggested`.
 * 4. If even every candidate retaken at the ceiling cannot get there (or it takes more than
 *    `PLANNER_MAX_SUGGESTIONS` retakes): `out_of_reach`, with the highest CGPA reachable with the
 *    typical grade in the remaining courses and the ceiling in every retake.
 */
export function adviseRetakes(
  records: readonly PlannerCourse[],
  mocks: readonly PlannerMock[],
  remaining: readonly RemainingCourse[],
  target: number,
  rules: PlannerRules = DEFAULT_RULES,
): Advice {
  // Mocks are not part of the history the ceiling comes from.
  const ceiling = realisticCeiling(records, rules);
  const typical = typicalGrade(records, rules);
  const base = { target, ceiling, typical };

  const projected = projectedCgpa(records, mocks, rules);
  if (projected !== null && projected >= target - EPSILON) {
    return {
      ...base,
      kind: "reached",
      cgpa: projected,
      text: `Your CGPA of ${fmtCgpa(projected)} is at or above your target of ${fmtCgpa(target)}.`,
    };
  }

  const mockedCodes = new Set(mocks.map((m) => m.code));
  const open = remaining.filter((r) => !mockedCodes.has(r.code));
  const openCredits = open.reduce((sum, r) => sum + r.credits, 0);
  const candidates = retakeCandidates(
    records,
    new Set(remaining.map((r) => r.code)),
    mockedCodes,
    ceiling,
    rules,
  );

  // Whether the target fits once these retakes are done, and the average it still needs.
  const check = (retakes: readonly Candidate[]) => {
    const withMocks = applyMocks(records, [...mocks, ...retakes.map((r) => r.mock)], rules);
    if (openCredits <= 0) {
      const now = cgpa(withMocks, rules.scale);
      return { fits: now !== null && now >= target - EPSILON, needed: null };
    }
    const needed = neededAverage(withMocks, open, target, rules);
    return { fits: needed !== null && needed <= typical.points + EPSILON, needed };
  };

  const none = check([]);
  if (none.fits && none.needed !== null) {
    const neededGrade = snapUp(none.needed, rules.scale)[0];
    return {
      ...base,
      kind: "no_retakes_needed",
      neededAverage: none.needed,
      neededGrade,
      remainingCredits: openCredits,
      text: `Average ${fmtCgpa(none.needed)} or more in your remaining ${openCredits} credits (a flat ${neededGrade} does it) to reach ${fmtCgpa(target)}. No retakes needed.`,
    };
  }

  const highest = highestReachable(records, mocks, open, candidates, typical, rules);
  if (highest === null || highest < target - EPSILON) {
    return outOfReach(base, highest, false);
  }

  const picked: Candidate[] = [];
  let state = none;
  for (const candidate of candidates) {
    if (state.fits) break;
    if (picked.length >= PLANNER_MAX_SUGGESTIONS) return outOfReach(base, highest, true);
    picked.push(candidate);
    state = check(picked);
  }
  if (!state.fits) return outOfReach(base, highest, true);

  const retakes = picked.map((c) => ({
    code: c.code,
    credits: c.credits,
    currentBest: c.currentBest,
    aimFor: c.aimFor,
    gainPerCredit: c.gainPerCredit,
  }));
  const text =
    `To reach ${fmtCgpa(target)}, ${plural(retakes.length, "retake", "retakes")} ` +
    `would help (aim for ${ceiling.grade} in ${retakes.map((r) => r.code).join(", ")}).`;
  if (state.needed === null) {
    return {
      ...base,
      kind: "retakes_suggested",
      retakes,
      neededAverage: null,
      neededGrade: null,
      remainingCredits: 0,
      text,
    };
  }
  const neededGrade = snapUp(state.needed, rules.scale)[0];
  return {
    ...base,
    kind: "retakes_suggested",
    retakes,
    neededAverage: state.needed,
    neededGrade,
    remainingCredits: openCredits,
    text: `${text} Then average ${fmtCgpa(state.needed)} or more in your remaining ${openCredits} credits (a flat ${neededGrade} does it).`,
  };
}

/** The CGPA with every open remaining course at the typical grade and every candidate retaken at the ceiling. */
function highestReachable(
  records: readonly PlannerCourse[],
  mocks: readonly PlannerMock[],
  open: readonly RemainingCourse[],
  candidates: readonly Candidate[],
  typical: TypicalGrade,
  rules: PlannerRules,
): number | null {
  const atTypical = open.map((r) => ({ code: r.code, credits: r.credits, grade: typical.grade }));
  return projectedCgpa(records, [...mocks, ...atTypical, ...candidates.map((c) => c.mock)], rules);
}

function outOfReach(
  base: { target: number; ceiling: CeilingGrade; typical: TypicalGrade },
  highest: number | null,
  tooManyRetakes: boolean,
): Advice {
  const target = fmtCgpa(base.target);
  let text: string;
  if (highest === null) {
    text = `There is nothing to plan with yet, so ${target} cannot be worked out.`;
  } else if (tooManyRetakes) {
    text = `Reaching ${target} would take more than ${plural(PLANNER_MAX_SUGGESTIONS, "retake", "retakes")}. Retaking every eligible course at ${base.ceiling.grade} and getting your usual ${base.typical.grade} in the rest reaches about ${floorCgpa(highest)}.`;
  } else {
    text = `${target} looks out of reach by graduation. With your usual ${base.typical.grade} in the remaining courses and ${base.ceiling.grade} in every eligible retake, you would reach about ${floorCgpa(highest)}.`;
  }
  return { ...base, kind: "out_of_reach", highestCgpa: highest, tooManyRetakes, text };
}
