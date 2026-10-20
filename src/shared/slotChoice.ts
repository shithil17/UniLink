import { bestAttempt, gradePoints, isPassingGrade } from "./grading.ts";

/*
 * A course slot can accept more than one course ("ENG115 or BEN205", "PHY107L or its alternative lab").
 * Until the student takes one of them the slot shows all its codes; afterwards it shows the course
 * they took. This file decides which one that is and how the slot reads.
 */

export type SlotChoice = {
  code: string;
  title: string;
  alternatives: readonly { code: string; title: string }[];
  /** The code the student took for this slot, set by the server. Null while none is chosen. */
  chosenCode?: string | null;
};

/** What a row, a list line or a sheet header prints for a slot. */
export type SlotLabel = {
  code: string;
  title: string;
  /** The slot offers more than one course. */
  hasChoices: boolean;
  /** The student has taken one of them; `code` and `title` are that course. */
  chosen: boolean;
  /** The other courses the slot accepts: all the alternatives while unchosen, the ones not taken after. */
  others: { code: string; title: string }[];
};

type ChoiceAttempt = { id: number; courseCode: string; grade: string; createdAt: number };

const newer = (a: ChoiceAttempt, b: ChoiceAttempt) => a.createdAt - b.createdAt || a.id - b.id;

/**
 * Which of `codes` the student took, from their attempts, or null when none was attempted.
 * A code with a passing attempt beats one without; among passing ones the better best grade wins
 * (a waiver ranks below any graded pass); what is left is decided by the most recent attempt.
 */
export function pickChosenCode(
  codes: readonly string[],
  attempts: readonly ChoiceAttempt[],
): string | null {
  type Entry = { code: string; passing: boolean; points: number; latest: ChoiceAttempt };
  const entries: Entry[] = [];
  for (const code of codes) {
    const own = attempts.filter((a) => a.courseCode === code);
    if (own.length === 0) continue;
    const passing = own.some((a) => isPassingGrade(a.grade));
    const best = bestAttempt(own.filter((a) => isPassingGrade(a.grade)));
    entries.push({
      code,
      passing,
      points: best ? (gradePoints(best.grade) ?? -1) : -1,
      latest: own.reduce((x, y) => (newer(x, y) >= 0 ? x : y)),
    });
  }
  entries.sort(
    (a, b) =>
      Number(b.passing) - Number(a.passing) || b.points - a.points || newer(b.latest, a.latest),
  );
  return entries[0]?.code ?? null;
}

/** The label for a slot: every code joined with "/" until one is taken, then the course taken. */
export function slotLabel(slot: SlotChoice): SlotLabel {
  const all = [{ code: slot.code, title: slot.title }, ...slot.alternatives];
  if (all.length === 1) {
    return { ...all[0], hasChoices: false, chosen: false, others: [] };
  }
  const taken = slot.chosenCode ? all.find((c) => c.code === slot.chosenCode) : undefined;
  if (taken) {
    return {
      ...taken,
      hasChoices: true,
      chosen: true,
      others: all.filter((c) => c.code !== taken.code),
    };
  }
  return {
    code: all.map((c) => c.code).join("/"),
    title: all.map((c) => c.title).join(" / "),
    hasChoices: true,
    chosen: false,
    others: [...slot.alternatives],
  };
}
