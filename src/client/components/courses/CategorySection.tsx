import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import { categoryAnchor, formatCredits, formatTotals, overNote } from "@/lib/courseMap";
import type { CourseMap } from "../../../shared/schemas/courses";
import { slotLabel } from "../../../shared/slotChoice";
import { StateMark } from "./StateMark";

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];
type MapStudentCourse = CourseMap["extras"][number];

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const rowClass =
  "flex min-h-14 w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0";
const tapRowClass = `${rowClass} transition-colors hover:bg-tint ${focusRingInset}`;

/** Credits sit on the right edge in tabular figures. */
function CreditsCell({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-right text-sm text-soft tabular-nums">{children}</span>;
}

function slotCredits(slot: Slot) {
  return slot.nonCredit ? "non-credit" : `${formatCredits(slot.credits)} cr`;
}

/** A student's own course has no prerequisites: it is done or it is open to take. */
function studentCourseMark(course: { done: boolean; waived: boolean }) {
  return <StateMark status={course.done ? "done" : "available"} waived={course.waived} />;
}

type Retake = ReadonlySet<string>;

/** Shown on a row whose course has an attempt and may still be retaken. */
function CanRetake() {
  return <Badge className="shrink-0">Can retake</Badge>;
}

function SlotRow({
  slot,
  retake,
  onOpen,
  onAdd,
}: {
  slot: Slot;
  retake?: Retake;
  onOpen: () => void;
  onAdd: () => void;
}) {
  if (slot.kind === "elective" && !slot.studentCourse) {
    return (
      <li className={rowClass}>
        <StateMark status={slot.status} waived={slot.waived} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{slot.title || slot.code}</p>
          <p className="truncate text-sm text-soft">{slot.code} · open elective</p>
        </div>
        <CreditsCell>{slotCredits(slot)}</CreditsCell>
        <Button variant="outline" size="lg" className="shrink-0" onClick={onAdd}>
          Add course
        </Button>
      </li>
    );
  }
  const filler = slot.studentCourse;
  // Several courses can fill this slot: all their codes show until the student takes one.
  const label = slotLabel(slot);
  const open = label.hasChoices && !label.chosen;
  const codes = filler ? [filler.code] : [slot.code, ...slot.alternatives.map((a) => a.code)];
  const canRetake = codes.some((code) => retake?.has(code));
  return (
    <li>
      <button type="button" className={tapRowClass} onClick={onOpen}>
        {filler ? (
          studentCourseMark(filler)
        ) : (
          <StateMark status={slot.status} waived={slot.waived} />
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-ink ${open ? "line-clamp-2" : "truncate"}`}>
            {filler ? filler.title : label.title}
          </p>
          <p className={`text-sm text-soft ${open ? "wrap-anywhere" : "truncate"}`}>
            {filler ? filler.code : label.code}
          </p>
        </div>
        {canRetake ? <CanRetake /> : null}
        <CreditsCell>
          {filler ? `${formatCredits(filler.credits)} cr` : slotCredits(slot)}
        </CreditsCell>
        <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
      </button>
    </li>
  );
}

export function CategorySection({
  category,
  retake,
  onOpenSlot,
  onAdd,
}: {
  category: Category;
  /** Codes that have an attempt and may still be retaken. Unset while attempts load. */
  retake?: Retake;
  onOpenSlot: (slot: Slot) => void;
  onAdd: (category: string) => void;
}) {
  const over = overNote(category.earned, category.required);
  const anchor = categoryAnchor(category.name);
  return (
    <section aria-labelledby={anchor} className="mb-6 break-inside-avoid">
      <div className={panel}>
        <SectionHeader
          id={anchor}
          title={category.name}
          className="px-4 pt-3"
          action={
            <span className="text-soft tabular-nums">
              {formatTotals(category.earned, category.required)} cr
              {over ? <span className="text-faint"> ({over})</span> : null}
            </span>
          }
        />
        <ul>
          {category.slots.map((slot, i) => (
            <SlotRow
              key={`${slot.code}-${i}`}
              slot={slot}
              retake={retake}
              onOpen={() => onOpenSlot(slot)}
              onAdd={() => onAdd(category.name)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ExtrasSection({
  extras,
  retake,
  onOpen,
  onAdd,
}: {
  extras: readonly MapStudentCourse[];
  retake?: Retake;
  onOpen: (course: MapStudentCourse) => void;
  onAdd: () => void;
}) {
  return (
    <section aria-labelledby="extras" className="mb-6 break-inside-avoid">
      <div className={panel}>
        <SectionHeader
          id="extras"
          title="Your extra courses"
          count={extras.length}
          className="px-4 pt-3"
          action={
            <Button variant="outline" size="lg" onClick={onAdd}>
              Add course
            </Button>
          }
        />
        {extras.length === 0 ? (
          <p className="px-4 py-4 text-sm text-soft">
            Courses beyond your electives, and any you exclude, show up here.
          </p>
        ) : (
          <ul>
            {extras.map((course) => (
              <li key={course.id}>
                <button type="button" className={tapRowClass} onClick={() => onOpen(course)}>
                  {studentCourseMark(course)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{course.title}</p>
                    <p className="truncate text-sm text-soft">
                      {course.code} · {course.category}
                    </p>
                  </div>
                  {course.excluded ? <Badge variant="outline">Excluded</Badge> : null}
                  {retake?.has(course.code) && !course.excluded ? <CanRetake /> : null}
                  <CreditsCell>{formatCredits(course.credits)} cr</CreditsCell>
                  <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
