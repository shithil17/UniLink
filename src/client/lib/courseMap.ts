import { formatPrereq } from "../../shared/prereqText";
import { currentTerm, type Term } from "../../shared/terms";
import type { CourseMap, CourseMapTrails, PrereqRule } from "../../shared/schemas/courses";

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

/** Share of the required credits earned, 0 to 100. Going over the total fills the bar, never more. */
export function progressPercent(earned: number, required: number): number {
  if (required <= 0) return earned > 0 ? 100 : 0;
  return Math.min(100, Math.round((earned / required) * 100));
}

/** A category with no credits to earn: it has slots and every one of them is non-credit (an internship). */
export function isNonCreditCategory(category: Category): boolean {
  return (
    category.required === 0 && category.slots.length > 0 && category.slots.every((s) => s.nonCredit)
  );
}

/**
 * The one line under a trail category's header: the trail that is met, the one in the lead, or the
 * rule when no trail has a done course yet. The minimum comes from the curriculum.
 */
export function trailProgressLine(trails: CourseMapTrails): string {
  const { minFromOneTrail: min, leading } = trails;
  const lead = trails.trails.find((t) => t.name === leading);
  if (!lead) return `Take at least ${min} from one trail`;
  if (trails.met) {
    return `Trail met: ${lead.name} (${lead.done > min ? `${lead.done} done` : `${lead.done} of ${min} done`})`;
  }
  const added = lead.added > 0 ? `, ${lead.added} added` : "";
  return `${lead.name}: ${lead.done} of ${min} done${added}`;
}

/** A stable element id for a category heading: "Math & Science" -> "cat-math-science". */
export function categoryAnchor(name: string): string {
  return `cat-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

/** A prerequisite rule as one readable line: `CSE115 and (MAT120 or MAT125)`. Null when there is none. */
export function describePrereq(rule: PrereqRule | null | undefined): string | null {
  return formatPrereq(rule) || null;
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
