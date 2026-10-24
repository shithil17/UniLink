import type { ReactNode } from "react";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { courseHue } from "@/lib/courseHue";
import {
  categoryAnchor,
  formatCredits,
  isNonCreditCategory,
  overNote,
  trailProgressLine,
} from "@/lib/courseMap";
import { STATE_LABEL, stateKind } from "@/lib/stateKind";
import type { CourseMap, CourseStatus } from "../../../shared/schemas/courses";
import { slotLabel } from "../../../shared/slotChoice";
import { CourseCode } from "./CourseCode";
import { StateMark } from "./StateMark";

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];
type MapStudentCourse = CourseMap["extras"][number];

/** A flat panel: `surface`, radius 20 (24 from `md`), no border; the rows carry their own hairlines. */
const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";
const rowClass =
  "flex min-h-[60px] w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left first:border-t-0";
const tapRowClass = `${rowClass} hover:bg-tint active:bg-tint ${press} ${focusRingInset}`;

/** The credits cell: 15/600 `soft` with a 12px `faint` "cr", right-aligned. */
function CreditsCell({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-right text-[15px] font-semibold text-soft tabular-nums">
      {children}
      <span className="text-xs font-normal text-faint"> cr</span>
    </span>
  );
}

function NonCreditCell() {
  return (
    <span className="shrink-0 text-right text-[13px] leading-[1.3] font-medium text-faint">
      non-credit
    </span>
  );
}

/** The state printed as a word beside the mark, so no row depends on the shape alone. */
function StatusWord({ status, waived }: { status: CourseStatus; waived: boolean }) {
  return (
    <span className="shrink-0 text-[13px] leading-[1.3] font-medium text-faint">
      {STATE_LABEL[stateKind(status, waived)]}
    </span>
  );
}

/** A student's own course has no prerequisites: it is done or it is open to take. */
function studentCourseStatus(course: { done: boolean }): CourseStatus {
  return course.done ? "done" : "available";
}

type Retake = ReadonlySet<string>;

/** Shown on a row whose course has an attempt and may still be retaken. */
function CanRetake() {
  return (
    <Badge variant="soft" className="shrink-0">
      Can retake
    </Badge>
  );
}

/**
 * The course row: a 20px state mark, the title (15/500, ellipsis) over the code chip and the state
 * word, and the credits on the right. The row sets `data-hue` so the mark takes the course's ink.
 * Several choice codes share one chip and the row wraps instead of cutting a choice off.
 */
function CourseRow({
  code,
  title,
  status,
  waived,
  open = false,
  note,
  trailing,
  credits,
  onOpen,
}: {
  /** One code, or several joined with "/" while a choice slot is still open. */
  code: string;
  title: string;
  status: CourseStatus;
  waived: boolean;
  /** A choice slot nobody has taken yet: its title and codes wrap. */
  open?: boolean;
  /** Faint text after the state word (a student course's category). */
  note?: string;
  trailing?: ReactNode;
  credits: ReactNode;
  onOpen: () => void;
}) {
  const hueFrom = code.split("/")[0];
  return (
    <li data-hue={courseHue(hueFrom)}>
      <button type="button" className={tapRowClass} onClick={onOpen}>
        <StateMark status={status} waived={waived} inCourse />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[15px] leading-[1.35] font-medium text-ink ${open ? "line-clamp-2" : "truncate"}`}
          >
            {title}
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-2">
            <CourseCode
              code={code}
              hueFrom={hueFrom}
              className={open ? "min-w-0 shrink whitespace-normal wrap-anywhere" : undefined}
            />
            <StatusWord status={status} waived={waived} />
            {note ? (
              <span className="min-w-0 truncate text-[13px] leading-[1.3] font-medium text-faint">
                · {note}
              </span>
            ) : null}
          </p>
        </div>
        {trailing}
        {credits}
      </button>
    </li>
  );
}

function SlotRow({
  slot,
  hasTrails,
  retake,
  onOpen,
  onAdd,
}: {
  slot: Slot;
  /** The slot's category lists trails, so an empty slot says to pick from one. */
  hasTrails: boolean;
  retake?: Retake;
  onOpen: () => void;
  onAdd: () => void;
}) {
  if (slot.kind === "elective" && !slot.studentCourse) {
    // An open elective is a prompt, not a course: no hue, and the line says what to do.
    return (
      <li className={rowClass}>
        <StateMark status={slot.status} waived={slot.waived} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-[1.35] font-medium text-ink">
            {slot.title || slot.code}
          </p>
          <p className="mt-1 text-[13px] leading-[1.3] font-medium text-faint">
            {slot.code} · {hasTrails ? "Pick from a trail" : "Any discipline"}
          </p>
        </div>
        {slot.nonCredit ? (
          <NonCreditCell />
        ) : (
          <CreditsCell>{formatCredits(slot.credits)}</CreditsCell>
        )}
        <Button variant="outline" size="sm" className="shrink-0" onClick={onAdd}>
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
    <CourseRow
      code={filler ? filler.code : label.code}
      title={filler ? filler.title : label.title}
      status={filler ? studentCourseStatus(filler) : slot.status}
      waived={filler ? filler.waived : slot.waived}
      open={open}
      trailing={canRetake ? <CanRetake /> : null}
      credits={
        filler || !slot.nonCredit ? (
          <CreditsCell>{formatCredits(filler ? filler.credits : slot.credits)}</CreditsCell>
        ) : (
          <NonCreditCell />
        )
      }
      onOpen={onOpen}
    />
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
  const nonCredit = isNonCreditCategory(category);
  const anchor = categoryAnchor(category.name);
  return (
    <section aria-labelledby={anchor}>
      <SectionHeader
        id={anchor}
        title={category.name}
        action={
          <span className="text-[13px] leading-[1.3] font-medium text-faint tabular-nums">
            {nonCredit
              ? "Non-credit"
              : `${formatCredits(category.earned)} of ${formatCredits(category.required)} credits`}
            {over && !nonCredit ? ` (${over})` : null}
          </span>
        }
      />
      <div className={panel}>
        {category.trails ? (
          <p className="border-b border-line px-4 py-3 text-sm text-soft">
            {trailProgressLine(category.trails)}
          </p>
        ) : null}
        <ul>
          {category.slots.map((slot, i) => (
            <SlotRow
              key={`${slot.code}-${i}`}
              slot={slot}
              hasTrails={category.trails !== null}
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
    <section aria-labelledby="extras">
      <SectionHeader
        id="extras"
        title="Your extra courses"
        count={extras.length}
        action={
          <Button variant="outline" size="sm" onClick={onAdd}>
            Add course
          </Button>
        }
      />
      <div className={panel}>
        {extras.length === 0 ? (
          <p className="px-4 py-4 text-sm text-soft">
            Courses beyond your electives, and any you exclude, show up here.
          </p>
        ) : (
          <ul>
            {extras.map((course) => (
              <CourseRow
                key={course.id}
                code={course.code}
                title={course.title}
                status={studentCourseStatus(course)}
                waived={course.waived}
                note={course.category}
                trailing={
                  course.excluded ? (
                    <Badge variant="outline" className="shrink-0">
                      Excluded
                    </Badge>
                  ) : retake?.has(course.code) ? (
                    <CanRetake />
                  ) : null
                }
                credits={<CreditsCell>{formatCredits(course.credits)}</CreditsCell>}
                onOpen={() => onOpen(course)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
