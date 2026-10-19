import { currentTerm, type Term } from "../../shared/terms";
import type { CourseMap, PrereqRule } from "../../shared/schemas/courses";

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];

/** 3 -> "3", 1.5 -> "1.5". Credits come in halves, so no rounding is needed. */
export function formatCredits(n: number): string {
  return String(n);
}

/** "136 / 130": earned may pass the required total and that is shown plainly. */
export function formatTotals(earned: number, required: number): string {
  return `${formatCredits(earned)} / ${formatCredits(required)}`;
}

/** "over by 6" when earned passes required, else null. Never an error. */
export function overNote(earned: number, required: number): string | null {
  return earned > required ? `over by ${formatCredits(earned - required)}` : null;
}

/** A prerequisite rule as one readable line: `CSE115 and (MAT120 or MAT125)`. Null when there is none. */
export function describePrereq(rule: PrereqRule | null | undefined): string | null {
  return rule ? describe(rule, false) || null : null;
}

function describe(rule: PrereqRule, nested: boolean): string {
  if ("course" in rule) return rule.course;
  if ("credits" in rule) return `${formatCredits(rule.credits)} credits completed`;
  const mode = "all" in rule ? "all" : "any";
  const parts = ("all" in rule ? rule.all : rule.any)
    .map((r) => describe(r, true))
    .filter((p) => p !== "");
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const joined = parts.join(mode === "all" ? " and " : " or ");
  return nested ? `(${joined})` : joined;
}

/** The codes an attempt can be recorded against for a slot: its own code, then its alternatives. */
export function slotCodeChoices(slot: Slot): { code: string; title: string }[] {
  if (slot.kind === "elective") {
    return slot.studentCourse
      ? [{ code: slot.studentCourse.code, title: slot.studentCourse.title }]
      : [];
  }
  return [{ code: slot.code, title: slot.title }, ...slot.alternatives];
}

/** The category a new student course starts in: the first one with an elective slot, else the first. */
export function defaultElectiveCategory(map: CourseMap): string {
  const withElective = map.categories.find((c) => c.slots.some((s) => s.kind === "elective"));
  return (withElective ?? map.categories[0])?.name ?? "";
}

// ceiling: a degree spans well under 15 terms (4 years of three terms plus retakes). Revisit if a
// program map runs longer or students report missing older terms.
const TERM_OPTIONS_COUNT = 15;

const SEASON_LABEL = { spring: "Spring", summer: "Summer", fall: "Fall" } as const;
const PREVIOUS_SEASON = { spring: "fall", summer: "spring", fall: "summer" } as const;

export const termLabel = (t: Term) => `${SEASON_LABEL[t.season]} ${t.year}`;
export const termValue = (t: Term) => `${t.year}-${t.season}`;

/** The current term and the ones before it, newest first. */
export function termOptions(now: number = Date.now()): Term[] {
  const options: Term[] = [];
  let term = currentTerm(now);
  for (let i = 0; i < TERM_OPTIONS_COUNT; i++) {
    options.push(term);
    term = {
      season: PREVIOUS_SEASON[term.season],
      year: term.season === "spring" ? term.year - 1 : term.year,
    };
  }
  return options;
}
