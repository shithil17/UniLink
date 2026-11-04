// The grade planner: projected CGPA with mock grades, a prediction of where the student will finish,
// and the retakes worth paying for. Pure arithmetic on top of `grading.ts`, which owns the CGPA math,
// the scale and the retake policy. It runs in the browser.
//
// The model: every remaining course, and every retake, is predicted from the student's own grades in
// the same category (General Education, Core, ...), pulled toward their overall average while a
// category has few courses. The advisor compares the graduation CGPA those predictions give with the
// target. A retake is suggested only when its predicted grade beats the course's current best, and
// the retakes that gain most per credit of tuition come first.

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
// little about their ceiling, so the fallback ceiling is assumed and the screen says the predictions
// are rough. Revisit once real transcripts show a better cut-off.
export const PLANNER_HISTORY_MIN_COURSES = 8;
// ceiling: the best grade assumed while history is thin. It only bounds the best case. Revisit if
// advice for new students proves too hopeful.
export const PLANNER_FALLBACK_CEILING = "A-";
// ceiling: the average a student with no history is predicted at. Every prediction starts here and
// moves toward the student's own grades as they add courses. Revisit once real transcripts show the
// usual first-year average.
export const PLANNER_FALLBACK_AVERAGE = "B+";
// ceiling: how many courses' worth of weight the starting point keeps. With 3, a category with three
// courses is predicted halfway between its own average and the overall one. Larger trusts the
// student's own category grades less. Revisit once predictions can be checked against real results.
export const PLANNER_PRIOR_COURSES = 3;
// ceiling: each retake costs extra tuition, so advice names a handful at most. Revisit if students
// need longer plans.
export const PLANNER_MAX_SUGGESTIONS = 5;

/** Float noise below this is not a difference: comparing 3.7 against a computed 3.7000000000000004. */
const EPSILON = 1e-9;

/** The scale and retake policy the planner works with; both are Strategy objects from `grading.ts`. */
export type PlannerRules = { scale: GradeScale; policy: RetakePolicy };

export const DEFAULT_RULES: PlannerRules = { scale: NSU_SCALE, policy: BELOW_B_PLUS_POLICY };

/** A course the student has taken, keyed by its code. `category` groups it for predictions. */
export type PlannerCourse = CourseRecord & { code: string; category?: string };

/**
 * A hypothetical grade. On a course the student has attempts for it is a retake (or the pass of an
 * F-only course); otherwise it is a first attempt at a course of `credits` credits. `code` is any key
 * that is unique per course or slot, so an elective slot with no course picked can use its own key.
 */
export type PlannerMock = { code: string; credits: number; grade: string };

/** A course map slot still to finish. A slot whose `code` matches a record is an F-only course. */
export type RemainingCourse = { code: string; credits: number; category?: string };

/** The best grade the student reaches, from their own history: it bounds the best case. */
export type CeilingGrade = {
  grade: string;
  points: number;
  /** "history": the upper quartile of the student's own grades. "fallback": too few graded courses. */
  source: "history" | "fallback";
  /** Graded courses the ceiling was drawn from. */
  gradedCourses: number;
};

/** What the student is predicted to get, overall and by category. */
export type Outlook = {
  /** The predicted grade points of a course in a category the student has no grades in. */
  overall: number;
  /** The student's own average so far (their CGPA), or null with no graded course. */
  average: number | null;
  byCategory: Record<string, { predicted: number; courses: number }>;
  /** "fallback" while there are fewer than `PLANNER_HISTORY_MIN_COURSES` graded courses. */
  source: "history" | "fallback";
  gradedCourses: number;
};

export type SuggestedRetake = {
  code: string;
  credits: number;
  currentBest: string;
  /** The predicted grade, to the nearest scale grade: what a retake is likely to land. */
  aimFor: string;
  /** Predicted grade points gained per credit, which is also the CGPA gain per credit of tuition paid. */
  gainPerCredit: number;
};

type AdviceBase = {
  target: number;
  ceiling: CeilingGrade;
  outlook: Outlook;
  /** Unmocked remaining credits. */
  remainingCredits: number;
  /** The average the predictions give over those credits, or null when none are left. */
  predictedAverage: number | null;
  text: string;
};

