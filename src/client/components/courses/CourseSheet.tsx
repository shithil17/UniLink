import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import { attemptsForCodes } from "@/lib/attempts";
import { formatCredits, slotCodeChoices } from "@/lib/courseMap";
import { useDeleteStudentCourse } from "@/lib/courses";
import { attemptsQuery } from "@/lib/queries";
import type { CourseMap, CourseMapTrails } from "../../../shared/schemas/courses";
import { slotLabel } from "../../../shared/slotChoice";
import { AttemptSection } from "./AttemptSection";
import { CourseCode } from "./CourseCode";
import { PrereqText } from "./PrereqText";
import { StateMark } from "./StateMark";
import { StudentCourseForm } from "./StudentCourseForm";
import { TrailPicker } from "./TrailPicker";

type Slot = CourseMap["categories"][number]["slots"][number];
type MapStudentCourse = CourseMap["extras"][number];

export type SheetTarget =
  | { type: "slot"; slot: Slot }
  | { type: "extra"; course: MapStudentCourse }
  | { type: "add"; category: string };

/** Everything a tap on the course map opens: slot details, a student course, or the add form. */
export function CourseSheet({
  target,
  categories,
  trailCategory,
  onClose,
}: {
  target: SheetTarget | null;
  categories: readonly string[];
  /** The category the curriculum's elective trails fill, with the student's progress in them. */
  trailCategory?: { name: string; trails: CourseMapTrails };
  onClose: () => void;
}) {
  const trailName = trailCategory?.name;
  const picking = target?.type === "add" && trailCategory?.name === target.category;
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        // The trail picker is a long list: it takes most of the screen and scrolls inside.
        className={
          picking
            ? "data-[side=bottom]:h-[85dvh] data-[side=bottom]:gap-3 data-[side=bottom]:overflow-hidden data-[side=bottom]:pb-0"
            : undefined
        }
      >
        {picking && trailCategory ? (
          <TrailAdd trailCategory={trailCategory} categories={categories} onClose={onClose} />
        ) : target?.type === "add" ? (
          <>
            <SheetHeader>
              <SheetTitle>Add a course</SheetTitle>
              <SheetDescription>It fills the next open elective in its category.</SheetDescription>
            </SheetHeader>
            <div className="px-5">
              <StudentCourseForm
                categories={categories}
                trailCategory={trailName}
                initial={{ category: target.category }}
                onSaved={onClose}
                onCancel={onClose}
              />
            </div>
          </>
        ) : target?.type === "extra" ? (
          <StudentCourseDetails
            course={target.course}
            categories={categories}
            trailCategory={trailName}
            onClose={onClose}
          />
        ) : target?.type === "slot" ? (
          target.slot.studentCourse ? (
            <StudentCourseDetails
              course={target.slot.studentCourse}
              categories={categories}
              trailCategory={trailName}
              onClose={onClose}
            />
          ) : (
            <SlotDetails slot={target.slot} onClose={onClose} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The sheet title: the course's hue chip over its name, in one heading so it reads "CSE225 Data Structures". */
function CourseTitle({ code, title }: { code: string; title: string }) {
  return (
    <SheetTitle className="grid justify-items-start gap-2">
      <CourseCode code={code} hueFrom={code.split("/")[0]} /> <span>{title}</span>
    </SheetTitle>
  );
}

/** The facts list: hairline-separated rows, the label on the left and the value on the right. */
function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid">{children}</dl>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-line py-2">
      <dt className="shrink-0 text-[15px] text-soft">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-right text-[15px] font-semibold text-ink">
        {children}
      </dd>
    </div>
  );
}

/** How many attempts the student has for these codes; a dash while it loads or if it failed. */
function AttemptCount({ codes }: { codes: readonly string[] }) {
  const { data } = useQuery(attemptsQuery);
  if (!data) return <span>-</span>;
  const n = attemptsForCodes(data, codes).length;
  return <span>{n === 0 ? "None yet" : `${n} so far`}</span>;
}

/** Add a course in the trail category: the trail picker first, the free form behind "not listed". */
function TrailAdd({
  trailCategory,
  categories,
  onClose,
}: {
  trailCategory: { name: string; trails: CourseMapTrails };
  categories: readonly string[];
  onClose: () => void;
}) {
  const [manual, setManual] = useState(false);
  if (!manual) {
    return (
      <TrailPicker
        category={trailCategory.name}
        trails={trailCategory.trails}
        onAdded={onClose}
        onNotListed={() => setManual(true)}
      />
    );
  }
  return (
    <>
      <SheetHeader>
        <SheetTitle>Add a course</SheetTitle>
        <SheetDescription>It fills the next open elective in its category.</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <StudentCourseForm
          categories={categories}
          trailCategory={trailCategory.name}
          initial={{ category: trailCategory.name }}
          onSaved={onClose}
          onCancel={() => setManual(false)}
        />
      </div>
    </>
  );
}

function SlotDetails({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const choices = slotCodeChoices(slot);
  const label = slotLabel(slot);
  const locked = slot.status === "locked";
  return (
    <>
      <SheetHeader>
        <CourseTitle code={label.code} title={label.title} />
        <SheetDescription className="text-[13px] text-faint">{slot.category}</SheetDescription>
      </SheetHeader>
      <div className="grid gap-[18px] px-5">
        <Facts>
          <Fact label="Credits">{slot.nonCredit ? "Non-credit" : formatCredits(slot.credits)}</Fact>
          <Fact label="Status">
            <StateMark showLabel status={slot.status} waived={slot.waived} />
          </Fact>
          {label.others.length > 0 ? (
            <Fact label={label.chosen ? "Other choices for this slot" : "Or take instead"}>
              <ul className="grid gap-1 font-medium">
                {label.others.map((a) => (
                  <li key={a.code}>
                    {a.code} {a.title}
                  </li>
                ))}
              </ul>
            </Fact>
          ) : null}
          <Fact label="Prerequisites">
            <PrereqText rule={slot.prereq} met={slot.prereq ? !locked : undefined} />
          </Fact>
          <Fact label="Attempts">
            <AttemptCount codes={choices.map((c) => c.code)} />
          </Fact>
        </Facts>
        <AttemptSection choices={choices} locked={locked} onSaved={onClose} />
      </div>
    </>
  );
}

function StudentCourseDetails({
  course,
  categories,
  trailCategory,
  onClose,
}: {
  course: MapStudentCourse;
  categories: readonly string[];
  trailCategory?: string;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const remove = useDeleteStudentCourse();

  if (editing) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Edit {course.code}</SheetTitle>
          <SheetDescription>Your own course in {course.category}.</SheetDescription>
        </SheetHeader>
        <div className="px-5">
          <StudentCourseForm
            categories={categories}
            trailCategory={trailCategory}
            initial={{ category: course.category }}
            existing={course}
            onSaved={onClose}
            onCancel={() => setEditing(false)}
          />
        </div>
      </>
    );
  }

  const onDelete = () => {
    remove.mutate(course.id, {
      onSuccess: () => {
        toast.success("Course deleted");
        onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <>
      <SheetHeader>
        <CourseTitle code={course.code} title={course.title} />
        <SheetDescription className="text-[13px] text-faint">
          {course.category} · your own course
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-[18px] px-5">
        <Facts>
          <Fact label="Credits">{formatCredits(course.credits)}</Fact>
          <Fact label="Status">
            <StateMark
              showLabel
              status={course.done ? "done" : "available"}
              waived={course.waived}
            />
            {course.excluded ? <Badge variant="outline">Excluded</Badge> : null}
          </Fact>
          <Fact label="Attempts">
            <AttemptCount codes={[course.code]} />
          </Fact>
        </Facts>
        <AttemptSection choices={[course]} onSaved={onClose} />
        <div className="grid gap-3 border-t border-line pt-4">
          {confirmingDelete ? (
            <>
              <p className="text-[15px] text-ink">
                Delete {course.code}? Its grades are deleted too.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="destructive" disabled={remove.isPending} onClick={onDelete}>
                  {remove.isPending ? "Deleting..." : "Delete course"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit course
              </Button>
              <Button
                variant="outline"
                className="text-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete course
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
