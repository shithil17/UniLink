import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCredits, formatTotals, overNote } from "@/lib/courseMap";
import type { CourseMap } from "../../../shared/schemas/courses";
import { DoneChip, StatusChip } from "./StatusChip";

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];
type MapStudentCourse = CourseMap["extras"][number];

const rowClass =
  "flex min-h-14 w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0";

function Credits({ slot }: { slot: Slot }) {
  return <>{slot.nonCredit ? "non-credit" : `${formatCredits(slot.credits)} cr`}</>;
}

function SlotRow({ slot, onOpen, onAdd }: { slot: Slot; onOpen: () => void; onAdd: () => void }) {
  if (slot.kind === "elective" && !slot.studentCourse) {
    return (
      <li className={rowClass}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{slot.title || slot.code}</p>
          <p className="text-sm text-soft">
            {slot.code} · <Credits slot={slot} /> · open elective
          </p>
        </div>
        <Button variant="outline" className="h-11 shrink-0" onClick={onAdd}>
          Add course
        </Button>
      </li>
    );
  }
  const filler = slot.studentCourse;
  return (
    <li>
      <button type="button" className={`${rowClass} hover:bg-tint`} onClick={onOpen}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{filler ? filler.title : slot.title}</p>
          <p className="text-sm text-soft">
            {filler ? filler.code : slot.code} ·{" "}
            {filler ? `${formatCredits(filler.credits)} cr` : <Credits slot={slot} />}
            {slot.filledBy && slot.filledBy !== slot.code ? ` · taken as ${slot.filledBy}` : ""}
          </p>
        </div>
        {filler ? <DoneChip done={filler.done} /> : <StatusChip status={slot.status} />}
        <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
      </button>
    </li>
  );
}

export function CategorySection({
  category,
  onOpenSlot,
  onAdd,
}: {
  category: Category;
  onOpenSlot: (slot: Slot) => void;
  onAdd: (category: string) => void;
}) {
  const over = overNote(category.earned, category.required);
  return (
    <section aria-labelledby={`cat-${category.name}`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`cat-${category.name}`} className="font-semibold text-ink">
          {category.name}
        </h2>
        <p className="shrink-0 text-sm text-soft">
          {formatTotals(category.earned, category.required)} cr
          {over ? <span className="text-faint"> ({over})</span> : null}
        </p>
      </div>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {category.slots.map((slot, i) => (
          <SlotRow
            key={`${slot.code}-${i}`}
            slot={slot}
            onOpen={() => onOpenSlot(slot)}
            onAdd={() => onAdd(category.name)}
          />
        ))}
      </ul>
    </section>
  );
}

export function ExtrasSection({
  extras,
  onOpen,
  onAdd,
}: {
  extras: readonly MapStudentCourse[];
  onOpen: (course: MapStudentCourse) => void;
  onAdd: () => void;
}) {
  return (
    <section aria-labelledby="extras" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="extras" className="font-semibold text-ink">
          Your extra courses
        </h2>
        <Button variant="outline" className="h-11" onClick={onAdd}>
          Add course
        </Button>
      </div>
      {extras.length === 0 ? (
        <p className="text-sm text-soft">
          Courses beyond your electives, and any you exclude, are listed here.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface">
          {extras.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                className={`${rowClass} hover:bg-tint`}
                onClick={() => onOpen(course)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{course.title}</p>
                  <p className="text-sm text-soft">
                    {course.code} · {formatCredits(course.credits)} cr · {course.category}
                  </p>
                </div>
                {course.excluded ? <Badge variant="outline">Excluded</Badge> : null}
                <DoneChip done={course.done} />
                <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