/** Where the student finishes, and the average the target needs, once the given retakes are done. */
type Finish = {
  /** Predicted graduation CGPA, or null with nothing to go on. */
  predictedCgpa: number | null;
  /** The average the target needs over the remaining credits, or null when none are left. */
  neededAverage: number | null;
};

export type Advice =
  | (AdviceBase & { kind: "reached"; cgpa: number })
  | (AdviceBase & Finish & { kind: "no_retakes_needed" })
  | (AdviceBase & Finish & { kind: "retakes_suggested"; retakes: SuggestedRetake[] })
  | (AdviceBase &
      Finish & {
        kind: "out_of_reach";
        /** The retakes that help most, at most `PLANNER_MAX_SUGGESTIONS`; the finish counts them. */
        retakes: SuggestedRetake[];
        /** The CGPA with the ceiling grade in every remaining course and every eligible retake. */
        bestCaseCgpa: number | null;
        /** The CGPA with the scale's top grade in every remaining course and every eligible retake. */
        maxCgpa: number | null;
        /** `maxCgpa` meets the target: unlikely at the usual grades (a stretch), but not impossible. */
        possible: boolean;
        /** True when the target is predicted reachable, but only with more retakes than the advisor lists. */
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

// --- History: ceiling and outlook ---

/** Scale grades, best first. */
function gradesByPoints(scale: GradeScale): [string, number][] {
  return Object.entries(scale.points).sort((a, b) => b[1] - a[1]);
}

/** The best scale grade at or below `points`. */
function snapDown(points: number, scale: GradeScale): [string, number] {
  const grades = gradesByPoints(scale);
  return grades.find(([, p]) => p <= points + EPSILON) ?? grades[grades.length - 1];
}

/** The scale grade nearest `points`; a tie goes to the lower grade, so a prediction never reads better than it is. */
function nearestGrade(points: number, scale: GradeScale): string {
  let best = gradesByPoints(scale)[0];
  for (const entry of gradesByPoints(scale)) {
    if (Math.abs(entry[1] - points) <= Math.abs(best[1] - points) + EPSILON) best = entry;
  }
  return best[0];
}

/** The `q` quantile (0 to 1) of ascending values, interpolating between neighbours. */
function quantile(sorted: readonly number[], q: number): number {
  const position = q * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
}

/** The courses behind the history: best grade per graded course. F counts; I, W, WV, non-credit and excluded do not. */
function history(records: readonly PlannerCourse[], scale: GradeScale) {
  const out: { points: number; credits: number; category: string | undefined }[] = [];
  for (const record of records) {
    if (record.nonCredit || record.excluded) continue;
    const best = bestAttempt(record.attempts, scale);
    if (best) {
      out.push({
        points: gradePoints(best.grade, scale) ?? 0,
        credits: record.credits,
        category: record.category,
      });
    }
  }
  return out;
}

/**
 * The best grade the planner assumes the student can reach: the upper quartile of their best grade
 * per graded course, snapped down to a scale grade. Below `PLANNER_HISTORY_MIN_COURSES` graded
 * courses it is the fallback grade instead. It only bounds the best case; predictions come from
 * `outlook()`.
 */
export function realisticCeiling(
  records: readonly PlannerCourse[],
  rules: PlannerRules = DEFAULT_RULES,
): CeilingGrade {
  const points = history(records, rules.scale)
    .map((h) => h.points)
    .sort((a, b) => a - b);
  if (points.length < PLANNER_HISTORY_MIN_COURSES) {
    return {
      grade: PLANNER_FALLBACK_CEILING,
      points: gradePoints(PLANNER_FALLBACK_CEILING, rules.scale) ?? 0,
      source: "fallback",
      gradedCourses: points.length,
    };
  }
  const [grade, snapped] = snapDown(quantile(points, 0.75), rules.scale);
  return { grade, points: snapped, source: "history", gradedCourses: points.length };
}

/** Pulls a mean over `courses` courses toward `prior`, which keeps `PLANNER_PRIOR_COURSES` courses of weight. */
const shrink = (mean: number, courses: number, prior: number) =>
  (mean * courses + prior * PLANNER_PRIOR_COURSES) / (courses + PLANNER_PRIOR_COURSES);

/**
 * What the student is predicted to get. Overall: their credit-weighted average so far, pulled toward
 * `PLANNER_FALLBACK_AVERAGE` while they have few courses. By category: their average in that
 * category, pulled toward the overall prediction the same way. So a student with A's in Core and D's
 * in General Education is predicted high in one and low in the other, and a category with one course
 * does not swing the prediction on its own. Mock grades are never part of it.
 */
export function outlook(
  records: readonly PlannerCourse[],
  rules: PlannerRules = DEFAULT_RULES,
): Outlook {
  const courses = history(records, rules.scale);
  const fallback = gradePoints(PLANNER_FALLBACK_AVERAGE, rules.scale) ?? 0;
  const mean = (list: typeof courses) => {
    const credits = list.reduce((sum, c) => sum + c.credits, 0);
    return credits > 0 ? list.reduce((sum, c) => sum + c.points * c.credits, 0) / credits : null;
  };

  const average = mean(courses);
  const overall = average === null ? fallback : shrink(average, courses.length, fallback);
  const groups = new Map<string, typeof courses>();
  for (const c of courses) {
    if (c.category === undefined) continue;
    groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
  }
  const byCategory: Outlook["byCategory"] = {};
  for (const [category, list] of groups) {
    const m = mean(list);
    if (m !== null) {
      byCategory[category] = { predicted: shrink(m, list.length, overall), courses: list.length };
    }
  }
  return {
    overall,
    average,
    byCategory,
    source: courses.length >= PLANNER_HISTORY_MIN_COURSES ? "history" : "fallback",
    gradedCourses: courses.length,
  };
}

/** The predicted grade points of a course in `category`. */
export function predictedPoints(o: Outlook, category: string | undefined): number {
  return (category !== undefined ? o.byCategory[category]?.predicted : undefined) ?? o.overall;
}

// --- Needed average and predicted finish ---

/** Whether the record already has a graded attempt behind the CGPA (an F-only course does). */
const isGradedRecord = (record: PlannerCourse, scale: GradeScale) =>
  gradedCredits([record], scale) > 0;

/** The remaining credits with no graded attempt yet: only these grow the credits behind the CGPA. */
function newCredits(
  records: readonly PlannerCourse[],
  remaining: readonly RemainingCourse[],
  scale: GradeScale,
): number {
  const byCode = new Map(records.map((r) => [r.code, r]));
  return remaining
    .filter((r) => {
      const record = byCode.get(r.code);
      return !record || !isGradedRecord(record, scale);
    })
    .reduce((sum, r) => sum + r.credits, 0);
}

const creditsOf = (list: readonly { credits: number }[]) =>
  list.reduce((sum, r) => sum + r.credits, 0);

/**
 * The average grade point needed over `remaining` to finish on `target`, with `extra` grade points
 * already earned from retakes (a retake adds points but no graded credits). Null with none remaining.
 */
function neededFor(
  records: readonly PlannerCourse[],
  remaining: readonly RemainingCourse[],
  target: number,
  extra: number,
  scale: GradeScale,
): number | null {
  const remainingCredits = creditsOf(remaining);
  if (remainingCredits <= 0) return null;
  const done = gradedCredits(records, scale);
  const weighted = (cgpa(records, scale) ?? 0) * done + extra;
  return (target * (done + newCredits(records, remaining, scale)) - weighted) / remainingCredits;
}

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
  return neededFor(records, remaining, target, 0, rules.scale);
}

/**
 * The graduation CGPA with `pointsOf(course)` grade points in every remaining course, plus `extra`
 * grade points from retakes (a retake replaces a best grade, so it adds points but no credits).
 * Null with nothing to go on.
 */
function finishCgpa(
  records: readonly PlannerCourse[],
  remaining: readonly RemainingCourse[],
  pointsOf: (r: RemainingCourse) => number,
  extra: number,
  scale: GradeScale,
): number | null {
  const done = gradedCredits(records, scale);
  const credits = done + newCredits(records, remaining, scale);
  if (credits <= 0) return null;
  const future = remaining.reduce((sum, r) => sum + pointsOf(r) * r.credits, 0);
  return ((cgpa(records, scale) ?? 0) * done + future + extra) / credits;
}

// --- Retake advice ---

/**
 * Courses worth a retake, best first: the policy allows it, the course is graded and credit-bearing,
 * its predicted grade beats its best, it has no mock, and it is not one of the remaining courses (an
 * F-only course has to be passed anyway, so it is never an optional retake). Largest predicted gain
 * per credit first, then more credits, then course code.
 */
function retakeCandidates(
  records: readonly PlannerCourse[],
  skip: ReadonlySet<string>,
  pointsOf: (record: PlannerCourse) => number,
  rules: PlannerRules,
): SuggestedRetake[] {
  const out: SuggestedRetake[] = [];
  for (const record of records) {
    if (record.nonCredit || record.excluded || skip.has(record.code)) continue;
    const best = bestAttempt(record.attempts, rules.scale);
    if (!best || !isPassingGrade(best.grade)) continue;
    if (!canRetake(record.attempts, rules.policy, rules.scale)) continue;
    const predicted = pointsOf(record);
    const gain = predicted - (gradePoints(best.grade, rules.scale) ?? 0);
    if (gain <= EPSILON) continue;
    out.push({
      code: record.code,
      credits: record.credits,
      currentBest: best.grade,
      aimFor: nearestGrade(predicted, rules.scale),
      gainPerCredit: gain,
    });
  }
  return out.sort(
    (a, b) =>
      b.gainPerCredit - a.gainPerCredit || b.credits - a.credits || a.code.localeCompare(b.code),
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const gainOf = (retakes: readonly SuggestedRetake[]) =>
  retakes.reduce((sum, r) => sum + r.gainPerCredit * r.credits, 0);
const totalGain = (r: SuggestedRetake) => r.gainPerCredit * r.credits;

/** Candidates by total predicted gain, best first; ties go to fewer credits (cheaper), then code. */
const byTotalGain = (list: readonly SuggestedRetake[]) =>
  [...list].sort((a, b) => {
    const diff = totalGain(b) - totalGain(a);
    if (Math.abs(diff) > EPSILON) return diff;
    return a.credits - b.credits || a.code.localeCompare(b.code);
  });

/**
 * Advice for reaching `target`. Mocks count: mocked remaining courses leave the remaining credits and
 * mocked past courses are not suggested as retakes.
 *
 * 1. Nothing is left to take and the projected CGPA meets the target: `reached`. With courses left
 *    the answer is the predicted finish, even when the CGPA is at the target today.
 * 2. The predicted graduation CGPA, with no retakes, meets it: `no_retakes_needed`.
 * 3. Otherwise retakes are added one at a time, largest predicted gain per credit first, stopping as
 *    soon as the predicted finish meets the target: `retakes_suggested`.
 * 4. If that fails within `PLANNER_MAX_SUGGESTIONS`, the smallest set of retakes with the largest total
 *    gain that meets the target is suggested instead (gains add, so that is the top few by total gain).
 * 5. If no such set exists: `out_of_reach`, with the predicted finish, the retakes that help most, the
 *    best case (the student's ceiling grade everywhere) and `maxCgpa` (the top grade everywhere), so
 *    `possible` tells a stretch from an impossible target.
 */
export function adviseRetakes(
  records: readonly PlannerCourse[],
  mocks: readonly PlannerMock[],
  remaining: readonly RemainingCourse[],
  target: number,
  rules: PlannerRules = DEFAULT_RULES,
): Advice {
  const ceiling = realisticCeiling(records, rules);
  const o = outlook(records, rules);
  const mockedCodes = new Set(mocks.map((m) => m.code));
  const open = remaining.filter((r) => !mockedCodes.has(r.code));
  const remainingCredits = creditsOf(open);
  // A remaining course that already has a record is F-only: it has to be passed, so it is predicted
  // no lower than the lowest passing grade.
  const recordCodes = new Set(records.map((r) => r.code));
  const passFloor =
    gradesByPoints(rules.scale)
      .filter(([g]) => isPassingGrade(g))
      .at(-1)?.[1] ?? 0;
  const predict = (r: { category?: string }) => predictedPoints(o, r.category);
  const predictRemaining = (r: RemainingCourse) =>
    recordCodes.has(r.code) ? Math.max(predict(r), passFloor) : predict(r);
  const predictedAverage =
    remainingCredits > 0
      ? open.reduce((sum, r) => sum + predictRemaining(r) * r.credits, 0) / remainingCredits
      : null;
  const base = { target, ceiling, outlook: o, remainingCredits, predictedAverage };

  const projected = projectedCgpa(records, mocks, rules);
  if (remainingCredits <= 0 && projected !== null && projected >= target - EPSILON) {
    return { ...base, kind: "reached", cgpa: projected, text: "Target reached." };
  }

  const withMocks = applyMocks(records, mocks, rules);
  const finish = (retakes: readonly SuggestedRetake[]): Finish => {
    const extra = gainOf(retakes);
    return {
      predictedCgpa: finishCgpa(withMocks, open, predictRemaining, extra, rules.scale),
      neededAverage: neededFor(withMocks, open, target, extra, rules.scale),
    };
  };
  const meets = (f: Finish) => f.predictedCgpa !== null && f.predictedCgpa >= target - EPSILON;

  const none = finish([]);
  if (meets(none)) {
    return { ...base, ...none, kind: "no_retakes_needed", text: "On track without retakes." };
  }

  const suggested = (retakes: SuggestedRetake[], state: Finish): Advice => ({
    ...base,
    ...state,
    kind: "retakes_suggested",
    retakes,
    text: `Retaking ${plural(retakes.length, "course", "courses")} gets you there.`,
  });

  const skip = new Set([...remaining.map((r) => r.code), ...mockedCodes]);
  const candidates = retakeCandidates(records, skip, predict, rules);
  const picked: SuggestedRetake[] = [];
  let state = none;
  for (const candidate of candidates) {
    if (meets(state) || picked.length >= PLANNER_MAX_SUGGESTIONS) break;
    picked.push(candidate);
    state = finish(picked);
  }
  if (meets(state)) return suggested(picked, state);

  // Greedy by gain per credit can fill the slots with small courses. Gains add, so the best set of k
  // retakes is the k with the largest total gain: take the smallest k that meets the target.
  const ranked = byTotalGain(candidates);
  for (let k = 1; k <= Math.min(PLANNER_MAX_SUGGESTIONS, ranked.length); k++) {
    const set = ranked.slice(0, k);
    const f = finish(set);
    if (meets(f)) return suggested(set, f);
  }

  // Short of the target: report where the best retakes get the student, and the best case.
  const best = ranked.slice(0, PLANNER_MAX_SUGGESTIONS);
  const final = finish(best);
  const tooManyRetakes = meets(finish(candidates));
  const caseCgpa = (points: number) =>
    finishCgpa(
      withMocks,
      open,
      () => points,
      gainOf(retakeCandidates(records, skip, () => points, rules)),
      rules.scale,
    );
  const bestCaseCgpa = caseCgpa(ceiling.points);
  const maxCgpa = caseCgpa(gradesByPoints(rules.scale)[0][1]);
  const possible = maxCgpa !== null && maxCgpa >= target - EPSILON;
  let text: string;
  if (final.predictedCgpa === null) {
    text = "Nothing to plan with yet.";
  } else if (tooManyRetakes) {
    text = `Needs more than ${plural(PLANNER_MAX_SUGGESTIONS, "retake", "retakes")}.`;
  } else if (possible) {
    text = "A stretch: you'd need grades well above your usual.";
  } else {
    text = "Out of reach by graduation.";
  }
  return {
    ...base,
    ...final,
    kind: "out_of_reach",
    retakes: best,
    bestCaseCgpa,
    maxCgpa,
    possible,
    tooManyRetakes,
    text,
  };
}
