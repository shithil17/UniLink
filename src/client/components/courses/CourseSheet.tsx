import { useState } from "react";
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
import { formatCredits, slotCodeChoices } from "@/lib/courseMap";
import { useDeleteStudentCourse } from "@/lib/courses";
import type { CourseMap, CourseMapTrails } from "../../../shared/schemas/courses";
import { slotLabel } from "../../../shared/slotChoice";
import { AttemptSection } from "./AttemptSection";
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
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {label.code} {label.title}
        </SheetTitle>
        <SheetDescription>
          {slot.nonCredit ? "Non-credit" : `${formatCredits(slot.credits)} credits`} ·{" "}
          {slot.category}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-5">
        <div className="flex flex-wrap items-center gap-2">
          <StateMark showLabel status={slot.status} waived={slot.waived} />
        </div>
        {label.others.length > 0 ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-soft">
              {label.chosen ? "Other choices for this slot" : "Or take instead"}
            </h3>
            <ul className="text-sm text-body">
              {label.others.map((a) => (
                <li key={a.code}>
                  {a.code} {a.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <PrereqText rule={slot.prereq} />
        {slot.status === "locked" ? (
          <p className="text-sm text-soft">You haven't met the prerequisites yet.</p>
        ) : null}
        <AttemptSection choices={choices} onSaved={onClose} />
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
        <SheetTitle>
          {course.code} {course.title}
        </SheetTitle>
        <SheetDescription>
          {formatCredits(course.credits)} credits · {course.category} · your own course
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-5">
        <div className="flex flex-wrap items-center gap-2">
          <StateMark showLabel status={course.done ? "done" : "available"} waived={course.waived} />
          {course.excluded ? <Badge variant="outline">Excluded</Badge> : null}
        </div>
        <AttemptSection choices={[course]} onSaved={onClose} />
        <div className="space-y-3 border-t border-line pt-4">
          {confirmingDelete ? (
            <>
              <p className="text-sm text-body">Delete {course.code}? Its grades are deleted too.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={onDelete}
                >
                  {remove.isPending ? "Deleting..." : "Delete course"}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
                Edit course
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-destructive"
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
